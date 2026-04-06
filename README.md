NTL (Node Transpiled Language)

A simple and complete backend language that compiles to JavaScript.

Version 3.5.0 · Created by David Dev
https://github.com/Megamexlevi2/ntl-lang

---

NTL is a programming language designed to build backend systems without the usual complexity of the Node.js ecosystem.

You write NTL. It compiles into clean JavaScript. Node.js runs it.

No dependency management. No setup overhead. Just code.
The `have` Operator and ifhave
---

Example

val http = require("ntl:http")

val app = new http.Router()

app.get("/", (req, res) => {
  res.json({ hello: "world" })
})

http.listen(3000, app)

---

Quick Start

npm install -g @david0dev/ntl-lang
ntl run server.ntl

---

Why NTL?

- No external dependencies
- Built-in backend modules
- Clean JavaScript output
- Minimal setup
- Focused on real backend use

---

What you get out of the box

- HTTP server ("ntl:http")
- Database ("ntl:db")
- Authentication & crypto ("ntl:crypto")
- Validation ("ntl:validate")
- WebSockets ("ntl:ws")
- Events & Pub/Sub ("ntl:events")
- Logging ("ntl:logger")
- Caching ("ntl:cache")
- Queues ("ntl:queue")
- Email ("ntl:mail")
- Config & environment ("ntl:env")
- Testing ("ntl:test")

Everything is included. No npm install required.

---

Table of Contents

1. What is NTL?
2. Installation & First Steps
3. Language Fundamentals
4. Advanced Language Features
5. HTTP Server — "ntl:http"
6. Database — "ntl:db"
7. Cryptography & Auth — "ntl:crypto"
8. Input Validation — "ntl:validate"
9. WebSockets — "ntl:ws"
10. Events & Pub/Sub — "ntl:events"
11. Logging — "ntl:logger"
12. Caching — "ntl:cache"
13. Job Queues — "ntl:queue"
14. Email — "ntl:mail"
15. Environment & Config — "ntl:env"
16. AI & LLM Integration — "ntl:ai"
17. Testing — "ntl:test"
18. CLI Reference
19. Node.js Interoperability
20. Game Engine Modules

---

1. What is NTL?

NTL is a programming language that compiles to JavaScript and runs on Node.js. It was created to simplify backend development by removing the need for external dependencies and reducing setup complexity.

Instead of managing multiple libraries, NTL provides a complete standard library covering the core needs of backend systems.

Below is a simplified view of how NTL works internally:

your code (.ntl)
    ↓
Lexer
Parser
ScopeAnalyzer
TypeInferer
CodeGen
TreeShaker
    ↓
output (.js)

The generated JavaScript is clean, readable, and predictable, making debugging easier and removing the need for source maps in most cases.

Requirements: Node.js 18 or later. Node.js 22+ required for "ntl:db".

The `log` keyword is a built-in shorthand for `console.log`. It is not a function call — it is a statement that accepts an expression.

### Your First Server

```ntl
val http = require("ntl:http")

val router = new http.Router()

router.get("/", (req, res) => {
  res.json({ hello: "world" })
})

http.listen(3000, router, () => log "Running on port 3000")
```

```bash
ntl run server.ntl
```

Visit `http://localhost:3000` and you get `{"hello":"world"}`. That is the full stack.

### Compiling to JavaScript

```bash
ntl build server.ntl -o dist/server.js
```

The output `dist/server.js` runs with plain `node dist/server.js`. No NTL runtime is required at execution time.

---

## 3. Language Fundamentals

### Variables

NTL has four variable declaration keywords. The difference matters:

```ntl
val name = "David"       // immutable binding — cannot be reassigned
var count = 0            // mutable — can be reassigned
let buffer = []          // same as var, alias for familiarity
const PI = 3.14159       // same as val, alias for JS developers
```

`val` and `const` declare a binding that cannot be reassigned. If you try to reassign a `val`, the compiler will catch it. Use `val` by default and `var` only when you genuinely need to mutate the variable.

```ntl
val x = 10
x = 20      // Error: cannot reassign val

var y = 10
y = 20      // Fine
```

### Data Types

NTL works with all the JavaScript primitive types:

```ntl
val aString   = "hello"
val aNumber   = 42
val aFloat    = 3.14
val aBool     = true
val nothing   = null
val empty     = undefined
val aList     = [1, 2, 3]
val anObject  = { name: "Alice", age: 30 }
```

**String interpolation** uses template literals:

```ntl
val user = "Alice"
val msg  = `Hello, ${user}! You have ${3 + 2} messages.`
log msg
```

**Multiline strings:**

```ntl
val html = `
  <div>
    <h1>Hello</h1>
  </div>
`
```

**Arrays:**

```ntl
val fruits = ["apple", "banana", "mango"]

log fruits[0]           // "apple"
log fruits.length       // 3

fruits.push("orange")
val sliced = fruits.slice(1, 3)  // ["banana", "mango"]
```

**Objects:**

```ntl
val person = {
  name: "Alice",
  age: 30,
  address: {
    city: "São Paulo",
    country: "Brazil"
  }
}

log person.name           // "Alice"
log person.address.city   // "São Paulo"
log person["age"]         // 30
```

**Optional chaining:**

```ntl
val city = person?.address?.city     // "São Paulo" or undefined
val zip  = person?.address?.zip      // undefined, no error
```

**Nullish coalescing:**

```ntl
val name = user?.name ?? "Anonymous"
val port = config?.port ?? 3000
```

### Operators

All standard arithmetic, comparison, and logical operators work as expected:

```ntl
// Arithmetic
val sum  = 10 + 5     // 15
val diff = 10 - 3     // 7
val prod = 4 * 3      // 12
val quot = 10 / 4     // 2.5
val rem  = 10 % 3     // 1
val pow  = 2 ** 10    // 1024

// Comparison
val eq   = 1 === 1    // true (strict equality)
val neq  = 1 !== 2    // true
val lt   = 3 < 5      // true
val gte  = 5 >= 5     // true

// Logical
val and  = true && false   // false
val or   = true || false   // true
val not  = !true           // false

// Assignment shortcuts
var n = 0
n += 5    // n is 5
n -= 2    // n is 3
n *= 4    // n is 12
n /= 3    // n is 4
n **= 2   // n is 16
n++       // n is 17
n--       // n is 16
```

**Pipeline operator** (`|>`) — passes the result of the left side as the argument to the right side:

```ntl
val result = [1, 2, 3, 4, 5]
  |> (arr) => arr.filter(n => n % 2 === 0)
  |> (arr) => arr.map(n => n * 10)
  |> (arr) => arr.reduce((acc, n) => acc + n, 0)

log result   // 60
```

### Control Flow

**if / elif / else:**

```ntl
val score = 85

if score >= 90 {
  log "Excellent"
} elif score >= 75 {
  log "Good"
} elif score >= 60 {
  log "Average"
} else {
  log "Needs improvement"
}
```

**unless** — the inverse of `if`, reads more naturally in some cases:

```ntl
unless user.isVerified {
  return res.status(403).json({ error: "Email not verified" })
}
```

**Ternary operator:**

```ntl
val label = score >= 60 ? "passing" : "failing"
```

**while:**

```ntl
var i = 0
while i < 5 {
  log i
  i++
}
```

**do / while:**

```ntl
var attempts = 0
do {
  attempts++
  val result = tryConnect()
  if result.ok { break }
} while attempts < 3
```

**for...of** — iterating over arrays and iterables:

```ntl
val users = ["Alice", "Bob", "Carol"]

for val user of users {
  log user
}
```

**for...in** — iterating over object keys:

```ntl
val config = { host: "localhost", port: 3000, debug: true }

for val key in config {
  log key + " = " + config[key]
}
```

**each** — a cleaner alias for `for...of`:

```ntl
each user of users {
  log "User: " + user
}
```

**range** — built-in range statement:

```ntl
for val i of range(0, 10) {
  log i     // 0 through 9
}

for val i of range(0, 10, 2) {
  log i     // 0, 2, 4, 6, 8
}
```

**repeat** — repeat a block N times:

```ntl
repeat 5 {
  log "hello"
}
```

**loop** — infinite loop (use `break` to exit):

```ntl
loop {
  val line = readLine()
  if line == "quit" { break }
  process(line)
}
```

**break and continue:**

```ntl
for val n of range(0, 10) {
  if n == 3 { continue }   // skip 3
  if n == 7 { break }      // stop at 7
  log n
}
```

**try / catch / finally:**

```ntl
try {
  val data = JSON.parse(input)
  process(data)
} catch err {
  log "Parse error: " + err.message
} finally {
  cleanup()
}
```

**raise / throw:**

```ntl
fn divide(a, b) {
  if b == 0 {
    raise new Error("Cannot divide by zero")
  }
  return a / b
}
```

### Functions

**Basic function declaration:**

```ntl
fn greet(name) {
  return "Hello, " + name + "!"
}

log greet("Alice")   // "Hello, Alice!"
```

**Arrow functions:**

```ntl
val add = (a, b) => a + b
val square = n => n * n
val noArgs = () => "hello"
```

**Default parameters:**

```ntl
fn createUser(name, role = "user", active = true) {
  return { name, role, active }
}

createUser("Alice")                    // { name: "Alice", role: "user", active: true }
createUser("Bob", "admin")             // { name: "Bob", role: "admin", active: true }
createUser("Carol", "user", false)     // { name: "Carol", role: "user", active: false }
```

**Rest parameters:**

```ntl
fn sum(...numbers) {
  return numbers.reduce((acc, n) => acc + n, 0)
}

log sum(1, 2, 3, 4, 5)    // 15
```

**Async functions:**

```ntl
async fn fetchUser(id) {
  val res  = await http.fetch("https://api.example.com/users/" + id)
  val data = await res.json()
  return data
}

val user = await fetchUser(42)
log user.name
```

**Immediately invoked:**

```ntl
val result = ((x, y) => x + y)(10, 20)
log result    // 30
```

**Higher-order functions:**

```ntl
fn withLogging(fn) {
  return (...args) => {
    log "Calling with: " + JSON.stringify(args)
    val result = fn(...args)
    log "Result: " + JSON.stringify(result)
    return result
  }
}

val loggedAdd = withLogging((a, b) => a + b)
loggedAdd(3, 4)
```

**Closures:**

```ntl
fn makeCounter(start = 0) {
  var count = start
  return {
    increment: () => { count++; return count },
    decrement: () => { count--; return count },
    value:     () => count,
    reset:     () => { count = start }
  }
}

val counter = makeCounter(10)
log counter.increment()   // 11
log counter.increment()   // 12
log counter.value()       // 12
counter.reset()
log counter.value()       // 10
```

### Classes

**Basic class:**

```ntl
class Animal {
  constructor(name, sound) {
    this.name  = name
    this.sound = sound
  }

  fn speak() {
    return this.name + " says " + this.sound
  }

  fn toString() {
    return "Animal(" + this.name + ")"
  }
}

val dog = new Animal("Rex", "woof")
log dog.speak()      // "Rex says woof"
```

**Inheritance:**

