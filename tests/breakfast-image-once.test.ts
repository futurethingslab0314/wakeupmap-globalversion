import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/wake-up-image';
const rich=(value:string)=>({type:'rich_text',rich_text:[{plain_text:value}]});
const job={pageId:'image-once-page',city:'Muscat',cityZh:'馬斯喀特',country:'Oman',countryZh:'阿曼',recordedAtIso:'2026-11-21T04:13:00Z',breakfastName:'Bread',breakfastNameZh:'麵包',breakfastDescription:'Local bread',breakfastDescriptionZh:'在地麵包',highlightIngredients:['bread']};
async function fixture(fn:(s:any,call:(body?:any)=>Promise<any>)=>Promise<void>){
 const previous=globalThis.fetch,env={...process.env};Object.assign(process.env,{NOTION_API_KEY:'fixture',NOTION_DATABASE_ID:'map-db',OPENAI_API_KEY:'fixture',OPENAI_IMAGE_MODEL:'gpt-image-2.5-flare',CLOUDFLARE_R2_ENDPOINT:'https://r2.once.invalid',CLOUDFLARE_R2_ACCESS_KEY_ID:'fixture',CLOUDFLARE_R2_SECRET_ACCESS_KEY:'fixture',CLOUDFLARE_R2_BUCKET:'bucket',CLOUDFLARE_R2_PUBLIC_URL:'https://images.once.invalid'});
 const s={page:{id:job.pageId,parent:{database_id:'map-db'},properties:{city:rich('Muscat'),country:rich('Oman'),recipe:rich(''),recipe_zh:rich(''),imageUrl:{type:'url',url:null},imagePrompt:rich('')}},objects:new Map<string,any>(),imageCalls:0,textCalls:0,failNotion:false,unknownImage:false,failImage:false,imageStatus:400,losePngAck:false,throttleFailure:false,throttlePng:false,holdImage:null as null|Promise<void>,puts:[] as any[]};let serial=0;
 globalThis.fetch=(async(url,options:any={})=>{
  const path=String(url),method=options.method||'GET';
  if(path.endsWith('/pages/'+job.pageId)){
   if(method==='GET')return Response.json(s.page);
   if(method==='PATCH'){
    if(s.failNotion)return Response.json({error:'fixture Notion outage'},{status:503});
    for(const [key,value]of Object.entries(JSON.parse(options.body).properties) as any){const type=Object.keys(value)[0];(s.page.properties as any)[key]={type,...value};if(value.rich_text)(s.page.properties as any)[key].rich_text=value.rich_text.map((p:any)=>({plain_text:p.text.content}));}
    return Response.json(s.page);
   }
  }
  if(path==='https://api.openai.com/v1/responses'){s.textCalls++;return Response.json({output_text:JSON.stringify({title:'Local bread',titleZh:'在地麵包',recipe:'Bread and coffee.',recipeZh:'麵包與咖啡。',highlightIngredients:['bread'],imagePrompt:'Top down local breakfast'})});}
  if(path==='https://api.openai.com/v1/images/generations'){
   s.imageCalls++;if(s.holdImage)await s.holdImage;if(s.unknownImage)throw Error('response lost');if(s.failImage)return Response.json({error:'fixture failure'},{status:s.imageStatus});
   return Response.json({data:[{b64_json:Buffer.from('fixture PNG bytes').toString('base64')}]});
  }
  if(path.startsWith('https://r2.once.invalid/')){
   const object=s.objects.get(path),headers=new Headers(options.headers);
   if(method==='GET'||method==='HEAD')return object?new Response(method==='HEAD'?null:object.bytes,{status:200,headers:{ETag:object.etag,'Content-Type':object.type}}):new Response(null,{status:404});
   if(method==='PUT'){
    if(s.throttleFailure&&path.endsWith('/job.json')&&JSON.parse(Buffer.from(options.body).toString()).phase==='failed'){s.throttleFailure=false;return new Response(null,{status:429});}
    if(s.throttlePng&&headers.get('content-type')==='image/png'){s.throttlePng=false;return new Response(null,{status:429});}
    if(headers.get('if-none-match')==='*'&&object)return new Response(null,{status:412});
    if(headers.get('if-match')&&headers.get('if-match')!==object?.etag)return new Response(null,{status:412});
    const value={bytes:Buffer.from(options.body),etag:'"v'+(++serial)+'"',type:headers.get('content-type')};s.objects.set(path,value);s.puts.push({path,headers});if(s.losePngAck&&value.type==='image/png'){s.losePngAck=false;throw Error('upload response lost');}return new Response(null,{status:200,headers:{ETag:value.etag}});
   }
  }
  throw Error('Unexpected request '+method+' '+path);
 }) as typeof fetch;
 const call=async(body:any=job)=>{const response={code:200,data:null as any,status(code:number){this.code=code;return this},json(data:any){this.data=data;return this},setHeader(){}};await handler({method:'POST',body},response);return response;};
 try{await fn(s,call)}finally{globalThis.fetch=previous;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
}
test('ordinary map images return their saved URL without another image-model request',async()=>fixture(async(s,call)=>{
 s.page.properties.imageUrl.url='https://images.once.invalid/original.png';s.page.properties.recipe=rich('Stored recipe');
 const r=await call({...job,city:'Dubai'});assert.equal(r.code,200);assert.equal(r.data.imageUrl,'https://images.once.invalid/original.png');assert.equal(s.imageCalls,0);assert.equal(s.textCalls,0);
}));
test('an existing picture is reused even when its recipe is missing',async()=>fixture(async(s,call)=>{
 s.page.properties.imageUrl.url='https://images.once.invalid/original.png';
 const r=await call();assert.equal(r.code,200);assert.equal(r.data.imageUrl,'https://images.once.invalid/original.png');assert.equal(s.imageCalls,0);
}));
test('concurrent requests have one persistent image owner',async()=>fixture(async(s,call)=>{
 let release!:()=>void;s.holdImage=new Promise<void>(r=>release=r);
 const first=call();while(!s.imageCalls)await new Promise(r=>setTimeout(r,1));
 const second=await call();assert.equal(second.data.pending,true);assert.equal(s.imageCalls,1);
 release();const done=await first;assert.equal(done.code,200,JSON.stringify(done.data));
 const again=await call();assert.equal(again.data.imageUrl,done.data.imageUrl);assert.equal(s.imageCalls,1);
 assert(s.puts.some((p:any)=>p.headers.get('if-none-match')==='*'));
}));
test('a failed Notion write recovers the stored image and recipe without regeneration',async()=>fixture(async(s,call)=>{
 s.failNotion=true;assert.equal((await call()).code,500);assert.equal(s.imageCalls,1);assert([...s.objects.values()].some(o=>o.type==='image/png'));
 s.failNotion=false;const r=await call({...job,recordedAtIso:'2099-01-01T00:00:00Z'});assert.equal(r.code,200,JSON.stringify(r.data));assert.equal(s.imageCalls,1);assert.equal(s.textCalls,1);assert.match(s.page.properties.recipe.rich_text[0].plain_text,/Bread/);
}));
test('an unknown provider outcome is never automatically requested a second time',async()=>fixture(async(s,call)=>{
 s.unknownImage=true;assert.equal((await call()).code,500);assert.equal(s.imageCalls,1);
 s.unknownImage=false;const retry=await call();assert.equal(retry.data.pending,true);assert.equal(s.imageCalls,1);
}));
test('a confirmed unsuccessful image response may retry because no image was created',async()=>fixture(async(s,call)=>{
 s.failImage=true;assert.equal((await call()).code,500);s.failImage=false;assert.equal((await call()).code,200);assert.equal(s.imageCalls,2);
}));

test('an already stored PNG is reused even when its receipt was lost',async()=>fixture(async(s,call)=>{
 const first=await call();assert.equal(first.code,200);
 for(const key of s.objects.keys())if(key.endsWith('/job.json'))s.objects.delete(key);
 s.page.properties.imageUrl.url=null;
 const retry=await call();assert.equal(retry.code,200);assert.equal(retry.data.imageUrl,first.data.imageUrl);assert.equal(s.imageCalls,1);
}));

test('a lost upload response retries the same bytes without overwriting or generating another image',async()=>fixture(async(s,call)=>{
 s.losePngAck=true;const result=await call();assert.equal(result.code,200,JSON.stringify(result.data));assert.equal(s.imageCalls,1);
 const images=s.puts.filter((put:any)=>put.headers.get('content-type')==='image/png');assert.equal(images.length,1);
 assert(images.every((put:any)=>put.headers.get('if-none-match')==='*'&&put.headers.get('authorization').includes('if-none-match')));
}));

test('temporary receipt throttling does not strand a confirmed failed request',async()=>fixture(async(s,call)=>{
 s.throttleFailure=true;s.failImage=true;assert.equal((await call()).code,500);
 s.failImage=false;assert.equal((await call()).code,200);assert.equal(s.imageCalls,2);
}));
test('temporary image-storage throttling retries storage rather than image generation',async()=>fixture(async(s,call)=>{
 s.throttlePng=true;const r=await call();assert.equal(r.code,200,JSON.stringify(r.data));assert.equal(s.imageCalls,1);
}));

test('a provider server error is an uncertain result, not permission to generate a second image',async()=>fixture(async(s,call)=>{
 s.failImage=true;s.imageStatus=503;assert.equal((await call()).code,500);
 s.failImage=false;const retry=await call();assert.equal(retry.data.pending,true);assert.equal(s.imageCalls,1);
}));
