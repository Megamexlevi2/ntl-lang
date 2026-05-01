'use strict';

// ntl:test — built-in test runner with describe/test/expect
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const { EventEmitter } = require('./events');

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY   = '\x1b[90m';
const BOLD   = '\x1b[1m';
const CYAN   = '\x1b[36m';

const runner = new EventEmitter();

const state = {
  suites:   [],
  current:  null,
  passed:   0,
  failed:   0,
  skipped:  0,
  start:    0,
  hooks:    { before: [], after: [], beforeEach: [], afterEach: [] },
};

function pushSuite(name, fn) {
  const suite = { name, tests: [], hooks: { before: [], after: [], beforeEach: [], afterEach: [] }, parent: state.current };
  const prev  = state.current;
  state.current = suite;
  fn();
  state.current = prev;
  if (state.current) state.current.tests.push({ suite: true, ref: suite });
  else state.suites.push(suite);
}

function pushTest(name, fn, opts) {
  const t = { name, fn, opts: opts || {}, status: 'pending', error: null, duration: 0 };
  const target = state.current || { tests: state.suites };
  if (!Array.isArray(target.tests)) target.tests = [];
  target.tests.push(t);
}

function describe(name, fn)           { pushSuite(name, fn); }
function it(name, fn)                 { pushTest(name, fn); }
function test(name, fn)               { pushTest(name, fn); }
function it_skip(name, fn)            { pushTest(name, fn, { skip: true }); }
function it_only(name, fn)            { pushTest(name, fn, { only: true }); }
describe.skip = (name, fn) => { describe(name, () => {}); };
describe.only = describe;
test.skip = it_skip;
test.only = it_only;
it.skip   = it_skip;
it.only   = it_only;

function beforeAll(fn)  { (state.current?.hooks || state.hooks).before.push(fn); }
function afterAll(fn)   { (state.current?.hooks || state.hooks).after.push(fn); }
function beforeEach(fn) { (state.current?.hooks || state.hooks).beforeEach.push(fn); }
function afterEach(fn)  { (state.current?.hooks || state.hooks).afterEach.push(fn); }

// ─── Matchers ─────────────────────────────────────────────────────────────────

class AssertionError extends Error {
  constructor(msg) { super(msg); this.name = 'AssertionError'; }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => deepEqual(a[k], b[k]));
}

function diff(expected, actual) {
  const e = JSON.stringify(expected, null, 2);
  const a = JSON.stringify(actual,   null, 2);
  return `\n${RED}  - expected: ${e}${RESET}\n${GREEN}  + received: ${a}${RESET}`;
}

