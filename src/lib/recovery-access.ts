// Users allowed to open /recuperar (recover unsynced field data from the device)
const RECOVERY_EMAILS = new Set(["alvaro.esparza@dss.cl", "adni.fernandez@dss.cl"]);

export function canRecover(email?: string | null): boolean {
  return !!email && RECOVERY_EMAILS.has(email.toLowerCase());
}

// Users who may also delete unsynced records from their own device (e.g. records
// whose campaign no longer exists on the server and can never be uploaded)
const DELETE_LOCAL_EMAILS = new Set(["adni.fernandez@dss.cl"]);

export function canDeleteLocal(email?: string | null): boolean {
  return !!email && DELETE_LOCAL_EMAILS.has(email.toLowerCase());
}