```ntl
class Dog extends Animal {
  constructor(name, breed) {
    super(name, "woof")
    this.breed = breed
  }

  fn fetch(item) {
    return this.name + " fetches the " + item + "!"
  }

  override fn toString() {
    return "Dog(" + this.name + ", " + this.breed + ")"
  }
}

val buddy = new Dog("Buddy", "Labrador")
log buddy.speak()          // "Buddy says woof"
log buddy.fetch("ball")    // "Buddy fetches the ball!"
```

**Static members:**

```ntl
class MathUtils {
  static fn clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  static fn lerp(a, b, t) {
    return a + (b - a) * t
  }

  static PI = 3.14159265358979
}

log MathUtils.clamp(150, 0, 100)    // 100
log MathUtils.lerp(0, 100, 0.5)    // 50
```

**Getters and setters:**

```ntl
class Temperature {
  constructor(celsius) {
    this._celsius = celsius
  }

  get celsius()    { return this._celsius }
  get fahrenheit() { return this._celsius * 9/5 + 32 }
  get kelvin()     { return this._celsius + 273.15 }

  set celsius(value) {
    if value < -273.15 {
      raise new Error("Temperature below absolute zero")
    }
    this._celsius = value
  }
}

val temp = new Temperature(100)
log temp.fahrenheit    // 212
log temp.kelvin        // 373.15
temp.celsius = 0
log temp.fahrenheit    // 32
```

**Abstract classes:**

```ntl
abstract class Shape {
  abstract fn area()
  abstract fn perimeter()

  fn describe() {
    return "Shape with area " + this.area().toFixed(2)
  }
}

class Circle extends Shape {
  constructor(radius) {
    super()
    this.radius = radius
  }

  fn area()      { return Math.PI * this.radius ** 2 }
  fn perimeter() { return 2 * Math.PI * this.radius }
}

val c = new Circle(5)
log c.area()       // 78.53...
log c.describe()   // "Shape with area 78.54"
```

**Private fields (using `private` keyword):**

```ntl
class BankAccount {
  private balance = 0
  private owner

  constructor(owner, initialBalance) {
    this.owner   = owner
    this.balance = initialBalance || 0
  }

  fn deposit(amount) {
    if amount <= 0 { raise new Error("Invalid amount") }
    this.balance += amount
    return this
  }

  fn withdraw(amount) {
    if amount > this.balance { raise new Error("Insufficient funds") }
    this.balance -= amount
    return this
  }

  get currentBalance() { return this.balance }
}
```

### Modules

**Importing NTL standard library modules:**

```ntl
val http   = require("ntl:http")
val {Database} = require("ntl:db")
val crypto = require("ntl:crypto")
val {createLogger} = require("ntl:logger")
val {Cache} = require("ntl:cache")
val {schema} = require("ntl:validate")
```

**Importing local files:**

```ntl
val utils     = require("./utils")
val {Router}  = require("./routes/api")
val config    = require("../config")
```

**Importing npm packages:**

```ntl
val axios   = require("axios")
val lodash  = require("lodash")
val sharp   = require("sharp")
```

**Exporting from a module:**

```ntl
fn add(a, b) {
  return a + b
}

fn multiply(a, b) {
  return a * b
}

val VERSION = "1.0.0"

export { add, multiply, VERSION }
```

Or the CommonJS style (both work):

```ntl
module.exports = { add, multiply, VERSION }
```

---

## 4. Advanced Language Features

### Pattern Matching

The `match` statement is NTL's version of a switch, but significantly more powerful. It can match against values, types, arrays, objects, and ranges.

**Basic value matching:**

```ntl
val status = 404

val message = match status {
  case 200 => "OK"
  case 201 => "Created"
  case 400 => "Bad Request"
  case 401 => "Unauthorized"
  case 403 => "Forbidden"
  case 404 => "Not Found"
  case 500 => "Internal Server Error"
  default  => "Unknown status " + status
}

log message    // "Not Found"
```

**Matching with guards (the `when` clause):**

```ntl
val score = 87

val grade = match score {
  case n when n >= 90 => "A"
  case n when n >= 80 => "B"
  case n when n >= 70 => "C"
  case n when n >= 60 => "D"
  default             => "F"
}

log grade    // "B"
```

**Matching multiple patterns in one case:**

```ntl
val day = "Saturday"

val type = match day {
  case "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" => "Weekday"
  case "Saturday" | "Sunday" => "Weekend"
  default => "Unknown"
}
```

**Matching on type:**

```ntl
fn describe(value) {
  return match typeof value {
    case "string"  => "A string of length " + value.length
    case "number"  => "A number: " + value
    case "boolean" => "A boolean: " + value
    case "object"  => value === null ? "null" : "An object"
    default        => "Something else"
  }
}
```

**Matching as an expression in a return:**

```ntl
fn httpStatus(code) {
  return match code {
    case 200 => { ok: true,  message: "Success" }
    case 404 => { ok: false, message: "Not found" }
    case 500 => { ok: false, message: "Server error" }
    default  => { ok: false, message: "Unknown" }
  }
}
```

### The `have` Operator

`have` is one of NTL's most expressive features. It combines membership tests, type checks, range checks, regex matching, and more into a single, readable operator. It is always used inside conditions.

**Membership check (`have in`):**

```ntl
val role = "admin"

if role have in ["admin", "moderator", "superuser"] {
  log "Access granted"
}

val fruits = ["apple", "banana", "mango"]
if "banana" have in fruits {
  log "We have bananas"
}
```

**Range check (`have between`):**

```ntl
val age = 25

if age have between 18 65 {
  log "Working age"
}

if score have between 90 100 {
  log "Perfect score"
}
```

**Regex match (`have matches`):**

```ntl
val email = "user@example.com"

if email have matches /^[\w.]+@[\w.]+\.\w+$/ {
  log "Valid email"
}

val phone = "+55 11 99999-9999"
if phone have matches /^\+\d{2} \d{2} \d{5}-\d{4}$/ {
  log "Valid Brazilian phone"
}
```

**String prefix/suffix (`have startsWith` / `have endsWith`):**

```ntl
val url = "https://api.example.com/users"

if url have startsWith "https://" {
  log "Secure connection"
}

if url have endsWith "/users" {
  log "Users endpoint"
}
```

**Type check (`have is`):**

```ntl
val value = 42

if value have is "number" {
  log "It is a number"
}

if value have is "string" {
  log "It is a string"
} else {
  log "Not a string"
}
```

**Not-in check (`have not in`):**

```ntl
val status = "pending"

if status have not in ["cancelled", "rejected"] {
  processOrder(status)
}
```

**`ifhave` — combined check and binding:**

The `ifhave` statement lets you check and extract a value in one step:

```ntl
ifhave user.token as token {
  log "Token: " + token
} else {
  log "No token"
}
```

### Destructuring

**Array destructuring:**

```ntl
val [first, second, third] = [10, 20, 30]
log first    // 10
log second   // 20

val [head, ...tail] = [1, 2, 3, 4, 5]
log head    // 1
log tail    // [2, 3, 4, 5]

// Skipping elements
val [, , third] = [10, 20, 30]
log third   // 30
```

**Object destructuring:**

```ntl
val { name, age, city } = person

// With renaming
val { name: userName, age: userAge } = person
log userName   // same as person.name

// With defaults
val { name, role = "user", active = true } = userData

// Nested
val { address: { city, country } } = person
```

**Function parameter destructuring:**

```ntl
fn greetUser({ name, role = "user" }) {
  return "Hello, " + name + " (" + role + ")"
}

greetUser({ name: "Alice", role: "admin" })
greetUser({ name: "Bob" })   // uses default role
```

**Destructuring in loops:**

```ntl
val users = [
  { name: "Alice", score: 95 },
  { name: "Bob",   score: 82 },
]

for val { name, score } of users {
  log name + ": " + score
}
```

### Generators

Generators are functions that can pause and resume execution, yielding values one at a time.

```ntl
fn* counter(start, end) {
  var i = start
  while i <= end {
    yield i
    i++
  }
}

for val n of counter(1, 5) {
  log n     // 1, 2, 3, 4, 5
}
```

**Infinite generators:**

```ntl
fn* fibonacci() {
  var a = 0
  var b = 1
  loop {
    yield a
    val next = a + b
    a = b
    b = next
  }
}

val fib = fibonacci()
log fib.next().value    // 0
log fib.next().value    // 1
log fib.next().value    // 1
log fib.next().value    // 2
log fib.next().value    // 3
```

**Async generators:**

```ntl
async fn* paginate(url) {
  var page = 1
  loop {
    val res  = await http.fetch(url + "?page=" + page)
    val data = await res.json()
    if !data.items.length { return }
    yield data.items
    if !data.hasMore { return }
    page++
  }
}

for await val items of paginate("https://api.example.com/products") {
  processItems(items)
}
```

### Decorators

Decorators are applied to classes and functions using `@`. NTL ships several built-in decorators.

**`@singleton`** — ensures only one instance of the class is ever created:

```ntl
@singleton
class Config {
  constructor() {
    this.port = 3000
    this.debug = false
  }
}

val a = new Config()
val b = new Config()
log a === b    // true — same instance
```

**`@memo`** — caches the return value of a function by its arguments:

```ntl
@memo
fn expensiveCalculation(n) {
  log "Computing for " + n   // only runs once per unique n
  return n * n * n
}

expensiveCalculation(10)   // computes
expensiveCalculation(10)   // cached
expensiveCalculation(20)   // computes
```

**`@retry(n)`** — retries an async function up to n times on failure:

```ntl
@retry(3)
async fn callExternalAPI(url) {
  val res = await fetch(url)
  if !res.ok { raise new Error("API failed") }
  return res.json()
}
```

**`@timeout(ms)`** — rejects if the function takes longer than the given milliseconds:

```ntl
@timeout(5000)
async fn slowQuery() {
  return db.table("logs").all()
}
```

**`@cache(ttl)`** — caches the function result for the given TTL in milliseconds:

```ntl
@cache(60000)
async fn getTopProducts() {
  return db.table("products").orderByDesc("sales").limit(10).all()
}
```

**`@log`** — automatically logs calls and return values:

```ntl
@log
fn processOrder(orderId) {
  return db.table("orders").find(orderId)
}
```

**`@deprecated`** — logs a warning when the function is called:

```ntl
@deprecated
fn oldMethod() {
  return newMethod()
}
```

**`@bind`** — automatically binds the class method to the instance:

```ntl
class Timer {
  constructor() {
    this.count = 0
  }

  @bind
  fn tick() {
    this.count++   // `this` is always correct, even in callbacks
  }
}

val timer = new Timer()
setInterval(timer.tick, 1000)   // works correctly
```

### Macros

Macros let you define code templates that get expanded at compile time. They are useful for reducing repetitive boilerplate.

```ntl
macro assert_gt(a, b) {
  if (!(a > b)) throw new Error(`Expected ${a} > ${b}`)
}

// Usage
assert_gt(score, 0)       // expands to: if (!(score > 0)) throw new Error(...)
assert_gt(items.length, 10)
```

```ntl
macro log_time(label, body) {
  const __t0 = Date.now()
  body
  console.log(label + ': ' + (Date.now() - __t0) + 'ms')
}

log_time("database query", {
  val users = db.table("users").all()
})
```

