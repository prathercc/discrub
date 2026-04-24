import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = process.argv[2]; // 'chrome' or 'firefox'

if (!browser || !['chrome', 'firefox'].includes(browser)) {
  console.error('Usage: node build-extension.js [chrome|firefox]');
  process.exit(1);
}

const outDir = browser === 'firefox'
  ? 'dist-extension-firefox'
  : 'dist-extension-chrome';

const manifestSrc = path.resolve(__dirname, '..', 'public', `manifest.${browser}.json`);
const manifestDest = path.resolve(__dirname, '..', outDir, 'manifest.json');

const iconsSrc = path.resolve(__dirname, '..', 'public', 'icons');
const iconsDest = path.resolve(__dirname, '..', outDir, 'icons');

console.log(`Building ${browser} extension...`);

// Copy manifest and inject version from package.json
console.log('Copying manifest...');
fs.copyFileSync(manifestSrc, manifestDest);

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestDest, 'utf8'));
manifest.version = pkg.version;
fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));

// Fix permissions on all manifest files (Vite copies them from public/ with restrictive permissions)
const manifestFiles = [
  path.join(path.resolve(__dirname, '..', outDir), 'manifest.json'),
  path.join(path.resolve(__dirname, '..', outDir), 'manifest.chrome.json'),
  path.join(path.resolve(__dirname, '..', outDir), 'manifest.firefox.json'),
];
manifestFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.chmodSync(file, 0o644);
  }
});

// Copy icons (if they exist)
if (fs.existsSync(iconsSrc)) {
  console.log('Copying icons...');
  if (fs.existsSync(iconsDest)) {
    fs.rmSync(iconsDest, { recursive: true });
  }
  fs.mkdirSync(iconsDest, { recursive: true });

  const icons = fs.readdirSync(iconsSrc);
  icons.forEach(icon => {
    const destPath = path.join(iconsDest, icon);
    fs.copyFileSync(path.join(iconsSrc, icon), destPath);
    // Ensure icons are readable (644 permissions)
    fs.chmodSync(destPath, 0o644);
  });
} else {
  console.warn('Warning: No icons directory found at public/icons/');
  console.warn('Extension will use default browser icons.');
}

// Copy drip-fs bridge files from the package into bridge/ subdirectory
// The subdirectory is required to avoid SW scope conflicts with the extension's background SW
const dripFsSrc = path.resolve(__dirname, '..', 'node_modules', 'drip-fs', 'src', 'bridge');
const bridgeDest = path.join(path.resolve(__dirname, '..', outDir), 'bridge');
const bridgeFiles = ['bridge.html', 'bridge.js', 'sw.js'];
console.log('Copying drip-fs bridge files...');
fs.mkdirSync(bridgeDest, { recursive: true });
bridgeFiles.forEach(file => {
  const src = path.join(dripFsSrc, file);
  const dest = path.join(bridgeDest, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o644);
  } else {
    console.warn(`Warning: ${src} not found`);
  }
});

// Fix permissions on other files that may have been copied from public/
const otherFiles = ['discrub.png'];
otherFiles.forEach(file => {
  const filePath = path.join(path.resolve(__dirname, '..', outDir), file);
  if (fs.existsSync(filePath)) {
    fs.chmodSync(filePath, 0o644);
  }
});

// Remove files that Vite copies from public/ that don't belong in the extension.
// A root-level sw.js can interfere with Firefox's service worker context.
const filesToRemove = ['sw.js', 'manifest.chrome.json', 'manifest.firefox.json', 'service-worker-loader.js', 'firefox-classic-shim.js'];
const dirsToRemove = ['classic-chrome', 'classic-firefox'];
filesToRemove.forEach(file => {
  const filePath = path.join(path.resolve(__dirname, '..', outDir), file);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
});
dirsToRemove.forEach(dir => {
  const dirPath = path.join(path.resolve(__dirname, '..', outDir), dir);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true });
  }
});
console.log('Cleaned up extra public/ files from build output');

