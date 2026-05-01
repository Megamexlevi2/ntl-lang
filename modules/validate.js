'use strict';

// ntl:validate — schema-based validation, similar to Zod
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

class ValidationError extends Error {
  constructor(errors) {
    super(errors.map(e => e.path ? `${e.path}: ${e.message}` : e.message).join('; '));
    this.name   = 'ValidationError';
    this.errors = errors;
  }
}

class Schema {
  constructor(type) {
    this._type        = type;
    this._optional    = false;
    this._nullable    = false;
    this._default     = undefined;
    this._checks      = [];
    this._description = '';
  }

  optional()           { this._optional = true;  return this; }
  nullable()           { this._nullable = true;  return this; }
  required()           { this._optional = false; return this; }
  default(val)         { this._default = val;    return this; }
  describe(desc)       { this._description = desc; return this; }

  _check(fn, msg) { this._checks.push({ fn, msg }); return this; }

  _runChecks(value, path) {
    const errors = [];
    for (const check of this._checks) {
      const result = check.fn(value);
      if (result !== true) {
        errors.push({ path, message: typeof result === 'string' ? result : check.msg });
      }
    }
    return errors;
  }

  validate(value, path) {
    path = path || '';
    if (value === undefined || value === null) {
      if (value === undefined && this._default !== undefined) return { ok: true, value: this._default, errors: [] };
      if (this._optional || this._nullable) return { ok: true, value: value ?? null, errors: [] };
      return { ok: false, value: null, errors: [{ path, message: `Value is required` }] };
    }
    return this._validate(value, path);
  }

  _validate(value, path) { return { ok: true, value, errors: [] }; }

  parse(value) {
    const r = this.validate(value);
    if (!r.ok) throw new ValidationError(r.errors);
    return r.value;
  }

  safeParse(value) { return this.validate(value); }
}

// ─── String ───────────────────────────────────────────────────────────────────

class StringSchema extends Schema {
  constructor() { super('string'); }

  min(n, msg)    { return this._check(v => v.length >= n || (msg || `Must be at least ${n} characters`)); }
  max(n, msg)    { return this._check(v => v.length <= n || (msg || `Must be at most ${n} characters`)); }
  length(n, msg) { return this._check(v => v.length === n || (msg || `Must be exactly ${n} characters`)); }
  trim()         { return this._check(v => { return true; }); }  // applied in _validate
  lowercase()    { return this._check(v => v === v.toLowerCase() || 'Must be lowercase'); }
  uppercase()    { return this._check(v => v === v.toUpperCase() || 'Must be uppercase'); }
  regex(re, msg) { return this._check(v => re.test(v) || (msg || `Must match pattern ${re}`)); }
  nonempty(msg)  { return this._check(v => v.length > 0 || (msg || 'Must not be empty')); }

  oneOf(values, msg) {
    return this._check(v => values.includes(v) || (msg || `Must be one of: ${values.join(', ')}`));
  }

  email(msg) {
    return this._check(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || (msg || 'Must be a valid email address'));
  }

  url(msg) {
    return this._check(v => {
      try { new URL(v); return true; } catch(_) { return msg || 'Must be a valid URL'; }
    });
  }

  uuid(msg) {
    return this._check(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || (msg || 'Must be a valid UUID'));
  }

  startsWith(prefix, msg) { return this._check(v => v.startsWith(prefix) || (msg || `Must start with "${prefix}"`)); }
  endsWith(suffix, msg)   { return this._check(v => v.endsWith(suffix)   || (msg || `Must end with "${suffix}"`)); }
  includes(sub, msg)      { return this._check(v => v.includes(sub)      || (msg || `Must include "${sub}"`)); }

  transform(fn) {
    const orig = this._validate.bind(this);
    this._validate = (value, path) => {
      const r = orig(value, path);
      if (r.ok) r.value = fn(r.value);
      return r;
    };
    return this;
  }

