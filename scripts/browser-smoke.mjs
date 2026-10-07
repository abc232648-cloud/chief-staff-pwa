import { spawn } from 'node:child_process';

const preview = spawn('./node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', '4174'], { stdio: 'ignore' });
const base = 'http://127.0.0.1:4174';
let chrome = null;

async function waitFor(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function renderedBodyText() {
  chrome = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-features=ServiceWorker,MediaRouter,OptimizationHints','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9222','--user-data-dir=/tmp/chief-staff-chrome',`${base}/#/more`], { stdio: 'ignore' });
  await waitFor('http://127.0.0.1:9222/json/list');
  const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page = pages.find(entry => entry.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a page DevTools target.');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('DevTools WebSocket open timed out.')), 5000); socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true }); socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('DevTools WebSocket failed.')); }, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id; pending.set(commandId, { resolve, reject }); socket.send(JSON.stringify({ id: commandId, method, params }));
    setTimeout(() => { if (pending.delete(commandId)) reject(new Error(`DevTools command timed out: ${method}`)); }, 5000);
  });
  await command('Runtime.enable');
  await new Promise(resolve => setTimeout(resolve, 1500));
  const evaluation = await command('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true });
  socket.close();
  return evaluation?.result?.value ?? '';
}

try {
  await waitFor(base);
  for (const path of ['/', '/#/tasks', '/#/report', '/#/team', '/#/more']) { const response = await fetch(`${base}${path}`); if (!response.ok) throw new Error(`Preview HTTP ${response.status} for ${path}`); }
  const text = await renderedBodyText();
  if (!text.includes('CHIEF') || !text.includes('Staff')) throw new Error(`CHIEF Staff shell did not render in Chrome. Body: ${text.slice(0, 500)}`);
  console.log('CHIEF Staff real-browser render smoke passed through Chrome DevTools.');
} finally {
  if (chrome) chrome.kill('SIGKILL');
  preview.kill('SIGTERM');
}
