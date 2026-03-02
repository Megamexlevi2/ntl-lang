// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

'use strict';

const https = require('https');
const http  = require('http');
const url   = require('url');
const path  = require('path');
const fs    = require('fs');

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
function _fetch(endpoint, body, headers, method) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(endpoint);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const data = JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.path || '/',
      method:   method || 'POST',
      headers:  Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }, headers || {})
    };
    const req = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(raw), raw }); }
        catch (e) { resolve({ status: res.statusCode, data: raw, raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Streaming helper ────────────────────────────────────────────────────────
function _fetchStream(endpoint, body, headers, onChunk) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(endpoint);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const data = JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.path || '/',
      method:   'POST',
      headers:  Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }, headers || {})
    };
    const req = transport.request(opts, (res) => {
      let full = '';
      res.on('data', chunk => {
        const str = chunk.toString('utf8');
        // SSE lines: "data: {...}\n\n"
        const lines = str.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const token = obj.choices?.[0]?.delta?.content
              || obj.delta?.text
              || obj.message?.content
              || '';
            if (token) { full += token; if (onChunk) onChunk(token, full); }
          } catch {}
        }
      });
      res.on('end', () => resolve(full));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Message builder ─────────────────────────────────────────────────────────
function buildMessages(input, system) {
  if (typeof input === 'string') {
    const msgs = [];
    if (system) msgs.push({ role: 'system', content: system });
    msgs.push({ role: 'user', content: input });
    return msgs;
  }
  if (Array.isArray(input)) return input;
  return [input];
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────
class OpenAIProvider {
  constructor(opts) {
    this.apiKey  = opts.apiKey  || process.env.OPENAI_API_KEY  || '';
    this.model   = opts.model   || 'gpt-4o';
    this.baseUrl = opts.baseUrl || 'https://api.openai.com/v1';
    this.org     = opts.org     || process.env.OPENAI_ORG      || '';
  }
  _headers() {
    const h = { 'Authorization': 'Bearer ' + this.apiKey };
    if (this.org) h['OpenAI-Organization'] = this.org;
    return h;
  }
  async chat(messages, opts) {
    opts = opts || {};
    const body = {
      model:       opts.model       || this.model,
      messages,
      temperature: opts.temperature !== undefined ? opts.temperature : 0.7,
      max_tokens:  opts.maxTokens   || opts.max_tokens || 2048,
      top_p:       opts.topP        || 1,
    };
    if (opts.functions)   body.functions   = opts.functions;
    if (opts.tools)       body.tools       = opts.tools;
    if (opts.jsonMode)    body.response_format = { type: 'json_object' };
    if (opts.stream && opts.onChunk) {
      body.stream = true;
      return _fetchStream(this.baseUrl + '/chat/completions', body, this._headers(), opts.onChunk);
    }
    const res = await _fetch(this.baseUrl + '/chat/completions', body, this._headers());
    if (res.status !== 200) throw new Error(`[ntl:ai] OpenAI error ${res.status}: ${JSON.stringify(res.data)}`);
    return {
      content:    res.data.choices?.[0]?.message?.content || '',
      role:       'assistant',
      model:      res.data.model,
      usage:      res.data.usage,
      finishReason: res.data.choices?.[0]?.finish_reason,
      raw:        res.data,
    };
  }
  async embed(input, opts) {
    opts = opts || {};
    const texts = Array.isArray(input) ? input : [input];
    const body = {
      model: opts.model || 'text-embedding-3-small',
      input: texts,
    };
    const res = await _fetch(this.baseUrl + '/embeddings', body, this._headers());
    if (res.status !== 200) throw new Error(`[ntl:ai] OpenAI embed error: ${JSON.stringify(res.data)}`);
    return res.data.data.map(d => d.embedding);
  }
  async models() {
    const res = await _fetch(this.baseUrl + '/models', {}, this._headers(), 'GET');
    return res.data.data || [];
  }
}

// ─── Anthropic Claude Provider ───────────────────────────────────────────────
class AnthropicProvider {
  constructor(opts) {
    this.apiKey  = opts.apiKey  || process.env.ANTHROPIC_API_KEY || '';
    this.model   = opts.model   || 'claude-opus-4-6';
    this.baseUrl = opts.baseUrl || 'https://api.anthropic.com/v1';
  }
  _headers() {
    return {
      'x-api-key':          this.apiKey,
      'anthropic-version':  '2023-06-01',
    };
  }
  async chat(messages, opts) {
    opts = opts || {};
    // Anthropic wants system as separate field
    const sysMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const body = {
      model:      opts.model     || this.model,
      max_tokens: opts.maxTokens || 2048,
      messages:   userMsgs,
    };
    if (sysMsg) body.system = sysMsg.content;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.tools) body.tools = opts.tools;
    if (opts.stream && opts.onChunk) {
      body.stream = true;
      return _fetchStream(this.baseUrl + '/messages', body, this._headers(), opts.onChunk);
    }
    const res = await _fetch(this.baseUrl + '/messages', body, this._headers());
    if (res.status !== 200) throw new Error(`[ntl:ai] Anthropic error ${res.status}: ${JSON.stringify(res.data)}`);
    const content = res.data.content?.map(c => c.text || '').join('') || '';
    return {
      content,
      role:        'assistant',
      model:       res.data.model,
      usage:       res.data.usage,
      finishReason: res.data.stop_reason,
      raw:         res.data,
    };
  }
}

