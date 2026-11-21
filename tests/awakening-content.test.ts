import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/wake-up-now';
import imageHandler from '../api/wake-up-image';
const rich=(value:string)=>({type:'rich_text',rich_text:[{plain_text:value}]});
const eventPage=()=>({id:'awake-1',parent:{database_id:'map-db'},properties:{userName:{type:'title',title:[{plain_text:'YuPie'}]},city:rich('Muscat'),city_zh:rich('馬斯喀特'),country:rich('Oman'),country_zh:rich('阿曼'),latitude:{type:'number',number:23.61},longitude:{type:'number',number:58.59},greeting:rich('AWAKE // 已醒來'),story:rich('WakeUpHere alarm acknowledged.'),story_zh:rich('已按下確認'),wakeuphere_event_id:rich('event-1'),wakeuphere_pressed_at:{type:'date',date:{start:'2026-11-21T04:01:05Z'}},wakeuphere_scheduled_at:{type:'date',date:{start:'2026-11-21T04:00:00Z'}},wakeuphere_user_name:rich('YuPie'),wakeuphere_target_city:rich('Dubai'),wakeuphere_distance_km:{type:'number',number:358.4}}});
async function fixture(fn:(s:any,call:(body:any,which?:typeof handler)=>Promise<any>)=>Promise<void>){
 const previousFetch=globalThis.fetch,env={...process.env};
 Object.assign(process.env,{NOTION_API_KEY:'fixture',NOTION_DATABASE_ID:'map-db',OPENAI_API_KEY:'fixture',CLOUDFLARE_R2_ENDPOINT:'https://r2.fixture.invalid',CLOUDFLARE_R2_ACCESS_KEY_ID:'fixture',CLOUDFLARE_R2_SECRET_ACCESS_KEY:'fixture',CLOUDFLARE_R2_BUCKET:'images',CLOUDFLARE_R2_PUBLIC_URL:'https://images.fixture.invalid'});
 const state={page:eventPage() as any,ai:[] as any[],patches:[] as any[],created:0,failImage:false};
 const concept={name:'Omani breakfast',nameZh:'阿曼早餐',description:'A local morning meal',descriptionZh:'在地早餐',highlightIngredients:['bread'],breakfastCategory:'bread',sceneSetting:'home table',visualAnchors:['cup'],avoidRepeats:[]};
 globalThis.fetch=(async(url,options:any={})=>{
  const path=String(url),method=options.method||'GET';
  if(path.endsWith('/pages/awake-1')&&method==='GET')return Response.json(state.page);
  if(path.endsWith('/databases/map-db')&&method==='GET')return Response.json({properties:state.page.properties});
  if(path.endsWith('/databases/map-db')&&method==='PATCH'){
   const body=JSON.parse(options.body);for(const [key,value]of Object.entries(body.properties) as any)state.page.properties[key]={type:Object.keys(value)[0],[Object.keys(value)[0]]:[]};
   return Response.json({properties:state.page.properties});
  }
  if(path.endsWith('/pages/awake-1')&&method==='PATCH'){
   const body=JSON.parse(options.body);state.patches.push(body.properties);
   for(const [key,value]of Object.entries(body.properties) as any){const type=Object.keys(value)[0];state.page.properties[key]={type,...value};if(value.rich_text)state.page.properties[key].rich_text=value.rich_text.map((p:any)=>({plain_text:p.text.content}));}
   return Response.json(state.page);
  }
  if(path.endsWith('/pages')&&method==='POST'){state.created++;throw Error('Must not create another awakening');}
  if(path==='https://api.openai.com/v1/responses'){
   const body=JSON.parse(options.body);state.ai.push(body);
   const format=body.text?.format?.name;
   let value:any='صباح الخير';
   if(format==='wake_up_story')value={story:'Today you wake up in Muscat, Oman. Morning light crosses the harbour.',storyZh:'今天的你甦醒在阿曼的馬斯喀特。晨光照亮港灣。',tone:'warm',motifs:['harbour','morning']};
   else if(format==='local_breakfast')value=concept;
   else if(format==='breakfast_recipe')value={title:'Omani breakfast',titleZh:'阿曼早餐',recipe:'Bread with coffee.',recipeZh:'麵包搭配咖啡。',highlightIngredients:['bread'],imagePrompt:'Top down meal'};
   else if(format)throw Error('Unexpected AI format: '+format);
   return Response.json({output_text:typeof value==='string'?value:JSON.stringify(value)});
  }
  if(path==='https://api.openai.com/v1/images/generations'){
   state.ai.push(JSON.parse(options.body));if(state.failImage)return Response.json({error:'fixture failure'},{status:503});
   return Response.json({data:[{b64_json:Buffer.from('fixture png').toString('base64')}]});
  }
  if(path.startsWith('https://r2.fixture.invalid/')&&method==='PUT')return new Response('',{status:200});
  throw Error('Unexpected request '+method+' '+path);
 }) as typeof fetch;
 const call=async(body:any,which=handler)=>{const response={code:200,data:null as any,status(code:number){this.code=code;return this},json(data:any){this.data=data;return this},setHeader(){}};await which({method:'POST',body},response);return response;};
 try{await fn(state,call)}finally{globalThis.fetch=previousFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
}
test('fills the original actual city with local greeting, introduction and persisted breakfast job without changing the awakening',async()=>fixture(async(s,call)=>{
 const frozen=structuredClone(s.page.properties);
 const response=await call({action:'complete-awakening',pageId:'awake-1'});
 assert.equal(response.code,200);assert.equal(response.data.imageJob.city,'Muscat');assert.equal(response.data.imageJob.pageId,'awake-1');assert.equal(response.data.imageJob.recordedAtIso,'2026-11-21T04:01:05.000Z');assert.equal(response.data.imageJob.awakeningRecord,true);
 assert.equal(s.created,0);assert.equal(s.page.properties.greeting.rich_text[0].plain_text,'صباح الخير');assert.match(s.page.properties.story.rich_text[0].plain_text,/Muscat/);
 for(const key of ['latitude','longitude','wakeuphere_pressed_at','wakeuphere_scheduled_at','wakeuphere_target_city','wakeuphere_distance_km','wakeuphere_event_id','userName'])assert.deepEqual(s.page.properties[key],frozen[key],key);
 assert(s.ai.every((q:any)=>!q.input||q.input.includes('Muscat')));
 const count=s.ai.length;const retry=await call({action:'complete-awakening',pageId:'awake-1'});
 assert.equal(retry.code,200);assert.deepEqual(retry.data.imageJob,response.data.imageJob);assert.equal(s.ai.length,count);
}));
test('image failure can resume the cached job; completed image is reused without generating a new one',async()=>fixture(async(s,call)=>{
 const prepared=await call({action:'complete-awakening',pageId:'awake-1'});assert.equal(prepared.code,200);
 s.failImage=true;assert.equal((await call(prepared.data.imageJob,imageHandler as any)).code,500);
 s.failImage=false;const count=s.ai.length;
 const retry=await call({action:'complete-awakening',pageId:'awake-1'});assert.equal(s.ai.length,count);
 const image=await call(retry.data.imageJob,imageHandler as any);assert.equal(image.code,200,JSON.stringify(image.data));
 assert(s.ai.filter((call:any)=>call.prompt).every((call:any)=>call.model==='gpt-image-2.5-flare'));
 assert.match(s.page.properties.imageUrl.url,/images.fixture.invalid/);assert.match(s.page.properties.recipe.rich_text[0].plain_text,/Bread/);
 const completed=await call({action:'complete-awakening',pageId:'awake-1'});assert.equal(completed.data.complete,true);
 const after=s.ai.length;assert.equal((await call(retry.data.imageJob,imageHandler as any)).code,200);assert.equal(s.ai.length,after);assert.equal(s.created,0);
}));
test('does not enrich a non-awakening page or a page outside the main map database',async()=>fixture(async(s,call)=>{
 s.page.parent.database_id='another-db';assert.notEqual((await call({action:'complete-awakening',pageId:'awake-1'})).code,200);
 s.page.parent.database_id='map-db';delete s.page.properties.wakeuphere_event_id;
 assert.notEqual((await call({action:'complete-awakening',pageId:'awake-1'})).code,200);assert.equal(s.ai.length,0);assert.equal(s.patches.length,0);
}));
