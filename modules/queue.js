'use strict';
// ntl:queue — Production job queue with retries, delays, priorities

const { EventEmitter } = require('./events');

class Job {
  constructor(name, data, options) {
    options = options || {};
    this.id = options.id || (Date.now().toString(36) + Math.random().toString(36).slice(2));
    this.name = name;
    this.data = data;
    this.priority = options.priority || 0;
    this.delay = options.delay || 0;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.retries || 3;
    this.backoff = options.backoff || 'exponential';
    this.retryCount = 0;
    this.status = 'waiting';
    this.createdAt = Date.now();
    this.startedAt = null;
    this.finishedAt = null;
    this.result = null;
    this.error = null;
    this.progress = 0;
    this._resolve = null;
    this._reject = null;
    this._progressCbs = [];
  }

  wait() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  onProgress(fn) { this._progressCbs.push(fn); return this; }
  _setProgress(pct) {
    this.progress = pct;
    for (const fn of this._progressCbs) try { fn(pct, this); } catch {}
  }

  toJSON() {
    return {
      id: this.id, name: this.name, status: this.status,
      priority: this.priority, retryCount: this.retryCount,
      createdAt: this.createdAt, startedAt: this.startedAt,
      finishedAt: this.finishedAt, progress: this.progress,
      result: this.result, error: this.error
    };
  }
}

class Queue extends EventEmitter {
  constructor(name, options) {
    super();
    options = options || {};
    this.name = name || 'default';
    this._concurrency = options.concurrency || 1;
    this._workers = {};
    this._jobs = [];
    this._active = new Map();
    this._processed = [];
    this._paused = false;
    this._running = 0;
    this._maxProcessed = options.maxProcessed || 1000;
    this._stats = { completed: 0, failed: 0, retried: 0 };
  }

  process(nameOrHandler, handler) {
    if (typeof nameOrHandler === 'function') {
      this._workers['*'] = nameOrHandler;
    } else {
      this._workers[nameOrHandler] = handler;
    }
    return this;
  }

  add(name, data, options) {
    const job = new Job(name, data, options);
    if (job.delay > 0) {
      setTimeout(() => this._enqueue(job), job.delay);
    } else {
      this._enqueue(job);
    }
    return job;
  }

  _enqueue(job) {
    // Insert by priority (higher priority first)
    let idx = this._jobs.findIndex(j => j.priority < job.priority);
    if (idx === -1) idx = this._jobs.length;
    this._jobs.splice(idx, 0, job);
    this.emit('added', job);
    this._tick();
  }

  _tick() {
    if (this._paused) return;
    while (this._running < this._concurrency && this._jobs.length > 0) {
      const job = this._jobs.shift();
      this._run(job);
    }
  }

  async _run(job) {
    const handler = this._workers[job.name] || this._workers['*'];
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler for job "${job.name}"`;
      if (job._reject) job._reject(new Error(job.error));
      this.emit('failed', job, new Error(job.error));
      return;
    }

    this._running++;
    this._active.set(job.id, job);
    job.status = 'active';
    job.startedAt = Date.now();
    this.emit('active', job);

    let timer;
    try {
      const ctx = {
        job,
        progress: (pct) => job._setProgress(pct),
        log: (...args) => this.emit('log', job, ...args)
      };

      const resultPromise = handler(job.data, ctx);
      const timeoutPromise = new Promise((_, reject) =>
        timer = setTimeout(() => reject(new Error(`Job ${job.id} timed out after ${job.timeout}ms`)), job.timeout)
      );

      job.result = await Promise.race([resultPromise, timeoutPromise]);
      clearTimeout(timer);
      job.status = 'completed';
      job.finishedAt = Date.now();
      job.progress = 100;
      this._stats.completed++;
      if (job._resolve) job._resolve(job.result);
      this.emit('completed', job, job.result);

    } catch (err) {
      clearTimeout(timer);
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = 'waiting';
        this._stats.retried++;
        const delay = this._calcDelay(job);
        this.emit('retry', job, err);
        setTimeout(() => this._enqueue(job), delay);
      } else {
        job.status = 'failed';
        job.finishedAt = Date.now();
        job.error = err.message;
        this._stats.failed++;
        if (job._reject) job._reject(err);
        this.emit('failed', job, err);
      }
    } finally {
      this._running--;
      this._active.delete(job.id);
      this._processed.push(job);
      if (this._processed.length > this._maxProcessed) this._processed.shift();
      this._tick();
      if (this._running === 0 && this._jobs.length === 0) this.emit('drained');
    }
  }

  _calcDelay(job) {
    if (job.backoff === 'fixed') return 1000;
    if (job.backoff === 'linear') return job.retryCount * 1000;
    return Math.min(Math.pow(2, job.retryCount) * 1000, 30000); // exponential, max 30s
  }

  pause()   { this._paused = true; return this; }
  resume()  { this._paused = false; this._tick(); return this; }
  drain()   { return new Promise(resolve => { if (this._jobs.length === 0 && this._running === 0) return resolve(); this.once('drained', resolve); }); }

  getJob(id) { return this._active.get(id) || this._processed.find(j => j.id === id) || null; }
  size()     { return this._jobs.length; }
  pending()  { return this._jobs.length; }
  active()   { return this._running; }
  stats()    { return Object.assign({}, this._stats, { pending: this.pending(), active: this.active() }); }
  clear()    { this._jobs.length = 0; return this; }

  setConcurrency(n) { this._concurrency = n; this._tick(); return this; }
}

class QueueManager {
  constructor() { this._queues = new Map(); }

  create(name, options) {
    if (this._queues.has(name)) return this._queues.get(name);
    const q = new Queue(name, options);
    this._queues.set(name, q);
    return q;
  }

  get(name) { return this._queues.get(name) || null; }
  all()      { return [...this._queues.values()]; }

  stats() {
    const result = {};
    for (const [name, q] of this._queues) result[name] = q.stats();
    return result;
  }
}

const manager = new QueueManager();

module.exports = { Queue, Job, QueueManager, manager, create: (n,o) => manager.create(n,o), get: (n) => manager.get(n) };
