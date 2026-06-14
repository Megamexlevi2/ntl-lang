# NTL-lang — Node Transpiled Language

**Version 4.1.0** · Created by David Dev · [github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)

NTL-lang is a compiled language that runs on Node.js. It transpiles to clean JavaScript, ships with a complete standard library, and requires zero external dependencies for most backend work. Write less boilerplate, ship faster.

---

## Why NTL-lang?

Every backend project ends up installing the same fifteen packages: an HTTP framework, a validation library, a crypto helper, a logger, a job queue, a cache, a mailer. Each one has its own API, its own update cycle, its own breaking changes, and its own security advisories. Before you write a single line of business logic, you're already managing a dependency graph.

NTL-lang ships all of that as part of the language itself.

- **One binary, zero config** — `ntl run app.ntl` just works, no setup needed
- **Built-in modules for real work** — HTTP server, crypto, validation, logger, cache, job queue, WebSockets, mail, database, file system, test runner, AI clients — all included, all using the same consistent API
- **Zero dependency risk for core functionality** — your `package.json` stays small; no supply chain exposure from dozens of transitive packages just to run a web server
- **Full npm compatibility** — you can still import any npm package when you need something specific
- **CommonJS output** — produces clean, readable CJS JavaScript; runs everywhere Node.js runs
- **Selective embedding** — when you bundle a local module, only the functions actually used in your code are included in the output
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
5. [Module Manager: nax](#module-manager-nax)
6. [Compiler Pipeline](#compiler-pipeline)
7. [Configuration](#configuration)
8. [Examples](#examples)
9. [Deployment](#deployment)
10. [Contributing](#contributing)
11. [License](#license)

---

## Installation

**Prerequisites:** Node.js 18 or newer.

```bash
# Install globally via npm
npm install -g @ntl-team/ntl-lang
ntl run file.ntl
```

Alternatively, clone and link manually:

```bash
git clone https://github.com/Megamexlevi2/ntl-lang.git
cd ntl-lang

chmod +x main.js
npm link
# or copy directly to PATH:
cp main.js /usr/local/bin/ntl
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

NTL-lang has three variable declaration keywords:

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

Type annotations are optional. NTL-lang infers types from the initial value:

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
  init(name: string) { this.name = name }
  sound(): string { return "Woof" }
}
```

### Functions

```ntl
// Basic function
fn add(a: number, b: number): number {
  return a + b
}

// Default parameters
fn greet(name: string, greeting: string = "Hello") {
  return `${greeting}, ${name}!`
}

// Rest parameters
fn sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

// Arrow function
val double = (x) => x * 2

// Immediately invoked
val result = ((x, y) => x + y)(3, 4)
```

### Classes

```ntl
class Animal {
  init(name, sound) {
    this.name  = name
    this.sound = sound
  }

  speak() {
    return `${this.name} says ${this.sound}!`
  }

  toString() {
    return `Animal(${this.name})`
  }
}

class Dog extends Animal {
  init(name, breed) {
    super(name, "Woof")
    this.breed = breed
  }

  fetch(item) {
    return `${this.name} fetches the ${item}!`
  }
}

val dog = new Dog("Rex", "Labrador")
log dog.speak()
log dog.fetch("ball")
```

### Control Flow

```ntl
// Standard if / elif / else
if score >= 90 {
  log "A"
} elif score >= 80 {
  log "B"
} else {
  log "F"
}

// unless — runs when condition is false
unless loggedIn {
  log "Please log in first"
}

// guard — early return if condition fails
fn divide(a, b) {
  guard b !== 0 else {
    log "Division by zero"
    return null
  }
  return a / b
}

// each — iterate over lists
val fruits = ["apple", "banana", "cherry"]
each fruit in fruits {
  log fruit
}

// range
each i in range(5) {
  log `step ${i}`
}

// repeat N times
var counter = 0
repeat 5 { counter++ }

// while
while counter > 0 {
  counter--
}

// defer — runs at end of scope (even on return)
fn withCleanup() {
  defer { log "connection closed" }
  log "running query..."
}

// try? — returns null on error instead of throwing
val parsed = try? JSON.parse(userInput)
```

### Pattern Matching

```ntl
fn classify(value) {
  return match value {
    case 0  => { "zero" }
    case 1  => { "one"  }
    default => { "other: " + value }
  }
}

fn describeType(x) {
  return match typeof x {
    case "string"  => { `string, length ${x.length}` }
    case "number"  => { `number: ${x}` }
    case "boolean" => { `boolean: ${x}` }
    default        => { "other" }
  }
}

log classify(0)         // "zero"
log classify(42)        // "other: 42"
log describeType("hi")  // "string, length 2"
```

### Async / Await

```ntl
async fn fetchUser(id: number) {
  await sleep(10)
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  }
}

async fn main() {
  val user = await fetchUser(1)
  log user.name, user.email

  // Parallel fetch
  val users = await Promise.all([1, 2, 3].map(id => fetchUser(id)))
  log `Fetched ${users.length} users`
}

main()
```

### Modules

NTL-lang uses **CommonJS** (`require` / `module.exports`) as its primary module system. This gives maximum compatibility with the Node.js ecosystem.

```ntl
// Import built-in NTL-lang module
val http = require("ntl:http")

// Import local module
val math = require("./math.ntl")

// Import npm package
val express = require("express")

// Named destructure
val { Cache }  = require("ntl:cache")
val { Logger } = require("ntl:logger")

// Export functions from a module file
fn add(a, b) { return a + b }
fn sub(a, b) { return a - b }

export { add, sub }
```

> **Why CommonJS?** NTL-lang compiles to CJS by default because it runs on Node.js and needs zero configuration. If you need ES module output for a browser or Deno target, use `ntl build --target esm` (see CLI reference).

### Error Handling

```ntl
// try / catch / finally
try {
  val data = JSON.parse(input)
  log data
} catch e {
  log "Parse error:", e.message
} finally {
  log "always runs"
}

// throw
fn requirePositive(n) {
  if n <= 0 { throw new Error(`Expected positive, got ${n}`) }
  return n
}

// try? — safe call, returns null on error
val result = try? riskyOperation()
if result !== null {
  log "Success:", result
}
```

---

## Standard Library

All built-in modules are imported with the `ntl:` prefix.

### ntl:http

HTTP server with Express-like routing.

```ntl
val http = require("ntl:http")

val app = http.createServer()

app.get("/", (req, res) => {
  res.json({ message: "Hello from NTL-lang!", version: "4.1.0" })
})

app.get("/users/:id", (req, res) => {
  val id = parseInt(req.params.id)
  guard !isNaN(id) else {
    res.status(400).json({ error: "Invalid user ID" })
    return
  }
  res.json({ id, name: `User ${id}`, email: `user${id}@example.com` })
})

app.post("/echo", (req, res) => {
  res.json({ received: req.body, timestamp: Date.now() })
})

app.listen(3000, () => {
  log "Server running at http://localhost:3000"
})
```

### ntl:crypto

Cryptographic utilities: hashing, AES encryption, bcrypt, JWT, UUIDs.

```ntl
val crypto = require("ntl:crypto")

val key       = crypto.randomKey()
val hashed    = crypto.sha256("Hello from NTL-lang!")
val token     = crypto.randomHex(32)
val uid       = crypto.uuid()
val encrypted = crypto.aesEncrypt("secret", key)
val decrypted = crypto.aesDecrypt(encrypted, key)

// Async: bcrypt and JWT
async fn main() {
  val stored  = await crypto.bcryptHash("mypassword")
  val valid   = await crypto.bcryptVerify("mypassword", stored)

  val jwt     = crypto.signJWT({ userId: 42 }, "secret", 3600)
  val decoded = crypto.verifyJWT(jwt, "secret")
  log decoded.userId  // 42
}

main()
```

### ntl:validate

Schema-based validation for request bodies, config, and user input.

```ntl
val validate = require("ntl:validate")

val UserSchema = validate.object({
  name:     validate.string().min(2).max(50),
  email:    validate.string().email(),
  age:      validate.number().min(0).max(150).optional(),
  role:     validate.enum(["admin", "user", "guest"]).default("user"),
  password: validate.string().min(8),
})

val result = UserSchema.validate({
  name:     "Alice",
  email:    "alice@example.com",
  age:      28,
  role:     "admin",
  password: "securepass123",
})

if result.ok {
  log "Valid:", result.value
} else {
  each err in result.errors {
    log `  - ${err.field}: ${err.message}`
  }
}
```

### ntl:logger

Structured logger with levels, prefixes, and output formats.

```ntl
val { Logger } = require("ntl:logger")

val log = new Logger({ level: "info", prefix: "App" })

log.info("Server started", { port: 3000 })
log.warn("High memory usage", { rss: process.memoryUsage().rss })
log.error("Database error", { message: "connection refused" })
log.debug("Cache miss for key", { key: "user:42" })
```

### ntl:cache

In-memory cache with TTL and max-size eviction.

```ntl
val { Cache } = require("ntl:cache")

val store = new Cache({ maxSize: 100, ttl: 5000 })

store.set("user:42", { name: "Alice" })
val user = store.get("user:42")
log user.name  // "Alice"

store.delete("user:42")
log store.size   // 0
```

### ntl:events

EventEmitter — compatible with Node.js `events` module API.

```ntl
val { EventEmitter } = require("ntl:events")

val bus = new EventEmitter()

bus.on("user:login", (user) => {
  log `${user.name} logged in`
})

bus.once("app:start", () => {
  log "Application started (fires once)"
})

bus.emit("app:start")
bus.emit("user:login", { id: 1, name: "Alice" })
log `Listeners on user:login: ${bus.count("user:login")}`
```

### ntl:queue

Background job queue with concurrency control and retries.

```ntl
val { createQueue } = require("ntl:queue")

val emailQ = createQueue("emails", { concurrency: 5, retryDelay: 5000 })

emailQ.process(async (job) => {
  job.reportProgress(10)
  // send email...
  job.reportProgress(100)
  return { sent: true, to: job.data.to }
})

emailQ.on("completed", (job, r) => log `Email sent to ${r.to}`)
emailQ.on("failed",    (job, e) => log `Failed: ${e.message}`)

emailQ.add({ to: "alice@example.com", subject: "Welcome!" }, { retries: 3 })
```

### ntl:ws

WebSocket server built on top of the HTTP server.

```ntl
val { createServer }             = require("ntl:http")
val { createServer: wsServer }   = require("ntl:ws")

val http = createServer()
val wss  = wsServer({ server: http.server })

wss.on("connection", (ws) => {
  log `User connected: ${ws.id}`

  ws.on("message", (raw) => {
    val msg = try? JSON.parse(raw)
    if msg { wss.broadcast(JSON.stringify({ from: ws.id, text: msg.text })) }
  })

  ws.on("close", () => log `User disconnected: ${ws.id}`)
})

http.listen(4000, () => log "WebSocket server running on port 4000")
```

### ntl:mail

Email sending via SMTP.

```ntl
val { createMailer } = require("ntl:mail")

val mailer = createMailer({
  host: "smtp.example.com",
  auth: { user: "user@example.com", pass: "password" },
})

await mailer.send({
  to:      "alice@example.com",
  subject: "Hello from NTL-lang!",
  html:    "<p>Welcome aboard.</p>",
})
```

### ntl:env

Environment variable loading and type-safe access.

```ntl
val env = require("ntl:env")

env.load()  // loads .env file if present

val port   = env.getNumber("PORT", 3000)
val debug  = env.getBool("DEBUG", false)
val apiKey = env.require("API_KEY")  // throws if missing

log `Listening on port ${port}`
```

### ntl:db

SQLite database with prepared statements and migrations.

```ntl
val { sqlite } = require("ntl:db")

val db = sqlite(":memory:")

db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE)")

val stmt   = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)")
val result = stmt.run("Alice", "alice@example.com")

val users = db.all("SELECT * FROM users")
each user in users {
  log user.id, user.name, user.email
}

val one = db.get("SELECT * FROM users WHERE id = ?", [1])
log one.name  // "Alice"
```

### ntl:fs

File system utilities with glob, watch, temp files, and path helpers.

```ntl
val fs = require("ntl:fs")

async fn main() {
  val content = await fs.read("./data.txt")
  await fs.write("./output.txt", "Hello, file!")

  val config = await fs.readJSON("./config.json")
  await fs.writeJSON("./data.json", { key: "value" })

  val files   = await fs.glob("src/**/*.ntl", { cwd: process.cwd() })

  await fs.copy("a.txt", "b.txt")
  await fs.move("old.txt", "new.txt")
  await fs.remove("temp/")

  val entries = await fs.ls("./src")
  entries.filter(e => e.isFile).forEach(e => log e.name)
}

main()
```

### ntl:test

Built-in test runner with assertion helpers.

```ntl
val { suite, test, run, assert } = require("ntl:test")

suite("String utilities", (s) => {
  s.test("capitalize first letter", (t) => {
    fn capitalize(str) {
      return str[0].toUpperCase() + str.slice(1)
    }
    t.equal(capitalize("hello"), "Hello")
    t.equal(capitalize("world"), "World")
    t.equal(capitalize("ntl"),   "Ntl")
  })

  s.test("reverse a string", (t) => {
    fn reverse(str) {
      return str.split("").reverse().join("")
    }
    t.equal(reverse("hello"), "olleh")
    t.equal(reverse(""),      "")
  })
})

run()
```

Run tests:

```bash
ntl test
ntl run tests/all.ntl
```

### ntl:ai

Connect to OpenAI, Anthropic Claude, Ollama, or any OpenAI-compatible API.

```ntl
val { openai, anthropic, ollama } = require("ntl:ai")

// OpenAI — reads OPENAI_API_KEY automatically
val gpt   = openai({ model: "gpt-4o" })
val reply = await gpt.complete("What is the capital of France?")

// Streaming
val stream = gpt.stream({ messages: [{ role: "user", content: "Write a short poem" }] })
stream.on("chunk", (text) => process.stdout.write(text))
stream.on("done",  (full) => log `\nTotal: ${full.length} chars`)

// Anthropic Claude
val claude  = anthropic({ model: "claude-sonnet-4-6" })
val reply2  = await claude.complete("What is TypeScript?", { system: "Be concise." })

// Local Ollama
val llama  = ollama({ model: "llama3" })
val reply3 = await llama.complete("Hello!")
val models = await llama.models()
```

---

## Module Manager: nax

`nax` is NTL-lang's module manager. It installs, removes, lists, and publishes NTL-lang modules.

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
  "description": "My NTL-lang application",
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

NTL-lang compiles source code through six stages:

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
  Codegen     — emits JavaScript (CommonJS by default)
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
ntl build app.ntl --target esm # ES modules output (browser/Deno)
ntl build app.ntl --target cjs # CommonJS output (Node.js, default)
ntl build app.ntl --minify     # minified output
ntl build app.ntl --bundle     # single-file bundle
ntl check app.ntl              # type check only, no output
ntl fmt   app.ntl              # format source code
ntl fmt   src/ --check         # check formatting without writing
ntl test                       # run the test suite
ntl repl                       # interactive REPL
```

### Selective Embedding

When you bundle or build a file that imports local `.ntl` modules, NTL-lang automatically performs **selective embedding** — only the functions and variables that your code actually calls are included in the output. This keeps compiled bundles small.

```ntl
// main.ntl — only uses math.add and math.multiply
val math = require("./math.ntl")

log math.add(3, 4)
log math.multiply(6, 7)
```

The compiled output will embed only `add` and `multiply` from `math.ntl`, even if that module exports many other functions. You can disable this with:

```bash
ntl build app.ntl --no-treeshake
```

---

## Configuration

NTL-lang reads configuration from the `config/` directory. All files are optional — NTL-lang works with zero configuration out of the box.

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

Extends the lexer's keyword list. Keywords are organized by category and loaded automatically.

```yaml
version: "4.1.0"
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

All examples are in the `examples/` directory and are runnable with `ntl run`.

### Hello World

```bash
ntl run examples/01_hello_world.ntl
```

```ntl
fn greet(name: string) -> string {
  return `Hello, ${name}!`
}

val message = greet("World")
log message

val names = ["Alice", "Bob", "Charlie"]
each name in names {
  log greet(name)
}
```

### Classes and Inheritance

```bash
ntl run examples/02_classes.ntl
```

### Async / Await

```bash
ntl run examples/03_async.ntl
```

### Pattern Matching

```bash
ntl run examples/04_pattern_matching.ntl
```

### Crypto Module

```bash
ntl run examples/05_modules.ntl
```

### Multi-file Project (with selective embed)

```bash
ntl run examples/06_multi_file/main.ntl
# or run the pre-compiled version directly:
node examples/06_multi_file/main.js
```

### HTTP Server

```bash
ntl run examples/07_http_server.ntl
# then: curl http://localhost:3000
```

### Validation

```bash
ntl run examples/08_validate.ntl
```

### Events

```bash
ntl run examples/09_events.ntl
```

### Language Features

```bash
ntl run examples/10_language_features.ntl
```

### Cache + Logger

```bash
ntl run examples/11_cache_logger.ntl
```

### Test Runner

```bash
ntl run examples/12_test_runner.ntl
```

---

### Full REST API Example

```ntl
val http     = require("ntl:http")
val validate = require("ntl:validate")
val { Logger } = require("ntl:logger")
val { Cache }  = require("ntl:cache")
val { sqlite } = require("ntl:db")
val env        = require("ntl:env")

env.load()

val log   = new Logger({ name: "api" })
val db    = sqlite(env.get("DB_PATH", ":memory:"))
val cache = new Cache({ maxSize: 500, ttl: 30000 })
val app   = http.createServer()

db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE)")

val userSchema = validate.object({
  name:  validate.string().min(2).max(100),
  email: validate.string().email(),
})

app.get("/users", (req, res) => {
  val cached = cache.get("users:all")
  if cached { res.json(cached); return }
  val rows = db.all("SELECT * FROM users ORDER BY name")
  cache.set("users:all", rows)
  res.json(rows)
})

app.get("/users/:id", (req, res) => {
  val user = db.get("SELECT * FROM users WHERE id = ?", [req.params.id])
  if !user { res.status(404).json({ error: "User not found" }); return }
  res.json(user)
})

app.post("/users", (req, res) => {
  val r = userSchema.validate(req.body)
  if !r.ok { res.status(400).json({ errors: r.errors }); return }
  val result = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run(r.value.name, r.value.email)
  cache.delete("users:all")
  res.status(201).json({ id: result.lastInsertRowid, ...r.value })
})

app.listen(env.getNumber("PORT", 3000), () => log.info("API running", { port: 3000 }))
```

---

## Deployment

NTL-lang integrates cleanly into existing Node.js infrastructure.

### Production

```bash
# Compile to JavaScript, then run with Node
ntl build src/main.ntl --out dist/ --target cjs
node dist/main.js

# Or run NTL-lang files directly with the runtime
node main.js run src/app.ntl
```

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
# No npm install required for standard NTL-lang apps
CMD ["node", "main.js", "run", "src/app.ntl"]
```

### Using npm packages

NTL-lang works with every npm package. Import them the same way you would in Node.js:

```ntl
val express        = require("express")
val { z }          = require("zod")
val Stripe         = require("stripe")
val { PrismaClient } = require("@prisma/client")
val knex           = require("knex")
```

### CI/CD

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