### Traits & Interfaces

**Interfaces** define a shape that classes must conform to. The compiler validates that implementing classes have the required members (in strict mode).

```ntl
interface Serializable {
  fn toJSON()
  fn toString()
}

interface Repository {
  fn findById(id)
  fn findAll()
  fn save(entity)
  fn delete(id)
}
```

**Traits** are like interfaces but can contain implementation:

```ntl
trait Timestamps {
  fn setCreatedAt() {
    this.createdAt = new Date().toISOString()
  }

  fn setUpdatedAt() {
    this.updatedAt = new Date().toISOString()
  }

  fn touch() {
    this.setUpdatedAt()
    return this
  }
}

trait SoftDelete {
  fn softDelete() {
    this.deletedAt = new Date().toISOString()
    this.isDeleted = true
    return this
  }

  fn restore() {
    this.deletedAt = null
    this.isDeleted = false
    return this
  }
}

class User implements Timestamps, SoftDelete {
  constructor(name) {
    this.name = name
    this.createdAt = null
    this.updatedAt = null
    this.deletedAt = null
    this.isDeleted = false
    this.setCreatedAt()
  }
}
```

### Enums

```ntl
enum Status {
  Pending,
  Active,
  Suspended,
  Deleted
}

enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH"
}

val userStatus = Status.Active

if userStatus == Status.Active {
  log "User is active"
}

val method = HttpMethod.POST
log method   // "POST"
```

**Const enums** are inlined at compile time:

```ntl
const enum Direction {
  North = 0,
  East  = 90,
  South = 180,
  West  = 270
}
```

### Namespaces

Namespaces group related declarations without polluting the global scope:

```ntl
namespace Auth {
  val SECRET = process.env.JWT_SECRET

  fn sign(payload) {
    return crypto.signJWT(payload, SECRET)
  }

  fn verify(token) {
    return crypto.verifyJWT(token, SECRET)
  }

  fn middleware(req, res, next) {
    val token = req.headers.authorization?.replace("Bearer ", "")
    if !token { return res.status(401).json({ error: "Unauthorized" }) }
    try {
      req.user = Auth.verify(token)
      next()
    } catch {
      res.status(401).json({ error: "Invalid token" })
    }
  }
}

namespace Validators {
  fn isEmail(s)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) }
  fn isPhone(s)    { return /^\+?\d{10,15}$/.test(s) }
  fn isURL(s)      { try { new URL(s); return true } catch { return false } }
}
```

### guard, defer, spawn

**`guard`** — early exit if a condition is not met. Inspired by Swift. Useful for input validation at the top of functions:

```ntl
fn processPayment(amount, userId) {
  guard amount > 0 else {
    return { error: "Amount must be positive" }
  }

  guard userId else {
    return { error: "User ID required" }
  }

  val user = db.table("users").find(userId)
  guard user else {
    return { error: "User not found" }
  }

  // From here on, we know amount > 0, userId exists, and user exists
  return chargeUser(user, amount)
}
```

**`defer`** — schedules code to run when the current block exits, regardless of how it exits (success or error):

```ntl
fn withFile(path, fn) {
  val file = openFile(path)
  defer { file.close() }    // will run no matter what

  return fn(file)
}
```

**`spawn`** — starts a concurrent async task without awaiting it:

```ntl
async fn handleRequest(req, res) {
  val data = processRequest(req)
  res.json({ ok: true, data })

  // Fire-and-forget background tasks
  spawn sendAnalyticsEvent("request_processed", { path: req.path })
  spawn updateUserLastSeen(req.user.id)
}
```

---

## 5. HTTP Server — `ntl:http`

The HTTP module provides a complete server with routing, middleware, CORS, rate limiting, static file serving, and an HTTP client.

### Basic Setup

```ntl
val http = require("ntl:http")

val router = new http.Router()

http.listen(3000, router, () => {
  log "Server running on http://localhost:3000"
})
```

### Router & Routes

```ntl
val router = new http.Router()

router.get("/users",      getUsers)
router.post("/users",     createUser)
router.get("/users/:id",  getUserById)
router.put("/users/:id",  updateUser)
router.delete("/users/:id", deleteUser)
router.patch("/users/:id/status", updateStatus)
```

**Route parameters:**

```ntl
router.get("/users/:id/posts/:postId", (req, res) => {
  val userId = req.params.id
  val postId = req.params.postId
  res.json({ userId, postId })
})
```

**Query string:**

```ntl
router.get("/search", (req, res) => {
  val q     = req.query.q      || ""
  val page  = req.query.page   || 1
  val limit = req.query.limit  || 20
  res.json({ q, page, limit })
})
```

**Wildcard routes:**

```ntl
router.get("/files/*", (req, res) => {
  val filePath = req.params[0]    // everything after /files/
  res.file("./uploads/" + filePath)
})
```

**Catch-all (any method):**

```ntl
router.all("/api/*", authMiddleware)
```

### Request Object

```ntl
router.post("/example", (req, res) => {
  req.method       // "POST"
  req.url          // "/example?foo=bar"
  req.path         // "/example"
  req.query        // { foo: "bar" }
  req.headers      // { "content-type": "application/json", ... }
  req.params       // route params { id: "123" }
  req.body         // parsed request body (JSON, form)
  req.cookies      // { sessionId: "abc123" }
  req.ip           // client IP address
  req.get("host")  // single header value
  req.param("id")  // checks params, then query
})
```

### Response Object

```ntl
// JSON response
res.json({ message: "ok" })
res.status(201).json({ id: newId })
res.status(400).json({ error: "Bad request" })

// Text response
res.text("Hello, world!")
res.status(200).text("OK")

// HTML response
res.html("<h1>Hello</h1>")

// Redirect
res.redirect("/login")
res.redirect("https://example.com", 302)

// Set headers
res.header("X-Custom-Header", "value")
res.set("Content-Type", "text/csv")
res.type("json")    // sets Content-Type from MIME table

// Set cookie
res.cookie("sessionId", token, {
  httpOnly: true,
  secure: true,
  maxAge: 86400,
  sameSite: "Strict"
})

// Stream a file
res.file("./downloads/report.pdf")

// Stream a readable
res.stream(fs.createReadStream("./large-file.csv"))
```

### Middleware

Middleware functions receive `(req, res, next)` and must call `next()` to pass control to the next middleware or route handler.

```ntl
fn loggerMiddleware(req, res, next) {
  val start = Date.now()
  log req.method + " " + req.path
  next()
}

fn authMiddleware(req, res, next) {
  val token = req.headers.authorization?.replace("Bearer ", "")
  if !token {
    return res.status(401).json({ error: "No token" })
  }
  try {
    req.user = crypto.verifyJWT(token, process.env.JWT_SECRET)
    next()
  } catch err {
    res.status(401).json({ error: "Invalid token" })
  }
}

router.use(loggerMiddleware)
router.use(http.cors())
router.use(http.json())       // built-in, parses JSON body automatically

// Apply to specific routes
router.get("/dashboard", authMiddleware, dashboardHandler)
```

### Built-in Middleware

**CORS:**

```ntl
router.use(http.cors())

// With options
router.use(http.cors({
  origin:      "https://myapp.com",
  methods:     "GET,POST,PUT,DELETE",
  headers:     "Content-Type,Authorization",
  credentials: true
}))
```

**Rate limiting:**

```ntl
router.use(http.rateLimit({
  windowMs: 60000,   // 1 minute window
  max:      100      // max 100 requests per window per IP
}))
```

**Static file serving:**

```ntl
router.use(http.static("./public"))
router.use(http.static("./public", { index: "index.html" }))
```

### Error Handling

```ntl
router.notFound((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path })
})

router.onError((err, req, res) => {
  log "Error: " + err.message
  res.status(500).json({ error: err.message })
})
```

### HTTP Client

The `http.fetch` function makes outgoing HTTP requests without any npm dependencies:

```ntl
// GET request
val res  = await http.fetch("https://api.github.com/users/octocat")
val user = res.data
log user.login

// POST request
val res = await http.post("https://api.example.com/users", {
  body: { name: "Alice", email: "alice@example.com" },
  headers: { "Authorization": "Bearer " + token }
})
log res.status    // 201

// PUT
val res = await http.put("https://api.example.com/users/1", {
  body: { name: "Alice Updated" }
})

// DELETE
val res = await http.delete("https://api.example.com/users/1")
log res.data    // { deleted: true }
```

**Response object:**

```ntl
res.status     // HTTP status code (200, 404, etc.)
res.headers    // response headers object
res.data       // parsed body (auto JSON if content-type is application/json)
res.raw        // raw string body
res.ok         // true if status is 2xx
res.json()     // force-parse as JSON
res.text()     // return raw string
```

### SSE (Server-Sent Events)

```ntl
router.get("/events", (req, res) => {
  res.header("Content-Type", "text/event-stream")
  res.header("Cache-Control", "no-cache")
  res.header("Connection", "keep-alive")

  val interval = setInterval(() => {
    val data = JSON.stringify({ time: Date.now(), status: "ok" })
    res._raw.write("data: " + data + "\n\n")
  }, 1000)

  req._raw.on("close", () => {
    clearInterval(interval)
  })
})
```

---

## 6. Database — `ntl:db`

The database module provides a full SQLite ORM built on Node.js 22+'s native `node:sqlite`. No external packages required.

### Connecting

```ntl
val {Database} = require("ntl:db")

val db = new Database("./app.db")        // file-based
val mem = new Database(":memory:")       // in-memory
```

The constructor automatically enables WAL mode, foreign keys, and synchronous normal mode for the best performance/safety balance.

**Connection pool (singleton per file):**

```ntl
val {connect} = require("ntl:db")

val db = connect("./app.db")    // returns same instance if already open
```

### Creating Tables

```ntl
db.createTable("users", (t) => {
  t.id()                              // INTEGER PRIMARY KEY AUTOINCREMENT
  t.text("name")                      // TEXT NOT NULL
  t.text("email").unique()            // TEXT NOT NULL UNIQUE
  t.text("password_hash")
  t.text("role").default("user")
  t.boolean("active", true)           // INTEGER DEFAULT 1
  t.integer("login_count", 0)
  t.real("balance", 0.0)
  t.json("metadata")                  // stored as TEXT
  t.timestamps()                      // created_at, updated_at as TEXT
})

db.createTable("posts", (t) => {
  t.id()
  t.integer("user_id")
  t.text("title")
  t.text("body")
  t.text("status").default("draft")
  t.integer("views", 0)
  t.timestamps()
  t.foreign("user_id", "users", "id")
})
```

**Column types available:**

| Method | SQLite type | Notes |
|---|---|---|
| `t.id()` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `t.text(name)` | `TEXT NOT NULL` | |
| `t.integer(name, default)` | `INTEGER NOT NULL DEFAULT n` | |
| `t.real(name, default)` | `REAL NOT NULL DEFAULT n` | |
| `t.boolean(name, default)` | `INTEGER NOT NULL DEFAULT n` | stored as 0/1 |
| `t.json(name)` | `TEXT` | stored as JSON string |
| `t.timestamps()` | `created_at, updated_at TEXT` | |
| `t.nullable(name, type)` | `type` | allows NULL |
| `t.unique()` | adds UNIQUE to previous column | |
| `t.index(cols)` | creates index | |
| `t.foreign(col, table, ref)` | adds FOREIGN KEY | |

