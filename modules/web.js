'use strict';
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(str) { return escapeHtml(str); }
function raw(value) { return { __raw: true, value: String(value) }; }
function isRaw(v) { return v && v.__raw === true; }
function renderValue(v) {
  if (v === null || v === undefined) return '';
  if (isRaw(v)) return v.value;
  if (Array.isArray(v)) return v.map(renderValue).join('');
  return escapeHtml(String(v));
}
function attrs(obj) {
  if (!obj) return '';
  return Object.entries(obj)
    .filter(([, v]) => v !== false && v !== null && v !== undefined)
    .map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
}
function tag(name, attrObj, ...children) {
  const selfClosing = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];
  const a = attrObj ? attrs(attrObj) : '';
  const isSelf = selfClosing.includes(name.toLowerCase());
  if (isSelf) return raw(`<${name}${a}>`);
  const inner = children.map(renderValue).join('');
  return raw(`<${name}${a}>${inner}</${name}>`);
}
const el = new Proxy({}, {
  get(_, name) {
    return (attrObj, ...children) => {
      if (attrObj && typeof attrObj === 'object' && !Array.isArray(attrObj) && !isRaw(attrObj)) {
        return tag(name, attrObj, ...children);
      }
      return tag(name, null, ...(attrObj !== undefined ? [attrObj] : []), ...children);
    };
  }
});
function html(strings, ...values) {
  let result = '';
  strings.forEach((str, i) => {
    result += str;
    if (i < values.length) result += renderValue(values[i]);
  });
  return raw(result);
}
function css(strings, ...values) {
  let result = '';
  strings.forEach((str, i) => { result += str; if (i < values.length) result += values[i]; });
  return result;
}
function page(options) {
  options = options || {};
  const { title = 'NTL App', description = '', lang = 'en', charset = 'UTF-8', viewport = 'width=device-width, initial-scale=1.0', styles = [], scripts = [], body: bodyContent = '', head: extraHead = '' } = options;
  const styleLinks = styles.map(s => typeof s === 'string' && !s.startsWith('<')
    ? `<link rel="stylesheet" href="${escapeAttr(s)}">`
    : typeof s === 'string' ? s : `<style>${s.css || ''}</style>`
  ).join('\n    ');
  const scriptTags = scripts.map(s => typeof s === 'string' && !s.startsWith('<')
    ? `<script src="${escapeAttr(s)}"></script>`
    : typeof s === 'string' ? s : `<script>${s.code || ''}</script>`
  ).join('\n    ');
  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="${escapeAttr(charset)}">
  <meta name="viewport" content="${escapeAttr(viewport)}">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeAttr(description)}">` : ''}
  ${styleLinks}
  ${extraHead}
</head>
<body>
  ${isRaw(bodyContent) ? bodyContent.value : escapeHtml(String(bodyContent))}
  ${scriptTags}
</body>
</html>`;
}
class Router {
  constructor() { this._routes = []; this._notFound = null; this._middleware = []; }
  use(fn) { this._middleware.push(fn); return this; }
  get(path, handler) { return this._add('GET', path, handler); }
  post(path, handler) { return this._add('POST', path, handler); }
  put(path, handler) { return this._add('PUT', path, handler); }
  delete(path, handler) { return this._add('DELETE', path, handler); }
  patch(path, handler) { return this._add('PATCH', path, handler); }
  any(path, handler) { return this._add('*', path, handler); }
  notFound(handler) { this._notFound = handler; return this; }
  _add(method, path, handler) {
    const keys = [];
    const regex = new RegExp('^' + path.replace(/:([^/]+)\*/g, (_, k) => { keys.push(k + '*'); return '(.+)'; }).replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\
    this._routes.push({ method, path, regex, keys, handler });
    return this;
  }
  match(method, url) {
    const [path, qs] = url.split('?');
    const query = {};
    if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    for (const route of this._routes) {
      if (route.method !== '*' && route.method !== method.toUpperCase()) continue;
      const m = path.match(route.regex);
      if (!m) continue;
      const params = {};
      route.keys.forEach((k, i) => { params[k.replace('*', '')] = decodeURIComponent(m[i + 1] || ''); });
      return { handler: route.handler, params, query, route };
    }
    return null;
  }
  handle(req, res) {
    const matched = this.match(req.method, req.url);
    const runMiddleware = (i, done) => {
      if (i >= this._middleware.length) return done();
      this._middleware[i](req, res, () => runMiddleware(i + 1, done));
    };
    runMiddleware(0, () => {
      if (!matched) {
        if (this._notFound) return this._notFound(req, res);
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      req.params = matched.params;
      req.query  = matched.query;
      matched.handler(req, res);
    });
  }
}
class Template {
  constructor(str) { this._str = str; }
  render(data) {
    return this._str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const val = key.trim().split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : ''), data);
      return escapeHtml(String(val !== undefined ? val : ''));
    }).replace(/\{#if ([^}]+)\}([\s\S]*?)\{\/if\}/g, (_, cond, inner) => {
      try { return Function('data', 'with(data){return ' + cond + '}')(data) ? inner : ''; } catch { return ''; }
    }).replace(/\{#each ([^}]+) as ([^}]+)\}([\s\S]*?)\{\/each\}/g, (_, arr, item, inner) => {
      try {
        const list = Function('data', 'with(data){return ' + arr + '}')(data);
        if (!Array.isArray(list)) return '';
        return list.map((v, i) => new Template(inner).render({ ...data, [item.trim()]: v, index: i })).join('');
      } catch { return ''; }
    });
  }
  static from(str) { return new Template(str); }
}
function qs(obj) {
  return Object.entries(obj || {})
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
}
function parseQs(str) {
  const result = {};
  (str.startsWith('?') ? str.slice(1) : str).split('&').forEach(p => {
    const [k, v] = p.split('=');
    if (k) result[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return result;
}
function slugify(str) {
  return str.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function truncate(str, len, suffix) {
  suffix = suffix === undefined ? '...' : suffix;
  return str.length <= len ? str : str.slice(0, len - suffix.length) + suffix;
}
function wordCount(str) { return str.trim().split(/\s+/).filter(Boolean).length; }
function readTime(str, wpm) { return Math.ceil(wordCount(str) / (wpm || 200)); }
function excerpt(str, len) { return truncate(str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), len || 160); }
function markdown(str) {
  return str
    .replace(/^#{6}\s(.+)/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s(.+)/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s(.+)/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s(.+)/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s(.+)/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s(.+)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\> (.+)/gm, '<blockquote>$1</blockquote>')
    .replace(/^\- (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>');
}
module.exports = { el, html, css, page, Router, Template, raw, escapeHtml, escapeAttr, attrs, tag, qs, parseQs, slugify, truncate, wordCount, readTime, excerpt, markdown };
