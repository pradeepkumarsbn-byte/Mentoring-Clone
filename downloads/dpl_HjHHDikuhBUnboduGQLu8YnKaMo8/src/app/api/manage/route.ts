import { mentoringClient } from '../../../lib/supabase';
import { useSupabase } from '../../../lib/backend';
import { supabaseWrite } from '../../../lib/supabase-api';
export async function GET(request:Request) {
 if(!useSupabase()) return new Response('Not enabled',{status:404});
 const client=await mentoringClient();const {data:role,error:roleError}=await client.rpc('mentoring_role');
 if(roleError||role!=='admin') return new Response('Admin access required',{status:403});
 const kind=new URL(request.url).searchParams.get('kind') || 'calendarEvents';
 if(!['mentors','programTypes','calendarEvents','websiteSettings','access'].includes(kind)) return new Response('Invalid section',{status:400});
 const query=kind==='access'?client.from('mentoring_access').select('email,name,role,active').order('email'):client.from('mentoring_records').select('id,data').eq('kind',kind).order('position');
 const {data,error}=await query;
 if(error) return new Response('Could not load records',{status:502});
 return Response.json({records:kind==='access'?data?.map(row=>({...row,id:(row as unknown as {email:string}).email})):data?.map(row=>(row as unknown as {data:unknown}).data)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request) {
 if(!useSupabase()) return new Response('Not enabled',{status:404});
 return supabaseWrite(request);
}
