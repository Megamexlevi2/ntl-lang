/* ntl-lang runtime - github.com/Megamexlevi2/ntl-lang */
var __ntlDir=(function(){
  var _p=require('path');
  try{return _p.dirname(require.resolve('ntl-lang/package.json'));}catch(_){}
  try{
    var _r=require('fs').realpathSync(process.argv[1]||'');
    var _m=_r.match(/^(.*?node_modules[\/\\]ntl-lang)/);
    if(_m)return _m[1];
  }catch(_){}
  return "/data/data/com.termux/files/usr/lib/node_modules/@david0dev/ntl-lang";
})();
var __ntlSelfHosted=new Set(['cache','events','logger','validate','env','queue']);
var __ntlRequire=function(m){
  var _base=m.replace(/\.js$/,'').split('/').pop();
  if(__ntlSelfHosted.has(_base)){
    var _loaded=require(require('path').join(__ntlDir,'src','stdlib-loader.js')).loadStdlibModule(_base);
    return _loaded;
  }
  return require(require('path').join(__ntlDir,m));
};

const http = __ntlRequire("modules/http.js");
const { Database } = __ntlRequire("modules/db.js");
const { Logger } = __ntlRequire("modules/logger.js");
const { Cache } = __ntlRequire("modules/cache.js");
const { Env } = __ntlRequire("modules/env.js");
const env = new Env();
const PORT = env.int("PORT", 3000);
const log = new Logger({ name: "fullstack" });
const db = new Database(":memory:");
const cache = new Cache({ ttl: 60000 });
db.createTable("users", t => {
  t.id();
  t.text("name");
  t.text("email", { unique: true });
  t.boolean("active", true);
});
db.table("users").insertMany([{ name: "Alice Johnson", email: "alice@example.com", active: 1 }, { name: "Bob Smith", email: "bob@example.com", active: 1 }, { name: "Carol White", email: "carol@example.com", active: 0 }]);
function buildPage(users) {
  const active = users.filter(u => u.active).length;
  const inactive = users.length - active;
  const rows = users.map(u => {
  const statusColor = u.active ? "green" : "red";
  const statusLabel = u.active ? "Active" : "Inactive";
  return ["<tr>", "<td>" + u.name + "</td>", "<td>" + u.email + "</td>", "<td><span class=\"badge " + statusColor + "\">" + statusLabel + "</span></td>", "</tr>"].join("");
}).join("");
  return ["<!DOCTYPE html>", "<html lang=\"en\">", "<head>", "<meta charset=\"UTF-8\">", "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">", "<title>NTL Full-Stack Demo</title>", "<style>", "body { font-family: system-ui, sans-serif; background: #f9fafb; margin: 0; padding: 32px; }", ".wrap { max-width: 700px; margin: 0 auto; }", "h1 { font-size: 2rem; font-weight: 700; margin-bottom: 4px; color: #111827; }", ".sub { color: #6b7280; margin-bottom: 24px; }", ".stats { display: flex; gap: 16px; margin-bottom: 24px; }", ".stat { flex: 1; background: white; padding: 16px 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }", ".sv { font-size: 2rem; font-weight: 700; }", ".sl { color: #9ca3af; font-size: 13px; }", "table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }", "th { background: #f3f4f6; padding: 12px 16px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }", "td { padding: 12px 16px; }", "tr:not(:last-child) td { border-bottom: 1px solid #f3f4f6; }", ".badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }", ".badge.green { background: #d1fae5; color: #065f46; }", ".badge.red { background: #fee2e2; color: #991b1b; }", ".links { margin-top: 20px; display: flex; gap: 10px; }", "a.btn { display: inline-block; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; }", ".primary { background: #3b82f6; color: white; }", ".secondary { background: #e5e7eb; color: #374151; }", "</style>", "</head>", "<body>", "<div class=\"wrap\">", "<h1>NTL Full-Stack Demo</h1>", "<p class=\"sub\">Backend + Frontend in one unified language</p>", "<div class=\"stats\">", "<div class=\"stat\"><div class=\"sv\">" + users.length + "</div><div class=\"sl\">Total Users</div></div>", "<div class=\"stat\"><div class=\"sv\">" + active + "</div><div class=\"sl\">Active</div></div>", "<div class=\"stat\"><div class=\"sv\">" + inactive + "</div><div class=\"sl\">Inactive</div></div>", "</div>", "<table>", "<thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>", "<tbody>" + rows + "</tbody>", "</table>", "<div class=\"links\">", "<a class=\"btn primary\" href=\"/api/users\">View JSON API</a>", "<a class=\"btn secondary\" href=\"/health\">Health Check</a>", "</div>", "</div>", "</body></html>"].join("\n");
}
const router = new http.Router();
router.use(http.cors());
router.get("/", async (req, res) => {
  const users = await cache.getOrSet("users:all", async () => {
  return db.table("users").orderBy("name").all();
}, 30000);
  res.html(buildPage(users));
});
router.get("/api/users", (req, res) => {
  const { page = "1", limit = "20" } = req.query;
  const result = db.table("users").orderBy("name").paginate(parseInt(page), parseInt(limit));
  res.json(result);
});
router.get("/api/users/:id", (req, res) => {
  const user = db.table("users").find(parseInt(req.params.id));
  if (!(user)) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});
router.post("/api/users", (req, res) => {
  const { name, email } = req.body || {  };
  if (!(name && email)) {
    res.status(400).json({ error: "name and email required" });
    return;
  }
  const id = db.table("users").insert({ name, email, active: 1 });
  const user = db.table("users").find(id);
  cache.delete("users:all");
  res.status(201).json({ user });
});
router.delete("/api/users/:id", (req, res) => {
  const n = db.table("users").where("id", req.params.id).delete();
  if (!(n)) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  cache.delete("users:all");
  res.json({ deleted: true });
});
router.get("/health", (req, res) => {
  res.json({ status: "ok", version: "2.1.0", uptime: process.uptime(), users: db.table("users").count() });
});
http.listen(PORT, router, () => {
  log.info(`Full-stack server running at http://localhost:${PORT}`);
  log.info("  GET  /             HTML page (SSR)");
  log.info("  GET  /api/users    JSON REST API");
  log.info("  POST /api/users    Create user");
  log.info("  GET  /health       Health check");
});
