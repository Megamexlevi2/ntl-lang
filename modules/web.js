// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

'use strict';

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
    .filter(([,v]) => v !== false && v !== null && v !== undefined)
    .map(([k,v]) => v === true ? ` ${k}` : ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
}
function tag(name, attrObj, ...children) {
  const SELF = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const a = attrObj ? attrs(attrObj) : '';
  if (SELF.has(name.toLowerCase())) return raw(`<${name}${a}>`);
  const inner = children.map(c => (typeof c === 'function' && c._isNTLComponent) ? renderValue(c()) : renderValue(c)).join('');
  return raw(`<${name}${a}>${inner}</${name}>`);
}
const el = new Proxy({}, {
  get(_, name) {
    return (first, ...rest) => {
      if (first && typeof first === 'object' && !Array.isArray(first) && !isRaw(first))
        return tag(name, first, ...rest);
      return tag(name, null, ...(first !== undefined ? [first] : []), ...rest);
    };
  }
});

// --- Reactive hooks (works SSR too) ---
let _currentComponent = null;
let _hookIndex = 0;

function useState(initial) {
  if (typeof document === 'undefined') {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  }
  const comp = _currentComponent;
  if (!comp) throw new Error('useState must be called inside a component');
  const idx = _hookIndex++;
  if (comp._state[idx] === undefined)
    comp._state[idx] = typeof initial === 'function' ? initial() : initial;
  const set = (v) => {
    comp._state[idx] = typeof v === 'function' ? v(comp._state[idx]) : v;
    comp._rerender();
  };
  return [comp._state[idx], set];
}

function useEffect(fn, deps) {
  if (typeof document === 'undefined') return;
  const comp = _currentComponent;
  if (!comp) return;
  const idx = _hookIndex++;
  const prev = comp._effects[idx];
  const changed = !prev || (deps||[]).some((d,i) => d !== prev[i]);
  if (changed) {
    if (comp._cleanups[idx]) comp._cleanups[idx]();
    comp._effects[idx] = deps;
    const cleanup = fn();
    comp._cleanups[idx] = typeof cleanup === 'function' ? cleanup : null;
  }
}

function useRef(initial) {
  const comp = _currentComponent;
  if (!comp) return { current: initial };
  const idx = _hookIndex++;
  if (!comp._refs[idx]) comp._refs[idx] = { current: initial };
  return comp._refs[idx];
}

function useMemo(fn, deps) {
  const comp = _currentComponent;
  if (!comp) return fn();
  const idx = _hookIndex++;
  const prev = comp._memos[idx];
  const changed = !prev || (deps||[]).some((d,i) => d !== prev.deps[i]);
  if (changed) comp._memos[idx] = { value: fn(), deps: deps||[] };
  return comp._memos[idx].value;
}

function useCallback(fn, deps) { return useMemo(() => fn, deps); }

// --- Component mount ---
function component(fn) {
  fn._isNTLComponent = true;
  return fn;
}

function renderToString(fn, props) {
  _currentComponent = { _state:[], _effects:[], _cleanups:[], _refs:[], _memos:[], _rerender:()=>{} };
  _hookIndex = 0;
  const result = fn(props || {});
  _currentComponent = null;
  return isRaw(result) ? result.value : renderValue(result);
}

function mount(fn, container, props) {
  if (typeof document !== 'undefined') {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) throw new Error('mount: container not found');
    const inst = {
      _fn: fn, _props: props||{}, _container: container,
      _state:[], _effects:[], _cleanups:[], _refs:[], _memos:[],
      _rerender() {
        _currentComponent = inst; _hookIndex = 0;
        const res = inst._fn(inst._props);
        _currentComponent = null;
        inst._container.innerHTML = isRaw(res) ? res.value : renderValue(res);
      }
    };
    inst._rerender();
    return inst;
  }
  return renderToString(fn, props);
}

