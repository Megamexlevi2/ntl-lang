'use strict';

// src/pipeline/mod.js — compiler pipeline public API
// Each stage exports a single class or function.

const { tokenize, TokenType } = require('./lexer');
const { parse }               = require('./parser');
const { CodeGen, generate }   = require('./codegen/index');
const { ScopeAnalyzer }       = require('./scope');
const { TypeInferer }         = require('./typeinfer');
const { TreeShaker }          = require('./treeshaker');

module.exports = { tokenize, TokenType, parse, CodeGen, generate, ScopeAnalyzer, TypeInferer, TreeShaker };
