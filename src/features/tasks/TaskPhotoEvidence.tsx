import { useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { FarmTask } from '../../api/farm';
import { useOfflineQueue } from '../../offline/OfflineQueueContext';

const CHIEF_MAX_BYTES = 2 * 1024 * 1024;
const CLIENT_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const INITIAL_MAX_SIDE = 1280;

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Photo conversion failed on this device.')), 'image/png');
  });
}

async function stripCanvasMetadata(blob: Blob): Promise<Blob> {
  const raw = new Uint8Array(await blob.arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => raw[index] === byte)) throw new Error('Photo conversion did not produce PNG.');
  const view = new DataView(raw.buffer);
  const parts: BlobPart[] = [raw.slice(0, 8)];
  let ended = false;
  for (let offset = 8; offset < raw.length;) {
    if (offset + 12 > raw.length) throw new Error('Photo conversion produced a truncated PNG.');
    const end = offset + view.getUint32(offset) + 12;
    if (end > raw.length) throw new Error('Photo conversion produced a truncated PNG chunk.');
    const kind = String.fromCharCode(...raw.slice(offset + 4, offset + 8));
    if (['IHDR', 'IDAT', 'IEND'].includes(kind)) parts.push(raw.slice(offset, end));
    else if ((raw[offset + 4] & 32) === 0) throw new Error('Photo conversion produced an unsupported PNG format.');
    // Canvas encoders differ: discard ancillary colour/profile/text metadata
    // before hashing, while Chief still validates chunk CRCs and pixel bounds.
    if (kind === 'IEND') {
      if (end !== raw.length) throw new Error('Photo conversion produced trailing data.');
      ended = true;
    }
    offset = end;
  }
  if (!ended) throw new Error('Photo conversion produced an incomplete PNG.');
  return new Blob(parts, { type: 'image/png' });
}

async function decodePhoto(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; close: () => void }> {
  const snapshot = new Blob([await file.arrayBuffer()], { type: file.type });
  try {
    const bitmap = await createImageBitmap(snapshot);
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
  } catch {
    // Some browser builds cannot decode a File through createImageBitmap.
    // A local object URL uses the browser image decoder without a network upload.
    const url = URL.createObjectURL(snapshot);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('This browser could not decode the selected photo.'));
        image.src = url;
      });
      return { width: image.naturalWidth, height: image.naturalHeight, source: image, close: () => URL.revokeObjectURL(url) };
    } catch (cause) { URL.revokeObjectURL(url); throw cause; }
  }
}

async function normalisePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPEG or PNG photo.');
  if (file.size <= 0 || file.size > CLIENT_MAX_SOURCE_BYTES) throw new Error('Choose a photo no larger than 12 MiB.');

  const bitmap = await decodePhoto(file);
  try {
    const largest = Math.max(bitmap.width, bitmap.height);
    if (!largest || bitmap.width * bitmap.height > 40_000_000) throw new Error('Photo dimensions are too large for safe device processing.');
    let targetSide = Math.min(INITIAL_MAX_SIDE, largest);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const ratio = Math.min(1, targetSide / largest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Photo conversion is unavailable on this device.');
      context.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
      const png = await stripCanvasMetadata(await canvasBlob(canvas));
      if (png.size <= CHIEF_MAX_BYTES) return png;
      targetSide = Math.max(320, Math.floor(targetSide * 0.8));
    }
    throw new Error('Photo remains above Chief’s 2 MiB evidence limit after device conversion.');
  } finally {
    bitmap.close();
  }
}

export function TaskPhotoEvidence({ task, simulated }: { task: FarmTask; simulated: boolean }) {
  const { enqueueMedia, syncNow } = useOfflineQueue();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!task.evidence_required.includes('PHOTO')) return null;

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || simulated) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const png = await normalisePhoto(file);
      const queued = await enqueueMedia(task.task_id, png);
      if (!queued) throw new Error('Photo evidence was not durably queued on this device.');
      setMessage('Photo stored on this device. It is not Chief evidence until upload and authoritative reconciliation complete.');
      if (typeof navigator !== 'undefined' && navigator.onLine) await syncNow();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Photo evidence could not be prepared.');
    } finally {
      // Keep the selected File alive while WebKit decodes it; resetting the
      // input earlier can invalidate its backing data in that browser.
      input.value = '';
      setBusy(false);
    }
  };

  return (
    <div className="task-note">
      <strong>Required photo evidence</strong>
      <p className="muted small-text">The device removes image metadata, converts the photo to bounded PNG, and keeps it queued until Chief confirms the exact ID, SHA-256 and byte count.</p>
      <label className={`secondary-action ${busy || simulated ? 'disabled' : ''}`}>
        {busy ? <LoaderCircle size={17} aria-hidden="true" /> : <Camera size={17} aria-hidden="true" />}
        {busy ? 'Preparing photo…' : 'Take or choose photo'}
        <input
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          disabled={busy || simulated}
          onChange={event => void choose(event)}
          style={{ position: 'absolute', inlineSize: 1, blockSize: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </label>
      {message && <p className="muted small-text" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {message}</p>}
      {error && <p className="muted small-text" role="alert"><TriangleAlert size={15} aria-hidden="true" /> {error}</p>}
    </div>
  );
}
