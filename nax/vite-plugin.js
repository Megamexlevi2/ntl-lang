'use strict';
const path = require('path');
const { Compiler } = require('../src/compiler');
const { Bundler } = require('../src/bundler');

const compiler = new Compiler({ target: 'browser', treeShake: true });

function vitePluginNtl(options) {
  options = options || {};
  const { hmr = true, jsxRuntime = true } = options;

  return {
    name: 'vite-plugin-ntl',
    enforce: 'pre',

    resolveId(id, importer) {
      if (id.endsWith('.ntl')) {
        if (importer && !path.isAbsolute(id)) {
          return path.resolve(path.dirname(importer), id);
        }
        return id;
      }
      return null;
    },

    load(id) {
      if (!id.endsWith('.ntl')) return null;
      const fs = require('fs');
      if (!fs.existsSync(id)) return null;
      const source = fs.readFileSync(id, 'utf-8');
      const result = compiler.compileSource(source, id, { target: 'browser' });
      if (!result.success) {
        const msg = result.errors.map(e => e.message).join('\n');
        throw new Error(`NTL compile error in ${id}:\n${msg}`);
      }
      let code = result.code;
      if (hmr) {
        code += `\nif (import.meta.hot) { import.meta.hot.accept(); }`;
      }
      return { code, map: null };
    },

    transform(code, id) {
      if (!id.endsWith('.ntl')) return null;
      const result = compiler.compileSource(code, id, { target: 'browser' });
      if (!result.success) {
        const msg = result.errors.map(e => e.message).join('\n');
        throw new Error(`NTL compile error in ${id}:\n${msg}`);
      }
      let out = result.code;
      if (hmr) {
        out += `\nif (import.meta.hot) { import.meta.hot.accept(); }`;
      }
      return { code: out, map: null };
    },

    handleHotUpdate({ file, server }) {
      if (file.endsWith('.ntl')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },

    config() {
      return {
        resolve: {
          extensions: ['.ntl', '.js', '.ts', '.jsx', '.tsx', '.json'],
        },
      };
    },
  };
}

function vitePluginNtlWeb(options) {
  return vitePluginNtl(Object.assign({ hmr: true, jsxRuntime: true }, options));
}

module.exports = { vitePluginNtl, vitePluginNtlWeb, default: vitePluginNtlWeb };
