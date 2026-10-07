import { spawn } from 'node:child_process';
import fs from 'node:fs';

const preview = spawn('./node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', '4174'], { stdio: 'ignore' });
const base = 'http://127.0.0.1:4174';
const screenshot = '/tmp/chief-staff-render.png';

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(base); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Vite preview did not become ready.');
}

function chromeScreenshot(url) {
  return new Promise((resolve, reject) => {
    const args = ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-features=ServiceWorker,MediaRouter,OptimizationHints','--no-first-run','--no-default-browser-check','--window-size=390,844',`--screenshot=${screenshot}`,url];
    const chrome = spawn('google-chrome', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; let settled = false;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => { chrome.kill('SIGKILL'); finish(new Error(`Headless Chrome screenshot timed out. ${stderr.slice(-1000)}`)); }, 15000);
    chrome.stderr.on('data', chunk => { stderr += chunk; });
    chrome.on('error', error => finish(error));
    chrome.on('close', code => code === 0 ? finish() : finish(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`)));
  });
}

try {
  await waitForServer();
  for (const path of ['/', '/#/tasks', '/#/report', '/#/team', '/#/more']) { const response = await fetch(`${base}${path}`); if (!response.ok) throw new Error(`Preview HTTP ${response.status} for ${path}`); }
  if (fs.existsSync(screenshot)) fs.rmSync(screenshot);
  await chromeScreenshot(`${base}/#/more`);
  const stat = fs.statSync(screenshot);
  if (stat.size < 5000) throw new Error(`Browser screenshot is unexpectedly small (${stat.size} bytes).`);
  console.log(`CHIEF Staff headless-browser render smoke passed (${stat.size} byte screenshot).`);
} finally { preview.kill('SIGTERM'); }
