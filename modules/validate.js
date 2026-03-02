'use strict';
// ntl:validate — Production runtime validation & schema

class ValidationError extends Error {
  constructor(errors, message) {
    super(message || errors.map(e => e.path ? `${e.path}: ${e.message}` : e.message).join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
    this.isValidationError = true;
  }
}

class Schema {
  constructor(shape) {
    this._shape = shape || {};
    this._required = true;
    this._nullable = false;
    this._transform = null;
    this._tests = [];
    this._default = undefined;
    this._label = null;
    this._strip = false;
  }

  optional()     { this._required = false; return this; }
  nullable()     { this._nullable = true; return this; }
  default(val)   { this._default = val; this._required = false; return this; }
  label(s)       { this._label = s; return this; }
  strip()        { this._strip = true; return this; }
  transform(fn)  { this._transform = fn; return this; }

  test(name, message, fn) {
    this._tests.push({ name, message, fn });
    return this;
  }

  _runTests(value, path, errors) {
    for (const t of this._tests) {
      if (!t.fn(value)) {
        errors.push({ path, message: t.message });
      }
    }
  }

  parse(value, path) {
    path = path || '';
    const errors = [];
    // Handle default
    if (value === undefined || value === null) {
      if (this._default !== undefined) {
        value = typeof this._default === 'function' ? this._default() : this._default;
      } else if (!this._required) {
        return { value: this._nullable ? value : undefined, errors: [] };
      } else {
        return { value, errors: [{ path, message: (this._label || path || 'value') + ' is required' }] };
      }
    }
    if (value === null && this._nullable) return { value, errors: [] };
    const result = this._parse(value, path, errors);
    if (errors.length > 0) return { value: result, errors };
    const final = this._transform ? this._transform(result) : result;
    this._runTests(final, path, errors);
    return { value: final, errors };
  }

  _parse(value, path, errors) { return value; }

  validate(value) {
    const { value: result, errors } = this.parse(value, '');
    if (errors.length > 0) throw new ValidationError(errors);
    return result;
  }

  check(value) {
    const { errors } = this.parse(value, '');
    return errors.length === 0;
  }

  safeParse(value) {
    const { value: result, errors } = this.parse(value, '');
    if (errors.length > 0) return { success: false, errors, error: new ValidationError(errors) };
    return { success: true, data: result };
  }
}

class StringSchema extends Schema {
  constructor() {
    super();
    this._minLen = null; this._maxLen = null; this._pattern = null;
    this._email = false; this._url = false; this._trim = false;
    this._uppercase = false; this._lowercase = false;
    this._oneOf = null; this._notOneOf = null;
  }

  min(n, msg)     { this._minLen = n; this._minMsg = msg; return this; }
  max(n, msg)     { this._maxLen = n; this._maxMsg = msg; return this; }
  length(n, msg)  { this._minLen = n; this._maxLen = n; this._lenMsg = msg; return this; }
  pattern(re, msg){ this._pattern = re; this._patMsg = msg; return this; }
  email(msg)      { this._email = true; this._emailMsg = msg; return this; }
  url(msg)        { this._url = true; this._urlMsg = msg; return this; }
  trim()          { this._trim = true; return this; }
  uppercase()     { this._uppercase = true; return this; }
  lowercase()     { this._lowercase = true; return this; }
  oneOf(vals, msg){ this._oneOf = vals; this._oneOfMsg = msg; return this; }
  notOneOf(vals, msg){ this._notOneOf = vals; this._notOneOfMsg = msg; return this; }
  notEmpty(msg)   { return this.min(1, msg || 'must not be empty'); }
  minLength(n, msg) { return this.min(n, msg); }
  maxLength(n, msg) { return this.max(n, msg); }
  matches(re, msg)  { return this.pattern(re, msg); }
  alphanumeric(msg){ return this.pattern(/^[a-zA-Z0-9]+$/, msg || 'must be alphanumeric'); }
  numeric(msg)    { return this.pattern(/^[0-9]+$/, msg || 'must contain only digits'); }
  uuid(msg)       { return this.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, msg || 'must be a valid UUID'); }
  slug(msg)       { return this.pattern(/^[a-z0-9-]+$/, msg || 'must be a valid slug'); }

