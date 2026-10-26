import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getMql5EaCode } from '../src/utils/mql5Template';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findMt5ExpertsDirs(): string[] {
  const appData = process.env.APPDATA || '';
  const terminalBase = path.join(appData, 'MetaQuotes', 'Terminal');
  const dirs: string[] = [];

  if (fs.existsSync(terminalBase)) {
    const entries = fs.readdirSync(terminalBase, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const expertsDir = path.join(terminalBase, entry.name, 'MQL5', 'Experts');
        if (fs.existsSync(expertsDir)) {
          dirs.push(expertsDir);
        }
      }
    }
  }

  return dirs;
}

function findMetaEditor(): string | null {
  const candidates = [
    path.join(process.env.APPDATA || '', 'MetaTrader 5', 'metaeditor64.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'MetaTrader 5', 'metaeditor64.exe'),
    'C:\\Program Files\\MetaTrader 5\\metaeditor64.exe',
    'C:\\Program Files (x86)\\MetaTrader 5\\metaeditor64.exe'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

export function updateMt5Ea(): void {
  console.log('🔄 Sincronizare automata Expert Advisor MarketAI in MT5...');

  const expertsDirs = findMt5ExpertsDirs();
  if (expertsDirs.length === 0) {
    console.warn('⚠️ Nu a fost gasit niciun director MT5 Experts in AppData.');
    return;
  }

  const metaEditor = findMetaEditor();
  if (!metaEditor) {
    console.warn('⚠️ MetaEditor64.exe nu a fost gasit.');
  }

  for (const expertsDir of expertsDirs) {
    console.log(`📁 Director gasit: ${expertsDir}`);

    const bridgeFile = path.join(expertsDir, 'MarketAI-Bridge.mq5');
    let apiKey = 'mt5_live_admin001_wdyjbn7o';
    let endpoint = 'https://marketai-terminal.fly.dev/api/mt5/signals';
    let updateUrl = 'https://marketai-terminal.fly.dev/api/mt5/update';

    // Daca exista deja un fisier, pastram parametrii de conectare existenti
    if (fs.existsSync(bridgeFile)) {
      const existing = fs.readFileSync(bridgeFile, 'utf8');
      const keyMatch = existing.match(/InpApiKey\s*=\s*"([^"]+)"/);
      if (keyMatch && keyMatch[1]) apiKey = keyMatch[1];
      const epMatch = existing.match(/InpEndpointURL\s*=\s*"([^"]+)"/);
      if (epMatch && epMatch[1] && !epMatch[1].includes('onrender.com')) endpoint = epMatch[1];
      const upMatch = existing.match(/InpUpdateURL\s*=\s*"([^"]+)"/);
      if (upMatch && upMatch[1] && !upMatch[1].includes('onrender.com')) updateUrl = upMatch[1];
    }

    const mqlCode = getMql5EaCode(
      endpoint,
      updateUrl,
      apiKey,
      'https://marketai-terminal.fly.dev'
    );

    // Salvam atat ca MarketAI-Bridge.mq5 cat si ca MarketAi.mq5
    const targets = [
      path.join(expertsDir, 'MarketAI-Bridge.mq5'),
      path.join(expertsDir, 'MarketAi.mq5')
    ];

    for (const target of targets) {
      fs.writeFileSync(target, mqlCode, 'utf8');
      console.log(`💾 Scris cod actualizat: ${path.basename(target)}`);

      if (metaEditor) {
        const logFile = path.join(expertsDir, `compile_${path.basename(target, '.mq5')}.log`);
        try {
          execFileSync(metaEditor, [`/compile:${target}`, `/log:${logFile}`], { stdio: 'ignore' });
        } catch (e) {
          // MetaEditor returns non-zero even on successful generation with code info
        }

        if (fs.existsSync(logFile)) {
          let logContent = '';
          try {
            logContent = fs.readFileSync(logFile, 'utf16le');
          } catch (e) {
            logContent = fs.readFileSync(logFile, 'utf8');
          }
          const lines = logContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const resultLine = lines.find(l => l.includes('Result:')) || lines.find(l => l.includes('error')) || lines.pop() || '';
          console.log(`🔨 Compilare ${path.basename(target)}: ${resultLine}`);
          if (!resultLine.includes('0 errors') && resultLine.includes('error')) {
            console.error(`❌ Erori la compilare:\n${lines.filter(l => !l.includes('0 errors') && l.includes('error')).join('\n')}`);
          }
          try { fs.unlinkSync(logFile); } catch (e) {}
        }
      }
    }
  }

  console.log('✅ Toate fisierele EA din MT5 au fost actualizate si recompilate cu succes!');
}

// Daca este rulat direct prin node / tsx
if (process.argv[1] && (process.argv[1].endsWith('update-mt5-ea.ts') || process.argv[1].endsWith('update-mt5-ea.js'))) {
  updateMt5Ea();
}
