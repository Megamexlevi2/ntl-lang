'use strict';

const http = require('http');
const PORT = 5000;

const LESSONS = [
  { id:'welcome',chapter:1,title:'Welcome to NTL',description:'NTL is a programming language that compiles to JavaScript and runs on Node.js.\nDesigned to be readable, fast, and ready for real production work —\nfrom small scripts to large enterprise backends serving millions of users.\n\nThis tutorial will teach you NTL from zero.\nEach lesson has a live editor — write code, press Run, see the result.',starter:'log "Hello, World!"',expected:'Hello, World!',hint:'Use the log keyword followed by a string in double quotes.'},
  { id:'variables',chapter:1,title:'Variables',description:'NTL has two variable declarations:\n\n  val — immutable. Cannot be reassigned after creation.\n  var — mutable. Can be reassigned whenever needed.\n\nUse val by default. Reach for var only when you need to change the value.\nThis forces you to think about mutability up front.',starter:'val name = "David"\nvar count = 0\n\ncount = count + 1\n\nlog name\nlog count',expected:'David\n1',hint:'val cannot be reassigned. var can be changed at any time.'},
  { id:'types',chapter:1,title:'Type Annotations',description:'You can optionally annotate types after a colon.\nNTL infers types automatically — annotations are not required,\nbut they document intent and help catch bugs with ntl check.\n\nSupported types: string, number, int, bool, any, object, void',starter:'val name: string = "Alice"\nval age: number   = 30\nval active: bool  = true\n\nlog name, age, active',expected:'Alice 30 true',hint:'Add ": type" after the variable name to annotate its type.'},
  { id:'strings',chapter:1,title:'Strings and Templates',description:'Strings use double quotes or backtick templates.\nTemplate strings interpolate any expression with ${}.',starter:'val city = "São Paulo"\nval year = 2026\n\nval message = `Welcome to ${city} in ${year}!`\nlog message',expected:'Welcome to São Paulo in 2026!',hint:'Backtick strings support ${expression} interpolation.'},
  { id:'numbers',chapter:1,title:'Numbers and Math',description:'NTL supports all standard math operations.\n** is exponentiation. % is modulo (remainder).',starter:'val a = 10\nval b = 3\n\nlog a + b\nlog a - b\nlog a * b\nlog a / b\nlog a % b\nlog a ** b',expected:'13\n7\n30\n3.3333333333333335\n1\n1000',hint:'** is exponentiation (power). % is modulo (remainder).'},

  { id:'if',chapter:2,title:'If / Else',description:'Conditionals use if, else if, else.\nParentheses around the condition are optional.\nCurly braces are always required.',starter:'val score = 85\n\nif score >= 90 {\n  log "A"\n} else if score >= 80 {\n  log "B"\n} else if score >= 70 {\n  log "C"\n} else {\n  log "F"\n}',expected:'B',hint:'Parentheses around the condition are optional. Braces are required.'},
  { id:'unless',chapter:2,title:'Unless',description:'unless is the opposite of if. The block runs when the condition is FALSE.\nThis often reads more naturally than if (!condition).',starter:'fn greet(user) {\n  unless user {\n    log "No user provided"\n    return\n  }\n  log "Hello,", user\n}\n\ngreet(null)\ngreet("Maria")',expected:'No user provided\nHello, Maria',hint:'unless runs when the condition is falsy. The inverse of if.'},
  { id:'loops',chapter:2,title:'Loops',description:'NTL has several loop forms:\n\n  while condition { }       — classic loop\n  repeat N { }              — run exactly N times\n  each x in list { }        — iterate over an array',starter:'repeat 3 {\n  log "Hello!"\n}\n\nval fruits = ["apple", "banana", "cherry"]\neach fruit in fruits {\n  log fruit\n}',expected:'Hello!\nHello!\nHello!\napple\nbanana\ncherry',hint:'repeat N runs N times. each x in list iterates over arrays.'},
  { id:'range',chapter:2,title:'Range',description:'range() generates arrays of numbers:\n\n  range(n)            → [0, 1, ..., n-1]\n  range(a, b)         → [a, ..., b-1]\n  range(a, b, step)   → every step',starter:'val nums = range(5)\nlog nums\n\nval evens = range(0, 10, 2)\nlog evens\n\nvar total = 0\neach n in range(1, 6) {\n  total += n\n}\nlog "Sum 1-5:", total',expected:'[ 0, 1, 2, 3, 4 ]\n[ 0, 2, 4, 6, 8 ]\nSum 1-5: 15',hint:'range(n) gives [0..n-1]. range(a,b,step) lets you control the step.'},
  { id:'guard',chapter:2,title:'Guard',description:'guard is an early-exit check. If the condition is falsy, the else block runs (must exit).\nThis keeps the happy path unindented and errors on the side.',starter:'fn process(order) {\n  guard order       else { return "no order" }\n  guard order.items else { return "no items" }\n  guard order.items.length > 0 else { return "empty" }\n  return "processing " + order.items.length + " items"\n}\n\nlog process(null)\nlog process({ items: [] })\nlog process({ items: ["book", "pen"] })',expected:'no order\nempty\nprocessing 2 items',hint:'guard expr else { } — the else block must exit the function.'},
  { id:'match',chapter:2,title:'Match',description:'match is a powerful switch. It matches values and has a default case.',starter:'fn label(x) {\n  return match x {\n    case 0    => "zero"\n    case 1    => "one"\n    case 2, 3 => "two or three"\n    default   => "other"\n  }\n}\n\nlog label(0)\nlog label(2)\nlog label(99)',expected:'zero\ntwo or three\nother',hint:'match x { case value => result } — default catches everything else.'},

  { id:'functions',chapter:3,title:'Functions',description:'Functions use the fn keyword. Params can have types and defaults.\nThe return type goes after ->.',starter:'fn add(a: number, b: number) -> number {\n  return a + b\n}\n\nfn greet(name: string = "stranger") -> string {\n  return "Hello, " + name + "!"\n}\n\nlog add(3, 4)\nlog greet("Alice")\nlog greet()',expected:'7\nHello, Alice!\nHello, stranger!',hint:'fn name(params) -> returnType { body }. Defaults use = value.'},
  { id:'arrow-fn',chapter:3,title:'Arrow Functions',description:'Short functions can be written as arrows.\nSingle-expression bodies do not need braces or return.',starter:'val double = x => x * 2\nval add    = (a, b) => a + b\n\nval nums    = [1, 2, 3, 4, 5]\nval doubled = nums.map(x => x * 2)\nval sum     = nums.reduce((a, b) => a + b, 0)\n\nlog double(7)\nlog add(3, 4)\nlog doubled\nlog sum',expected:'14\n7\n[ 2, 4, 6, 8, 10 ]\n15',hint:'x => expr is a concise function. No braces needed for a single expression.'},
  { id:'higher-order',chapter:3,title:'Higher-Order Functions',description:'Functions are first-class in NTL.\nPass them around, return them, and use them with array methods.',starter:'val numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\n\nval evens   = numbers.filter(n => n % 2 === 0)\nval squares = evens.map(n => n * n)\nval total   = squares.reduce((acc, n) => acc + n, 0)\n\nlog "Evens:", evens\nlog "Squares:", squares\nlog "Total:", total',expected:'Evens: [ 2, 4, 6, 8, 10 ]\nSquares: [ 4, 16, 36, 64, 100 ]\nTotal: 220',hint:'filter keeps elements, map transforms them, reduce combines them.'},
  { id:'closures',chapter:3,title:'Closures',description:'Functions capture variables from their surrounding scope.\nThis is called a closure.',starter:'fn makeCounter(start) {\n  var count = start || 0\n  return {\n    next:  () => ++count,\n    reset: () => { count = start || 0 },\n    value: () => count\n  }\n}\n\nval c = makeCounter(10)\nlog c.next()\nlog c.next()\nlog c.next()\nc.reset()\nlog c.value()',expected:'11\n12\n13\n10',hint:'Inner functions remember variables from the outer function even after it returns.'},
  { id:'async',chapter:3,title:'Async / Await',description:'Async functions return a Promise. Use await to wait for them.\nsleep ms is a built-in that waits N milliseconds.',starter:'async fn fetchData(id) {\n  await sleep(10)\n  return { id, name: "Product " + id, price: id * 9.99 }\n}\n\nasync fn main() {\n  val product = await fetchData(5)\n  log product.name\n  log "Price: $" + product.price.toFixed(2)\n}\n\nmain()',expected:'Product 5\nPrice: $49.95',hint:'Mark a function async fn to use await inside it.'},

  { id:'arrays',chapter:4,title:'Arrays',description:'Arrays work like JavaScript arrays with all standard methods.\neach ... in is a clean way to loop over them.',starter:'val fruits = ["apple", "banana", "cherry"]\nfruits.push("date")\n\nlog fruits.length\nlog fruits[0]\nlog fruits.indexOf("banana")\n\nval upper = fruits.map(f => f.toUpperCase())\nlog upper',expected:"4\napple\n1\n[ 'APPLE', 'BANANA', 'CHERRY', 'DATE' ]",hint:'All JS array methods work: push, pop, map, filter, find, reduce...'},
  { id:'objects',chapter:4,title:'Objects',description:'Objects are key-value pairs.\nShorthand property syntax: if the variable name matches the key, you can skip the colon.',starter:'val name = "Carlos"\nval age  = 28\n\nval user = { name, age, role: "developer" }\n\nlog user.name\nlog user["age"]\n\nuser.team = "backend"\nlog Object.keys(user)',expected:"Carlos\n28\n[ 'name', 'age', 'role', 'team' ]",hint:'{ name } is shorthand for { name: name }. All standard Object methods work.'},
  { id:'destructuring',chapter:4,title:'Destructuring',description:'Pull values out of arrays and objects with clean syntax.',starter:'val [first, second, ...rest] = [1, 2, 3, 4, 5]\nlog first, second, rest\n\nval { name, age, role = "user" } = { name: "Ana", age: 25 }\nlog name, age, role',expected:"1 2 [ 3, 4, 5 ]\nAna 25 user",hint:'[ ] for arrays, { } for objects. ...rest collects remaining items.'},
  { id:'spread',chapter:4,title:'Spread and Rest',description:'Spread (...) copies elements into a new array or object.\nRest parameters collect extra function arguments.',starter:'val a = [1, 2, 3]\nval b = [4, 5, 6]\nval c = [...a, ...b]\nlog c\n\nval base  = { x: 0, y: 0, color: "red" }\nval moved = { ...base, x: 10 }\nlog moved\n\nfn sum(...nums) {\n  return nums.reduce((acc, n) => acc + n, 0)\n}\nlog sum(1, 2, 3, 4, 5)',expected:"[ 1, 2, 3, 4, 5, 6 ]\n{ x: 10, y: 0, color: 'red' }\n15",hint:'...array spreads elements. ...rest in params collects extras into an array.'},

  { id:'classes',chapter:5,title:'Classes',description:'NTL has full class support with extends and super.\nUse class for traditional syntax or @class for the enhanced NTL form.',starter:'class Animal {\n  constructor(name, sound) {\n    this.name  = name\n    this.sound = sound\n  }\n  speak() {\n    return `${this.name} says ${this.sound}!`\n  }\n}\n\nclass Dog extends Animal {\n  constructor(name) {\n    super(name, "woof")\n    this.tricks = []\n  }\n  learn(trick) { this.tricks.push(trick); return this }\n}\n\nval rex = new Dog("Rex")\nrex.learn("sit").learn("shake")\nlog rex.speak()\nlog rex.tricks',expected:"Rex says woof!\n[ 'sit', 'shake' ]",hint:'extends for inheritance, super() to call the parent constructor.'},
  { id:'atclass',chapter:5,title:'@class — Enhanced Classes',description:'@class is NTL\'s enhanced class syntax.\n\n  state — declares instance fields\n  fn inside a class — defines methods\n\nThis is the recommended style for new NTL code.',starter:'@class Counter {\n  state count\n  state step\n\n  fn constructor(step) {\n    this.count = 0\n    this.step  = step || 1\n  }\n\n  fn increment() {\n    this.count += this.step\n    return this\n  }\n\n  fn value() { return this.count }\n}\n\nval c = new Counter(5)\nc.increment().increment().increment()\nlog c.value()',expected:'15',hint:'state declares instance fields. fn defines methods. @class adds NTL enhancements.'},
  { id:'interfaces',chapter:5,title:'Interfaces',description:'Interfaces define the shape of an object.\nThey are checked at compile time with ntl check --strict.',starter:'@class User {\n  state id\n  state name\n\n  fn constructor(id, name) {\n    this.id   = id\n    this.name = name\n  }\n\n  fn serialize() -> string {\n    return JSON.stringify({ id: this.id, name: this.name })\n  }\n}\n\nval user = new User(1, "Nina")\nlog user.serialize()\nlog "ID:", user.id',expected:'{"id":1,"name":"Nina"}\nID: 1',hint:'Interfaces describe what methods and fields a class must have.'},

  { id:'modules',chapter:6,title:'Modules',description:'NTL uses CommonJS modules — the same as Node.js.\nrequire() works exactly like in Node.js, including all npm packages.',starter:'val path = require("path")\nval os   = require("os")\n\nlog path.join("src", "main.ntl")\nlog os.platform()\nlog os.cpus().length + " CPUs"',expected:null,hint:'require() works exactly like Node.js. Any npm package works too.'},
  { id:'ntl-cache',chapter:6,title:'ntl:cache',description:'ntl:cache is a fast LRU cache with TTL support.\nPerfect for caching database results or API responses.',starter:'val { createCache } = require("ntl:cache")\n\nval cache = createCache({ maxSize: 100, ttl: 5000 })\n\ncache.set("user:1", { id: 1, name: "Sofia" })\ncache.set("user:2", { id: 2, name: "Bruno" })\n\nlog cache.get("user:1")\nlog cache.has("user:2")\nlog cache.size()',expected:null,hint:'createCache() makes a new cache. set/get/has work like a Map with expiry.'},
  { id:'ntl-events',chapter:6,title:'ntl:events',description:'ntl:events is a pub/sub event emitter.\nUse it to decouple parts of your application.',starter:'val { createEmitter } = require("ntl:events")\n\nval bus = createEmitter()\n\nbus.on("user:created", u => {\n  log "New user:", u.name\n})\n\nbus.once("app:ready", () => {\n  log "App is ready!"\n})\n\nbus.emit("app:ready")\nbus.emit("user:created", { name: "Clara" })\nbus.emit("user:created", { name: "Bruno" })',expected:null,hint:'.on() listens forever. .once() listens once then removes itself.'},

  { id:'try-catch',chapter:7,title:'try / catch / finally',description:'Error handling works like JavaScript.\ntry something risky, catch the error, and optionally clean up in finally.',starter:'fn divide(a, b) {\n  if (b === 0) throw new Error("Division by zero")\n  return a / b\n}\n\ntry {\n  log divide(10, 2)\n  log divide(10, 0)\n} catch (err) {\n  log "Error:", err.message\n} finally {\n  log "Done"\n}',expected:'5\nError: Division by zero\nDone',hint:'finally always runs, whether or not an error was thrown.'},
  { id:'safe-try',chapter:7,title:'try? — Safe Expression',description:'try? expr returns null instead of throwing.\nGreat for risky one-liners like JSON parsing.',starter:'fn parseJSON(str) {\n  return JSON.parse(str)\n}\n\nval good = try? parseJSON(\'{"name":"Ana"}\')\nval bad  = try? parseJSON("not json")\n\nlog good\nlog bad',expected:"{ name: 'Ana' }\nnull",hint:'try? wraps the expression in a try/catch and returns null on any error.'},
  { id:'assert',chapter:7,title:'assert',description:'assert throws an error if a condition is false.\nUse it to document assumptions and catch bugs early.',starter:'fn createUser(name, age) {\n  assert typeof name === "string", "name must be a string"\n  assert age >= 0 && age <= 150,   "invalid age"\n  assert name.length > 0,          "name cannot be empty"\n  return { name, age }\n}\n\nval user = createUser("Luisa", 29)\nlog user.name\n\ntry {\n  createUser("", 29)\n} catch (e) {\n  log "Caught:", e.message\n}',expected:'Luisa\nCaught: name cannot be empty',hint:'assert condition, "message" throws if condition is false.'},

  { id:'generics',chapter:8,title:'Generics',description:'Generic functions work with any type while preserving type safety.',starter:'fn first<T>(arr: T[]) -> T {\n  return arr[0]\n}\n\nfn wrap<T>(value: T) -> object {\n  return { value }\n}\n\nlog first([10, 20, 30])\nlog first(["alpha", "beta"])\nlog wrap(42)\nlog wrap("hello")',expected:"10\nalpha\n{ value: 42 }\n{ value: 'hello' }",hint:'<T> declares a type parameter. T can be any type passed at call time.'},

  { id:'service-class',chapter:9,title:'Service Pattern',description:'NTL is designed for large-scale development.\nThis is the kind of code you write in production — a service with caching and logging.',starter:'val { createCache }  = require("ntl:cache")\nval { createLogger } = require("ntl:logger")\n\n@class UserService {\n  state cache\n  state log\n  state users\n\n  fn constructor() {\n    this.cache = createCache({ maxSize: 500, ttl: 60000 })\n    this.log   = createLogger({ name: "users" })\n    this.users = new Map()\n  }\n\n  fn create(name: string) -> object {\n    val id   = this.users.size + 1\n    val user = { id, name }\n    this.users.set(id, user)\n    this.log.info("User created", { id, name })\n    return user\n  }\n\n  fn find(id: number) -> object? {\n    val key    = "user:" + id\n    val cached = this.cache.get(key)\n    if (cached) return cached\n    val user = this.users.get(id) || null\n    if (user) this.cache.set(key, user)\n    return user\n  }\n}\n\nval svc = new UserService()\nsvc.create("Clara")\nsvc.create("Matheus")\n\nlog svc.find(1).name\nlog "done"',expected:null,hint:'state declares instance fields. @class adds the enhanced NTL class syntax.'},
  { id:'pipeline',chapter:9,title:'Pipelines with |>',description:'The pipe operator |> passes the result of one expression into the next function.\nMakes transformation code read left-to-right.',starter:'fn double(x)   { return x * 2 }\nfn addTen(x)   { return x + 10 }\nfn square(x)   { return x * x }\n\nval result = 5 |> double |> addTen |> square\nlog result\n\nval words = "  Hello World NTL  "\nval clean = words\n  |> (s => s.trim())\n  |> (s => s.toLowerCase())\n  |> (s => s.split(" "))\n\nlog clean',expected:"400\n[ 'hello', 'world', 'ntl' ]",hint:'x |> fn passes x as the argument to fn.'},
  { id:'defer',chapter:9,title:'Defer',description:'defer runs a block when the current function exits, no matter how.\nUseful for cleanup: closing connections, releasing locks, logging.',starter:'fn processFile(name) {\n  log "Opening:", name\n  defer { log "Closing:", name }\n\n  if (name === "bad.txt") {\n    throw new Error("Bad file!")\n  }\n\n  log "Processing:", name\n  return "done"\n}\n\ntry {\n  processFile("data.csv")\n  log "---"\n  processFile("bad.txt")\n} catch (e) {\n  log "Error:", e.message\n}',expected:'Opening: data.csv\nProcessing: data.csv\nClosing: data.csv\n---\nOpening: bad.txt\nClosing: bad.txt\nError: Bad file!',hint:'defer always runs when the function exits, even on errors or throws.'},

  { id:'npm',chapter:10,title:'Node.js & npm Compatibility',description:'NTL compiles to standard CommonJS.\nEvery npm package works — express, axios, prisma, mongoose, anything.',starter:'val path = require("path")\nval os   = require("os")\n\nlog "Platform:", os.platform()\nlog "CPUs:", os.cpus().length\nlog "Home:", os.homedir()\nlog "Node:", process.version',expected:null,hint:'require() works exactly like Node.js. No config needed for any npm package.'},
  { id:'final',chapter:10,title:'Congratulations!',description:'You finished the NTL tutorial.\n\nHere is what you can do next:\n\n  ntl run app.ntl              Run a file (JIT-compiled by V8)\n  ntl build app.ntl -o out.js  Compile to JavaScript\n  ntl check app.ntl --strict   Type-check the whole project\n  ntl watch app.ntl            Recompile on every save\n  ntl bundle src/ -o bundle.js Bundle everything into one file\n  ntl -e "log 42"              Run a one-liner\n  ntl init myproject           Scaffold a new project\n  ntl wasm app.ntl             Compile to WebAssembly\n  ntl native --arch=all        Cross-compile for 15 architectures\n  ntl tutorial                 Open this tutorial again\n\nNTL handles everything — scripts, APIs, microservices,\nenterprise backends, and large monorepos.\n\nWrite something great.',starter:'fn fib(n) {\n  if (n <= 1) { return n }\n  return fib(n - 1) + fib(n - 2)\n}\n\nval results = range(1, 11).map(n => `fib(${n}) = ${fib(n)}`)\neach r in results { log r }',expected:null,hint:'Try changing the code and experimenting!'},
];

