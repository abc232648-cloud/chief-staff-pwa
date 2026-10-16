import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { rmSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const vite = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', '4175'], {
  stdio: 'ignore',
  env: { ...process.env, VITE_CHIEF_STAFF_DEV_MODE: 'true' }
});
const origin = 'http://127.0.0.1:4175';
const base = `${origin}/staff/`;
const modulePath = '/staff/src/storage/offlineStore.ts';
const profile = mkdtempSync(join(tmpdir(), 'chief-staff-offline-acceptance-'));
let debugPort;
let chrome = null;

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
  const portFile = join(profile, 'DevToolsActivePort');
  rmSync(portFile, { force: true });
  chrome = spawn(process.env.CHIEF_BROWSER_EXECUTABLE || 'google-chrome', [
    '--headless=new', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-features=MediaRouter,OptimizationHints', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, `${base}#/more`
  ], { stdio: 'ignore' });

  debugPort = undefined;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { debugPort = Number(readFileSync(portFile, 'utf8').split('\n')[0]); } catch {}
    if (debugPort) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!debugPort) throw new Error('Chrome did not publish its isolated debugging port.');
  await waitFor(`http://127.0.0.1:${debugPort}/json/list`);
  let page;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    page = pages.find(entry => entry.type === 'page' && entry.url.startsWith(base));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
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
  await command('Page.enable');
  await command('Page.navigate', { url: `${base}#/more` });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await command('Runtime.evaluate', { expression: '({url:location.href,ready:document.readyState})', returnByValue: true });
    const value = state.result?.value;
    if (value?.url?.startsWith(base) && value.ready === 'complete') { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Staff document did not finish navigating in the test browser.');

  return {
    async evaluate(expression) {
      const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed.');
      return result.result?.value;
    },
    close() { socket.close(); }
  };
}

async function stopChrome(connection) {
  connection?.close();
  const child = chrome;
  chrome = null;
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test Chrome did not exit.')), 10_000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGKILL');
    });
  }
}

const identityLiteral = `({userId:'offline-worker-acceptance',displayName:'Offline Worker',role:'worker',capabilities:[],assignedAreaIds:[],isSimulated:false})`;
const otherIdentityLiteral = `({userId:'other-worker-acceptance',displayName:'Other Worker',role:'worker',capabilities:[],assignedAreaIds:[],isSimulated:false})`;

