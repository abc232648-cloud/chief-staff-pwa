import { spawn } from 'node:child_process';

const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4174'], { stdio: ['ignore', 'pipe', 'pipe'] });
const base = 'http://127.0.0.1:4174';

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(base); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Vite preview did not become ready.');
}

function chromeDump(url) {
  return new Promise((resolve, reject) => {
    const args = ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-features=ServiceWorker,MediaRouter,OptimizationHints','--no-first-run','--no-default-browser-check','--virtual-time-budget=2500','--dump-dom',url];
    const chrome = spawn('google-chrome', args);
    let stdout = ''; let stderr = ''; let settled = false;
    const finish = (error = null) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(stdout);
    };
    const timer = setTimeout(() => {
      chrome.kill('SIGKILL');
      if (stdout.includes('id="root"') && stdout.includes('CHIEF')) finish();
      else finish(new Error(`Headless Chrome render timed out. ${stderr.slice(-1000)}`));
    }, 10000);
    chrome.stdout.on('data', chunk => { stdout += chunk; });
    chrome.stderr.on('data', chunk => { stderr += chunk; });
    chrome.on('error', error => finish(error));
    chrome.on('close', code => { if (code === 0) finish(); else if (!settled) finish(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`)); });
  });
}

try {
  await waitForServer();
  for (const path of ['/', '/#/tasks', '/#/report', '/#/team', '/#/more']) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) throw new Error(`Preview HTTP ${response.status} for ${path}`);
  }
  const dom = await chromeDump(`${base}/#/more`);
  if (!dom.includes('id="root"')) throw new Error('React root missing from browser DOM.');
  if (!dom.includes('CHIEF') || !dom.includes('Staff')) throw new Error('CHIEF Staff shell did not render in browser DOM.');
  console.log('CHIEF Staff headless-browser release smoke passed.');
} finally { preview.kill('SIGTERM'); }
