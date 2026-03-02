'use strict';

const NTL_WEB_VERSION = '1.0.0';

class NaxRuntime {
  constructor() {
    this._components = new Map();
    this._effects = [];
    this._state = new Map();
    this._mountPoints = new Map();
  }

  component(name, fn) {
    fn._isNTLComponent = true;
    fn._name = name;
    this._components.set(name, fn);
    return fn;
  }

  mount(selector, ComponentFn, props) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) throw new Error(`NTL: mount target not found: ${selector}`);

    props = props || {};
    const instance = this._createInstance(ComponentFn, props, el);
    this._mountPoints.set(el, instance);
    return instance;
  }

  _createInstance(ComponentFn, props, container) {
    let vdom = null;
    let isMounted = false;

    const stateStore = {};
    let stateId = 0;
    const states = [];

    const useState = (initial) => {
      const id = stateId++;
      if (!(id in states)) states[id] = { value: initial };
      const setState = (newVal) => {
        states[id].value = typeof newVal === 'function' ? newVal(states[id].value) : newVal;
        rerender();
      };
      return [states[id].value, setState];
    };

    const useEffect = (fn, deps) => {
      this._effects.push({ fn, deps, ran: false });
    };

    const ntlCtx = { useState, useEffect };
    const result = ComponentFn(props, ntlCtx);

    const rerender = () => {
      const newResult = ComponentFn(props, ntlCtx);
      const newDom = this._render(newResult);
      if (container.firstChild) {
        container.replaceChild(newDom, container.firstChild);
      } else {
        container.appendChild(newDom);
      }
    };

    const dom = this._render(result);
    container.appendChild(dom);
    isMounted = true;

    return { rerender, container, props };
  }

  _render(vnode) {
    if (vnode === null || vnode === undefined) return document.createTextNode('');
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode));
    }
    if (Array.isArray(vnode)) {
      const frag = document.createDocumentFragment();
      for (const child of vnode) frag.appendChild(this._render(child));
      return frag;
    }
    if (typeof vnode === 'function') {
      return this._render(vnode());
    }
    if (vnode.tag) {
      const el = document.createElement(vnode.tag);
      if (vnode.props) {
        for (const [k, v] of Object.entries(vnode.props)) {
          if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.slice(2).toLowerCase(), v);
          } else if (k === 'className') {
            el.className = v;
          } else if (k === 'style' && typeof v === 'object') {
            Object.assign(el.style, v);
          } else {
            el.setAttribute(k, v);
          }
        }
      }
      if (vnode.children) {
        for (const child of (Array.isArray(vnode.children) ? vnode.children : [vnode.children])) {
          el.appendChild(this._render(child));
        }
      }
      return el;
    }
    return document.createTextNode(String(vnode));
  }

  h(tag, props, ...children) {
    return { tag, props: props || {}, children: children.flat() };
  }

  text(str) { return String(str); }

  router(routes) {
    const getRoute = () => {
      const hash = window.location.hash.slice(1) || '/';
      return routes[hash] || routes['*'] || routes['/'] || null;
    };

    const container = document.createElement('div');
    container.id = '_ntl_router';

    const render = () => {
      const route = getRoute();
      container.innerHTML = '';
      if (route) {
        const dom = this._render(typeof route === 'function' ? route() : route);
        container.appendChild(dom);
      }
    };

    window.addEventListener('hashchange', render);
    render();
    return container;
  }

  navigate(path) {
    window.location.hash = path;
  }

  store(initial) {
    let state = Object.assign({}, initial);
    const listeners = new Set();
    return {
      get: () => ({ ...state }),
      set: (partial) => {
        state = Object.assign({}, state, partial);
        listeners.forEach(fn => fn(state));
      },
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    };
  }
}

const naxWeb = new NaxRuntime();

if (typeof window !== 'undefined') {
  window.nax = naxWeb;
  window.NaxRuntime = NaxRuntime;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { naxWeb, NaxRuntime, NTL_WEB_VERSION };
}
