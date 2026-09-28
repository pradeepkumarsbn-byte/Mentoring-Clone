import { mentoringClient } from '../../../lib/supabase';
import { useSupabase } from '../../../lib/backend';
export async function GET(request:Request) {
 const url=new URL(request.url); const code=url.searchParams.get('code');
 if(!useSupabase()) return Response.redirect(new URL('/login',url.origin));
 if(code) {const client=await mentoringClient();const {error}=await client.auth.exchangeCodeForSession(code);
  if(!error) return Response.redirect(new URL(url.searchParams.get('next')==='password'?'/auth/update-password':'/',url.origin));}
 return Response.redirect(new URL('/login?error=signin',url.origin));
}
