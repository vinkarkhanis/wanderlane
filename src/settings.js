export function loadSettings() {
  try {
    // Preserve preferences saved before the game was renamed.
    const saved = localStorage.getItem("wanderlane-settings");
    const legacy =
      saved === null ? localStorage.getItem("milelight-settings") : null;
    const v = JSON.parse(saved ?? legacy ?? "{}");
    if (legacy && v && typeof v === "object" && !Array.isArray(v)) {
      saveSettings(v);
    }
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
export function saveSettings(value) {
  try {
    localStorage.setItem("wanderlane-settings", JSON.stringify(value));
  } catch {
    /* Storage is optional in private or embedded contexts. */
  }
}