// ─── Ollama (local) Provider ─────────────────────────────────────────────────
class OllamaProvider {
  constructor(opts) {
    this.baseUrl = opts.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model   = opts.model  || 'llama3.1';
  }
  async chat(messages, opts) {
    opts = opts || {};
    const body = {
      model:    opts.model || this.model,
      messages,
      stream:   false,
      options:  {
        temperature: opts.temperature !== undefined ? opts.temperature : 0.7,
        num_predict: opts.maxTokens || 2048,
      }
    };
    if (opts.stream && opts.onChunk) {
      body.stream = true;
      return _fetchStream(this.baseUrl + '/api/chat', body, {}, opts.onChunk);
    }
    const res = await _fetch(this.baseUrl + '/api/chat', body, {});
    if (res.status !== 200) throw new Error(`[ntl:ai] Ollama error ${res.status}: ${JSON.stringify(res.data)}`);
    return {
      content:    res.data.message?.content || '',
      role:       'assistant',
      model:      res.data.model,
      raw:        res.data,
    };
  }
  async embed(input, opts) {
    opts = opts || {};
    const texts = Array.isArray(input) ? input : [input];
    const results = [];
    for (const text of texts) {
      const body = { model: opts.model || this.model, prompt: text };
      const res = await _fetch(this.baseUrl + '/api/embeddings', body, {});
      if (res.status !== 200) throw new Error(`[ntl:ai] Ollama embed error: ${JSON.stringify(res.data)}`);
      results.push(res.data.embedding || []);
    }
    return results;
  }
  async models() {
    const res = await _fetch(this.baseUrl + '/api/tags', {}, {}, 'GET');
    return (res.data.models || []).map(m => m.name);
  }
  async pull(model) {
    return _fetch(this.baseUrl + '/api/pull', { name: model });
  }
}

// ─── Groq Provider ───────────────────────────────────────────────────────────
class GroqProvider {
  constructor(opts) {
    this.apiKey  = opts.apiKey  || process.env.GROQ_API_KEY || '';
    this.model   = opts.model   || 'llama-3.3-70b-versatile';
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }
  async chat(messages, opts) {
    // Groq uses OpenAI-compatible API
    const openai = new OpenAIProvider({ apiKey: this.apiKey, model: this.model, baseUrl: this.baseUrl });
    return openai.chat(messages, opts);
  }
}

// ─── Main AI client ──────────────────────────────────────────────────────────
class AI {
  constructor(opts) {
    opts = opts || {};
    this.provider = this._createProvider(opts);
    this.system   = opts.system   || '';
    this.history  = opts.history  || [];
    this._memory  = [];
  }

  _createProvider(opts) {
    const name = opts.provider || opts.backend || 'openai';
    switch (name.toLowerCase()) {
      case 'openai':    return new OpenAIProvider(opts);
      case 'anthropic':
      case 'claude':    return new AnthropicProvider(opts);
      case 'ollama':    return new OllamaProvider(opts);
      case 'groq':      return new GroqProvider(opts);
      default:
        if (opts.apiKey && opts.apiKey.startsWith('sk-ant')) return new AnthropicProvider(opts);
        if (opts.apiKey) return new OpenAIProvider(opts);
        // Auto-detect from environment
        if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider(opts);
        if (process.env.OPENAI_API_KEY)    return new OpenAIProvider(opts);
        if (process.env.GROQ_API_KEY)      return new GroqProvider(opts);
        return new OllamaProvider(opts); // fallback to local
    }
  }

