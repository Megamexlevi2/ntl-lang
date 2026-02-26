'use strict';
const readline = require('readline');
const vm       = require('vm');
const path     = require('path');
const { Compiler, NTL_VERSION } = require('./src/compiler');
const { formatError, R } = require('./src/error');
async function start() {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: R.cyan('ntl') + R.gray(' › '),
    historySize: 200
  });
  console.log(`\n  ${R.bold(R.cyan('NTL'))} ${R.gray('Interactive REPL v' + NTL_VERSION)}`);
  console.log(R.gray('  Type .help for commands, .exit to quit\n'));
  const compiler = new Compiler({ target: 'node', typeCheck: false, strict: false, treeShake: false });
  const ctx = vm.createContext({
    console, require, process,
    __filename: 'repl.ntl',
    __dirname:  process.cwd(),
    setTimeout, setInterval, clearTimeout, clearInterval,
    Buffer, global, globalThis,
    Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, RegExp,
    Error, TypeError, RangeError
  });
  const history = [];
  let multiLine = '';
  let inBlock   = 0;
  rl.prompt();
  rl.on('line', async (rawLine) => {
    const line = rawLine.trim();
    if (line === '.exit' || line === '.quit' || line === 'exit' || line === 'quit') {
      console.log(R.gray('\n  Goodbye!\n'));
      rl.close();
      process.exit(0);
    }
    if (line === '.help') {
      console.log(`
  ${R.bold('.help')}     Show this help
  ${R.bold('.exit')}     Exit the REPL
  ${R.bold('.clear')}    Clear the screen
  ${R.bold('.history')}  Show command history
  ${R.bold('.reset')}    Reset the context
  ${R.gray('You can write multi-line code:')}
  ${R.gray('ntl › fn add(a, b) {')}
  ${R.gray('...  ›   return a + b')}
  ${R.gray('...  › }')}
`);
      rl.prompt(); return;
    }
    if (line === '.clear') { console.clear(); rl.prompt(); return; }
    if (line === '.history') { console.log(history.slice(-20).map((h, i) => `  ${R.gray(String(i+1))}  ${h}`).join('\n')); rl.prompt(); return; }
    if (line === '.reset') { console.log(R.gray('  Context reset')); rl.prompt(); return; }
    if (line === '') { rl.prompt(); return; }
    for (const ch of line) {
      if (ch === '{') inBlock++;
      if (ch === '}') inBlock--;
    }
    if (inBlock > 0) {
      multiLine += line + '\n';
      process.stdout.write(R.gray('...  › '));
      return;
    }
    const source = multiLine + line;
    multiLine = '';
    inBlock   = 0;
    if (source.trim()) history.push(source);
    try {
      const result = compiler.compileSource(source, 'repl.ntl');
      if (!result.success) {
        for (const err of result.errors) {
          process.stderr.write(formatError({ ntlError: true, phase: err.phase || 'compile', message: err.message, suggestion: err.suggestion, line: err.line, col: err.col }, source.split('\n')));
        }
        rl.prompt();
        return;
      }
      const evalResult = vm.runInContext(result.code, ctx, {
        filename: 'repl.ntl',
        timeout: 5000,
        displayErrors: false
      });
      const resolved = evalResult instanceof Promise ? await evalResult : evalResult;
      if (resolved !== undefined && resolved !== null) {
        const display = typeof resolved === 'object' ? JSON.stringify(resolved, null, 2) : String(resolved);
        console.log(R.green('← ') + R.yellow(display));
      }
    } catch (e) {
      process.stderr.write(formatError(e, source.split('\n')));
    }
    rl.prompt();
  });
  rl.on('close', () => {
    console.log(R.gray('\n  Goodbye!\n'));
    process.exit(0);
  });
}
module.exports = { start };
