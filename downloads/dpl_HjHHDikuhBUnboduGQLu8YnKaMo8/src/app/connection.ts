export async function bridgeUrl(){ return process.env.MENTORING_SHEETS_URL?.trim() || ""; }
export function validBridgeUrl(value:unknown):string {
 if(typeof value!=='string') throw new Error('Paste the Web app URL from Google Apps Script.');
 const u=new URL(value.trim());
 if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)||u.search||u.hash||u.username||u.password) throw new Error('Use the Google Apps Script Web app URL ending in /exec.');
 return u.href;
}
class TemporaryBridgeError extends Error {}
const readActions = new Set(['health', 'check_access', 'get_state']);
const pendingReads = new Map<string, Promise<Record<string, unknown>>>();
async function attempt(url:string,payload:Record<string,unknown>,token:string,timeoutMs:number){
 const signal=AbortSignal.timeout(timeoutMs);
 let retrievingContent=false;
 let response=await fetch(validBridgeUrl(url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,token}),redirect:'manual',signal,cache:'no-store'});
 for(let hop=0;response.status>=300&&response.status<400;hop++){
  // Release every redirect response, including rejected destinations, without
  // blocking retrieval of the one-time URL on transport cleanup.
  void response.body?.cancel().catch(()=>{});
  if(hop>=4)throw new Error('Google returned too many redirects. Check the Web app deployment.');
  const location=response.headers.get('location');
  if(!location)throw new Error('Google did not return a response location.');
  const next=new URL(location,response.url||url);
  // A temporary ContentService URL can bounce back to Google's script host.
  // Do not follow it or replay a write; reads may obtain a fresh response URL.
  if(retrievingContent&&next.origin==='https://script.google.com'&&!next.username&&!next.password)throw new TemporaryBridgeError('Google could not deliver the spreadsheet response. Please retry.');
  if(next.protocol!=='https:'||next.hostname!=='script.googleusercontent.com'||next.username||next.password)throw new Error('Deploy as a Web app with access set to Anyone. The connection key protects requests.');
  // Only the original Google Apps Script POST receives the private key.
  // ContentService returns 302 to a temporary URL. Retrieve its JSON with GET,
  // without replaying the original POST or persisting this temporary URL.
  // Disable Next's data cache without Node's cache:'no-store', which adds
  // HTTP cache-revalidation headers to Google's one-time content URL.
  response=await fetch(next.href,{method:'GET',redirect:'manual',signal,next:{revalidate:0}});
  retrievingContent=true;
 }
 if(!response.ok)void response.body?.cancel().catch(()=>{});
 if(response.status===401||response.status===403)throw new Error('Google denied access. Check the Web app deployment permissions.');
 if(retrievingContent&&response.status===404)throw new TemporaryBridgeError('Google could not deliver the spreadsheet response. Please retry.');
 if([429,500,502,503,504].includes(response.status))throw new TemporaryBridgeError(`Google Sheets is temporarily unavailable (HTTP ${response.status}).`);
 if(!response.ok)throw new Error(`The Google Sheets connection could not be reached (HTTP ${response.status}).`);
 let body:unknown;try{body=await response.json();}catch(error){if(signal.aborted)throw error;throw new Error('Google did not return valid data. Check the Web app deployment.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Google did not return a JSON object. Check the Web app deployment.');
 const data=body as Record<string,unknown>;
 if(data.ok===false||data.error)throw new Error(typeof data.error==='string'?data.error:'The spreadsheet request failed.');
 return data;
}
export async function bridgeRequest(url:string,payload:Record<string,unknown>){
 const token=process.env.MENTORING_SHEETS_TOKEN;
 if(!token)throw new Error('Connection key is not configured.');
 const endpoint=validBridgeUrl(url);
 const readOnly=!payload.operation&&typeof payload.action==='string'&&readActions.has(payload.action);
 // Coalesce only simultaneous, identical reads. Never cache an access decision
 // or a completed response, and never share reads across connection keys/users.
 if(!readOnly){
  pendingReads.clear();
  try{return await attempt(endpoint,payload,token,35000);}
  finally{pendingReads.clear();}
 }
 const key=JSON.stringify([endpoint,token,payload]);
 const pending=pendingReads.get(key);
 if(pending)return pending;
 const request=retryRead(endpoint,payload,token);
 pendingReads.set(key,request);
 try{return await request;}
 finally{if(pendingReads.get(key)===request)pendingReads.delete(key);}
}
async function retryRead(url:string,payload:Record<string,unknown>,token:string){
 // Two bridge calls in the route must fit within its 180-second limit.
 const deadline=Date.now()+75000;
 for(let number=0;number<3;number++){
  const remaining=deadline-Date.now();
  if(remaining<=0)throw new TemporaryBridgeError('Google Sheets is temporarily unavailable.');
  try{return await attempt(url,payload,token,Math.min(25000,remaining));}catch(error){
   const temporary=error instanceof TemporaryBridgeError || (error instanceof Error && ['TimeoutError','AbortError','TypeError'].includes(error.name));
   // Only read actions reach this retry loop.
   if(!temporary||number===2)throw error;
   await new Promise(resolve=>setTimeout(resolve,Math.min(700*2**number+Math.random()*600,Math.max(0,deadline-Date.now()))));
  }
 }
 throw new Error('Google Sheets is temporarily unavailable.');
}
