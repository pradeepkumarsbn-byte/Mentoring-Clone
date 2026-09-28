import { redirect } from 'next/navigation';
import { mentoringClient } from '../../../lib/supabase';
import { useSupabase } from '../../../lib/backend';
export default function SignOut() {
 if(!useSupabase()) redirect('/api/auth/signout');
 return <main className="page-shell"><h1>Sign out</h1><form action={async()=>{'use server';const client=await mentoringClient();await client.auth.signOut();redirect('/login');}}><button className="primary-button">Confirm sign out</button></form></main>;
}
