(function(){
const Module = require('module');
const _path  = require('path');
const _fileDir = "/storage/emulated/0/ntl/examples/06_multi_file";
function _resolveNtlDir() {
  try { return _path.dirname(require.resolve('ntl-lang/package.json')); } catch(_) {}
  try {
    const _r = require('fs').realpathSync(process.argv[1] || '');
    const _m = _r.match(/^(.*?node_modules[\\/]ntl-lang)/);
    if (_m) return _m[1];
  } catch(_) {}
  return "/storage/emulated/0/ntl";
}
const _ntlDir = _resolveNtlDir();
const _origResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function(req, parent, isMain, opts) {
  if (req.startsWith('./') || req.startsWith('../')) {
    return _origResolve(_path.resolve(_fileDir, req), parent, isMain, opts);
  }
  if (req.startsWith('ntl:')) {
    try {
      const { resolveToPath } = require(_path.join(_ntlDir, 'src/runtime/resolver'));
      const p = resolveToPath(req);
      if (p) return p;
    } catch(_) {}
  }
  return _origResolve(req, parent, isMain, opts);
};
const _origLoad = Module._load.bind(Module);
Module._load = function(req, parent, isMain) {
  if (req.startsWith('ntl:')) {
    const { loadStdlibModule } = require(_path.join(_ntlDir, 'src/runtime/loader'));
    return loadStdlibModule(req.slice(4));
  }
  return _origLoad(req, parent, isMain);
};
})();
const math = (function() {
  const _ntl_mod_storage_emulated_0_ntl_examples_06_multi_file_math_ntl = (function() {
    const module = { exports: {} };
    const exports = module.exports;
    const __filename = "/storage/emulated/0/ntl/examples/06_multi_file/math.ntl";
    const __dirname  = "/storage/emulated/0/ntl/examples/06_multi_file";
    function add(a, b) {
      return a + b;
    }
    function subtract(a, b) {
      return a - b;
    }
    function multiply(a, b) {
      return a * b;
    }
    function divide(a, b) {
      if (!(b !== 0)) {
        return null;
      }
      return a / b;
    }
    function power(base, exp) {
      return Math.pow(base, exp);
    }
    function clamp(value, minVal, maxVal) {
      if (value < minVal) {
        return minVal;
      }
      if (value > maxVal) {
        return maxVal;
      }
      return value;
    }
    module.exports.add = add;
    module.exports.subtract = subtract;
    module.exports.multiply = multiply;
    module.exports.divide = divide;
    module.exports.power = power;
    module.exports.clamp = clamp;
    
    return module.exports;
  })();
  return _ntl_mod_storage_emulated_0_ntl_examples_06_multi_file_math_ntl;
})();
const strings = (function() {
  const _ntl_mod_storage_emulated_0_ntl_examples_06_multi_file_strings_ntl = (function() {
    const module = { exports: {} };
    const exports = module.exports;
    const __filename = "/storage/emulated/0/ntl/examples/06_multi_file/strings.ntl";
    const __dirname  = "/storage/emulated/0/ntl/examples/06_multi_file";
    function capitalize(str) {
      if (!(str.length > 0)) {
        return str;
      }
      return str[0].toUpperCase() + str.slice(1).toLowerCase();
    }
    function titleCase(str) {
      return str.split(" ").map(w => capitalize(w)).join(" ");
    }
    function truncate(str, maxLen, suffix) {
      const end = suffix || "...";
      if (!(str.length > maxLen)) {
        return str;
      }
      return str.slice(0, maxLen - end.length) + end;
    }
    function slugify(str) {
      return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    function countWords(str) {
      return str.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
    module.exports.capitalize = capitalize;
    module.exports.titleCase = titleCase;
    module.exports.truncate = truncate;
    module.exports.slugify = slugify;
    module.exports.countWords = countWords;
    
    return module.exports;
  })();
  return _ntl_mod_storage_emulated_0_ntl_examples_06_multi_file_strings_ntl;
})();
console.log("=== Math ===");
console.log("add(3, 4)          =", math.add(3, 4));
console.log("subtract(10, 3)    =", math.subtract(10, 3));
console.log("multiply(6, 7)     =", math.multiply(6, 7));
console.log("divide(15, 3)      =", math.divide(15, 3));
console.log("divide(5, 0)       =", math.divide(5, 0));
console.log("power(2, 10)       =", math.power(2, 10));
console.log("clamp(150, 0, 100) =", math.clamp(150, 0, 100));
console.log("");
console.log("=== Strings ===");
console.log(strings.capitalize("hello world"));
console.log(strings.titleCase("the quick brown fox"));
console.log(strings.truncate("This is a very long sentence that needs trimming", 25));
console.log(strings.slugify("Hello World! This is NTL 2026"));
console.log("Word count:", strings.countWords("The quick brown fox jumps over the lazy dog"));
