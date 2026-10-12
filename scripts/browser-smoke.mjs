import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const preview = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', '4174'], { stdio: 'ignore' });
const origin = 'http://127.0.0.1:4174';
const base = `${origin}/staff/`;

async function waitFor(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function renderedDom() {
  const result = spawnSync(process.env.CHIEF_BROWSER_EXECUTABLE || 'google-chrome', [
    '--headless=new','--disable-gpu','--disable-dev-shm-usage',
    '--disable-background-networking','--disable-component-update','--disable-default-apps',
    '--disable-features=ServiceWorker,MediaRouter,OptimizationHints','--no-first-run',
    '--no-default-browser-check','--virtual-time-budget=2500','--dump-dom',`${base}#/more`
  ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Chrome render smoke exited ${result.status}: ${String(result.stderr || '').slice(0, 500)}`);
  return result.stdout || '';
}

try {
  await waitFor(base);
  for (const path of ['', '#/tasks', '#/report', '#/team', '#/more']) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) throw new Error(`Preview HTTP ${response.status} for ${base}${path}`);
  }
  const rootResponse = await fetch(origin, { redirect: 'manual' });
  if (rootResponse.status === 200 && (await rootResponse.text()).includes('CHIEF Staff Operations')) {
    throw new Error('Staff production bundle is unexpectedly served at the shared origin root.');
  }
  const html = renderedDom();
  const rootMatch = html.match(/<div\s+id="root"[^>]*>([\s\S]*?)<\/div>/);
  if (!rootMatch || !rootMatch[1].trim()) throw new Error(`Chrome loaded the shell but React did not render into #root. DOM: ${html.slice(0, 500)}`);
  if (!html.includes('CHIEF') || !html.includes('Staff')) throw new Error('Rendered Staff DOM is missing application identity.');
  console.log('CHIEF Staff /staff/ real-browser DOM smoke passed.');
} finally {
  preview.kill('SIGTERM');
}
