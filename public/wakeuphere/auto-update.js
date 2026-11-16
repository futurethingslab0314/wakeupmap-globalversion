// Shared with the Node regression tests; no browser dependencies until called.
function createWakeupHereUpdateChecker({ currentVersion, fetchVersion, canUpdate, onUpdate }) {
  let checking = false;
  let reloading = false;
  return async function checkForUpdate() {
    if (!currentVersion || checking || reloading) return;
    checking = true;
    try {
      const nextVersion = await fetchVersion();
      if (typeof nextVersion !== 'string' || !nextVersion.trim() ||
          nextVersion === currentVersion || !canUpdate()) return;
      await onUpdate(nextVersion);
      reloading = true;
    } catch {
      // A failed request must never interrupt the running device.
    } finally {
      checking = false;
    }
  };
}
