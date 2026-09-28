import {requireAdmin,runBackup,backupDownload,privateHeaders} from '../../../lib/backups';
export const maxDuration=180;
export async function GET(request:Request){
 let client;try{client=await requireAdmin(request);}catch{return Response.json({error:'Administrator access required'},{status:403,headers:privateHeaders});}
 try{const id=new URL(request.url).searchParams.get('id');if(id)return Response.json(await backupDownload(id),{headers:privateHeaders});
  const {data,error}=await client.from('mentoring_backups').select('id,created_at,reason,status,error').order('created_at',{ascending:false}).limit(100);if(error)throw Error('Could not load backup history');
  return Response.json({backups:data,schedule:'Daily, between 07:30 and 08:30 India time',retention:'Backups are retained until you choose to remove them from storage.'},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Backup unavailable'},{status:502,headers:privateHeaders});}
}
export async function POST(request:Request){
 try{await requireAdmin(request);}catch{return Response.json({error:'Administrator access required'},{status:403});}
 try{const body=await request.json();if(typeof body.requestId!=='string'||!/^[\da-f-]{36}$/i.test(body.requestId))throw Error('Request ID required');
  const b=await runBackup('manual:'+body.requestId,'Manual backup');return Response.json({id:b.id,status:b.status},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Backup failed'},{status:400,headers:privateHeaders});}
}