### Query Builder

The query builder creates immutable queries — each method returns a new builder instance, so you can branch and reuse queries.

**Basic queries:**

```ntl
// Get all records
val users = db.table("users").all()

// Find by primary key
val user = db.table("users").find(1)

// Get first match
val admin = db.table("users").where("role", "admin").first()

// Count
val total = db.table("users").count()
val admins = db.table("users").where("role", "admin").count()
```

**Filtering:**

```ntl
// Simple equality
db.table("users").where("role", "admin")

// Custom operator
db.table("users").where("age", ">", 18)
db.table("users").where("balance", ">=", 1000)

// Multiple conditions (chained)
db.table("users")
  .where("active", true)
  .where("role", "admin")

// IN / NOT IN
db.table("users").whereIn("role", ["admin", "moderator"])
db.table("users").whereNotIn("status", ["banned", "deleted"])

// LIKE
db.table("users").whereLike("name", "Ali%")
db.table("users").whereLike("email", "%@gmail.com")

// BETWEEN
db.table("orders").whereBetween("total", 100, 500)

// NULL checks
db.table("users").whereNull("deleted_at")
db.table("users").whereNotNull("verified_at")
```

**Ordering, limiting, pagination:**

```ntl
// Order
db.table("posts").orderBy("created_at", "DESC")
db.table("posts").orderByDesc("views")
db.table("posts").orderBy("title", "ASC").orderBy("created_at", "DESC")

// Limit and offset
db.table("posts").limit(10)
db.table("posts").limit(10).offset(20)
db.table("posts").take(10).skip(20)    // aliases

// Pagination
val result = db.table("posts").paginate(page, 20)
// result = { data: [...], total: 100, page: 2, perPage: 20, lastPage: 5, hasMore: true }
```

**Selecting specific columns:**

```ntl
val names = db.table("users").select("name", "email").all()
val data  = db.table("users")
  .select("id", "name", "email")
  .where("active", true)
  .orderBy("name")
  .all()
```

**Joins:**

```ntl
val posts = db.table("posts")
  .join("users", "posts.user_id", "=", "users.id")
  .select("posts.title", "posts.created_at", "users.name as author")
  .where("posts.status", "published")
  .orderByDesc("posts.created_at")
  .all()
```

**Aggregates:**

```ntl
val total    = db.table("orders").sum("total")
val average  = db.table("ratings").avg("score")
val highest  = db.table("products").max("price")
val lowest   = db.table("products").min("price")

// Group by
val byStatus = db.table("orders")
  .select("status")
  .groupBy("status")
  .count("id as total")
  .all()
```

**Inserting:**

```ntl
val id = db.table("users").insert({
  name:          "Alice",
  email:         "alice@example.com",
  password_hash: crypto.hashPassword("secret"),
  role:          "user"
})

log id    // auto-incremented ID
```

**Updating:**

```ntl
val changed = db.table("users")
  .where("id", userId)
  .update({ name: "Alice Updated", updated_at: new Date().toISOString() })

log changed    // number of rows affected
```

**Deleting:**

```ntl
val deleted = db.table("users").where("id", userId).delete()
log deleted    // number of rows deleted
```

**Check existence:**

```ntl
val exists = db.table("users").where("email", email).exists()
if exists { return res.status(409).json({ error: "Email already taken" }) }
```

### Transactions

```ntl
db.transaction((db) => {
  val orderId = db.table("orders").insert({ user_id: userId, total: 150 })

  for val item of cartItems {
    db.table("order_items").insert({
      order_id:   orderId,
      product_id: item.productId,
      quantity:   item.quantity,
      price:      item.price
    })
    db.table("products")
      .where("id", item.productId)
      .update({ stock: item.currentStock - item.quantity })
  }

  db.table("carts").where("user_id", userId).delete()
})
```

If any statement inside the transaction throws, the whole transaction is automatically rolled back.

### Migrations

Migrations let you evolve your schema over time in a safe, versioned way.

```ntl
db.migration(1, (db) => {
  db.createTable("users", (t) => {
    t.id()
    t.text("name")
    t.text("email").unique()
    t.timestamps()
  })
}, (db) => {
  db.dropTable("users")
})

db.migration(2, (db) => {
  db.schema().addColumn("users", "role", "TEXT", { default: "user" })
  db.schema().addColumn("users", "active", "INTEGER", { default: 1 })
}, (db) => {
  // no easy rollback for ALTER TABLE in SQLite
})

db.migration(3, (db) => {
  db.createTable("posts", (t) => {
    t.id()
    t.integer("user_id")
    t.text("title")
    t.text("body")
    t.timestamps()
    t.foreign("user_id", "users", "id")
  })
}, (db) => {
  db.dropTable("posts")
})

db.migrate()    // runs all pending migrations
```

### Models

For more structured access, you can create a Model with auto-casting and automatic timestamps:

```ntl
val UserModel = db.model("users", {
  timestamps: true,
  softDelete: true,
  hidden:     ["password_hash"],
  casts: {
    active:   "boolean",
    metadata: "json",
    balance:  "number"
  }
})

val user  = UserModel.find(1)                   // auto-casts fields
val users = UserModel.all()                     // returns all (excludes soft-deleted)
val alice = UserModel.findBy("email", email)    // find by column

val newUser = UserModel.create({
  name: "Bob", email: "bob@example.com"
})

val updated = UserModel.update(1, { name: "Bob Updated" })

UserModel.delete(1)     // soft-deletes (sets deleted_at)
UserModel.restore(1)    // restores soft-deleted record

val count = UserModel.count()
val hasAlice = UserModel.exists("email", "alice@example.com")

val page = UserModel.paginate(1, 20)
```

### Raw Queries

```ntl
// Execute SQL directly
db.exec("VACUUM")
db.exec("CREATE INDEX idx_users_email ON users(email)")

// Run with parameters
db.run("UPDATE users SET login_count = login_count + 1 WHERE id = ?", [userId])

// Get single row
val row = db.get("SELECT * FROM users WHERE email = ?", [email])

// Get all rows
val rows = db.all("SELECT u.name, COUNT(p.id) as post_count FROM users u LEFT JOIN posts p ON p.user_id = u.id GROUP BY u.id")

// Prepared statements (for repeated execution)
val stmt = db.prepare("INSERT INTO logs (event, data) VALUES (?, ?)")
stmt.run("login", JSON.stringify({ userId, ip }))
stmt.run("logout", JSON.stringify({ userId }))
```

---

## 7. Cryptography & Auth — `ntl:crypto`

```ntl
val crypto = require("ntl:crypto")
```

### Hashing

```ntl
val hash1 = crypto.sha256("hello world")
val hash2 = crypto.sha512("hello world")
val hash3 = crypto.md5("hello world")
val hash4 = crypto.sha1("hello world")
```

**HMAC signatures:**

```ntl
val sig = crypto.hmacSha256("my-secret-key", "message to sign")
val sig2 = crypto.hmacSha512("my-secret-key", "message")
val sig3 = crypto.hmac("sha384", "key", "data")
```

### Password Hashing

NTL uses PBKDF2 with SHA-512 and a random salt, which is suitable for storing passwords:

```ntl
val hash = crypto.hashPassword("user-password")
// stored format: "iterations:salt:hash"

val valid = crypto.verifyPassword("user-password", hash)    // true
val wrong = crypto.verifyPassword("wrong-password", hash)   // false
```

**Timing-safe comparison** (prevents timing attacks):

```ntl
val equal = crypto.constantTimeEqual(userProvidedToken, storedToken)
```

### JWT (JSON Web Tokens)

```ntl
// Sign a token (expires in 24 hours = 86400 seconds)
val token = crypto.signJWT(
  { userId: 42, role: "admin" },
  process.env.JWT_SECRET,
  86400
)

// Verify and decode
try {
  val payload = crypto.verifyJWT(token, process.env.JWT_SECRET)
  log payload.userId    // 42
  log payload.role      // "admin"
  log payload.iat       // issued-at timestamp
  log payload.exp       // expiry timestamp
} catch err {
  log "Invalid or expired token: " + err.message
}
```

### AES-256 Encryption

```ntl
val encrypted = crypto.encryptAES("sensitive data", "my-secret-key")
// format: "iv_hex:encrypted_hex"

val original = crypto.decryptAES(encrypted, "my-secret-key")
log original    // "sensitive data"
```

### Random Values

```ntl
val bytes = crypto.randomBytes(32)       // 64-char hex string
val n     = crypto.randomInt(1, 100)     // random integer 1-99
val id    = crypto.uuid()                // RFC 4122 UUID v4
```

### Base64

```ntl
val encoded = crypto.base64Encode("Hello, world!")
val decoded = crypto.base64Decode(encoded)

// URL-safe base64 (no +, /, = chars — safe for URLs and headers)
val urlSafe = crypto.base64UrlEncode("Hello!")
val back    = crypto.base64UrlDecode(urlSafe)
```

### Complete Auth Example

```ntl
val http   = require("ntl:http")
val {Database} = require("ntl:db")
val crypto = require("ntl:crypto")

val db     = new Database("./auth.db")
val router = new http.Router()

db.createTable("users", (t) => {
  t.id()
  t.text("email").unique()
  t.text("password_hash")
  t.text("role").default("user")
  t.boolean("verified", false)
  t.timestamps()
})

val JWT_SECRET = process.env.JWT_SECRET || "dev-secret"

fn authMiddleware(req, res, next) {
  val header = req.headers.authorization || ""
  val token  = header.replace("Bearer ", "")
  if !token { return res.status(401).json({ error: "No token provided" }) }
  try {
    req.user = crypto.verifyJWT(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

router.use(http.cors())
router.use(http.json())

router.post("/register", (req, res) => {
  val { email, password } = req.body

  if !email || !password {
    return res.status(400).json({ error: "Email and password required" })
  }

  val exists = db.table("users").where("email", email).exists()
  if exists { return res.status(409).json({ error: "Email already registered" }) }

  val id = db.table("users").insert({
    email,
    password_hash: crypto.hashPassword(password),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  res.status(201).json({ id, email })
})

router.post("/login", (req, res) => {
  val { email, password } = req.body

  val user = db.table("users").where("email", email).first()
  if !user { return res.status(401).json({ error: "Invalid credentials" }) }

  val valid = crypto.verifyPassword(password, user.password_hash)
  if !valid { return res.status(401).json({ error: "Invalid credentials" }) }

  val token = crypto.signJWT({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, 86400)
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } })
})

router.get("/me", authMiddleware, (req, res) => {
  val user = db.table("users").find(req.user.id)
  res.json({ id: user.id, email: user.email, role: user.role })
})

http.listen(3000, router)
```

---

## 8. Input Validation — `ntl:validate`

```ntl
val {schema} = require("ntl:validate")
```

### Basic Schema Types

