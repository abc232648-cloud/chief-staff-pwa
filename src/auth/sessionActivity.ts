/** Session checks never imply human activity. All authority remains in Chief. */
export function watchSession(activity: () => Promise<unknown>, check: () => Promise<unknown>) {
  let lastActivity = Number.NEGATIVE_INFINITY;
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const interaction = (event: Event) => {
    if (!event.isTrusted || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastActivity < 60_000) return;
    lastActivity = now;
    void activity();
  };
  const inspect = () => { void check(); };
  for (const event of events) document.addEventListener(event, interaction, { passive: true });
  window.addEventListener('focus', inspect);
  const timer = window.setInterval(inspect, 30_000);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', inspect);
    for (const event of events) document.removeEventListener(event, interaction);
  };
}
