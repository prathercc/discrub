import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CHROME_DIR = path.join(rootDir, 'store', 'chrome');
const FIREFOX_DIR = path.join(rootDir, 'store', 'firefox');
const CHROME_DESCRIPTION_PATH = path.join(rootDir, 'store', 'STORE_DESCRIPTION_CHROME.md');
const FIREFOX_DESCRIPTION_PATH = path.join(rootDir, 'store', 'STORE_DESCRIPTION_FIREFOX.md');
// Read from Cypress screenshot output (not docs/screenshots which is for README)
const SCREENSHOTS_SRC = path.join(rootDir, 'cypress', 'screenshots', 'feature-showcase.cy.ts', 'demo');

// Best 5 screenshots for store listings
const STORE_SCREENSHOTS = [
  { src: 'messages/message-table.png', name: '1-message-table.png' },
  { src: 'export/export-dialog.png', name: '2-export-dialog.png' },
  { src: 'messages/search-filters.png', name: '3-search-filters.png' },
  { src: 'purge/purge-dialog.png', name: '4-purge-dialog.png' },
  { src: 'settings/settings-dialog.png', name: '5-settings.png' },
];

// Chrome requires 1280x800, Firefox accepts any size
const CHROME_WIDTH = 1280;
const CHROME_HEIGHT = 800;

function ensureDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
}

function resizeImage(src, dest, width, height) {
  // Use macOS sips for zero-dependency resizing
  try {
    fs.copyFileSync(src, dest);
    execSync(`sips --resampleHeightWidth ${height} ${width} "${dest}"`, { stdio: 'pipe' });
  } catch (e) {
    // Fallback: just copy without resize
    console.warn(`  Warning: Could not resize ${path.basename(src)}, copied as-is`);
    fs.copyFileSync(src, dest);
  }
}

console.log('Preparing store release assets...\n');

// Check prerequisites
if (!fs.existsSync(SCREENSHOTS_SRC)) {
  console.error('No screenshots found. The Cypress demo spec should have run before this script.');
  process.exit(1);
}

const chromeZip = path.join(rootDir, 'discrub-chrome.zip');
const firefoxZip = path.join(rootDir, 'discrub-firefox.zip');

if (!fs.existsSync(chromeZip) || !fs.existsSync(firefoxZip)) {
  console.error('Extension packages not found. Run first: npm run package:extension');
  process.exit(1);
}

// Setup directories
ensureDir(path.join(CHROME_DIR, 'screenshots'));
ensureDir(path.join(FIREFOX_DIR, 'screenshots'));

// Copy & resize screenshots for Chrome (1280x800)
console.log('Chrome screenshots (1280x800):');
for (const shot of STORE_SCREENSHOTS) {
  const src = path.join(SCREENSHOTS_SRC, shot.src);
  const dest = path.join(CHROME_DIR, 'screenshots', shot.name);
  if (fs.existsSync(src)) {
    resizeImage(src, dest, CHROME_WIDTH, CHROME_HEIGHT);
    console.log('  ' + shot.name);
  } else {
    console.warn('  Missing: ' + shot.src);
  }
}

// Copy screenshots for Firefox (original size is fine)
console.log('\nFirefox screenshots (original size):');
for (const shot of STORE_SCREENSHOTS) {
  const src = path.join(SCREENSHOTS_SRC, shot.src);
  const dest = path.join(FIREFOX_DIR, 'screenshots', shot.name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('  ' + shot.name);
  } else {
    console.warn('  Missing: ' + shot.src);
  }
}

// Move ZIP packages into store directories (remove root copies)
fs.copyFileSync(chromeZip, path.join(CHROME_DIR, 'discrub-chrome.zip'));
fs.copyFileSync(firefoxZip, path.join(FIREFOX_DIR, 'discrub-firefox.zip'));
fs.rmSync(chromeZip);
fs.rmSync(firefoxZip);
console.log('\nPackages moved to:');
console.log('  store/chrome/discrub-chrome.zip');
console.log('  store/firefox/discrub-firefox.zip');

