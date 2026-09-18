export async function bridgeUrl(){ return process.env.MENTORING_SHEETS_URL?.trim() || ""; }
export function validBridgeUrl(value:unknown):string {
 if(typeof value!=='string') throw new Error('Paste the Web app URL from Google Apps Script.');
 const u=new URL(value.trim());
 if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)||u.search||u.hash||u.username||u.password) throw new Error('Use the Google Apps Script Web app URL ending in /exec.');
 return u.href;
}
class TemporaryBridgeError extends Error {}
const readActions = new Set(['health', 'check_access', 'get_state']);
async function attempt(url:string,payload:Record<string,unknown>,token:string){
 const signal=AbortSignal.timeout(35000);
 let response=await fetch(validBridgeUrl(url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,token}),redirect:'manual',signal,cache:'no-store'});
 for(let hop=0;response.status>=300&&response.status<400;hop++){
  if(hop>=4)throw new Error('Google returned too many redirects. Check the Web app deployment.');
  const location=response.headers.get('location');
  if(!location)throw new Error('Google did not return a response location.');
  const next=new URL(location,response.url||url);
  if(next.protocol!=='https:'||next.hostname!=='script.googleusercontent.com'||next.username||next.password)throw new Error('Deploy as a Web app with access set to Anyone. The connection key protects requests.');
  await response.body?.cancel();
  // Only the original Google Apps Script POST receives the private key.
  response=await fetch(next.href,{redirect:'manual',signal,cache:'no-store'});
 }
 if(response.status===401||response.status===403)throw new Error('Google denied access. Check the Web app deployment permissions.');
 if([429,500,502,503,504].includes(response.status))throw new TemporaryBridgeError(`Google Sheets is temporarily unavailable (HTTP ${response.status}).`);
 if(!response.ok)throw new Error(`The Google Sheets connection could not be reached (HTTP ${response.status}).`);
 let data;try{data=await response.json() as Record<string,unknown>;}catch(error){if(signal.aborted)throw error;throw new Error('Google did not return valid data. Check the Web app deployment.');}
 if(data.ok===false||data.error)throw new Error(typeof data.error==='string'?data.error:'The spreadsheet request failed.');
 return data;
}
export async function bridgeRequest(url:string,payload:Record<string,unknown>){
 const token=process.env.MENTORING_SHEETS_TOKEN;
 if(!token)throw new Error('Connection key is not configured.');
 const readOnly=readActions.has(String(payload.action));
 for(let number=0;number<2;number++){
  try{return await attempt(url,payload,token);}catch(error){
   const temporary=error instanceof TemporaryBridgeError || (error instanceof Error && ['TimeoutError','AbortError','TypeError'].includes(error.name));
   // Never repeat a write: Google may have saved it before the response timed out.
   if(!readOnly||!temporary||number===1)throw error;
   await new Promise(resolve=>setTimeout(resolve,700+Math.random()*600));
  }
 }
 throw new Error('Google Sheets is temporarily unavailable.');
}
