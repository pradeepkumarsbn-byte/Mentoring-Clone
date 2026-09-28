import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseConfig } from './backend';
export async function mentoringClient() {
 const jar = await cookies(); const {url,key} = supabaseConfig();
 return createServerClient(url,key,{cookies:{
  getAll:()=>jar.getAll(),
  setAll:values=>{ try { for(const {name,value,options} of values) jar.set(name,value,options); } catch { /* Proxy refreshes cookies for Server Components. */ } },
 }});
}
