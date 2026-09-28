import { redirect } from 'next/navigation';
import { mentoringClient } from '../../lib/supabase';
import { useSupabase } from '../../lib/backend';
import Manager from './manager';
export const dynamic='force-dynamic';
export default async function Manage(){
 if(!useSupabase()) redirect('/');
 const client=await mentoringClient();const {data,error}=await client.rpc('mentoring_role');
 if(error||data!=='admin') return <main className="page-shell"><h1>Administrator access required</h1><a href="/login">Sign in</a></main>;
 return <Manager/>;
}
