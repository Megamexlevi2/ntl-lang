<div align="center">

# NTL Language — v2.1

**A full-stack programming language that compiles to JavaScript.**  
Write your backend API, database layer, and frontend UI components in one clean, expressive syntax.

[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Zero npm dependencies](https://img.shields.io/badge/dependencies-zero-blue)](package.json)
[![Tests: 74/74](https://img.shields.io/badge/tests-74%2F74%20passing-brightgreen)](#)
[[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

*Created by David Dev — [github.com/Megamexlerei2/ntl-lang](https://github.com/Megamexlerei2/ntl-lang)*

</div>

---

## Why NTL?

NTL is a **unified full-stack language**: one syntax for your HTTP server, database queries, real-time websockets, and React/JSX components. It compiles to clean, fast JavaScript and runs on any runtime that supports Node.js modules.

| Feature | Status |
|---|---|
| Backend HTTP server, routing, middleware | ✅ Built-in |
| SQLite database with query builder + ORM | ✅ Built-in |
| Frontend JSX components (auto-compiled) | ✅ Built-in |
| Server-side rendering (SSR) | ✅ Backend can import JSX |
| Real-time WebSockets (RFC 6455) | ✅ Zero deps |
| Auth: JWT, AES, bcrypt-style hashing | ✅ Built-in |
| Zod-like schema validation | ✅ Built-in |
| AI/LLM: OpenAI, Anthropic, Ollama, Groq | ✅ Built-in |
| Full test runner with assertions | ✅ Built-in |
| All Node.js built-ins work directly | ✅ |
| Any npm package works via `require()` | ✅ |
| Zero npm dependencies for production | ✅ |

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
git clone https://github.com/Megamexlerei2/ntl-lang
cd ntl-lang
node main.js run examples/fullstack_server.ntl
```

**Requirements:** Node.js ≥ 18.0.0

---

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

### Safe Operations

```ntl
// try? — returns null instead of throwing
val parsed  = try? JSON.parse(input)
val user    = try? await fetchUser(id)

// ifhave — run block only if value is not null/undefined
ifhave user as u { log u.name }

// ifset — run if variable is defined
ifset config.port as port { log "Port:", port }

// have — safe deep access (null-safe chain, returns undefined instead of throwing)
val city   = have user.profile.address.city
val nested = have deeply.nested.property.value

// Optional chaining and nullish coalescing
val name = user?.profile?.name ?? "Anonymous"
val port = env?.PORT ?? 3000
val len  = arr?.length ?? 0
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

```ntl
val {Vec2, Vec3, Rect, Color, Camera2D, GameLoop, Input, EntityManager, StateMachine, math} = require("ntl:game")

// Vectors
val v = new Vec2(3, 4)
v.add(new Vec2(1, 1))
v.normalize()
v.distance(other)
v.lerp(target, 0.1)
Vec2.zero(); Vec2.up(); Vec2.right()

// Color
val red  = new Color(1, 0, 0)
val hex  = Color.fromHex("#FF5733")
red.lerp(Color.blue(), 0.5)
red.withAlpha(0.5)

// Game Loop
val loop = new GameLoop({
  fps:           60,
  onUpdate:      (dt) => { updateLogic(dt) },
  onFixedUpdate: (dt) => { physics(dt) },
  onRender:      (alpha) => { draw(alpha) }
})
loop.start()

// ECS
val ecs = new EntityManager()
val id  = ecs.create({position: {x:0, y:0}, health: {hp: 100}})
val all = ecs.query("position", "health")
for val entity of all {
  entity.components.position.x += 1
}

// State Machine
val fsm = new StateMachine({
  menu:   {enter: showMenu, update: updateMenu, exit: hideMenu},
  game:   {enter: startGame, update: updateGame},
  paused: {enter: pauseGame}
}, "menu")
fsm.transition("game")
fsm.update(dt)

// Math utilities
math.clamp(15, 0, 10)
math.lerp(0, 100, 0.5)
math.randInt(1, 6)
math.shuffle([1,2,3,4,5])
math.deg2rad(180)
```

---

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

GitHub: [github.com/Megamexlerei2/ntl-lang](https://github.com/Megamexlerei2/ntl-lang)