  _parse(value, path, errors) {
    if (typeof value !== 'string') {
      errors.push({ path, message: (this._label || path || 'value') + ' must be a string' });
      return value;
    }
    let v = value;
    if (this._trim) v = v.trim();
    if (this._uppercase) v = v.toUpperCase();
    if (this._lowercase) v = v.toLowerCase();
    const label = this._label || path || 'value';
    if (this._minLen !== null && v.length < this._minLen)
      errors.push({ path, message: this._minMsg || `${label} must be at least ${this._minLen} characters` });
    if (this._maxLen !== null && v.length > this._maxLen)
      errors.push({ path, message: this._maxMsg || `${label} must be at most ${this._maxLen} characters` });
    if (this._pattern && !this._pattern.test(v))
      errors.push({ path, message: this._patMsg || `${label} has invalid format` });
    if (this._email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      errors.push({ path, message: this._emailMsg || `${label} must be a valid email` });
    if (this._url) {
      try { new URL(v); } catch {
        errors.push({ path, message: this._urlMsg || `${label} must be a valid URL` });
      }
    }
    if (this._oneOf && !this._oneOf.includes(v))
      errors.push({ path, message: this._oneOfMsg || `${label} must be one of: ${this._oneOf.join(', ')}` });
    if (this._notOneOf && this._notOneOf.includes(v))
      errors.push({ path, message: this._notOneOfMsg || `${label} is not allowed` });
    return v;
  }
}

class NumberSchema extends Schema {
  constructor() {
    super();
    this._min = null; this._max = null;
    this._integer = false; this._positive = false; this._negative = false;
    this._multipleOf = null;
  }

  min(n, msg)       { this._min = n; this._minMsg = msg; return this; }
  max(n, msg)       { this._max = n; this._maxMsg = msg; return this; }
  integer(msg)      { this._integer = true; this._intMsg = msg; return this; }
  positive(msg)     { this._positive = true; this._posMsg = msg; return this; }
  negative(msg)     { this._negative = true; this._negMsg = msg; return this; }
  multipleOf(n, msg){ this._multipleOf = n; this._multipleOfMsg = msg; return this; }
  port()            { return this.integer().min(1).max(65535); }

  _parse(value, path, errors) {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || isNaN(n)) {
      errors.push({ path, message: (this._label || path || 'value') + ' must be a number' });
      return value;
    }
    const label = this._label || path || 'value';
    if (this._integer && !Number.isInteger(n))
      errors.push({ path, message: this._intMsg || `${label} must be an integer` });
    if (this._positive && n <= 0)
      errors.push({ path, message: this._posMsg || `${label} must be positive` });
    if (this._negative && n >= 0)
      errors.push({ path, message: this._negMsg || `${label} must be negative` });
    if (this._min !== null && n < this._min)
      errors.push({ path, message: this._minMsg || `${label} must be >= ${this._min}` });
    if (this._max !== null && n > this._max)
      errors.push({ path, message: this._maxMsg || `${label} must be <= ${this._max}` });
    if (this._multipleOf !== null && n % this._multipleOf !== 0)
      errors.push({ path, message: this._multipleOfMsg || `${label} must be a multiple of ${this._multipleOf}` });
    return n;
  }
}

class BooleanSchema extends Schema {
  _parse(value, path, errors) {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    errors.push({ path, message: (this._label || path || 'value') + ' must be a boolean' });
    return value;
  }
}

class ArraySchema extends Schema {
  constructor(itemSchema) {
    super();
    this._item = itemSchema;
    this._minLen = null; this._maxLen = null;
    this._unique = false;
  }

  item(schema)   { this._item = schema; return this; }
  min(n, msg)    { this._minLen = n; this._minMsg = msg; return this; }
  max(n, msg)    { this._maxLen = n; this._maxMsg = msg; return this; }
  nonempty(msg)  { return this.min(1, msg || 'array must not be empty'); }
  unique(msg)    { this._unique = true; this._uniqueMsg = msg; return this; }

  _parse(value, path, errors) {
    if (!Array.isArray(value)) {
      errors.push({ path, message: (this._label || path || 'value') + ' must be an array' });
      return value;
    }
    const label = this._label || path || 'value';
    if (this._minLen !== null && value.length < this._minLen)
      errors.push({ path, message: this._minMsg || `${label} must have at least ${this._minLen} items` });
    if (this._maxLen !== null && value.length > this._maxLen)
      errors.push({ path, message: this._maxMsg || `${label} must have at most ${this._maxLen} items` });
    if (this._unique) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) { errors.push({ path, message: this._uniqueMsg || `${label} must have unique items` }); break; }
        seen.add(key);
      }
    }
    if (!this._item) return value;
    const result = [];
    for (let i = 0; i < value.length; i++) {
      const { value: v, errors: errs } = this._item.parse(value[i], `${path}[${i}]`);
      errors.push(...errs);
      result.push(v);
    }
    return result;
  }
}

class ObjectSchema extends Schema {
  constructor(shape) {
    super();
    this._shape = shape || {};
    this._allowUnknown = false;
    this._stripUnknown = false;
  }