```ntl
// String
val nameSchema = schema.string().min(2).max(50)
val emailSchema = schema.string().email()
val urlSchema   = schema.string().url()
val slugSchema  = schema.string().slug()
val uuidSchema  = schema.string().uuid()

// Number
val ageSchema    = schema.number().integer().min(0).max(150)
val priceSchema  = schema.number().positive()
val portSchema   = schema.number().port()

// Boolean
val activeSchema = schema.boolean()

// Optional and nullable
val bioSchema    = schema.string().optional()
val refSchema    = schema.string().nullable()
val noteSchema   = schema.string().default("No notes")
```

### Object Schemas

```ntl
val CreateUserSchema = schema.object({
  name:     schema.string().min(2).max(50).label("Name"),
  email:    schema.string().email().label("Email"),
  password: schema.string().min(8).max(100).label("Password"),
  age:      schema.number().integer().min(18).optional(),
  role:     schema.string().oneOf(["user", "admin"]).default("user"),
  website:  schema.string().url().optional(),
})

val UpdateUserSchema = schema.object({
  name:    schema.string().min(2).max(50).optional(),
  email:   schema.string().email().optional(),
  active:  schema.boolean().optional(),
})
```

### Parsing and Validation

```ntl
// safe parse — never throws, returns { success, data, errors }
val result = CreateUserSchema.safeParse(req.body)

if !result.success {
  return res.status(400).json({
    error:  "Validation failed",
    issues: result.errors
  })
}

val user = result.data   // fully typed, defaults applied

// validate — throws ValidationError on failure
try {
  val data = CreateUserSchema.validate(req.body)
} catch err {
  if err.isValidationError {
    res.status(400).json({ errors: err.errors })
  }
}

// check — returns boolean
val isValid = CreateUserSchema.check(req.body)
```

### Array and Nested Schemas

```ntl
val TagsSchema = schema.array(schema.string().min(1).max(30))
  .min(1).max(10)

val AddressSchema = schema.object({
  street:  schema.string(),
  city:    schema.string(),
  country: schema.string().length(2),
  zip:     schema.string().matches(/^\d{5}(-\d{4})?$/),
})

val OrderSchema = schema.object({
  userId:  schema.number().integer().positive(),
  items:   schema.array(schema.object({
    productId: schema.number().integer().positive(),
    quantity:  schema.number().integer().min(1),
    price:     schema.number().positive()
  })).min(1),
  address:   AddressSchema,
  coupon:    schema.string().optional(),
  notes:     schema.string().max(500).optional(),
})
```

### Custom Validation

```ntl
val PasswordSchema = schema.string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .test("has-uppercase", "Must contain at least one uppercase letter", (v) => /[A-Z]/.test(v))
  .test("has-digit", "Must contain at least one digit", (v) => /\d/.test(v))
  .test("has-special", "Must contain at least one special character", (v) => /[!@#$%^&*]/.test(v))
```

### Transform

```ntl
val EmailSchema = schema.string()
  .email()
  .transform((v) => v.toLowerCase().trim())

val PhoneSchema = schema.string()
  .pattern(/^\+?\d[\d\s\-().]+$/)
  .transform((v) => v.replace(/[\s\-().]/g, ""))
```

---

## 9. WebSockets — `ntl:ws`

The WebSocket module implements RFC 6455 natively with no external packages.

### Basic Server

```ntl
val http = require("ntl:http")
val ws   = require("ntl:ws")

val server = http.createServer()
val wss    = new ws.Server({ server })

wss.on("connection", (socket) => {
  log "Client connected: " + socket.id

  socket.on("message", (data) => {
    log "Received: " + data

    // Echo back
    socket.send("You said: " + data)

    // Send JSON
    socket.sendJSON({ echo: data, time: Date.now() })
  })

  socket.on("close", (code, reason) => {
    log "Client disconnected: " + code
  })

  socket.on("error", (err) => {
    log "Socket error: " + err.message
  })
})

server.listen(3000)
```

### Socket Methods

```ntl
socket.send("plain text message")
socket.sendJSON({ type: "update", data: payload })
socket.sendBinary(buffer)
socket.ping()
socket.close(1000, "Normal closure")
socket.close(1008, "Policy violation")

socket.isOpen       // boolean
socket.readyState   // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
socket.id           // unique hex ID
```

### Rooms and Broadcast

```ntl
val wss = new ws.Server({ server })

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    val msg = JSON.parse(raw)

    if msg.type == "join" {
      socket.join(msg.room)
      wss.to(msg.room).emit("system", {
        text: msg.username + " joined the room"
      })
    }

    if msg.type == "chat" {
      wss.to(msg.room).emit("message", {
        from: msg.username,
        text: msg.text,
        time: Date.now()
      })
    }

    if msg.type == "leave" {
      socket.leave(msg.room)
      wss.to(msg.room).emit("system", {
        text: msg.username + " left the room"
      })
    }
  })
})

// Emit to all
wss.broadcast("announcement", { text: "Server restarting in 5 minutes" })

// Emit to a room
wss.to("general").emit("message", { from: "System", text: "Hello room!" })

// Emit to all except one socket
wss.except(socket.id).broadcast("user_joined", { id: socket.id })
```

### WebSocket Client

```ntl
val wsClient = new ws.Client("wss://api.example.com/ws")

wsClient.on("open", () => {
  log "Connected"
  wsClient.sendJSON({ type: "auth", token: myToken })
})

wsClient.on("message", (data) => {
  val msg = JSON.parse(data)
  handleMessage(msg)
})

wsClient.on("close", (code) => {
  log "Disconnected: " + code
})

wsClient.connect()
```

---

## 10. Events & Pub/Sub — `ntl:events`

```ntl
val {EventEmitter, EventBus, bus} = require("ntl:events")
```

### EventEmitter

```ntl
val emitter = new EventEmitter()

// Basic listener
emitter.on("data", (payload) => {
  log "Got data: " + JSON.stringify(payload)
})

// One-time listener
emitter.once("ready", () => {
  log "Ready! (fires only once)"
})

// Listener with priority (higher runs first)
emitter.on("process", handler1, { priority: 1 })
emitter.on("process", handler2, { priority: 10 })   // runs before handler1

// Emit
emitter.emit("data", { value: 42 })
emitter.emit("ready")

// Remove listener
emitter.off("data", handler)

// Remove all listeners for an event
emitter.removeAllListeners("data")

// Async emit (awaits all listeners)
await emitter.emitAsync("process", payload)

// Parallel emit (runs all listeners concurrently)
await emitter.emitParallel("send", notifications)

// Wait for an event (Promise-based)
val result = await emitter.waitFor("done", 5000)   // 5 second timeout

// Info
emitter.listenerCount("data")
emitter.eventNames()
```

### Global Event Bus

The `bus` export is a singleton `EventBus` shared across your entire application:

```ntl
val {bus} = require("ntl:events")

// Any file can subscribe
bus.on("user.created", (user) => {
  sendWelcomeEmail(user.email)
})

bus.on("order.placed", async (order) => {
  await notifyWarehouse(order)
  await chargePayment(order)
})

// Any file can emit
bus.emit("user.created", { id: 1, email: "alice@example.com" })

// Namespaced bus (isolated from other namespaces)
val userBus  = bus.namespace("users")
val orderBus = bus.namespace("orders")

userBus.on("created", handler)
userBus.emit("created", payload)
```

### Event Piping

```ntl
val source = new EventEmitter()
val target = new EventEmitter()

// Pipe all events from source to target
source.pipe(target)

// Pipe a specific event
source.pipe(target, "data")
```

---

## 11. Logging — `ntl:logger`

```ntl
val {createLogger, Logger} = require("ntl:logger")
```

### Creating a Logger

```ntl
val log = createLogger({
  name:  "api",       // prefix shown in output
  level: "info",      // minimum level: debug, info, warn, error, fatal
  json:  false,       // set true to emit NDJSON (for log aggregators)
  file:  "./app.log"  // optional: also write to file
})
```

### Log Levels

```ntl
log.debug("Cache miss", { key: "user:42" })
log.info("Request processed", { path: "/users", ms: 45 })
log.warn("Rate limit close", { ip: "1.2.3.4", count: 95 })
log.error("DB query failed", { sql: "SELECT...", err: error.message })
log.fatal("Cannot start server", { reason: "port in use" })
// fatal automatically calls process.exit(1)
```

### Child Loggers

Child loggers inherit the parent's level and file, and add extra fields to every log entry:

```ntl
router.use((req, res, next) => {
  req.log = log.child({
    requestId: crypto.uuid(),
    method: req.method,
    path: req.path
  })
  next()
})

router.get("/users", (req, res) => {
  req.log.info("Fetching users")
  val users = db.table("users").all()
  req.log.info("Done", { count: users.length })
  res.json(users)
})
```

### Timing

```ntl
val timer = log.time("database query")
val users = db.table("users").all()
timer.done()    // logs: "database query (23ms)"
timer.done("users loaded")    // logs: "users loaded (23ms)"
```

### JSON Mode (for production)

```ntl
val prodLog = createLogger({
  name:  "api",
  level: "warn",
  json:  true
})

prodLog.error("Unhandled exception", { stack: err.stack })
// Output: {"time":"2026-03-01T10:00:00Z","level":"error","msg":"Unhandled exception","stack":"..."}
```

---

## 12. Caching — `ntl:cache`

```ntl
val {Cache, NamespacedCache, ns, cache} = require("ntl:cache")
```

### Creating a Cache

```ntl
val myCache = new Cache({
  maxSize:         1000,      // max entries (LRU eviction after this)
  ttl:             60000,     // default TTL in ms (null = never expires)
  cleanupInterval: 300000,    // auto-purge expired entries every 5 min
})
```

### Basic Operations

```ntl
myCache.set("user:42", userObject)
myCache.set("user:42", userObject, 30000)   // override TTL: 30 seconds

val user = myCache.get("user:42")    // returns null if expired or missing

myCache.has("user:42")     // boolean

myCache.delete("user:42")
myCache.clear()
```

### getOrSet — The Main Pattern

```ntl
router.get("/users/:id", async (req, res) => {
  val user = await myCache.getOrSet(
    "user:" + req.params.id,
    async () => {
      return db.table("users").find(req.params.id)
    },
    60000    // cache for 60 seconds
  )

  if !user { return res.status(404).json({ error: "Not found" }) }
  res.json(user)
})
```

### Wrapping Functions

```ntl
val cachedGetUser = myCache.wrap(
  (id) => db.table("users").find(id),
  (id) => "user:" + id,    // key function
  60000                     // TTL
)

val user = await cachedGetUser(42)   // fetches and caches automatically
```

### Global Cache and Namespaces

The `cache` export is a global singleton with 5000 entry capacity. The `ns` function creates a namespaced view of it:

```ntl
val {cache, ns} = require("ntl:cache")

// Direct global cache
cache.set("session:abc", sessionData, 3600000)

// Namespaced (keys are automatically prefixed)
val userCache  = ns("user")
val postCache  = ns("post")

userCache.set("42", userData)         // stored as "user:42"
postCache.set("99", postData)         // stored as "post:99"

userCache.get("42")                   // retrieves "user:42"
userCache.clear()                     // clears all "user:*" keys
```

### Cache Statistics

```ntl
val stats = myCache.stats()
// { hits: 450, misses: 50, sets: 100, deletes: 10, evictions: 5 }

myCache.size()      // current number of entries
myCache.ttlOf("user:42")    // ms remaining before expiry
```

