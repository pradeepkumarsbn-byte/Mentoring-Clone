import {redirect} from 'next/navigation';
import {mentoringClient} from '../../../lib/supabase';
import {useSupabase} from '../../../lib/backend';
import PasswordForm from '../../login/password-form';
export const dynamic='force-dynamic';
export default async function UpdatePassword(){
 if(!useSupabase())redirect('/login');
 const client=await mentoringClient();const {data,error}=await client.auth.getUser();
 if(error||!data.user)redirect('/login');
 return <main className="page-shell" style={{maxWidth:480,padding:32}}><PasswordForm update/></main>;
}
