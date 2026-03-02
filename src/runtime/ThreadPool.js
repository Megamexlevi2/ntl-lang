'use strict';

let workerThreads;
try { workerThreads = require('worker_threads'); } catch (e) { workerThreads = null; }

const WORKER_CODE = `
const { workerData, parentPort } = require('worker_threads');
const { Compiler } = require(workerData.__compilerPath);
const compiler = new Compiler();

parentPort.on('message', (msg) => {
  if (msg.type === 'compile') {
    const result = compiler.compileSource(msg.source, msg.filename, msg.opts);
    parentPort.postMessage({ id: msg.id, type: 'result', result });
  } else if (msg.type === 'eval') {
    try {
      const vm = require('vm');
      const ctx = { require, console, process, Buffer, Math, JSON, Date, Object, Array, String, Number };
      vm.createContext(ctx);
      const r = vm.runInContext(msg.code, ctx);
      parentPort.postMessage({ id: msg.id, type: 'result', result: { success: true, value: r } });
    } catch (e) {
      parentPort.postMessage({ id: msg.id, type: 'result', result: { success: false, error: e.message } });
    }
  }
});
`;

class WorkerHandle {
  constructor(workerData) {
    if (!workerThreads) throw new Error('worker_threads not available (requires Node.js >= 12)');
    const path = require('path');
    const os   = require('os');
    const fs   = require('fs');
    const tmpFile = path.join(os.tmpdir(), 'ntl_worker_' + Date.now() + '.js');
    fs.writeFileSync(tmpFile, WORKER_CODE);
    this.worker   = new workerThreads.Worker(tmpFile, { workerData });
    this.pending  = new Map();
    this._nextId  = 1;
    this.busy     = false;
    this.tmpFile  = tmpFile;

    this.worker.on('message', (msg) => {
      const resolve = this.pending.get(msg.id);
      if (resolve) { this.pending.delete(msg.id); resolve(msg.result); }
      this.busy = this.pending.size > 0;
    });
    this.worker.on('error', (err) => {
      for (const [, resolve] of this.pending) resolve({ success: false, error: err.message });
      this.pending.clear();
      this.busy = false;
    });
  }

  send(msg) {
    return new Promise((resolve) => {
      const id = this._nextId++;
      this.pending.set(id, resolve);
      this.busy = true;
      this.worker.postMessage(Object.assign({}, msg, { id }));
    });
  }

  async terminate() {
    try { require('fs').unlinkSync(this.tmpFile); } catch (_) {}
    return this.worker.terminate();
  }
}

class ThreadPool {
  constructor(opts) {
    this.opts = Object.assign({
      size: Math.max(2, (require('os').cpus() || []).length),
      compilerPath: require('path').resolve(__dirname, '../compiler.js'),
    }, opts || {});

    this.workers  = [];
    this.queue    = [];
    this._ready   = false;
    this._enabled = !!workerThreads;
  }

  async init() {
    if (!this._enabled) return this;
    const workerData = { __compilerPath: this.opts.compilerPath };
    for (let i = 0; i < this.opts.size; i++) {
      try {
        this.workers.push(new WorkerHandle(workerData));
      } catch (e) {
        this._enabled = false;
        break;
      }
    }
    this._ready = true;
    return this;
  }

  _getFreeWorker() {
    return this.workers.find(w => !w.busy) || this.workers[0];
  }

  async run(type, payload) {
    if (!this._enabled || !this._ready || !this.workers.length) {
      return { success: false, error: 'ThreadPool not initialized or workers unavailable' };
    }
    const worker = this._getFreeWorker();
    return worker.send(Object.assign({ type }, payload));
  }

  async compileParallel(sources) {
    if (!this._enabled) return null;
    return Promise.all(sources.map((s, i) =>
      this.run('compile', { source: s.source, filename: s.filename || `file${i}.ntl`, opts: s.opts || {} })
    ));
  }

  async mapParallel(items, fn) {
    const chunkSize = Math.ceil(items.length / Math.max(1, this.workers.length));
    const chunks    = [];
    for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));

    const results = await Promise.all(chunks.map(chunk =>
      this.run('eval', { code: `(${fn.toString()})(${JSON.stringify(chunk)})` })
    ));
    return results.flatMap(r => r.success ? r.value : []);
  }

  async destroy() {
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    this._ready  = false;
  }

  get size()    { return this.workers.length; }
  get enabled() { return this._enabled; }
}

class WorkStealingScheduler {
  constructor(pool) {
    this.pool   = pool;
    this.queues = pool ? pool.workers.map(() => []) : [];
  }

  schedule(task) {
    const minQ = this.queues.reduce((min, q, i) => q.length < this.queues[min].length ? i : min, 0);
    this.queues[minQ].push(task);
    return this.pool ? this.pool.workers[minQ].send(task) : Promise.resolve({ success: false });
  }

  steal(workerIdx) {
    const maxQ = this.queues.reduce((max, q, i) => q.length > this.queues[max].length ? i : max, 0);
    if (maxQ !== workerIdx && this.queues[maxQ].length > 1) {
      return this.queues[maxQ].pop();
    }
    return null;
  }
}

module.exports = { ThreadPool, WorkStealingScheduler, WorkerHandle };
