import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Extension Build Tests', () => {
  // Clean up build directories before and after tests
  beforeAll(() => {
    cleanupBuildDirs();
  });

  afterAll(() => {
    cleanupBuildDirs();
  });

  describe('Chrome Extension Build', () => {
    it('should build Chrome extension successfully', () => {
      expect(() => {
        execSync('npm run build:extension:chrome', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 120000, // 2 minute timeout
        });
      }).not.toThrow();
    }, 150000); // 2.5 minute test timeout

    it('should create dist-extension-chrome directory', () => {
      const chromeDir = path.join(rootDir, 'dist-extension-chrome');
      expect(fs.existsSync(chromeDir)).toBe(true);
    });

    it('should include manifest.json with version from package.json', () => {
      const manifestPath = path.join(rootDir, 'dist-extension-chrome', 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toContain('Discrub');
      expect(manifest.version).toBe(pkg.version);
    });

    it('should include background.js', () => {
      const backgroundPath = path.join(rootDir, 'dist-extension-chrome', 'background.js');
      expect(fs.existsSync(backgroundPath)).toBe(true);
    });

    it('should include content.js', () => {
      const contentPath = path.join(rootDir, 'dist-extension-chrome', 'content.js');
      expect(fs.existsSync(contentPath)).toBe(true);
    });

    it('should include token-bridge.js', () => {
      const bridgePath = path.join(rootDir, 'dist-extension-chrome', 'token-bridge.js');
      expect(fs.existsSync(bridgePath)).toBe(true);
    });

    it('should include index.html', () => {
      const indexPath = path.join(rootDir, 'dist-extension-chrome', 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('should include assets directory', () => {
      const assetsDir = path.join(rootDir, 'dist-extension-chrome', 'assets');
      expect(fs.existsSync(assetsDir)).toBe(true);
    });

    it('should have valid manifest structure', () => {
      const manifestPath = path.join(rootDir, 'dist-extension-chrome', 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Check required fields
      expect(manifest).toHaveProperty('manifest_version');
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('permissions');
      expect(manifest).toHaveProperty('background');
      expect(manifest).toHaveProperty('content_scripts');

      // Check background service worker (MV3)
      expect(manifest.background).toHaveProperty('service_worker');
      expect(manifest.background.service_worker).toBe('background.js');

      // Check content scripts
      expect(Array.isArray(manifest.content_scripts)).toBe(true);
      expect(manifest.content_scripts.length).toBeGreaterThan(0);
      expect(manifest.content_scripts[0].js).toContain('content.js');

      // Check the MAIN-world token bridge (GitHub #9)
      const bridge = manifest.content_scripts.find((cs) =>
        cs.js.includes('token-bridge.js')
      );
      expect(bridge).toBeDefined();
      expect(bridge.world).toBe('MAIN');
      expect(bridge.run_at).toBe('document_start');
    });
  });

  describe('Firefox Extension Build', () => {
    it('should build Firefox extension successfully', () => {
      expect(() => {
        execSync('npm run build:extension:firefox', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 120000, // 2 minute timeout
        });
      }).not.toThrow();
    }, 150000); // 2.5 minute test timeout

    it('should create dist-extension-firefox directory', () => {
      const firefoxDir = path.join(rootDir, 'dist-extension-firefox');
      expect(fs.existsSync(firefoxDir)).toBe(true);
    });

    it('should include manifest.json with version from package.json', () => {
      const manifestPath = path.join(rootDir, 'dist-extension-firefox', 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toContain('Discrub');
      expect(manifest.version).toBe(pkg.version);
    });

    it('should have valid manifest structure', () => {
      const manifestPath = path.join(rootDir, 'dist-extension-firefox', 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Check required fields
      expect(manifest).toHaveProperty('manifest_version');
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('permissions');
      expect(manifest).toHaveProperty('background');
      expect(manifest).toHaveProperty('content_scripts');

      // Check background scripts (MV3)
      expect(manifest.background).toHaveProperty('scripts');
      expect(manifest.background.scripts).toContain('background.js');
      expect(manifest.background.type).toBe('module');

      // Check content scripts
      expect(Array.isArray(manifest.content_scripts)).toBe(true);
      expect(manifest.content_scripts.length).toBeGreaterThan(0);
      expect(manifest.content_scripts[0].js).toContain('content.js');

      // Check the MAIN-world token bridge (GitHub #9)
      const bridge = manifest.content_scripts.find((cs) =>
        cs.js.includes('token-bridge.js')
      );
      expect(bridge).toBeDefined();
      expect(bridge.world).toBe('MAIN');
      expect(bridge.run_at).toBe('document_start');

      // Firefox needs 128+ for declarative world: MAIN
      expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe('128.0');
    });
  });

  describe('Chrome Build Isolation', () => {
    it('Chrome Classic index.html should NOT contain token receiver script', () => {
      const classicIndex = path.join(rootDir, 'dist-extension-chrome', 'classic', 'index.html');
      expect(fs.existsSync(classicIndex)).toBe(true);
      const html = fs.readFileSync(classicIndex, 'utf-8');
      expect(html).not.toContain('discrub:token');
      expect(html).not.toContain('firefox-shim.js');
    });

    it('Chrome Classic should NOT have firefox-shim.js', () => {
      const shimPath = path.join(rootDir, 'dist-extension-chrome', 'classic', 'firefox-shim.js');
      expect(fs.existsSync(shimPath)).toBe(false);
    });

    it('Chrome Classic main.js should still contain user-agent header', () => {
      const mainJs = path.join(rootDir, 'dist-extension-chrome', 'classic', 'main.js');
      expect(fs.existsSync(mainJs)).toBe(true);
      const content = fs.readFileSync(mainJs, 'utf-8');
      expect(content).toContain('"user-agent"');
    });
  });

  describe('Firefox Build Isolation', () => {
    it('Firefox Classic should have firefox-shim.js with token receiver and close watcher', () => {
      const shimPath = path.join(rootDir, 'dist-extension-firefox', 'classic', 'firefox-shim.js');
      expect(fs.existsSync(shimPath)).toBe(true);
      const shim = fs.readFileSync(shimPath, 'utf-8');
      expect(shim).toContain('discrub:token');
      expect(shim).toContain('discrub:switchVersion');
    });

    it('Firefox Classic index.html should link firefox-shim.js (external, not inline)', () => {
      const classicIndex = path.join(rootDir, 'dist-extension-firefox', 'classic', 'index.html');
      expect(fs.existsSync(classicIndex)).toBe(true);
      const html = fs.readFileSync(classicIndex, 'utf-8');
      expect(html).toContain('src="firefox-shim.js"');
      expect(html).not.toContain('discrub:token');
    });

    it('Firefox Classic main.js should NOT contain user-agent header', () => {
      const mainJs = path.join(rootDir, 'dist-extension-firefox', 'classic', 'main.js');
      expect(fs.existsSync(mainJs)).toBe(true);
      const content = fs.readFileSync(mainJs, 'utf-8');
      expect(content).not.toContain('"user-agent"');
    });

    it('Firefox Classic index.html should not have crossorigin attributes', () => {
      const classicIndex = path.join(rootDir, 'dist-extension-firefox', 'classic', 'index.html');
      const html = fs.readFileSync(classicIndex, 'utf-8');
      expect(html).not.toContain('crossorigin');
    });
  });

  describe('Extension Size', () => {
    it('Chrome extension should be under 20MB', () => {
      const size = getDirectorySize(path.join(rootDir, 'dist-extension-chrome'));
      const sizeMB = size / (1024 * 1024);
      expect(sizeMB).toBeLessThan(20);
    });

    it('Firefox extension should be under 20MB', () => {
      const size = getDirectorySize(path.join(rootDir, 'dist-extension-firefox'));
      const sizeMB = size / (1024 * 1024);
      expect(sizeMB).toBeLessThan(20);
    });
  });
});

// Helper functions
function cleanupBuildDirs() {
  const chromeDir = path.join(rootDir, 'dist-extension-chrome');
  const firefoxDir = path.join(rootDir, 'dist-extension-firefox');

  if (fs.existsSync(chromeDir)) {
    fs.rmSync(chromeDir, { recursive: true, force: true });
  }
  if (fs.existsSync(firefoxDir)) {
    fs.rmSync(firefoxDir, { recursive: true, force: true });
  }
}

function getDirectorySize(dirPath) {
  let totalSize = 0;

  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);

    if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        calculateSize(path.join(currentPath, file));
      });
    } else {
      totalSize += stats.size;
    }
  }

  if (fs.existsSync(dirPath)) {
    calculateSize(dirPath);
  }

  return totalSize;
}
