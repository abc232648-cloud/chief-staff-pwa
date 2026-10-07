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
  'src/components/AppHeader.tsx',
  'src/auth/AuthContext.tsx',
  'src/auth/authApi.ts',
  'src/auth/LoginScreen.tsx',
  'src/api/client.ts',
  'src/api/farm.ts',
  'src/api/types.ts'
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

const auth = read('src/auth/AuthContext.tsx');
const authApi = read('src/auth/authApi.ts');
if (/localStorage|sessionStorage|indexedDB/i.test(auth + authApi)) failures.push('Authentication secrets/session state must not be browser-persisted.');
if (!/credentials:\s*['"]include['"]/.test(authApi)) failures.push('Chief cookie session must use credentials: include.');
if (!/cache:\s*['"]no-store['"]/.test(authApi)) failures.push('Auth requests must use no-store.');
if (!auth.includes("principal.role === 'Owner' || principal.role === 'Administrator'")) failures.push('Owner/Administrator identities must not be mapped into Staff roles.');
if (!auth.includes("farm.farm_role === 'GENERAL_MANAGER'") || !auth.includes("farm.farm_role === 'SUPERVISOR'")) failures.push('Production Staff role must derive from authoritative Farm role.');

const apiClient = read('src/api/client.ts');
if (!apiClient.includes("path.startsWith('/api/')")) failures.push('General API client must be same-origin /api/ only.');
if (!apiClient.includes("code: 'DEV_LIVE_API_BLOCKED'")) failures.push('DEV identities must be blocked from live Chief API.');
if (!apiClient.includes("code: 'CSRF_REQUIRED'")) failures.push('Mutations must require live CSRF.');
if (/Authorization\s*[:=]|Bearer\s/.test(apiClient)) failures.push('Staff general API client must not construct browser bearer tokens.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('CHIEF Staff source-safety check passed.');
