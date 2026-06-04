import fs from 'node:fs';
import path from 'node:path';

async function run() {
  const dir = 'src';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'server.js' && f !== 'main.js');
  for (const file of files) {
    try {
      await import('./src/' + file);
      console.log(`✅ ${file} loaded successfully`);
    } catch (e) {
      console.error(`❌ ${file} failed to load:`, e);
    }
  }
}
run();
