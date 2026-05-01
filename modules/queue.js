'use strict';

// ntl:queue — job queue with retries, delays, concurrency, priority, cron
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const { EventEmitter } = require('./events');

const JOB_STATUS = { WAITING: 'waiting', ACTIVE: 'active', DONE: 'done', FAILED: 'failed', DELAYED: 'delayed' };

class Job {
  constructor(id, data, opts) {
    this.id          = id;
    this.data        = data;
    this.opts        = opts || {};
    this.status      = JOB_STATUS.WAITING;
    this.attempts    = 0;
    this.maxAttempts = opts.retries !== undefined ? opts.retries + 1 : 1;
    this.delay       = opts.delay   || 0;
    this.priority    = opts.priority || 0;
    this.timeout     = opts.timeout  || 0;
    this.createdAt   = Date.now();
    this.startedAt   = null;
    this.finishedAt  = null;
    this.error       = null;
    this.result      = null;
    this._runAt      = this.delay ? Date.now() + this.delay : 0;
    this.progress    = 0;
    this._progressCb = null;
  }

  isReady()   { return !this._runAt || Date.now() >= this._runAt; }
  canRetry()  { return this.attempts < this.maxAttempts; }

  reportProgress(pct, data) {
    this.progress = Math.min(100, Math.max(0, pct));
    if (this._progressCb) this._progressCb(this.progress, data);
  }

  toJSON() {
    return {
      id: this.id, data: this.data, status: this.status,
      attempts: this.attempts, maxAttempts: this.maxAttempts,
      delay: this.delay, priority: this.priority,
      createdAt: this.createdAt, startedAt: this.startedAt, finishedAt: this.finishedAt,
      error: this.error?.message, result: this.result, progress: this.progress,
    };
  }
}

class Queue extends EventEmitter {
  constructor(name, opts) {
    super();
    this.name        = name || 'default';
    this._opts       = opts || {};
    this._concurrency = opts.concurrency   || 1;
    this._retryDelay  = opts.retryDelay    || 1000;
    this._rateLimit   = opts.rateLimit     || null;
    this._jobs        = [];
    this._active      = new Map();
    this._done        = [];
    this._handlers    = [];
    this._running     = false;
    this._paused      = false;
    this._idCounter   = 0;
    this._maxHistory  = opts.maxHistory    || 100;
    this._rateLimitTokens = this._rateLimit?.max || Infinity;
    this._rateLimitReset  = Date.now() + (this._rateLimit?.windowMs || 0);
    this._metrics     = { completed: 0, failed: 0, totalDuration: 0 };
  }

  add(data, opts) {
    opts = opts || {};
    const id  = String(++this._idCounter);
    const job = new Job(id, data, opts);
    if (job.delay) { job.status = JOB_STATUS.DELAYED; }
    this._jobs.push(job);
    this._sortQueue();
    this.emit('added', job);
    if (!this._paused) this._tick();
    return job;
  }

  addBulk(items, opts) {
    return items.map(item => this.add(item, opts));
  }

  addDelayed(data, delay, opts) {
    return this.add(data, Object.assign({}, opts, { delay }));
  }

  process(handler) {
    this._handlers.push(handler);
    return this;
  }

  pause()  { this._paused = true;  this.emit('paused');  return this; }
  resume() { this._paused = false; this.emit('resumed'); this._tick(); return this; }

  async drain() {
    return new Promise(resolve => {
      const check = () => {
        if (this._jobs.length === 0 && this._active.size === 0) {
          this.off('completed', check);
          this.off('failed', check);
          resolve();
        }
      };
      this.on('completed', check);
      this.on('failed',    check);
      check();
    });
  }

  async close() {
    this._paused = true;
    await this.drain();
    this.emit('closed');
  }

  _tick() {
    if (this._paused || this._running) return;
    this._running = true;
    while (this._active.size < this._concurrency && !this._paused) {
      const job = this._nextReady();
      if (!job) break;
      this._run(job);
    }
    this._running = false;

    const hasDelayed = this._jobs.some(j => j.status === JOB_STATUS.DELAYED);
    if (hasDelayed) setTimeout(() => this._tick(), 100);
  }

