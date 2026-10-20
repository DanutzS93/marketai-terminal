/**
 * Script de Restabilire Rapidă pentru MarketAI — Versiunea 1
 * Rulare: node restore_to_v1.cjs
 */
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const snapshotDir = path.join(rootDir, '.restore_points', 'v1_stable_baseline');

if (!fs.existsSync(snapshotDir)) {
  console.error('❌ Directorul restore point nu a fost găsit la:', snapshotDir);
  process.exit(1);
}

function copyDirRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of entries) {
    if (entry.name === 'restore_metadata.json') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🔄 Se restabilește MarketAI la Versiunea 1 (Baseline Stabil)...');
copyDirRecursive(snapshotDir, rootDir);
console.log('✅ Proiectul a fost restabilit cu succes la Versiunea 1!');
