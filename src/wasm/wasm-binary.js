// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// (c) David Dev 2026. All rights reserved.
'use strict';

const WASM_MAGIC   = [0x00, 0x61, 0x73, 0x6d];
const WASM_VERSION = [0x01, 0x00, 0x00, 0x00];

const TYPE = { i32: 0x7f, i64: 0x7e, f32: 0x7d, f64: 0x7c, funcref: 0x70 };
const SECTION = { Type:1, Import:2, Function:3, Table:4, Memory:5, Global:6, Export:7, Start:8, Element:9, Code:10, Data:11 };

function encodeULEB128(n) {
  const bytes = [];
  do { let b = n & 0x7f; n >>>= 7; if (n > 0) b |= 0x80; bytes.push(b); } while (n > 0);
  return bytes;
}

function encodeSLEB128(n) {
  const bytes = [];
  let more = true;
  while (more) {
    let b = n & 0x7f; n >>= 7;
    if ((n === 0 && (b & 0x40) === 0) || (n === -1 && (b & 0x40) !== 0)) more = false;
    else b |= 0x80;
    bytes.push(b);
  }
  return bytes;
}

function encodeString(s) {
  const bytes = [...Buffer.from(s, 'utf8')];
  return [...encodeULEB128(bytes.length), ...bytes];
}

function encodeF64(v) {
  const buf = Buffer.alloc(8); buf.writeDoubleBE(v, 0); return [...buf];
}
function encodeF64LE(v) {
  const buf = Buffer.alloc(8); buf.writeDoubleLE(v, 0); return [...buf];
}
function encodeI32LE(v) {
  const buf = Buffer.alloc(4); buf.writeInt32LE(v, 0); return [...buf];
}

function buildSection(id, data) {
  return [id, ...encodeULEB128(data.length), ...data];
}

function buildVector(items) {
  return [...encodeULEB128(items.length), ...items.flat()];
}

const OP = {
  unreachable: 0x00, nop: 0x01, block: 0x02, loop: 0x03, if: 0x04, else: 0x05, end: 0x0b,
  br: 0x0c, br_if: 0x0d, br_table: 0x0e, return: 0x0f,
  call: 0x10, call_indirect: 0x11,
  drop: 0x1a, select: 0x1b,
  local_get: 0x20, local_set: 0x21, local_tee: 0x22,
  global_get: 0x23, global_set: 0x24,
  i32_load: 0x28, i64_load: 0x29, f32_load: 0x2a, f64_load: 0x2b,
  i32_store: 0x36, i64_store: 0x37, f32_store: 0x38, f64_store: 0x39,
  memory_size: 0x3f, memory_grow: 0x40,
  i32_const: 0x41, i64_const: 0x42, f32_const: 0x43, f64_const: 0x44,
  i32_eqz: 0x45, i32_eq: 0x46, i32_ne: 0x47, i32_lt_s: 0x48, i32_gt_s: 0x4a, i32_le_s: 0x4c, i32_ge_s: 0x4e,
  f64_eq: 0x61, f64_ne: 0x62, f64_lt: 0x63, f64_gt: 0x64, f64_le: 0x65, f64_ge: 0x66,
  i32_add: 0x6a, i32_sub: 0x6b, i32_mul: 0x6c, i32_div_s: 0x6d, i32_rem_s: 0x6f,
  i32_and: 0x71, i32_or: 0x72, i32_xor: 0x73, i32_shl: 0x74, i32_shr_s: 0x75,
  f64_add: 0xa0, f64_sub: 0xa1, f64_mul: 0xa2, f64_div: 0xa3,
  f64_abs: 0x99, f64_neg: 0x9a, f64_sqrt: 0x9f,
  f64_floor: 0x9c, f64_ceil: 0x9b, f64_trunc: 0x9d, f64_nearest: 0x9e,
  f64_min: 0xa4, f64_max: 0xa5,
  i32_trunc_f64_s: 0xaa, f64_convert_i32_s: 0xb7, f64_convert_i32_u: 0xb8,
  i32_wrap_i64: 0xa7, i64_extend_i32_s: 0xac,
};

class WasmModule {
  constructor() {
    this.types    = [];
    this.imports  = [];
    this.funcs    = [];
    this.tables   = [];
    this.mems     = [];
    this.globals  = [];
    this.exports  = [];
    this.codes    = [];
    this.dataSegs = [];
    this._typeMap = new Map();
    this._nextDataOffset = 0;
    this._memPages = 1;
  }