try {
  await waitFor(base);

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

    const raw = await new Promise((resolve, reject) => {
      const request = indexedDB.open('chief_staff_pwa', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['queue','media','crypto_keys'], 'readonly');
        const q = tx.objectStore('queue').index('namespace').getAll('dev:offline-worker-acceptance');
        const m = tx.objectStore('media').index('namespace').getAll('dev:offline-worker-acceptance');
        const k = tx.objectStore('crypto_keys').get('dev:offline-worker-acceptance');
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => {
          const key = k.result?.key;
          const rawText = JSON.stringify({queue:q.result,media:m.result});
          resolve({
            queueEncrypted:q.result.every(r => r.storageVersion===2 && !('payload' in r) && !!r.encryptedPayload?.ciphertext),
            mediaEncrypted:m.result.every(r => r.storageVersion===2 && !('blob' in r) && !!r.encryptedBlob?.ciphertext),
            plaintextAbsent:!rawText.includes('Persist me exactly'),
            keyPresent:!!key,
            keyNonExtractable:key?.extractable===false,
            keyAlgorithm:key?.algorithm?.name
          });
          db.close();
        };
      };
    });
    return {queueCount:queue.length, reportQueueId:reportQueue.id, mediaQueueId:mediaQueue.id, mediaBytes:media.bytes, raw};
  })()`);
  if (created?.queueCount !== 2 || !created.reportQueueId || !created.mediaQueueId || created.mediaBytes !== 12) {
    throw new Error(`Initial offline persistence failed: ${JSON.stringify(created)}`);
  }
  if (!created.raw?.queueEncrypted || !created.raw?.mediaEncrypted || !created.raw?.plaintextAbsent || !created.raw?.keyPresent || !created.raw?.keyNonExtractable || created.raw?.keyAlgorithm !== 'AES-GCM') {
    throw new Error(`Encrypted-at-rest acceptance failed: ${JSON.stringify(created.raw)}`);
  }

  await stopChrome(connection);
  await new Promise(resolve => setTimeout(resolve, 750));

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
    return {queueCount:queue.length,otherQueueCount:otherQueue.length,reportPayload:report?.payload,
      mediaQueueId:mediaQueue?.id,mediaBytes:media.bytes,mediaWorkId:media.workId,otherMediaDenied};
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

  // Inject one legacy v1 plaintext queue record and prove read-time migration.
  const migrated = await connection.evaluate(`(async () => {
    const store = await import('${modulePath}');
    const identity={userId:'legacy-worker-acceptance',displayName:'Legacy Worker',role:'worker',capabilities:[],assignedAreaIds:[],isSimulated:false};
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('chief_staff_pwa',2);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result; const tx=db.transaction('queue','readwrite');
        tx.objectStore('queue').put({id:'dev:legacy-worker-acceptance:legacy-event',namespace:'dev:legacy-worker-acceptance',ownerUserId:'legacy-worker-acceptance',environment:'dev',kind:'worker_report',payloadVersion:1,payload:{event_id:'legacy-event',summary:'legacy plaintext'},createdAt:1,updatedAt:1,attempts:0,status:'queued',lastError:null});
        tx.onerror=()=>reject(tx.error); tx.oncomplete=()=>{db.close();resolve();};
      };
    });
    const listed=await store.listOfflineQueue(identity);
    const raw=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('chief_staff_pwa',2); request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result;const tx=db.transaction(['queue','crypto_keys'],'readonly');
        const q=tx.objectStore('queue').get('dev:legacy-worker-acceptance:legacy-event');
        const k=tx.objectStore('crypto_keys').get('dev:legacy-worker-acceptance');
        tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>{resolve({record:q.result,key:!!k.result?.key});db.close();};};
    });
    return {summary:listed[0]?.payload?.summary,encrypted:raw.record?.storageVersion===2 && !('payload' in raw.record) && !!raw.record?.encryptedPayload?.ciphertext,key:raw.key};
  })()`);
  if (migrated?.summary !== 'legacy plaintext' || !migrated.encrypted || !migrated.key) {
    throw new Error(`Legacy plaintext migration acceptance failed: ${JSON.stringify(migrated)}`);
  }

  // Delete only a key while leaving ciphertext. Reads must fail closed and preserve data.
  const recovery = await connection.evaluate(`(async () => {
    const store=await import('${modulePath}');
    const identity={userId:'recovery-worker-acceptance',displayName:'Recovery Worker',role:'worker',capabilities:[],assignedAreaIds:[],isSimulated:false};
    await store.enqueueOffline(identity,'worker_report',{event_id:'recovery-event',summary:'ciphertext must survive'},'recovery-event');
    await new Promise((resolve,reject)=>{const request=indexedDB.open('chief_staff_pwa',2);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('crypto_keys','readwrite');tx.objectStore('crypto_keys').delete('dev:recovery-worker-acceptance');tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>{db.close();resolve();};};});
    let failedClosed=false; let message='';
    try { await store.listOfflineQueue(identity); } catch (error) { failedClosed=true; message=String(error?.message||error); }
    const raw=await new Promise((resolve,reject)=>{const request=indexedDB.open('chief_staff_pwa',2);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('queue','readonly');const q=tx.objectStore('queue').get('dev:recovery-worker-acceptance:recovery-event');tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>{resolve(q.result);db.close();};};});
    return {failedClosed,message,preserved:raw?.storageVersion===2 && !('payload' in raw) && !!raw?.encryptedPayload?.ciphertext};
  })()`);
  if (!recovery?.failedClosed || !recovery.preserved || !recovery.message.includes('encryption key is unavailable')) {
    throw new Error(`Missing-key fail-closed acceptance failed: ${JSON.stringify(recovery)}`);
  }

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

  console.log('CHIEF Staff /staff/ encrypted offline restart/reconnect/migration/recovery acceptance passed in real Chrome.');
  await stopChrome(connection);
} finally {
  await stopChrome();
  vite.kill('SIGTERM');
  rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
