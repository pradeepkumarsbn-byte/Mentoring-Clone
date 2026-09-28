import { useSupabase } from "../../lib/backend";
import { authConfigured, signIn } from "../../auth";
import PasswordForm from './password-form';
export const dynamic = "force-dynamic";
export default function Login() {
 const supabase = useSupabase();
 const ready = supabase ? !!(process.env.MENTORING_SUPABASE_URL && process.env.MENTORING_SUPABASE_PUBLISHABLE_KEY) : authConfigured();
 if(supabase)return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section style={{width:'100%',maxWidth:480,padding:32}}><p className="eyebrow">ISKCON WARANGAL</p><h1>Mentoring Hub</h1>{ready?<PasswordForm/>:<p>Login setup is incomplete. Contact the administrator.</p>}<p style={{marginTop:24}}>Use your approved email address. Creating an account does not grant access to participant records.</p></section></main>;
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f2f5fb",padding:24}}><section style={{maxWidth:480,padding:40,borderRadius:24,background:"white",boxShadow:"0 20px 60px #17335b15"}}><p className="eyebrow">ISKCON WARANGAL</p><h1 style={{fontSize:36,color:"#192e51"}}>Welcome to<br/>Mentoring Hub.</h1><p style={{lineHeight:1.7,margin:"20px 0"}}>{ready ? "Sign in with the Google account approved for this mentoring portal." : "Your Vercel copy is ready for setup. Google sign-in must be configured before records can be accessed."}</p>{ready ? supabase ? <a className="primary-button" href="/auth/google">Continue with Google</a> : <form action={async()=>{"use server"; await signIn("google",{redirectTo:"/"});}}><button className="primary-button">Continue with Google</button></form> : <p>Ask the site owner to complete the Vercel connection settings.</p>}<p style={{marginTop:24,fontSize:13}}>Only approved mentors can access participant records.</p></section></main>;
}
