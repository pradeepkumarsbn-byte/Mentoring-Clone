import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {mentoringClient} from './supabase';
import {useSupabase} from './backend';
import type {Transfer} from './data-transfer';
export const privateHeaders={'Cache-Control':'private, no-store'};
export type BackupFile={path:string;metadata?:{mimetype?:string;size?:number};url?:string};
export type Backup={id:string;status:string;created_at:string;reason:string;payload:Transfer;files:BackupFile[];error?:string};
export function backupService(){
 const url=process.env.MENTORING_SUPABASE_URL,key=process.env.MENTORING_SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Backup service is not configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function requireAdmin(request:Request){
 if(!useSupabase())throw Error('Not enabled');
 if(request.method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('Request origin not allowed');
 const client=await mentoringClient();const {data,error}=await client.rpc('mentoring_role');
 if(error||data!=='admin')throw Error('Administrator access required');return client;
}
export async function runBackup(key:string,reason:string):Promise<Backup>{
 const service=backupService(),id=crypto.randomUUID();
 const {data,error}=await service.rpc('mentoring_backup_capture',{p_id:id,p_key:key,p_reason:reason});
 if(error)throw Error('Could not create database snapshot');const backup=data as Backup;
 if(backup.id!==id)return backup;
 try{
  for(const file of backup.files){const {error:copyError}=await service.storage.from('mentoring-private').copy(file.path,id+'/'+file.path,{destinationBucket:'mentoring-backups'});if(copyError)throw Error('A file could not be copied. The backup is incomplete.');}
  const {error:finishError}=await service.from('mentoring_backups').update({status:'complete'}).eq('id',id);if(finishError)throw Error('Could not mark backup complete');
  return {...backup,status:'complete'};
 }catch{await service.from('mentoring_backups').update({status:'failed',error:'Backup did not complete. Create a new backup to retry.'}).eq('id',id);throw Error('Backup did not complete. No data was changed.');}
}
export async function backupDownload(id:string){
 const service=backupService();const {data,error}=await service.from('mentoring_backups').select('*').eq('id',id).single();
 if(error||data.status!=='complete')throw Error('Completed backup not found');const b=data as Backup;
 const files:BackupFile[]=[];
 for(const file of b.files){const {data:link,error:linkError}=await service.storage.from('mentoring-backups').createSignedUrl(id+'/'+file.path,600);if(linkError)throw Error('Could not prepare file download');files.push({...file,url:link.signedUrl});}
 return {backup:b.payload,files};
}
