'use strict';
const { execSync, exec, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const IS_TERMUX = fs.existsSync('/data/data/com.termux');
const TERMUX_PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';

function shell(cmd, opts) {
  opts = opts || {};
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
}

function shellAsync(cmd, opts) {
  return new Promise((resolve, reject) => {
    exec(cmd, { encoding: 'utf-8', ...(opts || {}) }, (err, stdout, stderr) => {
      if (err && !opts?.ignoreError) reject(err);
      else resolve({ stdout: (stdout||'').trim(), stderr: (stderr||'').trim() });
    });
  });
}

function isTermux() { return IS_TERMUX; }

function pkgInstall(pkg) {
  if (!IS_TERMUX) throw new Error('pkgInstall only available on Termux');
  return shellAsync(`pkg install -y ${pkg}`);
}

function pkgUpdate() {
  if (!IS_TERMUX) throw new Error('pkgUpdate only available on Termux');
  return shellAsync('pkg update -y');
}

function vibrate(duration) {
  if (!IS_TERMUX) return;
  try { shellAsync(`termux-vibrate -d ${duration || 50}`); } catch (_) {}
}

function notification(title, content) {
  if (!IS_TERMUX) return;
  return shellAsync(`termux-notification --title "${title}" --content "${content}"`);
}

function getBatteryInfo() {
  if (!IS_TERMUX) return null;
  try {
    const raw = shell('termux-battery-status');
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function getWifiInfo() {
  if (!IS_TERMUX) return null;
  try {
    const raw = shell('termux-wifi-connectioninfo');
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function getCameraInfo() {
  if (!IS_TERMUX) return null;
  try {
    const raw = shell('termux-camera-info');
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function capturePhoto(output) {
  if (!IS_TERMUX) throw new Error('capturePhoto only available on Termux');
  const outPath = output || path.join(os.tmpdir(), `ntl_photo_${Date.now()}.jpg`);
  return shellAsync(`termux-camera-photo -c 0 ${outPath}`).then(() => outPath);
}

function getLocation() {
  if (!IS_TERMUX) return null;
  try {
    const raw = shell('termux-location');
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function speak(text, lang) {
  if (!IS_TERMUX) return;
  return shellAsync(`termux-tts-speak -l ${lang || 'en'} "${text.replace(/"/g, '\\"')}"`);
}

function clipboard(text) {
  if (!IS_TERMUX) {
    return { get: () => '', set: (t) => {} };
  }
  if (text !== undefined) {
    return shellAsync(`termux-clipboard-set "${text.replace(/"/g, '\\"')}"`);
  }
  return shell('termux-clipboard-get');
}

function listContacts() {
  if (!IS_TERMUX) return [];
  try {
    const raw = shell('termux-contact-list');
    return JSON.parse(raw);
  } catch (_) { return []; }
}

function sms(number, message) {
  if (!IS_TERMUX) throw new Error('sms only available on Termux');
  return shellAsync(`termux-sms-send -n "${number}" "${message.replace(/"/g, '\\"')}"`);
}

function termuxInfo() {
  return {
    isTermux: IS_TERMUX,
    prefix: TERMUX_PREFIX,
    home: os.homedir(),
    arch: os.arch(),
    platform: os.platform(),
    cpus: os.cpus().length,
    memory: os.totalmem(),
    freeMem: os.freemem(),
    nodeVersion: process.version,
  };
}

module.exports = {
  isTermux, shell, shellAsync,
  pkgInstall, pkgUpdate,
  vibrate, notification,
  getBatteryInfo, getWifiInfo, getCameraInfo, capturePhoto,
  getLocation, speak, clipboard, listContacts, sms,
  termuxInfo,
};
