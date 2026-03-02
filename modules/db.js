'use strict';
// ntl:db — Production SQLite database module
// Uses Node 22+ built-in node:sqlite (no npm dependencies)

let _sqlite;
try {
  _sqlite = require('node:sqlite');
} catch(e) {
  _sqlite = null;
}

function requireSqlite() {
  if (!_sqlite) throw new Error('[ntl:db] SQLite requires Node.js 22+. Current: ' + process.version);
  return _sqlite;
}

// ── Connection ─────────────────────────────────────────────────────────────

class Database {
  constructor(file, options) {
    options = options || {};
    const { DatabaseSync } = requireSqlite();
    this._db = new DatabaseSync(file || ':memory:');
    this._file = file || ':memory:';
    this._migrations = [];
    // Enable WAL mode for better write concurrency
    if (file && file !== ':memory:') {
      this._db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;');
    } else {
      this._db.exec('PRAGMA foreign_keys=ON;');
    }
  }

  // ── Raw Queries ──────────────────────────────────────────────────────────

  exec(sql) {
    this._db.exec(sql);
    return this;
  }

  run(sql, params) {
    const stmt = this._db.prepare(sql);
    return stmt.run(...(params || []));
  }

  get(sql, params) {
    const stmt = this._db.prepare(sql);
    return stmt.get(...(params || [])) || null;
  }

  all(sql, params) {
    const stmt = this._db.prepare(sql);
    return stmt.all(...(params || []));
  }

  prepare(sql) {
    return this._db.prepare(sql);
  }

  // ── Transaction ──────────────────────────────────────────────────────────

  transaction(fn) {
    this.exec('BEGIN');
    try {
      const result = fn(this);
      this.exec('COMMIT');
      return result;
    } catch (e) {
      this.exec('ROLLBACK');
      throw e;
    }
  }

  // ── Query Builder ────────────────────────────────────────────────────────

  table(name) {
    return new QueryBuilder(this, name);
  }

  from(name) {
    return this.table(name);
  }

  // ── Schema Builder ───────────────────────────────────────────────────────

  schema() {
    return new SchemaBuilder(this);
  }

  createTable(name, fn) {
    const s = new TableDefinition(name);
    fn(s);
    this.exec(s._toSQL());
    return this;
  }

  dropTable(name, ifExists) {
    this.exec(`DROP TABLE ${ifExists ? 'IF EXISTS ' : ''}${name}`);
    return this;
  }

