import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/wakeuphere';

const text = (value: string) => ({ rich_text: value ? [{ plain_text: value }] : [] });
const schema = {
  userName: { type: 'title' }, setup_city: { type: 'rich_text' }, setup_city_zh: { type: 'rich_text' },
  setup_country: { type: 'rich_text' }, setup_country_zh: { type: 'rich_text' }, press: { type: 'checkbox' },
  wakeuphere_active: { type: 'checkbox' }, wakeuphere_updated_at: { type: 'date' },
};
function page(id: string, user: string, city: string, updated: string, active: boolean | null = true, country = 'USA') {
  return { id, created_time: updated, last_edited_time: updated, properties: {
    userName: { title: [{ plain_text: user }] }, setup_city: text(city), setup_city_zh: text(''),
    setup_country: text(country), setup_country_zh: text(''), press: { checkbox: false },
    ...(active === null ? {} : { wakeuphere_active: { checkbox: active }, wakeuphere_updated_at: { date: { start: updated } } }),
  }};
}

async function backend(pages: any[], fn: (request: Function, writes: any[]) => Promise<void>, initialSchema: any = schema) {
  const previousFetch = globalThis.fetch, previousKey = process.env.NOTION_API_KEY, previousDB = process.env.WAKEUPHERE_PAGE_ID;
  process.env.NOTION_API_KEY = 'fixture-key'; process.env.WAKEUPHERE_PAGE_ID = 'fixture-db';
  let properties = structuredClone(initialSchema); const writes: any[] = [];
  globalThis.fetch = (async (url, options: any = {}) => {
    const path = String(url), method = options.method || 'GET';
    if (path.endsWith('/databases/fixture-db') && method === 'GET') return Response.json({ properties });
    if (path.endsWith('/databases/fixture-db') && method === 'PATCH') {
      const body = JSON.parse(options.body); writes.push({ method, path, ...body });
      properties = { ...properties, ...Object.fromEntries(Object.entries(body.properties).map(([name, value]: any) => [name, { type: Object.keys(value)[0] }])) };
      return Response.json({ properties });
    }
    if (path.endsWith('/query')) {
      const body = JSON.parse(options.body), offset = Number(body.start_cursor || 0), chunk = pages.slice(offset, offset + 2);
      return Response.json({ results: chunk, has_more: offset + 2 < pages.length, next_cursor: String(offset + 2) });
    }
    if (path.includes('/pages')) {
      const body = JSON.parse(options.body); writes.push({ method, path, ...body });
      let target = method === 'PATCH' ? pages.find(row => path.endsWith('/' + row.id)) : null;
      if (!target) { target = page('new-' + pages.length, '', '', new Date().toISOString()); pages.push(target); }
      for (const [name, value] of Object.entries(body.properties) as any) {
        target.properties[name] = structuredClone(value);
        for (const kind of ['title','rich_text']) if (value[kind])
          target.properties[name][kind] = value[kind].map((part: any) => ({ plain_text: part.text.content }));
      }
      target.last_edited_time = new Date().toISOString();
      return Response.json({ id: target.id });
    }
    throw Error('Unexpected Notion request: ' + path);
  }) as typeof fetch;
  async function request(method: string, body?: any, query = '') {
    let status = 200, data: any; const headers: Record<string, unknown> = {};
    const response = { status(code: number) { status = code; return this; },
      json(value: any) { data = value; }, setHeader(name: string, value: any) { headers[name] = value; } };
    await handler({ method, body, url: '/api/wakeuphere' + query }, response);
    return { status, data, headers };
  }
  try { await fn(request, writes); }
  finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.NOTION_API_KEY; else process.env.NOTION_API_KEY = previousKey;
    if (previousDB === undefined) delete process.env.WAKEUPHERE_PAGE_ID; else process.env.WAKEUPHERE_PAGE_ID = previousDB;
  }
}