  _validate(value, path) {
    if (typeof value !== 'string') {
      if (typeof value === 'number' || typeof value === 'boolean') value = String(value);
      else return { ok: false, value: null, errors: [{ path, message: `Must be a string, got ${typeof value}` }] };
    }
    const errors = this._runChecks(value, path);
    if (errors.length) return { ok: false, value: null, errors };
    return { ok: true, value, errors: [] };
  }
}

// ─── Number ───────────────────────────────────────────────────────────────────

class NumberSchema extends Schema {
  constructor() { super('number'); }

  min(n, msg)      { return this._check(v => v >= n || (msg || `Must be >= ${n}`)); }
  max(n, msg)      { return this._check(v => v <= n || (msg || `Must be <= ${n}`)); }
  gt(n, msg)       { return this._check(v => v >  n || (msg || `Must be > ${n}`)); }
  lt(n, msg)       { return this._check(v => v <  n || (msg || `Must be < ${n}`)); }
  positive(msg)    { return this._check(v => v > 0  || (msg || 'Must be positive')); }
  negative(msg)    { return this._check(v => v < 0  || (msg || 'Must be negative')); }
  nonnegative(msg) { return this._check(v => v >= 0 || (msg || 'Must be non-negative')); }
  int(msg)         { return this._check(v => Number.isInteger(v) || (msg || 'Must be an integer')); }
  finite(msg)      { return this._check(v => isFinite(v)         || (msg || 'Must be finite')); }
  multipleOf(n, msg) { return this._check(v => v % n === 0       || (msg || `Must be a multiple of ${n}`)); }
  between(min, max, msg) { return this._check(v => v >= min && v <= max || (msg || `Must be between ${min} and ${max}`)); }

  _validate(value, path) {
    if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') value = Number(value);
    if (typeof value !== 'number' || isNaN(value)) {
      return { ok: false, value: null, errors: [{ path, message: `Must be a number, got ${typeof value}` }] };
    }
    const errors = this._runChecks(value, path);
    if (errors.length) return { ok: false, value: null, errors };
    return { ok: true, value, errors: [] };
  }
}

// ─── Boolean ─────────────────────────────────────────────────────────────────

class BooleanSchema extends Schema {
  constructor() { super('boolean'); }

  _validate(value, path) {
    if (value === 'true' || value === 1)  value = true;
    if (value === 'false' || value === 0) value = false;
    if (typeof value !== 'boolean') {
      return { ok: false, value: null, errors: [{ path, message: `Must be a boolean, got ${typeof value}` }] };
    }
    return { ok: true, value, errors: [] };
  }
}

// ─── Date ─────────────────────────────────────────────────────────────────────

class DateSchema extends Schema {
  constructor() { super('date'); }

  min(d, msg) { return this._check(v => v >= new Date(d) || (msg || `Must be after ${d}`)); }
  max(d, msg) { return this._check(v => v <= new Date(d) || (msg || `Must be before ${d}`)); }
  past(msg)   { return this._check(v => v < new Date()   || (msg || 'Must be in the past')); }
  future(msg) { return this._check(v => v > new Date()   || (msg || 'Must be in the future')); }

  _validate(value, path) {
    if (!(value instanceof Date)) {
      const d = new Date(value);
      if (isNaN(d.getTime())) return { ok: false, value: null, errors: [{ path, message: 'Must be a valid date' }] };
      value = d;
    }
    const errors = this._runChecks(value, path);
    if (errors.length) return { ok: false, value: null, errors };
    return { ok: true, value, errors: [] };
  }
}

// ─── Array ────────────────────────────────────────────────────────────────────

class ArraySchema extends Schema {
  constructor(itemSchema) { super('array'); this._item = itemSchema; }

