import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

function setup() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../public/wakeuphere/auto-update.js', import.meta.url), 'utf8'), context);
  let version = 'build-a', updates = 0, blocked = false, fail = false;
  const check = context.createWakeupHereUpdateChecker({
    currentVersion: 'build-a',
    fetchVersion: async () => { if (fail) throw Error('offline'); return version; },
    canUpdate: () => !blocked,
    onUpdate: () => { updates++; },
  });
  return { check, setVersion: v => version = v, block: v => blocked = v,
    fail: v => fail = v, count: () => updates };
}

test('unchanged or invalid version does not reload', async () => {
  const s = setup(); await s.check(); s.setVersion(null); await s.check();
  s.setVersion(''); await s.check(); assert.equal(s.count(), 0);
});
test('a new deployment reloads only once', async () => {
  const s = setup(); s.setVersion('build-b'); await s.check(); await s.check();
  assert.equal(s.count(), 1);
});
test('ringing defers an update until it is safe', async () => {
  const s = setup(); s.setVersion('build-b'); s.block(true); await s.check();
  assert.equal(s.count(), 0); s.block(false); await s.check(); assert.equal(s.count(), 1);
});
test('network failure leaves the screen running and retries later', async () => {
  const s = setup(); s.fail(true); await s.check(); assert.equal(s.count(), 0);
  s.fail(false); s.setVersion('build-b'); await s.check(); assert.equal(s.count(), 1);
});

test('built HTML starts a 60-second checker with its embedded deployment ID', () => {
  const version = '12345678-1234-1234-1234-123456789abc';
  const html = readFileSync(new URL('../public/wakeuphere/index.html', import.meta.url), 'utf8')
    .replaceAll('__WAKEUPHERE_BUILD__', version);
  const source = html.slice(html.indexOf('    function startDeploymentUpdateChecks()'), html.indexOf('    // Startup'));
  let checked = 0, interval;
  const context = vm.createContext({
    document: { querySelector: () => ({ content: version }) },
    createWakeupHereUpdateChecker: options => {
      assert.equal(options.currentVersion, version);
      return () => checked++;
    },
    setInterval: (fn, ms) => { interval = ms; },
    window: { addEventListener() {} },
  });
  vm.runInContext(source + '\nstartDeploymentUpdateChecks();', context);
  assert.equal(checked, 1); assert.equal(interval, 60000);
});

test('confirmed city is restored after update, stale identity is not', () => {
  const html = readFileSync(new URL('../public/wakeuphere/index.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('    const UPDATE_STATE_KEY'), html.indexOf('    function startDeploymentUpdateChecks()'));
  const storage = new Map(); let stage;
  const context = vm.createContext({
    getStoredUserName: () => 'YUTING', currentStage: 3,
    selectedContinent: { id: 'asia' }, selectedCountry: { name_en: 'Taiwan' },
    selectedCity: { name_en: 'Taipei' },
    locationsByContinent: [{ id: 'asia' }],
    locationsByCountry: { asia: [{ name_en: 'Taiwan', cities: [{ name_en: 'Taipei', coords: [25, 121] }] }] },
    sessionStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) },
    map: { setView() {} }, STAGE_ZOOMS: [2,5,10], setStage: value => stage = value,
  });
  vm.runInContext(source, context);
  assert.equal(vm.runInContext('saveSelectionForUpdate(); restoreSelectionAfterUpdate()', context), true);
  assert.equal(stage, 3); assert.equal(storage.size, 0);
  context.getStoredUserName = () => 'OTHER';
  storage.set('wakeuphere.updateSelection', JSON.stringify({ userName: 'YUTING', stage: 3 }));
  assert.equal(vm.runInContext('restoreSelectionAfterUpdate()', context), false);
});