test('deduplicates by account before filtering city; only latest active bookings appear', async () => {
  await backend([
    page('old', 'Alice', 'Anchorage', '2026-11-01T00:00:00Z'),
    page('new', 'Alice', 'Taipei', '2026-11-20T00:00:00Z', true, 'Taiwan'),
    page('bob', 'Bob', 'Anchorage', '2026-11-19T00:00:00Z'),
    page('cancel-old','Carol','Anchorage','2026-11-01T00:00:00Z'),
    page('cancel-new','Carol','Anchorage','2026-11-21T00:00:00Z',false),
    page('legacy','Legacy','Anchorage','2026-11-21T01:00:00Z',null),
  ], async request => {
    const result = await request('GET', undefined, '?setup_city=Anchorage&setup_country=USA');
    assert.equal(result.status,200); assert.deepEqual(result.data.users,['Bob']);
    assert.equal(result.headers['Cache-Control'],'no-store');
    assert.equal(result.data.pageCount,1);
  });
});
test('moving city updates latest account row and removes it from the old city', async () => {
  await backend([page('old','Alice','Anchorage','2026-11-01T00:00:00Z'),page('latest','Alice','Boston','2026-11-20T00:00:00Z')], async (request,writes) => {
    const result = await request('POST',{ action:'reserve', userName:'Alice',setup_city:'Taipei',setup_country:'Taiwan' });
    assert.equal(result.status,200); assert(writes.some(w => w.path.endsWith('/pages/latest')));
    assert.deepEqual((await request('GET',undefined,'?setup_city=Anchorage')).data.users,[]);
    assert.deepEqual((await request('GET',undefined,'?setup_city=Taipei&setup_country=Taiwan')).data.users,['Alice']);
  });
});
test('cancel marks newest inactive; older active rows cannot reappear; reserve reactivates', async () => {
  await backend([page('old','Alice','Anchorage','2026-11-01T00:00:00Z'),page('latest','Alice','Anchorage','2026-11-20T00:00:00Z')],async request => {
    assert.equal((await request('POST',{action:'cancel',userName:'Alice',setup_city:'Anchorage',setup_country:'USA'})).status,200);
    assert.deepEqual((await request('GET',undefined,'?setup_city=Anchorage')).data.users,[]);
    await request('POST',{action:'reserve',userName:'Alice',setup_city:'Anchorage',setup_country:'USA'});
    assert.deepEqual((await request('GET',undefined,'?setup_city=Anchorage')).data.users,['Alice']);
  });
});
test('stale device cancel or dismiss cannot undo a newer city selection', async () => {
  await backend([page('latest','Alice','Taipei','2026-11-20T00:00:00Z',true,'Taiwan')], async (request,writes) => {
    for (const action of ['cancel','dismiss']) {
      const r = await request('POST',{action,userName:'Alice',setup_city:'Anchorage',setup_country:'USA',press:'yes'});
      assert.equal(r.data.ignored,true);
    }
    assert.equal(writes.length,0);
    assert.deepEqual((await request('GET',undefined,'?setup_city=Taipei')).data.users,['Alice']);
  });
});
test('country disambiguates same-named cities', async () => {
  await backend([page('a','Alice','Cambridge','2026-11-20T00:00:00Z',true,'USA'),page('b','Bob','Cambridge','2026-11-20T00:00:00Z',true,'UK')],async request => {
    assert.deepEqual((await request('GET',undefined,'?setup_city=Cambridge&setup_country=UK')).data.users,['Bob']);
  });
});
test('explicit booking timestamp wins over unrelated later edits to history', async () => {
  const history = page('history','Alice','Anchorage','2026-11-01T00:00:00Z'); history.last_edited_time='2026-11-21T00:00:00Z';
  await backend([history,page('current','Alice','Taipei','2026-11-20T00:00:00Z',true,'Taiwan')],async request => {
    assert.deepEqual((await request('GET',undefined,'?setup_city=Anchorage')).data.users,[]);
  });
});
test('first reservation provisions additive metadata and does not require manual schema changes', async () => {
  const initial = {...schema}; delete initial.wakeuphere_active; delete initial.wakeuphere_updated_at;
  delete initial.setup_country; delete initial.setup_country_zh;
  await backend([],async (request,writes) => {
    assert.equal((await request('POST',{action:'reserve',userName:'Alice',setup_city:'Anchorage',setup_country:'USA'})).status,200);
    assert(writes.some(w => w.path.endsWith('/databases/fixture-db') && w.properties.wakeuphere_active));
    assert.deepEqual((await request('GET',undefined,'?setup_city=Anchorage&setup_country=USA')).data.users,['Alice']);
  },initial);
});

