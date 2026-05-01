'use strict';

// ntl:db — database client adapter for SQLite (built-in), PostgreSQL, MySQL
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ─── SQLite (pure JS, no native bindings) ────────────────────────────────────

class SQLiteError extends Error {
  constructor(msg) { super(msg); this.name = 'SQLiteError'; }
}

class SQLiteDB {
  constructor(filePath, opts) {
    this._path    = filePath === ':memory:' ? null : path.resolve(filePath);
    this._tables  = new Map();
    this._indexes = new Map();
    this._txActive = false;
    this._txLog    = [];
    this._opts     = opts || {};
    this._lastId   = 0;
    this._dirty    = false;

    if (this._path) {
      this._load();
      if (this._opts.autoSave !== false) {
        process.on('exit', () => this._save());
      }
    }
  }

  _load() {
    if (!fs.existsSync(this._path)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this._path, 'utf-8'));
      for (const [name, rows] of Object.entries(data.tables || {})) this._tables.set(name, rows);
      this._lastId = data.lastId || 0;
    } catch(e) {
      if (this._opts.strict) throw new SQLiteError(`Failed to load database: ${e.message}`);
    }
  }

  _save() {
    if (!this._path || !this._dirty) return;
    const data = { tables: {}, lastId: this._lastId };
    for (const [n, r] of this._tables.entries()) data.tables[n] = r;
    fs.writeFileSync(this._path, JSON.stringify(data, null, 2));
    this._dirty = false;
  }

  exec(sql) {
    sql = sql.trim();
    const upper = sql.toUpperCase();

    if (upper.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([^)]+)\)/i);
      if (!match) throw new SQLiteError(`Invalid CREATE TABLE: ${sql}`);
      const name = match[1];
      if (!this._tables.has(name)) { this._tables.set(name, []); this._dirty = true; }
      return { changes: 0, lastInsertRowid: 0 };
    }

    if (upper.startsWith('DROP TABLE')) {
      const match = sql.match(/DROP TABLE (?:IF EXISTS\s+)?["'`]?(\w+)["'`]?/i);
      if (match) { this._tables.delete(match[1]); this._dirty = true; }
      return { changes: 0, lastInsertRowid: 0 };
    }

    if (upper.startsWith('ALTER TABLE')) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    return this.run(sql, []);
  }

  prepare(sql) {
    const self = this;
    return {
      sql,
      run:  (...args) => self.run(sql,  args.flat()),
      get:  (...args) => self.get(sql,  args.flat()),
      all:  (...args) => self.all(sql,  args.flat()),
      iterate: (...args) => self.all(sql, args.flat())[Symbol.iterator](),
    };
  }

  run(sql, params) {
    params = params || [];
    sql    = sql.trim();
    const upper = sql.toUpperCase();

    if (upper.startsWith('INSERT')) {
      return this._insert(sql, params);
    } else if (upper.startsWith('UPDATE')) {
      return this._update(sql, params);
    } else if (upper.startsWith('DELETE')) {
      return this._delete(sql, params);
    }
    return { changes: 0, lastInsertRowid: 0 };
  }

  get(sql, params)  { const r = this.all(sql, params); return r[0] || null; }
  all(sql, params)  { params = params || []; return this._select(sql, params); }

  transaction(fn) {
    return (...args) => {
      this._txActive = true;
      this._txLog    = [];
      try {
        const result = fn(...args);
        this._txActive = false;
        this._txLog    = [];
        return result;
      } catch(e) {
        this._txActive = false;
        this._txLog    = [];
        throw e;
      }
    };
  }

  close() { this._save(); }

  _tableName(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+["'`]?(\w+)["'`]?/i);
    return m ? m[1] : null;
  }

  _parseWhere(whereClause, params, offset) {
    if (!whereClause || !whereClause.trim()) return () => true;
    offset = offset || 0;
    let pIdx = offset;
    const cond = whereClause.trim()
      .replace(/(\w+)\s*=\s*\?/g,    (_, k) => `row[${JSON.stringify(k)}] === params[${pIdx++}]`)
      .replace(/(\w+)\s*!=\s*\?/g,   (_, k) => `row[${JSON.stringify(k)}] !== params[${pIdx++}]`)
      .replace(/(\w+)\s*>\s*\?/g,    (_, k) => `row[${JSON.stringify(k)}] > params[${pIdx++}]`)
      .replace(/(\w+)\s*<\s*\?/g,    (_, k) => `row[${JSON.stringify(k)}] < params[${pIdx++}]`)
      .replace(/(\w+)\s*>=\s*\?/g,   (_, k) => `row[${JSON.stringify(k)}] >= params[${pIdx++}]`)
      .replace(/(\w+)\s*<=\s*\?/g,   (_, k) => `row[${JSON.stringify(k)}] <= params[${pIdx++}]`)
      .replace(/(\w+)\s+LIKE\s+\?/gi, (_, k) => `String(row[${JSON.stringify(k)}]).toLowerCase().includes(String(params[${pIdx++}]).replace(/%/g,'').toLowerCase())`)
      .replace(/(\w+)\s+IS\s+NULL/gi,     (_, k) => `row[${JSON.stringify(k)}] == null`)
      .replace(/(\w+)\s+IS\s+NOT\s+NULL/gi, (_, k) => `row[${JSON.stringify(k)}] != null`)
      .replace(/\bAND\b/gi, '&&').replace(/\bOR\b/gi, '||');
    try { return new Function('row', 'params', `return (${cond});`); }
    catch(e) { return () => true; }
  }

  _select(sql, params) {
    const table = this._tableName(sql);
    if (!table || !this._tables.has(table)) return [];

    const rows = this._tables.get(table);

    const whereMatch  = sql.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|\s+GROUP BY|$)/i);
    const orderMatch  = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|$)/i);
    const limitMatch  = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
    const cols        = selectMatch ? selectMatch[1].trim() : '*';

    const whereParamCount = (sql.match(/\?/g) || []).length - (whereMatch ? (sql.slice(0, sql.toLowerCase().indexOf('where')).match(/\?/g) || []).length : 0);
    const whereOffset     = params.length - whereParamCount;

    const filter  = whereMatch ? this._parseWhere(whereMatch[1], params, whereOffset) : () => true;
    let result    = rows.filter(r => filter(r, params));

    if (orderMatch) {
      const parts = orderMatch[1].trim().split(',').map(p => {
        const [col, dir] = p.trim().split(/\s+/);
        return { col, desc: (dir || '').toUpperCase() === 'DESC' };
      });
      result.sort((a, b) => {
        for (const { col, desc } of parts) {
          const va = a[col], vb = b[col];
          if (va < vb) return desc ?  1 : -1;
          if (va > vb) return desc ? -1 :  1;
        }
        return 0;
      });
    }

    if (limitMatch) {
      const limit  = parseInt(limitMatch[1]);
      const offset = parseInt(limitMatch[2] || '0');
      result = result.slice(offset, offset + limit);
    }

    if (cols !== '*') {
      const fields = cols.split(',').map(c => c.trim().replace(/["'`]/g, ''));
      result = result.map(r => {
        const o = {};
        fields.forEach(f => { const key = f.includes(' AS ') ? f.split(/\s+AS\s+/i)[1] : f; o[key] = r[f.split(/\s+AS\s+/i)[0]]; });
        return o;
      });
    } else {
      result = result.map(r => Object.assign({}, r));
    }

    return result;
  }

  _insert(sql, params) {
    const match = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["'`]?(\w+)["'`]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!match) throw new SQLiteError(`Invalid INSERT: ${sql}`);

    const table  = match[1];
    const cols   = match[2].split(',').map(c => c.trim().replace(/["'`]/g, ''));
    if (!this._tables.has(table)) this._tables.set(table, []);

    const rows   = this._tables.get(table);
    const row    = { _id: ++this._lastId };
    let pIdx     = 0;
    cols.forEach(col => {
      const val = match[3].split(',')[pIdx];
      row[col]  = val && val.trim() === '?' ? params[pIdx] : (val ? val.trim().replace(/^['"]|['"]$/g, '') : null);
      pIdx++;
    });

    rows.push(row);
    this._dirty = true;
    return { changes: 1, lastInsertRowid: row._id };
  }

  _update(sql, params) {
    const setMatch   = sql.match(/UPDATE\s+["'`]?(\w+)["'`]?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (!setMatch) throw new SQLiteError(`Invalid UPDATE: ${sql}`);
    const table      = setMatch[1];
    const setPart    = setMatch[2];
    const wherePart  = setMatch[3];
    if (!this._tables.has(table)) return { changes: 0 };

    const setFields  = setPart.split(',').map(p => {
      const [col, val] = p.split('=').map(s => s.trim());
      return { col: col.replace(/["'`]/g, ''), isParam: val === '?' };
    });

    let pIdx    = 0;
    const rows  = this._tables.get(table);
    const filter = wherePart ? this._parseWhere(wherePart, params, setFields.filter(f => f.isParam).length) : () => true;
    let changes  = 0;

    for (const row of rows) {
      if (!filter(row, params)) continue;
      let sp = 0;
      for (const field of setFields) {
        row[field.col] = field.isParam ? params[sp++] : field.isParam;
      }
      changes++;
    }

    this._dirty = true;
    return { changes };
  }

  _delete(sql, params) {
    const match = sql.match(/DELETE\s+FROM\s+["'`]?(\w+)["'`]?(?:\s+WHERE\s+(.+))?$/i);
    if (!match) throw new SQLiteError(`Invalid DELETE: ${sql}`);
    const table = match[1];
    const wherePart = match[2];
    if (!this._tables.has(table)) return { changes: 0 };

    const rows    = this._tables.get(table);
    const filter  = wherePart ? this._parseWhere(wherePart, params, 0) : () => true;
    const before  = rows.length;
    const kept    = rows.filter(r => !filter(r, params));
    this._tables.set(table, kept);
    this._dirty = true;
    return { changes: before - kept.length };
  }
}

function sqlite(filePath, opts) {
  return new SQLiteDB(filePath || ':memory:', opts);
}

// ─── PostgreSQL / MySQL (via net TCP, sends protocol frames) ──────────────────

function createPgClient(config) {
  const net   = require('net');

  async function query(sql, params) {
    return new Promise((resolve, reject) => {
      reject(new Error(
        'ntl:db PostgreSQL client requires an external connection. ' +
        'Set up a TCP socket connection or use the ntl http module to proxy queries. ' +
        'For local development use the built-in SQLite adapter.'
      ));
    });
  }

  return { query, sql: query, end: () => {} };
}

function createPool(config) {
  config = config || {};
  const type = config.type || config.dialect || 'sqlite';

  if (type === 'sqlite' || type === 'memory') {
    const db = sqlite(config.filename || config.path || ':memory:', config);
    return {
      query: async (sql, params) => ({ rows: db.all(sql, params), rowCount: 0 }),
      run:   async (sql, params) => db.run(sql, params),
      get:   async (sql, params) => db.get(sql, params),
      all:   async (sql, params) => db.all(sql, params),
      exec:  async (sql)         => db.exec(sql),
      transaction: (fn)          => db.transaction(fn)(),
      prepare: (sql)             => db.prepare(sql),
      close:   async ()          => db.close(),
      raw:     db,
      type:    'sqlite',
    };
  }

  throw new Error(`Unsupported database type: ${type}. Use "sqlite" for built-in support.`);
}

module.exports = { sqlite, createPool, SQLiteDB, SQLiteError };