  shape(s)       { this._shape = s; return this; }
  unknown()      { this._allowUnknown = true; return this; }
  stripUnknown() { this._stripUnknown = true; return this; }
  extend(extra)  { return new ObjectSchema(Object.assign({}, this._shape, extra)); }
  pick(...keys)  { const s={}; for(const k of keys) if(this._shape[k]) s[k]=this._shape[k]; return new ObjectSchema(s); }
  omit(...keys)  { const s=Object.assign({},this._shape); for(const k of keys) delete s[k]; return new ObjectSchema(s); }
  partial()      { const s={}; for(const [k,v] of Object.entries(this._shape)) s[k]=v.optional(); return new ObjectSchema(s); }

  _parse(value, path, errors) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({ path, message: (this._label || path || 'value') + ' must be an object' });
      return value;
    }
    const result = {};
    const knownKeys = new Set(Object.keys(this._shape));
    // Validate known keys
    for (const [key, schema] of Object.entries(this._shape)) {
      const childPath = path ? `${path}.${key}` : key;
      const { value: v, errors: errs } = schema.parse(value[key], childPath);
      errors.push(...errs);
      if (v !== undefined) result[key] = v;
    }
    // Handle unknown keys
    for (const key of Object.keys(value)) {
      if (knownKeys.has(key)) continue;
      if (this._stripUnknown) continue;
      if (!this._allowUnknown) {
        errors.push({ path: path ? `${path}.${key}` : key, message: `unknown key "${key}"` });
      } else {
        result[key] = value[key];
      }
    }
    return result;
  }
}

class UnionSchema extends Schema {
  constructor(schemas) {
    super();
    this._schemas = schemas;
  }

  _parse(value, path, errors) {
    for (const schema of this._schemas) {
      const { value: v, errors: errs } = schema.parse(value, path);
      if (errs.length === 0) return v;
    }
    errors.push({ path, message: (this._label || path || 'value') + ' does not match any allowed type' });
    return value;
  }
}

class LiteralSchema extends Schema {
  constructor(literal) { super(); this._literal = literal; }
  _parse(value, path, errors) {
    if (value !== this._literal)
      errors.push({ path, message: `${this._label || path || 'value'} must be ${JSON.stringify(this._literal)}` });
    return value;
  }
}

class AnySchema extends Schema {
  _parse(value) { return value; }
}

class DateSchema extends Schema {
  constructor() { super(); this._min = null; this._max = null; }
  min(d, msg) { this._min = d instanceof Date ? d : new Date(d); this._minMsg = msg; return this; }
  max(d, msg) { this._max = d instanceof Date ? d : new Date(d); this._maxMsg = msg; return this; }
  _parse(value, path, errors) {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      errors.push({ path, message: (this._label || path || 'value') + ' must be a valid date' });
      return value;
    }
    if (this._min && d < this._min) errors.push({ path, message: this._minMsg || `${path||'date'} must be after ${this._min.toISOString()}` });
    if (this._max && d > this._max) errors.push({ path, message: this._maxMsg || `${path||'date'} must be before ${this._max.toISOString()}` });
    return d;
  }
}

// ── Builder API ──────────────────────────────────────────────────────────────

const v = {
  string:  ()      => new StringSchema(),
  number:  ()      => new NumberSchema(),
  boolean: ()      => new BooleanSchema(),
  array:   (item)  => new ArraySchema(item),
  object:  (shape) => new ObjectSchema(shape),
  union:   (...schemas) => new UnionSchema(schemas.flat()),
  literal: (val)   => new LiteralSchema(val),
  any:     ()      => new AnySchema(),
  date:    ()      => new DateSchema(),
  email:   (msg)   => new StringSchema().email(msg),
  url:     (msg)   => new StringSchema().url(msg),
  uuid:    (msg)   => new StringSchema().uuid(msg),
  int:     ()      => new NumberSchema().integer(),
  positive:()      => new NumberSchema().positive(),
  id:      ()      => new NumberSchema().integer().positive(),
};

module.exports = {
  v, ValidationError, Schema,
  StringSchema, NumberSchema, BooleanSchema, ArraySchema, ObjectSchema, UnionSchema, LiteralSchema,
  // Convenience factory functions (for destructured imports)
  string:  () => new StringSchema(),
  number:  () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  array:   (item)  => new ArraySchema(item),
  object:  (shape) => new ObjectSchema(shape),
  union:   (...schemas) => new UnionSchema(schemas.flat()),
  literal: (val)   => new LiteralSchema(val),
  any:     ()      => new AnySchema(),
  date:    ()      => new DateSchema(),
  email:   (msg)   => new StringSchema().email(msg),
  url:     (msg)   => new StringSchema().url(msg),
  uuid:    (msg)   => new StringSchema().uuid(msg),
  int:     ()      => new NumberSchema().integer(),
  positive:()      => new NumberSchema().positive(),
};