  async ask(prompt, opts) {
    opts = opts || {};
    const messages = buildMessages(prompt, this.system);
    const response = await this.provider.chat(messages, opts);
    // Store in history
    this._memory.push({ role: 'user', content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) });
    this._memory.push({ role: 'assistant', content: response.content });
    return response.content;
  }

  async chat(messages, opts) {
    return this.provider.chat(messages, opts);
  }

  async stream(prompt, onChunk, opts) {
    opts = Object.assign({}, opts, { stream: true, onChunk });
    const messages = buildMessages(prompt, this.system);
    return this.provider.chat(messages, opts);
  }

  // Multi-turn conversation — keeps full history
  async converse(userMessage, opts) {
    this._memory.push({ role: 'user', content: userMessage });
    const messages = [];
    if (this.system) messages.push({ role: 'system', content: this.system });
    messages.push(...this._memory);
    const response = await this.provider.chat(messages, opts || {});
    this._memory.push({ role: 'assistant', content: response.content });
    return response.content;
  }

  clearMemory() { this._memory = []; return this; }

  async embed(text, opts) {
    if (this.provider.embed) return this.provider.embed(text, opts || {});
    throw new Error('[ntl:ai] embed not supported by this provider');
  }

  async models() {
    if (this.provider.models) return this.provider.models();
    return [];
  }

  // JSON mode — auto-retry on parse failure
  async json(prompt, schema, opts) {
    opts = Object.assign({}, opts, { jsonMode: true });
    const systemPrompt = schema
      ? `${this.system ? this.system + '\n\n' : ''}Respond ONLY with valid JSON matching this schema: ${typeof schema === 'string' ? schema : JSON.stringify(schema)}. No explanation, no markdown.`
      : `${this.system || ''}Respond ONLY with valid JSON. No explanation, no markdown.`;
    const fullPrompt = `${typeof prompt === 'string' ? prompt : JSON.stringify(prompt)}`;
    const messages = buildMessages(fullPrompt, systemPrompt);
    let attempts = 0;
    while (attempts < 3) {
      const res = await this.provider.chat(messages, opts);
      const text = res.content || '';
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/g, '').trim();
      try { return JSON.parse(cleaned); } catch (e) {
        attempts++;
        if (attempts >= 3) throw new Error('[ntl:ai] JSON response could not be parsed after 3 attempts: ' + text.slice(0, 200));
        messages.push({ role: 'assistant', content: text });
        messages.push({ role: 'user', content: 'Your response was not valid JSON. Return ONLY a raw JSON object with no markdown.' });
      }
    }
  }

  // Classify input into one of the given labels
  async classify(text, labels, opts) {
    const labelsStr = labels.map((l, i) => `${i + 1}. ${l}`).join('\n');
    const prompt = `Classify the following text into exactly one of these categories:\n${labelsStr}\n\nText: ${text}\n\nRespond with ONLY the category name, nothing else.`;
    const result = await this.ask(prompt, opts || {});
    const normalized = result.trim().toLowerCase();
    return labels.find(l => normalized.includes(l.toLowerCase())) || result.trim();
  }

  // Summarize long text
  async summarize(text, opts) {
    opts = opts || {};
    const maxLen = opts.maxLength || 200;
    const style  = opts.style || 'concise';
    const prompt = `Summarize the following text in ${style} style (max ${maxLen} words):\n\n${text}`;
    return this.ask(prompt, opts);
  }

  // Translate text
  async translate(text, targetLang, opts) {
    opts = opts || {};
    const sourceLang = opts.from || 'auto';
    const prompt = sourceLang !== 'auto'
      ? `Translate from ${sourceLang} to ${targetLang}: ${text}`
      : `Translate to ${targetLang}: ${text}`;
    return this.ask(prompt, opts);
  }

  // Extract structured data from unstructured text
  async extract(text, fields, opts) {
    const fieldDesc = Array.isArray(fields)
      ? fields.join(', ')
      : Object.entries(fields).map(([k, v]) => `${k} (${v})`).join(', ');
    const schema = Array.isArray(fields)
      ? Object.fromEntries(fields.map(f => [f, 'string']))
      : fields;
    const prompt = `Extract the following fields from the text: ${fieldDesc}.\n\nText:\n${text}`;
    return this.json(prompt, schema, opts || {});
  }

  // Function calling / tool use
  async callTool(prompt, tools, opts) {
    opts = opts || {};
    const messages = buildMessages(prompt, this.system);
    return this.provider.chat(messages, Object.assign({}, opts, { tools }));
  }
}

// ─── Embedding utilities ─────────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function euclideanDistance(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// Simple vector store for RAG (Retrieval-Augmented Generation)
class VectorStore {
  constructor() {
    this._docs = [];
    this._embeddings = [];
  }

  // Add a document with optional metadata
  add(text, metadata) {
    const id = this._docs.length;
    this._docs.push({ id, text, metadata: metadata || {} });
    return id;
  }

  // Add with pre-computed embedding
  addWithEmbedding(text, embedding, metadata) {
    const id = this._docs.length;
    this._docs.push({ id, text, metadata: metadata || {} });
    this._embeddings[id] = embedding;
    return id;
  }

