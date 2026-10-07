import { useEffect, useState } from 'react';
import { Download, RefreshCw, Share } from 'lucide-react';
import { PWA_UPDATE_EVENT } from '../../pwa/register';
import './pwa.css';

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

export function PwaDevicePanel() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const update = (event: Event) => setUpdateRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener(PWA_UPDATE_EVENT, update);
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener(PWA_UPDATE_EVENT, update); };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  const activateUpdate = () => {
    const waiting = updateRegistration?.waiting;
    if (!waiting) return;
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    waiting.postMessage({ type: 'CHIEF_STAFF_ACTIVATE_UPDATE' });
  };

  return (
    <section className="card pwa-panel">
      <div className="eyebrow">Device app</div><h2>Install & updates</h2>
      <p className="muted small-text">Installation provides the CHIEF Staff app shell. It does not make Chief API state, task authority, or synchronization available offline.</p>
      {standalone ? <div className="pwa-status">Installed as an app on this device.</div> : promptEvent ? (
        <button type="button" className="primary-action" onClick={() => void install()}><Download size={18} /> Install CHIEF Staff</button>
      ) : isiOS ? (
        <div className="pwa-ios"><Share size={18} /><span>On iPhone/iPad, use Safari Share → Add to Home Screen when that option is available.</span></div>
      ) : <p className="muted tiny-text">This browser has not offered an install prompt. No install-ready state is being inferred.</p>}
      {updateRegistration?.waiting && <button type="button" className="secondary-action" onClick={activateUpdate}><RefreshCw size={18} /> Apply available app update</button>}
    </section>
  );
}
