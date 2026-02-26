'use strict';
class Tensor {
  constructor(data) {
    if (Array.isArray(data)) {
      this.data = data.flat(Infinity).map(Number);
      this.shape = Tensor._inferShape(data);
    } else if (data instanceof Float64Array || data instanceof Float32Array) {
      this.data = Array.from(data);
      this.shape = [data.length];
    } else if (typeof data === 'number') {
      this.data = [data];
      this.shape = [1];
    } else {
      this.data = [];
      this.shape = [0];
    }
  }
  static _inferShape(arr) {
    if (!Array.isArray(arr)) return [];
    if (!Array.isArray(arr[0])) return [arr.length];
    return [arr.length, ...Tensor._inferShape(arr[0])];
  }
  get length() { return this.data.length; }
  get ndim()   { return this.shape.length; }
  get size()   { return this.data.reduce((a, b) => a * b, 1) || this.data.length; }
  get(idx) {
    if (typeof idx === 'number') return this.data[idx];
    return idx.reduce((i, s, dim) => i + s * this.shape.slice(dim + 1).reduce((a, b) => a * b, 1), 0);
  }
  set(idx, val) { this.data[typeof idx === 'number' ? idx : this.get(idx)] = val; }
  map(fn)  { return new Tensor(this.data.map(fn)); }
  filter(fn) { const d = this.data.filter(fn); const t = new Tensor([]); t.data = d; t.shape = [d.length]; return t; }
  reduce(fn, init) { return this.data.reduce(fn, init); }
  add(other)  { return this._binop(other, (a, b) => a + b); }
  sub(other)  { return this._binop(other, (a, b) => a - b); }
  mul(other)  { return this._binop(other, (a, b) => a * b); }
  div(other)  { return this._binop(other, (a, b) => a / b); }
  pow(other)  { return this._binop(other, (a, b) => Math.pow(a, b)); }
  _binop(other, fn) {
    if (typeof other === 'number') return new Tensor(this.data.map(v => fn(v, other)));
    if (other instanceof Tensor) return new Tensor(this.data.map((v, i) => fn(v, other.data[i] ?? 0)));
    return this;
  }
  dot(other) {
    if (!(other instanceof Tensor)) throw new Error('[ntl:ai] dot requires a Tensor');
    let sum = 0;
    for (let i = 0; i < Math.min(this.data.length, other.data.length); i++) sum += this.data[i] * other.data[i];
    return sum;
  }
  matmul(other) {
    const [m, k1] = this.shape;
    const [k2, n] = other.shape;
    if (k1 !== k2) throw new Error(`[ntl:ai] matmul shape mismatch: (${m},${k1}) x (${k2},${n})`);
    const result = [];
    for (let i = 0; i < m; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < k1; k++) sum += this.data[i * k1 + k] * other.data[k * n + j];
        row.push(sum);
      }
      result.push(row);
    }
    return new Tensor(result);
  }
  sum()  { return this.data.reduce((a, b) => a + b, 0); }
  mean() { return this.sum() / this.data.length; }
  min()  { return Math.min(...this.data); }
  max()  { return Math.max(...this.data); }
  std()  { const m = this.mean(); return Math.sqrt(this.data.reduce((s, v) => s + (v - m) ** 2, 0) / this.data.length); }
  norm() { return Math.sqrt(this.dot(this)); }
  normalize() {
    const n = this.norm();
    return n === 0 ? this : new Tensor(this.data.map(v => v / n));
  }
  softmax() {
    const maxVal = this.max();
    const exps = this.data.map(v => Math.exp(v - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    return new Tensor(exps.map(v => v / sum));
  }
  relu()    { return this.map(v => Math.max(0, v)); }
  sigmoid() { return this.map(v => 1 / (1 + Math.exp(-v))); }
  tanh()    { return this.map(v => Math.tanh(v)); }
  reshape(shape) {
    const t = new Tensor([]);
    t.data  = [...this.data];
    t.shape = shape;
    return t;
  }
  flatten() { return this.reshape([this.data.length]); }
  slice(start, end) {
    const t = new Tensor([]);
    t.data  = this.data.slice(start, end);
    t.shape = [t.data.length];
    return t;
  }
  toArray() {
    if (this.shape.length === 1) return [...this.data];
    if (this.shape.length === 2) {
      const [rows, cols] = this.shape;
      const result = [];
      for (let i = 0; i < rows; i++) result.push(this.data.slice(i * cols, (i + 1) * cols));
      return result;
    }
    return [...this.data];
  }
  toString() {
    return `Tensor(shape=[${this.shape}], data=[${this.data.slice(0, 8).join(', ')}${this.data.length > 8 ? '...' : ''}])`;
  }
}
class Matrix extends Tensor {
  constructor(rows, cols, data) {
    const d = data || Array.from({ length: rows * cols }, () => 0);
    super(d);
    this.shape = [rows, cols];
    this.rows  = rows;
    this.cols  = cols;
  }
  get(row, col) { return this.data[row * this.cols + col]; }
  set(row, col, val) { this.data[row * this.cols + col] = val; return this; }
  row(i) {
    const t = new Tensor(this.data.slice(i * this.cols, (i + 1) * this.cols));
    t.shape = [this.cols];
    return t;
  }
  col(j) {
    const d = [];
    for (let i = 0; i < this.rows; i++) d.push(this.data[i * this.cols + j]);
    const t = new Tensor(d);
    t.shape = [this.rows];
    return t;
  }
  transpose() {
    const m = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) for (let j = 0; j < this.cols; j++) m.set(j, i, this.get(i, j));
    return m;
  }
  toString() {
    const rows = [];
    for (let i = 0; i < this.rows; i++) rows.push(`  [${this.row(i).data.join(', ')}]`);
    return `Matrix(${this.rows}x${this.cols}):\n${rows.join('\n')}`;
  }
}
class Layer {
  constructor(inputSize, outputSize, activation) {
    this.inputSize  = inputSize;
    this.outputSize = outputSize;
    this.activation = activation || 'relu';
    this.weights    = randomMatrix(inputSize, outputSize);
    this.biases     = zeros(outputSize);
    this._lastInput  = null;
    this._lastOutput = null;
  }
  forward(input) {
    this._lastInput = input;
    const z = input.matmul(this.weights).add(this.biases);
    this._lastOutput = this._activate(z);
    return this._lastOutput;
  }
  _activate(t) {
    switch (this.activation) {
      case 'relu':    return t.relu();
      case 'sigmoid': return t.sigmoid();
      case 'tanh':    return t.tanh();
      case 'softmax': return t.softmax();
      default:        return t;
    }
  }
}
class NeuralNetwork {
  constructor(layers) {
    this.layers = layers || [];
  }
  add(layer) { this.layers.push(layer); return this; }
  forward(input) {
    let out = input;
    for (const layer of this.layers) out = layer.forward(out);
    return out;
  }
  predict(input) {
    return this.forward(input instanceof Tensor ? input : new Tensor(input));
  }
}
function tensor(data)  { return new Tensor(data); }
function zeros(n)      { return new Tensor(Array(n).fill(0)); }
function ones(n)       { return new Tensor(Array(n).fill(1)); }
function full(n, val)  { return new Tensor(Array(n).fill(val)); }
function arange(start, end, step) {
  step = step || 1;
  if (end === undefined) { end = start; start = 0; }
  const data = [];
  for (let i = start; i < end; i += step) data.push(i);
  return new Tensor(data);
}
function randomTensor(n) {
  return new Tensor(Array.from({ length: n }, () => Math.random() * 2 - 1));
}
function randomMatrix(rows, cols) {
  const data = Array.from({ length: rows * cols }, () => (Math.random() - 0.5) * Math.sqrt(2 / rows));
  const m = new Matrix(rows, cols, data);
  return m;
}
function matrix(rows, cols, data) { return new Matrix(rows, cols, data); }
function cosineSimilarity(a, b) {
  const dot = a.dot(b);
  const na  = a.norm();
  const nb  = b.norm();
  return na === 0 || nb === 0 ? 0 : dot / (na * nb);
}
function euclideanDistance(a, b) {
  return a.sub(b).map(v => v * v).sum() ** 0.5;
}
function normalize(t) { return t.normalize(); }
function kMeans(data, k, maxIter) {
  maxIter = maxIter || 100;
  const tensors = data.map(d => d instanceof Tensor ? d : new Tensor(d));
  let centroids = tensors.slice(0, k).map(t => new Tensor([...t.data]));
  for (let iter = 0; iter < maxIter; iter++) {
    const assignments = tensors.map(t => {
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = euclideanDistance(t, centroids[i]);
        if (d < bestDist) { best = i; bestDist = d; }
      }
      return best;
    });
    const newCentroids = Array.from({ length: k }, (_, i) => {
      const cluster = tensors.filter((_, j) => assignments[j] === i);
      if (cluster.length === 0) return centroids[i];
      const sum = cluster.reduce((acc, t) => acc.add(t), zeros(cluster[0].length));
      return sum.map(v => v / cluster.length);
    });
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (euclideanDistance(centroids[i], newCentroids[i]) > 0.0001) { converged = false; break; }
    }
    centroids = newCentroids;
    if (converged) break;
  }
  const assignments = tensors.map(t => {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const d = euclideanDistance(t, centroids[i]);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    return best;
  });
  return { centroids, assignments };
}
module.exports = {
  Tensor, Matrix, Layer, NeuralNetwork,
  tensor, zeros, ones, full, arange,
  randomTensor, randomMatrix, matrix,
  cosineSimilarity, euclideanDistance, normalize,
  kMeans
};
