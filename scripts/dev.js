// Local QA uses the production room service with an in-memory CAS store.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {roomAction} from '../netlify/lib/room-service.js';
const data=new Map();let version=0;
const store={async getWithMetadata(k){return data.has(k)?structuredClone(data.get(k)):null},async setJSON(k,v,o={}){const old=data.get(k);if(o.onlyIfNew&&old||o.onlyIfMatch&&old?.etag!==o.onlyIfMatch)return {modified:false};data.set(k,{data:structuredClone(v),etag:String(++version)});return {modified:true}}};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    if(req.url==='/.netlify/functions/room'){
      let raw='';for await(const c of req){raw+=c;if(raw.length>12000)throw Error('Too large');}
      try{const out=await roomAction(store,JSON.parse(raw));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(out));}
      catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
    }
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve('public','.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(path.resolve('public')+path.sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT)||Number(process.argv[process.argv.indexOf('--port')+1])||3000,'0.0.0.0',()=>console.log('Shape Shifters preview ready'));
