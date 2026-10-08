import fs from 'node:fs';
import path from 'node:path';

const must = file => { if (!fs.existsSync(file)) throw new Error(`Missing release asset: ${file}`); return fs.readFileSync(file, 'utf8'); };
const index = must('dist/index.html');
const manifestText = must('dist/manifest.webmanifest');
const sw = must('dist/sw.js');
must('dist/icon.svg');
const manifest = JSON.parse(manifestText);

if (manifest.name !== 'CHIEF Staff Operations' || manifest.display !== 'standalone') throw new Error('Manifest identity/install mode invalid.');
if (manifest.id !== '/staff/' || manifest.start_url !== '/staff/' || manifest.scope !== '/staff/') throw new Error('Staff manifest escaped its /staff/ deployment boundary.');
if (!manifest.icons.every(icon => String(icon.src).startsWith('/staff/'))) throw new Error('Staff manifest contains root/cross-app icon paths.');
if (!index.includes('/staff/manifest.webmanifest') || !index.includes('/staff/icon.svg')) throw new Error('Built HTML does not use Staff-scoped shell assets.');
if (!index.includes('/staff/assets/')) throw new Error('Built bundle assets are not rooted under /staff/.');
if (!index.includes('Content-Security-Policy')) throw new Error('Built HTML is missing CSP.');
if (/fonts\.googleapis|fonts\.gstatic/.test(index)) throw new Error('External font dependency found.');
if (!sw.includes("url.pathname.startsWith('/api/')") || !sw.includes("request.method !== 'GET'")) throw new Error('Service worker API/mutation exclusion missing.');
if (!sw.includes('SCOPE_PATH') || !sw.includes('startsWith(`${SCOPE_PATH}/`)')) throw new Error('Service worker is not constrained to the Staff scope.');

const assetDir = path.join('dist', 'assets');
const assets = fs.existsSync(assetDir) ? fs.readdirSync(assetDir) : [];
if (!assets.some(name => name.endsWith('.js'))) throw new Error('No production JavaScript asset emitted.');

for (const file of assets.filter(name => /\.(js|css)$/.test(name))) {
  const text = fs.readFileSync(path.join(assetDir, file), 'utf8');
  if (/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/.test(text)) throw new Error(`Secret/provider marker in ${file}`);
}
console.log('CHIEF Staff production release smoke passed.');
