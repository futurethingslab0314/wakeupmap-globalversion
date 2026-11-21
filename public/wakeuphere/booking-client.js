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

// Content is independent of reservation order: a failed breakfast must not block
// another day's content, nor reservation/cancellation writes in the booking FIFO.
function createWakeupHereContentQueue({ read, write, send, onState = () => {} }) {
  let pending = [];
  try {
    const saved = read();
    if (Array.isArray(saved)) pending = saved.filter((job, index, all) =>
      job && typeof job.pageId === 'string' && job.pageId.trim() &&
      all.findIndex(other => other && other.pageId === job.pageId) === index)
      .map(job => ({ pageId: job.pageId }));
  } catch {}
  const completed = new Set();
  let flushing = null;
  const notify = state => { try { onState(state); } catch {} };
  const save = () => { try { write(pending.map(job => ({ ...job }))); } catch {} };
  function flush() {
    if (flushing) return flushing;
    if (!pending.length) return Promise.resolve(true);
    flushing = (async () => {
      const attempted = new Set();
      let job;
      while ((job = pending.find(item => !attempted.has(item.pageId)))) {
        attempted.add(job.pageId);
        notify('pending');
        try {
          await send(job);
          completed.add(job.pageId);
          pending = pending.filter(item => item.pageId !== job.pageId);
          save();
        } catch { /* Keep this job durable, but allow other jobs to proceed. */ }
      }
      notify(pending.length ? 'error' : 'synced');
      return pending.length === 0;
    })().finally(() => { flushing = null; });
    return flushing;
  }
  return {
    enqueue(job) {
      if (!job || typeof job.pageId !== 'string' || !job.pageId.trim()) return Promise.resolve(false);
      if (!completed.has(job.pageId) && !pending.some(item => item.pageId === job.pageId)) {
        pending.push({ pageId: job.pageId }); save();
      }
      return flush();
    },
    flush,
    isBusy: () => Boolean(flushing),
  };
}
