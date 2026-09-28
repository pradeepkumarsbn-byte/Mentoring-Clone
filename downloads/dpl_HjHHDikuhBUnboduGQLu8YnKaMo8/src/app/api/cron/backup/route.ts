import {runBackup,privateHeaders} from '../../../../lib/backups';
export const maxDuration=180;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 try{const b=await runBackup('daily:'+new Date().toISOString().slice(0,10),'Daily automatic backup');
  return Response.json({id:b.id,status:b.status},{status:b.status==='complete'?200:503,headers:privateHeaders});
 }catch{return Response.json({error:'Daily backup failed. Check backup history.'},{status:500,headers:privateHeaders});}
}
