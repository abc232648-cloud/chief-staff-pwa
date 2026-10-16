export type PersistenceState = 'persistent' | 'best-effort' | 'unsupported' | 'unknown';

export interface PersistenceResult {
  state: PersistenceState;
  canRequest: boolean;
}

type PersistenceStorage = Pick<StorageManager, 'persisted'> & Partial<Pick<StorageManager, 'persist'>>;

function browserStorage(): PersistenceStorage | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

/** Persistence reduces automatic eviction risk; it is neither encryption nor a backup. */
export async function inspectPersistence(storage = browserStorage()): Promise<PersistenceResult> {
  if (!storage || typeof storage.persisted !== 'function') {
    return { state: 'unsupported', canRequest: false };
  }
  try {
    const persisted = await storage.persisted();
    if (persisted !== true && persisted !== false) return { state: 'unknown', canRequest: false };
    return {
      state: persisted ? 'persistent' : 'best-effort',
      canRequest: !persisted && typeof storage.persist === 'function'
    };
  } catch {
    return { state: 'unknown', canRequest: false };
  }
}

/** Only call following an explicit user request; never during automatic inspection. */
export async function requestPersistence(storage = browserStorage()): Promise<PersistenceResult> {
  const before = await inspectPersistence(storage);
  if (!before.canRequest || !storage?.persist) return before;
  try {
    await storage.persist();
    // Re-read browser state instead of treating a request as a guarantee.
    return await inspectPersistence(storage);
  } catch {
    return { state: 'unknown', canRequest: false };
  }
}

export const persistenceText: Record<PersistenceState, string> = {
  persistent: 'This browser reports persistent storage. Unsynced records can still be lost if you clear site data or lose this device.',
  'best-effort': 'This browser may automatically remove local records when storage is needed. Send pending records to Chief when you can.',
  unsupported: 'This browser cannot report storage persistence. Unsynced records may be lost; send them to Chief when you can.',
  unknown: 'Storage persistence could not be checked. No protection from automatic removal has been confirmed.'
};
