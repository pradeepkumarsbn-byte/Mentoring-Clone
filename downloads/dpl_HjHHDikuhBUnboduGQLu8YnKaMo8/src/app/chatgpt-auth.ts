import { auth, authConfigured } from "../auth";
import { useSupabase } from '../lib/backend';
import { mentoringClient } from '../lib/supabase';
export async function getChatGPTUser() {
  if(useSupabase()) {
    const client=await mentoringClient();const {data,error}=await client.auth.getClaims();
    if(error||typeof data?.claims.email!=='string') return null;
    const email=data.claims.email.trim().toLowerCase();
    return {email,displayName:email,fullName:null};
  }
  if (!authConfigured()) return null;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return { email, displayName: session?.user?.name || email, fullName: session?.user?.name || null };
}
export function chatGPTSignInPath(_returnTo: string) { return "/login"; }