// Read store descriptions from tracked source files
function readDescription(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${label} description at ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8').trim();
}

const chromeDescription = readDescription(CHROME_DESCRIPTION_PATH, 'Chrome');
const firefoxDescription = readDescription(FIREFOX_DESCRIPTION_PATH, 'Firefox');

// Write README for each store
const chromeReadme = `# Chrome Web Store Release

## Upload Package

1. Go to https://chrome.google.com/webstore/devconsole
2. Find the existing "Discrub" listing
3. Click "Package" tab then "Upload new package"
4. Select: \`discrub-chrome.zip\`

## Store Listing

### Name
\`\`\`
Discrub - Discord Message Manager
\`\`\`

### Short Description (132 chars max)
\`\`\`
Export, search, purge, and manage your Discord messages. Browse offline data packages, remove reactions, and analyze history.
\`\`\`

### Detailed Description
\`\`\`
${chromeDescription}
\`\`\`

### Category
\`\`\`
Productivity
\`\`\`

## Screenshots

Upload these 5 images from the \`screenshots/\` folder (resized to 1280x800):

1. \`1-message-table.png\` — Message view with toolbar
2. \`2-export-dialog.png\` — Export dialog with format options and presets
3. \`3-search-filters.png\` — Filter modal with search and refine options
4. \`4-purge-dialog.png\` — Purge dialog with user targeting
5. \`5-settings.png\` — Settings dialog with delay sliders

## Permission Justifications (if prompted)

| Permission | Justification |
|-----------|---------------|
| storage | Persisting user settings and preferences |
| host_permissions (discord.com) | Making Discord API calls and injecting UI on Discord |

## Submit

Click "Submit for review". Reviews typically take 1-3 business days.
`;

const firefoxReadme = `# Firefox Add-on Store Release

## Upload Package

1. Go to https://addons.mozilla.org/developers/
2. Find the existing "Discrub" listing (or "Submit a New Add-on")
3. Upload: \`discrub-firefox.zip\`
4. When prompted for source code, upload \`discrub-firefox-source.zip\` from this folder. It contains a minimal allowlisted source tree plus a \`BUILD.md\` reviewers can follow to reproduce the extension package.

## Listing Details

### Name
\`\`\`
Discrub - Discord Message Manager
\`\`\`

### Summary
\`\`\`
Export, search, purge, and manage your Discord messages. Browse offline data packages, remove reactions, and analyze history.
\`\`\`

### Description
\`\`\`
${firefoxDescription}
\`\`\`

### Category
\`\`\`
Privacy & Security
\`\`\`

### Tags
\`\`\`
discord, export, backup, messages, purge
\`\`\`

## Screenshots

Upload these 5 images from the \`screenshots/\` folder:

1. \`1-message-table.png\` — Message view with toolbar
2. \`2-export-dialog.png\` — Export dialog with format options and presets
3. \`3-search-filters.png\` — Filter modal with search and refine options
4. \`4-purge-dialog.png\` — Purge dialog with user targeting
5. \`5-settings.png\` — Settings dialog with delay sliders

## Submit

Click "Submit for review". Firefox reviews typically take 1-5 business days.
`;

fs.writeFileSync(path.join(CHROME_DIR, 'README.md'), chromeReadme);
fs.writeFileSync(path.join(FIREFOX_DIR, 'README.md'), firefoxReadme);

console.log('\nREADMEs generated:');
console.log('  store/chrome/README.md');
console.log('  store/firefox/README.md');

console.log('\n=== Store Release Ready ===');
console.log('\nChrome: store/chrome/');
console.log('  ├── discrub-chrome.zip');
console.log('  ├── screenshots/ (5 images, 1280x800)');
console.log('  └── README.md (step-by-step instructions)');
console.log('\nFirefox: store/firefox/');
console.log('  ├── discrub-firefox.zip');
console.log('  ├── screenshots/ (5 images, original size)');
console.log('  └── README.md (step-by-step instructions)');
console.log('\nFollow the README in each folder to submit.\n');
