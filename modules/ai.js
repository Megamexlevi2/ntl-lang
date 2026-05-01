'use strict';

// ntl:ai — connect to OpenAI, Anthropic, Ollama, and any OpenAI-compatible API
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const https = require('https');
const http  = require('http');

async function postJSON(baseUrl, path_, apiKey, body, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const url      = new URL(path_, baseUrl);
    const isHttps  = url.protocol === 'https:';
    const mod      = isHttps ? https : http;
    const payload  = JSON.stringify(body);
    const headers  = Object.assign({
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    }, apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, opts.headers || {});

    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + (url.search || ''),
      method:   'POST',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end',  () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 400) {
          let msg = raw;
          try { msg = JSON.parse(raw)?.error?.message || raw; } catch(_) {}
          return reject(new Error(`API error ${res.statusCode}: ${msg}`));
        }
        try { resolve(JSON.parse(raw)); }
        catch(e) { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (opts.timeout) req.setTimeout(opts.timeout, () => req.destroy(new Error('Request timed out')));
    req.write(payload);
    req.end();
  });
}

async function postStream(baseUrl, path_, apiKey, body, onChunk, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const url     = new URL(path_, baseUrl);
    const isHttps = url.protocol === 'https:';
    const mod     = isHttps ? https : http;
    const payload = JSON.stringify(Object.assign({}, body, { stream: true }));
    const headers = Object.assign({
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    }, apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, opts.headers || {});

    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + (url.search || ''),
      method:   'POST',
      headers,
    }, (res) => {
      let full = '';
      res.on('data', chunk => {
        const lines = chunk.toString('utf-8').split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const text   = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
            if (text) { full += text; if (onChunk) onChunk(text, parsed); }
          } catch(_) {}
        }
      });
      res.on('end', () => resolve(full));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

