import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const files = [
  'index.html',
  'src/App.tsx',
  'src/config/devMode.ts',
  'src/types/capabilities.ts',
  'src/design/tokens.ts',
  'src/screens/index.tsx',
  'src/components/AppHeader.tsx'
];

const combined = files.map(read).join('\n');
const failures = [];

const forbidden = [
  /AIza[0-9A-Za-z_-]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /ANTHROPIC_API_KEY/,
  /GEMINI_API_KEY/,
  /OPENAI_API_KEY/,
  /dangerouslySetInnerHTML/,
  /user-scalable\s*=\s*no/i,
  /maximum-scale\s*=\s*1/i
];

for (const pattern of forbidden) {
  if (pattern.test(combined)) failures.push(`Forbidden source pattern: ${pattern}`);
}

const devMode = read('src/config/devMode.ts');
if (!/VITE_CHIEF_STAFF_DEV_MODE\s*===\s*['"]true['"]/.test(devMode)) failures.push('DEV mode must be build-environment controlled.');
if (/location\.search|URLSearchParams|localStorage|getItem\(|sessionStorage/.test(devMode)) failures.push('DEV mode must not be browser-enableable.');

const app = read('src/App.tsx');
if (!/if \(!isDevMode\) return <ProductionAuthBoundary/.test(app)) failures.push('Production must fail closed before S3 auth exists.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('CHIEF Staff source-safety check passed.');
