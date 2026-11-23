// Calendar-based daily alarms. Never use the Pi's timezone or add a fixed 24h
// across daylight-saving changes. Pure functions allow deterministic tests.
var WakeupHereAlarm = (() => {
  const formatters = new Map();
  function parts(epoch, zone) {
    if (!Number.isFinite(epoch)) throw new RangeError('Invalid alarm time');
    if (!formatters.has(zone)) {
      if (typeof zone !== 'string' || !zone) throw new RangeError('Missing city timezone');
      formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }));
    }
    return Object.fromEntries(formatters.get(zone).formatToParts(new Date(epoch))
      .filter(item => item.type !== 'literal').map(item => [item.type, Number(item.value)]));
  }
  function wallTime(p) {
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  function resolveMorning(year, month, day, zone) {
    const target = Date.UTC(year, month - 1, day, 8);
    let instant = target;
    for (let i = 0; i < 6; i++) {
      const difference = target - wallTime(parts(instant, zone));
      if (difference === 0) return instant;
      instant += difference;
    }
    throw new RangeError('Cannot resolve local 08:00 in this timezone');
  }
  function nextMorning(now, zone) {
    const local = parts(now, zone);
    const today = resolveMorning(local.year, local.month, local.day, zone);
    if (today >= now) return today;
    return resolveMorning(local.year, local.month, local.day + 1, zone);
  }
  function create(zone, now, saved) {
    // Validate the zone even when restoring a stored timestamp.
    parts(now, zone);
    const valid = saved && saved.timeZone === zone &&
      Number.isFinite(saved.nextAt) && saved.nextAt > 0 &&
      (saved.lastFiredAt === null || Number.isFinite(saved.lastFiredAt)) &&
      (saved.pendingAt === null || Number.isFinite(saved.pendingAt));
    const state = valid ? { timeZone: zone, nextAt: saved.nextAt,
      lastFiredAt: saved.lastFiredAt, pendingAt: saved.pendingAt } :
      { timeZone: zone, nextAt: nextMorning(now, zone), lastFiredAt: null, pendingAt: null };
    return {
      tick(time) {
        if (state.pendingAt !== null || time < state.nextAt) return false;
        state.pendingAt = state.lastFiredAt = state.nextAt;
        state.nextAt = nextMorning(time + 1, zone);
        return true;
      },
      dismiss() { state.pendingAt = null; },
      confirm(scheduledAt) {
        if (scheduledAt === state.pendingAt && scheduledAt !== null) {
          state.pendingAt = null;
          return true;
        }
        if (scheduledAt !== state.nextAt) return false;
        state.nextAt = nextMorning(scheduledAt + 1, zone);
        return true;
      },
      snapshot() { return { ...state }; },
    };
  }
  return { nextMorning, create };
})();
