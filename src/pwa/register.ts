import { isChiefStaffDevMode } from '../config/devMode';

export const PWA_UPDATE_EVENT = 'chief-staff-pwa-update';

export async function registerStaffServiceWorker(): Promise<void> {
  if (isChiefStaffDevMode() || !('serviceWorker' in navigator)) return;
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