  addType(params, results) {
    const key = JSON.stringify({ params, results });
    if (this._typeMap.has(key)) return this._typeMap.get(key);
    const idx = this.types.length;
    this.types.push({ params, results });
    this._typeMap.set(key, idx);
    return idx;
  }

  addImport(mod, name, kind, typeIdx) {
    const idx = this.imports.length;
    this.imports.push({ mod, name, kind, typeIdx });
    return idx;
  }

  addFunction(params, results, locals, body) {
    const typeIdx = this.addType(params, results);
    const funcIdx = this.imports.length + this.funcs.length;
    this.funcs.push(typeIdx);
    this.codes.push({ locals, body });
    return funcIdx;
  }

  addMemory(min, max) {
    this.mems.push({ min, max });
    this._memPages = min;
  }

  addGlobal(type, mutable, initExpr) {
    const idx = this.globals.length;
    this.globals.push({ type, mutable, initExpr });
    return idx;
  }

  addExport(name, kind, idx) {
    this.exports.push({ name, kind, idx });
  }

  addData(data, offset) {
    if (offset === undefined) { offset = this._nextDataOffset; this._nextDataOffset += data.length; }
    this.dataSegs.push({ offset, data });
    return offset;
  }

  build() {
    const bytes = [...WASM_MAGIC, ...WASM_VERSION];

    if (this.types.length > 0) {
      const data = buildVector(this.types.map(t => [
        0x60, ...buildVector(t.params.map(p => [TYPE[p] || p])), ...buildVector(t.results.map(r => [TYPE[r] || r]))
      ]));
      bytes.push(...buildSection(SECTION.Type, data));
    }

    if (this.imports.length > 0) {
      const data = buildVector(this.imports.map(i => [
        ...encodeString(i.mod), ...encodeString(i.name), i.kind, ...encodeULEB128(i.typeIdx)
      ]));
      bytes.push(...buildSection(SECTION.Import, data));
    }

    if (this.funcs.length > 0) {
      const data = buildVector(this.funcs.map(ti => encodeULEB128(ti)));
      bytes.push(...buildSection(SECTION.Function, data));
    }

    if (this.mems.length > 0) {
      const data = buildVector(this.mems.map(m => m.max !== undefined
        ? [0x01, ...encodeULEB128(m.min), ...encodeULEB128(m.max)]
        : [0x00, ...encodeULEB128(m.min)]
      ));
      bytes.push(...buildSection(SECTION.Memory, data));
    }

    if (this.globals.length > 0) {
      const data = buildVector(this.globals.map(g => [
        TYPE[g.type] || g.type, g.mutable ? 1 : 0, ...g.initExpr, OP.end
      ]));
      bytes.push(...buildSection(SECTION.Global, data));
    }

    if (this.exports.length > 0) {
      const data = buildVector(this.exports.map(e => [
        ...encodeString(e.name), e.kind, ...encodeULEB128(e.idx)
      ]));
      bytes.push(...buildSection(SECTION.Export, data));
    }

    if (this.codes.length > 0) {
      const codeItems = this.codes.map(c => {
        const localGroups = [];
        const locTypes = {};
        for (const l of (c.locals || [])) {
          const t = TYPE[l] || l;
          locTypes[t] = (locTypes[t] || 0) + 1;
        }
        for (const [t, count] of Object.entries(locTypes)) {
          localGroups.push([...encodeULEB128(count), Number(t)]);
        }
        const locBytes = buildVector(localGroups);
        const bodyBytes = [...c.body, OP.end];
        const funcBytes = [...locBytes, ...bodyBytes];
        return [...encodeULEB128(funcBytes.length), ...funcBytes];
      });
      const data = buildVector(codeItems);
      bytes.push(...buildSection(SECTION.Code, data));
    }

    if (this.dataSegs.length > 0) {
      const dataItems = this.dataSegs.map(d => [
        0x00,
        OP.i32_const, ...encodeSLEB128(d.offset), OP.end,
        ...encodeULEB128(d.data.length), ...d.data
      ]);
      const data = buildVector(dataItems);
      bytes.push(...buildSection(SECTION.Data, data));
    }

    return Buffer.from(bytes);
  }
}

