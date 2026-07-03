// ==========================================================================
// Haptics manager — wraps navigator.vibrate with an enable/disable toggle
// ==========================================================================

let enabled = true;

function loadPref() {
  const stored = localStorage.getItem("haptics.enabled");
  enabled = stored === null ? true : stored === "true";
}

loadPref();

const haptics = {
  vibrate(pattern) {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (err) {
      console.warn("haptics: vibrate failed", err);
    }
  },

  setEnabled(value) {
    enabled = Boolean(value);
    localStorage.setItem("haptics.enabled", String(enabled));
  },

  isEnabled() {
    return enabled;
  },
};

export { haptics };
