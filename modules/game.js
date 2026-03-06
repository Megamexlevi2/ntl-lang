'use strict';
const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

const GAME_DIR = path.join(__dirname, 'ntl', 'game');
const NTL_DIR  = path.join(__dirname, '..');

const _cache = new Map();

function compileNTL(name, ntlPath) {
  if (_cache.has(name)) return _cache.get(name);
  const source = fs.readFileSync(ntlPath, 'utf-8');
  const { Compiler } = require(path.join(NTL_DIR, 'src', 'compiler'));
  const compiler = new Compiler({ target: 'node', treeShake: false, strict: false, comments: false });
  const result   = compiler.compileSource(source, ntlPath, {});
  if (!result.success) {
    const msgs = result.errors.map(e => e.message).join('; ');
    throw new Error(`ntl:game compile error [${name}] — ${msgs}`);
  }
  const mod = { exports: {} };
  const ctx = vm.createContext({
    require, module: mod, exports: mod.exports,
    console, process, Buffer, Math, JSON, Date,
    setTimeout, setInterval, clearTimeout, clearInterval, setImmediate, clearImmediate,
    Promise, Object, Array, String, Number, Boolean, Error, TypeError,
    Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array,
    Map, Set, WeakMap, WeakSet, RegExp, Symbol, BigInt,
    URL, URLSearchParams,
  });
  const wrapped = `(function(module,exports,require){${result.code}})(module,exports,require);`;
  vm.runInContext(wrapped, ctx, { filename: `ntl:game/${name}` });
  _cache.set(name, mod.exports);
  return mod.exports;
}

const MODULE_MAP = [
  ['core/math3d',        'core'],
  ['core/color',         'core'],
  ['core/geometry',      'core'],
  ['rendering/renderer', 'rendering'],
  ['rendering/display',  'rendering'],
  ['scene/scene',        'scene'],
  ['scene/camera',       'scene'],
  ['physics/physics',    'physics'],
  ['input/input',        'input'],
  ['audio/audio',        'audio'],
  ['ui/ui',              'ui'],
  ['fx/tween',           'fx'],
  ['fx/particles',       'fx'],
  ['fx/animation',       'fx'],
  ['world/tilemap',      'world'],
  ['utils/raycast',      'utils'],
  ['utils/debug',        'utils'],
  ['engine/activity',    'engine'],
  ['engine/engine',      'engine'],
];

function loadEngine() {
  const api = {};
  for (const [rel] of MODULE_MAP) {
    const ntlPath = path.join(GAME_DIR, rel + '.ntl');
    if (!fs.existsSync(ntlPath)) continue;
    const name = rel.split('/')[1];
    Object.assign(api, compileNTL(name, ntlPath));
  }

  api._subsystems = {
    Renderer3D:       api.Renderer3D,
    createDisplay:    api.createDisplay,
    Scene:            api.Scene,
    Camera3D:         api.Camera3D,
    InputSystem:      api.InputSystem,
    AudioSystem:      api.AudioSystem,
    PhysicsWorld:     api.PhysicsWorld,
    UICanvas:         api.UICanvas,
    UIRenderer:       api.UIRenderer,
    TweenManager:     api.TweenManager,
    ParticleSystem:   api.ParticleSystem,
    Raycaster:        api.Raycaster,
    DebugDraw:        api.DebugDraw,
    Profiler:         api.Profiler,
    FPSController:    api.FPSController,
    OrbitController:  api.OrbitController,
    FollowController: api.FollowController,
    FlyController:    api.FlyController,
    CameraShake:      api.CameraShake,
  };

  if (api.GameEngine) {
    const Orig = api.GameEngine;
    class PatchedEngine extends Orig {
      _init(ActivityClass) {
        this._subsystems = api._subsystems;
        super._init(ActivityClass);
      }
    }
    api.GameEngine = PatchedEngine;
    api.run = function(ActivityClass, opts) {
      const engine = new PatchedEngine(opts || {});
      engine.start(ActivityClass);
      return engine;
    };
  }
  return api;
}

