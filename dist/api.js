/* ntl-lang runtime - github.com/Megamexlevi2/ntl-lang */
var __ntlDir=(function(){
  var _p=require('path');
  try{return _p.dirname(require.resolve('ntl-lang/package.json'));}catch(_){}
  try{
    var _r=require('fs').realpathSync(process.argv[1]||'');
    var _m=_r.match(/^(.*?node_modules[\/\\]ntl-lang)/);
    if(_m)return _m[1];
  }catch(_){}
  return "/storage/emulated/0/ntl";
})();
var __ntlRequire=function(m){return require(require('path').join(__ntlDir,m));};

const http = __ntlRequire("modules/http.js");

const HttpStatus = Object.freeze({
  Ok: 200,
  Created: 201,
  BadRequest: 400,
  NotFound: 404,
  InternalError: 500
});

const users = {  };

let requestCount = 0;

function generateId() {
  return Math.floor(Math.random() * 9000) + 1000;
}

const router = http.Router();

router.use((req, res, next) => {
  requestCount = requestCount + 1;
  console.log(`${req.method} ${req.path} [${requestCount}]`);
  next();
});

router.get("/", (req, res) => {
  res.json({ message: "NTL API Server", version: "1.0.0", time: Date.now() });
});

router.get("/status", (req, res) => {
  let userCount = 0;
  for (const key in users) {
    userCount = userCount + 1;
  }
  res.json({ uptime: process.uptime(), users: userCount, requests: requestCount });
});

router.get("/users", (req, res) => {
  const userList = [];
  for (const key in users) {
    userList.push(users[key]);
  }
  res.json(userList);
});

router.get("/users/:id", (req, res) => {
  const id = req.params.id;
  const numericId = Number(id);
  if (isNaN(numericId)) {
    res.status(HttpStatus.BadRequest).json({ error: "Invalid ID" });
    return;
  }
  const idStr = String(numericId);
  {
    const user = users[idStr];
    if (user !== null && user !== undefined) {
      res.json(user);
    }
    else {
      res.status(HttpStatus.NotFound).json({ error: "User not found" });
    }
  }
});

router.post("/users", (req, res) => {
  const body = req.body;
  if (body.name === undefined) {
    res.status(HttpStatus.BadRequest).json({ error: "Name required" });
    return;
  }
  if (body.email === undefined) {
    res.status(HttpStatus.BadRequest).json({ error: "Email required" });
    return;
  }
  const id = generateId();
  const idStr = String(id);
  const user = { id: id, name: body.name, email: body.email, role: "user" };
  {
    const role = body.role;
    if (role !== null && role !== undefined) {
      user.role = role;
    }
  }
  users[idStr] = user;
  res.status(HttpStatus.Created).json(user);
});

router.delete("/users/:id", (req, res) => {
  const id = req.params.id;
  const numericId = Number(id);
  if (isNaN(numericId)) {
    res.status(HttpStatus.BadRequest).json({ error: "Invalid ID" });
    return;
  }
  const idStr = String(numericId);
  if (users[idStr] === undefined) {
    res.status(HttpStatus.NotFound).json({ error: "User not found" });
    return;
  }
  delete users[idStr];
  res.json({ deleted: true, id: numericId });
});

router.all("*", (req, res) => {
  res.status(HttpStatus.NotFound).json({ error: `Route ${req.method} ${req.path} not found` });
});

const server = http.createServer(router);

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("Routes: /, /status, /users, /users/:id");
});
