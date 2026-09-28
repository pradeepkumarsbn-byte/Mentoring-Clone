import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig,useSupabase } from './lib/backend';
export async function proxy(request:NextRequest) {
 let response=NextResponse.next({request});
 if(!useSupabase()) return response;
 const {url,key}=supabaseConfig();
 const client=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{
  for(const {name,value} of values) request.cookies.set(name,value);
  response=NextResponse.next({request});
  for(const {name,value,options} of values) response.cookies.set(name,value,options);
 }}});
 await client.auth.getClaims();
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/','/login','/auth/:path*','/manage/:path*','/api/mentoring','/api/manage','/api/files','/api/spreadsheet']};