  hasTable(name) {
    const r = this.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [name]);
    return r !== null;
  }

  tables() {
    return this.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).map(r => r.name);
  }

  // ── Migrations ───────────────────────────────────────────────────────────

  migration(version, up, down) {
    this._migrations.push({ version, up, down });
    return this;
  }

  migrate() {
    this.exec(`CREATE TABLE IF NOT EXISTS _ntl_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const applied = new Set(this.all('SELECT version FROM _ntl_migrations').map(r => r.version));
    const pending = this._migrations.filter(m => !applied.has(m.version)).sort((a, b) => a.version - b.version);
    for (const m of pending) {
      this.transaction(db => {
        m.up(db);
        db.run('INSERT INTO _ntl_migrations (version) VALUES (?)', [m.version]);
      });
    }
    return this;
  }

  rollback(steps) {
    steps = steps || 1;
    const applied = this.all('SELECT version FROM _ntl_migrations ORDER BY version DESC LIMIT ?', [steps]);
    for (const row of applied) {
      const m = this._migrations.find(x => x.version === row.version);
      if (m && m.down) {
        this.transaction(db => {
          m.down(db);
          db.run('DELETE FROM _ntl_migrations WHERE version=?', [row.version]);
        });
      }
    }
    return this;
  }

  // ── Model ────────────────────────────────────────────────────────────────

  model(tableName, options) {
    return new Model(this, tableName, options || {});
  }

  close() {
    this._db.close();
  }

  get file() { return this._file; }
}

// ── Query Builder ────────────────────────────────────────────────────────────

class QueryBuilder {
  constructor(db, table) {
    this._db = db;
    this._table = table;
    this._wheres = [];
    this._params = [];
    this._orderBy = [];
    this._groupBy = [];
    this._having = null;
    this._limit = null;
    this._offset = null;
    this._joins = [];
    this._select = ['*'];
    this._distinct = false;
  }

  select(...cols) { this._select = cols.length ? cols : ['*']; return this; }
  distinct() { this._distinct = true; return this; }

  _clone() {
    const q = new QueryBuilder(this._db, this._table);
    q._wheres = [...this._wheres];
    q._params = [...this._params];
    q._orderBy = [...this._orderBy];
    q._groupBy = [...this._groupBy];
    q._having = this._having;
    q._limit = this._limit;
    q._offset = this._offset;
    q._joins = [...this._joins];
    q._select = [...this._select];
    q._distinct = this._distinct;
    return q;
  }

  where(col, op, val) {
    const q = this._clone();
    if (val === undefined) { val = op; op = '='; }
    if (val === null)  { q._wheres.push(`${col} IS NULL`); return q; }
    q._wheres.push(`${col} ${op} ?`);
    q._params.push(val);
    return q;
  }

  whereIn(col, vals) {
    const q = this._clone();
    if (!vals || !vals.length) { q._wheres.push('0=1'); return q; }
    q._wheres.push(`${col} IN (${vals.map(() => '?').join(',')})`);
    q._params.push(...vals);
    return q;
  }

  whereNotIn(col, vals) {
    const q = this._clone();
    if (!vals || !vals.length) return q;
    q._wheres.push(`${col} NOT IN (${vals.map(() => '?').join(',')})`);
    q._params.push(...vals);
    return q;
  }

  whereLike(col, pattern) {
    const q = this._clone();
    q._wheres.push(`${col} LIKE ?`);
    q._params.push(pattern);
    return q;
  }

  whereBetween(col, min, max) {
    const q = this._clone();
    q._wheres.push(`${col} BETWEEN ? AND ?`);
    q._params.push(min, max);
    return q;
  }

  whereNull(col)    { const q=this._clone(); q._wheres.push(`${col} IS NULL`); return q; }
  whereNotNull(col) { const q=this._clone(); q._wheres.push(`${col} IS NOT NULL`); return q; }

  orderBy(col, dir) { const q=this._clone(); q._orderBy.push(`${col} ${(dir||'ASC').toUpperCase()}`); return q; }
  orderByDesc(col)  { return this.orderBy(col, 'DESC'); }
  groupBy(...cols)  { const q=this._clone(); q._groupBy.push(...cols); return q; }
  having(expr, ...params) { const q=this._clone(); q._having = expr; q._params.push(...params); return q; }
  limit(n)          { const q=this._clone(); q._limit = n; return q; }
  offset(n)         { const q=this._clone(); q._offset = n; return q; }
  skip(n)           { return this.offset(n); }
  take(n)           { return this.limit(n); }

  join(table, a, op, b)       { const q=this._clone(); q._joins.push(`INNER JOIN ${table} ON ${a} ${op} ${b}`); return q; }
  leftJoin(table, a, op, b)   { const q=this._clone(); q._joins.push(`LEFT JOIN ${table} ON ${a} ${op} ${b}`); return q; }
  rightJoin(table, a, op, b)  { const q=this._clone(); q._joins.push(`LEFT JOIN ${table} ON ${a} ${op} ${b}`); return q; } // SQLite has no RIGHT JOIN

  _buildWhere() {
    return this._wheres.length ? ' WHERE ' + this._wheres.join(' AND ') : '';
  }

  _buildSelect() {
    const d = this._distinct ? 'DISTINCT ' : '';
    const cols = this._select.join(', ');
    let sql = `SELECT ${d}${cols} FROM ${this._table}`;
    if (this._joins.length) sql += ' ' + this._joins.join(' ');
    sql += this._buildWhere();
    if (this._groupBy.length) sql += ' GROUP BY ' + this._groupBy.join(', ');
    if (this._having) sql += ' HAVING ' + this._having;
    if (this._orderBy.length) sql += ' ORDER BY ' + this._orderBy.join(', ');
    if (this._limit !== null) sql += ' LIMIT ' + this._limit;
    if (this._offset !== null) sql += ' OFFSET ' + this._offset;
    return sql;
  }

  get()    { return this._db.get(this._buildSelect(), this._params) || null; }
  first()  { return this.limit(1).get(); }
  all()    { return this._db.all(this._buildSelect(), this._params); }
  find(id) { if (id !== undefined) return this.where(this._pk||'id','=',id).first(); return this.all(); }

  count(col) {
    const old = this._select;
    this._select = [`COUNT(${col || '*'}) as _count`];
    const r = this._db.get(this._buildSelect(), this._params);
    this._select = old;
    return r ? r._count : 0;
  }

  sum(col) {
    const old = this._select;
    this._select = [`SUM(${col}) as _sum`];
    const r = this._db.get(this._buildSelect(), this._params);
    this._select = old;
    return r ? (r._sum || 0) : 0;
  }

  avg(col) {
    const old = this._select;
    this._select = [`AVG(${col}) as _avg`];
    const r = this._db.get(this._buildSelect(), this._params);
    this._select = old;
    return r ? (r._avg || 0) : 0;
  }

  min(col) {
    const old = this._select;
    this._select = [`MIN(${col}) as _min`];
    const r = this._db.get(this._buildSelect(), this._params);
    this._select = old;
    return r ? r._min : null;
  }

  max(col) {
    const old = this._select;
    this._select = [`MAX(${col}) as _max`];
    const r = this._db.get(this._buildSelect(), this._params);
    this._select = old;
    return r ? r._max : null;
  }

  exists() { return this.count() > 0; }

  pluck(col) {
    const old = this._select;
    this._select = [col];
    const rows = this._db.all(this._buildSelect(), this._params);
    this._select = old;
    return rows.map(r => r[col]);
  }

  insert(data) {
    const keys = Object.keys(data);
    const vals = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${this._table} (${keys.join(',')}) VALUES (${placeholders})`;
    const r = this._db.run(sql, vals);
    return r.lastInsertRowid;
  }

  insertMany(rows) {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${this._table} (${keys.join(',')}) VALUES (${placeholders})`;
    const stmt = this._db.prepare(sql);
    const ids = [];
    for (const row of rows) {
      const r = stmt.run(...keys.map(k => row[k]));
      ids.push(r.lastInsertRowid);
    }
    return ids;
  }

  update(data) {
    const keys = Object.keys(data);
    if (!keys.length) return 0;
    const sets = keys.map(k => `${k}=?`).join(',');
    const vals = [...keys.map(k => data[k]), ...this._params];
    const sql = `UPDATE ${this._table} SET ${sets}${this._buildWhere()}`;
    const r = this._db.run(sql, vals);
    return r.changes || 0;
  }

  upsert(data, conflictCols) {
    const keys = Object.keys(data);
    const vals = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(',');
    const conflict = (conflictCols || ['id']).join(',');
    const updates = keys.filter(k => !conflictCols || !conflictCols.includes(k))
      .map(k => `${k}=excluded.${k}`).join(',');
    const sql = `INSERT INTO ${this._table} (${keys.join(',')}) VALUES (${placeholders})
      ON CONFLICT(${conflict}) DO UPDATE SET ${updates}`;
    return this._db.run(sql, vals);
  }

  delete() {
    const sql = `DELETE FROM ${this._table}${this._buildWhere()}`;
    const r = this._db.run(sql, this._params);
    return r.changes || 0;
  }

  truncate() {
    this._db.exec(`DELETE FROM ${this._table}`);
    return this;
  }

  paginate(page, perPage) {
    page = Math.max(1, page || 1);
    perPage = perPage || 20;
    const total = this.count();
    const data = this.limit(perPage).offset((page - 1) * perPage).all();
    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      hasNext: page * perPage < total,
      hasPrev: page > 1
    };
  }
}

// ── Table Definition ─────────────────────────────────────────────────────────

class TableDefinition {
  constructor(name) {
    this._name = name;
    this._cols = [];
    this._constraints = [];
  }

  id(name) {
    name = name || 'id';
    this._cols.push(`${name} INTEGER PRIMARY KEY AUTOINCREMENT`);
    return this;
  }

  text(name, options) {
    options = options || {};
    let def = `${name} TEXT`;
    if (!options.nullable) def += ' NOT NULL';
    if (options.unique) def += ' UNIQUE';
    if (options.default !== undefined) def += ` DEFAULT ${JSON.stringify(options.default)}`;
    this._cols.push(def);
    return this;
  }

  integer(name, options) {
    options = options || {};
    let def = `${name} INTEGER`;
    if (!options.nullable) def += ' NOT NULL DEFAULT 0';
    if (options.unique) def += ' UNIQUE';
    if (options.default !== undefined) def = `${name} INTEGER DEFAULT ${options.default}`;
    this._cols.push(def);
    return this;
  }

  real(name, options) {
    options = options || {};
    let def = `${name} REAL DEFAULT 0`;
    if (options.nullable) def = `${name} REAL`;
    this._cols.push(def);
    return this;
  }

  boolean(name, defaultVal) {
    this._cols.push(`${name} INTEGER NOT NULL DEFAULT ${defaultVal ? 1 : 0}`);
    return this;
  }

  json(name, options) {
    options = options || {};
    let def = `${name} TEXT`;
    if (!options.nullable) def += " NOT NULL DEFAULT '{}'";
    this._cols.push(def);
    return this;
  }

  timestamps() {
    this._cols.push(`created_at TEXT NOT NULL DEFAULT (datetime('now'))`);
    this._cols.push(`updated_at TEXT NOT NULL DEFAULT (datetime('now'))`);
    return this;
  }

  softDelete() {
    this._cols.push(`deleted_at TEXT`);
    return this;
  }

  references(col, table, refCol) {
    this._constraints.push(`FOREIGN KEY(${col}) REFERENCES ${table}(${refCol || 'id'}) ON DELETE CASCADE`);
    return this;
  }

  unique(...cols) {
    this._constraints.push(`UNIQUE(${cols.join(',')})`);
    return this;
  }

  index(...cols) {
    // Stored for later execution
    this._indexes = this._indexes || [];
    this._indexes.push(cols);
    return this;
  }

  raw(sql) { this._cols.push(sql); return this; }

  _toSQL() {
    const all = [...this._cols, ...this._constraints];
    return `CREATE TABLE IF NOT EXISTS ${this._name} (\n  ${all.join(',\n  ')}\n)`;
  }
}

// ── Model ────────────────────────────────────────────────────────────────────

class Model {
  constructor(db, table, options) {
    this._db = db;
    this._table = table;
    this._pk = options.primaryKey || 'id';
    this._timestamps = options.timestamps === true;
    this._softDelete = options.softDelete || false;
    this._hidden = options.hidden || [];
    this._casts = options.casts || {};
  }

  _cast(row) {
    if (!row) return null;
    const result = Object.assign({}, row);
    for (const [key, type] of Object.entries(this._casts)) {
      if (result[key] !== undefined) {
        if (type === 'json') { try { result[key] = JSON.parse(result[key]); } catch {} }
        if (type === 'boolean') result[key] = result[key] === 1 || result[key] === '1' || result[key] === true;
        if (type === 'number') result[key] = Number(result[key]);
        if (type === 'date') result[key] = result[key] ? new Date(result[key]) : null;
      }
    }
    for (const h of this._hidden) delete result[h];
    return result;
  }

  _castForInsert(data) {
    const result = Object.assign({}, data);
    for (const [key, type] of Object.entries(this._casts)) {
      if (result[key] !== undefined) {
        if (type === 'json' && typeof result[key] === 'object') result[key] = JSON.stringify(result[key]);
        if (type === 'boolean') result[key] = result[key] ? 1 : 0;
      }
    }
    return result;
  }

  query() {
    let q = this._db.table(this._table);
    if (this._softDelete) q = q.whereNull('deleted_at');
    return q;
  }

  find(id) {
    const row = this.query().where(this._pk, '=', id).first();
    return this._cast(row);
  }

  findOrFail(id) {
    const row = this.find(id);
    if (!row) throw new Error(`[ntl:db] ${this._table} with ${this._pk}=${id} not found`);
    return row;
  }

  findBy(col, val) {
    const row = this.query().where(col, '=', val).first();
    return this._cast(row);
  }

  all() {
    return this.query().all().map(r => this._cast(r));
  }

  where(col, op, val) {
    return new ModelQueryBuilder(this, this.query().where(col, op, val));
  }

  create(data) {
    const now = new Date().toISOString();
    const row = this._castForInsert(data);
    if (this._timestamps) {
      row.created_at = row.created_at || now;
      row.updated_at = row.updated_at || now;
    }
    const id = this.query().insert(row);
    return this.find(id);
  }

  createMany(rows) {
    return rows.map(r => this.create(r));
  }

  update(id, data) {
    const row = this._castForInsert(data);
    if (this._timestamps) row.updated_at = new Date().toISOString();
    const changes = this._db.table(this._table).where(this._pk, '=', id).update(row);
    if (changes === 0) return null;
    return this.find(id);
  }

  updateOrCreate(where, data) {
    const existing = this.where(...Object.entries(where)[0]).first();
    if (existing) return this.update(existing[this._pk], data);
    return this.create(Object.assign({}, where, data));
  }

  delete(id) {
    if (this._softDelete) {
      return this.update(id, { deleted_at: new Date().toISOString() });
    }
    return this._db.table(this._table).where(this._pk, '=', id).delete() > 0;
  }

  restore(id) {
    if (!this._softDelete) return false;
    this._db.table(this._table).where(this._pk, '=', id).update({ deleted_at: null });
    return this.find(id);
  }

  count(col) { return this.query().count(col); }
  exists(col, val) { return this.query().where(col, '=', val).exists(); }

  paginate(page, perPage) {
    const result = this.query().paginate(page, perPage);
    result.data = result.data.map(r => this._cast(r));
    return result;
  }
}

class ModelQueryBuilder {
  constructor(model, qb) {
    this._model = model;
    this._qb = qb;
  }
  where(col, op, val) { this._qb.where(col, op, val); return this; }
  orderBy(col, dir)   { this._qb.orderBy(col, dir); return this; }
  limit(n)            { this._qb.limit(n); return this; }
  offset(n)           { this._qb.offset(n); return this; }
  all()    { return this._qb.all().map(r => this._model._cast(r)); }
  first()  { return this._model._cast(this._qb.first()); }
  count()  { return this._qb.count(); }
  delete() { return this._qb.delete(); }
  update(data) {
    const row = this._model._castForInsert(data);
    if (this._model._timestamps) row.updated_at = new Date().toISOString();
    return this._qb.update(row);
  }
}

// ── Schema Builder ───────────────────────────────────────────────────────────

class SchemaBuilder {
  constructor(db) { this._db = db; }

  create(name, fn) {
    const t = new TableDefinition(name);
    fn(t);
    this._db.exec(t._toSQL());
    if (t._indexes) {
      for (const cols of t._indexes) {
        this._db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_${cols.join('_')} ON ${name}(${cols.join(',')})`);
      }
    }
    return this;
  }

  drop(name)         { this._db.exec(`DROP TABLE IF EXISTS ${name}`); return this; }
  rename(from, to)   { this._db.exec(`ALTER TABLE ${from} RENAME TO ${to}`); return this; }

  addColumn(table, col, type, options) {
    options = options || {};
    let def = `${col} ${type.toUpperCase()}`;
    if (options.notNull) def += ' NOT NULL';
    if (options.default !== undefined) def += ` DEFAULT ${JSON.stringify(options.default)}`;
    this._db.exec(`ALTER TABLE ${table} ADD COLUMN ${def}`);
    return this;
  }

  createIndex(table, ...cols) {
    const name = `idx_${table}_${cols.join('_')}`;
    this._db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${cols.join(',')})`);
    return this;
  }

  dropIndex(name) {
    this._db.exec(`DROP INDEX IF EXISTS ${name}`);
    return this;
  }
}

// ── Connection Pool (for multiple DBs) ──────────────────────────────────────

const _connections = new Map();

function connect(file, options) {
  const key = file || ':memory:';
  if (_connections.has(key)) return _connections.get(key);
  const db = new Database(file, options);
  _connections.set(key, db);
  return db;
}

function disconnect(file) {
  const key = file || ':memory:';
  const db = _connections.get(key);
  if (db) { db.close(); _connections.delete(key); }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  Database, connect, disconnect,
  QueryBuilder, TableDefinition, Model, SchemaBuilder
};
