import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const FIREFOX_DIR = path.join(rootDir, 'store', 'firefox');
const BUNDLE_NAME = 'discrub-firefox-source.zip';
const BUNDLE_PATH = path.join(FIREFOX_DIR, BUNDLE_NAME);

// Allowlist of paths included in the source bundle.
// Reviewer-facing: the smallest tree that reproduces the Firefox extension build.
const INCLUDE = [
  'src',
  'public',
  'scripts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vite.config.extension.ts',
  'index.html',
  '.env.example',
  'ONBOARDING.md',
];

const BUILD_MD = `# Building Discrub for Firefox

This source bundle reproduces the Firefox extension package uploaded to AMO.

## Prerequisites

- Node.js 18.x or newer
- npm 10.x or newer

## Steps

1. Extract this ZIP to a working directory.
2. From the extracted directory, run:
   \`\`\`
   npm install --legacy-peer-deps
   \`\`\`
3. Build the Firefox extension:
   \`\`\`
   npm run build:extension:firefox
   \`\`\`
4. Package the build:
   \`\`\`
   npm run package:firefox
   \`\`\`
5. The output ZIP is at \`discrub-firefox.zip\` in the project root.

This output should match (or closely match) the extension package uploaded
to AMO. Minor metadata differences in the ZIP wrapper are expected, but
file contents should be identical.

## Notes

- The \`--legacy-peer-deps\` flag is required because date-fns v2 conflicts
  with @mui/x-date-pickers' peer dep declaration. This does not affect
  runtime behavior.
- Library dependencies (\`drip-fs\`, \`discrub-core\`) resolve from the npm
  registry. No sibling repos or local linking is required.
- The build strips any \`VITE_DISCORD_TOKEN\` from \`.env\` via Vite's
  \`define\` configuration in \`vite.config.extension.ts\`. Extension builds
  will never contain a Discord token even if one is present in a local
  \`.env\` file.
- No environment variables are required to build. The \`.env.example\` file
  documents the optional \`VITE_DISCORD_TOKEN\` used only during local
  development.
`;

function copyEntry(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('Building Firefox source bundle...');

fs.mkdirSync(FIREFOX_DIR, { recursive: true });

if (fs.existsSync(BUNDLE_PATH)) {
  fs.rmSync(BUNDLE_PATH);
}

// Stage the bundle contents in a temp directory before zipping
const stageDir = path.join(rootDir, '.source-bundle-stage');
if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

let copiedCount = 0;
for (const entry of INCLUDE) {
  const src = path.join(rootDir, entry);
  if (!fs.existsSync(src)) {
    console.warn(`  WARN: skipping missing entry "${entry}"`);
    continue;
  }
  copyEntry(src, path.join(stageDir, entry));
  copiedCount++;
}

// Reviewer-facing BUILD.md authored at the bundle root
fs.writeFileSync(path.join(stageDir, 'BUILD.md'), BUILD_MD);

console.log(`  Staged ${copiedCount} entries + BUILD.md`);

execSync(`cd "${stageDir}" && zip -qr "${BUNDLE_PATH}" .`, { stdio: 'inherit' });

fs.rmSync(stageDir, { recursive: true, force: true });

const sizeKB = Math.round(fs.statSync(BUNDLE_PATH).size / 1024);
console.log(`\nSource bundle ready:`);
console.log(`  ${BUNDLE_PATH} (${sizeKB} KB)`);
