'use strict';
class TreeShaker {
  analyze(ast) {
    const used = new Set();
    this._visit(ast, used);
    return used;
  }
  _visit(node, used) {
    if (!node) return;
    switch (node.type) {
      case 'Program':
      case 'Block':
        for (const s of (node.body || [])) this._visit(s, used);
        break;
      case 'FnDecl': case 'FnExpr': case 'ArrowFn':
        for (const p of (node.params || [])) if (p.defaultVal) this._visit(p.defaultVal, used);
        this._visit(node.body, used);
        if (node.isAsync) used.add('__asyncHelpers');
        break;
      case 'ClassDecl':
        for (const m of (node.members || [])) {
          if (m.kind === 'method' && m.body) this._visit(m.body, used);
        }
        break;
      case 'VarDecl': this._visit(node.init, used); break;
      case 'ExprStmt': case 'ReturnStmt': case 'ThrowStmt': this._visit(node.expr || node.value, used); break;
      case 'IfStmt': case 'UnlessStmt':
        this._visit(node.test, used);
        this._visit(node.consequent, used);
        this._visit(node.alternate, used);
        break;
      case 'WhileStmt': case 'DoWhileStmt': this._visit(node.test, used); this._visit(node.body, used); break;
      case 'ForOfStmt': case 'ForInStmt': this._visit(node.iterable, used); this._visit(node.body, used); break;
      case 'TryStmt':
        this._visit(node.block, used);
        this._visit(node.catchBlock, used);
        this._visit(node.finallyBlock, used);
        break;
      case 'MatchStmt':
        this._visit(node.subject, used);
        for (const c of (node.cases || [])) this._visit(c.body, used);
        break;
      case 'CallExpr':
        this._visit(node.callee, used);
        for (const a of (node.args || [])) this._visit(a, used);
        break;
      case 'MemberExpr': this._visit(node.object, used); break;
      case 'BinaryExpr': case 'AssignExpr': this._visit(node.left, used); this._visit(node.right, used); break;
      case 'UnaryExpr': case 'AwaitExpr': case 'YieldExpr': this._visit(node.arg, used); break;
      case 'TernaryExpr': this._visit(node.test, used); this._visit(node.consequent, used); this._visit(node.alternate, used); break;
      case 'ArrayLit': for (const e of (node.elements || [])) if (e) this._visit(e, used); break;
      case 'ObjectLit': for (const p of (node.props || [])) if (p.value) this._visit(p.value, used); break;
      case 'SpawnStmt': this._visit(node.expr, used); break;
      case 'PipelineExpr': this._visit(node.left, used); this._visit(node.right, used); break;
      default: break;
    }
  }
  generateRuntime(used) {
    return '';
  }
}
module.exports = { TreeShaker };