// --- page builder ---
function page(options) {
  options = options||{};
  const { title='NTL App', description='', lang='en', charset='UTF-8',
    viewport='width=device-width, initial-scale=1.0',
    styles=[], scripts=[], body:bodyContent='', head:extraHead='', favicon='' } = options;
  const styleLinks = styles.map(s =>
    (typeof s==='string'&&!s.startsWith('<')) ? `  <link rel="stylesheet" href="${escapeAttr(s)}">` :
    typeof s==='string' ? s : `  <style>\n${s.css||''}\n  </style>`).join('\n');
  const scriptTags = scripts.map(s =>
    (typeof s==='string'&&!s.startsWith('<')) ? `  <script src="${escapeAttr(s)}"></script>` :
    typeof s==='string' ? s : `  <script>\n${s.code||''}\n  </script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="${escapeAttr(charset)}">
  <meta name="viewport" content="${escapeAttr(viewport)}">
  <title>${escapeHtml(title)}</title>
${description ? `  <meta name="description" content="${escapeAttr(description)}">` : ''}
${favicon ? `  <link rel="icon" href="${escapeAttr(favicon)}">` : ''}
${styleLinks}
${extraHead}
</head>
<body>
${isRaw(bodyContent) ? bodyContent.value : escapeHtml(String(bodyContent))}
${scriptTags}
</body>
</html>`;
}

function css(strings, ...vals) {
  let r=''; strings.forEach((s,i)=>{r+=s; if(i<vals.length)r+=vals[i];}); return {css:r};
}
function html(strings, ...vals) {
  let r=''; strings.forEach((s,i)=>{r+=s; if(i<vals.length)r+=renderValue(vals[i]);}); return raw(r);
}
function qs(obj) {
  return Object.entries(obj||{}).filter(([,v])=>v!=null)
    .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}
function parseQs(str) {
  const r={};
  (str.startsWith('?')?str.slice(1):str).split('&').forEach(p=>{
    const eq=p.indexOf('='); if(eq<0) return;
    try{r[decodeURIComponent(p.slice(0,eq))]=decodeURIComponent(p.slice(eq+1));}catch{}
  }); return r;
}
function slugify(str) {
  return str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function truncate(str,len,suffix) {
  suffix=suffix===undefined?'...':suffix;
  return str.length<=len?str:str.slice(0,len-suffix.length)+suffix;
}
function wordCount(str){return str.trim().split(/\s+/).filter(Boolean).length;}
function readTime(str,wpm){return Math.ceil(wordCount(str)/(wpm||200));}
function excerpt(str,len){return truncate(str.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(),len||160);}
function markdown(str) {
  return str.replace(/^#{6}\s(.+)/gm,'<h6>$1</h6>').replace(/^#{5}\s(.+)/gm,'<h5>$1</h5>')
    .replace(/^#{4}\s(.+)/gm,'<h4>$1</h4>').replace(/^#{3}\s(.+)/gm,'<h3>$1</h3>')
    .replace(/^#{2}\s(.+)/gm,'<h2>$1</h2>').replace(/^#{1}\s(.+)/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2">$1</a>')
    .replace(/^---$/gm,'<hr>').replace(/^\> (.+)/gm,'<blockquote>$1</blockquote>')
    .replace(/^\- (.+)/gm,'<li>$1</li>').replace(/\n\n/g,'</p><p>');
}

// --- Scaffolds for ntl init ---
const SCAFFOLDS = {
  'components/Toast.js': `// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.
// Generated by NTL Compiler

'use strict';
const COLORS = {
  success: { bg:'#22c55e', text:'#fff', border:'#16a34a', icon:'✅' },
  error:   { bg:'#ef4444', text:'#fff', border:'#dc2626', icon:'❌' },
  warning: { bg:'#f59e0b', text:'#fff', border:'#d97706', icon:'⚠️' },
  info:    { bg:'#3b82f6', text:'#fff', border:'#2563eb', icon:'ℹ️' },
};
const POSITIONS = {
  'top-right':      'top:1rem;right:1rem',
  'top-left':       'top:1rem;left:1rem',
  'top-center':     'top:1rem;left:50%;transform:translateX(-50%)',
  'bottom-right':   'bottom:1rem;right:1rem',
  'bottom-left':    'bottom:1rem;left:1rem',
  'bottom-center':  'bottom:1rem;left:50%;transform:translateX(-50%)',
};

const STYLE = \`<style>
@keyframes ntl-toast-in  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes ntl-toast-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(12px)} }
.ntl-toast {
  position:fixed; z-index:9999; max-width:360px; min-width:200px;
  display:flex; align-items:center; gap:10px;
  padding:12px 18px; border-radius:10px; border-width:2px; border-style:solid;
  font-family:system-ui,sans-serif; font-size:14px; font-weight:500;
  box-shadow:0 4px 24px rgba(0,0,0,0.15); cursor:pointer;
  animation:ntl-toast-in 0.25s ease;
}
.ntl-toast.hiding { animation:ntl-toast-out 0.25s ease forwards; }
</style>\`;

let _injected = false;
function inject() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('div');
  s.innerHTML = STYLE;
  document.head.appendChild(s.firstChild);
}

function toast(message, opts) {
  inject();
  opts = opts || {};
  const type     = opts.type     || 'info';
  const duration = opts.duration !== undefined ? opts.duration : 3500;
  const position = opts.position || 'bottom-right';
  const colors   = COLORS[type] || COLORS.info;
  const pos      = POSITIONS[position] || POSITIONS['bottom-right'];

  const el = document.createElement('div');
  el.className = 'ntl-toast';
  el.style.cssText = \`
    \${pos};
    background:\${opts.bgColor    || colors.bg};
    color:\${opts.textColor  || colors.text};
    border-color:\${opts.borderColor || colors.border};
  \`;
  const icon = document.createElement('span');
  icon.textContent = colors.icon;
  const msg = document.createElement('span');
  msg.textContent = message;
  el.appendChild(icon);
  el.appendChild(msg);

  const close = () => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  el.onclick = close;
  document.body.appendChild(el);
  if (duration > 0) setTimeout(close, duration);
  return { close };
}

toast.success = (msg, opts) => toast(msg, Object.assign({ type:'success' }, opts));
toast.error   = (msg, opts) => toast(msg, Object.assign({ type:'error' },   opts));
toast.warning = (msg, opts) => toast(msg, Object.assign({ type:'warning' }, opts));
toast.info    = (msg, opts) => toast(msg, Object.assign({ type:'info' },    opts));

if (typeof module !== 'undefined') module.exports = toast;
if (typeof window !== 'undefined') window.NTLToast = toast;
`,

  'components/Button.js': `// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.
// Generated by NTL Compiler

'use strict';
const VARIANTS = {
  primary:   { bg:'#3b82f6', color:'#fff', border:'#3b82f6', hoverBg:'#2563eb' },
  secondary: { bg:'#6b7280', color:'#fff', border:'#6b7280', hoverBg:'#4b5563' },
  danger:    { bg:'#ef4444', color:'#fff', border:'#ef4444', hoverBg:'#dc2626' },
  success:   { bg:'#22c55e', color:'#fff', border:'#22c55e', hoverBg:'#16a34a' },
  ghost:     { bg:'transparent', color:'#3b82f6', border:'transparent', hoverBg:'#eff6ff' },
  outline:   { bg:'transparent', color:'#3b82f6', border:'#3b82f6', hoverBg:'#eff6ff' },
};
const SIZES = {
  xs: { padding:'4px 10px', fontSize:'11px', radius:'5px' },
  sm: { padding:'6px 14px', fontSize:'12px', radius:'6px' },
  md: { padding:'10px 20px', fontSize:'14px', radius:'8px' },
  lg: { padding:'14px 28px', fontSize:'16px', radius:'10px' },
  xl: { padding:'18px 36px', fontSize:'18px', radius:'12px' },
};

function Button(opts) {
  const v = VARIANTS[opts.variant || 'primary'] || VARIANTS.primary;
  const s = SIZES[opts.size || 'md']            || SIZES.md;
  const bg = opts.color ? opts.color : v.bg;

  const el = document.createElement('button');
  el.textContent = opts.label || 'Button';
  el.style.cssText = \`
    background:\${bg}; color:\${v.color}; border:2px solid \${opts.color||v.border};
    padding:\${s.padding}; font-size:\${s.fontSize}; border-radius:\${s.radius};
    font-weight:600; cursor:\${opts.disabled?'not-allowed':'pointer'};
    opacity:\${opts.disabled?0.55:1}; font-family:system-ui,sans-serif;
    transition:all 0.15s; outline:none; display:inline-flex; align-items:center; gap:6px;
  \`;
  if (opts.icon) {
    const span = document.createElement('span');
    span.textContent = opts.icon;
    el.prepend(span);
  }
  if (!opts.disabled) {
    el.onmouseover = () => { el.style.background = opts.color || v.hoverBg; };
    el.onmouseout  = () => { el.style.background = bg; };
    if (opts.onclick) el.onclick = opts.onclick;
  }
  el.disabled = !!opts.disabled;
  return el;
}

if (typeof module !== 'undefined') module.exports = Button;
if (typeof window !== 'undefined') window.NTLButton = Button;
`,

  'components/Card.js': `// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.
// Generated by NTL Compiler

'use strict';
function Card(opts) {
  const el = document.createElement('div');
  const border = opts.borderColor || '#e5e7eb';
  const accent = opts.color       || '#3b82f6';
  el.style.cssText = \`
    background:\${opts.bg||'#fff'}; border:1px solid \${border};
    border-top:4px solid \${accent}; border-radius:12px; overflow:hidden;
    box-shadow:\${opts.shadow!==false?'0 4px 20px rgba(0,0,0,0.08)':'none'};
    font-family:system-ui,sans-serif; transition:transform 0.2s,box-shadow 0.2s;
  \`;
  if (opts.image) {
    const img = document.createElement('img');
    img.src = opts.image; img.style.cssText = 'width:100%;height:180px;object-fit:cover';
    el.appendChild(img);
  }
  const body = document.createElement('div');
  body.style.padding = '20px';
  if (opts.title) {
    const h = document.createElement('h3');
    h.textContent = opts.title;
    h.style.cssText = 'margin:0 0 8px;color:#111;font-size:18px;font-weight:700';
    body.appendChild(h);
  }
  if (opts.description) {
    const p = document.createElement('p');
    p.textContent = opts.description;
    p.style.cssText = 'margin:0;color:#6b7280;line-height:1.6';
    body.appendChild(p);
  }
  if (opts.children) {
    if (Array.isArray(opts.children)) opts.children.forEach(c => body.appendChild(c));
    else body.appendChild(opts.children);
  }
  el.appendChild(body);
  if (opts.footer) {
    const f = document.createElement('div');
    f.textContent = opts.footer;
    f.style.cssText = \`padding:12px 20px;border-top:1px solid \${border};color:#9ca3af;font-size:13px\`;
    el.appendChild(f);
  }
  return el;
}
if (typeof module !== 'undefined') module.exports = Card;
if (typeof window !== 'undefined') window.NTLCard = Card;
`,

  'components/Modal.js': `// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.
// Generated by NTL Compiler

'use strict';
const STYLE = \`<style>
@keyframes ntl-modal-in { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
.ntl-modal-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.5);
  display:flex; align-items:center; justify-content:center; z-index:9000;
}
.ntl-modal {
  background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.25);
  max-width:90vw; max-height:90vh; overflow:auto;
  animation:ntl-modal-in 0.2s ease; font-family:system-ui,sans-serif;
}
.ntl-modal-header { padding:20px 24px 0; display:flex; justify-content:space-between; align-items:center; }
.ntl-modal-title  { margin:0; font-size:20px; font-weight:700; color:#111; }
.ntl-modal-close  { background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280; line-height:1; }
.ntl-modal-body   { padding:16px 24px 24px; color:#374151; line-height:1.6; }
.ntl-modal-footer { padding:0 24px 20px; display:flex; gap:8px; justify-content:flex-end; }
</style>\`;

let _injected = false;
function inject() {
  if (_injected || typeof document === 'undefined') return; _injected = true;
  const s = document.createElement('div'); s.innerHTML = STYLE;
  document.head.appendChild(s.firstChild);
}

function Modal(opts) {
  inject();
  opts = opts || {};
  const overlay = document.createElement('div');
  overlay.className = 'ntl-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'ntl-modal';
  modal.style.width = opts.width || '480px';

  const header = document.createElement('div');
  header.className = 'ntl-modal-header';
  const title = document.createElement('h2');
  title.className = 'ntl-modal-title';
  title.textContent = opts.title || '';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ntl-modal-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => close();
  header.appendChild(title); header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'ntl-modal-body';
  if (typeof opts.content === 'string') body.innerHTML = opts.content;
  else if (opts.content) body.appendChild(opts.content);

  const footer = document.createElement('div');
  footer.className = 'ntl-modal-footer';
  (opts.buttons || []).forEach(btn => {
    const b = document.createElement('button');
    b.textContent = btn.label || 'OK';
    b.style.cssText = \`padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-weight:600;
      background:\${btn.color||'#3b82f6'};color:#fff;font-size:14px;\`;
    b.onclick = () => { if (btn.onclick) btn.onclick(); if (btn.close !== false) close(); };
    footer.appendChild(b);
  });

  modal.appendChild(header); modal.appendChild(body); modal.appendChild(footer);
  overlay.appendChild(modal);
  if (opts.closeOnOverlay !== false) overlay.onclick = e => { if (e.target === overlay) close(); };
  document.body.appendChild(overlay);

  function close() {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.15s';
    setTimeout(() => { overlay.remove(); if (opts.onClose) opts.onClose(); }, 150);
  }
  if (opts.onOpen) opts.onOpen();
  return { close };
}

if (typeof module !== 'undefined') module.exports = Modal;
if (typeof window !== 'undefined') window.NTLModal = Modal;
`,
};

module.exports = {
  el, html, css, page, raw, escapeHtml, escapeAttr, attrs, tag,
  qs, parseQs, slugify, truncate, wordCount, readTime, excerpt, markdown,
  useState, useEffect, useRef, useMemo, useCallback,
  component, mount, renderToString, renderValue, isRaw, SCAFFOLDS
};
