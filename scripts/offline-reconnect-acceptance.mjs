import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const vite = spawn('./node_modules/.bin/vite', ['--host', '127.0.0.1', '--port', '4175'], {
  stdio: 'ignore',
  env: { ...process.env, VITE_CHIEF_STAFF_DEV_MODE: 'true' }
});
const origin = 'http://127.0.0.1:4175';
const base = `${origin}/staff/`;
const modulePath = '/staff/src/storage/offlineStore.ts';
const profile = '/tmp/chief-staff-offline-acceptance';
const debugPort = 9224;
let chrome = null;

rmSync(profile, { recursive: true, force: true });

async function waitFor(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectChrome() {
  chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-features=MediaRouter,OptimizationHints', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`, `${base}#/more`
  ], { stdio: 'ignore' });

  await waitFor(`http://127.0.0.1:${debugPort}/json/list`);
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = pages.find(entry => entry.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a page target.');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DevTools connection timed out.')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('DevTools connection failed.')); }, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const pendingCommand = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) pendingCommand.reject(new Error(message.error.message));
    else pendingCommand.resolve(message.result);
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id;
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
    setTimeout(() => {
      if (pending.delete(commandId)) reject(new Error(`DevTools command timed out: ${method}`));
    }, 7000);
  });

  await command('Runtime.enable');
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    async evaluate(expression) {
      const result = await command('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed.');
      }
      return result.result?.value;
    },
    close() { socket.close(); }
  };
}

function stopChrome(connection) {
  connection?.close();
  if (chrome) {
    chrome.kill('SIGKILL');
    chrome = null;
  }
}

const identityLiteral = `({userId:'offline-worker-acceptance',displayName:'Offline Worker',role:'worker',capabilities:[],assignedAreaIds:[],isSimulated:false})`;
const otherIdentityLiteral = `({userId:'other-worker-acceptance',displayName:'Other Worker',role:'worker',capabilities:[],assignedAreaIds:[],isSimulated:false})`;

try {
  await waitFor(base);

  // First browser process: create durable offline report + media queue records.
  let connection = await connectChrome();
  const created = await connection.evaluate(`(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('chief_staff_pwa');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB cleanup blocked'));
    });
    const store = await import('${modulePath}');
    const identity = ${identityLiteral};
    const reportPayload = {event_id:'offline-report-event',category:'OBSERVATION',summary:'Persist me exactly'};
    const reportQueue = await store.enqueueOffline(identity, 'worker_report', reportPayload, reportPayload.event_id);
    const bytes = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
    const blob = new Blob([bytes], {type:'image/png'});
    const media = await store.saveOfflineMedia(identity, {
      id:'offline-media-1', blob, mimeType:'image/png', createdAt:Date.now(), purpose:'task_photo',
      workId:'offline-task-1', sha256:'acceptance-sha256', bytes:blob.size
    });
    const mediaQueue = await store.enqueueOffline(identity, 'media_upload', {
      media_id:media.id, work_id:media.workId, sha256:media.sha256, bytes:media.bytes
    }, 'offline-media-event');
    const queue = await store.listOfflineQueue(identity);
    return {queueCount:queue.length, reportQueueId:reportQueue.id, mediaQueueId:mediaQueue.id, mediaBytes:media.bytes};
  })()`);
  if (created?.queueCount !== 2 || !created.reportQueueId || !created.mediaQueueId || created.mediaBytes !== 12) {
    throw new Error(`Initial offline persistence failed: ${JSON.stringify(created)}`);
  }

  // Kill Chrome completely. IndexedDB must survive browser/application restart.
  stopChrome(connection);
  await new Promise(resolve => setTimeout(resolve, 750));

  // Second browser process, same profile: verify persistence, exact payload and user isolation.
  connection = await connectChrome();
  const restored = await connection.evaluate(`(async () => {
    const store = await import('${modulePath}');
    const identity = ${identityLiteral};
    const other = ${otherIdentityLiteral};
    const queue = await store.listOfflineQueue(identity);
    const otherQueue = await store.listOfflineQueue(other);
    const report = queue.find(record => record.kind === 'worker_report');
    const mediaQueue = queue.find(record => record.kind === 'media_upload');
    const media = await store.getOfflineMedia(identity, 'offline-media-1');
    let otherMediaDenied = false;
    try { await store.getOfflineMedia(other, 'offline-media-1'); } catch { otherMediaDenied = true; }
    return {
      queueCount: queue.length,
      otherQueueCount: otherQueue.length,
      reportPayload: report?.payload,
      mediaQueueId: mediaQueue?.id,
      mediaBytes: media.bytes,
      mediaWorkId: media.workId,
      otherMediaDenied
    };
  })()`);
  if (restored?.queueCount !== 2 || restored.otherQueueCount !== 0 || restored.otherMediaDenied !== true) {
    throw new Error(`Offline restart/user-isolation acceptance failed: ${JSON.stringify(restored)}`);
  }
  if (restored.reportPayload?.event_id !== 'offline-report-event' || restored.reportPayload?.summary !== 'Persist me exactly') {
    throw new Error(`Queued report changed across restart: ${JSON.stringify(restored.reportPayload)}`);
  }
  if (restored.mediaBytes !== 12 || restored.mediaWorkId !== 'offline-task-1') {
    throw new Error(`Queued media changed across restart: ${JSON.stringify(restored)}`);
  }

  // Simulate authoritative media reconciliation cleanup: queue+blob disappear atomically;
  // unrelated queued work remains until separately confirmed.
  const reconciled = await connection.evaluate(`(async () => {
    const store = await import('${modulePath}');
    const identity = ${identityLiteral};
    const queue = await store.listOfflineQueue(identity);
    const mediaQueue = queue.find(record => record.kind === 'media_upload');
    await store.removeOfflineQueueAndMedia(identity, mediaQueue.id, 'offline-media-1');
    const afterMedia = await store.listOfflineQueue(identity);
    let mediaGone = false;
    try { await store.getOfflineMedia(identity, 'offline-media-1'); } catch { mediaGone = true; }
    const report = afterMedia.find(record => record.kind === 'worker_report');
    await store.removeOfflineQueue(identity, report.id);
    const finalQueue = await store.listOfflineQueue(identity);
    return {afterMediaCount:afterMedia.length, mediaGone, finalQueueCount:finalQueue.length};
  })()`);
  if (reconciled?.afterMediaCount !== 1 || reconciled.mediaGone !== true || reconciled.finalQueueCount !== 0) {
    throw new Error(`Authoritative reconciliation cleanup acceptance failed: ${JSON.stringify(reconciled)}`);
  }

  console.log('CHIEF Staff /staff/ offline restart/reconnect IndexedDB acceptance passed in real Chrome.');
  stopChrome(connection);
} finally {
  if (chrome) chrome.kill('SIGKILL');
  vite.kill('SIGTERM');
  rmSync(profile, { recursive: true, force: true });
}
