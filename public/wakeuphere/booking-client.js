// A small durable FIFO: cancel/move must never overtake an earlier reservation.
function createWakeupHereBookingQueue({ read, write, send, onState = () => {} }) {
  let pending = [];
  try { const saved = read(); if (Array.isArray(saved)) pending = saved.filter(item => item && typeof item === 'object'); } catch {}
  let flushing = null;
  const notify = state => { try { onState(state); } catch {} };
  const save = () => { try { write(pending.map(item => ({ ...item }))); } catch {} };
  function flush() {
    if (flushing) return flushing;
    if (!pending.length) return Promise.resolve(true);
    flushing = (async () => {
      while (pending.length) {
        notify('pending');
        try { await send(pending[0]); }
        catch { notify('error'); return false; }
        pending.shift();
        save();
      }
      notify('synced');
      return true;
    })().finally(() => { flushing = null; });
    return flushing;
  }
  return {
    enqueue(payload) { pending.push({ ...payload }); save(); return flush(); },
    flush,
  };
}