test('dismissing the daily alarm keeps the reservation active without changing its booking timestamp', async () => {
  const record=page('current','Alice','Anchorage','2026-11-20T00:00:00Z');
  await backend([record],async request=>{
    const result=await request('POST',{action:'dismiss',userName:'Alice',setup_city:'Anchorage',setup_country:'USA',press:'yes'});
    assert.equal(result.status,200);assert.equal(record.properties.press.checkbox,true);
    assert.equal(record.properties.wakeuphere_updated_at.date.start,'2026-11-20T00:00:00Z');
    assert.deepEqual((await request('GET',undefined,'?setup_city=Anchorage')).data.users,['Alice']);
  });
});
test('conflicting metadata field types fail visibly without replacing existing columns', async () => {
  await backend([],async(request,writes)=>{
    const result=await request('POST',{action:'reserve',userName:'Alice',setup_city:'Anchorage',setup_country:'USA'});
    assert.equal(result.status,500);assert.equal(writes.length,0);
  },{...schema,wakeuphere_active:{type:'rich_text'}});
});
test('invalid requests do not create fallback accounts or mutate data', async () => {
  await backend([],async(request,writes)=>{
    assert.equal((await request('POST',{action:'reserve',setup_city:'Anchorage'})).status,400);
    assert.equal(writes.length,0);
  });
});

test('map view exposes only latest active canonical targets and city-local scheduled dates without changing roster response',async()=>{
  await backend([
    page('old','YuPie','Anchorage','2026-11-01T00:00:00Z',true,'United States'),
    page('latest','YuPie','Dubai','2026-11-20T00:00:00Z',true,'United Arab Emirates'),
    page('cancelled','Bob','Dubai','2026-11-20T00:00:00Z',false,'United Arab Emirates'),
    page('invalid','Invalid','Imaginary City','2026-11-20T00:00:00Z',true,'Nowhere'),
  ],async request=>{
    const result=await request('GET',undefined,'?view=map');
    assert.equal(result.status,200);assert.equal(result.data.reservations.length,1);
    const target=result.data.reservations[0];
    assert.equal(target.userName,'YuPie');assert.equal(target.city,'Dubai');
    assert.equal(target.timeZone,'Asia/Dubai');assert.equal(typeof target.latitude,'number');
    assert.equal(typeof target.longitude,'number');assert.match(target.scheduledAt,/T04:00:00.000Z$/);
    assert.equal(result.headers['Cache-Control'],'no-store');
    const roster=await request('GET',undefined,'?setup_city=Dubai&setup_country=United%20Arab%20Emirates');
    assert.deepEqual(roster.data.users,['YuPie']);assert.equal(roster.data.reservations,undefined);
  });
});

test('reloading an unchanged active reservation preserves its original booking time for the local-day map',async()=>{
 const original='2026-11-20T00:00:00Z';
 await backend([page('existing','YuPie','Dubai',original,true,'United Arab Emirates')],async(request,writes)=>{
  const response=await request('POST',{action:'reserve',userName:'YuPie',setup_city:'Dubai',setup_country:'United Arab Emirates'});
  assert.equal(response.status,200);
  const patch=writes.find(write=>write.path.endsWith('/pages/existing'));
  assert(!patch.properties.wakeuphere_updated_at || patch.properties.wakeuphere_updated_at.date.start===original);
  assert.equal((await request('GET',undefined,'?view=map')).data.reservations.length,1);
 });
});
