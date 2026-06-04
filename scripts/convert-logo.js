import fs from 'fs';
import svg2img from 'svg2img';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '../public/logo.svg');
const pngPath = path.join(__dirname, '../public/logo.png');

svg2img(svgPath, { width: 512, height: 512 }, function(error, buffer) {
    if (error) {
        console.error(error);
        process.exit(1);
    }
    fs.writeFileSync(pngPath, buffer);
    console.log('Successfully generated logo.png');
});
