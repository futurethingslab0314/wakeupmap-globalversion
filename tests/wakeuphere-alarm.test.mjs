import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function api() {
  const ctx = vm.createContext({ Intl, Date });
  vm.runInContext(fs.readFileSync(new URL('../public/wakeuphere/alarm-scheduler.js', import.meta.url), 'utf8'), ctx);
  return ctx.WakeupHereAlarm;
}
const ms = value => Date.parse(value);
test('Anchorage winter 08:00 is Taipei next-day 01:00', () => {
  assert.equal(api().nextMorning(ms('2026-11-16T13:12:00Z'), 'America/Anchorage'), ms('2026-11-16T17:00:00Z'));
});
test('after 08:00 schedules the next local day, including month/year rollover', () => {
  assert.equal(api().nextMorning(ms('2026-12-31T17:00:01Z'), 'America/Anchorage'), ms('2027-01-01T17:00:00Z'));
});
test('spring DST and autumn DST use the offset of the target day', () => {
  const a = api();
  assert.equal(a.nextMorning(ms('2026-03-07T18:00:00Z'), 'America/Anchorage'), ms('2026-03-08T16:00:00Z'));
  assert.equal(a.nextMorning(ms('2026-10-31T17:00:00Z'), 'America/Anchorage'), ms('2026-11-01T17:00:00Z'));
});
test('fractional offsets and date line zones', () => {
  const a = api();
  assert.equal(a.nextMorning(ms('2026-11-16T00:00:00Z'), 'Asia/Kathmandu'), ms('2026-11-16T02:15:00Z'));
  assert.equal(a.nextMorning(ms('2026-11-16T12:00:00Z'), 'Pacific/Kiritimati'), ms('2026-11-16T18:00:00Z'));
});
test('ticks ring once at or after the deadline; dismiss prevents same-day replay after reload', () => {
  const a = api(), start = ms('2026-11-16T16:59:59Z'), due = start + 1000;
  const alarm = a.create('America/Anchorage', start);
  assert.equal(alarm.tick(start), false);
  assert.equal(alarm.tick(due), true);
  assert.equal(alarm.tick(due + 1000), false);
  assert.equal(alarm.snapshot().pendingAt, due);
  alarm.dismiss();
  const restored = a.create('America/Anchorage', due + 2000, alarm.snapshot());
  assert.equal(restored.tick(due + 3000), false);
  assert.equal(restored.tick(ms('2026-11-17T17:00:00Z')), true);
});
test('late browser wake and pending alarms survive reload', () => {
  const a = api(), before = ms('2026-11-16T16:59:00Z'), late = ms('2026-11-16T17:04:00Z');
  const alarm = a.create('America/Anchorage', before);
  const restored = a.create('America/Anchorage', late, alarm.snapshot());
  assert.equal(restored.tick(late), true);
  const pending = a.create('America/Anchorage', late + 1000, restored.snapshot());
  assert.equal(pending.snapshot().pendingAt, ms('2026-11-16T17:00:00Z'));
  assert.equal(pending.tick(late + 2000), false);
});
test('invalid zone is rejected rather than scheduling in the Pi timezone', () => {
  const alarm = api();
  assert.throws(() => alarm.nextMorning(Date.now(), 'Not/AZone'));
});

test('corrupt or wrong-zone saved state is replaced by a fresh next morning', () => {
  const a = api(), now = ms('2026-11-16T18:00:00Z');
  const state = a.create('America/Anchorage', now, {
    timeZone: 'Asia/Taipei', nextAt: now - 1, lastFiredAt: null, pendingAt: null,
  });
  assert.equal(state.snapshot().nextAt, ms('2026-11-17T17:00:00Z'));
  assert.equal(state.tick(now), false);
});