let _engine = null;
function getEngine() {
  if (!_engine) { _engine = loadEngine(); }
  return _engine;
}

// ── 2D legacy ─────────────────────────────────────────────────────────────────
class Vec2 {
  constructor(x, y) { this.x = x || 0; this.y = y || 0; }
  add(v) { return new Vec2(this.x+v.x, this.y+v.y); }
  sub(v) { return new Vec2(this.x-v.x, this.y-v.y); }
  scale(s) { return new Vec2(this.x*s, this.y*s); }
  dot(v) { return this.x*v.x + this.y*v.y; }
  length() { return Math.sqrt(this.x*this.x + this.y*this.y); }
  normalize() { const l=this.length()||1; return new Vec2(this.x/l, this.y/l); }
  distance(v) { return this.sub(v).length(); }
  clone() { return new Vec2(this.x, this.y); }
  lerp(v, t) { return new Vec2(this.x+(v.x-this.x)*t, this.y+(v.y-this.y)*t); }
  toString() { return `Vec2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`; }
  static zero()  { return new Vec2(0,0); }
  static one()   { return new Vec2(1,1); }
  static up()    { return new Vec2(0,-1); }
  static down()  { return new Vec2(0,1); }
  static left()  { return new Vec2(-1,0); }
  static right() { return new Vec2(1,0); }
  static fromAngle(a,l) { l=l||1; return new Vec2(Math.cos(a)*l, Math.sin(a)*l); }
}
class Rect {
  constructor(x,y,w,h) { this.x=x; this.y=y; this.w=w; this.h=h; }
  get left()   { return this.x; }
  get right()  { return this.x+this.w; }
  get top()    { return this.y; }
  get bottom() { return this.y+this.h; }
  get center() { return new Vec2(this.x+this.w/2, this.y+this.h/2); }
  contains(v)  { return v.x>=this.x&&v.x<=this.right&&v.y>=this.y&&v.y<=this.bottom; }
  intersects(r){ return this.x<r.right&&this.right>r.x&&this.y<r.bottom&&this.bottom>r.y; }
  clone() { return new Rect(this.x,this.y,this.w,this.h); }
}
class Circle {
  constructor(x,y,r) { this.x=x; this.y=y; this.r=r; }
  get center() { return new Vec2(this.x,this.y); }
  contains(v)  { return this.center.distance(v)<=this.r; }
  intersects(o){ if(o instanceof Circle)return this.center.distance(o.center)<=this.r+o.r; return false; }
}
class Timer {
  constructor() { this.start=Date.now(); this.elapsed=0; this.running=false; }
  tick()   { if(this.running)this.elapsed=Date.now()-this.start; return this.elapsed; }
  reset()  { this.start=Date.now(); this.elapsed=0; return this; }
  pause()  { this.tick(); this.running=false; return this; }
  resume() { this.start=Date.now()-this.elapsed; this.running=true; return this; }
  get seconds() { return this.elapsed/1000; }
}
class EntityManager {
  constructor() { this._entities=new Map(); this._nextId=1; this._components=new Map(); }
  create(components) { const id=this._nextId++; this._entities.set(id,{id,components:components||{}}); for(const[t]of Object.entries(components||{})){if(!this._components.has(t))this._components.set(t,new Set());this._components.get(t).add(id);} return id; }
  destroy(id) { const e=this._entities.get(id); if(!e)return; for(const t of Object.keys(e.components)){const s=this._components.get(t);if(s)s.delete(id);} this._entities.delete(id); }
  get(id) { return this._entities.get(id); }
  query(...types) { let s=null; for(const t of types){const set=this._components.get(t);if(!set)return[];if(!s||set.size<s.size)s=set;} if(!s)return[]; const r=[]; for(const id of s){const e=this._entities.get(id);if(e&&types.every(t=>t in e.components))r.push(e);} return r; }
  count() { return this._entities.size; }
}
class EventBus {
  constructor() { this._listeners={}; }
  on(e,fn) { if(!this._listeners[e])this._listeners[e]=[]; this._listeners[e].push(fn); return ()=>this.off(e,fn); }
  off(e,fn) { if(!this._listeners[e])return; this._listeners[e]=this._listeners[e].filter(f=>f!==fn); }
  emit(e,data) { const f=this._listeners[e]; if(f)f.forEach(fn=>fn(data)); }
  once(e,fn) { const off=this.on(e,data=>{fn(data);off();}); return off; }
}
class StateMachine {
  constructor(states,initial) { this._states=states||{}; this._current=initial; this._listeners=[]; if(initial&&states[initial]&&states[initial].enter)states[initial].enter(null); }
  get current() { return this._current; }
  transition(next,data) { if(!(next in this._states))throw new Error(`State '${next}' not found`); const prev=this._current; if(this._states[prev]&&this._states[prev].exit)this._states[prev].exit(next,data); this._current=next; if(this._states[next]&&this._states[next].enter)this._states[next].enter(prev,data); this._listeners.forEach(fn=>fn({from:prev,to:next,data})); }
  update(dt) { const s=this._states[this._current]; if(s&&s.update)s.update(dt); }
  is(s) { return this._current===s; }
  onChange(fn) { this._listeners.push(fn); return ()=>{this._listeners=this._listeners.filter(f=>f!==fn);}; }
}
class GameLoop {
  constructor(o) { o=o||{}; this.targetFps=o.fps||60; this.fixedTimestep=o.fixedTimestep||1/60; this._running=false; this._lastTime=0; this._accumulator=0; this.fps=0; this._fpsCount=0; this._fpsTime=0; this.onUpdate=o.onUpdate||null; this.onFixedUpdate=o.onFixedUpdate||null; this.onRender=o.onRender||null; }
  start() { this._running=true; this._lastTime=Date.now(); this._loop(); }
  stop()  { this._running=false; }
  _loop() { if(!this._running)return; const now=Date.now(); const dt=Math.min((now-this._lastTime)/1000,0.1); this._lastTime=now; this._accumulator+=dt; if(this.onUpdate)this.onUpdate(dt); while(this._accumulator>=this.fixedTimestep){if(this.onFixedUpdate)this.onFixedUpdate(this.fixedTimestep);this._accumulator-=this.fixedTimestep;} if(this.onRender)this.onRender(this._accumulator/this.fixedTimestep); this._fpsCount++;this._fpsTime+=dt; if(this._fpsTime>=1){this.fps=this._fpsCount;this._fpsCount=0;this._fpsTime=0;} const delay=Math.max(0,1000/this.targetFps-(Date.now()-now)); setTimeout(()=>this._loop(),delay); }
}
const math = {
  clamp:(v,min,max)=>Math.max(min,Math.min(max,v)), lerp:(a,b,t)=>a+(b-a)*t,
  smoothstep:(a,b,t)=>{t=Math.max(0,Math.min(1,(t-a)/(b-a)));return t*t*(3-2*t);},
  deg2rad:d=>d*Math.PI/180, rad2deg:r=>r*180/Math.PI,
  rand:(min,max)=>min+Math.random()*(max-min),
  randInt:(min,max)=>Math.floor(math.rand(min,max+1)),
  randItem:arr=>arr[math.randInt(0,arr.length-1)],
  sign:v=>v>0?1:v<0?-1:0,
  snap:(v,s)=>Math.round(v/s)*s,
  pingpong:(t,len)=>{ t=t%((len||1)*2); return t>len?len*2-t:t; },
  repeat:(t,len)=>t%(len||1),
  moveTowards:(curr,target,step)=>{ const d=target-curr; if(Math.abs(d)<=step)return target; return curr+Math.sign(d)*step; },
};