function compileNTLToWasm(ast, opts) {
  opts = opts || {};
  const m = new WasmModule();
  m.addMemory(16);

  const importFd = m.addImport('env', 'fd_write', 0,
    m.addType(['i32','i32','i32','i32'], ['i32']));
  const importExit = m.addImport('env', 'proc_exit', 0,
    m.addType(['i32'], []));
  const importClock = m.addImport('env', 'clock_time_get', 0,
    m.addType(['i32','i64','i32'], ['i32']));

  const printStrTypeIdx = m.addType(['i32','i32'], []);
  const printStrIdx = m.imports.length + m.funcs.length;
  m.funcs.push(printStrTypeIdx);
  m.codes.push({
    locals: [],
    body: [
      OP.i32_const, ...encodeSLEB128(8),
      OP.i32_const, ...encodeSLEB128(0),
      OP.i32_store, 0x02, ...encodeULEB128(0),
      OP.i32_const, ...encodeSLEB128(12),
      OP.local_get, 0x01,
      OP.i32_store, 0x02, ...encodeULEB128(0),
      OP.i32_const, 1,
      OP.i32_const, ...encodeSLEB128(8),
      OP.i32_const, 1,
      OP.i32_const, ...encodeSLEB128(20),
      OP.call, ...encodeULEB128(importFd),
      OP.drop,
    ]
  });

  const WASIMain = compileASTToWasmBody(ast, m, { printStr: printStrIdx });

  const mainTypeIdx = m.addType([], ['i32']);
  const mainIdx = m.imports.length + m.funcs.length;
  m.funcs.push(mainTypeIdx);
  m.codes.push({
    locals: ['f64', 'f64', 'f64', 'f64', 'f64'],
    body: [...WASIMain, OP.i32_const, ...encodeSLEB128(0)]
  });

  m.addExport('memory', 2, 0);
  m.addExport('_start', 0, mainIdx);

  return m.build();
}

function compileASTToWasmBody(ast, m, ctx) {
  const body = [];
  const dataStrings = new Map();
  const _O = (offset) => [...encodeULEB128(2), ...encodeULEB128(offset)];

  function addString(s) {
    if (dataStrings.has(s)) return dataStrings.get(s);
    const bytes = [...Buffer.from(s + '\n', 'utf8')];
    const offset = m.addData(bytes);
    dataStrings.set(s, { offset, len: bytes.length });
    return { offset, len: bytes.length };
  }

  function emitI32Const(v) { return [OP.i32_const, ...encodeSLEB128(v | 0)]; }
  function emitF64Const(v) { return [OP.f64_const, ...encodeF64LE(v)]; }

  function compileStmt(node) {
    if (!node) return [];
    switch (node.type) {
      case 'LogStmt': {
        const parts = (node.args || []);
        const strs = parts.map(p => {
          if (p.type === 'StringLiteral') return p.value;
          if (p.type === 'NumberLiteral') return String(p.value);
          if (p.type === 'BoolLiteral') return String(p.value);
          return '<value>';
        }).join(' ');
        const { offset, len } = addString(strs);
        return [
          ...emitI32Const(offset), ...emitI32Const(len),
          OP.call, ...encodeULEB128(ctx.printStr),
        ];
      }
      case 'ReturnStmt':
        if (node.value) return [...compileExpr(node.value), OP.return];
        return [OP.return];
      case 'Block':
      case 'BlockStmt':
        return (node.body || []).flatMap(compileStmt);
      case 'Program':
        return (node.body || []).flatMap(compileStmt);
      default:
        return [];
    }
  }

  function compileExpr(node) {
    if (!node) return emitI32Const(0);
    switch (node.type) {
      case 'NumberLiteral': return emitF64Const(node.value);
      case 'BinaryExpr': {
        const L = compileExpr(node.left), R = compileExpr(node.right);
        const ops = { '+': OP.f64_add, '-': OP.f64_sub, '*': OP.f64_mul, '/': OP.f64_div };
        return [...L, ...R, ops[node.op] || OP.f64_add];
      }
      default: return emitF64Const(0);
    }
  }

  const stmts = (ast && ast.body) ? ast.body : [];
  for (const s of stmts) body.push(...compileStmt(s));
  return body;
}

module.exports = { WasmModule, compileNTLToWasm, OP, TYPE, encodeULEB128, encodeSLEB128, encodeString };
