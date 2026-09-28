import { mentoringClient } from './supabase';
const headers={'Cache-Control':'private, no-store'};
export async function supabaseRead() {
 const client=await mentoringClient(); const {data:claims}=await client.auth.getClaims();
 if(!claims?.claims) return Response.json({error:'Please sign in.',signInPath:'/login'},{status:401,headers});
 const {data,error}=await client.rpc('mentoring_state');
 if(error) return Response.json({error:error.code==='42501'?'Your account is not approved for this portal.':'The database could not be loaded. Please retry.'},{status:error.code==='42501'?403:502,headers});
 return Response.json(data,{headers});
}
export async function supabaseWrite(request:Request) {
 if(new URL(request.url).origin!==request.headers.get('origin')) return Response.json({error:'Request origin not allowed.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json')) return Response.json({error:'JSON required.'},{status:415,headers});
 const client=await mentoringClient();const {data:claims}=await client.auth.getClaims();
 if(!claims?.claims) return Response.json({error:'Please sign in.',signInPath:'/login'},{status:401,headers});
 let body;try {body=await request.json();}catch{return Response.json({error:'Invalid request.'},{status:400,headers});}
 if(!body||typeof body!=='object'||Array.isArray(body)) return Response.json({error:'Invalid request.'},{status:400,headers});
 const requestId=body.requestId;delete body.requestId;
 if(typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId)) return Response.json({error:'Request ID required.'},{status:400,headers});
 const {data,error}=await client.rpc('mentoring_mutate',{p_body:body,p_request_id:requestId});
 if(error) return Response.json({error:['P0001','42501'].includes(error.code)?error.message:'The change could not be saved. Refresh to check its status before retrying.'},{status:error.code==='42501'?403:400,headers});
 return Response.json({ok:true,patch:data},{headers});
}
