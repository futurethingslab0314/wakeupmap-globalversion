// Notion stores the prepared job. Reopening after a reload resumes the same page.
const inFlight = new Map<string, Promise<void>>();
export function ensureAwakeningContent(pageId:string, options:{fetcher?:typeof fetch;onTextReady?:()=>Promise<unknown>}={}):Promise<void>{
  const existing=inFlight.get(pageId);if(existing)return existing;
  const fetcher=options.fetcher||fetch;
  const post=async(path:string,body:unknown)=>{
    const response=await fetcher(path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(70000)});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok)throw Error(payload?.error||`Awakening content request failed (${response.status})`);
    return payload;
  };
  const promise=(async()=>{
    const prepared=await post('/api/wake-up-now',{action:'complete-awakening',pageId});
    if(prepared.complete)return;
    if(!prepared.imageJob)throw Error('Awakening breakfast job is missing');
    // Text is ready before the slower image; a display refresh must not cancel the job.
    try{await options.onTextReady?.();}catch{}
    await post('/api/wake-up-image',prepared.imageJob);
  })().finally(()=>inFlight.delete(pageId));
  inFlight.set(pageId,promise);return promise;
}