  min(n, msg)    { return this._check(v => v.length >= n || (msg || `Must have at least ${n} items`)); }
  max(n, msg)    { return this._check(v => v.length <= n || (msg || `Must have at most ${n} items`)); }
  length(n, msg) { return this._check(v => v.length === n || (msg || `Must have exactly ${n} items`)); }
  nonempty(msg)  { return this._check(v => v.length > 0  || (msg || 'Must not be empty')); }
  unique(msg)    { return this._check(v => new Set(v).size === v.length || (msg || 'Items must be unique')); }

  _validate(value, path) {
    if (!Array.isArray(value)) {
      return { ok: false, value: null, errors: [{ path, message: `Must be an array, got ${typeof value}` }] };
    }
    const errors  = this._runChecks(value, path);
    if (errors.length) return { ok: false, value: null, errors };
    const result  = [];
    const allErrs = [...errors];
    for (let i = 0; i < value.length; i++) {
      if (this._item) {
        const r = this._item.validate(value[i], path ? `${path}[${i}]` : `[${i}]`);
        if (!r.ok) allErrs.push(...r.errors);
        else result.push(r.value);
      } else {
        result.push(value[i]);
      }
    }
    if (allErrs.length) return { ok: false, value: null, errors: allErrs };
    return { ok: true, value: result, errors: [] };
  }
}

// ─── Object ───────────────────────────────────────────────────────────────────

class ObjectSchema extends Schema {
  constructor(shape) {
    super('object');
    this._shape  = shape  || {};
    this._strict = false;
    this._strip  = false;
  }

  strict(v)    { this._strict = v !== false; return this; }
  strip()      { this._strip  = true;         return this; }
  passthrough(){ this._strict = false; this._strip = false; return this; }

  extend(extra) {
    return new ObjectSchema(Object.assign({}, this._shape, extra));
  }

  pick(...keys) {
    const shape = {};
    keys.forEach(k => { if (this._shape[k]) shape[k] = this._shape[k]; });
    return new ObjectSchema(shape);
  }

  omit(...keys) {
    const shape = Object.assign({}, this._shape);
    keys.forEach(k => delete shape[k]);
    return new ObjectSchema(shape);
  }

  partial() {
    const shape = {};
    for (const [k, v] of Object.entries(this._shape)) {
      shape[k] = Object.assign(Object.create(Object.getPrototypeOf(v)), v, { _optional: true });
    }
    return new ObjectSchema(shape);
  }

  _validate(value, path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, value: null, errors: [{ path, message: `Must be an object, got ${Array.isArray(value) ? 'array' : typeof value}` }] };
    }
    const errors = [];
    const result = {};

    for (const [key, schema] of Object.entries(this._shape)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const r = schema.validate(value[key], fieldPath);
      if (!r.ok) errors.push(...r.errors);
      else if (r.value !== undefined) result[key] = r.value;
    }

    if (this._strict || this._strip) {
      const known = new Set(Object.keys(this._shape));
      for (const key of Object.keys(value)) {
        if (!known.has(key)) {
          if (this._strict) errors.push({ path: path ? `${path}.${key}` : key, message: `Unknown field: ${key}` });
        } else if (!this._strip) {
          result[key] = result[key] ?? value[key];
        }
      }
    } else {
      Object.assign(result, value);
      for (const [k, v] of Object.entries(result)) {
        if (this._shape[k] !== undefined) result[k] = result[k];
      }
    }

    if (errors.length) return { ok: false, value: null, errors };
    return { ok: true, value: result, errors: [] };
  }
}

// ─── Union / Discriminated Union ─────────────────────────────────────────────

class UnionSchema extends Schema {
  constructor(schemas) { super('union'); this._schemas = schemas; }

  _validate(value, path) {
    const allErrors = [];
    for (const s of this._schemas) {
      const r = s.validate(value, path);
      if (r.ok) return r;
      allErrors.push(...r.errors);
    }
    return { ok: false, value: null, errors: [{ path, message: `Does not match any of the expected types` }] };
  }
}

// ─── Literal ─────────────────────────────────────────────────────────────────

class LiteralSchema extends Schema {
  constructor(literal) { super('literal'); this._literal = literal; }

