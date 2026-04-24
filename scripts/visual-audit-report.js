import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceDir = path.join(rootDir, 'cypress', 'screenshots', 'visual-audit.cy.ts', 'audit');
const destDir = path.join(rootDir, 'docs', 'visual-audit');

if (!fs.existsSync(sourceDir)) {
  console.error('No screenshots found. Run the visual audit first:');
  console.error('  npx cypress run --spec cypress/e2e/visual-audit.cy.ts');
  process.exit(1);
}

// Collect all PNGs recursively
function collectPngs(dir, prefix = '') {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectPngs(fullPath, relPath));
    } else if (entry.name.endsWith('.png')) {
      const stats = fs.statSync(fullPath);
      results.push({ path: fullPath, relPath, size: stats.size });
    }
  }
  return results;
}

const screenshots = collectPngs(sourceDir);

// Copy to docs/visual-audit/
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true });
}

for (const shot of screenshots) {
  const dest = path.join(destDir, shot.relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(shot.path, dest);
}

// Print report
console.log('\n=== Visual Audit Report ===\n');
console.log(`Total screenshots: ${screenshots.length}`);

const categories = new Map();
for (const shot of screenshots) {
  const category = shot.relPath.split('/')[0] || 'root';
  if (!categories.has(category)) categories.set(category, []);
  categories.get(category).push(shot);
}

for (const [category, shots] of categories) {
  console.log(`\n  ${category}/ (${shots.length})`);
  for (const shot of shots) {
    const sizeKB = (shot.size / 1024).toFixed(0);
    const name = shot.relPath.split('/').slice(1).join('/') || shot.relPath;
    console.log(`    ${name} (${sizeKB} KB)`);
  }
}

console.log(`\nScreenshots saved to: ${destDir}`);
console.log('Review these images for visual issues, layout problems, or inconsistencies.\n');
