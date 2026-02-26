'use strict';
class Vec2 {
  constructor(x, y) { this.x = x || 0; this.y = y || 0; }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vec2(this.x * s, this.y * s); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() { const l = this.length() || 1; return new Vec2(this.x / l, this.y / l); }
  distance(v) { return this.sub(v).length(); }
  angle() { return Math.atan2(this.y, this.x); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c); }
  lerp(v, t) { return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
  clone() { return new Vec2(this.x, this.y); }
  equals(v) { return Math.abs(this.x - v.x) < 1e-6 && Math.abs(this.y - v.y) < 1e-6; }
  toString() { return `Vec2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`; }
  toArray() { return [this.x, this.y]; }
  static fromAngle(a, len) { len = len || 1; return new Vec2(Math.cos(a) * len, Math.sin(a) * len); }
  static zero() { return new Vec2(0, 0); }
  static one() { return new Vec2(1, 1); }
  static up() { return new Vec2(0, -1); }
  static down() { return new Vec2(0, 1); }
  static left() { return new Vec2(-1, 0); }
  static right() { return new Vec2(1, 0); }
}
class Vec3 {
  constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  scale(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  normalize() { const l = this.length() || 1; return new Vec3(this.x / l, this.y / l, this.z / l); }
  distance(v) { return this.sub(v).length(); }
  lerp(v, t) { return new Vec3(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.z + (v.z - this.z) * t); }
  clone() { return new Vec3(this.x, this.y, this.z); }
  toString() { return `Vec3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`; }
  toArray() { return [this.x, this.y, this.z]; }
  static zero() { return new Vec3(0, 0, 0); }
  static one() { return new Vec3(1, 1, 1); }
  static up() { return new Vec3(0, 1, 0); }
  static forward() { return new Vec3(0, 0, -1); }
  static right() { return new Vec3(1, 0, 0); }
}
class Rect {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
  get left()   { return this.x; }
  get right()  { return this.x + this.w; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.h; }
  get center() { return new Vec2(this.x + this.w / 2, this.y + this.h / 2); }
  contains(v) { return v.x >= this.x && v.x <= this.right && v.y >= this.y && v.y <= this.bottom; }
  intersects(r) { return this.x < r.right && this.right > r.x && this.y < r.bottom && this.bottom > r.y; }
  intersection(r) {
    const x = Math.max(this.x, r.x), y = Math.max(this.y, r.y);
    const w = Math.min(this.right, r.right) - x, h = Math.min(this.bottom, r.bottom) - y;
    if (w <= 0 || h <= 0) return null;
    return new Rect(x, y, w, h);
  }
  expand(dx, dy) { return new Rect(this.x - dx, this.y - (dy === undefined ? dx : dy), this.w + dx * 2, this.h + (dy === undefined ? dx : dy) * 2); }
  translate(v) { return new Rect(this.x + v.x, this.y + v.y, this.w, this.h); }
  clone() { return new Rect(this.x, this.y, this.w, this.h); }
  toString() { return `Rect(${this.x}, ${this.y}, ${this.w}, ${this.h})`; }
}
class Circle {
  constructor(x, y, r) { this.x = x; this.y = y; this.r = r; }
  get center() { return new Vec2(this.x, this.y); }
  contains(v) { return this.center.distance(v) <= this.r; }
  intersects(other) {
    if (other instanceof Circle) return this.center.distance(other.center) <= this.r + other.r;
    if (other instanceof Rect) {
      const cx = Math.max(other.x, Math.min(this.x, other.right));
      const cy = Math.max(other.y, Math.min(this.y, other.bottom));
      return new Vec2(cx, cy).distance(this.center) <= this.r;
    }
    return false;
  }
  area() { return Math.PI * this.r * this.r; }
}
class Transform {
  constructor() { this.position = Vec2.zero(); this.rotation = 0; this.scale = Vec2.one(); }
  translate(v) { this.position = this.position.add(v); return this; }
  rotate(a) { this.rotation += a; return this; }
  setScale(x, y) { this.scale = new Vec2(x, y === undefined ? x : y); return this; }
  toMatrix() {
    const c = Math.cos(this.rotation), s = Math.sin(this.rotation);
    return [this.scale.x * c, this.scale.x * s, 0, -this.scale.y * s, this.scale.y * c, 0, this.position.x, this.position.y, 1];
  }
}
class Color {
  constructor(r, g, b, a) { this.r = r; this.g = g; this.b = b; this.a = a === undefined ? 1 : a; }
  toHex() { return '#' + [this.r, this.g, this.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
  toRgba() { return `rgba(${Math.round(this.r * 255)},${Math.round(this.g * 255)},${Math.round(this.b * 255)},${this.a})`; }
  lerp(c, t) { return new Color(this.r + (c.r - this.r) * t, this.g + (c.g - this.g) * t, this.b + (c.b - this.b) * t, this.a + (c.a - this.a) * t); }
  withAlpha(a) { return new Color(this.r, this.g, this.b, a); }
  toString() { return this.toRgba(); }
  static fromHex(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return new Color(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  }
  static fromRgb(r, g, b, a) { return new Color(r / 255, g / 255, b / 255, a); }
  static white()   { return new Color(1, 1, 1); }
  static black()   { return new Color(0, 0, 0); }
  static red()     { return new Color(1, 0, 0); }
  static green()   { return new Color(0, 1, 0); }
  static blue()    { return new Color(0, 0, 1); }
  static yellow()  { return new Color(1, 1, 0); }
  static cyan()    { return new Color(0, 1, 1); }
  static magenta() { return new Color(1, 0, 1); }
  static transparent() { return new Color(0, 0, 0, 0); }
}
class Camera2D {
  constructor(x, y, zoom) { this.position = new Vec2(x || 0, y || 0); this.zoom = zoom || 1; this.rotation = 0; }
  worldToScreen(v, screenW, screenH) {
    const rel = v.sub(this.position);
    const rotated = rel.rotate(-this.rotation);
    return new Vec2(screenW / 2 + rotated.x * this.zoom, screenH / 2 + rotated.y * this.zoom);
  }
  screenToWorld(v, screenW, screenH) {
    const centered = new Vec2((v.x - screenW / 2) / this.zoom, (v.y - screenH / 2) / this.zoom);
    return centered.rotate(this.rotation).add(this.position);
  }
  follow(target, speed, dt) {
    if (speed && dt) {
      const diff = target.sub(this.position);
      this.position = this.position.add(diff.scale(Math.min(1, speed * dt)));
    } else {
      this.position = target.clone();
    }
  }
}
class Timer {
  constructor() { this.start = Date.now(); this.elapsed = 0; this.running = false; }
  tick() { if (this.running) this.elapsed = Date.now() - this.start; return this.elapsed; }
  reset() { this.start = Date.now(); this.elapsed = 0; return this; }
  pause() { this.tick(); this.running = false; return this; }
  resume() { this.start = Date.now() - this.elapsed; this.running = true; return this; }
  get seconds() { return this.elapsed / 1000; }
  get minutes() { return this.elapsed / 60000; }
}
class GameLoop {
  constructor(options) {
    options = options || {};
    this.targetFps = options.fps || 60;
    this.fixedTimestep = options.fixedTimestep || 1 / 60;
    this._running = false;
    this._lastTime = 0;
    this._accumulator = 0;
    this.fps = 0;
    this._fpsCount = 0;
    this._fpsTime = 0;
    this.onUpdate = options.onUpdate || null;
    this.onFixedUpdate = options.onFixedUpdate || null;
    this.onRender = options.onRender || null;
  }
  start() {
    this._running = true;
    this._lastTime = Date.now();
    this._loop();
  }
  stop() { this._running = false; }
  _loop() {
    if (!this._running) return;
    const now = Date.now();
    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;
    this._accumulator += dt;
    if (this.onUpdate) this.onUpdate(dt);
    while (this._accumulator >= this.fixedTimestep) {
      if (this.onFixedUpdate) this.onFixedUpdate(this.fixedTimestep);
      this._accumulator -= this.fixedTimestep;
    }
    if (this.onRender) this.onRender(this._accumulator / this.fixedTimestep);
    this._fpsCount++;
    this._fpsTime += dt;
    if (this._fpsTime >= 1) { this.fps = this._fpsCount; this._fpsCount = 0; this._fpsTime = 0; }
    const delay = Math.max(0, 1000 / this.targetFps - (Date.now() - now));
    setTimeout(() => this._loop(), delay);
  }
}
class Input {
  constructor() {
    this._keys = {};
    this._prevKeys = {};
    this._mouse = { x: 0, y: 0, buttons: {} };
    this._prevMouse = { buttons: {} };
  }
  keyDown(key)     { return !!this._keys[key]; }
  keyUp(key)       { return !this._keys[key]; }
  keyPressed(key)  { return !!this._keys[key] && !this._prevKeys[key]; }
  keyReleased(key) { return !this._keys[key] && !!this._prevKeys[key]; }
  mouseDown(btn)     { return !!this._mouse.buttons[btn || 0]; }
  mousePressed(btn)  { return !!this._mouse.buttons[btn || 0] && !this._prevMouse.buttons[btn || 0]; }
  mouseReleased(btn) { return !this._mouse.buttons[btn || 0] && !!this._prevMouse.buttons[btn || 0]; }
  get mousePos() { return new Vec2(this._mouse.x, this._mouse.y); }
  update() {
    this._prevKeys = Object.assign({}, this._keys);
    this._prevMouse.buttons = Object.assign({}, this._mouse.buttons);
  }
  setKey(key, down) { this._keys[key] = down; }
  setMouse(x, y) { this._mouse.x = x; this._mouse.y = y; }
  setMouseButton(btn, down) { this._mouse.buttons[btn] = down; }
}
class EntityManager {
  constructor() { this._entities = new Map(); this._nextId = 1; this._components = new Map(); }
  create(components) {
    const id = this._nextId++;
    this._entities.set(id, { id, components: components || {} });
    for (const [type, comp] of Object.entries(components || {})) {
      if (!this._components.has(type)) this._components.set(type, new Set());
      this._components.get(type).add(id);
    }
    return id;
  }
  destroy(id) {
    const entity = this._entities.get(id);
    if (!entity) return;
    for (const type of Object.keys(entity.components)) {
      const set = this._components.get(type);
      if (set) set.delete(id);
    }
    this._entities.delete(id);
  }
  get(id) { return this._entities.get(id); }
  getComponent(id, type) { const e = this._entities.get(id); return e ? e.components[type] : null; }
  addComponent(id, type, comp) {
    const e = this._entities.get(id);
    if (!e) return;
    e.components[type] = comp;
    if (!this._components.has(type)) this._components.set(type, new Set());
    this._components.get(type).add(id);
  }
  removeComponent(id, type) {
    const e = this._entities.get(id);
    if (!e) return;
    delete e.components[type];
    const set = this._components.get(type);
    if (set) set.delete(id);
  }
  query(...types) {
    let smallest = null;
    for (const t of types) {
      const set = this._components.get(t);
      if (!set) return [];
      if (!smallest || set.size < smallest.size) smallest = set;
    }
    if (!smallest) return [];
    const result = [];
    for (const id of smallest) {
      const e = this._entities.get(id);
      if (e && types.every(t => t in e.components)) result.push(e);
    }
    return result;
  }
  count() { return this._entities.size; }
}
class EventBus {
  constructor() { this._listeners = {}; }
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }
  emit(event, data) {
    const fns = this._listeners[event];
    if (fns) fns.forEach(f => f(data));
  }
  once(event, fn) {
    const off = this.on(event, data => { fn(data); off(); });
    return off;
  }
  clear(event) { if (event) { delete this._listeners[event]; } else { this._listeners = {}; } }
}
class StateMachine {
  constructor(states, initial) {
    this._states = states || {};
    this._current = initial;
    this._prev = null;
    this._listeners = [];
    if (this._current && this._states[this._current] && this._states[this._current].enter) {
      this._states[this._current].enter(null);
    }
  }
  get current() { return this._current; }
  get previous() { return this._prev; }
  transition(next, data) {
    if (!(next in this._states)) throw new Error(`State '${next}' not found`);
    const prev = this._current;
    const prevState = this._states[prev];
    if (prevState && prevState.exit) prevState.exit(next, data);
    this._prev = prev;
    this._current = next;
    const nextState = this._states[next];
    if (nextState && nextState.enter) nextState.enter(prev, data);
    this._listeners.forEach(fn => fn({ from: prev, to: next, data }));
  }
  update(dt) {
    const state = this._states[this._current];
    if (state && state.update) state.update(dt);
  }
  can(next) { return next in this._states; }
  is(state) { return this._current === state; }
  onChange(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(f => f !== fn); }; }
}
const math = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  smoothstep: (a, b, t) => { t = math.clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
  inverseLerp: (a, b, v) => (v - a) / (b - a),
  remap: (v, inMin, inMax, outMin, outMax) => math.lerp(outMin, outMax, math.inverseLerp(inMin, inMax, v)),
  deg2rad: d => d * Math.PI / 180,
  rad2deg: r => r * 180 / Math.PI,
  sign: v => v > 0 ? 1 : v < 0 ? -1 : 0,
  rand: (min, max) => min + Math.random() * (max - min),
  randInt: (min, max) => Math.floor(math.rand(min, max + 1)),
  randItem: arr => arr[math.randInt(0, arr.length - 1)],
  shuffle: arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  snap: (v, step) => Math.round(v / step) * step,
  pingpong: (v, len) => { const m = v % (len * 2); return m > len ? len * 2 - m : m; },
  approach: (current, target, maxDelta) => {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + math.sign(target - current) * maxDelta;
  },
  isPow2: n => n > 0 && (n & (n - 1)) === 0,
  nextPow2: n => { let v = 1; while (v < n) v <<= 1; return v; }
};
module.exports = { Vec2, Vec3, Rect, Circle, Transform, Color, Camera2D, Timer, GameLoop, Input, EntityManager, EventBus, StateMachine, math };
