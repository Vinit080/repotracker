import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BUILD_TMP = path.join(ROOT, '.build-tmp');

async function build() {
  console.log('📦 Cleaning dist folder...');
  await fs.rm(DIST, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(DIST, { recursive: true });

  console.log('📦 Cleaning temporary build folder...');
  await fs.rm(BUILD_TMP, { recursive: true, force: true }).catch(() => {});
  
  // We don't want to bundle .git or large devDependencies, but caxa doesn't prune well.
  // We'll just let caxa bundle the whole directory excluding .git.
  
  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';
  const outPath = path.join(DIST, `RepoTracker${ext}`);

  console.log('\n🔨 Compiling with caxa...');
  try {
    // Exclude .git and .build-tmp
    const cmd = `npx caxa --input . --exclude ".git" ".build-tmp" "dist" --output "${outPath}" -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/src/server.js"`;
    console.log('Running:', cmd);
    execSync(cmd, {
      cwd: ROOT,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('❌ caxa failed', err);
    process.exit(1);
  }

  console.log(`\n✅ Build complete! Executable is at ${outPath}`);
  console.log('Because caxa zips the native modules (like node-pty) into the executable automatically, you do not need to distribute the prebuilds folder separately!');
}

build();
