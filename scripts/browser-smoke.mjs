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
    const chrome = spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--virtual-time-budget=3000', '--dump-dom', url]);
    let stdout = ''; let stderr = ''; let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      chrome.kill('SIGKILL');
      reject(new Error('Headless Chrome render timed out after 15 seconds.'));
    }, 15000);
    chrome.stdout.on('data', chunk => { stdout += chunk; });
    chrome.stderr.on('data', chunk => { stderr += chunk; });
    chrome.on('error', error => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    chrome.on('close', code => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      code === 0 ? resolve(stdout) : reject(new Error(`Chrome exited ${code}: ${stderr}`));
    });
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
} finally {
  preview.kill('SIGTERM');
}