---

## 13. Job Queues — `ntl:queue`

```ntl
val {Queue} = require("ntl:queue")

val emailQueue = new Queue("emails", { concurrency: 3 })
```

### Processing Jobs

```ntl
// Handle all jobs
emailQueue.process(async (job) => {
  await sendEmail(job.data.to, job.data.subject, job.data.body)
})

// Handle specific job types
emailQueue.process("welcome", async (job) => {
  await sendWelcomeEmail(job.data.email)
})

emailQueue.process("reset-password", async (job) => {
  await sendPasswordResetEmail(job.data.email, job.data.token)
})
```

### Adding Jobs

```ntl
// Simple job
emailQueue.add("welcome", { email: "alice@example.com" })

// With options
emailQueue.add("report", { userId: 42 }, {
  priority: 5,          // higher priority = processed first
  delay:    60000,      // wait 1 minute before processing
  retries:  5,          // retry up to 5 times on failure
  timeout:  30000,      // fail if takes longer than 30 seconds
  backoff:  "exponential"  // "exponential" or "linear" backoff
})
```

### Job Lifecycle

```ntl
val job = emailQueue.add("send", payload)

// Wait for the job to complete
val result = await job.wait()

// Track progress from inside the processor
emailQueue.process(async (job) => {
  job._setProgress(0)
  await step1()
  job._setProgress(50)
  await step2()
  job._setProgress(100)
})

// Listen from outside
job.onProgress((pct, job) => {
  log "Progress: " + pct + "%"
})
```

### Queue Events

```ntl
emailQueue.on("added",     (job) => log "Job added: " + job.id)
emailQueue.on("started",   (job) => log "Job started: " + job.id)
emailQueue.on("completed", (job) => log "Job done: " + job.id)
emailQueue.on("failed",    (job, err) => log "Job failed: " + err.message)
emailQueue.on("retrying",  (job, err) => log "Retrying job: " + job.id)
```

### Queue Control

```ntl
emailQueue.pause()
emailQueue.resume()
emailQueue.drain()   // wait for all active jobs to finish

val stats = emailQueue.stats()
// { completed: 100, failed: 2, retried: 5 }
```

---

## 14. Email — `ntl:mail`

```ntl
val {SMTPClient} = require("ntl:mail")

val mailer = new SMTPClient({
  host:   process.env.SMTP_HOST,
  port:   587,
  secure: false,
  user:   process.env.SMTP_USER,
  pass:   process.env.SMTP_PASS,
  from:   "no-reply@myapp.com"
})
```

### Sending Email

```ntl
await mailer.send({
  to:      "user@example.com",
  subject: "Welcome to MyApp!",
  text:    "Thanks for signing up.",
  html:    "<h1>Welcome!</h1><p>Thanks for signing up.</p>"
})

// Multiple recipients
await mailer.send({
  to:      ["alice@example.com", "bob@example.com"],
  cc:      "manager@company.com",
  bcc:     "log@company.com",
  subject: "Team update",
  html:    emailHtml,
  replyTo: "team@company.com"
})
```

---

## 15. Environment & Config — `ntl:env`

```ntl
val {Env} = require("ntl:env")

val env = new Env({ files: [".env", ".env.local"] })
```

### Reading Values

```ntl
env.get("DATABASE_URL")              // raw string or null
env.str("APP_NAME", "MyApp")         // string with default
env.int("PORT", 3000)                // parsed integer with default
env.float("RATE_LIMIT", 1.5)         // parsed float
env.bool("DEBUG", false)             // parses "true"/"false"/"1"/"0"
env.list("ALLOWED_ORIGINS", ",")     // splits by separator
env.json("FEATURE_FLAGS")            // JSON.parse
```

### Schema Validation

```ntl
env.require({
  DATABASE_URL: "string",
  PORT:         "int",
  JWT_SECRET:   "string",
  DEBUG:        "bool",
  NODE_ENV:     { type: "string", oneOf: ["development", "production", "test"] }
})

// Throws at startup if required vars are missing or wrong type
```

### Example `.env` file

```
DATABASE_URL=./app.db
PORT=3000
JWT_SECRET=super-secret-key-change-this
DEBUG=false
NODE_ENV=production
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxx
```

---

## 16. AI & LLM Integration — `ntl:ai`

```ntl
val {OpenAI, Anthropic, Ollama, Groq} = require("ntl:ai")
```

### OpenAI

```ntl
val ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model:  "gpt-4o"
})

val reply = await ai.chat("Explain quantum computing in simple terms")
log reply

// With system prompt
val reply = await ai.chat("What is 2+2?", {
  system:      "You are a math teacher who always shows your work.",
  temperature: 0.3,
  maxTokens:   500
})

// Multi-turn conversation
val reply = await ai.chat([
  { role: "user",      content: "My name is Alice." },
  { role: "assistant", content: "Hello Alice! How can I help you?" },
  { role: "user",      content: "What is my name?" }
])

// Streaming
await ai.stream("Write a haiku about JavaScript", (token, full) => {
  process.stdout.write(token)
})
```

### Anthropic

```ntl
val ai = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model:  "claude-opus-4-5"
})

val reply = await ai.chat("Summarize the following text: " + text, {
  maxTokens: 300
})
```

### Ollama (local models)

```ntl
val ai = new Ollama({
  baseUrl: "http://localhost:11434",
  model:   "llama3"
})

val reply = await ai.chat("Hello!")
```

### Groq

```ntl
val ai = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  model:  "mixtral-8x7b-32768"
})

val reply = await ai.chat("Fast inference test")
```

---

## 17. Testing — `ntl:test`

```ntl
val {test, suite, expect, assert} = require("ntl:test")
```

### Basic Tests

```ntl
test("adds numbers correctly", () => {
  expect(1 + 1).toBe(2)
  expect(2 * 3).toBe(6)
})

test("string operations", () => {
  val s = "hello world"
  expect(s.length).toBe(11)
  expect(s.includes("world")).toBe(true)
  expect(s.toUpperCase()).toBe("HELLO WORLD")
})

test("array operations", () => {
  val arr = [1, 2, 3, 4, 5]
  expect(arr.length).toBe(5)
  expect(arr.includes(3)).toBe(true)
  expect(arr.filter(n => n > 3)).toEqual([4, 5])
})
```

### Expect Matchers

```ntl
expect(value).toBe(42)               // strict equality (===)
expect(value).toEqual({ a: 1 })      // deep equality
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeDefined()
expect(value).toBeUndefined()
expect(arr).toContain(item)
expect(str).toMatch(/pattern/)
expect(fn).toThrow()
expect(n).toBeCloseTo(3.14, 2)       // within 2 decimal places
expect(n).toBeGreaterThan(0)
expect(n).toBeLessThan(100)
```

### Assert API

```ntl
assert.equal(actual, expected, "optional message")
assert.notEqual(a, b)
assert.deepEqual(obj1, obj2)
assert.ok(value)
assert.notOk(value)
assert.throws(() => badFunction())
assert.match("hello world", /hello/)
assert.includes([1, 2, 3], 2)
assert.type(value, "string")
assert.closeTo(3.14159, Math.PI, 0.001)
await assert.asyncThrows(async () => await failingFn())
```

### Suites with Hooks

```ntl
val {Suite} = require("ntl:test")

val userSuite = new Suite("User management")

userSuite.before(async () => {
  await db.exec("DELETE FROM users")
})

userSuite.beforeEach(() => {
  log "Running test..."
})

userSuite.test("creates a user", async () => {
  val id = db.table("users").insert({ name: "Alice", email: "alice@test.com" })
  val user = db.table("users").find(id)
  assert.equal(user.name, "Alice")
})

userSuite.test("finds by email", async () => {
  val user = db.table("users").where("email", "alice@test.com").first()
  assert.ok(user)
  assert.equal(user.name, "Alice")
})

userSuite.skip("this test is disabled", () => {
  // ...
})

await userSuite.run()
```

### Running Tests

```bash
ntl run tests/all.ntl
```

---

## 18. CLI Reference

```bash
ntl run    <file.ntl>                   # Run a file
ntl build  <file.ntl> -o out.js         # Compile to JavaScript
ntl watch  <file.ntl>                   # Recompile on file save
ntl check  <file.ntl>                   # Type-check without running
ntl fmt    <file.ntl>                   # Format source file
ntl repl                                 # Interactive REPL
ntl -e "log 1 + 1"                      # Evaluate inline code
ntl bundle <file.ntl> -o bundle.js      # Bundle into single file
ntl opt    <file.ntl>                   # Show optimizer output
ntl wasm   <file.ntl>                   # Compile to WebAssembly
ntl binary <file.ntl> -o app            # Compile to binary executable
ntl native <file.ntl>                   # Cross-compile (15 architectures)
ntl init   [dir]                        # Scaffold new project
ntl ide    [file.ntl]                   # Open terminal IDE
ntl version                             # Print version
```

### Build Flags

```bash
ntl build app.ntl --minify              # minify output
ntl build app.ntl --target=browser      # ESM for browsers
ntl build app.ntl --target=esm          # standard ESM
ntl build app.ntl --target=deno         # Deno-compatible
ntl build app.ntl --target=bun          # Bun-compatible
ntl build app.ntl --obfuscate           # obfuscate output
ntl build app.ntl --comments            # annotate output with types
ntl build app.ntl --strict              # enable strict type checking
```

### Run Flags

```bash
ntl run app.ntl --verbose               # show JIT tier upgrades
ntl run app.ntl --jit-report            # print hot-path table
ntl run app.ntl --no-jit                # disable JIT instrumentation
```

---

## 19. Node.js Interoperability

NTL can use any Node.js built-in and any npm package directly. The interop is seamless — there are no wrappers or adapters needed.

### Using Node.js Built-ins

```ntl
val fs      = require("fs")
val path    = require("path")
val os      = require("os")
val crypto  = require("crypto")
val stream  = require("stream")
val child   = require("child_process")
val cluster = require("cluster")

// File operations
val content = fs.readFileSync("./data.json", "utf8")
val parsed  = JSON.parse(content)

fs.writeFileSync("./output.json", JSON.stringify(result, null, 2))

val files = fs.readdirSync("./uploads")

// Path manipulation
val full = path.join(__dirname, "uploads", filename)
val ext  = path.extname(filename)
val base = path.basename(full)

// System info
log os.platform()     // "linux"
log os.cpus().length  // number of CPU cores
log os.totalmem()     // total RAM in bytes

// Process management
log process.env.NODE_ENV
log process.pid
process.exit(0)
```

### Using npm Packages

Any npm package works as long as it is installed:

```ntl
val axios  = require("axios")
val sharp  = require("sharp")
val bcrypt = require("bcrypt")
val redis  = require("ioredis")

// HTTP requests with axios
val res  = await axios.get("https://api.example.com/users")
val data = res.data

// Image processing with sharp
await sharp("./input.jpg")
  .resize(800, 600)
  .toFormat("webp")
  .toFile("./output.webp")

// Redis
val client = new redis({ host: "localhost", port: 6379 })
await client.set("key", "value", "EX", 3600)
val value = await client.get("key")
```

### Calling NTL from JavaScript

