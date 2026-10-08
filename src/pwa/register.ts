import { isChiefStaffDevMode } from '../config/devMode';

export const PWA_UPDATE_EVENT = 'chief-staff-pwa-update';

async function retireLegacyRootWorker(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    const script = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
    const scopePath = new URL(reg.scope).pathname;
    if (scopePath === '/' && script.endsWith('/sw.js')) await reg.unregister();
  }
}

export async function registerStaffServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try { await retireLegacyRootWorker(); } catch {}
  if (isChiefStaffDevMode()) return;
  try {
    const base = import.meta.env.BASE_URL;
    if (base !== '/staff/') throw new Error('CHIEF Staff production base path mismatch.');
    const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    const announceWaiting = () => {
      if (registration.waiting) window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT, { detail: registration }));
    };
    announceWaiting();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announceWaiting();
      });
    });
  } catch {
    // Installation failure must not change Chief connectivity or synchronization state.
  }
}
