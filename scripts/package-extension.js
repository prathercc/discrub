import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = process.argv[2];

if (!browser || !['chrome', 'firefox'].includes(browser)) {
  console.error('Usage: node package-extension.js [chrome|firefox]');
  process.exit(1);
}

const sourceDir = browser === 'firefox'
  ? 'dist-extension-firefox'
  : 'dist-extension-chrome';

const outputFile = `discrub-${browser}.zip`;

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error(`Error: ${sourceDir} does not exist. Run build:extension:${browser} first.`);
  process.exit(1);
}

const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✓ ${outputFile} created (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
  throw err;
});

console.log(`Packaging ${browser} extension...`);

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