  _validate(value, path) {
    if (value !== this._literal) {
      return { ok: false, value: null, errors: [{ path, message: `Must be ${JSON.stringify(this._literal)}` }] };
    }
    return { ok: true, value, errors: [] };
  }
}

// ─── Enum ─────────────────────────────────────────────────────────────────────

class EnumSchema extends Schema {
  constructor(values) { super('enum'); this._values = values; }

  _validate(value, path) {
    if (!this._values.includes(value)) {
      return { ok: false, value: null, errors: [{ path, message: `Must be one of: ${this._values.map(v => JSON.stringify(v)).join(', ')}` }] };
    }
    return { ok: true, value, errors: [] };
  }
}

// ─── Any / Unknown ────────────────────────────────────────────────────────────

class AnySchema extends Schema {
  constructor() { super('any'); }
  _validate(value, path) { return { ok: true, value, errors: [] }; }
}

// ─── Intersection ─────────────────────────────────────────────────────────────

class IntersectionSchema extends Schema {
  constructor(schemas) { super('intersection'); this._schemas = schemas; }

  _validate(value, path) {
    let current = value;
    for (const s of this._schemas) {
      const r = s.validate(current, path);
      if (!r.ok) return r;
      current = r.value;
    }
    return { ok: true, value: current, errors: [] };
  }
}

// ─── Record ───────────────────────────────────────────────────────────────────

class RecordSchema extends Schema {
  constructor(keySchema, valueSchema) { super('record'); this._key = keySchema; this._value = valueSchema; }

  _validate(value, path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, value: null, errors: [{ path, message: 'Must be an object' }] };
    }
    const result = {}, errors = [];
    for (const [k, v] of Object.entries(value)) {
      const fp = path ? `${path}.${k}` : k;
      if (this._key) {
        const kr = this._key.validate(k, fp + ' (key)');
        if (!kr.ok) { errors.push(...kr.errors); continue; }
      }
      if (this._value) {
        const vr = this._value.validate(v, fp);
        if (!vr.ok) { errors.push(...vr.errors); continue; }
        result[k] = vr.value;
      } else {
        result[k] = v;
      }
    }
    if (errors.length) return { ok: false, value: null, errors };
    return { ok: true, value: result, errors: [] };
  }
}

// ─── Builder API ──────────────────────────────────────────────────────────────

const schema = {
  string:       ()        => new StringSchema(),
  number:       ()        => new NumberSchema(),
  boolean:      ()        => new BooleanSchema(),
  date:         ()        => new DateSchema(),
  array:        (item)    => new ArraySchema(item),
  object:       (shape)   => new ObjectSchema(shape),
  union:        (...s)    => new UnionSchema(s.flat()),
  intersection: (...s)    => new IntersectionSchema(s.flat()),
  literal:      (val)     => new LiteralSchema(val),
  enum:         (vals)    => new EnumSchema(vals),
  record:       (k, v)    => new RecordSchema(k, v),
  any:          ()        => new AnySchema(),
  unknown:      ()        => new AnySchema(),
  never:        ()        => ({ validate: () => ({ ok: false, value: null, errors: [{ path: '', message: 'Never matches' }] }) }),
  optional:     (s)       => { s._optional = true; return s; },
  nullable:     (s)       => { s._nullable = true; return s; },
  coerce: {
    string:  () => new StringSchema().transform(v => String(v)),
    number:  () => new NumberSchema(),
    boolean: () => new BooleanSchema(),
    date:    () => new DateSchema(),
  },
};

function validate(schm, value) { return schm.validate(value); }
function parse_(schm, value)   { return schm.parse(value); }

module.exports = {
  schema, validate, parse: parse_,
  ValidationError,
  StringSchema, NumberSchema, BooleanSchema, DateSchema,
  ArraySchema, ObjectSchema, UnionSchema, LiteralSchema,
  EnumSchema, AnySchema, RecordSchema, IntersectionSchema,
};
