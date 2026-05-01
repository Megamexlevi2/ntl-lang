'use strict';

// src/jit/mod.js — JIT runtime public API

const { JITRunner }        = require('./JITRuntime');
const { HotPathDetector }  = require('./HotPathDetector');
const { Optimizer }        = require('./Optimizer');

module.exports = { JITRunner, HotPathDetector, Optimizer };
