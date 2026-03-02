'use strict';

const TIER_INTERPRET  = 0;
const TIER_BASELINE   = 1;
const TIER_OPTIMIZING = 2;
const TIER_NATIVE     = 3;

const TIER_THRESHOLDS = [0, 10, 100, 1000];
const TIER_NAMES      = ['interpret', 'baseline', 'optimizing', 'native'];

class FunctionProfile {
  constructor(name) {
    this.name       = name;
    this.executions = 0;
    this.totalTime  = 0;
    this.tier       = TIER_INTERPRET;
    this.types      = new Map();
    this.compiled   = null;
    this.lastUpgrade = 0;
  }

  record(duration, argTypes) {
    this.executions++;
    this.totalTime += duration;
    if (argTypes) {
      for (const [k, t] of Object.entries(argTypes)) {
        if (!this.types.has(k)) this.types.set(k, new Map());
        const m = this.types.get(k);
        m.set(t, (m.get(t) || 0) + 1);
      }
    }
  }

  shouldUpgrade() {
    if (this.tier >= TIER_NATIVE) return false;
    return this.executions >= TIER_THRESHOLDS[this.tier + 1];
  }

  upgrade() {
    if (this.tier < TIER_NATIVE) {
      this.tier++;
      this.lastUpgrade = this.executions;
    }
    return this.tier;
  }

  avgTime()    { return this.executions ? this.totalTime / this.executions : 0; }
  tierName()   { return TIER_NAMES[this.tier]; }

  dominantTypes() {
    const result = {};
    for (const [param, counts] of this.types) {
      let max = 0, best = 'unknown';
      for (const [type, count] of counts) {
        if (count > max) { max = count; best = type; }
      }
      result[param] = best;
    }
    return result;
  }

  toJSON() {
    return {
      name: this.name, executions: this.executions,
      totalMs: this.totalTime.toFixed(2), avgMs: this.avgTime().toFixed(3),
      tier: this.tier, tierName: this.tierName(),
      dominantTypes: this.dominantTypes()
    };
  }
}

class HotPathDetector {
  constructor() {
    this.profiles  = new Map();
    this.hotPaths  = new Set();
    this.callbacks = new Map();
  }

  getProfile(name) {
    if (!this.profiles.has(name)) this.profiles.set(name, new FunctionProfile(name));
    return this.profiles.get(name);
  }

  record(fnName, duration, argTypes) {
    const profile = this.getProfile(fnName);
    profile.record(duration, argTypes);

    if (profile.shouldUpgrade()) {
      const newTier = profile.upgrade();
      this.hotPaths.add(fnName);
      const cb = this.callbacks.get(fnName);
      if (cb) cb(profile, newTier);
      this._emitUpgrade(fnName, newTier, profile);
    }
  }

  _emitUpgrade(name, tier, profile) {
    const tierCb = this.callbacks.get('__tier_' + tier);
    if (tierCb) tierCb(name, tier, profile);
  }

  onUpgrade(fnNameOrTier, callback) {
    if (typeof fnNameOrTier === 'number') {
      this.callbacks.set('__tier_' + fnNameOrTier, callback);
    } else {
      this.callbacks.set(fnNameOrTier, callback);
    }
  }

  isHot(name) {
    const p = this.profiles.get(name);
    return p && p.tier >= TIER_BASELINE;
  }

  isSuperHot(name) {
    const p = this.profiles.get(name);
    return p && p.tier >= TIER_OPTIMIZING;
  }

  isNative(name) {
    const p = this.profiles.get(name);
    return p && p.tier >= TIER_NATIVE;
  }

  getHotPaths() {
    return [...this.hotPaths].map(name => this.profiles.get(name));
  }

  getTopFunctions(n) {
    return [...this.profiles.values()]
      .sort((a, b) => b.executions - a.executions)
      .slice(0, n || 10);
  }

  report() {
    const profiles = [...this.profiles.values()].sort((a, b) => b.executions - a.executions);
    const lines = [
      '',
      '  ⚡ JIT Hot Path Report',
      '  ' + '─'.repeat(60),
      '  ' + ['Function', 'Calls', 'Avg ms', 'Tier'].map(s => s.padEnd(20)).join(''),
      '  ' + '─'.repeat(60),
    ];
    for (const p of profiles.slice(0, 20)) {
      const tier = ['interpret', 'baseline', 'optimize', 'native'][p.tier];
      const tierIcon = ['🔵', '🟡', '🟠', '🔴'][p.tier];
      lines.push('  ' + [
        p.name.slice(0, 18).padEnd(20),
        String(p.executions).padEnd(20),
        p.avgTime().toFixed(3).padEnd(20),
        tierIcon + ' ' + tier
      ].join(''));
    }
    lines.push('  ' + '─'.repeat(60));
    lines.push('  Total tracked functions: ' + this.profiles.size);
    lines.push('  Hot paths (compiled):    ' + this.hotPaths.size);
    lines.push('');
    return lines.join('\n');
  }

  instrument(fnName, fn) {
    const detector = this;
    return function(...args) {
      const argTypes = {};
      for (let i = 0; i < args.length; i++) {
        argTypes['arg' + i] = Array.isArray(args[i]) ? 'array' : typeof args[i];
      }
      const t0 = performance.now ? performance.now() : Date.now();
      const result = fn.apply(this, args);
      const dt = (performance.now ? performance.now() : Date.now()) - t0;
      detector.record(fnName, dt, argTypes);
      return result;
    };
  }

  instrumentAsync(fnName, fn) {
    const detector = this;
    return async function(...args) {
      const argTypes = {};
      for (let i = 0; i < args.length; i++) {
        argTypes['arg' + i] = Array.isArray(args[i]) ? 'array' : typeof args[i];
      }
      const t0 = performance.now ? performance.now() : Date.now();
      const result = await fn.apply(this, args);
      const dt = (performance.now ? performance.now() : Date.now()) - t0;
      detector.record(fnName, dt, argTypes);
      return result;
    };
  }

  reset() {
    this.profiles.clear();
    this.hotPaths.clear();
  }
}

module.exports = { HotPathDetector, FunctionProfile, TIER_INTERPRET, TIER_BASELINE, TIER_OPTIMIZING, TIER_NATIVE, TIER_NAMES };