  // Embed all un-embedded docs using the given AI client
  async embedAll(ai, opts) {
    const unembedded = this._docs.filter((_, i) => !this._embeddings[i]);
    if (unembedded.length === 0) return;
    const texts = unembedded.map(d => d.text);
    const embeddings = await ai.embed(texts, opts || {});
    for (let i = 0; i < unembedded.length; i++) {
      this._embeddings[unembedded[i].id] = embeddings[i];
    }
  }

  // Search by cosine similarity
  search(queryEmbedding, k) {
    k = k || 5;
    const scored = this._docs
      .filter((_, i) => this._embeddings[i])
      .map((doc, i) => ({
        doc,
        score: cosineSimilarity(queryEmbedding, this._embeddings[doc.id] || [])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    return scored;
  }

  // Full RAG: embed query, search, return context
  async retrieve(ai, query, k) {
    const [queryEmb] = await ai.embed(query);
    return this.search(queryEmb, k || 5);
  }

  size() { return this._docs.length; }
  clear() { this._docs = []; this._embeddings = []; }

  // Save/load from JSON file
  save(filePath) {
    fs.writeFileSync(filePath, JSON.stringify({ docs: this._docs, embeddings: this._embeddings }, null, 2), 'utf-8');
  }
  load(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this._docs = data.docs || [];
    this._embeddings = data.embeddings || [];
    return this;
  }
}

// ─── Prompt templates ────────────────────────────────────────────────────────
class Prompt {
  constructor(template) { this._template = template; }
  format(vars) {
    return this._template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{{${k}}}`);
  }
  static from(template) { return new Prompt(template); }
}

// ─── Tensor math (kept for ML/local use) ────────────────────────────────────
class Tensor {
  constructor(data) {
    if (Array.isArray(data)) {
      this.data  = data.flat(Infinity).map(Number);
      this.shape = Tensor._inferShape(data);
    } else {
      this.data  = [];
      this.shape = [0];
    }
  }
  static _inferShape(arr) {
    if (!Array.isArray(arr)) return [];
    if (!Array.isArray(arr[0])) return [arr.length];
    return [arr.length, ...Tensor._inferShape(arr[0])];
  }
  get length() { return this.data.length; }
  add(o)   { return this._op(o, (a,b)=>a+b); }
  sub(o)   { return this._op(o, (a,b)=>a-b); }
  mul(o)   { return this._op(o, (a,b)=>a*b); }
  div(o)   { return this._op(o, (a,b)=>a/b); }
  _op(o, fn) {
    if (typeof o === 'number') return new Tensor(this.data.map(v=>fn(v,o)));
    if (o instanceof Tensor)   return new Tensor(this.data.map((v,i)=>fn(v,o.data[i]||0)));
    return this;
  }
  dot(o)   { let s=0; for(let i=0;i<Math.min(this.data.length,o.data.length);i++) s+=this.data[i]*o.data[i]; return s; }
  sum()    { return this.data.reduce((a,b)=>a+b,0); }
  mean()   { return this.sum()/this.data.length; }
  max()    { return Math.max(...this.data); }
  min()    { return Math.min(...this.data); }
  norm()   { return Math.sqrt(this.dot(this)); }
  normalize() { const n=this.norm(); return n?new Tensor(this.data.map(v=>v/n)):this; }
  softmax()   { const m=this.max(); const e=this.data.map(v=>Math.exp(v-m)); const s=e.reduce((a,b)=>a+b,0); return new Tensor(e.map(v=>v/s)); }
  relu()      { return new Tensor(this.data.map(v=>Math.max(0,v))); }
  sigmoid()   { return new Tensor(this.data.map(v=>1/(1+Math.exp(-v)))); }
  tanh()      { return new Tensor(this.data.map(v=>Math.tanh(v))); }
  reshape(s)  { const t=new Tensor([]); t.data=[...this.data]; t.shape=s; return t; }
  toArray()   { return [...this.data]; }
  toString()  { return `Tensor([${this.data.slice(0,8).join(',')}${this.data.length>8?'...':''}], shape=[${this.shape}])`; }
}

// ─── Factory functions ───────────────────────────────────────────────────────
function createAI(opts) { return new AI(opts || {}); }

function openai(opts)    { opts = opts||{}; opts.provider='openai';    return new AI(opts); }
function anthropic(opts) { opts = opts||{}; opts.provider='anthropic'; return new AI(opts); }
function claude(opts)    { return anthropic(opts); }
function ollama(opts)    { opts = opts||{}; opts.provider='ollama';    return new AI(opts); }
function groq(opts)      { opts = opts||{}; opts.provider='groq';      return new AI(opts); }

module.exports = {
  AI, createAI,
  openai, anthropic, claude, ollama, groq,
  OpenAIProvider, AnthropicProvider, OllamaProvider, GroqProvider,
  VectorStore, Prompt,
  Tensor,
  cosineSimilarity, euclideanDistance,
  buildMessages,
};
