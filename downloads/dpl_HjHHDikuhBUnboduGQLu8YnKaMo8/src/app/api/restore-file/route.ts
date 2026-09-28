import {requireAdmin,backupService,privateHeaders} from '../../../lib/backups';
import {validFilePath} from '../../../lib/data-transfer';
export async function POST(request:Request){
 let client;try{client=await requireAdmin(request);}catch{return Response.json({error:'Administrator access required'},{status:403});}
 try{const form=await request.formData(),path=form.get('path'),file=form.get('file');
  if(!validFilePath(path)||!(file instanceof File)||file.size===0||file.size>4194304||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw Error('Invalid backup file');
  const {data:boy}=await client.from('mentoring_records').select('id').eq('kind','boys').eq('id',path.split('/')[0]).maybeSingle();if(!boy)throw Error('Restore the boy record before restoring its files');
  const service=backupService();const {data:existing}=await service.storage.from('mentoring-private').download(path);
  if(existing){const equal=existing.size===file.size&&Buffer.from(await existing.arrayBuffer()).equals(Buffer.from(await file.arrayBuffer()));if(!equal)throw Error('A different file already exists at this path. Nothing was overwritten.');return Response.json({status:'already present'},{headers:privateHeaders});}
  const {error}=await service.storage.from('mentoring-private').upload(path,file,{contentType:file.type,upsert:false});if(error)throw Error('File restore failed. Retry the restore to resume.');
  return Response.json({status:'restored'},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'File restore failed'},{status:400,headers:privateHeaders});}
}
