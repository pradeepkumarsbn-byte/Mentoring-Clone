import {requireAdmin,runBackup,privateHeaders} from '../../../lib/backups';
import {validateTransfer} from '../../../lib/data-transfer';
export const maxDuration=180;
export async function GET(request:Request){
 let client;try{client=await requireAdmin(request);}catch{return Response.json({error:'Administrator access required'},{status:403});}
 const {data,error}=await client.rpc('mentoring_export');if(error)return Response.json({error:'Export failed'},{status:502,headers:privateHeaders});
 return Response.json(data,{headers:privateHeaders});
}
export async function POST(request:Request){
 let client;try{client=await requireAdmin(request);}catch{return Response.json({error:'Administrator access required'},{status:403});}
 try{
  const text=await request.text();if(new TextEncoder().encode(text).length>3*1024*1024)throw Error('Import must be smaller than 3 MB. Split CSV files into smaller batches.');
  const body=JSON.parse(text),payload=validateTransfer(body.payload);
  if(body.mode==='preview'){
   const {data,error}=await client.rpc('mentoring_import_preview',{p_payload:payload});if(error)throw Error(error.code==='P0001'?error.message:'Invalid data: check IDs, dates and duplicate attendance.');
   return Response.json(data,{headers:privateHeaders});
  }
  if(body.mode!=='apply'||typeof body.requestId!=='string'||!/^[\da-f-]{36}$/i.test(body.requestId)||typeof body.fingerprint!=='string')throw Error('Preview the import before applying it');
  const b=await runBackup('import:'+body.requestId,'Before import / restore');if(b.status!=='complete')throw Error('The safety backup is not complete. Import has not started.');
  const {data,error}=await client.rpc('mentoring_import',{p_payload:payload,p_expected:body.fingerprint,p_request_id:body.requestId});
  if(error)throw Error(error.code==='P0001'?error.message:'Import failed. No records were changed.');
  return Response.json({...data,backupId:b.id},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Import failed'},{status:400,headers:privateHeaders});}
}
