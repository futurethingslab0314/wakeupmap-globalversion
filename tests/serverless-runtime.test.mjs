import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtemp, mkdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

// Exercise emitted JS with Node's production ESM loader, without tsx resolving source extensions.
test('compiled serverless API entrypoints load and handle requests without a TypeScript loader', async () => {
 const root=await mkdtemp(join(tmpdir(),'wakeup-serverless-test-'));
 const files=['api/notion-data.ts','api/wakeuphere.ts','api/wake-up-now.ts','src/wakeAcknowledgement.ts','src/server/services/wakeuphereAcknowledgement.ts','src/reservationMap.ts','src/server/services/wakeuphereMapBookings.ts'];
 try {
  await writeFile(join(root,'package.json'),'{"type":"module"}');
  await cp('cities_data.json',join(root,'cities_data.json'));
  for(const file of files){
   const out=join(root,file.replace(/\.ts$/,'.js'));
   await mkdir(dirname(out),{recursive:true});
   await writeFile(out,ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
  }
  for(const endpoint of ['notion-data','wakeuphere']){
   const {default:handler}=await import(pathToFileURL(join(root,`api/${endpoint}.js`)));
   assert.equal(typeof handler,'function');
   const response={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
   await handler({method:'DELETE',query:{}},response);
   assert.equal(response.statusCode,405);
   if(endpoint==='wakeuphere'){
    const oldFetch=globalThis.fetch,oldKey=process.env.NOTION_API_KEY,oldDb=process.env.WAKEUPHERE_PAGE_ID;
    process.env.NOTION_API_KEY='test';process.env.WAKEUPHERE_PAGE_ID='test';
    const text=(value)=>({rich_text:[{plain_text:value}]});
    globalThis.fetch=async url=>Response.json(String(url).endsWith('/query')?{results:[{id:'fixture-booking',properties:{userName:{title:[{plain_text:'YuPie'}]},setup_city:text('Dubai'),setup_country:text('United Arab Emirates'),wakeuphere_active:{checkbox:true},wakeuphere_updated_at:{date:{start:'2020-01-01T00:00:00Z'}}}}],has_more:false}:{properties:{userName:{type:'title'},setup_city:{type:'rich_text'},setup_country:{type:'rich_text'}}});
    try{
     await handler({method:'GET',url:'/api/wakeuphere?view=map'},response);
     assert.equal(response.statusCode,200);assert.equal(response.body.reservations.length,1);
     assert.equal(response.body.reservations[0].timeZone,'Asia/Dubai');
     assert.equal(typeof response.body.reservations[0].latitude,'number');
    } finally{
     globalThis.fetch=oldFetch;
     if(oldKey===undefined)delete process.env.NOTION_API_KEY;else process.env.NOTION_API_KEY=oldKey;
     if(oldDb===undefined)delete process.env.WAKEUPHERE_PAGE_ID;else process.env.WAKEUPHERE_PAGE_ID=oldDb;
    }
   }
  }
 } finally {await rm(root,{recursive:true,force:true});}
});

test('the manifest icon exists at its absolute public path as an SVG image',async()=>{
 const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
 for(const icon of manifest.icons){
  const data=await readFile(join('public',icon.src),'utf8');
  assert.match(data,/<svg\b/);assert.doesNotMatch(data,/<!doctype html>/i);
 }
});