  _nextReady() {
    for (let i = 0; i < this._jobs.length; i++) {
      const j = this._jobs[i];
      if (j.status === JOB_STATUS.WAITING && j.isReady()) {
        this._jobs.splice(i, 1);
        return j;
      }
      if (j.status === JOB_STATUS.DELAYED && j.isReady()) {
        j.status = JOB_STATUS.WAITING;
        this._jobs.splice(i, 1);
        return j;
      }
    }
    return null;
  }

  async _run(job) {
    job.status    = JOB_STATUS.ACTIVE;
    job.startedAt = Date.now();
    job.attempts++;
    this._active.set(job.id, job);
    this.emit('active', job);

    const handler = this._handlers[job.attempts - 1] || this._handlers[this._handlers.length - 1];
    if (!handler) {
      job.status    = JOB_STATUS.FAILED;
      job.error     = new Error('No handler registered');
      job.finishedAt = Date.now();
      this._finalize(job);
      return;
    }

    let timer;
    const timeoutPromise = job.timeout
      ? new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Job timed out')), job.timeout); })
      : null;

    try {
      job._progressCb = (pct, data) => this.emit('progress', job, pct, data);
      const workPromise = Promise.resolve(handler(job));
      const result = timeoutPromise
        ? await Promise.race([workPromise, timeoutPromise])
        : await workPromise;
      if (timer) clearTimeout(timer);
      job.result    = result;
      job.status    = JOB_STATUS.DONE;
      job.finishedAt = Date.now();
      this._metrics.completed++;
      this._metrics.totalDuration += job.finishedAt - job.startedAt;
      this.emit('completed', job, result);
    } catch (err) {
      if (timer) clearTimeout(timer);
      job.error = err;
      if (job.canRetry()) {
        job.status   = JOB_STATUS.WAITING;
        job.startedAt = null;
        this._active.delete(job.id);
        this.emit('retrying', job, err);
        const delay = this._retryDelay * job.attempts;
        setTimeout(() => { this._jobs.unshift(job); this._tick(); }, delay);
        return;
      }
      job.status    = JOB_STATUS.FAILED;
      job.finishedAt = Date.now();
      this._metrics.failed++;
      this.emit('failed', job, err);
    }

    this._finalize(job);
  }

  _finalize(job) {
    this._active.delete(job.id);
    this._done.push(job);
    if (this._done.length > this._maxHistory) this._done.shift();
    this._tick();
  }

  _sortQueue() {
    this._jobs.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  }

  get waiting()   { return this._jobs.filter(j => j.status === JOB_STATUS.WAITING).length; }
  get active()    { return this._active.size; }
  get completed() { return this._metrics.completed; }
  get failed()    { return this._metrics.failed; }
  get delayed()   { return this._jobs.filter(j => j.status === JOB_STATUS.DELAYED).length; }

  metrics() {
    return {
      waiting:  this.waiting,
      active:   this.active,
      completed: this._metrics.completed,
      failed:   this._metrics.failed,
      delayed:  this.delayed,
      avgDuration: this._metrics.completed
        ? Math.round(this._metrics.totalDuration / this._metrics.completed) + 'ms'
        : 'N/A',
    };
  }

  getJob(id)       { return this._active.get(id) || this._jobs.find(j => j.id === id) || this._done.find(j => j.id === id) || null; }
  getActiveJobs()  { return [...this._active.values()]; }
  getWaitingJobs() { return this._jobs.filter(j => j.status === JOB_STATUS.WAITING); }
  getFailedJobs()  { return this._done.filter(j => j.status === JOB_STATUS.FAILED); }
  getDoneJobs()    { return this._done.filter(j => j.status === JOB_STATUS.DONE); }
}

function createQueue(name, opts) { return new Queue(name, opts); }

module.exports = { Queue, Job, JOB_STATUS, createQueue };
