// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// (c) David Dev 2026. All rights reserved.
'use strict';

const TARGETS = {
  'linux-x64':        { os: 'linux',   arch: 'x64',    triple: 'x86_64-linux-gnu',         ext: '' },
  'linux-arm64':      { os: 'linux',   arch: 'arm64',  triple: 'aarch64-linux-gnu',         ext: '' },
  'linux-arm32':      { os: 'linux',   arch: 'arm',    triple: 'arm-linux-gnueabihf',       ext: '' },
  'linux-riscv64':    { os: 'linux',   arch: 'riscv64',triple: 'riscv64-linux-gnu',         ext: '' },
  'linux-ppc64':      { os: 'linux',   arch: 'ppc64',  triple: 'powerpc64le-linux-gnu',     ext: '' },
  'linux-s390x':      { os: 'linux',   arch: 's390x',  triple: 's390x-linux-gnu',           ext: '' },
  'linux-mips64':     { os: 'linux',   arch: 'mips64', triple: 'mips64el-linux-gnuabi64',   ext: '' },
  'linux-x86':        { os: 'linux',   arch: 'ia32',   triple: 'i686-linux-gnu',            ext: '' },
  'android-arm64':    { os: 'android', arch: 'arm64',  triple: 'aarch64-linux-android',     ext: '' },
  'android-arm32':    { os: 'android', arch: 'arm',    triple: 'arm-linux-androideabi',     ext: '' },
  'android-x64':      { os: 'android', arch: 'x64',    triple: 'x86_64-linux-android',      ext: '' },
  'android-x86':      { os: 'android', arch: 'ia32',   triple: 'i686-linux-android',        ext: '' },
  'windows-x64':      { os: 'win',     arch: 'x64',    triple: 'x86_64-windows-gnu',        ext: '.exe' },
  'windows-arm64':    { os: 'win',     arch: 'arm64',  triple: 'aarch64-windows-gnu',       ext: '.exe' },
  'windows-x86':      { os: 'win',     arch: 'ia32',   triple: 'i686-windows-gnu',          ext: '.exe' },
  'wasm32':           { os: 'wasm',    arch: 'wasm32', triple: 'wasm32',                    ext: '.wasm' },
  'wasm64':           { os: 'wasm',    arch: 'wasm64', triple: 'wasm64',                    ext: '.wasm' },
};

const TARGET_ALIASES = {
  linux: 'linux-x64', android: 'android-arm64', windows: 'windows-x64',
  win:   'windows-x64', win64: 'windows-x64', win32: 'windows-x86',
  wasm:  'wasm32', arm64: 'linux-arm64', arm: 'linux-arm32', x64: 'linux-x64',
};

function resolveTarget(name) {
  return TARGETS[name] || TARGETS[TARGET_ALIASES[name]] || null;
}

function listTargets() { return Object.keys(TARGETS); }

module.exports = { TARGETS, TARGET_ALIASES, resolveTarget, listTargets };
