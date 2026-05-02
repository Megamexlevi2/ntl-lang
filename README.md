# NTL — Node Transpiled Language

**Version 4.0.0** · Created by David Dev · [github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)

NTL is a compiled language that runs on Node.js. It compiles to plain JavaScript, ships with a complete set of built-in modules, and needs zero external dependencies for most backend work. Write less boilerplate, ship faster.

---

## Why NTL?

Every backend project ends up installing the same fifteen packages: an HTTP framework, a validation library, a crypto helper, a logger, a job queue, a cache, a mailer. Each one has its own API, its own update cycle, its own breaking changes, and its own security advisories. Before you write a single line of business logic, you are already managing a dependency graph.

NTL ships all of that as the language itself.

- **One binary, zero config** — `ntl run app.ntl` just works, no setup file needed
- **Built-in modules for real work** — HTTP server, crypto, validation, logger, cache, job queue, WebSockets, mail, database, file system, test runner, AI clients — all included, all using the same consistent API style
- **Zero dependency risk for core functionality** — your `package.json` stays small; no supply chain exposure from dozens of transitive packages just to run a web server
- **Full npm compatibility** — you can still import any npm package when you need something specific
- **Compiled output** — produces clean, readable JavaScript; run it anywhere Node.js runs
- **Strong types, useful errors** — type inference throughout, with error messages that include file, line, column, and a concrete suggestion

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Language Reference](#language-reference)
   - [Variables](#variables)
   - [Types](#types)
   - [Functions](#functions)
   - [Classes](#classes)
   - [Control Flow](#control-flow)
   - [Pattern Matching](#pattern-matching)
   - [Async / Await](#async--await)
   - [Modules](#modules)
   - [Error Handling](#error-handling)
4. [Standard Library](#standard-library)
   - [ntl:http](#ntlhttp)
   - [ntl:crypto](#ntlcrypto)
   - [ntl:validate](#ntlvalidate)
   - [ntl:logger](#ntllogger)
   - [ntl:cache](#ntlcache)
   - [ntl:events](#ntlevents)
   - [ntl:queue](#ntlqueue)
   - [ntl:ws](#ntlws)
   - [ntl:mail](#ntlmail)
   - [ntl:env](#ntlenv)
   - [ntl:db](#ntldb)
   - [ntl:fs](#ntlfs)
   - [ntl:test](#ntltest)
   - [ntl:ai](#ntlai)
5. [Module Manager: nax](#module-manager-nax)
6. [Compiler Pipeline](#compiler-pipeline)
7. [Configuration](#configuration)
8. [Examples](#examples)
9. [Enterprise Adoption Guide](#enterprise-adoption-guide)
10. [Contributing](#contributing)
11. [License](#license)

---

## Installation

**Prerequisites:** Node.js 18 or newer.

```bash
# Clone the repository
git clone https://github.com/Megamexlevi2/ntl-lang.git
cd ntl-lang

# Make the binary executable
chmod +x main.js

# Optional: install globally
npm link
# or copy to PATH:
cp main.js /usr/local/bin/ntl

or

npm install -g @ntl-team/ntl-lang
ntl run file.ntl
```

---

## Quick Start

Create a file called `hello.ntl`:

```ntl
fn greet(name: string): string {
  return `Hello, ${name}!`
}

log greet("world")
```

Run it:

```bash
ntl run hello.ntl
```

Output:

```
Hello, world!
```

---

## Language Reference

### Variables

NTL has three variable declaration keywords:

| Keyword | Meaning                          |
|---------|----------------------------------|
| `val`   | Immutable — cannot be reassigned |
| `var`   | Mutable — can be reassigned      |
| `const` | Alias for `val`                  |

```ntl
val name: string = "Alice"
var count: number = 0

count = count + 1     // OK — var is mutable
name = "Bob"          // Error — val is immutable
```

Type annotations are optional. NTL infers types from the initial value:

```ntl
val x = 42          // inferred as number
var label = "hello" // inferred as string
```

### Types

**Primitive types:**

```ntl
val a: number  = 3.14
val b: string  = "text"
val c: boolean = true
val d: null    = null
val e: void    = undefined
```

**Compound types:**

```ntl
val nums: number[]            = [1, 2, 3]
val pair: [string, number]    = ["age", 25]
val map:  Record<string, any> = { key: "value" }
```

**Union and intersection:**

```ntl
val id: string | number = 42
type Admin = User & HasRole
```

**Type aliases:**

```ntl
type UserId  = string
type Handler = (req: Request, res: Response) -> void
```

**Generics:**

```ntl
fn identity<T>(value: T): T {
  return value
}

val result = identity<string>("hello")
```

**Interfaces:**

```ntl
interface Animal {
  name: string
  sound(): string
}

class Dog implements Animal {
  name: string
  fn constructor(name: string) { this.name = name }
  fn sound(): string { return "Woof" }
}
```

### Functions

Basic function:

```ntl
fn add(a: number, b: number): number {
  return a + b
}
```

Arrow function:

```ntl
val double = (x: number) -> x * 2
```

Default parameters:

```ntl
fn greet(name: string, greeting: string = "Hello"): string {
  return `${greeting}, ${name}!`
}
```

Rest parameters:

```ntl
fn sum(...nums: number[]): number {
  return nums.reduce((acc, n) -> acc + n, 0)
}
```

Async functions:

```ntl
async fn fetchUser(id: string): Promise<User> {
  val res  = await fetch(`/api/users/${id}`)
  return await res.json()
}
```

### Classes

```ntl
class Counter {
  private count: number = 0
  readonly name: string

  fn constructor(name: string) {
    this.name = name
  }

  fn increment(by: number = 1): void {
    this.count += by
  }

  fn get value(): number {
    return this.count
  }

  fn reset(): this {
    this.count = 0
    return this
  }
}

val c = new Counter("visits")
c.increment()
c.increment(5)
log c.value  // 6
```

**Inheritance:**

```ntl
class Animal {
  fn constructor(public name: string) {}
  fn speak(): string { return "..." }
}

class Cat extends Animal {
  fn speak(): string { return `${this.name} says meow` }
}
```

**Static and abstract:**

```ntl
abstract class Shape {
  abstract fn area(): number
  fn describe(): string { return `Area: ${this.area()}` }
}

class Config {
  static val DEFAULT_PORT = 8080
  static fn fromEnv(): Config { return new Config() }
}
```

### Control Flow

```ntl
if age >= 18 {
  log "adult"
} elif age >= 13 {
  log "teenager"
} else {
  log "child"
}

unless user.isLoggedIn { redirect("/login") }

for item of items { log item }
for i   in range(0, 10) { log i }

repeat 5 { log "hello" }

loop {
  val msg = await readMessage()
  if msg == null { break }
  process(msg)
}

each [1, 2, 3] as item { log item * 2 }
```

### Pattern Matching

```ntl
val result = match status {
  case "ok"     -> "Success"
  case "error"  -> "Failed"
  default       -> "Unknown"
}

// Type matching
match value {
  case is string  -> log `String: ${value}`
  case is number  -> log `Number: ${value}`
  default         -> log "Other"
}

// Guards
match score {
  case n when n >= 90 -> "A"
  case n when n >= 80 -> "B"
  default             -> "F"
}

// Object shape
match event {
  case { type: "click", target }  -> handleClick(target)
  case { type: "keydown", key }   -> handleKey(key)
  default                         -> log "unhandled"
}
```

### Async / Await

```ntl
// Top-level await is supported
val user = await fetchUser("123")

// Parallel execution
val [users, posts] = await Promise.all([fetchUsers(), fetchPosts()])

// Error handling
async fn safeGet(url: string) {
  try {
    val res = await fetch(url)
    return await res.json()
  } catch e {
    log `Request failed: ${e.message}`
    return null
  }
}

// spawn — fire and forget
spawn {
  await sendAnalyticsEvent("page_view")
}
```

### Modules

```ntl
// NTL built-in modules
import { Router, createServer } from "ntl:http"
import { schema }               from "ntl:validate"
import { Cache }                from "ntl:cache"

// npm packages
import express      from "express"
import { readFile } from "fs/promises"

// Exporting
export fn add(a: number, b: number): number { return a + b }
export val PI = 3.14159
export default Calculator
```

### Error Handling

```ntl
try {
  val data = JSON.parse(input)
  process(data)
} catch e {
  log `Parse error: ${e.message}`
} finally {
  cleanup()
}

fn divide(a: number, b: number): number {
  if b == 0 { raise new Error("Division by zero") }
  return a / b
}

class AppError extends Error {
  fn constructor(public code: string, message: string) {
    super(message)
    this.name = "AppError"
  }
}
```

---

## Standard Library

All built-in modules are imported with the `ntl:` prefix and have zero external dependencies — only Node.js built-ins.

### ntl:http

Full-featured HTTP server and client.

```ntl
import { createServer, Router, json, cors, rateLimit, staticFiles } from "ntl:http"

val app = createServer()

app.use(json())
app.use(cors({ origin: "*" }))
app.use(rateLimit({ windowMs: 60_000, max: 100 }))

app.get("/health", (req, res) -> {
  res.json({ status: "ok", time: Date.now() })
})

app.post("/users", async (req, res) -> {
  val user = await db.createUser(req.body)
  res.status(201).json(user)
})

// Router
val userRouter = new Router()
userRouter.get("/",      listUsers)
userRouter.get("/:id",   getUser)
userRouter.post("/",     createUser)
userRouter.delete("/:id",deleteUser)
app.use("/users", userRouter)

// SSE (Server-Sent Events)
app.get("/events", (req, res) -> {
  res.sse()
  val timer = setInterval(() -> res.sseEvent("update", { time: Date.now() }), 1000)
  req.on("close", () -> clearInterval(timer))
})

// Static files
app.use(staticFiles("./public"))

app.listen(3000)

// HTTP client
import { fetch } from "ntl:http"
val res  = await fetch("https://api.example.com/users")
val data = await res.json()
```

### ntl:crypto

Cryptographic utilities built on Node.js `crypto` — no external dependencies.

```ntl
val crypto = require("ntl:crypto")

// Password hashing (PBKDF2-based)
val hashed   = await crypto.bcryptHash("my-password")
val isValid  = await crypto.bcryptVerify("my-password", hashed)

// AES-256-GCM encryption
val key       = crypto.randomKey()
val encrypted = crypto.aesEncrypt("sensitive data", key)
val decrypted = crypto.aesDecrypt(encrypted, key)

// JWT (HS256)
val token   = crypto.signJWT({ userId: "123", role: "admin" }, "my-secret", 3600)
val payload = crypto.verifyJWT(token, "my-secret")

// Hashing
val h1 = crypto.sha256("hello")
val h2 = crypto.md5("hello")
val h3 = crypto.sha512("hello")

// UUID and random
val id  = crypto.uuid()
val n   = crypto.randomInt(1, 100)
val hex = crypto.randomHex(32)
val b64 = crypto.randomBase64(24)
```

### ntl:validate

Zod-like schema validation with no external dependencies.

```ntl
import { schema } from "ntl:validate"

val userSchema = schema.object({
  name:  schema.string().min(2).max(50),
  email: schema.string().email(),
  age:   schema.number().int().min(0).optional(),
  role:  schema.enum(["admin", "user", "guest"]).default("user"),
})

// Throws ValidationError if invalid
val user = userSchema.parse(input)

// Returns { ok, value, errors } — never throws
val result = userSchema.safeParse(req.body)
if !result.ok {
  res.status(400).json({ errors: result.errors })
  return
}
val user = result.value  // typed and validated
```

**Available schema types:**

| Type                  | Modifiers                                                          |
|-----------------------|--------------------------------------------------------------------|
| `schema.string()`     | `.min()` `.max()` `.email()` `.url()` `.uuid()` `.regex()` `.nonempty()` |
| `schema.number()`     | `.min()` `.max()` `.int()` `.positive()` `.between()` `.finite()` |
| `schema.boolean()`    | Coerces `"true"` / `"1"` automatically                            |
| `schema.date()`       | `.min()` `.max()` `.past()` `.future()`                            |
| `schema.array(item)`  | `.min()` `.max()` `.nonempty()` `.unique()`                        |
| `schema.object(shape)`| `.strict()` `.partial()` `.pick()` `.omit()` `.extend()`          |
| `schema.union(...)`   | First matching schema wins                                         |
| `schema.enum(values)` | Must be one of the listed values                                   |
| `schema.literal(val)` | Must be exactly this value                                         |
| `schema.record(k, v)` | Dictionary with typed keys and values                              |
| `schema.any()`        | Accepts any value                                                  |

### ntl:logger

Structured logging with levels, child loggers, timers, and file output.

```ntl
import { createLogger } from "ntl:logger"

val log = createLogger({ name: "app", level: "info" })

log.info("Server started", { port: 3000 })
log.warn("High memory usage", { rss: process.memoryUsage().rss })
log.error("Database connection failed", { host: "db.example.com" })

// Child loggers (inherit context)
val reqLog = log.child({ requestId: req.id, userId: req.user?.id })
reqLog.info("Processing request")

// Timers
val timer = log.startTimer("db.query")
await db.query("SELECT * FROM users")
timer.done("Query complete", { rows: 500 })

// Log levels: trace, debug, info, warn, error, fatal

// JSON mode for production
val prodLog = createLogger({
  name:     "app",
  level:    "info",
  pretty:   false,
  filePath: "logs/app.log",
})
```

### ntl:cache

In-memory LRU cache with TTL, namespaces, and hit-rate statistics.

```ntl
import { Cache } from "ntl:cache"

val cache = new Cache({ maxSize: 1000, ttl: 60_000 })

cache.set("user:123", { name: "Alice" })
val user = cache.get("user:123")

// getOrSet — fetch only if not cached
val posts = await cache.getOrSet("posts", async () -> {
  return await db.all("SELECT * FROM posts")
}, 30_000)

// Namespaces
val userCache = cache.namespace("user")
userCache.set("123", userData)
userCache.get("123")
userCache.clear()

// Wrap a function with automatic caching
val cachedGetUser = cache.wrap(getUserById, id -> `user:${id}`, 60_000)

// Stats
log cache.stats()
// { size: 42, maxSize: 1000, hits: 900, misses: 100, hitRate: "0.900", evictions: 0 }
```

### ntl:events

Event emitter with wildcards, typed events, and async support.

```ntl
import { EventEmitter } from "ntl:events"

val bus = new EventEmitter({ wildcard: true })

bus.on("user:created", (user) -> log `New user: ${user.name}`)
bus.on("user:*",       (event, user) -> log `User event: ${event}`)

bus.emit("user:created", { name: "Alice" })

// Wait for an event (Promise-based)
val user = await bus.waitFor("user:created", { timeout: 5000 })

// Async emit (returns settled results)
await bus.emitAsync("notification:send", { to: "alice@example.com" })
```

### ntl:queue

Job queue with retries, delays, priority, concurrency control, and metrics.

```ntl
import { createQueue } from "ntl:queue"

val emailQueue = createQueue("email", {
  concurrency: 3,
  retryDelay:  2000,
})

emailQueue.process(async (job) -> {
  job.reportProgress(50)
  await sendEmail(job.data)
  job.reportProgress(100)
})

emailQueue.on("completed", (job, result) -> log `Email sent: ${job.id}`)
emailQueue.on("failed",    (job, err)    -> log `Failed: ${err.message}`)
emailQueue.on("progress",  (job, pct)    -> log `Progress: ${pct}%`)

// Add jobs
emailQueue.add({ to: "alice@example.com", subject: "Welcome!" }, {
  priority: 10,
  retries:  3,
  delay:    1000,
})

// Bulk add
emailQueue.addBulk(recipients.map(r -> ({ to: r.email })))

await emailQueue.drain()
log emailQueue.metrics()
```

### ntl:ws

WebSocket server with rooms, broadcast, and heartbeat.

```ntl
import { createServer as createWS } from "ntl:ws"

val wss = createWS({ server: http.server })

wss.on("connection", (ws, req) -> {
  log `Client connected: ${ws.ip}`

  ws.on("message", (data) -> {
    val msg = JSON.parse(data)
    match msg.type {
      case "join"    -> wss.join(ws, msg.room)
      case "message" -> wss.to(msg.room).emitJSON({ from: ws.id, text: msg.text })
      case "leave"   -> wss.leave(ws, msg.room)
      default        -> ws.sendJSON({ error: "Unknown type" })
    }
  })

  ws.on("close", () -> log `Client disconnected: ${ws.id}`)
})

wss.broadcastJSON({ type: "announcement", text: "Server restarting soon" })
wss.to("chat:general").emitJSON({ type: "message", text: "Hello room!" })
```

### ntl:mail

SMTP email client with attachments, HTML/text multipart, and template substitution.

```ntl
import { createMailer } from "ntl:mail"

val mailer = createMailer({
  host: "smtp.example.com",
  port: 587,
  auth: { user: "user@example.com", pass: "password" },
  from: "App <noreply@example.com>",
})

await mailer.send({
  to:      "alice@example.com",
  subject: "Welcome to our platform",
  text:    "Thanks for signing up!",
  html:    "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
})

// Template substitution
val html = mailer.template("<h1>Hello, {{name}}!</h1>", { name: "Alice" })

// Attachments
await mailer.send({
  to:          "bob@example.com",
  subject:     "Your report",
  attachments: [{ filename: "report.pdf", content: reportBuffer }],
})
```

### ntl:env

`.env` file loading, type coercion, and schema-based config validation.

```ntl
import env from "ntl:env"

env.load()  // loads .env file

val host  = env.get("HOST", "localhost")
val port  = env.getNumber("PORT", 3000)
val debug = env.getBoolean("DEBUG", false)
val secret = env.require("SESSION_SECRET")

// Schema-based config
val config = env.schema({
  NODE_ENV:     env.field.string().oneOf(["development", "production", "test"]).default("development"),
  PORT:         env.field.number().min(1024).max(65535).default(3000),
  DATABASE_URL: env.field.url(),
  JWT_SECRET:   env.field.string().min(32),
}).parse()

if env.isDev()  { log "Running in development mode" }
if env.isProd() { log "Running in production mode" }
```

### ntl:db

Built-in JSON-backed SQLite (no native bindings) and a pool factory.

```ntl
import { sqlite, createPool } from "ntl:db"

val db = sqlite("data/app.db")

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`)

db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run("Alice", "alice@example.com")

val user  = db.get("SELECT * FROM users WHERE id = ?", [1])
val users = db.all("SELECT * FROM users ORDER BY name")

// Transactions
val insertMany = db.transaction((items) -> {
  for item of items {
    db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run(item.name, item.email)
  }
})
insertMany(userList)

// Pool (async interface)
val pool = createPool({ type: "sqlite", filename: "data/app.db" })
val rows = await pool.all("SELECT * FROM users WHERE active = ?", [true])
```

### ntl:fs

File system utilities with glob, watch, temp files, and path helpers.

```ntl
import * as fs from "ntl:fs"

val content = await fs.read("./data.txt")
await fs.write("./output.txt", "Hello, file!")

val config = await fs.readJSON("./config.json")
await fs.writeJSON("./data.json", { key: "value" })

val files = await fs.glob("src/**/*.ntl", { cwd: process.cwd() })

await fs.copy("a.txt", "b.txt")
await fs.move("old.txt", "new.txt")
await fs.remove("temp/")

val entries = await fs.ls("./src")
entries.filter(e -> e.isFile).forEach(e -> log e.name)

val tmpPath = await fs.tmpFile("temporary content", { ext: ".txt" })

val watcher = fs.watch("./src", { recursive: true })
watcher.on("change", ({ event, file }) -> log `${event}: ${file}`)
```

### ntl:test

Built-in test runner with Jest-like assertions.

```ntl
import { describe, it, expect, mockFn, beforeAll, afterEach } from "ntl:test"

describe("User service", () -> {
  val mockDb = mockFn()
  mockDb.mockResolvedValue([{ id: 1, name: "Alice" }])

  it("returns a list of users", async () -> {
    val users = await getUsers(mockDb)
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe("Alice")
  })

  it("validates email format", () -> {
    expect(() -> validateEmail("not-an-email")).toThrow("invalid email")
    expect(validateEmail("alice@example.com")).toBe(true)
  })

  it("calculates totals", () -> {
    expect(sum(1, 2, 3)).toBe(6)
    expect(sum()).toBe(0)
    expect(result.value).toBeCloseTo(3.14, 2)
    expect(["a", "b"]).toContain("a")
    expect({ id: 1 }).toMatchObject({ id: 1 })
  })
})
```

Run tests:

```bash
ntl test
ntl test --file user.test.ntl
ntl test --filter "User service"
```

### ntl:ai

Connect to OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint.

```ntl
import { openai, anthropic, ollama, system, user, messages } from "ntl:ai"

// OpenAI (reads OPENAI_API_KEY automatically)
val gpt = openai({ model: "gpt-4o" })

val reply = await gpt.complete("What is the capital of France?")

val res = await gpt.chat({
  messages: [
    system("You are a helpful assistant."),
    user("Explain WebSockets in one paragraph."),
  ],
})

// Streaming
val stream = gpt.stream({ messages: messages("Write a poem about JavaScript") })
stream.on("chunk", (text) -> process.stdout.write(text))
stream.on("done",  (full) -> log `\n\nTotal: ${full.length} chars`)

// Embeddings
val embedding = await gpt.embed("NTL is a compiled language")

// Anthropic Claude
val claude = anthropic({ model: "claude-3-5-sonnet-20241022" })
val reply2 = await claude.complete("What is TypeScript?", { system: "Be concise." })

// Local Ollama
val llama = ollama({ model: "llama3" })
val reply3 = await llama.complete("Hello!")
val models = await llama.models()
```

---

## Module Manager: nax

`nax` is NTL's module manager. It installs, removes, lists, and publishes NTL modules.

```bash
nax install ntl-router            # install a module
nax install ntl-router@2.1.0     # specific version
nax install ntl-router ntl-auth   # install multiple
nax remove  ntl-router            # uninstall
nax list                          # list installed modules
nax search  "http router"         # search the registry
nax info    ntl-router            # show module info
nax update                        # update all modules
nax update  ntl-router            # update one module
nax publish                       # publish your module
nax publish --tag beta            # publish a beta tag
nax login                         # log in to registry
nax logout                        # log out
```

**Package manifest (`nax.json`):**

```json
{
  "name": "my-ntl-app",
  "version": "1.0.0",
  "description": "My NTL application",
  "author": "Your Name",
  "license": "MIT",
  "main": "main.ntl",
  "dependencies": {
    "ntl-router": "^2.0.0",
    "ntl-auth":   "^1.5.0"
  },
  "devDependencies": {
    "ntl-test-utils": "^1.0.0"
  },
  "scripts": {
    "start": "ntl run main.ntl",
    "test":  "ntl test",
    "build": "ntl build --target node --out dist/"
  }
}
```

---

## Compiler Pipeline

NTL compiles source code through six stages:

```
Source (.ntl)
     |
     v
  Lexer       — tokenizes source into a stream of tokens
     |           (loads keywords from config/keywords.yaml when present)
     v
  Parser      — builds an Abstract Syntax Tree (AST)
     |
     v
  Type Infer  — infers and checks types across the AST
     |
     v
  Transforms  — syntax sugar, macro expansion, optimizations
     |
     v
  Codegen     — emits JavaScript (ESM or CJS)
     |
     v
Output (.js)
```

**CLI reference:**

```bash
ntl run   app.ntl              # run a source file directly
ntl run   app.ntl --watch      # re-run on file changes
ntl run   app.ntl --debug      # verbose compiler output
ntl build app.ntl --out dist/  # compile to JavaScript
ntl build app.ntl --target esm # ES modules output
ntl build app.ntl --target cjs # CommonJS output
ntl build app.ntl --minify     # minified output
ntl build app.ntl --bundle     # single-file bundle
ntl check app.ntl              # type check only, no output
ntl fmt   app.ntl              # format source code
ntl fmt   src/ --check         # check formatting without writing
ntl test                       # run the test suite
ntl repl                       # interactive REPL
```

---

## Configuration

NTL reads configuration from the `config/` directory. All files are optional — NTL works with zero configuration out of the box.

### config/compiler.yaml

```yaml
target: node          # node | browser | esm | cjs
strict: true          # enable strict type checking
sourceMap: true       # emit source maps
minify: false
bundle: false
treeshake: true
emit: javascript

features:
  jit: false          # experimental JIT compilation
  inference: deep     # type inference depth: shallow | deep
  macros: true
```

### config/keywords.yaml

Extends the lexer's keyword list. The keywords are organized by category and loaded automatically.

```yaml
version: "3.5.2"
keywords:
  declarations:
    - var
    - val
    - const
    - fn
  control:
    - if
    - else
    - unless
    - elif
    - match
    - case
```

### config/nax.yaml

```yaml
registry: https://registry.ntl-lang.org
cache: ~/.nax/cache
lockfile: nax.lock
```

### config/lint.yaml

```yaml
rules:
  no-unused-vars: error
  no-implicit-any: warn
  prefer-val: warn
  no-console: off
  max-line-length: 120
```

### config/error-messages.yaml

Customize error message templates. Useful for localization.

---

## Examples

### REST API Server

```ntl
import { createServer, Router, json, cors, rateLimit } from "ntl:http"
import { schema }                                        from "ntl:validate"
import { createLogger }                                  from "ntl:logger"
import { Cache }                                         from "ntl:cache"
import { sqlite }                                        from "ntl:db"
import env                                               from "ntl:env"

env.load()

val log   = createLogger({ name: "api" })
val db    = sqlite(env.get("DB_PATH", ":memory:"))
val cache = new Cache({ maxSize: 500, ttl: 30_000 })
val app   = createServer()

db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE)")

val userSchema = schema.object({
  name:  schema.string().min(2).max(100),
  email: schema.string().email(),
})

app.use(json())
app.use(cors())
app.use(rateLimit({ windowMs: 60_000, max: 100 }))

app.get("/users", (req, res) -> {
  val cached = cache.get("users:all")
  if cached { res.json(cached); return }
  val rows = db.all("SELECT * FROM users ORDER BY name")
  cache.set("users:all", rows)
  res.json(rows)
})

app.get("/users/:id", (req, res) -> {
  val user = db.get("SELECT * FROM users WHERE id = ?", [req.params.id])
  if !user { res.status(404).json({ error: "User not found" }); return }
  res.json(user)
})

app.post("/users", (req, res) -> {
  val r = userSchema.safeParse(req.body)
  if !r.ok { res.status(400).json({ errors: r.errors }); return }
  val result = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run(r.value.name, r.value.email)
  cache.delete("users:all")
  res.status(201).json({ id: result.lastInsertRowid, ...r.value })
})

app.listen(env.getNumber("PORT", 3000), () -> log.info("API running", { port: 3000 }))
```

### WebSocket Chat Server

```ntl
import { createServer }             from "ntl:http"
import { createServer as wsServer } from "ntl:ws"
import { createLogger }             from "ntl:logger"

val log  = createLogger({ name: "chat" })
val http = createServer()
val wss  = wsServer({ server: http.server })

wss.on("connection", (ws) -> {
  log.info("User connected", { id: ws.id })

  ws.on("message", (raw) -> {
    try {
      val msg = JSON.parse(raw)
      match msg.type {
        case "join" -> {
          wss.join(ws, msg.room)
          ws.set("name", msg.name)
          ws.set("room", msg.room)
          wss.to(msg.room).emitJSON({ type: "system", text: `${msg.name} joined` })
        }
        case "message" -> {
          val room = ws.get("room")
          val name = ws.get("name")
          if room { wss.to(room).emitJSON({ type: "message", from: name, text: msg.text }) }
        }
        case "leave" -> {
          val room = ws.get("room")
          val name = ws.get("name")
          if room { wss.leave(ws, room); wss.to(room).emitJSON({ type: "system", text: `${name} left` }) }
        }
      }
    } catch e {
      log.warn("Invalid message", { error: e.message })
    }
  })

  ws.on("close", () -> log.info("User disconnected", { id: ws.id }))
})

http.listen(4000)
log.info("Chat server running on port 4000")
```

### Background Job Queue

```ntl
import { createQueue }  from "ntl:queue"
import { createMailer } from "ntl:mail"
import { createLogger } from "ntl:logger"
import env              from "ntl:env"

env.load()

val log    = createLogger({ name: "jobs" })
val mailer = createMailer({
  host: env.require("SMTP_HOST"),
  auth: { user: env.require("SMTP_USER"), pass: env.require("SMTP_PASS") },
})

val emailQ  = createQueue("emails",  { concurrency: 5, retryDelay: 5000 })
val reportQ = createQueue("reports", { concurrency: 1 })

emailQ.process(async (job) -> {
  job.reportProgress(10)
  await mailer.send(job.data)
  job.reportProgress(100)
  return { sent: true, to: job.data.to }
})

emailQ.on("completed", (job, r) -> log.info("Email sent",   { to: r.to }))
emailQ.on("failed",    (job, e) -> log.error("Email failed", { error: e.message, attempts: job.attempts }))

reportQ.process(async (job) -> {
  val data = await gatherReportData(job.data.reportId)
  await emailQ.add({ to: job.data.email, subject: "Your Report", attachments: [{ filename: "report.pdf", content: data }] })
})

emailQ.add({ to: "alice@example.com", subject: "Welcome!" }, { retries: 3 })
reportQ.add({ reportId: "monthly-2026-04", email: "cfo@company.com" }, { priority: 10 })

log.info("Queues running", emailQ.metrics())
```

### AI-Powered API

```ntl
import { createServer, json } from "ntl:http"
import { openai }             from "ntl:ai"
import { schema }             from "ntl:validate"
import env                    from "ntl:env"

env.load()

val gpt = openai({ model: "gpt-4o" })
val app = createServer()

app.use(json())

val promptSchema = schema.object({
  prompt: schema.string().min(1).max(4000),
  system: schema.string().max(2000).optional(),
  stream: schema.boolean().default(false),
})

app.post("/chat", async (req, res) -> {
  val r = promptSchema.safeParse(req.body)
  if !r.ok { res.status(400).json({ errors: r.errors }); return }

  val { prompt, system, stream } = r.value

  if stream {
    res.setHeader("Content-Type", "text/event-stream")
    val s = gpt.stream({ messages: [{ role: "user", content: prompt }] })
    s.on("chunk", (text) -> res.write(`data: ${JSON.stringify({ text })}\n\n`))
    s.on("done",  ()     -> { res.write("data: [DONE]\n\n"); res.end() })
    s.on("error", (e)    -> { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.end() })
  } else {
    val reply = await gpt.complete(prompt, { system })
    res.json({ reply })
  }
})

app.listen(env.getNumber("PORT", 3000))
```

---

## Enterprise Adoption Guide

NTL integrates cleanly into existing Node.js infrastructure. You can migrate gradually — run NTL files alongside existing JavaScript code.

### Production deployment

```bash
# Option 1: compile to JavaScript, then run with Node
ntl build src/main.ntl --out dist/ --target cjs
node dist/main.js

# Option 2: run NTL files directly with the runtime
node main.js run src/app.ntl
```

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
# No npm install required for standard NTL apps
CMD ["node", "main.js", "run", "src/app.ntl"]
```

### Using npm packages

NTL works with every npm package. Import them exactly as in Node.js:

```ntl
import express          from "express"
import { z }            from "zod"
import Stripe           from "stripe"
import { Kysely }       from "kysely"
import { Redis }        from "ioredis"
import { PrismaClient } from "@prisma/client"
```

### Why would a company adopt NTL?

The built-in modules are the starting point, not the whole answer. Here is the actual case:

**Dependency sprawl is a real cost.** A typical Node.js backend service has 30–80 direct and transitive dependencies just to cover HTTP, validation, crypto, logging, and queueing. Every dependency is a potential CVE, a breaking upgrade, and a maintenance burden. When you install express, you are also implicitly agreeing to maintain body-parser, accepts, mime-types, and a dozen others. NTL eliminates that overhead for the core of every service.

**Consistency across teams.** When one team handles HTTP with Fastify and another uses Express, and one logs with pino while another uses winston, reading unfamiliar code costs time. NTL gives every team the same HTTP API, the same validation API, the same logger API. New developers read the docs once and contribute on day one.

**Upgrade once, everything moves together.** When NTL releases a new version, all built-in modules are tested and updated together. There are no compatibility matrices between your HTTP framework version, your validation library version, and your logger version. One upgrade, one changelog.

**Smaller attack surface.** A minimal `package.json` with only your actual business dependencies means fewer places for a compromised package to hide. Security audits are simpler when there are fewer packages to audit.

**Faster project bootstrap.** Starting a new service in NTL means writing code immediately — not spending the first two days choosing between four HTTP frameworks, evaluating validation libraries, configuring a logger, and wiring them all together with slightly different conventions each time.

**Still runs on the same infrastructure.** NTL compiles to JavaScript. Your existing CI/CD pipelines, Docker images, serverless platforms, and monitoring tools all continue to work without changes.

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run tests
        run: node main.js test
      - name: Type check
        run: node main.js check src/
      - name: Build
        run: node main.js build src/main.ntl --out dist/ --target cjs
```

---

## Contributing

1. Fork the repository: [github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)
2. Create a branch: `git checkout -b feature/my-feature`
3. Make your changes and write tests
4. Run the test suite: `ntl test`
5. Open a pull request

**Areas that need contributors:**

- Language server protocol (LSP) for editor support
- Additional compile targets (WASM, Deno, Bun)
- More standard library modules (orm, auth, i18n, graphql)
- Documentation improvements and translated docs
- Bug reports and issue triage

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

Copyright 2026 David Dev (Megamexlevi2). All rights reserved.
