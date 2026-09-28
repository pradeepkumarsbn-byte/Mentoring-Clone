import { mentoringClient } from '../../../lib/supabase';
import { useSupabase } from '../../../lib/backend';
const bucket='mentoring-private';
const headers={'Cache-Control':'private, no-store'};
async function context(request:Request){
 if(!useSupabase()) return {response:new Response('Not enabled',{status:404})};
 if(request.method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin) return {response:new Response('Origin not allowed',{status:403})};
 const client=await mentoringClient();const {data:role,error}=await client.rpc('mentoring_role');
 if(error||!role)return {response:new Response('Access denied',{status:403})};
 const boyId=new URL(request.url).searchParams.get('boyId')||'';
 if(!/^[a-zA-Z0-9_-]+$/.test(boyId))return {response:new Response('Invalid boy ID',{status:400})};
 const {data:boy}=await client.from('mentoring_records').select('id').eq('kind','boys').eq('id',boyId).maybeSingle();
 if(!boy)return {response:new Response('Boy not found',{status:404})};
 return {client,boyId};
}
export async function GET(request:Request){
 const c=await context(request);if(c.response)return c.response;
 const offset=Math.max(0,Number(new URL(request.url).searchParams.get('offset'))||0);
 const {data,error}=await c.client!.storage.from(bucket).list(c.boyId,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
 if(error)return new Response('Files could not be loaded',{status:502});
 const files=await Promise.all((data||[]).map(async file=>{const path=c.boyId+'/'+file.name;const {data:link}=await c.client!.storage.from(bucket).createSignedUrl(path,60);return {name:file.name.replace(/^[a-f0-9-]{36}--/,''),path,url:link?.signedUrl};}));
 return Response.json({files,hasMore:files.length===100},{headers});
}
export async function POST(request:Request){
 const c=await context(request);if(c.response)return c.response;
 let form;try{form=await request.formData();}catch{return new Response('Invalid file upload',{status:400});}const file=form.get('file');
 if(!(file instanceof File)||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>4*1024*1024||file.size===0)return new Response('Choose a JPG, PNG, WebP or PDF up to 4 MB.',{status:400});
 const name=file.name.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(-100);
 const {error}=await c.client!.storage.from(bucket).upload(c.boyId+'/'+crypto.randomUUID()+'--'+name,file,{contentType:file.type,upsert:false});
 if(error)return new Response('The file could not be uploaded.',{status:502});
 return Response.json({ok:true},{headers});
}
export async function DELETE(request:Request){
 const c=await context(request);if(c.response)return c.response;
 let body;try{body=await request.json();}catch{return new Response('Invalid request',{status:400});}const path=body?.path;
 if(typeof path!=='string'||!path.startsWith(c.boyId+'/')||path.slice(c.boyId!.length+1).includes('/'))return new Response('Invalid file',{status:400});
 const {error}=await c.client!.storage.from(bucket).remove([path]);
 if(error)return new Response('File could not be deleted',{status:502});
 return Response.json({ok:true},{headers});
}
