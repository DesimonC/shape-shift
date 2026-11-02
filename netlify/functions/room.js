import {getStore} from '@netlify/blobs';
import {roomAction} from '../lib/room-service.js';
export default async function(request){
  const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
  if(request.method!=='POST')return new Response(JSON.stringify({error:'Use POST.'}),{status:405,headers});
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return new Response(JSON.stringify({error:'Invalid origin.'}),{status:403,headers});
  try{
    const raw=await request.text();if(raw.length>12000)return new Response(JSON.stringify({error:'Request too large.'}),{status:413,headers});
    let body;try{body=JSON.parse(raw)}catch{return new Response(JSON.stringify({error:'Invalid JSON.'}),{status:400,headers});}
    const store=getStore({name:'shape-shifters-rooms',consistency:'strong'});
    const data=await roomAction(store,body);return new Response(JSON.stringify(data),{headers});
  }catch(e){return new Response(JSON.stringify({error:e.status?e.message:'Room service unavailable. Please retry shortly.'}),{status:e.status||503,headers});}
}