function buildHTML(lessons) {
  const chapterNames = { 1:'Basics', 2:'Control Flow', 3:'Functions', 4:'Data Structures', 5:'Classes', 6:'Modules', 7:'Error Handling', 8:'Types', 9:'Enterprise Patterns', 10:'Real World' };
  const chapters = {};
  for (const l of lessons) { if (!chapters[l.chapter]) chapters[l.chapter] = []; chapters[l.chapter].push(l); }
  const sidebar = Object.entries(chapters).map(([ch, ls]) => `<div class="chapter"><div class="chapter-title">Chapter ${ch} — ${chapterNames[ch]||''}</div>${ls.map(l=>`<a class="lesson-link" data-id="${l.id}" href="#">${l.title}</a>`).join('')}</div>`).join('');
  const lessonData = JSON.stringify(lessons.map(l => ({ ...l, starter: l.starter, expected: l.expected })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NTL Language — Interactive Tutorial</title>
<style>
:root{--bg:#0d1117;--bg2:#161b22;--bg3:#21262d;--brd:#30363d;--txt:#e6edf3;--muted:#8b949e;--acc:#58a6ff;--grn:#3fb950;--red:#f85149;--ylw:#d29922;--mono:'Fira Code','Cascadia Code','Consolas',monospace;--sans:-apple-system,'Segoe UI',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--txt);font-family:var(--sans)}
.layout{display:grid;grid-template-columns:260px 1fr;grid-template-rows:52px 1fr;height:100vh}
.topbar{grid-column:1/-1;background:var(--bg2);border-bottom:1px solid var(--brd);display:flex;align-items:center;padding:0 20px;gap:10px}
.tlogo{font-size:17px;font-weight:700;color:var(--acc);letter-spacing:-0.5px}
.tsub{color:var(--muted);font-size:13px}
.tprog{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.pbar{width:110px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden}
.pfill{height:100%;background:var(--grn);border-radius:2px;transition:width .3s}
.sidebar{background:var(--bg2);border-right:1px solid var(--brd);overflow-y:auto;padding:12px 0}
.sidebar::-webkit-scrollbar{width:3px}.sidebar::-webkit-scrollbar-thumb{background:var(--brd)}
.chapter{margin-bottom:4px}
.chapter-title{padding:8px 16px 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:var(--muted)}
.lesson-link{display:flex;align-items:center;padding:6px 16px;font-size:13px;color:var(--txt);text-decoration:none;border-left:3px solid transparent;transition:all .12s;cursor:pointer}
.lesson-link:hover{background:var(--bg3);color:var(--acc)}
.lesson-link.active{background:var(--bg3);border-left-color:var(--acc);color:var(--acc)}
.lesson-link.done{color:var(--grn)}.lesson-link.done::after{content:"✓";margin-left:auto;font-size:11px}
.main{display:grid;grid-template-rows:1fr auto;overflow:hidden}
.content{display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.lesson-pane{padding:28px 32px;overflow-y:auto;border-right:1px solid var(--brd)}
.lesson-pane::-webkit-scrollbar{width:3px}.lesson-pane::-webkit-scrollbar-thumb{background:var(--brd)}
.lnum{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:var(--acc);margin-bottom:6px}
.ltitle{font-size:22px;font-weight:700;margin-bottom:18px;letter-spacing:-.5px}
.ldesc{font-size:13.5px;line-height:1.9;color:var(--muted);white-space:pre-wrap}
.ldesc code{background:var(--bg3);border:1px solid var(--brd);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--acc)}
.hint-box{margin-top:22px;padding:12px 16px;background:var(--bg2);border:1px solid var(--brd);border-left:3px solid var(--ylw);border-radius:6px}
.hint-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--ylw);margin-bottom:5px}
.hint-text{font-size:13px;color:var(--muted);line-height:1.7}
.editor-pane{display:flex;flex-direction:column;overflow:hidden}
.editor-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:12px;color:var(--muted)}
.efname{font-family:var(--mono);color:var(--txt);font-size:12px}
textarea{flex:1;resize:none;background:var(--bg);color:var(--txt);border:none;outline:none;padding:18px 20px;font-family:var(--mono);font-size:13px;line-height:1.75;tab-size:2}
.output-area{border-top:1px solid var(--brd);background:var(--bg2);min-height:120px;max-height:220px;display:flex;flex-direction:column}
.output-header{display:flex;align-items:center;justify-content:space-between;padding:7px 16px;border-bottom:1px solid var(--brd);flex-shrink:0}
.olabel{font-size:11px;font-weight:700;letter-spacing:.7px;color:var(--muted);text-transform:uppercase}
.output-body{flex:1;padding:12px 20px;font-family:var(--mono);font-size:13px;line-height:1.7;overflow-y:auto;white-space:pre-wrap}
.output-body.idle{color:var(--muted)}.output-body.ok{color:var(--grn)}.output-body.err{color:var(--red)}
.pill{font-size:11px;padding:2px 9px;border-radius:10px;font-weight:600}
.p-idle{background:var(--bg3);color:var(--muted)}.p-running{background:var(--ylw);color:#000}.p-ok{background:var(--grn);color:#000}.p-err{background:var(--red);color:#fff}
.bottombar{display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--bg2);border-top:1px solid var(--brd)}
.btn{padding:7px 18px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .12s}
.btn-run{background:var(--grn);color:#000}.btn-run:hover{opacity:.85}
.btn-reset{background:transparent;border:1px solid var(--brd);color:var(--muted)}.btn-reset:hover{border-color:var(--txt);color:var(--txt)}
.btn-next{background:var(--acc);color:#000;margin-left:auto}.btn-next:hover{opacity:.85}.btn-next:disabled{opacity:.3;cursor:not-allowed}
.arrows{display:flex;gap:4px}
.btn-arr{width:30px;height:30px;background:transparent;border:1px solid var(--brd);color:var(--muted);border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .12s}.btn-arr:hover{border-color:var(--txt);color:var(--txt)}.btn-arr:disabled{opacity:.3;cursor:not-allowed}
.kbd{background:var(--bg3);border:1px solid var(--brd);padding:2px 6px;border-radius:3px;font-family:var(--mono);font-size:11px;color:var(--muted)}
</style>
</head>
<body>
<div class="layout">
  <header class="topbar">
    <span class="tlogo">NTL</span>
    <span class="tsub">Interactive Tutorial</span>
    <div class="tprog">
      <span id="pt">0 / ${lessons.length}</span>
      <div class="pbar"><div class="pfill" id="pf"></div></div>
    </div>
  </header>
  <nav class="sidebar">${sidebar}</nav>
  <div class="main">
    <div class="content">
      <div class="lesson-pane">
        <div class="lnum" id="lnum"></div>
        <div class="ltitle" id="ltitle"></div>
        <div class="ldesc" id="ldesc"></div>
        <div class="hint-box" id="hbox" style="display:none">
          <div class="hint-label">Hint</div>
          <div class="hint-text" id="htxt"></div>
        </div>
      </div>
      <div class="editor-pane">
        <div class="editor-header">
          <span class="efname" id="efname">lesson.ntl</span>
          <span class="kbd">Ctrl+Enter</span>
        </div>
        <textarea id="ed" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
        <div class="output-area">
          <div class="output-header">
            <span class="olabel">Output</span>
            <span class="pill p-idle" id="status">idle</span>
          </div>
          <div class="output-body idle" id="out">Press Run to execute your code.</div>
        </div>
      </div>
    </div>
    <div class="bottombar">
      <div class="arrows">
        <button class="btn-arr" id="bprev">←</button>
        <button class="btn-arr" id="bnext2">→</button>
      </div>
      <button class="btn btn-reset" id="breset">Reset</button>
      <button class="btn btn-run" id="brun">▶  Run</button>
      <button class="btn btn-next" id="bnext" disabled>Next →</button>
    </div>
  </div>
</div>
<script>
const LS = ${lessonData};
let done = new Set(JSON.parse(localStorage.getItem('ntl-done')||'[]'));
let cur = 0, starter = '';

function saveDone(){ localStorage.setItem('ntl-done', JSON.stringify([...done])) }

function pct(){ return Math.round(done.size/LS.length*100) }

function updateProgress(){
  document.getElementById('pf').style.width = pct()+'%';
  document.getElementById('pt').textContent = done.size+' / '+LS.length;
}

function setOut(txt, cls){
  const el = document.getElementById('out');
  el.textContent = txt;
  el.className   = 'output-body '+cls;
}

function setStatus(s, label){
  const el = document.getElementById('status');
  el.textContent = label||s;
  el.className   = 'pill p-'+s;
}

function load(i){
  cur = i;
  const l = LS[i];
  starter = l.starter;
  document.getElementById('lnum').textContent   = 'Chapter '+l.chapter+' · Lesson '+(i+1);
  document.getElementById('ltitle').textContent = l.title;
  document.getElementById('efname').textContent = l.id+'.ntl';
  const dd = document.getElementById('ldesc');
  dd.innerHTML = l.description.replace(/\`([^\`]+)\`/g,'<code>$1</code>');
  const hb = document.getElementById('hbox');
  if(l.hint){ hb.style.display=''; document.getElementById('htxt').textContent=l.hint; }
  else hb.style.display='none';
  const saved = localStorage.getItem('ntl-code-'+l.id);
  document.getElementById('ed').value = saved!==null ? saved : l.starter;
  setOut('Press Run to execute your code.','idle');
  setStatus('idle','idle');
  document.querySelectorAll('.lesson-link').forEach(el => el.classList.toggle('active', el.dataset.id===l.id));
  document.getElementById('bprev').disabled   = i===0;
  document.getElementById('bnext2').disabled  = i===LS.length-1;
  document.getElementById('bnext').disabled   = !done.has(l.id) && l.expected!==null;
  updateProgress();
}

function norm(s){ return (s||'').replace(/\s+/g,' ').trim().toLowerCase(); }

async function run(){
  const code = document.getElementById('ed').value;
  const l = LS[cur];
  localStorage.setItem('ntl-code-'+l.id, code);
  setStatus('running','running');
  setOut('Running...','idle');
  try {
    const r = await fetch('/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    const d = await r.json();
    if(d.error){
      setOut(d.error,'err');
      setStatus('err','error');
    } else {
      const out = (d.output||'').trimEnd();
      setOut(out||'(no output)','ok');
      setStatus('ok','ok');
      if(l.expected===null || norm(out)===norm(l.expected)){
        done.add(l.id); saveDone(); updateProgress();
        document.querySelectorAll('.lesson-link').forEach(el => { if(el.dataset.id===l.id) el.classList.add('done'); });
        document.getElementById('bnext').disabled = false;
      }
    }
  } catch(e){ setOut('Network error: '+e.message,'err'); setStatus('err','error'); }
}

document.getElementById('brun').addEventListener('click', run);
document.getElementById('breset').addEventListener('click', ()=>{ document.getElementById('ed').value = starter; });
document.getElementById('bnext').addEventListener('click', ()=>{ if(cur<LS.length-1) load(cur+1); });
document.getElementById('bprev').addEventListener('click', ()=>{ if(cur>0) load(cur-1); });
document.getElementById('bnext2').addEventListener('click', ()=>{ if(cur<LS.length-1) load(cur+1); });
document.querySelectorAll('.lesson-link').forEach((el,i)=>{
  if(done.has(el.dataset.id)) el.classList.add('done');
  el.addEventListener('click', e=>{ e.preventDefault(); const idx=LS.findIndex(l=>l.id===el.dataset.id); if(idx!==-1) load(idx); });
});
document.getElementById('ed').addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); run(); }
  if(e.key==='Tab'){ e.preventDefault(); const el=e.target,s=el.selectionStart,v=el.value; el.value=v.slice(0,s)+'  '+v.slice(el.selectionEnd); el.selectionStart=el.selectionEnd=s+2; }
});
load(0); updateProgress();
document.querySelectorAll('.lesson-link').forEach(el => { if(done.has(el.dataset.id)) el.classList.add('done'); });
</script>
</body>
</html>`;
}

function runNTL(code) {
  return new Promise(resolve => {
    const { Compiler } = require('./src/compiler');
    const vm = require('vm');
    const compiler = new Compiler({ target:'node', treeShake:true });
    const result   = compiler.compileSource(code, '<tutorial>', {});
    if (!result.success) {
      return resolve({ error: result.errors.map(e=>e.message||String(e)).join('\n') });
    }
    const logs = [];
    const fc = {
      log:   (...a) => logs.push(a.map(x => typeof x==='object'&&x!==null ? JSON.stringify(x) : String(x)).join(' ')),
      warn:  (...a) => logs.push(a.map(x => String(x)).join(' ')),
      error: (...a) => logs.push(a.map(x => String(x)).join(' ')),
    };
    const ctx = {
      console: fc,
      require: m => {
        const safe = ['path','os','fs','crypto','url','util','events','stream','assert','querystring','zlib'];
        if (safe.includes(m)) return require(m);
        if (m.startsWith('ntl:')) {
          const { resolveToPath } = require('./src/module-resolver');
          const p = resolveToPath(m);
          if (p) return require(p);
        }
        throw new Error('Module not available in tutorial sandbox: '+m);
      },
      process: { env:{}, argv:[], platform:process.platform, version:process.version, versions:process.versions },
      setTimeout, setInterval, clearTimeout, clearInterval, setImmediate, clearImmediate,
      Promise, Math, JSON, Date, performance, Buffer,
      Object, Array, String, Number, Boolean,
      Error, TypeError, RangeError, ReferenceError, SyntaxError,
      Map, Set, WeakMap, WeakSet, RegExp, Symbol, BigInt,
      URL, URLSearchParams, TextEncoder, TextDecoder,
      global: null, globalThis: null,
    };
    ctx.global = ctx; ctx.globalThis = ctx;
    try {
      vm.createContext(ctx);
      new vm.Script(result.code, { filename:'<tutorial>', displayErrors:true }).runInContext(ctx, { timeout:5000 });
      resolve({ output: logs.join('\n') });
    } catch (e) {
      resolve({ error: e.message||String(e) });
    }
  });
}

const html = buildHTML(LESSONS);

const server = http.createServer((req, res) => {
  if (req.method==='GET' && req.url==='/') {
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  if (req.method==='POST' && req.url==='/run') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 64000) req.destroy(); });
    req.on('end', async () => {
      let code;
      try { code = JSON.parse(body).code; } catch(_) { res.writeHead(400); res.end('{}'); return; }
      const out = await runNTL(String(code).slice(0, 20000));
      res.writeHead(200, { 'Content-Type':'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  const B = t => `\x1b[1m${t}\x1b[0m`;
  const C = t => `\x1b[36m${t}\x1b[0m`;
  const G = t => `\x1b[32m${t}\x1b[0m`;
  const D = t => `\x1b[90m${t}\x1b[0m`;
  process.stdout.write('\n');
  process.stdout.write(B(C('  NTL')) + D(' — Interactive Tutorial\n'));
  process.stdout.write('\n');
  process.stdout.write(G('  ●') + '  Open: ' + B(C(`http://localhost:${PORT}`)) + '\n');
  process.stdout.write(D(`  ·  ${LESSONS.length} lessons · 10 chapters · write and run real NTL code\n`));
  process.stdout.write(D('  ·  Ctrl+C to stop\n'));
  process.stdout.write('\n');
});

server.on('error', e => {
  if (e.code==='EADDRINUSE') {
    process.stderr.write(`\x1b[31m  error: port ${PORT} is already in use\x1b[0m\n\n`);
  } else {
    process.stderr.write('\x1b[31m  error: '+e.message+'\x1b[0m\n');
  }
  process.exit(1);
});
