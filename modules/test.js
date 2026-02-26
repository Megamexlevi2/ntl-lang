'use strict';
const colors = {
  green:  s => process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  red:    s => process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  yellow: s => process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  cyan:   s => process.stdout.isTTY ? `\x1b[36m${s}\x1b[0m` : s,
  gray:   s => process.stdout.isTTY ? `\x1b[90m${s}\x1b[0m` : s,
  bold:   s => process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s
};
class AssertError extends Error {
  constructor(message, expected, actual) {
    super(message);
    this.name       = 'AssertError';
    this.expected   = expected;
    this.actual     = actual;
  }
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every(k => deepEqual(a[k], b[k]));
}
const assert = {
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertError(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        expected, actual
      );
    }
  },
  notEqual(actual, expected, message) {
    if (actual === expected) {
      throw new AssertError(
        message || `Expected values to differ, but both are ${JSON.stringify(actual)}`,
        `not ${JSON.stringify(expected)}`, actual
      );
    }
  },
  deepEqual(actual, expected, message) {
    if (!deepEqual(actual, expected)) {
      throw new AssertError(
        message || `Deep equality failed:\n  Expected: ${JSON.stringify(expected, null, 2)}\n  Actual:   ${JSON.stringify(actual, null, 2)}`,
        expected, actual
      );
    }
  },
  ok(value, message) {
    if (!value) throw new AssertError(message || `Expected truthy, got ${JSON.stringify(value)}`, true, value);
  },
  notOk(value, message) {
    if (value) throw new AssertError(message || `Expected falsy, got ${JSON.stringify(value)}`, false, value);
  },
  throws(fn, message) {
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) throw new AssertError(message || 'Expected function to throw', 'throw', 'no throw');
  },
  async asyncThrows(fn, message) {
    let threw = false;
    try { await fn(); } catch { threw = true; }
    if (!threw) throw new AssertError(message || 'Expected async function to throw', 'throw', 'no throw');
  },
  match(str, pattern, message) {
    if (!pattern.test(str)) {
      throw new AssertError(message || `String "${str}" does not match ${pattern}`, pattern.toString(), str);
    }
  },
  includes(arr, item, message) {
    if (!arr.includes(item)) {
      throw new AssertError(message || `Expected array to include ${JSON.stringify(item)}`, item, arr);
    }
  },
  type(value, expectedType, message) {
    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (actual !== expectedType) {
      throw new AssertError(message || `Expected type '${expectedType}', got '${actual}'`, expectedType, actual);
    }
  },
  closeTo(actual, expected, delta, message) {
    delta = delta || 0.0001;
    if (Math.abs(actual - expected) > delta) {
      throw new AssertError(message || `${actual} is not close to ${expected} (delta: ${delta})`, expected, actual);
    }
  }
};
class Suite {
  constructor(name) {
    this.name   = name;
    this._tests = [];
    this._hooks = { before: [], after: [], beforeEach: [], afterEach: [] };
  }
  before(fn)     { this._hooks.before.push(fn); }
  after(fn)      { this._hooks.after.push(fn); }
  beforeEach(fn) { this._hooks.beforeEach.push(fn); }
  afterEach(fn)  { this._hooks.afterEach.push(fn); }
  test(name, fn) {
    this._tests.push({ name, fn, only: false, skip: false });
  }
  only(name, fn) {
    this._tests.push({ name, fn, only: true, skip: false });
  }
  skip(name, fn) {
    this._tests.push({ name, fn, only: false, skip: true });
  }
  async run(options) {
    options = options || {};
    const results = { passed: 0, failed: 0, skipped: 0, tests: [] };
    const hasOnly = this._tests.some(t => t.only);
    console.log('\n' + colors.cyan(colors.bold(`  Suite: ${this.name}`)));
    for (const hook of this._hooks.before) await hook();
    for (const test of this._tests) {
      if (test.skip || (hasOnly && !test.only)) {
        console.log(`    ${colors.yellow('○')} ${colors.gray(test.name)} ${colors.yellow('[skipped]')}`);
        results.skipped++;
        results.tests.push({ name: test.name, status: 'skipped' });
        continue;
      }
      for (const hook of this._hooks.beforeEach) await hook();
      const start = Date.now();
      try {
        await test.fn(assert);
        const ms = Date.now() - start;
        console.log(`    ${colors.green('✓')} ${test.name} ${colors.gray(`(${ms}ms)`)}`);
        results.passed++;
        results.tests.push({ name: test.name, status: 'passed', ms });
      } catch (err) {
        const ms = Date.now() - start;
        console.log(`    ${colors.red('✗')} ${test.name} ${colors.gray(`(${ms}ms)`)}`);
        console.log(`      ${colors.red(err.message)}`);
        if (err.expected !== undefined && err.actual !== undefined) {
          console.log(`      ${colors.gray('Expected:')} ${colors.green(JSON.stringify(err.expected))}`);
          console.log(`      ${colors.gray('Actual:  ')} ${colors.red(JSON.stringify(err.actual))}`);
        }
        results.failed++;
        results.tests.push({ name: test.name, status: 'failed', error: err.message, ms });
      }
      for (const hook of this._hooks.afterEach) await hook();
    }
    for (const hook of this._hooks.after) await hook();
    return results;
  }
}
class TestRunner {
  constructor() {
    this._suites = [];
  }
  suite(name, fn) {
    const s = new Suite(name);
    fn(s);
    this._suites.push(s);
    return s;
  }
  test(name, fn) {
    const s = this._defaultSuite || (this._defaultSuite = new Suite('default'));
    if (!this._suites.includes(s)) this._suites.push(s);
    s.test(name, fn);
  }
  async run() {
    const start = Date.now();
    let total = { passed: 0, failed: 0, skipped: 0 };
    console.log(colors.bold('\n  NTL Test Runner'));
    console.log(colors.gray('  ' + '─'.repeat(40)));
    for (const suite of this._suites) {
      const result = await suite.run();
      total.passed  += result.passed;
      total.failed  += result.failed;
      total.skipped += result.skipped;
    }
    const elapsed = Date.now() - start;
    console.log(colors.gray('\n  ' + '─'.repeat(40)));
    console.log(`\n  Results: ${colors.green(total.passed + ' passed')}  ${total.failed > 0 ? colors.red(total.failed + ' failed') : colors.gray('0 failed')}  ${colors.yellow(total.skipped + ' skipped')}`);
    console.log(colors.gray(`  Time: ${elapsed}ms\n`));
    if (total.failed > 0) process.exitCode = 1;
    return total;
  }
}
const defaultRunner = new TestRunner();
function suite(name, fn) { return defaultRunner.suite(name, fn); }
function test(name, fn)  { return defaultRunner.test(name, fn); }
async function run()     { return defaultRunner.run(); }
module.exports = { TestRunner, Suite, assert, suite, test, run };
