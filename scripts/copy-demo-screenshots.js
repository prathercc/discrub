/**
 * Copy demo screenshots from Cypress output to docs/screenshots/.
 * Run after: cypress run --spec cypress/e2e/demo/feature-showcase.cy.ts
 */
import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SOURCE = 'cypress/screenshots/feature-showcase.cy.ts/demo';
const DEST = 'docs/screenshots';

function copyRecursive(src, dest) {
  if (!existsSync(src)) {
    console.error(`Source not found: ${src}`);
    console.error('Run "npm run demo:screenshots" to generate screenshots first.');
    process.exit(1);
  }

  mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src);
  let count = 0;

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      count += copyRecursive(srcPath, destPath);
    } else if (entry.endsWith('.png')) {
      cpSync(srcPath, destPath);
      console.log(`  ${relative('.', destPath)}`);
      count++;
    }
  }

  return count;
}

console.log('Copying demo screenshots to docs/screenshots/...');
const total = copyRecursive(SOURCE, DEST);
console.log(`\nDone — ${total} screenshots copied to docs/screenshots/.`);

// Also copy onboarding-specific screenshots to public/onboarding/
// These are bundled with the app for the in-app onboarding guide modal.
const ONBOARDING_DEST = 'public/onboarding';
const ONBOARDING_SOURCES = [
  'analytics',
  'auth',
  'browsing',
  'export',
  'forum',
  'package',
  'settings',
  'ui',
];

let onboardingCount = 0;
for (const dir of ONBOARDING_SOURCES) {
  const src = join(DEST, dir);
  const dest = join(ONBOARDING_DEST, dir);
  if (existsSync(src)) {
    onboardingCount += copyRecursive(src, dest);
  }
}
console.log(`Copied ${onboardingCount} screenshots to public/onboarding/.`);