Since NTL compiles to CommonJS JavaScript, you can `require()` compiled NTL files from existing JavaScript projects:

```js
// In your existing app.js
const { processOrder } = require('./compiled/orders.js')

const result = await processOrder({ userId: 42, items: [...] })
```

---

## 20. Game Engine Modules

NTL ships a set of game-development modules under the `ntl:game/*` namespace. These are NTL files compiled to JavaScript — no external dependencies, no WebGL, no canvas required. They target terminal rendering (via ANSI truecolor), Linux framebuffer (`/dev/fb0`), or BMP file output.

This makes them useful for: learning 3D math and rendering, building terminal-based games, creating lightweight game tools, or running on embedded systems where a browser is not available.

### Core Math & Geometry — `ntl:game/core/math3d`

```ntl
val {Vec3, Mat4, Quaternion} = require("ntl:game/core/math3d")
```

**Vec3 — 3D vectors:**

```ntl
val a = new Vec3(1, 2, 3)
val b = new Vec3(4, 5, 6)

val sum   = a.add(b)          // Vec3(5, 7, 9)
val diff  = a.sub(b)          // Vec3(-3, -3, -3)
val scaled = a.scale(2)       // Vec3(2, 4, 6)
val dot   = a.dot(b)          // 1*4 + 2*5 + 3*6 = 32
val cross = a.cross(b)        // Vec3(-3, 6, -3)
val len   = a.length()        // sqrt(14)
val norm  = a.normalize()     // unit vector
val lerp  = Vec3.lerp(a, b, 0.5)    // midpoint

a.x    // 1
a.y    // 2
a.z    // 3
```

**Mat4 — 4x4 transformation matrices:**

```ntl
val identity = Mat4.identity()
val trans    = Mat4.translation(10, 0, 0)
val rotX     = Mat4.rotationX(Math.PI / 4)    // 45 degrees around X
val rotY     = Mat4.rotationY(Math.PI / 2)    // 90 degrees around Y
val scale    = Mat4.scaling(2, 2, 2)

// Combine transformations
val model = Mat4.identity()
  .multiply(Mat4.translation(0, 1, 0))
  .multiply(Mat4.rotationY(angle))
  .multiply(Mat4.scaling(2, 2, 2))

// Projection matrices
val perspective = Mat4.perspective(
  Math.PI / 3,        // 60 degree field of view
  16 / 9,             // aspect ratio
  0.1,                // near plane
  1000                // far plane
)

val orthographic = Mat4.orthographic(-10, 10, -10, 10, 0.1, 100)

// View matrix (camera)
val view = Mat4.lookAt(
  new Vec3(0, 5, 10),    // eye position
  new Vec3(0, 0, 0),     // target
  new Vec3(0, 1, 0)      // up vector
)

// Transform a point
val worldPos = model.transformPoint(localPos)

// Invert (for normal matrix)
val inv = model.invert()
```

**Quaternion — smooth rotation:**

```ntl
val q1 = Quaternion.fromAxisAngle(new Vec3(0, 1, 0), Math.PI / 2)
val q2 = Quaternion.fromEuler(pitch, yaw, roll)

val combined = q1.multiply(q2)
val lerped   = Quaternion.slerp(q1, q2, 0.5)    // smooth interpolation
val matrix   = q1.toMatrix()
```

### Geometry Primitives — `ntl:game/core/geometry`

```ntl
val {Geometry, Mesh} = require("ntl:game/core/geometry")

// Built-in shapes
val cube     = Geometry.cube(1, 1, 1)            // width, height, depth
val sphere   = Geometry.sphere(1, 16, 16)         // radius, horizontal segs, vertical segs
val plane    = Geometry.plane(10, 10, 4, 4)       // width, depth, widthSegs, depthSegs
val cylinder = Geometry.cylinder(0.5, 0.5, 2, 16) // radiusTop, radiusBottom, height, segments
val cone     = Geometry.cone(0.5, 2, 16)           // radius, height, segments
val torus    = Geometry.torus(1, 0.3, 16, 32)      // radius, tube, radSegs, tubSegs

// Each returns a Mesh
val mesh = Geometry.cube()
mesh.vertices    // Float32Array-like array [x0,y0,z0, x1,y1,z1, ...]
mesh.normals     // normal vectors per vertex
mesh.uvs         // texture coordinates
mesh.indices     // triangle indices

// Compute normals from geometry
mesh.computeNormals()

// Clone
val copy = mesh.clone()
```

### 3D Renderer — `ntl:game/rendering/renderer`

The renderer is a software rasterizer. It draws 3D meshes into a pixel buffer using a z-buffer for depth testing and Phong shading for lighting.

```ntl
val {Renderer3D} = require("ntl:game/rendering/renderer")

val renderer = new Renderer3D(1280, 720)

renderer.setClearColor(30, 30, 40)    // dark background (R, G, B)

// Each frame:
renderer.clear()

renderer.drawMesh(
  mesh,         // Mesh object
  mvp,          // Mat4: model-view-projection matrix
  modelMat,     // Mat4: model matrix (for lighting)
  normalMat,    // Mat4: normal matrix
  lights,       // array of light objects
  material,     // { r, g, b, shininess, metallic }
  camera        // camera position Vec3
)

// Access the pixel buffer
val pixels = renderer.buffer    // Uint8Array, RGBA, width*height*4 bytes
```

**Lights:**

```ntl
val lights = [
  {
    type:      "directional",
    direction: new Vec3(-1, -2, -1).normalize(),
    color:     { r: 255, g: 240, b: 200 },
    intensity: 1.0
  },
  {
    type:      "point",
    position:  new Vec3(5, 5, 5),
    color:     { r: 100, g: 150, b: 255 },
    intensity: 0.8,
    range:     20
  },
  {
    type:      "ambient",
    color:     { r: 30, g: 30, b: 40 },
    intensity: 0.3
  }
]
```

**Material:**

```ntl
val material = {
  r:         200,      // base color R (0-255)
  g:         100,      // base color G
  b:         50,       // base color B
  shininess: 64,       // specular highlight sharpness
  metallic:  0.0       // 0=matte, 1=metallic
}
```

### Display Backends — `ntl:game/rendering/display`

```ntl
val {Display} = require("ntl:game/rendering/display")

// ANSI terminal (truecolor) — renders in your terminal
val display = new Display({ mode: "ansi", width: 80, height: 40 })

// Linux framebuffer
val display = new Display({ mode: "framebuffer", device: "/dev/fb0" })

// BMP file output (for testing)
val display = new Display({ mode: "bmp", output: "./frame.bmp" })

// Write pixels from renderer buffer
display.write(renderer.buffer, renderer.width, renderer.height)

// Present (flush to screen)
display.present()
```

### Scene & Transform — `ntl:game/scene/scene`

The scene is a node-based graph. Each node has a `Transform3D`, optional mesh and material, children, and a physics body.

```ntl
val {Scene, SceneNode} = require("ntl:game/scene/scene")

val scene = new Scene()

// Create a node
val box = scene.createNode("box")
box.transform.setPosition(0, 1, 0)
box.transform.setRotation(0, Math.PI / 4, 0)
box.transform.setScale(2, 2, 2)
box.mesh     = Geometry.cube()
box.material = { r: 200, g: 100, b: 50, shininess: 32 }

// Hierarchy (parent-child)
val child = scene.createNode("child")
box.addChild(child)
child.transform.setPosition(2, 0, 0)    // relative to parent

// Find nodes
val node = scene.findNode("box")
val all  = scene.allNodes()

// Transform shortcuts
box.transform.translate(0.1, 0, 0)   // move by delta
box.transform.rotate(0, 0.01, 0)     // rotate by delta per frame
box.transform.lookAt(target.x, target.y, target.z)

// Get world matrix (includes parent transforms)
val worldMatrix = box.transform.getMatrix()
val normalMatrix = box.transform.getNormalMatrix()

// Render the whole scene
scene.render(renderer, camera, lights)
```

### Camera Controllers — `ntl:game/scene/camera`

```ntl
val {Camera, FPSController, OrbitController} = require("ntl:game/scene/camera")
```

**Camera:**

```ntl
val camera = new Camera({
  fov:    Math.PI / 3,    // 60 degrees
  aspect: 16 / 9,
  near:   0.1,
  far:    1000
})

camera.setPosition(0, 5, 10)
camera.lookAt(0, 0, 0)

val viewMatrix = camera.getViewMatrix()
val projMatrix = camera.getProjectionMatrix()
val vpMatrix   = camera.getVPMatrix()    // projection * view
```

**FPS Controller:**

First-person style movement with WASD, mouse look, sprint, and jump:

```ntl
val fps = new FPSController(camera, {
  moveSpeed:  5.0,
  lookSpeed:  0.002,
  sprintMult: 2.5,
  jumpForce:  5.0,
  gravity:    12.0,
  eyeHeight:  1.7
})

// In your game loop (dt = delta time in seconds)
fps.update(input, dt)
```

**Orbit Controller:**

Orbit around a target point, like a 3D viewport:

```ntl
val orbit = new OrbitController(camera, {
  target:   new Vec3(0, 0, 0),
  distance: 10,
  minDist:  2,
  maxDist:  50,
  speed:    0.01
})

orbit.update(input, dt)
```

### Rigid Body Physics — `ntl:game/physics/physics`

```ntl
val {PhysicsWorld, RigidBody, BoxCollider, SphereCollider} = require("ntl:game/physics/physics")

val world = new PhysicsWorld({ gravity: -9.8 })

// Create a dynamic body
val body = new RigidBody({
  x: 0, y: 10, z: 0,
  mass:        1,
  friction:    0.98,
  restitution: 0.3,
  collider:    new BoxCollider(0.5, 0.5, 0.5),   // half-extents
  useGravity:  true
})

// Static body (does not move)
val floor = new RigidBody({
  x: 0, y: 0, z: 0,
  mass:      0,
  isStatic:  true,
  collider:  new BoxCollider(50, 0.1, 50),
  useGravity: false
})

world.addBody(body)
world.addBody(floor)

// Apply forces and impulses
body.applyForce(0, 100, 0)        // continuous force (Newtons)
body.applyImpulse(0, 10, 0)       // instant impulse (kg·m/s)
body.setVelocity(5, 0, 0)
body.setPosition(0, 5, 0)

// Link body to a scene node
body.node = sceneNode    // physics automatically updates node.transform

// Step the simulation (call every frame)
world.step(dt)           // dt in seconds, typically 1/60

// Collision events
world.on("collision", (a, b, manifold) => {
  log "Collision between " + a.node?.name + " and " + b.node?.name
  log "Penetration depth: " + manifold.depth
  log "Normal: " + JSON.stringify(manifold.normal)
})
```

**Collider types:**

```ntl
new BoxCollider(hx, hy, hz)        // half-extents
new SphereCollider(radius)
new CapsuleCollider(radius, height)
```

### Tweens & Easing — `ntl:game/fx/tween`

```ntl
val {Tween, Easing, TweenManager} = require("ntl:game/fx/tween")
```

**Easing functions available:**

`linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInQuint`, `easeOutQuint`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInExpo`, `easeOutExpo`, `easeInCirc`, `easeOutCirc`, `bounce`, `elastic`, `elasticOut`, `back`, `backOut`, `steps(n)`

**Creating a Tween:**

```ntl
val tween = new Tween(sceneNode.transform.position)
  .to({ x: 10, y: 5, z: 0 }, 2.0, Easing.easeOutCubic)
  .delay(0.5)                // wait 0.5s before starting
  .loop(true)                // repeat forever
  .pingpong(true)            // alternate direction each cycle
  .onStart(() => log "Started!")
  .onUpdate((pos) => log "Position: " + pos.x)
  .onDone(() => log "Done!")
```

**Chaining tweens:**

```ntl
val t1 = new Tween(node.transform.position)
  .to({ y: 5 }, 1.0, Easing.easeOut)

val t2 = new Tween(node.material)
  .to({ r: 255, g: 0, b: 0 }, 0.5, Easing.easeIn)

t1.chain(t2)    // t2 starts when t1 finishes
```

**TweenManager — tracks and updates all active tweens:**

```ntl
val tweens = new TweenManager()

tweens.add(tween1)
tweens.add(tween2)

// In game loop
tweens.update(dt)    // advances all tweens by dt seconds
```

### Particle System — `ntl:game/fx/particles`

```ntl
val {ParticleEmitter, ParticleSystem, Presets} = require("ntl:game/fx/particles")
```

**Using presets:**

```ntl
// Fire
val fire = Presets.fire({
  x: 0, y: 0, z: 0,
  scale: 1.5
})

// Smoke
val smoke = Presets.smoke({ x: 0, y: 2, z: 0 })

// Explosion (burst)
val explosion = Presets.explosion({ x: 5, y: 0, z: 5 })
explosion.burst(200)    // emit 200 particles at once

// Snow
val snow = Presets.snow()
```

**Custom emitter:**

```ntl
val emitter = new ParticleEmitter({
  x: 0, y: 0, z: 0,
  emitRate:     30,        // particles per second
  maxParticles: 256,
  loop:         true,
  duration:     -1,        // -1 = forever
  gravity:      -5,
  drag:          0.98,

  // Particle properties (randomized between min/max)
  lifeMin:      0.5,
  lifeMax:      2.0,
  speedMin:     2,
  speedMax:     8,
  sizeStart:    8,
  sizeEnd:      0,
  colorStart:   { r: 255, g: 200, b: 50 },
  colorEnd:     { r: 255, g: 50,  b: 0 },

  // Spread
  spread:       0.5,    // radians
  direction:    { x: 0, y: 1, z: 0 }
})
```

**ParticleSystem (manages multiple emitters):**

```ntl
val system = new ParticleSystem()
system.addEmitter("fire", fire)
system.addEmitter("smoke", smoke)

// In game loop
system.update(dt)

// Render particles (simple projection)
system.render(renderer, camera)
```

### UI System — `ntl:game/ui/ui`

A pixel-perfect UI system that renders directly into the frame buffer using a built-in bitmap font.

```ntl
val {UI} = require("ntl:game/ui/ui")

val ui = new UI(renderer.width, renderer.height)
```

**Drawing primitives:**

```ntl
ui.fillRect(x, y, width, height, { r: 50, g: 50, b: 80 })
ui.strokeRect(x, y, width, height, { r: 100, g: 100, b: 150 }, 2)
ui.fillCircle(cx, cy, radius, { r: 255, g: 200, b: 0 })
ui.line(x1, y1, x2, y2, { r: 255, g: 255, b: 255 }, 1)
ui.text("Score: 1500", x, y, { r: 255, g: 255, b: 255 }, 2)    // scale = 2
```

**Components:**

```ntl
// Button
val button = ui.button({
  x: 100, y: 200,
  width: 150, height: 40,
  label: "Start Game",
  color:      { r: 60, g: 120, b: 200 },
  hoverColor: { r: 80, g: 150, b: 230 },
  textColor:  { r: 255, g: 255, b: 255 },
  onClick: () => startGame()
})

// Slider
val slider = ui.slider({
  x: 100, y: 300,
  width: 200,
  min: 0, max: 100,
  value: 50,
  onChange: (v) => { soundVolume = v / 100 }
})

// Checkbox
val checkbox = ui.checkbox({
  x: 100, y: 370,
  label: "Fullscreen",
  checked: false,
  onChange: (v) => toggleFullscreen(v)
})

// ProgressBar
val health = ui.progressBar({
  x: 20, y: 20,
  width: 200, height: 16,
  value: 75,    // percent
  color:      { r: 80, g: 200, b: 80 },
  bgColor:    { r: 40, g: 40, b: 40 },
  borderColor: { r: 100, g: 100, b: 100 }
})

// TextInput
val nameInput = ui.textInput({
  x: 100, y: 440,
  width: 200, height: 30,
  placeholder: "Enter name...",
  onSubmit: (text) => setPlayerName(text)
})
```

**Rendering UI (after 3D render):**

```ntl
// In game loop — UI renders on top of 3D
renderer.clear()
renderer.drawMesh(...)
ui.render(renderer.buffer, renderer.width)
display.write(renderer.buffer, renderer.width, renderer.height)
display.present()
```

**Updating interactivity:**

```ntl
ui.update(input, dt)    // pass input state so buttons/sliders respond
```

### Input System — `ntl:game/input/input`

```ntl
val {Input} = require("ntl:game/input/input")

val input = new Input()
input.attach()    // starts listening (terminal or browser depending on environment)

// In game loop
input.update()

// Key state
input.isDown("W")           // held down
input.isDown("Space")
input.isDown("ArrowUp")
input.wasPressed("Space")   // true only on the frame it was pressed
input.wasReleased("Space")  // true only on the frame it was released

// Mouse
val pos  = input.mousePos()       // { x, y }
val dx   = input.mouseDX          // delta X since last frame
val dy   = input.mouseDY          // delta Y since last frame
val lmb  = input.isDown("Mouse0")   // left button
val rmb  = input.isDown("Mouse2")   // right button

// Gamepad (if available)
val axes = input.gamepadAxes(0)    // { lx, ly, rx, ry, lt, rt }
```

### Audio — `ntl:game/audio/audio`

The audio module targets Node.js environments and provides a simple API for playing sounds:

```ntl
val {AudioSystem} = require("ntl:game/audio/audio")

val audio = new AudioSystem()

// Load sounds
audio.load("jump",      "./assets/sounds/jump.wav")
audio.load("explosion", "./assets/sounds/explosion.wav")
audio.load("music",     "./assets/music/theme.wav")

// Play
audio.play("jump")
audio.play("explosion", { volume: 0.8, pitch: 1.2 })

// Music (looping background track)
audio.playMusic("music", { volume: 0.5, loop: true })
audio.stopMusic()
audio.setMusicVolume(0.3)

// Spatial audio
audio.play3D("footstep", { x: 5, y: 0, z: 3 }, listenerPosition)

// Master volume
audio.setVolume(0.8)
audio.mute()
audio.unmute()
```

### Tilemap & Pathfinding — `ntl:game/world/tilemap`

```ntl
val {Tilemap, AStar} = require("ntl:game/world/tilemap")

val map = new Tilemap({
  width:     20,
  height:    20,
  tileSize:  1,
  tiles: [
    // 0 = walkable, 1 = wall
    [0,0,0,0,1,0,0,0,0,0, ...],
    // ...
  ]
})

// Check tile type
val isWall = map.isBlocked(5, 3)
val tile   = map.getTile(x, y)
map.setTile(x, y, 1)    // set to wall

// A* pathfinding
val path = AStar.find(
  map,
  { x: 0, y: 0 },       // start
  { x: 15, y: 12 },     // goal
  { diagonal: true }     // allow diagonal movement
)

// path = [{ x, y }, { x, y }, ...] or null if no path
if path {
  each step of path {
    moveEntity(step.x, step.y)
  }
}

// Procedural heightmap terrain
val terrain = Tilemap.generateHeightmap({
  width:  64,
  height: 64,
  scale:  0.1,
  octaves: 4,
  seed: 42
})
```

### Complete Game Loop Example

```ntl
val {Scene}      = require("ntl:game/scene/scene")
val {Renderer3D} = require("ntl:game/rendering/renderer")
val {Display}    = require("ntl:game/rendering/display")
val {Camera, FPSController} = require("ntl:game/scene/camera")
val {Geometry}   = require("ntl:game/core/geometry")
val {PhysicsWorld, RigidBody, BoxCollider} = require("ntl:game/physics/physics")
val {UI}         = require("ntl:game/ui/ui")
val {Input}      = require("ntl:game/input/input")
val {TweenManager} = require("ntl:game/fx/tween")
val {ParticleSystem, Presets} = require("ntl:game/fx/particles")
val {Mat4, Vec3} = require("ntl:game/core/math3d")

val W = 1280
val H = 720

val renderer = new Renderer3D(W, H)
val display  = new Display({ mode: "ansi", width: 160, height: 45 })
val scene    = new Scene()
val ui       = new UI(W, H)
val input    = new Input()
val tweens   = new TweenManager()
val particles = new ParticleSystem()
val physics  = new PhysicsWorld({ gravity: -9.8 })

val camera = new Camera({ fov: Math.PI / 3, aspect: W / H, near: 0.1, far: 500 })
val fps    = new FPSController(camera, { moveSpeed: 5 })

input.attach()

val box = scene.createNode("box")
box.mesh     = Geometry.cube()
box.material = { r: 200, g: 100, b: 50, shininess: 64, metallic: 0 }
box.transform.setPosition(0, 1, -5)

val boxBody = new RigidBody({
  x: 0, y: 5, z: -5,
  mass: 1,
  collider: new BoxCollider(0.5, 0.5, 0.5)
})
boxBody.node = box
physics.addBody(boxBody)

val fire = Presets.fire({ x: 3, y: 0, z: -5 })
particles.addEmitter("campfire", fire)

val healthBar = ui.progressBar({ x: 20, y: 20, width: 200, height: 16, value: 80 })

val lights = [
  { type: "directional", direction: new Vec3(-1, -2, -1).normalize(), color: { r: 255, g: 240, b: 200 }, intensity: 0.9 },
  { type: "ambient",     color: { r: 30, g: 30, b: 50 }, intensity: 0.3 }
]

var lastTime = Date.now()
var frame    = 0

fn gameLoop() {
  val now = Date.now()
  val dt  = Math.min((now - lastTime) / 1000, 0.05)    // cap at 50ms
  lastTime = now
  frame++

  input.update()
  fps.update(input, dt)
  physics.step(dt)
  tweens.update(dt)
  particles.update(dt)
  ui.update(input, dt)

  renderer.clear()

  scene.render(renderer, camera, lights)
  particles.render(renderer, camera)
  ui.render(renderer.buffer, W)

  display.write(renderer.buffer, W, H)
  display.present()

  if frame % 60 == 0 {
    log "FPS: " + (1 / dt).toFixed(0) + " | Bodies: " + physics.bodies.length
  }

  setImmediate(gameLoop)
}

gameLoop()
```

---

## License

Apache License 2.0 © 2026 David Dev

[github.com/Megamexlevi2/ntl-lang](https://github.com/Megamexlevi2/ntl-lang)
