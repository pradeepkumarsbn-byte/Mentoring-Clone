import { getChatGPTUser } from '../../chatgpt-auth';
import { bridgeRequest, bridgeUrl } from '../../connection';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return new Response('Please sign in.',{status:401});
 try{
 const access=await bridgeRequest(await bridgeUrl(),{action:'check_access',email:user.email});
 if(access.allowed!==true)return new Response('Access denied.',{status:403});
 const value=process.env.MENTORING_SPREADSHEET_URL;
 if(!value)return new Response('Open your original mentoring spreadsheet from Google Drive. The owner can configure this shortcut in Vercel settings.',{status:503});
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||!/^\/spreadsheets\/d\/[A-Za-z0-9_-]+\/edit$/.test(url.pathname))throw Error('Invalid spreadsheet URL');
 const tab=new URL(request.url).searchParams.get('tab');
 const gid=tab==='calendar'?'2060819203':'2060819202';url.search='?gid='+gid;url.hash='gid='+gid;
 return new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'no-store, private'}});
 }catch{return new Response('Spreadsheet shortcut is temporarily unavailable.',{status:502});}
}