// Copy Discrub Classic build (browser-specific) to classic/ subdirectory
const classicSrcDir = browser === 'firefox' ? 'classic-firefox' : 'classic-chrome';
const classicSrc = path.resolve(__dirname, '..', 'public', classicSrcDir);
const classicDest = path.resolve(__dirname, '..', outDir, 'classic');

if (fs.existsSync(classicSrc)) {
  console.log(`Copying Discrub Classic (${classicSrcDir}) to classic/...`);
  if (fs.existsSync(classicDest)) {
    fs.rmSync(classicDest, { recursive: true });
  }
  fs.cpSync(classicSrc, classicDest, { recursive: true });

  // Rewrite absolute paths in Classic's index.html to relative paths
  // Classic uses "/main.js", "/assets/*" which resolve to extension root,
  // but we need them relative to the classic/ subdirectory
  const classicIndex = path.join(classicDest, 'index.html');
  if (fs.existsSync(classicIndex)) {
    let html = fs.readFileSync(classicIndex, 'utf8');
    html = html.replace(/src="\/main\.js"/g, 'src="main.js"');
    html = html.replace(/href="\/assets\//g, 'href="assets/');
    // Remove crossorigin attributes — unnecessary for same-origin extension
    // resources, and can prevent module loading in Firefox MV3
    html = html.replace(/ crossorigin/g, '');
    fs.writeFileSync(classicIndex, html);
    console.log('  Rewrote Classic index.html paths to relative');
  }

  // Firefox: inject token receiver + close watcher into Classic's index.html.
  // On Firefox, Classic is loaded directly in the overlay iframe (no wrapper)
  // to avoid 3-level nesting that causes blob URL partition key errors.
  // The injected script handles token injection via postMessage and close detection.
  if (browser === 'firefox') {
    const classicIndexForFirefox = path.join(classicDest, 'index.html');
    if (fs.existsSync(classicIndexForFirefox)) {
      let firefoxHtml = fs.readFileSync(classicIndexForFirefox, 'utf8');

      // Strip the custom user-agent header from Classic's main.js at build time.
      // Classic (discrub-ext) sets "user-agent":this.userAgent on all Discord API calls,
      // which triggers CORS preflight that Discord rejects on Firefox MV3.
      // Removing it at build time is more reliable than runtime monkey-patching.
      const classicMainJs = path.join(classicDest, 'main.js');
      if (fs.existsSync(classicMainJs)) {
        let mainJsContent = fs.readFileSync(classicMainJs, 'utf8');
        const before = mainJsContent.length;
        // Remove "user-agent":this.userAgent with optional trailing comma
        mainJsContent = mainJsContent.replace(/"user-agent":this\.userAgent,?/g, '');
        fs.writeFileSync(classicMainJs, mainJsContent);
        const removed = before - mainJsContent.length;
        console.log('  Stripped user-agent headers from Classic main.js (' + removed + ' bytes removed)');
      }

      // Copy the Firefox Classic shim — an external JS file that handles token
      // injection and close detection. Must be external (not inline) because
      // Classic's CSP blocks inline scripts but allows 'self' scripts.
      const shimSrc = path.resolve(__dirname, '..', 'public', 'firefox-classic-shim.js');
      const shimDest = path.join(classicDest, 'firefox-shim.js');
      fs.copyFileSync(shimSrc, shimDest);

      // Add external script reference in <head> BEFORE module script (passes CSP 'self')
      firefoxHtml = firefoxHtml.replace(
        '<script type="module"',
        '<script src="firefox-shim.js"></script>\n    <script type="module"'
      );
      fs.writeFileSync(classicIndexForFirefox, firefoxHtml);
      console.log('  Created firefox-shim.js and linked from Classic index.html');
    }
  }

  // Remove Classic's own manifest.json — having a second manifest in the
  // extension package can confuse Firefox's extension loader
  const classicManifest = path.join(classicDest, 'manifest.json');
  if (fs.existsSync(classicManifest)) {
    fs.rmSync(classicManifest);
    console.log('  Removed classic/manifest.json');
  }
} else {
  console.warn(`Warning: Classic build not found at public/${classicSrcDir}/`);
  console.warn('Discrub Classic will not be available in this build.');
}


console.log(`✓ ${browser} extension built successfully in ${outDir}/`);