function openai(opts) {
  opts = opts || {};
  const apiKey  = opts.apiKey  || process.env.OPENAI_API_KEY;
  const baseUrl = opts.baseUrl || 'https://api.openai.com';
  const model   = opts.model   || 'gpt-4o';

  return {
    chat: async (params) => {
      const body = {
        model:       params.model    || model,
        messages:    params.messages,
        temperature: params.temperature,
        max_tokens:  params.maxTokens || params.max_tokens,
        top_p:       params.topP     || params.top_p,
        stream:      false,
      };
      Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
      return postJSON(baseUrl, '/v1/chat/completions', apiKey, body, opts);
    },

    stream: (params) => {
      const { EventEmitter } = require('./events');
      const emitter = new EventEmitter();
      const body = {
        model:    params.model || model,
        messages: params.messages,
        stream:   true,
      };
      postStream(baseUrl, '/v1/chat/completions', apiKey, body, (chunk) => emitter.emit('chunk', chunk), opts)
        .then(full => emitter.emit('done', full))
        .catch(e  => emitter.emit('error', e));
      return emitter;
    },

    complete: async (prompt, params) => {
      params = params || {};
      const messages = [{ role: 'user', content: prompt }];
      if (params.system) messages.unshift({ role: 'system', content: params.system });
      const res = await postJSON(baseUrl, '/v1/chat/completions', apiKey, {
        model:       params.model || model,
        messages,
        temperature: params.temperature || 0.7,
        max_tokens:  params.maxTokens,
      }, opts);
      return res.choices?.[0]?.message?.content || '';
    },

    embed: async (input, params) => {
      params = params || {};
      const res = await postJSON(baseUrl, '/v1/embeddings', apiKey, {
        model: params.model || 'text-embedding-3-small',
        input: Array.isArray(input) ? input : [input],
      }, opts);
      return Array.isArray(input) ? res.data.map(d => d.embedding) : res.data?.[0]?.embedding;
    },

    models: async () => {
      const { fetch } = require('./http');
      const res = await fetch(`${baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
      return res.json();
    },
  };
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

function anthropic(opts) {
  opts = opts || {};
  const apiKey  = opts.apiKey  || process.env.ANTHROPIC_API_KEY;
  const baseUrl = opts.baseUrl || 'https://api.anthropic.com';
  const model   = opts.model   || 'claude-3-5-sonnet-20241022';

  const headers = {
    'x-api-key':         apiKey,
    'anthropic-version': '2023-06-01',
  };

  return {
    chat: async (params) => {
      const messages  = (params.messages || []).filter(m => m.role !== 'system');
      const systemMsg = (params.messages || []).find(m => m.role === 'system');
      return postJSON(baseUrl, '/v1/messages', null, {
        model:      params.model || model,
        max_tokens: params.maxTokens || params.max_tokens || 1024,
        messages,
        system:     systemMsg?.content || params.system || undefined,
      }, { headers });
    },

    complete: async (prompt, params) => {
      params = params || {};
      const res = await postJSON(baseUrl, '/v1/messages', null, {
        model:      params.model || model,
        max_tokens: params.maxTokens || 1024,
        messages:   [{ role: 'user', content: prompt }],
        system:     params.system,
      }, { headers });
      return res.content?.[0]?.text || '';
    },

    stream: (params) => {
      const { EventEmitter } = require('./events');
      const emitter = new EventEmitter();
      const messages = (params.messages || []).filter(m => m.role !== 'system');
      postStream(baseUrl, '/v1/messages', null, {
        model:      params.model || model,
        max_tokens: params.maxTokens || 1024,
        messages,
        stream:     true,
      }, (chunk) => emitter.emit('chunk', chunk), { headers })
        .then(full => emitter.emit('done', full))
        .catch(e  => emitter.emit('error', e));
      return emitter;
    },
  };
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

function ollama(opts) {
  opts = opts || {};
  const baseUrl = opts.host || opts.baseUrl || 'http://localhost:11434';
  const model   = opts.model || 'llama3';

  return {
    chat: async (params) => {
      return postJSON(baseUrl, '/api/chat', null, {
        model:    params.model    || model,
        messages: params.messages || [],
        stream:   false,
        options:  params.options  || {},
      });
    },

    generate: async (prompt, params) => {
      params = params || {};
      const res = await postJSON(baseUrl, '/api/generate', null, {
        model:  params.model || model,
        prompt,
        stream: false,
      });
      return res.response || '';
    },

    complete: async (prompt, params) => {
      return ollama(opts).generate(prompt, params);
    },

    stream: (params) => {
      const { EventEmitter } = require('./events');
      const emitter = new EventEmitter();
      postStream(baseUrl, '/api/chat', null, {
        model:    params.model || model,
        messages: params.messages || [],
        stream:   true,
      }, (chunk) => emitter.emit('chunk', chunk))
        .then(full => emitter.emit('done', full))
        .catch(e  => emitter.emit('error', e));
      return emitter;
    },

    models: async () => {
      const { fetch } = require('./http');
      return (await (await fetch(`${baseUrl}/api/tags`)).json()).models || [];
    },

    pull: async (modelName) => {
      return postJSON(baseUrl, '/api/pull', null, { name: modelName || model, stream: false });
    },
  };
}

// ─── Generic OpenAI-compatible client ─────────────────────────────────────────

function createClient(opts) {
  opts = opts || {};
  const apiKey  = opts.apiKey;
  const baseUrl = opts.baseUrl || 'https://api.openai.com';
  const model   = opts.model   || 'gpt-4o';

  return {
    chat:     (params) => openai({ apiKey, baseUrl, model }).chat(params),
    complete: (prompt, params) => openai({ apiKey, baseUrl, model }).complete(prompt, params),
    stream:   (params) => openai({ apiKey, baseUrl, model }).stream(params),
  };
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function system(content) { return { role: 'system', content }; }
function user(content)   { return { role: 'user',   content }; }
function assistant(content) { return { role: 'assistant', content }; }

function messages(...items) {
  return items.map(item => {
    if (typeof item === 'string') return user(item);
    return item;
  });
}

module.exports = { openai, anthropic, ollama, createClient, system, user, assistant, messages };
