// Copies the web app into www/ for the Android (Capacitor) build and GitHub Pages.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const entries = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const e of entries) fs.cpSync(path.join(root, e), path.join(out, e), { recursive: true });
console.log('Web assets copied to www/');
