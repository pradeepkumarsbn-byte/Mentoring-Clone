import {redirect} from 'next/navigation';
import {mentoringClient} from '../../../lib/supabase';
import {useSupabase} from '../../../lib/backend';
import DataTools from './tools';
export const dynamic='force-dynamic';
export default async function DataPage(){if(!useSupabase())redirect('/');const client=await mentoringClient();const {data}=await client.rpc('mentoring_role');if(data!=='admin')redirect('/login');return <DataTools/>;}
