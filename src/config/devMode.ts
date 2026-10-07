export const isChiefStaffDevMode = (): boolean =>
  import.meta.env.VITE_CHIEF_STAFF_DEV_MODE === 'true';
