import {mentoringClient} from '../../../lib/supabase';
import {useSupabase} from '../../../lib/backend';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const reply=(message:string,status=400)=>Response.json({message},{status,headers});
 if(!useSupabase())return reply('Password login is not enabled yet.',404);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply('Request origin not allowed.',403);
 let body;try{body=await request.json();}catch{return reply('Invalid request.');}
 if(!body||typeof body!=='object')return reply('Invalid request.');
 const {mode,password}=body;const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!['signin','signup','reset','update'].includes(mode))return reply('Invalid request.');
 if(mode!=='update'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return reply('Enter a valid email address.');
 if(mode!=='reset'&&(typeof password!=='string'||password.length<(mode==='signin'?1:12)||password.length>128))return reply('Use a password between 12 and 128 characters.');
 const client=await mentoringClient();const origin=process.env.MENTORING_SITE_URL||'https://mentoring-clone-map.vercel.app';
 if(mode==='signin'){
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error)return reply('Sign-in failed. Check your email and password, and confirm your email if this is a new account.',401);
  const {data:role,error:accessError}=await client.rpc('mentoring_role');
  if(accessError||!role){await client.auth.signOut();return reply('Your account is not approved for this portal. Contact the administrator.',403);}
  return Response.json({redirect:'/'},{headers});
 }
 if(mode==='signup'){
  const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('/auth/callback',origin).href}});
  if(error)return reply('Account setup could not be completed. Try again later or contact the administrator.');
  return reply('Check your email to confirm your account. Only approved accounts can access mentoring records.',200);
 }
 if(mode==='reset'){
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?next=password',origin).href});
  if(error)return reply('The reset request could not be completed. Try again later.');
  return reply('If this email has an account, a password reset link will arrive shortly. Open it in this browser.',200);
 }
 const {data:user,error:authError}=await client.auth.getUser();
 if(authError||!user.user)return reply('Your reset link has expired. Request a new one.',401);
 const {error}=await client.auth.updateUser({password});
 if(error)return reply('The password could not be updated. Use a different password or request a new reset link.');
 await client.auth.signOut();return Response.json({redirect:'/login'},{headers});
}
