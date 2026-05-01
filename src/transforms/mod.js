'use strict';

// src/transforms/mod.js — source transforms public API

const { format }          = require('./formatter');
const { transformJSX, hasJSX } = require('./jsx');

module.exports = { format, transformJSX, hasJSX };
