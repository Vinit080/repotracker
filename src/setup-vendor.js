import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, '..', 'public', 'vendor');

async function copyVendor() {
  try {
    await fs.mkdir(dest, { recursive: true });
    await fs.cp(path.join(__dirname, '..', 'node_modules', 'xterm'), path.join(dest, 'xterm'), { recursive: true, force: true });
    await fs.cp(path.join(__dirname, '..', 'node_modules', 'xterm-addon-fit'), path.join(dest, 'xterm-addon-fit'), { recursive: true, force: true });
    console.log('✅ Vendor files successfully copied to public/vendor');
  } catch (err) {
    console.error('❌ Failed to copy vendor files:', err);
    process.exit(1);
  }
}

copyVendor();
