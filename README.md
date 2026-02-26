# NTL Language Reference

> **NTL** — A modern, type-safe language that compiles to JavaScript.  


---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Variables & Types](#variables--types)
3. [Functions](#functions)
4. [Classes](#classes)
5. [Interfaces & Traits](#interfaces--traits)
6. [Enums](#enums)
7. [Type System](#type-system)
8. [Control Flow](#control-flow)
9. [Pattern Matching](#pattern-matching)
10. [Destructuring](#destructuring)
11. [Async Programming](#async-programming)
12. [Error Handling](#error-handling)
13. [Modules & Imports](#modules--imports)
14. [Decorators](#decorators)
15. [Immutability](#immutability)
16. [Operators](#operators)
17. [Concurrency](#concurrency)
18. [Built-in Modules](#built-in-modules)
19. [Compiler (NAX)](#compiler-nax)
20. [Error Messages](#error-messages)

---

## Getting Started

### Installation

```bash
npm install -g @david0dev/ntl-lang
```

### Your First Program

```ntl
val name: string = "World"

fn greet(name: string) -> string {
  return `Hello, ${name}!`
}

console.log(greet(name))
```

### Run It

```bash
ntl run hello.ntl
```

### Compile It

```bash
ntl build hello.ntl -o dist/hello.js
```

---

## Variables & Types

### Immutable Variables (`val`, `const`)

```ntl
val x: number = 42
val name: string = "Alice"
val active: boolean = true
val nothing: null = null
```

`val` creates an immutable binding — you cannot reassign it.

### Mutable Variables (`var`, `let`)

```ntl
var counter: number = 0
counter = counter + 1   // ok

var message = "hello"   // type inferred as string
message = "world"       // ok
```

### Type Inference

NTL infers types automatically — no need to annotate everything:

```ntl
val x = 10          // inferred: number
val s = "hello"     // inferred: string
val arr = [1, 2, 3] // inferred: number[]
val obj = { x: 1, y: 2 }  // inferred: { x: number, y: number }
```

### Type Annotations

Add `:` after the name to annotate:

```ntl
val id: number = 1
val name: string = "Alice"
val tags: string[] = ["ntl", "language"]
val maybe: string | null = null
```

### Union Types

```ntl
val status: "active" | "inactive" | "pending" = "active"
var result: number | string = 42
result = "forty-two"   // valid
```

### Deep Immutability

```ntl
immutable val config = {
  host: "localhost",
  port: 3000,
  db: {
    name: "myapp",
    pool: 10
  }
}
// config.host = "other"  // runtime error: frozen
```

---

## Functions

### Basic Functions

```ntl
fn add(a: number, b: number) -> number {
  return a + b
}
```

### Return Type Inference

```ntl
fn double(x: number) {
  return x * 2   // return type inferred
}
```

### Default Parameters

```ntl
fn greet(name: string = "World", greeting: string = "Hello") {
  return `${greeting}, ${name}!`
}

console.log(greet())               // "Hello, World!"
console.log(greet("Alice"))        // "Hello, Alice!"
console.log(greet("Bob", "Hi"))    // "Hi, Bob!"
```

### Rest Parameters

```ntl
fn sum(...numbers: number[]) -> number {
  return numbers.reduce((a, b) => a + b, 0)
}

console.log(sum(1, 2, 3, 4, 5))   // 15
```

### Arrow Functions

```ntl
val double = x => x * 2
val add = (a, b) => a + b
val addThree = (a: number, b: number, c: number) -> number => a + b + c

// Multi-line arrow
val process = (items: any[]) => {
  val filtered = items.filter(x => x > 0)
  return filtered.map(x => x * 2)
}
```

### Async Functions

```ntl
async fn fetchUser(id: number) -> User {
  val response = await fetch(`/api/users/${id}`)
  return await response.json()
}

async fn main() {
  val user = await fetchUser(1)
  console.log(user.name)
}
```

### Generic Functions

```ntl
fn identity<T>(value: T) -> T {
  return value
}

fn first<T>(arr: T[]) -> T | null {
  return arr.length > 0 ? arr[0] : null
}
```

### Higher-Order Functions

```ntl
fn map<T, U>(arr: T[], fn: (item: T) -> U) -> U[] {
  return arr.map(fn)
}

val doubled = map([1, 2, 3], x => x * 2)  // [2, 4, 6]
```

---

## Classes

### Basic Class

```ntl
class Person {
  name: string
  age: number

  init(name: string, age: number) {
    this.name = name
    this.age = age
  }

  greet() -> string {
    return `Hi, I'm ${this.name}, ${this.age} years old`
  }

  toString() -> string {
    return `Person(${this.name})`
  }
}

val alice = new Person("Alice", 30)
console.log(alice.greet())
```

### Inheritance

```ntl
class Animal {
  name: string

  init(name: string) {
    this.name = name
  }

  speak() -> string {
    return `${this.name} makes a sound`
  }
}

class Dog extends Animal {
  breed: string

  init(name: string, breed: string) {
    super.init(name)
    this.breed = breed
  }

  speak() -> string {
    return `${this.name} barks!`
  }

  fetch(item: string) -> string {
    return `${this.name} fetches the ${item}`
  }
}

val rex = new Dog("Rex", "Labrador")
console.log(rex.speak())    // "Rex barks!"
console.log(rex.fetch("ball"))
```

### Access Modifiers

```ntl
class BankAccount {
  private balance: number = 0
  readonly owner: string
  protected accountId: string

  init(owner: string, id: string) {
    this.owner = owner
    this.accountId = id
  }

  deposit(amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive")
    this.balance += amount
  }

  get currentBalance() -> number {
    return this.balance
  }
}
```

### Static Members

```ntl
class MathUtils {
  static PI: number = 3.14159265358979

  static circle_area(radius: number) -> number {
    return MathUtils.PI * radius * radius
  }

  static clamp(value: number, min: number, max: number) -> number {
    return Math.max(min, Math.min(max, value))
  }
}

console.log(MathUtils.circle_area(5))      // ~78.54
console.log(MathUtils.clamp(15, 0, 10))   // 10
```

### Abstract Classes

```ntl
abstract class Shape {
  abstract area() -> number
  abstract perimeter() -> number

  describe() -> string {
    return `Shape with area ${this.area().toFixed(2)}`
  }
}

class Circle extends Shape {
  init(private radius: number) {}

  area() -> number {
    return Math.PI * this.radius * this.radius
  }

  perimeter() -> number {
    return 2 * Math.PI * this.radius
  }
}
```

### Implementing Interfaces

```ntl
interface Serializable {
  serialize() -> string
  deserialize(data: string) -> void
}

interface Printable {
  print() -> void
}

class Document implements Serializable, Printable {
  private content: string = ""

  serialize() -> string {
    return JSON.stringify({ content: this.content })
  }

  deserialize(data: string) -> void {
    this.content = JSON.parse(data).content
  }

  print() -> void {
    console.log(this.content)
  }
}
```

---

## Interfaces & Traits

### Interfaces

Interfaces define contracts — they produce no output code:

```ntl
interface User {
  id: number
  name: string
  email: string
  role?: "admin" | "user"
}

interface Repository<T> {
  findById(id: number) -> T | null
  findAll() -> T[]
  save(entity: T) -> T
  delete(id: number) -> boolean
}
```

### Extending Interfaces

```ntl
interface Animal {
  name: string
  sound() -> string
}

interface Pet extends Animal {
  owner: string
  vaccinated: boolean
}
```

### Traits

Traits are interface-like constructs with default implementations:

```ntl
trait Loggable {
  log(message: string) {
    console.log(`[${this.constructor.name}] ${message}`)
  }

  warn(message: string) {
    console.warn(`[${this.constructor.name}] WARNING: ${message}`)
  }
}
```

---

## Enums

### Basic Enum

```ntl
enum Direction {
  Up,
  Down,
  Left,
  Right
}

val dir: Direction = Direction.Up
console.log(dir)    // 0
```

### Custom Values

```ntl
enum HttpStatus {
  Ok = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  InternalError = 500
}

fn handleResponse(status: HttpStatus) {
  match status {
    case HttpStatus.Ok | HttpStatus.Created => console.log("Success")
    case HttpStatus.NotFound => console.log("Not Found")
    case HttpStatus.InternalError => console.log("Server Error")
    default => console.log("Other:", status)
  }
}
```

### String Enums

```ntl
enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE"
}
```

---

## Type System

### Primitive Types

| Type      | Description          | Example             |
|-----------|---------------------|---------------------|
| `number`  | Floating point      | `42`, `3.14`        |
| `string`  | Text                | `"hello"`, `` `hi` `` |
| `boolean` | True/false          | `true`, `false`     |
| `null`    | Null value          | `null`              |
| `undefined` | Undefined         | `undefined`         |
| `bigint`  | Large integers      | `9999999999999n`    |
| `any`     | Any type            | `anything`          |
| `never`   | Never returns       | Function that throws |
| `void`    | No return value     | `fn log() -> void`  |

### Complex Types

```ntl
type StringOrNumber = string | number
type Nullable<T> = T | null
type Optional<T> = T | undefined
type Pair<A, B> = { first: A, second: B }
type Callback<T> = (result: T, error?: Error) -> void

// Function type
type Predicate<T> = (item: T) -> boolean
type Transform<A, B> = (input: A) -> B
```

### Type Aliases

```ntl
type UserID = number
type Email = string
type Timestamp = number

type User = {
  id: UserID
  name: string
  email: Email
  createdAt: Timestamp
}

type Config = {
  host: string
  port: number
  debug?: boolean
  timeout?: number
}
```

### Algebraic Types (Sum Types)

```ntl
type Result = Ok(value) | Err(error)
type Option = Some(value) | None

val result: Result = Ok(42)

match result {
  case Ok(v) => console.log("Success:", v)
  case Err(e) => console.log("Error:", e)
}
```

### Generic Types

```ntl
type Stack<T> = {
  items: T[]
  push(item: T) -> void
  pop() -> T | null
  peek() -> T | null
}

type Dict<K extends string, V> = {
  [key: K]: V
}
```

---

## Control Flow

### If / Else

```ntl
val x = 42

if x > 100 {
  console.log("large")
} else if x > 50 {
  console.log("medium")
} else {
  console.log("small")
}
```

### Unless (Inverted If)

```ntl
val authenticated = false

unless authenticated {
  console.log("Please log in")
}

// Equivalent to:
if !authenticated {
  console.log("Please log in")
}
```

### Ifset (Null-safe Check)

```ntl
val user = getUser()  // might return null

ifset user as u {
  console.log(`Welcome, ${u.name}!`)
} else {
  console.log("User not found")
}
```

### While Loop

```ntl
var i = 0
while i < 10 {
  console.log(i)
  i++
}
```

### Do-While Loop

```ntl
var attempts = 0
do {
  attempts++
  console.log(`Attempt ${attempts}`)
} while attempts < 3
```

### For-Of Loop

```ntl
val fruits = ["apple", "banana", "cherry"]

for val fruit of fruits {
  console.log(fruit)
}
```

### For-In Loop

```ntl
val config = { host: "localhost", port: 3000, debug: true }

for val key in config {
  console.log(key, "=", config[key])
}
```

### Loop (Infinite)

```ntl
var running = true

loop {
  if !running { break }
  // process events...
}
```

### Break & Continue

```ntl
for val n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] {
  if n % 2 === 0 { continue }   // skip even numbers
  if n > 7 { break }            // stop at 7
  console.log(n)
}
// outputs: 1 3 5 7
```

---

## Pattern Matching

The `match` expression is one of NTL's most powerful features — far superior to JavaScript's `switch`.

### Basic Match

```ntl
val status = 404

match status {
  case 200 => console.log("OK")
  case 201 => console.log("Created")
  case 404 => console.log("Not Found")
  case 500 => console.log("Server Error")
  default  => console.log("Unknown status:", status)
}
```

### Multi-value Cases

```ntl
match day {
  case "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" => console.log("Weekday")
  case "Saturday" | "Sunday" => console.log("Weekend")
  default => console.log("Unknown day")
}
```

### Guards (When Clauses)

```ntl
val score = 87

match score {
  case n when n >= 90 => console.log("A")
  case n when n >= 80 => console.log("B")
  case n when n >= 70 => console.log("C")
  case n when n >= 60 => console.log("D")
  default => console.log("F")
}
```

### Destructuring in Match

```ntl
val point = { x: 3, y: -4 }

match point {
  case { x, y } when x === 0 && y === 0 => console.log("Origin")
  case { x } when x > 0 => console.log("Right side")
  case { x } when x < 0 => console.log("Left side")
  default => console.log("On y-axis")
}
```

### Matching Algebraic Types

```ntl
type Result = Ok(value) | Err(message)

fn process(r: Result) {
  match r {
    case Ok(v)    => console.log("Got value:", v)
    case Err(msg) => console.log("Error:", msg)
  }
}
```

### Exhaustive Matching

```ntl
enum Color { Red, Green, Blue }

fn describe(c: Color) -> string {
  match c {
    case Color.Red   => return "warm"
    case Color.Green => return "cool"
    case Color.Blue  => return "cold"
  }
}
```

---

## Destructuring

### Object Destructuring

```ntl
val user = { name: "Alice", age: 30, role: "admin" }

val { name, age } = user
console.log(name, age)   // "Alice" 30

// Rename
val { name: userName, age: userAge } = user

// Default values
val { name, role = "user" } = user
```

### Array Destructuring

```ntl
val colors = ["red", "green", "blue", "yellow"]

val [first, second] = colors
val [head, ...tail] = colors            // rest element
val [, second2, , fourth] = colors     // skip elements
```

### Nested Destructuring

```ntl
val config = {
  server: {
    host: "localhost",
    port: 3000
  },
  database: {
    name: "mydb",
    credentials: {
      user: "admin",
      pass: "secret"
    }
  }
}

val { server: { host, port }, database: { name: dbName } } = config
console.log(host, port, dbName)
```

### Destructuring in Function Parameters

```ntl
fn renderUser({ name, email, role = "user" }: User) {
  return `<div>${name} (${email}) - ${role}</div>`
}

fn processPoints([first, second, ...rest]: number[]) {
  return { first, second, remaining: rest.length }
}
```

---

## Async Programming

### Async/Await

```ntl
async fn fetchData(url: string) -> any {
  val response = await fetch(url)
  if !response.ok {
    throw new Error(`HTTP ${response.status}`)
  }
  return await response.json()
}

async fn main() {
  try {
    val data = await fetchData("https://api.example.com/data")
    console.log(data)
  } catch err {
    console.error("Failed:", err.message)
  }
}

main()
```

### Promise Chaining

```ntl
fetchUser(1)
  .then(user => fetchPosts(user.id))
  .then(posts => console.log(posts))
  .catch(err => console.error(err))
```

### Parallel Execution

```ntl
async fn loadDashboard(userId: number) {
  val [user, posts, stats] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchStats(userId)
  ])

  return { user, posts, stats }
}
```

### Spawn (Fire and Forget)

```ntl
spawn sendAnalytics({ event: "page_view", path: "/home" })
spawn logMetric("response_time", 142)

// Execution continues without waiting
```

---

## Error Handling

### Try / Catch / Finally

```ntl
fn parseJSON(input: string) -> any {
  try {
    return JSON.parse(input)
  } catch err {
    console.error("Parse failed:", err.message)
    return null
  } finally {
    console.log("Parse attempt complete")
  }
}
```

### Custom Errors

```ntl
class ValidationError extends Error {
  field: string

  init(field: string, message: string) {
    super(message)
    this.name = "ValidationError"
    this.field = field
  }
}

class NotFoundError extends Error {
  resource: string
  id: number

  init(resource: string, id: number) {
    super(`${resource} with id ${id} not found`)
    this.name = "NotFoundError"
    this.resource = resource
    this.id = id
  }
}

fn findUser(id: number) -> User {
  val user = db.find(id)
  if !user {
    throw new NotFoundError("User", id)
  }
  return user
}
```

### Result Type Pattern

```ntl
type Result<T> = { ok: true, value: T } | { ok: false, error: string }

fn divideBy(a: number, b: number) -> Result<number> {
  if b === 0 {
    return { ok: false, error: "Division by zero" }
  }
  return { ok: true, value: a / b }
}

val result = divideBy(10, 2)
match result {
  case { ok: true,  value: v } => console.log("Result:", v)
  case { ok: false, error: e } => console.log("Error:", e)
}
```

---

## Modules & Imports

### ES Module Style

```ntl
import { readFile, writeFile } from "fs/promises"
import path from "path"
import * as crypto from "crypto"
```

### CommonJS Style

```ntl
const express = require("express")
const { join, resolve } = require("path")
```

### NTL Native Modules

```ntl
const require(ntl, http, logger, fs)

val server = http.createServer()
val log = logger.create("app")
```

### Exporting

```ntl
export fn add(a: number, b: number) -> number {
  return a + b
}

export class UserService {
  // ...
}

export type User = {
  id: number
  name: string
}

export default class App {
  // ...
}
```

### Re-exporting

```ntl
export { add, subtract } from "./math"
export { UserService } from "./services/user"
export type { User, Config } from "./types"
```

---

## Decorators

Decorators modify classes and functions at definition time:

### Function Decorators

```ntl
fn memoize(fn) {
  val cache = new Map()
  return fn(...args) {
    val key = JSON.stringify(args)
    if cache.has(key) { return cache.get(key) }
    val result = fn(...args)
    cache.set(key, result)
    return result
  }
}

@memoize
fn fibonacci(n: number) -> number {
  if n <= 1 { return n }
  return fibonacci(n - 1) + fibonacci(n - 2)
}
```

### Class Decorators

```ntl
fn injectable(cls) {
  cls._injectable = true
  return cls
}

fn singleton(cls) {
  var instance = null
  return class extends cls {
    init(...args) {
      if !instance {
        super.init(...args)
        instance = this
      }
      return instance
    }
  }
}

@injectable
@singleton
class DatabaseConnection {
  init(url: string) {
    this.url = url
    this.connection = null
  }
}
```

### Decorator with Arguments

```ntl
fn retry(times: number, delay: number = 1000) {
  return fn(target) {
    return async fn(...args) {
      for var i = 0; i < times; i++ {
        try {
          return await target(...args)
        } catch err {
          if i === times - 1 { throw err }
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }
  }
}

@retry(3, 500)
async fn unstableOperation() {
  // might fail sometimes
}
```

---

## Immutability

### Deep Freeze

```ntl
immutable val CONFIG = {
  app: {
    name: "MyApp",
    version: "1.0.0"
  },
  server: {
    host: "0.0.0.0",
    port: 8080
  },
  db: {
    host: "localhost",
    port: 5432,
    name: "production"
  }
}

// CONFIG.app.name = "other"   // runtime error
// CONFIG.server.port = 9000   // runtime error
```

---

## Operators

### Arithmetic

```ntl
val a = 10 + 5     // 15
val b = 10 - 3     // 7
val c = 4 * 3      // 12
val d = 15 / 4     // 3.75
val e = 15 % 4     // 3
val f = 2 ** 10    // 1024  (exponentiation)
```

### Comparison & Logical

```ntl
5 === 5     // true  (strict equality)
5 !== 6     // true
5 > 3       // true
5 >= 5      // true
"a" < "b"   // true

true && false  // false
true || false  // true
!true          // false
```

### Nullish Coalescing

```ntl
val name = user?.name ?? "Guest"
val port = config?.port ?? 3000
```

### Optional Chaining

```ntl
val city = user?.address?.city?.name
val method = obj?.method?.()
val item = arr?.[0]
```

### Pipeline Operator

Chain function calls left-to-right:

```ntl
val result = data
  |> JSON.parse
  |> (obj => obj.users)
  |> (users => users.filter(u => u.active))
  |> (users => users.map(u => u.name))

// Equivalent to:
// JSON.parse(data).users.filter(u=>u.active).map(u=>u.name)
```

### Ternary

```ntl
val label = count === 1 ? "item" : "items"
val color = score >= 90 ? "green" : score >= 70 ? "yellow" : "red"
```

### Spread Operator

```ntl
val arr1 = [1, 2, 3]
val arr2 = [...arr1, 4, 5, 6]

val obj1 = { x: 1, y: 2 }
val obj2 = { ...obj1, z: 3 }

fn log(...args: any[]) {
  console.log(...args)
}
```

### typeof

```ntl
typeof 42           // "number"
typeof "hello"      // "string"
typeof true         // "boolean"
typeof null         // "object" (JS quirk)
typeof undefined    // "undefined"
typeof {}           // "object"
typeof (() => {})   // "function"
```

---

## Concurrency

### Spawn

```ntl
spawn heavyTask()
spawn sendEmail(user, "Welcome!")

// Continues without blocking
```

### Channels

```ntl
val ch = channel()

spawn fn() {
  await ch.send(42)
  await ch.send(100)
}()

val v1 = await ch.receive()   // 42
val v2 = await ch.receive()   // 100
```

### Select

```ntl
val ch1 = channel()
val ch2 = channel()

select {
  case v = ch1.receive() => console.log("from ch1:", v)
  case v = ch2.receive() => console.log("from ch2:", v)
}
```

---

## Built-in Modules

Import with `const require(ntl, module)`:

### `ntl:http`

```ntl
const require(ntl, http)

val server = http.createServer()
val router = http.Router()

router.get("/users", async (req, res) => {
  val users = await db.findAll()
  res.json(users)
})

router.post("/users", async (req, res) => {
  val user = await db.create(req.body)
  res.status(201).json(user)
})

server.use(router)
server.listen(3000)
```

### `ntl:fs`

```ntl
const require(ntl, fs)

val content = await fs.read("config.json")
val config = JSON.parse(content)

await fs.write("output.json", JSON.stringify(result))

val files = await fs.glob("src/**/*.ntl")
```

### `ntl:logger`

```ntl
const require(ntl, logger)

val log = logger.create("app", { level: "debug" })

log.info("Server started", { port: 3000 })
log.warn("High memory usage", { usage: "85%" })
log.error("Database connection failed", err)
log.debug("Request received", { method: "GET", path: "/" })
```

### `ntl:crypto`

```ntl
const require(ntl, crypto)

val hash = crypto.sha256("password123")
val token = await crypto.generateToken()
val jwt = crypto.signJWT({ userId: 1, role: "admin" }, secret)
val verified = crypto.verifyJWT(token, secret)
val bcrypt = await crypto.hashPassword("mypassword")
val valid = await crypto.verifyPassword("mypassword", bcrypt)
```

### `ntl:test`

```ntl
const require(ntl, test)

val suite = test.suite("Math operations")

suite.test("add works correctly", () => {
  test.expect(add(2, 3)).toBe(5)
  test.expect(add(-1, 1)).toBe(0)
  test.expect(add(0, 0)).toBe(0)
})

suite.test("handles edge cases", () => {
  test.expect(add(Infinity, 1)).toBe(Infinity)
  test.expect(add(NaN, 1)).toBeNaN()
})

await suite.run()
```

### `ntl:game`

```ntl
const require(ntl, game)

val pos = new game.Vec2(100, 200)
val velocity = new game.Vec2(5, -3)

pos.add(velocity)   // mutation-friendly vector math

val bounds = new game.Rect(0, 0, 800, 600)
val circle = new game.Circle(pos.x, pos.y, 20)

if bounds.contains(pos) {
  // entity is within world bounds
}

val loop = new game.GameLoop(60)
loop.onUpdate(dt => { /* update logic */ })
loop.onRender(ctx => { /* draw logic */ })
loop.start()
```

### `ntl:ai`

```ntl
const require(ntl, ai)

val model = await ai.load("ntl:text-small")
val result = await model.generate("Explain quantum computing in simple terms")
console.log(result.text)

// Embeddings
val embedding = await ai.embed("Hello world")
val similarity = ai.cosineSimilarity(embedding1, embedding2)
```

---

## Compiler (NAX)

NAX is the NTL compiler

### Project Configuration (`ntl.json`)

```json
{
  "$schema": "https://ntlang.dev/schema/ntl.json",
  "name": "my-app",
  "version": "1.0.0",
  "src": "src",
  "dist": "dist",
  "compilerOptions": {
    "target": "node",
    "strict": true,
    "minify": false,
    "treeShake": true,
    "credits": false
  },
  "include": ["src/**/*.ntl"],
  "exclude": ["node_modules", "dist"]
}
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `ntl run app.ntl` | Execute directly |
| `ntl build app.ntl -o dist/app.js` | Compile single file |
| `ntl build ntl.json` | Compile whole project |
| `ntl check app.ntl --strict` | Type-check only |
| `ntl watch app.ntl` | Watch mode |
| `ntl dev` | Dev server with hot reload |
| `ntl repl` | Interactive REPL |
| `ntl init my-project` | Create new project |
| `ntl version` | Show version |
| `ntl help` | Show help |

### Build Targets

```bash
ntl build app.ntl --target=node     # CommonJS for Node.js
ntl build app.ntl --target=browser  # ESM for browser
ntl build app.ntl --target=deno     # ESM for Deno
ntl build app.ntl --target=bun      # CommonJS for Bun
ntl build app.ntl --target=esm      # Pure ES Modules
ntl build app.ntl --target=cjs      # Pure CommonJS
```

### Obfuscation

Protect your code with industrial-grade obfuscation:

```bash
ntl build app.ntl -o dist/app.js --obfuscate
```

Output is nearly impossible to reverse-engineer:
- String array encoding with hex escapes
- Variable and function name randomization
- Number encoding (hex literals)
- Dead code injection
- Control flow flattening
- Self-defending code optional

### Strict Mode

```bash
ntl build app.ntl --strict
ntl check app.ntl --strict
```

Strict mode enables:
- Full type inference and checking
- Disallows `any` in most positions
- Enforces return types
- Catches unused variables
- Reports potential null access

### Tree Shaking

NTL automatically removes unused code. Disable with:

```bash
ntl build app.ntl --no-treeshake
```

---

## Error Messages


### Reference Error Example

```
NTL Reference Error
────────────────────────────────────────────────────────────

  ⨯ Variable 'username' is not defined
  ╰─▶ In file: /home/user/project/auth.ntl at line 8:21

   6  │ function validateUser() {
   7  │   const token = getToken()
   8  │   return validateToken(username, token)
                               ┬───────
                               ╰── 'username' is not defined in this scope

  ✘ Error: Cannot find name 'username' in current scope.
    Did you forget to declare it or pass it as a parameter?

  ──▶ SUGGESTED FIXES ──────────────────────────────────────

  1. Declare 'username' before using it:
     > const username = "guest"
     > return validateToken(username, token)

  2. Pass 'username' as a function parameter:
     > function validateUser(username) {
     >   return validateToken(username, token)
     > }

  3. Check for typos — did you mean 'userName' or 'user'?

  ──▶ SIMILAR NAMES IN SCOPE ───────────────────────────────

     • userData    (line 3)
     • userId      (line 4)
     • currentUser (line 6)
```

### Type Error Example

```
NTL Type Error (strict type checking)
────────────────────────────────────────────────────────────

  ⨯ Type 'string' is not assignable to type 'number'
  ╰─▶ In file: /home/user/project/main.ntl at line 12:9

  10  │ val count: number = 0
  11  │
  12  │ count = "five"
              ┬──────
              ╰── type mismatch here

  ✘ Error: Type mismatch detected.
    The assigned value does not match the declared type annotation.

  ──▶ SUGGESTED FIXES ──────────────────────────────────────

  1. Use a number literal instead:
     > count = 5

  2. Parse the string to a number:
     > count = parseInt("five", 10)
```

### Print Error Example

```
NTL Runtime Error (strict mode: console only)
────────────────────────────────────────────────────────────

  ⨯ Undefined function: 'print'
  ╰─▶ In file: /home/user/project/main.ntl at line 3:1

   1  │ val message = "Hello, World"
   2  │
   3  │ print(message)
          ┬─────
          ╰── 'print' is not defined in this scope

  ✘ Error: Function 'print' is not defined in NTL standard library.
    NTL enforces strict console methods for output operations.

  ──▶ SUGGESTED FIXES ──────────────────────────────────────

  1. Use console.log instead of print (recommended):
     > console.log(message)

  2. Define 'print' as an alias if you prefer the syntax:
     > const print = console.log
     > print(message)  // works

  3. Use NTL's built-in logging module:
     > const require(ntl, logger)
     > val log = logger.create()
     > log.info(message)

  ──▶ EXAMPLE ───────────────────────────────────────────────

     ❌  print("Hello, World")
     ✅  console.log("Hello, World")
```

## Security

### Code Protection

NTL's obfuscator protects your business logic from being stolen or reverse-engineered:

```bash
# Protect your compiled output
ntl build app.ntl -o dist/app.js --obfuscate

# The output is extremely difficult to read:
(function(){var _0x3a2f1b=["\x75\x73\x65\x72"];var _0x9ef12c=function(a,b){return a[b]};...})();
```

The obfuscator applies multiple layers:
1. **String encoding** — all strings become hex escape sequences
2. **Name mangling** — all identifiers become unreadable random names  
3. **Number encoding** — numbers become hex literals
4. **Dead code injection** — random unreachable code confuses decompilers
5. **Self-defending** — optional code that detects tampering

### Internal Runtime Security

NTL's own runtime modules are shipped in obfuscated form. Even if someone obtains your `node_modules`, the NTL implementation is protected.

---

*NTL Language Reference — v1.0.0*  
*Built with ❤️ for backend engineers, game developers, and AI builders.*
