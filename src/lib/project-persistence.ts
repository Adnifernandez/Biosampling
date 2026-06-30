const KEY = "app-last-project";

export function saveLastProject(projectId: string) {
  try { localStorage.setItem(KEY, projectId); } catch {}
}

export function getLastProject(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