module.exports = new Proxy({
  Vec2, Rect, Circle, Timer, EntityManager, EventBus, StateMachine, GameLoop, math,
  get Activity()              { return getEngine().Activity; },
  get Vec3()                  { return getEngine().Vec3; },
  get Vec4()                  { return getEngine().Vec4; },
  get Mat4()                  { return getEngine().Mat4; },
  get Quaternion()            { return getEngine().Quaternion; },
  get math3d()                { return getEngine().math3d; },
  get Renderer3D()            { return getEngine().Renderer3D; },
  get Scene()                 { return getEngine().Scene; },
  get SceneNode()             { return getEngine().SceneNode; },
  get Camera3D()              { return getEngine().Camera3D; },
  get Material()              { return getEngine().Material; },
  get Light()                 { return getEngine().Light; },
  get Transform3D()           { return getEngine().Transform3D; },
  get Mesh()                  { return getEngine().Mesh; },
  get Geometry()              { return getEngine().Geometry; },
  get PhysicsWorld()          { return getEngine().PhysicsWorld; },
  get RigidBody()             { return getEngine().RigidBody; },
  get BoxCollider()           { return getEngine().BoxCollider; },
  get SphereCollider()        { return getEngine().SphereCollider; },
  get InputSystem()           { return getEngine().InputSystem; },
  get AudioSystem()           { return getEngine().AudioSystem; },
  get AudioTone()             { return getEngine().AudioTone; },
  get GameEngine()            { return getEngine().GameEngine; },
  get run()                   { return getEngine().run; },
  get createDisplay()         { return getEngine().createDisplay; },
  get FramebufferDisplay()    { return getEngine().FramebufferDisplay; },
  get TerminalDisplay()       { return getEngine().TerminalDisplay; },
  get FileDisplay()           { return getEngine().FileDisplay; },
  get Color3D()               { return getEngine().Color; },
  get FPSController()         { return getEngine().FPSController; },
  get OrbitController()       { return getEngine().OrbitController; },
  get FollowController()      { return getEngine().FollowController; },
  get FlyController()         { return getEngine().FlyController; },
  get CameraShake()           { return getEngine().CameraShake; },
  get UICanvas()              { return getEngine().UICanvas; },
  get UIRenderer()            { return getEngine().UIRenderer; },
  get Panel()                 { return getEngine().Panel; },
  get Label()                 { return getEngine().Label; },
  get Button()                { return getEngine().Button; },
  get ProgressBar()           { return getEngine().ProgressBar; },
  get Checkbox()              { return getEngine().Checkbox; },
  get Slider()                { return getEngine().Slider; },
  get TextInput()             { return getEngine().TextInput; },
  get Easing()                { return getEngine().Easing; },
  get Tween()                 { return getEngine().Tween; },
  get TweenManager()          { return getEngine().TweenManager; },
  get createTweenManager()    { return getEngine().createTweenManager; },
  get AnimationClip()         { return getEngine().AnimationClip; },
  get AnimationTrack()        { return getEngine().AnimationTrack; },
  get Animator()              { return getEngine().Animator; },
  get AnimationStateMachine() { return getEngine().AnimationStateMachine; },
  get rotateBob()             { return getEngine().rotateBob; },
  get ParticleEmitter()       { return getEngine().ParticleEmitter; },
  get ParticleSystem()        { return getEngine().ParticleSystem; },
  get fireEmitter()           { return getEngine().fireEmitter; },
  get smokeEmitter()          { return getEngine().smokeEmitter; },
  get explosionBurst()        { return getEngine().explosionBurst; },
  get Ray()                   { return getEngine().Ray; },
  get AABB()                  { return getEngine().AABB; },
  get Raycaster()             { return getEngine().Raycaster; },
  get Tilemap()               { return getEngine().Tilemap; },
  get Heightmap()             { return getEngine().Heightmap; },
  get DebugDraw()             { return getEngine().DebugDraw; },
  get Profiler()              { return getEngine().Profiler; },
}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const e = getEngine();
    if (prop in e) return e[prop];
    return undefined;
  }
});
