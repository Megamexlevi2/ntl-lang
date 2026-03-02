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

const { Router, cors, rateLimit, listen } = __ntlRequire("modules/http.js");

const { Database } = __ntlRequire("modules/db.js");

const { signJWT, verifyJWT, hashPassword, verifyPassword, uuid } = __ntlRequire("modules/crypto.js");

const { v } = __ntlRequire("modules/validate.js");

const logger = __ntlRequire("modules/logger.js");

const os = require("os");

const path = require("path");

const PORT = 3001;

const SECRET = "ntl-jwt-secret-change-in-production";

const DB_FILE = ":memory:";

const log = logger.create({ name: "api", level: 0 });

const db = new Database(DB_FILE);

db.createTable("users", function(t) {
  t.id();
  t.text("id_str", { unique: true });
  t.text("name", {  });
  t.text("email", { unique: true });
  t.text("password_hash", {  });
  t.text("role", {  });
  t.timestamps();
});

db.createTable("sessions", function(t) {
  t.id();
  t.text("user_id", {  });
  t.text("token", { unique: true });
  t.text("expires_at", {  });
  t.timestamps();
});

const adminHash = hashPassword("admin123");

db.table("users").insert({ id_str: uuid(), name: "Admin", email: "admin@example.com", password_hash: adminHash, role: "admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

log.info("Database initialized");

const RegisterSchema = v.object({ name: v.string().minLength(2).maxLength(100), email: v.string().email(), password: v.string().minLength(8) });

const LoginSchema = v.object({ email: v.string().email(), password: v.string().minLength(1) });

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  if (!(header.startsWith("Bearer "))) {
    res.status(401).json({ error: true, message: "Missing or invalid Authorization header" });
    return;
  }
  const token = header.slice(7);
  const payload = ((() => { try { return verifyJWT(token, SECRET); } catch(_ntl_e) { return null; } })());
  if (!(payload)) {
    res.status(401).json({ error: true, message: "Invalid or expired token" });
    return;
  }
  req.user = payload;
  if (next) {
    next();
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, function() {
  if (!(req.user && req.user.role === "admin")) {
    res.status(403).json({ error: true, message: "Admin access required" });
    return;
  }
  if (next) {
    next();
  }
});
}

const router = new Router();

router.use(cors({ origin: "*" }));

router.use(rateLimit({ windowMs: 60000, max: 100 }));

router.get("/health", function(req, res) {
  res.json({ status: "ok", uptime: process.uptime(), memory: process.memoryUsage(), platform: os.platform(), node: process.version, ntl: "2.1.0" });
});

router.post("/auth/register", function(req, res) {
  const body = req.body;
  const result = RegisterSchema.safeParse(body);
  if (!(result.success)) {
    res.status(422).json({ error: true, errors: result.errors });
    return;
  }
  const existing = db.table("users").where("email", "=", result.data.email).first();
  if (existing) {
    res.status(409).json({ error: true, message: "Email already registered" });
    return;
  }
  const id = uuid();
  const hash = hashPassword(result.data.password);
  const now = new Date().toISOString();
  db.table("users").insert({ id_str: id, name: result.data.name, email: result.data.email, password_hash: hash, role: "user", created_at: now, updated_at: now });
  const token = signJWT({ sub: id, email: result.data.email, role: "user" }, SECRET, 86400);
  log.info("User registered:", result.data.email);
  res.status(201).json({ message: "Account created", token, user: { id, name: result.data.name, email: result.data.email, role: "user" } });
});

router.post("/auth/login", function(req, res) {
  const body = req.body;
  const result = LoginSchema.safeParse(body);
  if (!(result.success)) {
    res.status(422).json({ error: true, errors: result.errors });
    return;
  }
  const user = db.table("users").where("email", "=", result.data.email).first();
  if (!(user)) {
    res.status(401).json({ error: true, message: "Invalid email or password" });
    return;
  }
  if (!(verifyPassword(result.data.password, user.password_hash))) {
    res.status(401).json({ error: true, message: "Invalid email or password" });
    return;
  }
  const token = signJWT({ sub: user.id_str, email: user.email, role: user.role }, SECRET, 86400);
  log.info("Login:", user.email);
  res.json({ token, user: { id: user.id_str, name: user.name, email: user.email, role: user.role } });
});

router.get("/users/me", requireAuth, function(req, res) {
  const user = db.table("users").where("id_str", "=", req.user.sub).first();
  if (!(user)) {
    res.status(404).json({ error: true, message: "User not found" });
    return;
  }
  res.json({ id: user.id_str, name: user.name, email: user.email, role: user.role, createdAt: user.created_at });
});

router.get("/users", requireAdmin, function(req, res) {
  const page = parseInt(req.query.page || "1");
  const perPage = parseInt(req.query.per_page || "20");
  const result = db.table("users").paginate(page, perPage);
  res.json({ data: result.data.map(function(u) {
  return { id: u.id_str, name: u.name, email: u.email, role: u.role, createdAt: u.created_at };
}), pagination: { page: result.page, perPage: result.perPage, total: result.total, totalPages: result.totalPages, hasNext: result.hasNext, hasPrev: result.hasPrev } });
});

router.notFound(function(req, res) {
  res.status(404).json({ error: true, message: "Route not found", path: req.path });
});

router.onError(function(err, req, res) {
  log.error("Unhandled error:", err.message);
  res.status(500).json({ error: true, message: "Internal server error" });
});

listen(PORT, router, function(port) {
  log.info(`Server started on http://localhost:${port}`);
  log.info("Endpoints:");
  log.info("  GET  /health");
  log.info("  POST /auth/register");
  log.info("  POST /auth/login");
  log.info("  GET  /users/me  (requires token)");
  log.info("  GET  /users     (requires admin token)");
});