function expect(received) {
  const matchers = {
    toBe(expected) {
      if (!Object.is(received, expected)) throw new AssertionError(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(received)}`);
    },
    toEqual(expected) {
      if (!deepEqual(received, expected)) throw new AssertionError(`Expected deep equal:${diff(expected, received)}`);
    },
    toStrictEqual(expected) { matchers.toEqual(expected); },
    toBeDefined()  { if (received === undefined) throw new AssertionError('Expected value to be defined'); },
    toBeUndefined(){ if (received !== undefined) throw new AssertionError(`Expected undefined, got ${JSON.stringify(received)}`); },
    toBeNull()     { if (received !== null)      throw new AssertionError(`Expected null, got ${JSON.stringify(received)}`); },
    toBeNotNull()  { if (received === null)      throw new AssertionError('Expected non-null value'); },
    toBeTruthy()   { if (!received)              throw new AssertionError(`Expected truthy, got ${JSON.stringify(received)}`); },
    toBeFalsy()    { if (received)               throw new AssertionError(`Expected falsy, got ${JSON.stringify(received)}`); },
    toBeNaN()      { if (!isNaN(received))       throw new AssertionError(`Expected NaN, got ${received}`); },
    toBeGreaterThan(n)          { if (!(received > n))  throw new AssertionError(`Expected ${received} > ${n}`); },
    toBeGreaterThanOrEqual(n)   { if (!(received >= n)) throw new AssertionError(`Expected ${received} >= ${n}`); },
    toBeLessThan(n)             { if (!(received < n))  throw new AssertionError(`Expected ${received} < ${n}`); },
    toBeLessThanOrEqual(n)      { if (!(received <= n)) throw new AssertionError(`Expected ${received} <= ${n}`); },
    toBeCloseTo(expected, digits) {
      const d = Math.pow(10, -(digits ?? 2)) / 2;
      if (Math.abs(received - expected) >= d) throw new AssertionError(`Expected ${received} ≈ ${expected} (±${d})`);
    },
    toContain(item) {
      if (Array.isArray(received)) { if (!received.includes(item)) throw new AssertionError(`Expected array to contain ${JSON.stringify(item)}`); }
      else if (typeof received === 'string') { if (!received.includes(item)) throw new AssertionError(`Expected "${received}" to contain "${item}"`); }
      else throw new AssertionError('toContain requires a string or array');
    },
    toContainEqual(item) {
      if (!Array.isArray(received)) throw new AssertionError('toContainEqual requires an array');
      if (!received.some(x => deepEqual(x, item))) throw new AssertionError(`Expected array to contain ${JSON.stringify(item)}`);
    },
    toHaveLength(n) {
      if (received?.length !== n) throw new AssertionError(`Expected length ${n}, got ${received?.length}`);
    },
    toHaveProperty(keyPath, value) {
      const parts = String(keyPath).split('.');
      let cur = received;
      for (const part of parts) { cur = cur?.[part]; }
      if (value !== undefined) { if (!deepEqual(cur, value)) throw new AssertionError(`Expected property "${keyPath}" to equal ${JSON.stringify(value)}`); }
      else if (cur === undefined) throw new AssertionError(`Expected property "${keyPath}" to exist`);
    },
    toMatch(pattern) {
      if (typeof pattern === 'string') { if (!String(received).includes(pattern)) throw new AssertionError(`Expected "${received}" to include "${pattern}"`); }
      else if (pattern instanceof RegExp) { if (!pattern.test(String(received))) throw new AssertionError(`Expected "${received}" to match ${pattern}`); }
      else throw new AssertionError('toMatch requires a string or RegExp');
    },
    toMatchObject(obj) {
      if (typeof received !== 'object') throw new AssertionError('toMatchObject requires an object');
      for (const [k, v] of Object.entries(obj)) {
        if (!deepEqual(received[k], v)) throw new AssertionError(`Expected "${k}" to equal ${JSON.stringify(v)}, got ${JSON.stringify(received[k])}`);
      }
    },
    toThrow(expected) {
      if (typeof received !== 'function') throw new AssertionError('toThrow requires a function');
      let thrown = false, err = null;
      try { received(); } catch(e) { thrown = true; err = e; }
      if (!thrown) throw new AssertionError('Expected function to throw');
      if (expected) {
        if (typeof expected === 'string' && !err.message.includes(expected)) throw new AssertionError(`Expected error message to include "${expected}", got "${err.message}"`);
        if (expected instanceof RegExp && !expected.test(err.message)) throw new AssertionError(`Expected error to match ${expected}`);
        if (typeof expected === 'function' && !(err instanceof expected)) throw new AssertionError(`Expected error to be instance of ${expected.name}`);
      }
    },
    toThrowAsync: async (expected) => {
      if (typeof received !== 'function') throw new AssertionError('toThrowAsync requires a function');
      let thrown = false, err = null;
      try { await received(); } catch(e) { thrown = true; err = e; }
      if (!thrown) throw new AssertionError('Expected async function to throw');
      if (expected && typeof expected === 'string' && !err.message.includes(expected)) throw new AssertionError(`Expected error message to include "${expected}"`);
    },
    toBeInstanceOf(cls) {
      if (!(received instanceof cls)) throw new AssertionError(`Expected instance of ${cls.name}`);
    },
    toBeTypeOf(type) {
      if (typeof received !== type) throw new AssertionError(`Expected typeof "${type}", got "${typeof received}"`);
    },
    toBeArray()  { if (!Array.isArray(received)) throw new AssertionError('Expected an array'); },
    toBeObject() { if (typeof received !== 'object' || received === null || Array.isArray(received)) throw new AssertionError('Expected a plain object'); },
    not: null,
  };

  matchers.not = new Proxy(matchers, {
    get(target, prop) {
      if (prop === 'not') return target;
      const fn = target[prop];
      if (typeof fn !== 'function') return fn;
      return (...args) => {
        let threw = false;
        try { fn(...args); } catch(_) { threw = true; }
        if (!threw) throw new AssertionError(`Expected not ${prop}`);
      };
    },
  });

  return matchers;
}

// ─── Mock / spy ───────────────────────────────────────────────────────────────

function mockFn(impl) {
  const calls = [];
  const mock = function(...args) {
    calls.push({ args, thisArg: this });
    if (mock._impl) return mock._impl.apply(this, args);
    if (mock._returnValues.length) return mock._returnValues.shift();
    return mock._defaultReturn;
  };
  mock._impl          = impl || null;
  mock._returnValues  = [];
  mock._defaultReturn = undefined;
  mock.mock           = { calls, results: [], instances: [] };
  mock.mockReturnValue = (v) => { mock._defaultReturn = v; return mock; };
  mock.mockReturnValueOnce = (v) => { mock._returnValues.push(v); return mock; };
  mock.mockImplementation  = (fn) => { mock._impl = fn; return mock; };
  mock.mockResolvedValue   = (v) => { mock._impl = () => Promise.resolve(v); return mock; };
  mock.mockRejectedValue   = (e) => { mock._impl = () => Promise.reject(e); return mock; };
  mock.mockClear = () => { calls.length = 0; return mock; };
  mock.mockReset = () => { mock.mockClear(); mock._impl = null; mock._returnValues = []; return mock; };
  mock.calls       = calls;
  mock.lastCall    = () => calls[calls.length - 1];
  mock.callCount   = () => calls.length;
  mock.calledWith  = (...args) => calls.some(c => deepEqual(c.args, args));
  return mock;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runHooks(hooks) {
  for (const h of hooks) await h();
}

async function runSuite(suite, depth) {
  const prefix = '  '.repeat(depth);
  process.stdout.write(`\n${prefix}${BOLD}${suite.name}${RESET}\n`);

  await runHooks(suite.hooks.before);

  for (const item of suite.tests) {
    if (item.suite) {
      await runSuite(item.ref, depth + 1);
      continue;
    }

    const t = item;
    if (t.opts.skip) {
      state.skipped++;
      process.stdout.write(`${prefix}  ${YELLOW}⊖${RESET} ${GRAY}${t.name} (skipped)${RESET}\n`);
      continue;
    }

    await runHooks(suite.hooks.beforeEach);
    const start = Date.now();

    try {
      const result = t.fn();
      if (result && typeof result.then === 'function') await result;
      t.status   = 'passed';
      t.duration = Date.now() - start;
      state.passed++;
      process.stdout.write(`${prefix}  ${GREEN}✓${RESET} ${GRAY}${t.name}${RESET} ${GRAY}(${t.duration}ms)${RESET}\n`);
    } catch(e) {
      t.status   = 'failed';
      t.error    = e;
      t.duration = Date.now() - start;
      state.failed++;
      process.stdout.write(`${prefix}  ${RED}✗${RESET} ${t.name}\n`);
      process.stdout.write(`${prefix}    ${RED}${e.message}${RESET}\n`);
      if (e.stack && e.name !== 'AssertionError') {
        process.stdout.write(GRAY + e.stack.split('\n').slice(1).map(l => prefix + '    ' + l).join('\n') + RESET + '\n');
      }
    }

    await runHooks(suite.hooks.afterEach);
  }

  await runHooks(suite.hooks.after);
}

async function run(opts) {
  opts = opts || {};
  state.start = Date.now();
  const filter = opts.filter || null;

  for (const suite of state.suites) {
    await runSuite(suite, 0);
  }

  const total    = state.passed + state.failed + state.skipped;
  const duration = Date.now() - state.start;

  process.stdout.write('\n');
  process.stdout.write(`${BOLD}Results${RESET}: `);
  if (state.passed)  process.stdout.write(`${GREEN}${state.passed} passed${RESET}  `);
  if (state.failed)  process.stdout.write(`${RED}${state.failed} failed${RESET}  `);
  if (state.skipped) process.stdout.write(`${YELLOW}${state.skipped} skipped${RESET}  `);
  process.stdout.write(`${GRAY}(${total} total, ${duration}ms)${RESET}\n\n`);

  if (opts.exit !== false && state.failed > 0) process.exit(1);
  return { passed: state.passed, failed: state.failed, skipped: state.skipped, total, duration };
}

process.nextTick(() => {
  if (state.suites.length) run({ exit: true });
});

module.exports = { describe, it, test, expect, mockFn, beforeAll, afterAll, beforeEach, afterEach, run, AssertionError };
