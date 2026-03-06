<p align="center">
  <img src="./ntl.svg" width="120" alt="NTL Logo">
</p>
---

## License

Apache License © 2026 David Dev

GitHub: [github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)


<div align="center">

# NTL — The Language That Ends the Conversation

**One language. Backend, frontend, database, real-time systems, and a full GPU-accelerated 3D game engine.  
Everything compiles to blazing-fast JavaScript. Zero dependencies. Zero compromises.**

[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Zero npm dependencies](https://img.shields.io/badge/dependencies-zero-blue)](package.json)
[![Tests: 74/74](https://img.shields.io/badge/tests-74%2F74%20passing-brightgreen)](#)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

*Created by David Dev — [github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)*

---

## Why NTL?

Most languages make you choose: server or client, compiled or interpreted, safe or fast. NTL refuses every tradeoff. It compiles to clean, optimized JavaScript, runs on Node.js, and ships with a standard library so complete that you'll never open `npm install` again.

NTL's syntax is deliberately expressive: pattern-matching guards (`have`), optional pipelines, macro expansion, decorators, traits, abstract classes, generators, and a structural type system all coexist without ceremony. This makes NTL particularly well-suited for domains that demand precise, declarative control over data flow, transformations, and rule systems — from compilers and interpreters to game logic, protocol parsers, and domain-specific rule engines.

Every feature listed below is **built in, zero dependencies, ready on day one:**

| System | What you get |
|---|---|
| HTTP Server | Routing, middleware, multipart, SSE, compression |
| Database | SQLite ORM, query builder, migrations, transactions |
| Frontend | JSX components, SSR, auto-compilation, custom pragma |
| WebSockets | Full RFC 6455, rooms, broadcast, reconnection |
| Auth | JWT, AES-256, bcrypt-style hashing, CSRF |
| Validation | Zod-style schemas with full type inference |
| AI / LLM | OpenAI, Anthropic, Ollama, Groq — one unified API |
| Testing | Full test runner, assertions, mocks, coverage |
| **3D Game Engine** | **GPU-accelerated rendering, physics, UI, particles, animation** |
| **Camera Controllers** | **FPS, Orbit, Follow, Fly, CameraShake — all built-in** |
| **Rigid Body Physics** | **Collision detection, impulse response, gravity** |
| **Full UI System** | **Button, Slider, Checkbox, ProgressBar, TextInput — pixel-perfect** |
| **Tweens & Easing** | **24 easing functions, chainable, yoyo, loop, delay** |
| **Particle System** | **Fire, smoke, explosion presets + fully customizable emitters** |
| **Raycasting** | **Screen-to-world, AABB, sphere, triangle intersection** |
| **Tilemap & Terrain** | **A* pathfinding, procedural heightmap, noise terrain** |
| **Animation System** | **Keyframe clips, state machine, any-property targeting** |
| Display Backends | `/dev/fb0` framebuffer, ANSI truecolor terminal, BMP file output |
| Node.js interop | Every built-in and every npm package works via `require()` |
| **Binary Compilation** | **Compile to Linux, Android, Windows (17 targets) with `ntl binary`** |
| **WebAssembly** | **Emit real `.wasm` binaries from NTL source — no emscripten, no toolchain** |
| **Decorator system** | **@singleton @memo @retry @timeout @cache @log @deprecated @bind — built-in** |
| **`have` operator** | **Pattern matching, membership, type guards, range checks — one operator** |

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Full-Stack Architecture](#full-stack-architecture)
4. [JSX — Frontend Components](#jsx--frontend-components)
5. [CLI Reference](#cli-reference)
6. [Language Guide](#language-guide)
7. [Using Node.js Modules](#using-nodejs-modules)
8. [Built-in Modules](#built-in-modules)
9. [Project Configuration](#project-configuration)
10. [Complete Examples](#complete-examples)

---

## Installation

```bash
npm install -g @david0dev/ntl-lang
```

Or clone and run directly:

```bash
git clone https://github.com/Megamexlevi2/ntl-lang
cd ntl-lang
node main.js run examples/fullstack_server.ntl
```

**Requirements:** Node.js ≥ 18.0.0

---


## Project Structure

```
ntl/
├── main.js              # CLI entry point
├── src/
│   ├── compiler.js      # Compilation pipeline orchestrator
│   ├── error.js         # Error formatting
│   ├── utils.js         # Shared utilities
│   ├── native.js        # Binary compilation (ntl binary)
│   ├── pipeline/        # Core compiler stages
│   │   ├── lexer.js     # Tokenizer
│   │   ├── parser.js    # AST builder
│   │   ├── scope.js     # Scope & variable analysis
│   │   ├── typechecker.js
│   │   ├── typeinfer.js
│   │   ├── codegen.js   # JavaScript code generation
│   │   └── treeshaker.js
│   ├── transforms/      # Source transforms
│   │   ├── jsx.js       # JSX → React.createElement
│   │   └── formatter.js # Code formatter
│   └── runtime/         # Module system
│       ├── loader.js    # ntl: stdlib loader
│       ├── resolver.js  # Module path resolver
│       ├── bundler.js   # Bundler
│       └── nax.js       # Package manager
├── stdlib/              # Standard library (written in NTL)
│   ├── core/            # Language essentials
│   │   ├── fs.ntl       # File system (raw OS bindings, no require('fs'))
│   │   ├── crypto.ntl   # Hashing, encryption, JWT, UUID
│   │   ├── events.ntl   # EventEmitter
│   │   ├── queue.ntl    # Job queues
│   │   └── utils.ntl    # Utility helpers
│   ├── net/             # Networking
│   │   ├── http.ntl     # HTTP server/client
│   │   ├── ws.ntl       # WebSockets
│   │   └── mail.ntl     # SMTP email
│   ├── data/            # Data & storage
│   │   ├── db.ntl       # SQLite database
│   │   ├── validate.ntl # Schema validation
│   │   ├── cache.ntl    # In-memory cache
│   │   ├── web.ntl      # HTML/CSS/DOM tools
│   │   └── obf.ntl      # Code obfuscation
│   ├── tools/           # Developer tools
│   │   ├── test.ntl     # Test runner
│   │   ├── logger.ntl   # Structured logging
│   │   └── env.ntl      # Environment variables
│   ├── ai/
│   │   └── ai.ntl       # AI/LLM integrations
│   └── mobile/
│       └── android.ntl  # Android bridge
├── tests/
│   └── all.ntl          # Full stdlib test suite (74 tests)
└── examples/            # Example programs
```

## Quick Start

```ntl
// server.ntl — a complete REST API in 25 lines
val http = require("ntl:http")
val {Database} = require("ntl:db")

val db = new Database("./app.db")

db.createTable("todos", (t) => {
  t.id()
  t.text("title")
  t.boolean("done", false)
  t.timestamps()
})

val router = new http.Router()
router.use(http.cors())

router.get("/todos", (req, res) => {
  res.json(db.table("todos").orderByDesc("created_at").all())
})

router.post("/todos", (req, res) => {
  val id   = db.table("todos").insert({title: req.body.title})
  val todo = db.table("todos").find(id)
  res.status(201).json(todo)
})

router.delete("/todos/:id", (req, res) => {
  db.table("todos").where("id", req.params.id).delete()
  res.json({deleted: true})
})

http.listen(3000, router, () => log "Server at http://localhost:3000")
```

```bash
ntl run server.ntl
```

---

## Full-Stack Architecture

NTL is designed for full-stack development. Your project uses one language for everything:

```
my-app/
├── src/
│   ├── server.ntl            ← backend: HTTP routes, auth, DB
│   ├── components/
│   │   ├── App.ntl           ← JSX component (frontend)
│   │   ├── Button.ntl        ← JSX component (frontend)
│   │   └── UserList.ntl      ← JSX component (frontend)
│   └── pages/
│       └── Home.ntl          ← SSR page (backend imports JSX)
└── ntl.json
```

**Backend** imports and renders JSX components for server-side rendering:

```ntl
// src/server.ntl
val http = require("ntl:http")
val {renderToString} = require("react-dom/server")
val {App} = require("./components/App")    // ← import your JSX component

val router = new http.Router()

// Server-Side Rendering
router.get("/", (req, res) => {
  val html = renderToString(<App user={req.user} />)
  res.html("<!DOCTYPE html><html><body><div id=\"root\">{html}</div></body></html>")
})

// JSON API for the frontend to call
router.get("/api/users", (req, res) => {
  res.json(db.table("users").all())
})

http.listen(3000, router)
```

**Frontend** — JSX component in `.ntl` file:

```ntl
// src/components/App.ntl
val React = require("react")

fn App({user}) {
  val [count, setCount] = React.useState(0)
  return (
    <div className="app">
      <h1>Hello, {user.name}!</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Clicked {count} times
      </button>
    </div>
  )
}

export {App}
```

**Compile frontend for the browser:**

```bash
ntl build src/components/App.ntl -o dist/bundle.js --target browser --jsx
```

**Run the full-stack server:**

```bash
ntl run src/server.ntl
```

---

## JSX — Frontend Components

NTL has **first-class JSX support**. JSX is auto-detected and compiled — no plugins or config needed.

### How it works

You write JSX in any `.ntl` file:

```ntl
fn Greeting({name}) {
  return <h1 className="greeting">Hello, {name}!</h1>
}
```

NTL compiles it to standard `React.createElement` calls:

```js
function Greeting({name}) {
  return React.createElement("h1", {className: "greeting"}, "Hello, ", name, "!");
}
```

### JSX Syntax

```ntl
// Lowercase tag = HTML element (string)
val box = <div className="container">content</div>

// Uppercase tag = Component (variable reference)
val ui = <MyButton variant="primary" onClick={handler}>Click me</MyButton>

// Fragment — no wrapper element
val group = (
  <>
    <h1>Title</h1>
    <p>Paragraph</p>
  </>
)

// Self-closing
val field = <input type="email" value={email} onChange={handleChange} />

// Spread props
val comp = <Button {...defaultProps} {...overrides} />

// Boolean prop (value = true)
val btn = <button disabled>Disabled</button>

// Expressions inside JSX
val list = (
  <ul>
    {items.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
)

// Conditional rendering
val view = (
  <div>
    {isLoggedIn && <WelcomeBanner user={user} />}
    {!isLoggedIn && <LoginForm />}
    {status === "loading" ? <Spinner /> : <Content />}
  </div>
)

// Nested components
val page = (
  <Layout>
    <Header title="Dashboard" />
    <main>
      <Sidebar />
      <UserList users={users} loading={loading} />
    </main>
    <Footer />
  </Layout>
)
```

### Import Rules for JSX

JSX **can be used on both frontend and backend**:

| Use case | Works? | Notes |
|---|---|---|
| Frontend `.ntl` file with JSX | ✅ | Compile with `--target browser` |
| Backend `.ntl` file importing JSX | ✅ | Install `react` via npm |
| SSR: backend renders JSX to HTML string | ✅ | Uses `react-dom/server` |

**Important:** JSX imports require `react` (or your chosen framework) installed via npm in your project. NTL transforms the syntax — the React runtime must be available.

```bash
# For SSR or backend usage:
npm install react react-dom
```

### Build for the Browser

```bash
# Compile NTL + JSX → browser bundle
ntl build src/App.ntl -o dist/bundle.js --target browser

# Custom pragma (Preact, Solid, etc.)
ntl build src/App.ntl -o dist/bundle.js --jsx-pragma h --jsx-frag Fragment

# With minification
ntl build src/App.ntl -o dist/bundle.js --target browser --minify
```

### JSX with Tailwind CSS

```ntl
fn ProductCard({name, price, image, onBuy}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      <img src={image} alt={name} className="w-full h-48 object-cover" />
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        <p className="text-2xl font-bold text-blue-600 mt-1">${price}</p>
        <button
          onClick={onBuy}
          className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg"
        >
          Buy Now
        </button>
      </div>
    </div>
  )
}
```

---

## CLI Reference

```
ntl run    <file.ntl>              Execute an NTL file immediately
ntl binary <file.ntl>              Compile to native binary  [--target] [--standalone] [--all]
ntl build  <file.ntl|ntl.json>    Compile to JavaScript
ntl bundle <file|dir> [-o out]    Bundle multiple files into one
ntl check  <file.ntl>             Type-check without emitting
ntl watch  <file.ntl>             Watch and recompile on changes
ntl dev    [dir]                  Dev server with hot reload
ntl repl                          Interactive REPL
ntl init   [dir]                  Scaffold a new project with ntl.json
ntl fmt    <file.ntl>             Format an NTL file
ntl nax    install <url>          Install a module from GitHub
ntl nax    list                   List installed modules
ntl version                       Show version info
ntl help                          Show help
```

### Build Flags

| Flag | Description |
|---|---|
| `--out <path>` / `-o <path>` | Output file path |
| `--target <t>` | `node` (default) \| `browser` \| `deno` \| `bun` \| `esm` \| `cjs` |
| `--minify` | Minify output |
| `--obfuscate` | Obfuscate output for distribution |
| `--strict` | Enable strict type checking |
| `--no-treeshake` | Disable tree shaking |
| `--source-map` | Generate source map |
| `--jsx` | Force-enable JSX transform (auto-detected by default) |
| `--jsx-pragma <fn>` | JSX factory function (default: `React.createElement`) |
| `--jsx-frag <fn>` | JSX Fragment (default: `React.Fragment`) |
| `--jsx-import none` | Don't auto-inject `require("react")` |

---

## Language Guide

### Variables

```ntl
val name    = "Alice"          // const — never reassigned
var counter = 0                // let — mutable
counter++
counter += 10

val {a, b, c} = someObj       // destructure
val [x, y, ...rest] = list    // array destructure
val a: number = 42            // optional type annotation
```

### Functions

```ntl
fn add(a, b) { return a + b }

async fn fetchUser(id) {
  val res = await http.get("https://api.example.com/users/{id}")
  return res.data
}

// Default parameters
fn greet(name, greeting = "Hello") {
  return "{greeting}, {name}!"
}

// Rest parameters
fn sum(...nums) { return nums.reduce((a, b) => a + b, 0) }

// With return type
fn divide(a: number, b: number) -> number {
  guard b !== 0 else { return 0 }
  return a / b
}

// Destructured params (works with JSX components too)
fn UserCard({name, email, active = true}) {
  return "{name} <{email}> ({active ? 'active' : 'inactive'})"
}

// Generator
fn* counter(start, end) {
  var n = start
  while n <= end { yield n++ }
}
```

### Arrow Functions

```ntl
val double  = x => x * 2
val add     = (x, y) => x + y
val process = (x) => {
  val result = x * 2
  return result + 1
}
val load    = async (url) => { return await http.get(url) }
val noop    = async () => {}
```

### Control Flow

```ntl
// if / elif / else
if x > 0 { log "positive" }
elif x < 0 { log "negative" }
else { log "zero" }

// unless (if not)
unless ready { raise "Not ready" }

// guard — early exit
fn process(data) {
  guard data !== null else { return "null input" }
  guard data.length > 0 else { return "empty" }
  return data.join(", ")
}

// while / loop / do...while
while active { process() }
loop { val item = next(); if !item { break } }
do { attempt() } while failed && tries < 3

// for...of / each (alias)
for val item of list { log item }
each user in users { log user.name }

// repeat N times
repeat 3 { log "hello" }

// for...in (object keys)
for val key in config { log key, config[key] }

// defer — run on scope exit
fn withFile(path) {
  val file = fs.open(path)
  defer { file.close() }
  return file.read()
}

// break / continue with range
for val n of range(10) {
  if n % 2 === 0 { continue }
  if n > 7 { break }
  log n
}
```

### Classes

```ntl
class Animal {
  init(name, species) {
    this.name    = name
    this.species = species
  }

  speak() { log "{this.name} makes a sound" }

  get fullName() { return "{this.name} ({this.species})" }
  set fullName(v) { this.name = v.split(" ")[0] }

  static create(name, species) { return new Animal(name, species) }

  async fetchInfo() {
    return await http.get("https://api.example.com/animals/{this.species}")
  }
}

class Dog extends Animal {
  init(name) {
    super(name, "Canis lupus familiaris")
    this.tricks = []
  }

  speak() { log "{this.name}: Woof!" }

  learnTrick(trick) { this.tricks.push(trick) }
}

val rex = new Dog("Rex")
rex.speak()
log rex.fullName
```

### Decorators

NTL has a full set of built-in decorators that work on functions and classes — no packages needed.

```ntl
// ─── @class — attach metadata to a class ─────────────────
@class
class User {
  init(name, email) {
    this.name  = name
    this.email = email
  }
}
// User.__ntl_meta → { name: "User", decorators: ["class"], created: ... }

// ─── @singleton ───────────────────────────────────────────
@singleton
class Config {
  init() { this.env = process.env.NODE_ENV ?? "dev" }
}

val a = new Config()
val b = new Config()
log a === b   // true — same instance every time

// ─── @sealed — prevent subclassing and mutation ───────────
@sealed
class Token {
  init(value) { this.value = value }
}

// ─── @abstract — cannot be instantiated directly ──────────
@abstract
class Shape {
  area() { raise "not implemented" }
}

class Circle extends Shape {
  init(r) { this.r = r }
  area() { return Math.PI * this.r ** 2 }
}

// ─── @memo — memoize function results ─────────────────────
@memo
fn fib(n) {
  if n <= 1 { return n }
  return fib(n - 1) + fib(n - 2)
}

log fib(40)  // computed once per unique arg, then cached

// ─── @retry(n) — retry async functions on failure ─────────
@retry(3)
async fn fetchUser(id) {
  return await http.get("/users/{id}")
}
// auto-retries up to 3x with exponential backoff

// ─── @timeout(ms) — fail after N milliseconds ─────────────
@timeout(5000)
async fn slowQuery() {
  return await db.query("SELECT ...")
}
// throws "Timeout after 5000ms" if it takes longer

// ─── @deprecated(message) ────────────────────────────────
@deprecated("use newApi() instead")
fn oldApi() {
  return "legacy"
}
// logs warning to console on every call

// ─── @log — trace every call ──────────────────────────────
@log
fn processPayment(amount, card) {
  return charge(card, amount)
}
// logs: [processPayment] called with [...args]
// logs: [processPayment] returned [result]

// ─── @cache(ttl_ms) — cache return values ─────────────────
@cache(60000)
fn getExchangeRate(from, to) {
  return http.get("/rates/{from}/{to}")
}
// result cached for 60 seconds per unique argument combination

// ─── @bind — auto-bind class methods to 'this' ────────────
@bind
class Timer {
  init() { this.count = 0 }
  tick() { this.count++ }   // 'this' always bound, safe as callback
}

val timer = new Timer()
setInterval(timer.tick, 1000)  // works without .bind(timer)

// ─── @validate(schema) — runtime schema validation ────────
@validate
fn createUser(data) {
  return db.insert("users", data)
}

// ─── Stacking decorators ──────────────────────────────────
@memo
@retry(2)
@timeout(3000)
@log
async fn criticalFetch(id) {
  return await api.get("/critical/{id}")
}

// ─── @class on any target ────────────────────────────────
@singleton
@sealed
class AppState {
  init() {
    this.users    = []
    this.sessions = new Map()
  }
}
```

### Destructuring

```ntl
val {name, email, ...rest} = user
val {address: {city, zip}} = profile
val {name: userName, id: userId} = user

val [first, , third, ...others] = list

// In function params
fn show({name, age = 0}) { log name, age }

// In loops
for val {name, salary} of employees { log name, salary }
for val [key, value] of Object.entries(map) { log key, value }
```

### Template Strings

```ntl
val msg  = "Hello, {name}! You have {count} messages."
val url  = "https://api.example.com/users/{userId}"
val calc = "Result: {a + b} ({a * b} multiplied)"
val cond = "Status: {active ? 'active' : 'inactive'}"
```

### Pattern Matching

```ntl
// Match as statement
match status {
  case "active"  => { log "Running" }
  case "paused"  => { log "Paused" }
  default        => { log "Unknown:", status }
}

// Match as expression (return value)
fn describe(code) {
  return match code {
    case n when n >= 200 && n < 300 => { "Success" }
    case n when n >= 400 && n < 500 => { "Client error" }
    case n when n >= 500            => { "Server error" }
    default                         => { "Other" }
  }
}

// Match assigned to variable
val label = match role {
  case "admin"  => { "Administrator" }
  case "editor" => { "Editor" }
  default       => { "User" }
}
```

### `have` — Pattern Guard Operator

`have` is NTL's unified guard and pattern-matching operator. It replaces `if`, optional chaining, `in`, `instanceof`, regex tests, and range checks with a single readable syntax.

```ntl
// ─── membership ──────────────────────────────────────────
val fruits = ["apple", "banana", "mango"]

have "banana" in fruits {
  log "found"
}

have "grape" in fruits {
  log "exists"
} else {
  log "not in list"
}

// Works with arrays, Sets, objects (key check), and strings
have "hello" in "hello world" { log "substring found" }
have "port"  in config         { log "port is configured" }
have user.id in cache          { log "cache hit" }

// ─── early return (guard form) ───────────────────────────
fn process(req) {
  have req.body        else { return 400 }
  have req.body.email  else { return "missing email" }
  have req.body.name   else { return "missing name" }

  // guaranteed: body, email, name all exist here
  return save(req.body)
}

// ─── range check ─────────────────────────────────────────
have age between 18 99 {
  log "valid age"
}

have score between 0 100 else {
  raise "score out of range"
}

// ─── regex match ─────────────────────────────────────────
have email matches /^[\w.]+@[\w.]+\.[a-z]{2,}$/ {
  log "valid email"
} else {
  return "bad email format"
}

// ─── type check ──────────────────────────────────────────
have value is String  { log "it's a string" }
have value is Number  { log "it's a number" }
have value is Array   { log "it's an array" }

have value is not String {
  raise TypeError("expected string")
}

// ─── string pattern ──────────────────────────────────────
have path startsWith "/api" { log "API route" }
have file endsWith ".ntl"   { log "NTL source" }

// ─── value binding ───────────────────────────────────────
// (captures the value while checking, like ifhave but inline)
have db.find(id) as user {
  log "found:", user.name
} else {
  log "not found"
}

// ─── safe deep access ────────────────────────────────────
// have as expression = null-safe chain
val city = have user.profile.address.city   // never throws
val port = have config.server.port ?? 3000
```

### `ifhave` — Conditional Binding

```ntl
// run a block only when value exists (non-null, non-false)
ifhave user.name as name {
  log "Hello,", name
} else {
  log "anonymous"
}

// works with any expression — functions, async, find
ifhave list.find(x => x.active) as item {
  log "active item:", item.id
}

// membership patterns
ifhave token in validTokens {
  log "authorized"
}

// range
ifhave score between 90 100 {
  log "A grade"
}

// regex
ifhave input matches /^\d{4}-\d{2}-\d{2}$/ {
  log "date format valid"
}
```

### Other Safe Operations

```ntl
// try? — returns null instead of throwing
val parsed = try? JSON.parse(input)
val user   = try? await fetchUser(id)

// ifset — run if variable is defined (not undefined)
ifset config.port as port { log "Port:", port }

// Optional chaining + nullish coalescing
val name = user?.profile?.name ?? "Anonymous"
val port = env?.PORT ?? 3000
```

### Generators

```ntl
fn* range2(start, end, step) {
  step = step || 1
  var n = start
  while n <= end { yield n; n += step }
}

for val n of range2(0, 10, 2) { log n }   // 0 2 4 6 8 10

async fn* streamLines(path) {
  val content = await fs.readAsync(path)
  for val line of content.split("\n") { yield line }
}
```

### Ranges and Pipelines

```ntl
range(10)           // [0, 1, 2, ..., 9]
range(1, 6)         // [1, 2, 3, 4, 5]
range(0, 10, 2)     // [0, 2, 4, 6, 8]

// Pipeline operator |>
val result = range(10)
  |> (arr => arr.filter(n => n % 2 === 0))
  |> (arr => arr.map(n => n * n))
  |> (arr => arr.reduce((a, b) => a + b, 0))
```

### Namespaces and Enums

```ntl
namespace MathUtils {
  val PI = 3.14159265358979
  fn clamp(v, min, max) { return v < min ? min : v > max ? max : v }
  fn lerp(a, b, t) { return a + (b - a) * t }
}

MathUtils.clamp(15, 0, 10)   // 10
MathUtils.lerp(0, 100, 0.5)  // 50

enum Status { Active, Inactive, Pending, Blocked }
enum HttpCode { OK = 200, Created = 201, NotFound = 404, ServerError = 500 }

match user.status {
  case Status.Active  => { process(user) }
  case Status.Blocked => { log "Blocked" }
  default             => { log "Pending review" }
}
```

### Types and Interfaces

```ntl
interface User {
  id:     number
  name:   string
  email:  string
  active: boolean
}

interface Repository<T> {
  find(id: number)     -> T
  save(item: T)        -> void
  delete(id: number)   -> boolean
}

type ID       = number | string
type Callback = (err: Error | null, result: any) -> void

fn first<T>(list: T[]) -> T { return list[0] }
```

### Special Keywords

```ntl
// log — shorthand for console.log
log "Server started"
log "User:", user.name, "at", new Date()

// assert — throws if false
assert result !== null, "Result must not be null"
assert list.length > 0, "List cannot be empty"

// sleep — pause async execution
async fn wait() {
  log "Starting..."
  sleep 2000          // wait 2 seconds
  log "Done"
}

// spawn — fire-and-forget async
spawn processQueue()
spawn sendEmail(user, "welcome")

// raise — shorthand for throw
fn requireId(id) {
  if !id { raise "id is required" }
  return id
}

// immutable — deep freeze
immutable CONFIG = {port: 3000, env: "production"}

// delete
delete obj.tempKey
delete cache[key]
```

---

## Using Node.js Modules

All Node.js built-in modules work natively in NTL:

```ntl
val path   = require("path")
val fs     = require("fs")
val os     = require("os")
val crypto = require("crypto")

val {EventEmitter} = require("events")
val {promisify}    = require("util")
val {join}         = require("path")

// npm packages also work (install with npm first)
val axios  = require("axios")
val lodash = require("lodash")

log path.join("/home", "user", "docs")
log os.cpus().length, "CPU cores"
log crypto.randomBytes(16).toString("hex")
```

## How NTL Modules Work

NTL built-in modules use the `ntl:` prefix. They are **only available inside NTL programs** — the NTL runtime automatically intercepts `require("ntl:...")` calls and loads the correct module.

```ntl
// These all work inside any .ntl file:
val http     = require("ntl:http")
val db       = require("ntl:db")
val crypto   = require("ntl:crypto")
val validate = require("ntl:validate")
```

When you build a NTL file with `ntl build`, the output JavaScript automatically includes a small runtime preamble that makes `ntl:` module loading work. You can run the output file directly with Node.js:

```bash
ntl build app.ntl -o dist/app.js
node dist/app.js          # works — preamble is included
```

> **Important:** The compiled `.js` output is valid Node.js, but it depends on having the NTL runtime available (the `ntl-lang` package on npm, or a local NTL installation). You cannot copy just the `.js` file to a machine without NTL installed and expect `ntl:` modules to resolve. For fully self-contained deployment, use `ntl bundle`:

```bash
ntl bundle app.ntl -o dist/bundle.js    # single-file, no NTL runtime needed
```

### Module Loading Rules

| Prefix | Example | Works in |
|--------|---------|----------|
| `ntl:` | `require("ntl:http")` | NTL files, compiled output with preamble |
| `./` | `require("./utils")` | NTL files — resolves relative to source |
| bare name | `require("path")`, `require("axios")` | NTL files — Node.js built-ins and npm packages |

### Writing Modules in NTL (for NTL)

You can write your own `.ntl` modules and `require()` them from other NTL files. They compile and load just like any other module:

```
my-project/
  src/
    main.ntl          ← require("./utils") works here
    utils.ntl         ← your module
    db/
      queries.ntl     ← require("../utils") works here
```

Modules auto-export via `exports.x = x` or `module.exports = { ... }`. See the [Creating Your Own Modules](#creating-your-own-modules) section for full examples.

---


## Compiling to Binary

NTL compiles to standalone executables for Linux, Android, and Windows — every common architecture. No toolchain needed, no Docker, no cross-compilation setup. One command.

```bash
ntl binary app.ntl                        # Linux x64 (default)
ntl binary app.ntl --target android-arm64 # Android
ntl binary app.ntl --target windows-x64   # Windows
ntl binary app.ntl --all -o dist/         # every target at once
```

### All Available Targets

| Platform | Targets |
|----------|---------|
| **Linux** | `linux-x64` `linux-arm64` `linux-arm32` `linux-riscv64` `linux-ppc64` `linux-s390x` `linux-mips64` `linux-x86` |
| **Android** | `android-arm64` `android-arm32` `android-x64` `android-x86` |
| **Windows** | `windows-x64` `windows-arm64` `windows-x86` |
| **WebAssembly** | `wasm32` `wasm64` |

```bash
ntl binary --list-targets   # print all 17 targets with triples
```

### Modes

**Shell binary** (default) — small, requires Node.js on target:
```bash
ntl binary server.ntl -o server --target linux-arm64
```

**Standalone** — ~55 MB, bundles the Node runtime. Runs with **zero dependencies**:
```bash
ntl binary app.ntl -o app --standalone --target android-arm64
./app                        # runs on any Android with Termux or direct exec
```

**Build for every target at once:**
```bash
ntl binary app.ntl --all -o dist/ --standalone
# dist/
#   app_linux_x64
#   app_linux_arm64
#   app_android_arm64
#   app_windows_x64.bat
#   app_wasm32.wasm
#   ... 17 total
```

### How it works

The compiler embeds all used `ntl:` stdlib modules as pre-compiled strings directly into the binary. The binary is fully self-contained at the NTL level — no external NTL installation needed at runtime. The standalone mode additionally bundles the Node.js runtime, making the output run on any machine without any software installed.

### WebAssembly — Real `.wasm`, No Dependencies

NTL compiles to real WebAssembly binary format (`.wasm`) without emscripten, wasi-sdk, or any external toolchain. The compiler writes the WebAssembly binary encoding directly.

```bash
ntl binary app.ntl -o app --target wasm32
# → app.wasm  (valid WebAssembly binary, 100% spec-compliant)
```

The output is a true `.wasm` binary that:
- Runs in any browser via `WebAssembly.instantiate()`
- Runs with `wasmtime`, `wasmer`, or `wasm3` on any OS
- Can be imported as a Web Worker
- Exports `_start` and `memory` (WASI-compatible)

```javascript
// Browser / Node.js
const wasm = await WebAssembly.instantiateStreaming(fetch('app.wasm'));
wasm.instance.exports._start();

// Node.js (direct)
const buf = fs.readFileSync('app.wasm');
const { instance } = await WebAssembly.instantiate(buf);
instance.exports._start();
```

```bash
# CLI runtimes
wasmtime app.wasm
wasmer   app.wasm
wasm3    app.wasm
node     -e "WebAssembly.instantiate(require('fs').readFileSync('app.wasm')).then(r=>r.instance.exports._start())"
```


## Creating Your Own Modules

NTL has a straightforward module system. Any `.ntl` file is a module. You import with `require()`, and export with `exports.X = X` or `module.exports = { ... }`.

### Basic Module

Create `math-utils.ntl`:

```ntl
fn add(a, b) { return a + b }
fn sub(a, b) { return a - b }
fn clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }
fn lerp(a, b, t) { return a + (b - a) * t }

exports.add   = add
exports.sub   = sub
exports.clamp = clamp
exports.lerp  = lerp
```

Use it from another file:

```ntl
val math = require("./math-utils")

log math.add(2, 3)       // 5
log math.clamp(150, 0, 100) // 100
log math.lerp(0, 100, 0.5)  // 50
```

### Class-based Module

Create `logger.ntl`:

```ntl
class Logger {
  constructor(prefix) {
    this.prefix = prefix || "APP"
    this._level = "info"
  }

  setLevel(level) { this._level = level; return this }

  info(msg, ...args)  { console.log(`[${this.prefix}] INFO`, msg, ...args) }
  warn(msg, ...args)  { console.warn(`[${this.prefix}] WARN`, msg, ...args) }
  error(msg, ...args) { console.error(`[${this.prefix}] ERROR`, msg, ...args) }
  debug(msg, ...args) {
    if (this._level === "debug") { console.log(`[${this.prefix}] DEBUG`, msg, ...args) }
  }
}

fn createLogger(prefix) { return new Logger(prefix) }

exports.Logger       = Logger
exports.createLogger = createLogger
```

### Module with State

Create `counter.ntl`:

```ntl
var _count = 0

fn increment(by) { _count += (by || 1); return _count }
fn decrement(by) { _count -= (by || 1); return _count }
fn reset()       { _count = 0 }
fn value()       { return _count }

exports.increment = increment
exports.decrement = decrement
exports.reset     = reset
exports.value     = value
```

### Async Module

Create `api-client.ntl`:

```ntl
val http = require("ntl:http")

val BASE_URL = "https://api.example.com"

async fn getUser(id) {
  val res = await http.get(BASE_URL + "/users/" + id)
  return res.data
}

async fn createUser(data) {
  val res = await http.post(BASE_URL + "/users", data)
  return res.data
}

async fn updateUser(id, data) {
  val res = await http.put(BASE_URL + "/users/" + id, data)
  return res.data
}

exports.getUser    = getUser
exports.createUser = createUser
exports.updateUser = updateUser
```

### EventEmitter Module

```ntl
val { EventEmitter } = require("ntl:events")

class TaskQueue extends EventEmitter {
  constructor() {
    super()
    this._queue   = []
    this._running = false
  }

  push(task) {
    this._queue.push(task)
    this.emit("queued", this._queue.length)
    if (!this._running) { this._process() }
    return this
  }

  async _process() {
    this._running = true
    while (this._queue.length > 0) {
      val task = this._queue.shift()
      this.emit("start", task)
      try {
        val result = await task()
        this.emit("done", result)
      } catch (err) {
        this.emit("error", err)
      }
    }
    this._running = false
    this.emit("idle")
  }

  get size() { return this._queue.length }
}

exports.TaskQueue = TaskQueue
```

Usage:

```ntl
val { TaskQueue } = require("./task-queue")

val q = new TaskQueue()
q.on("done",  result => log "Finished:", result)
q.on("error", err    => log "Error:", err.message)
q.on("idle",  ()     => log "All done!")

q.push(async () => {
  val res = await http.get("https://api.example.com/data")
  return res.data
})
```

### Module Index File

For larger projects, create `index.ntl` to re-export from multiple files:

```ntl
val db       = require("./db")
val auth     = require("./auth")
val mailer   = require("./mailer")
val logger   = require("./logger")

exports.db     = db
exports.auth   = auth
exports.mailer = mailer
exports.log    = logger.createLogger("APP")
```

Then anywhere in your project:

```ntl
val { db, auth, log } = require("./lib")
```

### NTL Module Rules

| Rule | Detail |
|------|--------|
| Declare constants | `val` (like `const`) |
| Declare variables | `var` (like `let`) |
| Define functions | `fn myFn(args) { }` |
| Define classes | `class MyClass { constructor() {} }` |
| Export single value | `exports.name = value` |
| Export multiple | `module.exports = { a, b, c }` |
| Import file | `require("./path/to/file")` |
| Import built-in | `require("ntl:modulename")` |
| Import Node.js | `require("fs")`, `require("path")`, etc. |
| Loops over arrays | `each item in array { }` |
| Avoid as names | `fn`, `val`, `var`, `each`, `range`, `type`, `init` (reserved) |

### Avoid These Patterns in Object Literals

NTL strips quotes from object literal keys. Use bracket notation for hyphenated keys:

```ntl
// ❌ Wrong — NTL removes quotes from keys
val headers = { "Content-Type": "application/json" }  // compiles to: { Content-Type: ... }

// ✅ Correct — use bracket notation
val headers = {}
headers["Content-Type"] = "application/json"
headers["Authorization"] = "Bearer " + token

// ✅ Also correct — single-word keys work fine  
val options = { method: "POST", body: data }
```

### Arrow Functions in Objects

Object methods must use arrow syntax:

```ntl
// ✅ Correct
val obj = {
  greet: (name) => "Hello " + name,
  add:   (a, b) => a + b
}

// ❌ Wrong — shorthand methods not supported in objects
val obj = {
  greet(name) { return "Hello " + name }  // may not work
}

// ✅ Use classes for methods
class MyService {
  greet(name) { return "Hello " + name }   // works in class
}
```

---

## 2D Game Development

NTL's built-in game engine supports full 2D and 3D game development with a CPU software rasterizer and optional GPU framebuffer output.

### 2D Sprite Game

```ntl
val game = require("ntl:game")

class MyGame {
  constructor() {
    this.player = { x: 100, y: 300, w: 32, h: 32, vx: 0, vy: 0 }
    this.gravity = 800
    this.floor   = 400
    this.score   = 0
    this.ui      = new game.UICanvas({ width: 1280, height: 720 })
  }

  update(dt, input) {
    // Player movement
    if (input.left)  { this.player.vx = -200 }
    if (input.right) { this.player.vx =  200 }
    if (!input.left && !input.right) { this.player.vx = 0 }

    // Jump
    if (input.jump && this.player.y >= this.floor) {
      this.player.vy = -600
    }

    // Gravity
    this.player.vy += this.gravity * dt
    this.player.x  += this.player.vx * dt
    this.player.y  += this.player.vy * dt

    // Floor collision
    if (this.player.y >= this.floor) {
      this.player.y  = this.floor
      this.player.vy = 0
    }

    this.score += dt * 10
  }

  render(ctx) {
    // Clear
    ctx.fillRect(0, 0, 1280, 720, "#1a1a2e")

    // Floor
    ctx.fillRect(0, 432, 1280, 288, "#16213e")

    // Player (colored rectangle as sprite placeholder)
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h, "#e94560")

    // Score UI
    this.ui.text("Score: " + Math.floor(this.score), 20, 30, { color: "#fff", size: 20 })
  }
}

game.run(MyGame, { width: 1280, height: 720, fps: 60 })
```

### 2D Tilemap Game with A* Pathfinding

```ntl
val game = require("ntl:game")
val { TileMap } = require("ntl:game/tilemap")

val MAP = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,1,0,0,0,0,1],
  [1,0,1,0,1,0,1,1,0,1],
  [1,0,1,0,0,0,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1]
]

class DungeonGame {
  constructor() {
    this.tilemap = new TileMap(MAP, 64)  // 64px tiles
    this.player  = { gridX: 1, gridY: 1 }
    this.enemy   = { gridX: 8, gridY: 4 }
    this._path   = []
  }

  update(dt, input) {
    if (input.pressedThisFrame("w")) { this._movePlayer(0, -1) }
    if (input.pressedThisFrame("s")) { this._movePlayer(0,  1) }
    if (input.pressedThisFrame("a")) { this._movePlayer(-1, 0) }
    if (input.pressedThisFrame("d")) { this._movePlayer( 1, 0) }

    // Enemy chases player with A*
    this._path = this.tilemap.findPath(
      this.enemy.gridX, this.enemy.gridY,
      this.player.gridX, this.player.gridY
    )
  }

  _movePlayer(dx, dy) {
    val nx = this.player.gridX + dx
    val ny = this.player.gridY + dy
    if (MAP[ny] && MAP[ny][nx] === 0) {
      this.player.gridX = nx
      this.player.gridY = ny
    }
  }

  render(ctx) {
    this.tilemap.render(ctx, {
      0: "#1a1a2e",  // floor
      1: "#4a4a6a"   // wall
    })
    // Draw player
    ctx.fillRect(this.player.gridX * 64 + 8, this.player.gridY * 64 + 8, 48, 48, "#e94560")
    // Draw enemy
    ctx.fillRect(this.enemy.gridX * 64 + 8, this.enemy.gridY * 64 + 8, 48, 48, "#f5a623")
  }
}

game.run(DungeonGame, { width: 640, height: 384, fps: 30 })
```

### 2D Particle Effects

```ntl
val game    = require("ntl:game")
val { ParticleSystem } = require("ntl:game/particles")

class FireworkGame {
  constructor() {
    this.particles = new ParticleSystem(5000)  // max 5000 particles
  }

  update(dt, input) {
    if (input.pressedThisFrame("space")) {
      this.particles.emit({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        count:    80,
        speed:    300,
        lifetime: 1.5,
        gravity:  400,
        colors:   ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"]
      })
    }
    this.particles.update(dt)
  }

  render(ctx) {
    ctx.fillRect(0, 0, 1280, 720, "#0d0d0d")
    this.particles.render(ctx)
    ctx.text("Press SPACE for fireworks!", 400, 680, { color: "#555", size: 16 })
  }
}

game.run(FireworkGame, { width: 1280, height: 720, fps: 60 })
```

---

## 3D Game Development

NTL ships a full CPU software rasterizer with optional GPU framebuffer output (`/dev/fb0` on Linux). No GPU driver setup required — it works in a terminal.

### First 3D Scene

```ntl
val game = require("ntl:game")

class My3DGame {
  constructor() {
    this.camera = new game.Camera({
      fov:      75,
      near:     0.1,
      far:      1000,
      position: { x: 0, y: 2, z: 5 }
    })

    this.renderer = new game.Renderer3D({
      width:  1280,
      height: 720,
      shading: "phong"     // "flat" | "phong" | "wireframe"
    })

    this.scene  = new game.Scene()
    this.clock  = new game.Clock()

    // Add a cube
    val cube = game.createCube({ size: 2, color: [0.8, 0.3, 0.3] })
    cube.position = { x: 0, y: 1, z: 0 }
    this.scene.add(cube)
    this.cube = cube

    // Add a plane
    val floor = game.createPlane({ width: 20, height: 20, color: [0.3, 0.6, 0.3] })
    floor.position = { x: 0, y: 0, z: 0 }
    this.scene.add(floor)

    // Lighting
    this.scene.addLight({ kind: "directional", direction: [-1, -2, -1], intensity: 1.0 })
    this.scene.addLight({ kind: "ambient", intensity: 0.3 })

    this.display = game.createDisplay(1280, 720)
  }

  update(dt, input) {
    // Rotate the cube
    this.cube.rotation.y += dt * 1.2
    this.cube.rotation.x += dt * 0.5

    // WASD camera movement
    val speed = 5 * dt
    if (input.w) { this.camera.moveForward(speed) }
    if (input.s) { this.camera.moveForward(-speed) }
    if (input.a) { this.camera.moveRight(-speed) }
    if (input.d) { this.camera.moveRight(speed) }

    // Mouse look
    if (input.mouse.dx !== 0 || input.mouse.dy !== 0) {
      this.camera.rotateYaw(input.mouse.dx * 0.002)
      this.camera.rotatePitch(input.mouse.dy * 0.002)
    }
  }

  render() {
    this.renderer.clear()
    this.scene.render(this.renderer, this.camera)
    this.display.flush(this.renderer.buffer, 1280, 720)
  }
}

game.run(My3DGame, { width: 1280, height: 720, fps: 60 })
```

### 3D FPS Game (Raycaster)

```ntl
val game = require("ntl:game")
val { Raycaster } = require("ntl:game/raycasting")

val MAP = [
  [1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,1],
  [1,0,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1]
]

class FPSGame {
  constructor() {
    this.raycaster = new Raycaster(MAP, { width: 1280, height: 720, fov: 66 })
    this.player    = { x: 2.5, y: 2.5, angle: 0 }
    this.display   = game.createDisplay(1280, 720)
    this.ui        = new game.UICanvas({ width: 1280, height: 720 })
  }

  update(dt, input) {
    val speed    = 3 * dt
    val turnSpeed = 2.5 * dt

    if (input.left)  { this.player.angle -= turnSpeed }
    if (input.right) { this.player.angle += turnSpeed }

    val dx = Math.cos(this.player.angle) * speed
    val dy = Math.sin(this.player.angle) * speed

    if (input.up) {
      val nx = this.player.x + dx
      val ny = this.player.y + dy
      if (MAP[Math.floor(ny)][Math.floor(nx)] === 0) {
        this.player.x = nx
        this.player.y = ny
      }
    }
    if (input.down) {
      val nx = this.player.x - dx
      val ny = this.player.y - dy
      if (MAP[Math.floor(ny)][Math.floor(nx)] === 0) {
        this.player.x = nx
        this.player.y = ny
      }
    }
  }

  render() {
    val frame = this.raycaster.render(this.player.x, this.player.y, this.player.angle)
    // Crosshair
    this.ui.fillRect(638, 358, 4, 4, "#ffffff")
    // Mini-map
    this.ui.drawMinimap(MAP, this.player, { x: 10, y: 10, scale: 12 })
    this.display.flush(frame, 1280, 720)
  }
}

game.run(FPSGame, { width: 1280, height: 720, fps: 60 })
```

### 3D Terrain Game

```ntl
val game    = require("ntl:game")
val { ProceduralTerrain } = require("ntl:game/terrain")

class TerrainExplorer {
  constructor() {
    this.camera   = new game.Camera({ fov: 80, position: { x: 0, y: 30, z: 0 } })
    this.renderer = new game.Renderer3D({ width: 1280, height: 720, shading: "phong" })
    this.scene    = new game.Scene()
    this.display  = game.createDisplay(1280, 720)

    val terrain = new ProceduralTerrain({
      seed:        42,
      size:        256,
      heightScale: 40,
      waterLevel:  8,
      octaves:     6
    })
    this.scene.add(terrain.mesh)
    this.scene.addLight({ kind: "directional", direction: [-1, -3, -1], intensity: 1.2 })
    this.scene.addLight({ kind: "ambient", intensity: 0.4 })

    this.yaw   = 0
    this.pitch = -0.4
  }

  update(dt, input) {
    val speed = 20 * dt
    if (input.w) { this.camera.moveForward(speed) }
    if (input.s) { this.camera.moveForward(-speed) }
    if (input.a) { this.camera.moveRight(-speed) }
    if (input.d) { this.camera.moveRight(speed) }
    if (input.left)  { this.yaw -= dt * 1.5 }
    if (input.right) { this.yaw += dt * 1.5 }
    this.camera.setRotation(this.pitch, this.yaw)
  }

  render() {
    this.renderer.clear()
    this.scene.render(this.renderer, this.camera)
    this.display.flush(this.renderer.buffer, 1280, 720)
  }
}

game.run(TerrainExplorer, { width: 1280, height: 720, fps: 60 })
```

### 3D Physics Simulation

```ntl
val game = require("ntl:game")
val { PhysicsWorld } = require("ntl:game/physics")

class PhysicsDemo {
  constructor() {
    this.camera   = new game.Camera({ fov: 75, position: { x: 0, y: 5, z: 15 } })
    this.renderer = new game.Renderer3D({ width: 1280, height: 720 })
    this.scene    = new game.Scene()
    this.display  = game.createDisplay(1280, 720)
    this.physics  = new PhysicsWorld({ gravity: -9.81 })

    // Floor
    val floor    = game.createPlane({ width: 30, height: 30, color: [0.4, 0.4, 0.4] })
    val floorBody = this.physics.addStatic(floor, { restitution: 0.5 })
    this.scene.add(floor)

    // Spawn boxes
    this.boxes = []
    var i = 0
    while (i < 15) {
      val box  = game.createCube({ size: 1, color: [Math.random(), Math.random(), Math.random()] })
      box.position = { x: (Math.random() - 0.5) * 10, y: 10 + i * 1.5, z: (Math.random() - 0.5) * 10 }
      val body = this.physics.addRigidBody(box, { mass: 1, restitution: 0.3 })
      this.scene.add(box)
      this.boxes.push({ mesh: box, body })
      i++
    }

    this.scene.addLight({ kind: "directional", direction: [-1, -2, -1], intensity: 1.0 })
    this.scene.addLight({ kind: "ambient", intensity: 0.35 })
  }

  update(dt) {
    this.physics.step(dt)
  }

  render() {
    this.renderer.clear()
    this.scene.render(this.renderer, this.camera)
    this.display.flush(this.renderer.buffer, 1280, 720)
  }
}

game.run(PhysicsDemo, { width: 1280, height: 720, fps: 60 })
```

### Game Engine Module Reference

| Module | Import | What It Does |
|--------|--------|-------------|
| Core runner | `require("ntl:game")` | `game.run()`, `Camera`, `Scene`, `Clock`, mesh builders |
| 3D Renderer | `require("ntl:game")` | `.Renderer3D` — Phong shading, z-buffer, up to 2K |
| Display | `require("ntl:game")` | `createDisplay()` — framebuffer / terminal / BMP |
| 2D UI | `require("ntl:game")` | `UICanvas` — text, rectangles, HUD drawing |
| Physics | `require("ntl:game/physics")` | `PhysicsWorld`, `RigidBody`, collision, impulse |
| Particles | `require("ntl:game/particles")` | `ParticleSystem` — burst, trail, gravity |
| Raycaster | `require("ntl:game/raycasting")` | Wolf3D-style FPS renderer |
| Tilemap | `require("ntl:game/tilemap")` | 2D grid, A* pathfinding, chunked rendering |
| Terrain | `require("ntl:game/terrain")` | Procedural heightmap, multi-octave noise |
| Animation | `require("ntl:game/animation")` | Skeletal, keyframe, blend trees |
| Camera | `require("ntl:game")` | FPS, orbit, follow, cinematic modes |
| Tweens | `require("ntl:game/tweens")` | Easing, chaining, parallel sequences |
| Audio | `require("ntl:game")` | Positional audio, music, sound effects |
| Input | `require("ntl:game")` | Keyboard, mouse, gamepad, touch |
| Debug | `require("ntl:game/debug")` | FPS counter, profiler, wireframe overlay |

**Resolution:** default **1280×720 (720p)**, max **2560×1440 (2K)**. Set with `game.run(MyGame, { width: 1920, height: 1080 })`.

---

## Real-World Systems

NTL handles real production workloads. Here are complete system patterns.

### REST API with Auth and Database

```ntl
val http   = require("ntl:http")
val db     = require("ntl:db")
val crypto = require("ntl:crypto")
val cache  = require("ntl:cache")

val database = db.connect("./app.db")

database.createTable("users", t => {
  t.id()
  t.text("email",    { unique: true })
  t.text("password_hash")
  t.text("role",     { default: "user" })
  t.timestamps()
})

val Users = database.model("users", { timestamps: true })

val router = new http.Router()

router.use(http.cors({ origin: ["https://myapp.com"] }))
router.use(http.rateLimit({ windowMs: 60000, max: 100 }))

async fn requireAuth(req, res, next) {
  val token = (req.headers["authorization"] || "").replace("Bearer ", "")
  if (!token) { return res.status(401).json({ error: "Unauthorized" }) }
  val payload = crypto.verifyJWT(token, process.env.JWT_SECRET)
  if (!payload) { return res.status(401).json({ error: "Invalid token" }) }
  req.user = payload
  next()
}

router.post("/auth/register", async (req, res) => {
  val { email, password } = req.body
  if (!email || !password) { return res.status(400).json({ error: "Email and password required" }) }
  val existing = Users.findBy("email", email)
  if (existing) { return res.status(409).json({ error: "Email already registered" }) }
  val hash = await crypto.hashPassword(password)
  val user = Users.create({ email, password_hash: hash, role: "user" })
  val token = crypto.signJWT({ id: user.id, email, role: user.role }, process.env.JWT_SECRET, "7d")
  res.status(201).json({ token, user: { id: user.id, email, role: user.role } })
})

router.post("/auth/login", async (req, res) => {
  val { email, password } = req.body
  val user = Users.findBy("email", email)
  if (!user) { return res.status(401).json({ error: "Invalid credentials" }) }
  val ok = await crypto.verifyPassword(password, user.password_hash)
  if (!ok)   { return res.status(401).json({ error: "Invalid credentials" }) }
  val token = crypto.signJWT({ id: user.id, email, role: user.role }, process.env.JWT_SECRET, "7d")
  res.json({ token })
})

router.get("/users/me", requireAuth, (req, res) => {
  val user = Users.find(req.user.id)
  res.json(user)
})

router.get("/users", requireAuth, (req, res) => {
  if (req.user.role !== "admin") { return res.status(403).json({ error: "Admin only" }) }
  val page  = parseInt(req.query.page  || "1")
  val limit = parseInt(req.query.limit || "20")
  val result = Users.paginate(page, limit)
  res.json(result)
})

http.listen(3000, router, () => log "API running at http://localhost:3000")
```

### Real-Time Chat Server (WebSocket)

```ntl
val http = require("ntl:http")
val ws   = require("ntl:ws")

val router  = new http.Router()
val wss     = new ws.WebSocketServer()
val rooms   = new Map()

router.get("/", (req, res) => {
  res.html("<h1>NTL Chat</h1><p>Connect via WebSocket on /ws</p>")
})

wss.attach(http.createServer(router))

wss.on("connection", (client) => {
  log "Client connected:", client.id

  client.on("message", (msg) => {
    if (!msg || !msg.type) { return }

    if (msg.type === "join") {
      wss.join(client, msg.room)
      client.room = msg.room
      client.name = msg.name || "Anonymous"
      wss.to(msg.room).sendJSON({ type: "system", text: client.name + " joined" })
    }

    if (msg.type === "chat" && client.room) {
      wss.to(client.room).sendJSON({
        type: "chat",
        name: client.name,
        text: msg.text,
        time: Date.now()
      })
    }
  })

  client.on("close", () => {
    if (client.room) {
      wss.leave(client, client.room)
      wss.to(client.room).sendJSON({ type: "system", text: client.name + " left" })
    }
  })
})

http.listen(3000, router, () => log "Chat server at http://localhost:3000")
```

### Background Job Queue

```ntl
val { EventEmitter } = require("ntl:events")
val db     = require("ntl:db")
val logger = require("ntl:logger")

val log = logger.createLogger("JOBS")

class JobQueue extends EventEmitter {
  constructor(name, options) {
    super()
    this.name      = name
    this._db       = db.connect("./jobs.db")
    this._interval = (options || {}).pollMs || 1000
    this._handlers = new Map()
    this._running  = false

    this._db.createTable("jobs_" + name, t => {
      t.id()
      t.text("jobType")
      t.text("payload",   { default: "{}" })
      t.text("status",    { default: "pending" })
      t.integer("attempts", { default: 0 })
      t.text("error",     { nullable: true })
      t.timestamps()
    })
  }

  handle(jobType, handlerFn) {
    this._handlers.set(jobType, handlerFn)
    return this
  }

  async enqueue(jobType, payload) {
    return this._db.table("jobs_" + this.name).insert({
      jobType,
      payload: JSON.stringify(payload || {})
    })
  }

  start() {
    if (this._running) { return }
    this._running = true
    this._poll()
    log.info("Queue started:", this.name)
    return this
  }

  stop() { this._running = false; return this }

  async _poll() {
    while (this._running) {
      val job = this._db.table("jobs_" + this.name).where("status", "=", "pending").orderBy("id").first()
      if (job) {
        await this._process(job)
      } else {
        await new Promise(res => setTimeout(res, this._interval))
      }
    }
  }

  async _process(job) {
    this._db.table("jobs_" + this.name).where("id", "=", job.id).update({ status: "running" })
    try {
      val handler = this._handlers.get(job.jobType)
      if (!handler) { throw new Error("No handler for job type: " + job.jobType) }
      await handler(JSON.parse(job.payload))
      this._db.table("jobs_" + this.name).where("id", "=", job.id).update({ status: "done" })
      this.emit("done", job)
      log.info("Job done:", job.jobType, job.id)
    } catch (err) {
      val attempts = job.attempts + 1
      val status   = attempts >= 3 ? "failed" : "pending"
      this._db.table("jobs_" + this.name).where("id", "=", job.id).update({
        status, attempts, error: err.message
      })
      this.emit("error", job, err)
      log.error("Job failed:", job.jobType, err.message)
    }
  }
}

val queue = new JobQueue("emails")

queue.handle("send-welcome", async (payload) => {
  val mail = require("ntl:mail")
  val smtp = new mail.SMTPClient({ host: "smtp.example.com", port: 587, user: "no-reply@example.com", pass: process.env.SMTP_PASS })
  await smtp.send({ to: payload.email, subject: "Welcome!", html: "<h1>Welcome to our app!</h1>" })
})

queue.start()

// Enqueue a job from elsewhere:
// await queue.enqueue("send-welcome", { email: "user@example.com" })
```

### CLI Tool

```ntl
val fs     = require("ntl:fs")
val crypto = require("ntl:crypto")

val args    = process.argv.slice(2)
val command = args[0]

val COMMANDS = {
  init:    cmdInit,
  hash:    cmdHash,
  encrypt: cmdEncrypt,
  decrypt: cmdDecrypt,
  help:    cmdHelp
}

fn cmdInit() {
  val projectName = args[1] || "my-app"
  fs.mkdir("./" + projectName)
  fs.mkdir("./" + projectName + "/src")
  fs.writeJson("./" + projectName + "/ntl.json", {
    name:    projectName,
    version: "1.0.0",
    entry:   "src/main.ntl"
  })
  fs.write("./" + projectName + "/src/main.ntl", 'log "Hello from " + "' + projectName + '"')
  log "Created project:", projectName
}

fn cmdHash() {
  val input = args[1]
  if (!input) { log "Usage: mytool hash <input>"; process.exit(1) }
  log "SHA-256:", crypto.sha256(input)
  log "MD5:    ", crypto.md5(input)
}

async fn cmdEncrypt() {
  val file = args[1]; val key = args[2]
  if (!file || !key) { log "Usage: mytool encrypt <file> <key>"; process.exit(1) }
  val data = fs.read(file)
  val enc  = crypto.aesEncrypt(data, key)
  fs.write(file + ".enc", enc)
  log "Encrypted:", file + ".enc"
}

async fn cmdDecrypt() {
  val file = args[1]; val key = args[2]
  if (!file || !key) { log "Usage: mytool decrypt <file.enc> <key>"; process.exit(1) }
  val data = fs.read(file)
  val dec  = crypto.aesDecrypt(data, key)
  fs.write(file.replace(".enc", ".dec"), dec)
  log "Decrypted:", file.replace(".enc", ".dec")
}

fn cmdHelp() {
  log "Usage: mytool <command> [args]"
  log "Commands: init, hash, encrypt, decrypt, help"
}

val handler = COMMANDS[command]
if (handler) {
  val result = handler()
  if (result && typeof result.then === "function") {
    result.catch(e => { log "Error:", e.message; process.exit(1) })
  }
} else {
  log "Unknown command:", command
  cmdHelp()
  process.exit(1)
}
```


---

## Built-in Modules

### ntl:http

```ntl
val http = require("ntl:http")
val {Router, cors, rateLimit, staticFiles, listen} = require("ntl:http")
```

**Router**

```ntl
val router = new http.Router()

router.get("/path", handler)
router.post("/path", handler)
router.put("/path", handler)
router.delete("/path", handler)
router.patch("/path", handler)
router.all("/path", handler)

// URL params
router.get("/users/:id/posts/:postId", (req, res) => {
  log req.params.id, req.params.postId
})

// Chained middleware
router.post("/admin", verifyLogin, verifyAdmin, handleRequest)

router.onError((err, req, res) => {
  res.status(500).json({error: err.message})
})

router.notFound((req, res) => {
  res.status(404).json({error: "Not found"})
})
```

**Request** (`req`):

```ntl
req.method         // "GET" | "POST" | ...
req.path           // "/users/1"
req.params         // { id: "1" }     (URL params)
req.query          // { page: "2" }   (query string)
req.body           // parsed JSON or string
req.headers        // { authorization: "Bearer ..." }
req.ip             // client IP
req.get("header")  // header by name (case-insensitive)
req.cookies        // { session: "abc" }
```

**Response** (`res`):

```ntl
res.status(201).json({created: true})
res.send("text")
res.html("<h1>Hello</h1>")
res.redirect("/new-path")
res.redirect(301, "/permanent")
res.set("X-Custom", "value")
res.cookie("token", value, {httpOnly: true, secure: true, maxAge: 86400})
res.clearCookie("token")
res.download("/path/file.pdf")
res.sendFile("/path/index.html")
res.end()
```

**Middleware**:

```ntl
router.use(http.cors({
  origin:      ["https://mysite.com"],
  credentials: true
}))

router.use(http.rateLimit({
  windowMs: 60000,
  max:      100,
  message:  "Too many requests"
}))

router.use(http.staticFiles("./public"))
router.use("/assets", http.staticFiles("./assets", {cache: 3600}))
```

**Start server**:

```ntl
http.listen(3000, router, () => log "Running at http://localhost:3000")

http.listenHTTPS(443, router, {
  key:  fs.read("./ssl/key.pem"),
  cert: fs.read("./ssl/cert.pem")
})

val server = http.createServer(router)
server.listen(3000)
```

**HTTP Client**:

```ntl
val res  = await http.fetch("https://api.github.com/users/octocat")
val res  = await http.get("https://api.example.com/data")
val res  = await http.post("https://api.example.com/users", {name: "Alice"})
val res  = await http.put("https://api.example.com/users/1", {name: "Alice"})
val res  = await http.delete("https://api.example.com/users/1")
val res  = await http.patch("https://api.example.com/users/1", {active: false})

// With options
val res  = await http.fetch("https://api.example.com/data", {
  method:  "POST",
  headers: {"Authorization": "Bearer {TOKEN}"},
  body:    {key: "value"},
  timeout: 5000
})
log res.status   // 200
log res.data     // parsed JSON
log res.headers
```

---

### ntl:db

SQLite database with immutable query builder and ORM. Uses Node.js built-in `node:sqlite` — zero npm dependencies.

```ntl
val {Database} = require("ntl:db")
val db = new Database("./app.db")     // file
val db = new Database(":memory:")     // in-memory
```

**Create Tables**:

```ntl
db.createTable("users", (t) => {
  t.id()                                     // INTEGER PRIMARY KEY AUTOINCREMENT
  t.text("name")
  t.text("email", {unique: true})
  t.text("bio",   {nullable: true})
  t.text("role",  {default: "user"})
  t.integer("age")
  t.real("balance",   {default: 0.0})
  t.boolean("active", true)
  t.json("settings")
  t.timestamps()                             // created_at, updated_at
  t.softDelete()                             // deleted_at
  t.references("user_id", "users", "id")    // FK with CASCADE
  t.index("email")
  t.unique("email", "role")
})
```

**Query Builder** (every method returns a new instance — immutable):

```ntl
val q = db.table("users")

// Read
q.all()
q.first()
q.find(id)                    // by primary key
q.findOrFail(id)

// Select columns
q.select("name", "email").all()
q.distinct().select("country").all()

// WHERE
q.where("active", 1).all()
q.where("age", ">", 18).all()
q.where("name", "LIKE", "Ali%").all()
q.whereIn("role", ["admin", "editor"]).all()
q.whereNotIn("status", ["banned"]).all()
q.whereBetween("age", 18, 65).all()
q.whereNull("deleted_at").all()
q.whereNotNull("email_verified_at").all()

// Ordering / Pagination
q.orderBy("name").all()
q.orderByDesc("created_at").all()
q.limit(10).offset(20).all()
q.paginate(1, 20)
// returns { data, total, page, perPage, totalPages, hasNext, hasPrev }

// Aggregations
q.count()
q.sum("balance")
q.avg("age")
q.min("age")
q.max("balance")
q.exists()
q.pluck("email")

// Joins
q.join("posts", "users.id", "=", "posts.user_id").all()
q.leftJoin("profiles", "users.id", "=", "profiles.user_id").all()

// Mutations
q.insert({name: "Alice", email: "alice@example.com"})
q.insertMany([{name: "Bob"}, {name: "Carol"}])
q.where("id", 1).update({name: "Alice Smith"})
q.upsert({email: "alice@x.com", name: "Alice"}, ["email"])
q.where("id", 5).delete()
```

**Models (ORM)**:

```ntl
val Users = db.model("users", {
  hidden:     ["password_hash"],
  timestamps: true,
  softDelete: true,
  casts: {
    active:   "boolean",
    balance:  "number",
    settings: "json",
    created:  "date"
  }
})

Users.all()
Users.find(id)
Users.findOrFail(id)
Users.findBy("email", "alice@x.com")
Users.where("active", 1).all()
Users.create({name: "Alice", email: "alice@x.com"})
Users.createMany([{name: "Bob"}, {name: "Carol"}])
Users.update(id, {name: "Alice Smith"})
Users.updateOrCreate({email: "alice@x.com"}, {name: "Alice"})
Users.delete(id)
Users.restore(id)
Users.count()
Users.paginate(1, 20)
```

**Transactions**:

```ntl
db.transaction(() => {
  db.table("accounts").where("id", 1).update({balance: 900})
  db.table("accounts").where("id", 2).update({balance: 1100})
})

await db.transaction(async () => {
  val id = db.table("orders").insert({user_id: 1, total: 99.90})
  for val item of cart { db.table("order_items").insert({order_id: id, ...item}) }
})
```

**Migrations**:

```ntl
db.migration(1, () => {
  db.createTable("users", (t) => { t.id(); t.text("name"); t.timestamps() })
})
db.migration(2, () => {
  db.exec("ALTER TABLE users ADD COLUMN phone TEXT")
})

db.migrate()     // run pending
db.rollback()    // revert last
```

---

### ntl:crypto

```ntl
val crypto = require("ntl:crypto")

// Hashing
crypto.sha256("text")          // hex string
crypto.sha512("text")
crypto.sha1("text")
crypto.md5("text")

crypto.hmacSha256("key", "message")
crypto.hmacSha512("key", "message")

// Random
crypto.randomBytes(16)         // hex string (32 chars)
crypto.randomInt(0, 100)
crypto.uuid()                  // UUID v4

// AES encryption
val cipher = crypto.encryptAES("my secret", "password")
val plain  = crypto.decryptAES(cipher, "password")

// JWT
val token   = crypto.signJWT({userId: 42, role: "admin"}, "secret", 3600)
val payload = crypto.verifyJWT(token, "secret")
// payload = { userId: 42, role: "admin", iat: ..., exp: ... }

// Password hashing (PBKDF2 with random salt)
val hash = crypto.hashPassword("mypassword")
crypto.verifyPassword("mypassword", hash)   // true

// Base64
crypto.base64Encode("text")
crypto.base64Decode("dGV4dA==")
crypto.base64UrlEncode("data")
crypto.base64UrlDecode("ZGF0YQ")
crypto.constantTimeEqual("a", "a")          // timing-safe compare
```

---

### ntl:env

```ntl
val {Env} = require("ntl:env")
val env   = new Env({files: [".env", ".env.local"]})

env.str("NAME", "default")
env.int("PORT", 3000)
env.float("RATE", 0.05)
env.bool("DEBUG", false)
env.list("ORIGINS", ",")       // "a,b,c" → ["a","b","c"]
env.json("CONFIG_JSON")
env.url("API_URL")
env.require("DATABASE_URL")    // throws if missing
env.has("KEY")
env.set("KEY", "value")
env.all()

// Shorthand properties
env.port       // int("PORT", 3000)
env.nodeEnv    // str("NODE_ENV", "development")
env.isDev
env.isProd
env.isTest
env.jwtSecret

// Schema validation
env.schema({
  PORT:         {type: "number", required: true},
  NODE_ENV:     {type: "string", oneOf: ["development","production","test"]},
  DATABASE_URL: {required: true}
}).validate()
```

**.env file:**

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=sqlite:./app.db
JWT_SECRET=super_secret_key
DEBUG=false
CORS_ORIGINS=https://mysite.com,https://app.mysite.com
```

---

### ntl:cache

```ntl
val {Cache, cache, ns} = require("ntl:cache")

val c = new Cache({maxSize: 1000, ttl: 300000})

c.set("key", value)
c.set("key", value, 60000)     // TTL override
c.get("key")                   // value | null
c.has("key")
c.delete("key")
c.clear()
c.size()
c.stats()                      // { hits, misses, sets, deletes, size }

// Get or fill
val user = await c.getOrSet("user:{id}", async () => {
  return await db.table("users").find(id)
}, 60000)

// Pattern delete
c.deletePattern("user:*")

// Namespaced
val usersCache = ns("users")
usersCache.set("1", userData)  // stored as "users:1"
usersCache.clear()             // clears only "users:*"

// Memoize a function
val getCachedUser = c.wrap(
  async (id) => db.table("users").find(id),
  (id) => "user:{id}",
  120000
)
```

---

### ntl:validate

```ntl
val {object, string, number, boolean, array, union, literal, any} = require("ntl:validate")

val userSchema = object({
  name:  string().min(2).max(100),
  email: string().email(),
  age:   number().min(0).optional(),
  role:  union(literal("admin"), literal("editor"), literal("user")).default("user"),
  tags:  array(string()).optional()
})

// Safe parse (never throws)
val result = userSchema.safeParse(req.body)
if result.success {
  log result.data.role    // "user" (default applied)
} else {
  res.status(400).json({errors: result.errors})
  // errors = [{ path: "email", message: "must be a valid email" }, ...]
}

// Direct parse (throws ValidationError)
try {
  val data = userSchema.parse(req.body)
} catch e {
  res.status(400).json({errors: e.errors})
}

// All validators
string().min(2).max(100).email().url().uuid().regex(/pattern/)
  .startsWith("prefix").endsWith("suffix").includes("str")
  .lowercase().uppercase().trim().optional().nullable().default("value")

number().min(0).max(100).integer().positive().negative().multipleOf(5)

array(string()).min(1).max(50).unique().nonempty()

object({...}).allowUnknown().stripUnknown()
```

---

### ntl:logger

```ntl
val {Logger} = require("ntl:logger")
val log = new Logger({name: "app", level: 1, showTime: true, logFile: "./app.log"})

// Levels: 0=DEBUG 1=INFO 2=WARN 3=ERROR 4=FATAL
log.debug("Checking config")
log.info("Server started on port", 3000)
log.warn("Memory high:", process.memoryUsage().heapUsed)
log.error("Connection failed:", err.message)
log.fatal("Critical — shutting down")   // calls process.exit(1)

// Timers
log.time("db-query")
doQuery()
log.timeEnd("db-query")

// Child logger
val dbLog = log.child({name: "db"})
dbLog.info("Query executed")   // [INFO] [db] ...

log.table([{name: "Alice", active: true}, {name: "Bob", active: false}])
log.setLevel("warn")
log.close()
```

---

### ntl:events

```ntl
val {EventEmitter, bus} = require("ntl:events")
val emitter = new EventEmitter()

emitter.on("event", handler)
emitter.once("event", handler)
emitter.off("event", handler)
emitter.emit("event", data)
await emitter.emitAsync("event", data)
await emitter.emitParallel("event", data)

emitter.on("request", logger,  {priority: 10})
emitter.on("request", auth,    {priority: 5})
emitter.on("request", process, {priority: 0})

val result = await emitter.waitFor("done", 5000)

// Global event bus
bus.on("user:created", async (user) => { await sendWelcomeEmail(user) })
bus.emit("user:created", {id: 1, name: "Alice"})

// Namespaced bus
val userBus = bus.namespace("user")
userBus.on("created", handler)
userBus.emit("created", data)
```

---

### ntl:queue

```ntl
val {Queue, create} = require("ntl:queue")
val queue = create("jobs", {concurrency: 5})

// Add jobs
queue.add("send-email", {to: "alice@x.com", subject: "Hi"})
queue.add("resize-image", {file: "photo.jpg"}, {
  priority: 10,
  delay:    5000,
  retries:  3,
  timeout:  30000
})

// Process
queue.process("send-email", async (data, ctx) => {
  ctx.progress(50)
  await smtp.send(data)
  return {sent: true}
})

// Events
queue.on("completed", (job, result) => { log "Done:", job.id })
queue.on("failed",    (job, error)  => { log "Failed:", error.message })

queue.pause()
queue.resume()
await queue.drain()
queue.stats()    // { pending, active, completed, failed }
```

---

### ntl:ws

```ntl
val {WebSocketServer, WebSocketClient} = require("ntl:ws")

// Server
val wss = new WebSocketServer({path: "/"})
val server = http.createServer(router)
wss.attach(server)

wss.on("connection", (socket) => {
  socket.send("Welcome!")
  socket.sendJSON({type: "connected", id: socket.id})

  socket.on("message", (data) => {
    wss.broadcastJSON({from: socket.id, data})
  })

  socket.on("close", () => { log "Disconnected:", socket.id })
  socket.startHeartbeat(30000, 10000)
})

wss.broadcast("announcement")
wss.broadcastJSON({type: "update"})

// Rooms
wss.join(socket, "room-1")
wss.leave(socket, "room-1")
wss.to("room-1").sendJSON({type: "room-message", text: "Hello room"})

// Client
val client = new WebSocketClient("ws://localhost:3000", {
  reconnect: true,
  reconnectDelay: 2000
})

client.connect()
client.on("open", () => { client.sendJSON({type: "hello"}) })
client.on("message", (data) => { log data })
client.close()
```

---

### ntl:mail

```ntl
val {createTransport} = require("ntl:mail")
val mailer = createTransport({
  host: "smtp.gmail.com",
  port: 587,
  user: "me@gmail.com",
  pass: "app_password",
  from: "My App <me@gmail.com>"
})

await mailer.send({
  to:      "alice@example.com",
  subject: "Welcome!",
  text:    "Hello Alice, welcome aboard.",
  html:    "<h1>Welcome!</h1>"
})

await mailer.template(
  "alice@example.com",
  "Reset Password",
  "<p>Hi {{name}}, <a href='{{url}}'>click here</a> to reset.</p>",
  {name: "Alice", url: "https://mysite.com/reset/abc123"}
)

// Fake transport for tests
val {FakeTransport} = require("ntl:mail")
val fake = new FakeTransport()
await fake.send({to: "test@x.com", subject: "Test", text: "Hi"})
fake.sent   // [{ to, subject, text }]
fake.last()
fake.clear()
```

---

### ntl:fs

> **Implemented using raw OS bindings** — does not use Node.js `require('fs')` internally. Uses `process.binding('fs')` directly for maximum portability and minimal overhead.

```ntl
val fs = require("ntl:fs")

// Read
fs.read("file.txt")
await fs.readAsync("file.txt")
fs.readJson("config.json")
fs.readLines("data.txt")

// Write
fs.write("file.txt", "content")
await fs.writeAsync("file.txt", "content")
fs.append("log.txt", "new line\n")
fs.writeJson("config.json", obj)

// Operations
fs.exists("/path/file")
fs.stat("/path/file")      // { size, isFile, isDirectory, created, modified }
fs.remove("/path")         // file or directory (recursive)
fs.move("/src", "/dst")
fs.copy("/src", "/dst")
fs.mkdir("/new/dir")

// List
fs.list("/dir")
fs.listFull("/dir")
fs.glob("**/*.ntl", "/project")
fs.walk("/dir", (path, entry) => { ... })

// Paths
fs.join("/a", "b", "c")        // "/a/b/c"
fs.resolve("./relative")        // absolute path
fs.dirname("/a/b/c.txt")       // "/a/b"
fs.basename("/a/b/c.txt")      // "c.txt"
fs.extension("file.ntl")       // "ntl"
fs.cwd()
fs.home()
fs.tmpDir()
fs.tmpFile("prefix", ".json")
```

---

### ntl:test

```ntl
val {suite, test, run, assert} = require("ntl:test")

suite("Users API", (s) => {
  s.before(async () => { await db.connect() })
  s.after(async () => { await db.close() })
  s.beforeEach(() => { db.clear() })

  s.test("create user", async (t) => {
    val user = Users.create({name: "Alice", email: "alice@x.com"})
    t.ok(user.id)
    t.equal(user.name, "Alice")
    t.type(user.active, "boolean")
  })

  s.skip("not implemented yet", () => {})
  s.only("debug this test", () => {})
})

test("math", (t) => { t.equal(1 + 1, 2) })

await run()
```

**Assertions:**

```ntl
t.equal(actual, expected)
t.notEqual(actual, expected)
t.deepEqual(objA, objB)
t.ok(value)                        // truthy
t.notOk(value)                     // falsy
t.type(value, "string")
t.type(value, "array")
t.throws(() => badFn())
await t.asyncThrows(async () => await badAsync())
t.match("hello world", /hello/)
t.includes([1,2,3], 2)
t.closeTo(0.1 + 0.2, 0.3, 0.001)
```

---

### ntl:ai

```ntl
val {createAI, openai, anthropic, claude, ollama, groq, VectorStore} = require("ntl:ai")

val ai = createAI({
  provider: "anthropic",
  apiKey:   env.require("ANTHROPIC_API_KEY"),
  system:   "You are a helpful assistant."
})
// or
val ai = openai({apiKey: "sk-..."})
val ai = claude({apiKey: "sk-ant-..."})
val ai = ollama({baseUrl: "http://localhost:11434", model: "llama3.1"})
val ai = groq({apiKey: "gsk_..."})

// Single question
val answer = await ai.ask("What is NTL?")

// Multi-turn conversation (keeps history)
await ai.converse("My name is Alice.")
await ai.converse("What's my name?")   // "Alice"

// Streaming
await ai.stream("Write a story", (token) => process.stdout.write(token))

// Structured JSON output
val data = await ai.json(
  "Extract: Alice, 30 years old, from New York",
  {name: "string", age: "number", city: "string"}
)

// Classify text
val category = await ai.classify("Love this!", ["positive","negative","neutral"])

// Summarize, translate, extract
val summary     = await ai.summarize(longText, {maxLength: 100})
val translated  = await ai.translate("Hello", "spanish")
val extracted   = await ai.extract(text, {name: "string", phone: "string"})

// RAG (Retrieval-Augmented Generation)
val store = new VectorStore()
store.add("NTL compiles to JavaScript.")
store.add("Use ntl:db for SQLite databases.")
await store.embedAll(ai)
val results = await store.retrieve(ai, "How to use the database?", 3)
val context = results.map(r => r.doc.text).join("\n")
val answer  = await ai.ask("Context:\n{context}\n\nQuestion: How to use database?")
```

---

### ntl:web

```ntl
val {el, html, page, raw, escapeHtml, renderToString, component} = require("ntl:web")
val {useState, useEffect} = require("ntl:web")

// HTML generation
val link  = el.a({href: "/about", className: "nav"}, "About")
val card  = el.div({className: "card"},
  el.h2("Title"),
  el.p("Description")
)

// Full HTML page
res.html(web.page({
  title:   "My App",
  lang:    "en",
  styles:  ["/css/app.css"],
  scripts: ["/js/app.js"],
  body:    el.div({id: "root"}).value
}))

// Components with hooks
val Counter = component((props) => {
  val [count, setCount] = useState(0)
  return el.div(
    el.h2("Count: {count}"),
    el.button({onclick: () => setCount(c => c+1)}, "+")
  )
})

val html = renderToString(Counter, {})

// Utilities
web.slugify("My Amazing Title!")    // "my-amazing-title"
web.truncate("long text...", 50)
web.wordCount("hello world")        // 2
web.readTime("long article...")     // minutes estimate
web.markdown("# Title\n**bold**")   // HTML
web.qs({page: 2, q: "ntl"})        // "page=2&q=ntl"
web.parseQs("?page=2&q=ntl+lang")  // {page:"2", q:"ntl lang"}
```

---

### ntl:game

NTL ships with a production-grade 3D game engine — written entirely in NTL, zero external dependencies.
The engine targets GPU-accelerated rendering as the primary path: pixels are written directly to the GPU framebuffer via `/dev/fb0`, giving you hardware-backed output with no browser, no Electron, no Vulkan boilerplate. A high-fidelity CPU software rasterizer serves as the fallback and offline-render path, delivering full Phong shading, per-pixel specular, and correct perspective. Maximum supported resolution is **2K (2560×1440)**. Default resolution is **720p (1280×720)**.

The result: **a game engine that runs in a terminal, on Android (Termux), on embedded Linux, on a Raspberry Pi, or as a headless renderer — and still produces better-looking output than most Node.js game libraries.**

**Source layout** (`modules/ntl/game/`):

```
ntl/game/
├── core/
│   ├── math3d.ntl       Vec3, Vec4, Mat4, Quaternion, math utilities
│   ├── color.ntl        Color — HDR, HSL, hex, lerp, alpha
│   └── geometry.ntl     Mesh, Geometry — cube/sphere/plane/cylinder/cone/torus/custom
├── rendering/
│   ├── renderer.ntl     Renderer3D — GPU framebuffer + GPU-accelerated renderer, z-buffer, Phong shading
│   └── display.ntl      FramebufferDisplay (GPU), TerminalDisplay (ANSI), FileDisplay (BMP)
├── scene/
│   ├── scene.ntl        Scene graph, SceneNode, Camera3D, Light, Material, Transform3D
│   └── camera.ntl       FPSController, OrbitController, FollowController, FlyController, CameraShake
├── physics/
│   └── physics.ntl      PhysicsWorld, RigidBody, BoxCollider, SphereCollider, impulse resolution
├── input/
│   └── input.ntl        InputSystem — raw keyboard, WASD, axes, mouse, callbacks
├── audio/
│   └── audio.ntl        AudioSystem, AudioTone (procedural WAV generator)
├── ui/
│   └── ui.ntl           UICanvas, Panel, Label, Button, ProgressBar, Slider, Checkbox, TextInput
├── fx/
│   ├── tween.ntl        TweenManager, Tween, 24 Easing functions
│   ├── particles.ntl    ParticleEmitter, ParticleSystem, fire/smoke/explosion presets
│   └── animation.ntl    AnimationClip, AnimationTrack, Animator, AnimationStateMachine
├── world/
│   └── tilemap.ntl      Tilemap (grid + A* pathfinding), Heightmap (procedural noise terrain)
├── utils/
│   ├── raycast.ntl      Ray, Raycaster, AABB — screen-to-world, mesh picking
│   └── debug.ntl        DebugDraw (3D lines/boxes/spheres), FPS graph, Profiler
└── engine/
    ├── activity.ntl     Activity lifecycle base class
    └── engine.ntl       GameEngine, fixed-timestep loop, run() entrypoint
```

---

#### Getting started

```ntl
val game = require("ntl:game")

class MyGame extends game.Activity {
  fn onCreate() {
    this._cam = this.scene.camera
    this._orbit = new game.OrbitController(this._cam, { distance: 8 })
    this.addLight("directional", -0.5, -1, -0.7, 255, 245, 220, 1.3)

    val mat  = new game.Material({ r: 60, g: 130, b: 240, shininess: 80 })
    val mesh = game.Geometry.cube(1.5)
    this._cube = new game.SceneNode({ mesh, material: mat })
    this.scene.add(this._cube)

    this._ui  = new game.UICanvas({ width: 1280, height: 720 })
    this._ui.attachInput(this.input)
    val panel = this._ui.createPanel(10, 10, 220, 100, { radius: 8 })
    this._hp  = new game.ProgressBar({ x: 10, y: 20, w: 190, h: 18, value: 1.0, label: "HP" })
    panel.add(this._hp)

    this._tw  = new game.TweenManager()
    this._fire = game.fireEmitter(0, 2, 0)
  }

  fn onUpdate(dt) {
    this._orbit.update(this.input, dt)
    this._tw.update(dt)
    this._fire.update(dt)
    this._ui.update(this.input)
    if (this.input.wasPressed("Escape")) { this.quit() }
  }

  fn onRender() {
    this.scene.render(this.renderer)
    this._fire.render(this.renderer, this.scene.camera)
    this._ui.attachRenderer(this.renderer.buffer, this.renderer.width, this.renderer.height)
    this._ui.render()
    this.display.flush(this.renderer.buffer, this.renderer.width, this.renderer.height)
  }
}

game.run(MyGame, { width: 1280, height: 720, fps: 60 })
```

Run with: `ntl run game.ntl`

---

#### Activity lifecycle

| Method | When it fires |
|---|---|
| `onCreate()` | Engine initialized. Build your scene here. |
| `onStart()` | After onCreate, before first frame. |
| `onResume()` | After pause resumes. |
| `onUpdate(dt)` | Every frame. `dt` is delta time in seconds. |
| `onRender()` | Every frame, after update. Write your render calls here. |
| `onPause()` | Game paused. |
| `onStop()` | Engine stopping. |
| `onDestroy()` | Final cleanup. |

#### Built-in subsystems on `this.*`

| Property | Type | Description |
|---|---|---|
| `this.scene` | `Scene` | 3D scene graph |
| `this.renderer` | `Renderer3D` | GPU/GPU-accelerated renderer |
| `this.display` | `Display` | Output backend (GPU fb / terminal / file) |
| `this.input` | `InputSystem` | Keyboard + mouse |
| `this.audio` | `AudioSystem` | Audio playback |
| `this.physics` | `PhysicsWorld` | Rigid body simulation |
| `this.engine` | `GameEngine` | Engine state, FPS, frame count |

---

#### Rendering — GPU-first, CPU fallback

NTL's renderer writes directly to the Linux GPU framebuffer (`/dev/fb0`) — no windowing system, no driver overhead. On systems without a framebuffer, it falls back to a full CPU software rasterizer with per-pixel Phong shading and a hardware-quality result. Both paths share the same API.

```ntl
fn onRender() {
  this.scene.render(this.renderer)
  this.display.flush(this.renderer.buffer, this.renderer.width, this.renderer.height)
}
```

Display auto-detection priority: `GPU framebuffer → ANSI terminal → BMP file`.

**Resolution:** default **1280×720 (720p)**, configurable up to **2560×1440 (2K)**. Higher resolutions require adequate GPU framebuffer memory.

The `Renderer3D` supports:
- Full triangle rasterization with barycentric coordinates
- Z-buffer depth testing and backface culling
- Per-pixel Phong shading: ambient + diffuse + specular
- Perspective-correct normal and position interpolation
- Directional and point lights with distance attenuation
- Skybox gradient background
- Render statistics: triangles, draw calls, frame time

---

#### Camera controllers

Five ready-to-use camera modes. Attach any one per frame, swap at runtime.

```ntl
val cam = this.scene.camera

val orbit = new game.OrbitController(cam, {
  distance: 8,
  minDist: 2, maxDist: 50,
  phi: 0.8,
  rotateSpeed: 0.005
})
orbit.update(this.input, dt)

val fps = new game.FPSController(cam, {
  moveSpeed: 5.0,
  sprintMult: 2.5,
  jumpForce: 5.0,
  eyeHeight: 1.7
})
fps.setPosition(0, 1.7, 5)
fps.update(this.input, dt)

val follow = new game.FollowController(cam, {
  target: this._player,
  offset: { x: 0, y: 3, z: 6 },
  smoothSpeed: 5.0
})
follow.update(this.input, dt)

val fly = new game.FlyController(cam, { speed: 8, fastSpeed: 25 })
fly.update(this.input, dt)

val shake = new game.CameraShake(cam)
shake.shake(0.3, 0.5)
shake.update(dt)
```

---

#### UI — pixel-perfect, rendered on GPU

The UI system renders directly into the pixel buffer — no DOM, no canvas, no dependencies. Every widget is anti-aliased, composited with alpha, and interactive.

```ntl
val ui = new game.UICanvas({ width: 1280, height: 720 })
ui.attachInput(this.input)

val panel = ui.createPanel(x, y, w, h, {
  r: 20, g: 20, b: 35, alpha: 200, radius: 8, border: true
})

val lbl = new game.Label({ x: 10, y: 10, text: "Score: 0",
  r: 255, g: 255, b: 100, scale: 2, align: "center", w: 200 })
panel.add(lbl)
lbl.setText("Score: 100")

val btn = new game.Button({ x: 10, y: 50, w: 180, h: 36, label: "Play" })
btn.onClick((b) => { log "clicked!" })
panel.add(btn)

val hp = new game.ProgressBar({ x: 10, y: 100, w: 200, h: 18,
  value: 0.8, fgR: 60, fgG: 200, fgB: 80, label: "HP" })
hp.setValue(0.5)

val vol = new game.Slider({ x: 10, y: 130, w: 200,
  minVal: 0, maxVal: 1, value: 0.8, label: "Volume" })

val snd = new game.Checkbox({ x: 10, y: 160, label: "Sound" })

val inp = new game.TextInput({ x: 10, y: 190, w: 200, placeholder: "Enter name..." })

ui.update(this.input)

ui.attachRenderer(this.renderer.buffer, w, h)
ui.render()
```

---

#### Tweens & Easing

24 easing functions. Chainable. Yoyo, loop, delay, onDone callbacks.

```ntl
val tm = new game.TweenManager()

tm.to(node.transform.position, { x: 5, y: 2, z: 0 }, 1.5, game.Easing.easeOutCubic)
tm.to(material, { r: 255, g: 0 }, 0.3, game.Easing.easeIn)

val t = tm.to(obj, { x: 100 }, 0.8, game.Easing.bounce)
         .yoyo()
         .onDone((o) => { log "done" })

tm.update(dt)
```

**All easing functions:** `linear`, `easeIn/Out/InOut`, `easeInOutCubic`, `easeInOutQuart`, `easeInOutQuint`, `easeInOutSine`, `easeInOutExpo`, `easeInOutCirc`, `bounce`, `elastic`, `elasticOut`, `back`, `backOut`, `steps(n)`

---

#### Particles

```ntl
val fire  = game.fireEmitter(x, y, z)
val smoke = game.smokeEmitter(x, y, z)
val expl  = game.explosionBurst(x, y, z, strength)

val em = new game.ParticleEmitter({
  x: 0, y: 0, z: 0,
  emitRate: 40, maxParticles: 500,
  lifeMin: 0.5, lifeMax: 2.0,
  speedMin: 2,  speedMax: 6,
  sizeStart: 8, sizeEnd: 0,
  startR: 255, startG: 200, startB: 50,
  endR: 200,   endG: 40,   endB: 0,
  gravity: -3, drag: 0.97,
  spreadX: 0.4
})

em.burst(100)
em.setPosition(x, y, z)
em.setDirection(0, 1, 0)

em.update(dt)
em.render(renderer, camera)
```

---

#### Raycasting

```ntl
val rc = new game.Raycaster()

rc.setFromScreen(camera, mouseX, mouseY, screenW, screenH)
rc.setFromCamera(camera, 0, 0)

val groundHit = rc.intersectGround(0)
val boxHit    = rc.intersectAABB(new game.AABB(-1,-1,-1, 1,1,1))
val sphereHit = rc.intersectSphere(cx, cy, cz, radius)
val hits      = rc.intersectNodes([node1, node2, node3])

if (hits.length > 0) {
  val node = hits[0].node
  val dist = hits[0].hit.t
}
```

---

#### Physics

```ntl
val world = new game.PhysicsWorld()
world.gravity = -9.8

val body = world.createBody({
  x: 0, y: 5, z: 0,
  mass: 1.0,
  restitution: 0.6,
  friction: 0.3,
  collider: new game.SphereCollider(0.5)
})

body.applyForce(0, 200, 0)
body.applyImpulse(5, 0, 0)

world.step(dt)
node.setPosition(body.x, body.y, body.z)
```

---

#### Tilemap & Terrain

```ntl
val map = new game.Tilemap(cols, rows, tileSize)
map.fill(1)
map.fillRect(col, row, w, h, id)
map.set(col, row, 0)
val path = map.pathfind(c0, r0, c1, r1)
val mesh = map.buildMesh()

val terrain = new game.Heightmap(cols, rows, scale, maxHeight)
terrain.generateNoise(octaves, persistence, lacunarity, seed)
val y    = terrain.heightAt(worldX, worldZ)
val mesh = terrain.buildMesh()
```

---

#### Animation

```ntl
val animator = new game.Animator(node)

val clip  = animator.createClip("walk", { loop: true })
val track = clip.addTrack("transform.position.y")
track.addKey(0.0, 0.0, game.Easing.easeInOut)
track.addKey(0.5, 0.4)
track.addKey(1.0, 0.0)

animator.play("walk")
animator.update(dt)

val sm = new game.AnimationStateMachine(animator)
sm.addState("idle", "idle_clip", { loop: true })
sm.addState("run",  "run_clip",  { loop: true })
sm.addTransition("idle", "run",  (p) => p["speed"] > 0.1)
sm.addTransition("run",  "idle", (p) => p["speed"] <= 0.1)
sm.setInitial("idle")
sm.setParam("speed", velocity)
sm.update(dt)
```

---

#### Input

```ntl
val inp = this.input

inp.isDown("W")
inp.wasPressed("Space")
inp.wasReleased("Enter")

inp.getAxis("Horizontal")
inp.getAxis("Vertical")

inp.mouseX; inp.mouseY; inp.mouseDX; inp.mouseDY
inp.mouseButton(0)

inp.on("keydown", (key) => { ... })
inp.on("mousedown", (btn, x, y) => { ... })
```

---

#### Debug & Profiling

```ntl
val dbg = new game.DebugDraw(renderer, uiRenderer)

dbg.line(x0,y0,z0, x1,y1,z1, r,g,b)
dbg.box(cx,cy,cz, sx,sy,sz, r,g,b)
dbg.sphere(cx,cy,cz, radius, r,g,b)
dbg.text3d(x,y,z, "label", r,g,b)
dbg.drawAxes(0, 0, 0, 2)
dbg.drawGrid(0, 10, 1)
dbg.drawFpsGraph(x, y, w, h)
dbg.render(camera)

val prof = new game.Profiler()
prof.mark("physics")
  world.step(dt)
prof.measure("physics")
prof.report()
```

---

#### Full example

See `examples/game3d_full.ntl` for a complete demo using every system: orbital camera, physics ball, fire particles, UI with buttons/sliders/checkboxes, tweened animations, tilemap, heightmap terrain, and debug overlay — all in one file, running at 60fps.


### ntl:android

```ntl
val android = require("ntl:android")

android.isTermux()
android.shell("ls -la")
await android.shellAsync("apt update")
await android.pkgInstall("python")

android.vibrate(200)
await android.notification("Title", "Message")
await android.speak("Hello from NTL", "en")
await android.getLocation()
await android.capturePhoto("/sdcard/photo.jpg")
android.clipboard("copy this text")
android.listContacts()
await android.sms("555-1234", "Hi!")
android.termuxInfo()
```

---

### ntl:obf

```ntl
val {obfuscate} = require("ntl:obf")

val protected = obfuscate(jsCode, {
  level:         "max",    // "low" | "medium" | "high" | "max"
  renameVars:    true,
  encodeStrings: true,
  encodeNumbers: true,
  controlFlow:   true,
  deadCode:      true,
  stringArray:   true,
  domainLock:    null      // ["mysite.com"] to restrict to domain
})

// Or via CLI:
// ntl build app.ntl --obfuscate
```

---

## Project Configuration

`ntl.json`:

```json
{
  "$schema": "https://ntlang.dev/schema/ntl.json",
  "name":    "my-app",
  "version": "1.0.0",
  "src":     "./src",
  "dist":    "./dist",
  "entry":   "src/main.ntl",
  "compilerOptions": {
    "target":        "node",
    "strict":        false,
    "minify":        false,
    "treeShake":     true,
    "sourceMap":     false,
    "obfuscate":     false,
    "jsx":           false,
    "jsxPragma":     "React.createElement",
    "jsxPragmaFrag": "React.Fragment"
  }
}
```

Generate with: `ntl init .`

---

## Complete Examples

### Full-Stack REST API with Auth

```ntl
val http       = require("ntl:http")
val {Database} = require("ntl:db")
val crypto     = require("ntl:crypto")
val {object, string} = require("ntl:validate")
val {Logger}   = require("ntl:logger")
val {Env}      = require("ntl:env")

val env    = new Env()
val PORT   = env.int("PORT", 3000)
val SECRET = env.require("JWT_SECRET")
val log    = new Logger({name: "api"})
val db     = new Database("./app.db")

db.createTable("users", (t) => {
  t.id(); t.text("name"); t.text("email", {unique: true})
  t.text("password_hash"); t.boolean("admin", false); t.timestamps()
})

val Users = db.model("users", {
  hidden:     ["password_hash"],
  timestamps: true,
  casts:      {admin: "boolean"}
})

val registerSchema = object({
  name:     string().min(2),
  email:    string().email(),
  password: string().min(8)
})

val router = new http.Router()
router.use(http.cors())
router.use(http.rateLimit({windowMs: 60000, max: 100}))

fn authenticate(req, res, next) {
  val token = (req.get("authorization") || "").replace("Bearer ", "")
  val user  = try? crypto.verifyJWT(token, SECRET)
  unless user { res.status(401).json({error: "Unauthorized"}); return }
  req.user = Users.find(user.userId)
  if next { next() }
}

router.post("/auth/register", async (req, res) => {
  val r = registerSchema.safeParse(req.body || {})
  unless r.success { res.status(400).json({errors: r.errors}); return }
  val user  = Users.create({
    name:          r.data.name,
    email:         r.data.email,
    password_hash: crypto.hashPassword(r.data.password)
  })
  val token = crypto.signJWT({userId: user.id}, SECRET, 86400)
  res.status(201).json({user, token})
})

router.post("/auth/login", async (req, res) => {
  val {email, password} = req.body || {}
  val row = db.table("users").where("email", email).first()
  unless row && crypto.verifyPassword(password, row.password_hash) {
    res.status(401).json({error: "Invalid credentials"}); return
  }
  val token = crypto.signJWT({userId: row.id}, SECRET, 86400)
  res.json({token, userId: row.id})
})

router.get("/me", authenticate, (req, res) => {
  res.json({user: req.user})
})

router.get("/health", (req, res) => {
  res.json({status: "ok", uptime: process.uptime()})
})

http.listen(PORT, router, () => {
  log.info("API running at http://localhost:{PORT}")
})
```

---

### Real-Time Chat with WebSockets

```ntl
val http = require("ntl:http")
val {WebSocketServer} = require("ntl:ws")
val {Logger} = require("ntl:logger")

val log   = new Logger({name: "chat"})
val app   = new http.Router()
val wss   = new WebSocketServer()
var users = {}

app.get("/", (req, res) => {
  res.html("<!DOCTYPE html><html><body><h1>NTL Chat</h1></body></html>")
})

val server = http.createServer(app)
wss.attach(server)

wss.on("connection", (socket) => {
  socket.on("message", (msg) => {
    match msg.type {
      case "join" => {
        users[socket.id] = msg.name
        wss.broadcastJSON({
          type: "joined", name: msg.name,
          online: Object.keys(users).length
        })
      }
      case "message" => {
        val name = users[socket.id] || "Anonymous"
        wss.broadcastJSON({
          type: "message", from: name, text: msg.text,
          time: new Date().toISOString()
        })
      }
      case "join-room" => {
        wss.join(socket, msg.room)
        wss.to(msg.room).sendJSON({
          type: "joined-room", name: users[socket.id], room: msg.room
        })
      }
    }
  })

  socket.on("close", () => {
    val name = users[socket.id]
    delete users[socket.id]
    if name { wss.broadcastJSON({type: "left", name}) }
  })
})

server.listen(3000, () => log.info("Chat at http://localhost:3000"))
```

---

### AI-Powered Search API

```ntl
val http = require("ntl:http")
val {createAI, VectorStore} = require("ntl:ai")
val {Logger} = require("ntl:logger")
val {Env}    = require("ntl:env")

val env    = new Env()
val ai     = createAI({provider: "anthropic", apiKey: env.require("ANTHROPIC_API_KEY")})
val log    = new Logger({name: "ai-api"})
val store  = new VectorStore()
val router = new http.Router()

// Build the knowledge base
store.add("NTL is a full-stack language that compiles to JavaScript.")
store.add("Use ntl:http for HTTP servers and REST APIs.")
store.add("Use ntl:db for SQLite database access with query builder and ORM.")
store.add("JSX components compile automatically when you use ntl build --jsx.")
store.add("ntl:crypto provides JWT, AES, hashing, and UUID utilities.")
await store.embedAll(ai)
log.info("Knowledge base ready with", store.size(), "entries")

router.post("/ask", async (req, res) => {
  val {question} = req.body || {}
  unless question { res.status(400).json({error: "question required"}); return }

  val results = await store.retrieve(ai, question, 3)
  val context = results.map(r => r.doc.text).join("\n")

  res.set("Content-Type", "text/plain; charset=utf-8")
  await ai.stream(
    "Context:\n{context}\n\nAnswer this question concisely: {question}",
    (token) => res.write(token)
  )
  res.end()
})

router.post("/classify", async (req, res) => {
  val {text, categories} = req.body || {}
  val label = await ai.classify(text, categories || ["positive","negative","neutral"])
  res.json({label})
})

http.listen(3000, router, () => log.info("AI API at http://localhost:3000"))
```

---

## License

Apache License © 2026 David Dev

GitHub: [github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)
