import test from 'node:test';import assert from 'node:assert/strict';
import {roomAction} from '../netlify/lib/room-service.js';import {computerLayout} from '../public/engine.js';
function memory(){const m=new Map();let v=0;return {m,async getWithMetadata(k){return m.has(k)?structuredClone(m.get(k)):null},async setJSON(k,value,o){const old=m.get(k);if(o.onlyIfNew&&old||o.onlyIfMatch&&old?.etag!==o.onlyIfMatch)return {modified:false};m.set(k,{data:structuredClone(value),etag:String(++v)});return {modified:true}}};}
const who=r=>({code:r.code,playerToken:r.playerToken,hostToken:r.hostToken});
test('create, concurrent join, start, hidden submit, rejoin and reveal for four players',async()=>{
 const store=memory(),host=await roomAction(store,{action:'create',name:'Host'});
 const guests=await Promise.all(['A','B','C'].map(name=>roomAction(store,{action:'join',code:host.code,name})));
 assert.equal(new Set(guests.map(p=>p.playerId)).size,3);
 await assert.rejects(roomAction(store,{action:'join',code:host.code,name:'Extra'}),/four/);
 await assert.rejects(roomAction(store,{...who(guests[0]),action:'start'}),/host/);
 await roomAction(store,{...who(host),action:'start'});
 await assert.rejects(roomAction(store,{action:'join',code:host.code,name:'Late'}),/started/);
 const first=await roomAction(store,{...who(host),action:'submit',layout:computerLayout()});
 assert.equal(first.result,null);assert.ok(!JSON.stringify(first).includes('layout'));assert.ok(!JSON.stringify(first).includes('playerToken'));
 assert.ok((await roomAction(store,{...who(host),action:'join'})).playerId);
 const submits=await Promise.all(guests.map(p=>roomAction(store,{...who(p),action:'submit',layout:computerLayout()})));
 assert.ok(submits.some(r=>r.phase==='results'));
 const done=await roomAction(store,{...who(host),action:'state'});assert.equal(done.phase,'results');assert.equal(done.result.shapes.length,16);
 const repeat=await roomAction(store,{...who(host),action:'submit',layout:computerLayout()});assert.deepEqual(repeat.result,done.result);
});
test('invalid data, duplicate names, auth, expiry and host cancellation',async()=>{
 const store=memory();const host=await roomAction(store,{action:'create',name:'Host'});
 await assert.rejects(roomAction(store,{action:'join',code:host.code,name:'HOST'}),/taken/);
 await assert.rejects(roomAction(store,{...who(host),action:'start'}),/other player/);
 const guest=await roomAction(store,{action:'join',code:host.code,name:'Guest'});
 await assert.rejects(roomAction(store,{action:'state',code:host.code}),/Rejoin/);
 await roomAction(store,{...who(host),action:'start'});
 await assert.rejects(roomAction(store,{...who(guest),action:'submit',layout:[]}),/four/);
 await assert.rejects(roomAction(store,{...who(guest),action:'cancel'}),/host/);
 const cancel=await roomAction(store,{...who(host),action:'cancel'});assert.equal(cancel.phase,'cancelled');
 await assert.rejects(roomAction(store,{...who(guest),action:'submit',layout:computerLayout()}),/not started/);
 store.m.get(host.code).data.expires=0;
 await assert.rejects(roomAction(store,{...who(host),action:'state'}),/expired/);
});
