import { useEffect, useState } from 'react';

type Item = { event_id: string; title: string; body: string; created_at: string; source_agent: string };
type Configuration = { configured: boolean; public_key: string };

export function DeviceNotifications({ surface }: { surface: 'owner' | 'staff' }) {
  const [items, setItems] = useState<Item[]>([]);
  const [config, setConfig] = useState<Configuration>({ configured: false, public_key: '' });
  const [message, setMessage] = useState('Loading notification settings…');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const base = `/api/device-notifications/${surface}/`;
  async function request<T>(action: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      const session = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      if (!session.ok) throw Error('Sign in again to change device notifications.');
      headers['X-Chief-CSRF'] = (await session.json()).csrf;
      headers['Content-Type'] = 'application/json';
    }
    const result = await fetch(base + action, { credentials: 'include', cache: 'no-store',
      method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!result.ok) throw Error('Notifications unavailable. Check your connection and sign-in.');
    return result.json() as Promise<T>;
  }
  async function subscription() {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.getRegistration(`/${surface}/`);
    if (!registration || new URL(registration.scope).pathname !== `/${surface}/` || !('pushManager' in registration)) return null;
    return registration;
  }
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [settings, feed] = await Promise.all([request<Configuration>('status'), request<{ items: Item[] }>('feed')]);
        if (cancelled) return;
        setConfig(settings); setItems(feed.items); setLoaded(true);
        setMessage(settings.configured ? 'Delivery settings are configured. Enable alerts on this device; real delivery still needs a device check.' : 'Background delivery is not configured on this Chief installation. Recent notifications remain available here.');
        if (settings.configured) {
          const existing = await (await subscription())?.pushManager.getSubscription();
          if (existing && !cancelled) {
            const result = await request<{ after_timeout: boolean }>('subscription', existing.toJSON());
            if (!cancelled) setEnabled(result.after_timeout);
          }
        }
      } catch (error) { if (!cancelled) { setItems([]); setLoaded(false); setMessage((error as Error).message); } }
    })();
    return () => { cancelled = true; };
  }, [surface]);
  async function enable() {
    setBusy(true);
    try {
      if (!('Notification' in window) || !('PushManager' in window)) throw Error('Background notifications are unavailable in this browser. On supported iPhones/iPads, install this PWA on the Home Screen first.');
      if (await Notification.requestPermission() !== 'granted') throw Error('Notification permission was not granted. You can change it in browser settings.');
      const registration = await subscription();
      if (!registration?.active) throw Error('The installed workspace is not ready. Reload and try again.');
      const padded = config.public_key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - config.public_key.length % 4) % 4);
      const key = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
      const current = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await request('subscription', { ...current.toJSON(), after_timeout: true });
      setEnabled(true); setMessage('Device registered. Generic alerts may continue after timeout; this does not prove a notification has reached this device.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      const current = await (await subscription())?.pushManager.getSubscription();
      if (current) {
        await request('unsubscribe', { endpoint: current.endpoint });
        if (!await current.unsubscribe()) throw Error('Chief delivery stopped; browser removal needs another attempt.');
      }
      setEnabled(false); setMessage('Background alerts disabled on this device.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card" aria-label="Device notifications">
    <h2>Notifications</h2>
    <p>Opt in to generic device alerts after session timeout. Sign in to see details. Signing out, switching accounts or losing access stops delivery. Notifications never approve or execute work.</p>
    <p role="status">{message}</p>
    <button type="button" disabled={busy || !config.configured} onClick={() => void enable()}>{enabled ? 'Renew notification consent' : 'Enable device alerts'}</button>
    <button type="button" disabled={busy} onClick={() => void disable()}>Disable device alerts</button>
    <h3>Recent notifications</h3>
    {loaded && !items.length && <p>No notifications available for your current access.</p>}
    {items.map(item => <article key={item.event_id}><strong>{item.title}</strong><p>{item.body}</p><time>{item.created_at}</time></article>)}
  </section>;
}
