import {randomBytes,timingSafeEqual} from 'node:crypto';
import {validateLayout,resolve} from '../../public/engine.js';
const token=()=>randomBytes(24).toString('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
const cleanName=n=>typeof n==='string'?n.trim().slice(0,24):'';
export function view(room,who){
  const complete=room.phase==='playing'&&room.players.every(p=>p.layout);
  return {code:room.code,phase:complete?'results':room.phase,host:who===room.hostToken,expires:room.expires,
    players:room.players.map(p=>({id:p.id,name:p.name,ready:!!p.layout})),
    result:complete?resolve(room.players.map(p=>p.layout)):null};
}
export async function roomAction(store,b) {
  if(!b||typeof b!=='object')fail('Invalid request.');
  if(b.action==='create'){
    const name=cleanName(b.name);if(!name)fail('Enter your name.');
    for(let i=0;i<5;i++){
      const code=randomBytes(5).toString('hex').toUpperCase(),hostToken=token(),playerToken=token(),id=token().slice(0,12);
      const room={code,hostToken,phase:'lobby',expires:Date.now()+2*60*60*1000,players:[{id,name,token:playerToken}]};
      const saved=await store.setJSON(code,room,{onlyIfNew:true});
      if(saved.modified)return {...view(room,hostToken),playerId:id,playerToken,hostToken};
    }fail('Could not create a room. Try again.',503);
  }
  const code=typeof b.code==='string'?b.code.toUpperCase().trim():'';
  if(!/^[A-F0-9]{10}$/.test(code))fail('Enter the 10-character game code.');
  // A single compare-and-swap document prevents joins/start/submissions racing.
  for(let retry=0;retry<8;retry++){
    const entry=await store.getWithMetadata(code,{type:'json'});
    if(!entry||!entry.data||entry.data.expires<Date.now())fail('Game not found or expired. Ask the host for a new game.',404);
    const room=entry.data;
    let player=room.players.find(p=>same(p.token,b.playerToken));
    const host=same(room.hostToken,b.hostToken);
    let extra={};
    if(b.action==='join'){
      if(player)return {...view(room,host?room.hostToken:player.token),playerId:player.id};
      if(room.phase!=='lobby')fail('This game has started. Rejoin from your original browser.');
      if(room.players.length>=4)fail('This room already has four players.');
      const name=cleanName(b.name);if(!name)fail('Enter your name.');
      if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))fail('That name is taken. Choose another name.');
      player={id:token().slice(0,12),name,token:token()};room.players.push(player);
      extra={playerId:player.id,playerToken:player.token};
    }else{
      if(!player)fail('Rejoin from your original browser or create a new game.',403);
      if(b.action==='state')return view(room,host?room.hostToken:player.token);
      if(b.action==='start'){
        if(!host)fail('Only the host can start.',403);
        if(room.phase==='lobby'){if(room.players.length<2)fail('Wait for at least one other player.');room.phase='playing';}
      }else if(b.action==='submit'){
        if(room.phase!=='playing')fail('The game has not started.');
        const error=validateLayout(b.layout);if(error)fail(error);
        // Immutable once submitted; repeat requests safely return the first submission.
        if(!player.layout)player.layout=b.layout.map(({type,x,y,angle})=>({type,x,y,angle}));
      }else if(b.action==='cancel'){
        if(!host)fail('Only the host can cancel the room.',403);room.phase='cancelled';
      }else fail('Unknown action.');
    }
    const write=await store.setJSON(code,room,{onlyIfMatch:entry.etag});
    if(write.modified)return {...view(room,host?room.hostToken:player.token),...extra};
  }fail('The room is busy. Please retry.',409);
}
