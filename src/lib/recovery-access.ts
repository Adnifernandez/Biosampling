// Users allowed to open /recuperar (recover unsynced field data from the device)
const RECOVERY_EMAILS = new Set(["alvaro.esparza@dss.cl", "adni.fernandez@dss.cl"]);

export function canRecover(email?: string | null): boolean {
  return !!email && RECOVERY_EMAILS.has(email.toLowerCase());
}
