import {scoringShapes} from './reveal.js';
import {TYPES,COLORS,polygon,inside,validatePlacement,validateLayout,computerLayout,resolve} from './engine.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const hints={triangle:'Only the three tips attack. Rotate to aim at your rivals.',square:'Immune to triangle attacks. Watch out for visiting circles!',circle:'Double clear-area points. Inside an opponent’s square can win outright.',barrier:'Sacrifices itself to protect any shape it touches, including a rival’s.'};
const symbols={triangle:'△',square:'□',circle:'○',barrier:'━'};
let mode='cpu1',game=null,choice='triangle',angle=0,session=null,pollTimer=null,pollBusy=false,requestBusy=false,currentScreen='home',result=null;
const storage={get(k){try{return JSON.parse(sessionStorage.getItem(k)||localStorage.getItem(k))}catch{return null}},set(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));localStorage.setItem(k,JSON.stringify(v))}catch{}},remove(k){try{sessionStorage.removeItem(k);localStorage.removeItem(k)}catch{}}};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(t=''){ $('#notice').textContent=t;$('#notice').classList.toggle('hidden',!t); }
function screen(id){currentScreen=id;$$('.screen').forEach(e=>e.classList.toggle('hidden',e.id!==id));notice();window.scrollTo({top:0,behavior:'instant'});}
function setup(m){mode=m;screen('setup');$('#setup-title').textContent={cpu1:'You vs one computer',cpu2:'You vs two computers',local:'Pass & play',online:'Play online with friends'}[m];$('#count-label').classList.toggle('hidden',m!=='local');$('#online-options').classList.toggle('hidden',m!=='online');$('#setup-go').textContent=m==='online'?'Create / join room':"Let's play";localNames();}
function localNames(){const count=Number($('#count').value);$('#local-names').innerHTML=mode==='local'?Array.from({length:count-1},(_,i)=>`<label>Player ${i+2}<input class="extra-name" maxlength="24" value="Player ${i+2}" required></label>`).join(''):'';}
function names(){return [$('#name').value.trim()||'Player 1',...$$('.extra-name').map((e,i)=>e.value.trim()||`Player ${i+2}`)];}
function beginLocal(){
  const list=mode==='local'?names():[names()[0],...Array.from({length:mode==='cpu2'?2:1},(_,i)=>`Computer ${i+1}`)];
  game={names:list,layouts:list.map((_,i)=>mode!=='local'&&i?computerLayout():[]),turn:0};result=null;
  choice='triangle';angle=0;
  if(mode==='local')handoff();else placement();
}
function handoff(){screen('handoff');$('#handoff-name').textContent=`${game.names[game.turn]}, you're up.`;$('#handoff-text').textContent='Pass the device to this player. Everyone else, look away!';}
function placement(){screen('play');choice='triangle';angle=0;$('#board').classList.remove('revealed');$('#tools').classList.remove('hidden');$('#player-title').textContent=`${game.names[game.turn]}'s shapes`;$('#turn-label').textContent=mode==='online'?`Room ${session.code} · secret placement`:'Secret placement';updateControls('Select a shape, then tap a grid intersection.');}
function layout(){return game.layouts[game.turn];}
function svgShape(s,removed=false){const points=polygon(s).map(([x,y])=>`${x*100},${y*100}`).join(' ');const color=COLORS[s.owner??game?.turn??0];const selected=currentScreen==='play'&&s.type===choice;return `<g class="${removed?'shape-removed':''}"><polygon points="${points}" fill="${color}" fill-opacity="${s.type==='barrier'?.65:.22}" stroke="${color}" stroke-width="${selected?7:4}" stroke-linejoin="round"/>${s.type==='triangle'?polygon(s).map(([x,y])=>`<circle cx="${x*100}" cy="${y*100}" r="9" fill="${color}"/>`).join(''):''}<text x="${s.x*100}" y="${s.y*100+12}" text-anchor="middle" font-family="system-ui" font-size="30" font-weight="700" fill="${color}">${(s.owner??game?.turn??0)+1}</text></g>`;}
function updateControls(message){
  const placed=layout().find(s=>s.type===choice);if(placed){angle=placed.angle;$('#pos-x').value=placed.x;$('#pos-y').value=placed.y;}
  $('#angle').value=angle;$('#angle-output').textContent=`${angle}°`;$('#shape-hint').textContent=hints[choice];
  $$('#shape-buttons button').forEach(b=>{b.classList.toggle('selected',b.dataset.type===choice);b.classList.toggle('placed',layout().some(s=>s.type===b.dataset.type));b.setAttribute('aria-pressed',b.dataset.type===choice)});
  $('#pieces').innerHTML=layout().map(s=>svgShape(s)).join('');$('#placed-count').textContent=`${layout().length} / 4 placed`;$('#lock').disabled=!!validateLayout(layout())||requestBusy;$('#remove').disabled=!placed;
  if(message)$('#placement-message').textContent=message;
}
function put(x,y,newAngle=angle){
  if(currentScreen!=='play'||requestBusy)return;
  const s={type:choice,x,y,angle:newAngle};const other=layout().filter(t=>t.type!==choice),error=validatePlacement(s,other);
  if(error){updateControls(error);return false;}
  game.layouts[game.turn]=[...other,s];angle=newAngle;$('#pos-x').value=x;$('#pos-y').value=y;
  if(session&&mode==='online'){session.draft=layout();storage.set('shape-room',session);}
  updateControls(`${choice[0].toUpperCase()+choice.slice(1)} placed. You can move or rotate it until you lock in.`);return true;
}
function waiting(ready=false){screen('waiting');$('#reveal').classList.toggle('hidden',!ready);$('#waiting-text').textContent=ready?'Everyone is ready. Reveal the arena when you’re ready!':'Your shapes are secret and locked. Waiting for the other players…';}
async function lock(){
  if(validateLayout(layout())||requestBusy)return;
  if(mode==='online'){
    requestBusy=true;updateControls();try{const data=await api('submit',{layout:layout()});session.locked=true;session.draft=layout();storage.set('shape-room',session);waiting();applyRoom(data);}catch(e){notice(e.message)}finally{requestBusy=false;if(currentScreen==='play')updateControls();}return;
  }
  if(mode==='local'&&game.turn<game.names.length-1){game.turn++;choice='triangle';angle=0;$('#pieces').innerHTML='';handoff();}
  else {result=resolve(game.layouts);$('#pieces').innerHTML='';waiting(true);}
}
function showResult(){
  if(!result)return;screen('result');const winning=result.winners.map(i=>game.names[i]).join(' & '),shared=result.winners.length>1;
  $('#win-type').textContent=result.ultimate.length?'Ultimate Victory':'Clear-area scores';$('#winner-title').textContent=`${winning} ${shared?'share victory!':'wins!'}`;
  $('#winner-text').textContent=result.ultimate.length?'A surviving circle is completely inside an opponent’s square. The ultimate move.':'Only coloured areas shown earned points. Overlaps and destroyed shapes are removed. Circles earn double.';
  $('#result-board').innerHTML=`<svg class="result-svg reveal-pop" viewBox="0 0 1000 1000" role="img" aria-label="Scoring areas only. Overlaps and destroyed shapes are hidden. Player colours and scores are listed below."><defs><pattern id="revealGrid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#345172" stroke-width="2"/></pattern></defs><rect width="1000" height="1000" fill="#0e1b2d"/><rect class="fading-grid" width="1000" height="1000" fill="url(#revealGrid)"/>${scoringShapes(result)}</svg><div class="legend">${game.names.map((n,i)=>`<span style="--player:${COLORS[i]}">${i+1} · ${escape(n)}</span>`).join('')}</div>`;
  $('#scorecards').innerHTML=result.scores.map(s=>`<article style="--player:${COLORS[s.owner]}"><h3>${s.owner+1} · ${escape(game.names[s.owner])}${result.winners.includes(s.owner)?' ★':''}</h3><div class="score-number">${s.total.toFixed(1)}</div><span class="muted">clear-area points</span><table aria-label="${escape(game.names[s.owner])} score breakdown">${s.breakdown.map(b=>`<tr><td>${symbols[b.type]} ${b.type}</td><td>${b.removed?'Removed':b.points.toFixed(1)}</td></tr>`).join('')}</table></article>`).join('');
  const label=id=>{const s=result.shapes.find(x=>x.id===id);return s?`${game.names[s.owner]}'s ${s.type}`:id;};
  const eventStrings=[...new Set(result.events.map(e=>e.kind==='block'?`${label(e.by)} sacrificed itself to block an attack on ${label(e.target)}.`:`${label(e.by)} destroyed ${label(e.target)} with a tip.`))];
  $('#events').innerHTML=(eventStrings.length?eventStrings:['No shapes were destroyed. Clear area decides the scores.']).map(s=>`<li>${escape(s)}</li>`).join('');
  $('#again').textContent=mode==='online'?'Create / join another game':'Play again';clearInterval(pollTimer);
}
async function api(action,extra={}){
  const response=await fetch('/.netlify/functions/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session, draft:undefined,action,...extra}),signal:AbortSignal.timeout(15000)});
  let data;try{data=await response.json()}catch{throw Error('Online rooms need the Netlify deployment. Computer and pass-and-play games are ready here.');}
  if(!response.ok)throw Error(data.error||'Room request failed. Please retry.');return data;
}
function saveSession(data){session={code:data.code,playerId:data.playerId,playerToken:data.playerToken,hostToken:data.hostToken,name:data.players.find(p=>p.id===data.playerId)?.name,locked:false,draft:[]};storage.set('shape-room',session);}
function invite(){return `${location.origin}/?room=${session.code}`;}
async function joinOnline(){
  $('#setup-go').disabled=true;notice();
  try{
    const code=$('#code').value.trim().toUpperCase(),old=storage.get('shape-room');
    if(code&&old?.code===code&&old.name?.toLowerCase()===names()[0].toLowerCase()){session=old;const data=await api('state');applyRoom(data);startPolling();return;}
    session=null;
    const data=await api(code?'join':'create',{name:names()[0],code});saveSession(data);applyRoom(data);startPolling();
  }catch(e){notice(e.message)}finally{$('#setup-go').disabled=false;}
}
function applyRoom(data){
  if(!session)return;
  if(data.phase==='cancelled'){clearInterval(pollTimer);storage.remove('shape-room');session=null;screen('home');notice('The host closed this room. You can start a new game.');return;}
  game??={names:[],layouts:[],turn:0};game.names=data.players.map(p=>p.name);game.turn=data.players.findIndex(p=>p.id===session.playerId);
  if(game.turn<0){notice('Your player is no longer in this room.');return;}
  game.layouts=game.names.map((_,i)=>i===game.turn?(session.draft||[]):[]);
  if(data.phase==='lobby'){
    if(currentScreen!=='lobby')screen('lobby');$('#room-code').textContent=data.code;
    $('#players').innerHTML=data.players.map((p,i)=>`<li><span style="color:${COLORS[i]}">●</span> ${escape(p.name)} ${p.id===session.playerId?'(you)':''}</li>`).join('');$('#start-online').classList.toggle('hidden',!data.host);$('#start-online').disabled=data.players.length<2;
    $('#lobby-status').textContent=data.host?'Start when everyone has joined (2–4 players).':'Waiting for the host to start.';return;
  }
  const me=data.players[game.turn];
  if(me.ready){session.locked=true;storage.set('shape-room',session);}
  if(data.phase==='results'){
    result=data.result;if(currentScreen!=='result'){if(currentScreen!=='waiting')waiting(true);$('#reveal').classList.remove('hidden');$('#waiting-text').textContent='Everyone is ready. Reveal the arena!';}
  }else if(session.locked){if(currentScreen!=='waiting')waiting();}
  else if(currentScreen!=='play')placement();
  $('#waiting-players').innerHTML=data.players.map((p,i)=>`<li><span style="color:${COLORS[i]}">●</span> ${escape(p.name)} · ${p.ready?'Locked in ✓':'Placing shapes…'}</li>`).join('');
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='online')poll()});
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(poll,2000);}
async function poll(){if(pollBusy||requestBusy||!session||document.hidden)return;pollBusy=true;try{const data=await api('state');if(mode==='online'){applyRoom(data);notice();}}catch(e){notice(`${e.message} Retrying…`)}finally{pollBusy=false;}}
function goHome(){clearInterval(pollTimer);game=null;result=null;session=null;mode='cpu1';$('#pieces').innerHTML='';$('#waiting-players').innerHTML='';screen('home');}
function askLeave(){$('#confirm').showModal();}
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>setup(b.dataset.mode)));
$('#count').addEventListener('change',localNames);$('#setup-back').addEventListener('click',goHome);
$('#setup-form').addEventListener('submit',e=>{e.preventDefault();if(mode==='online')joinOnline();else beginLocal();});
$('#ready-player').addEventListener('click',placement);
$$('#shape-buttons button').forEach(b=>b.addEventListener('click',()=>{choice=b.dataset.type;angle=layout().find(s=>s.type===choice)?.angle||0;updateControls(`Select a grid intersection for your ${choice}.`)}));
$('#angle').addEventListener('input',()=>{const a=Number($('#angle').value),s=layout().find(s=>s.type===choice);if(s)put(s.x,s.y,a);else{angle=a;$('#angle-output').textContent=`${angle}°`;}});
$('#position').addEventListener('click',()=>put(Number($('#pos-x').value),Number($('#pos-y').value)));
$('#remove').addEventListener('click',()=>{game.layouts[game.turn]=layout().filter(s=>s.type!==choice);if(session){session.draft=layout();storage.set('shape-room',session)}updateControls(`${choice} removed.`)});
let pointer=null;
function point(e){const r=$('#board').getBoundingClientRect();return [(e.clientX-r.left)/r.width*10,(e.clientY-r.top)/r.height*10];}
$('#board').addEventListener('pointerdown',e=>{if(currentScreen!=='play')return;const [x,y]=point(e);const hit=[...layout()].reverse().find(s=>inside([x,y],polygon(s)));pointer={id:e.pointerId,offset:hit?[x-hit.x,y-hit.y]:[0,0]};if(hit){choice=hit.type;updateControls()}$('#board').setPointerCapture(e.pointerId);});
$('#board').addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const [x,y]=point(e);put(Math.round(x-pointer.offset[0]),Math.round(y-pointer.offset[1]));pointer=null;});
$('#board').addEventListener('pointercancel',()=>pointer=null);
$('#lock').addEventListener('click',lock);$('#reveal').addEventListener('click',showResult);
for(const id of ['quit','wait-quit','leave'])$('#'+id).addEventListener('click',askLeave);
$('#stay').addEventListener('click',()=>$('#confirm').close());
$('#confirm-leave').addEventListener('click',async()=>{if(session?.hostToken){try{await api('cancel')}catch(e){notice(e.message);$('#confirm').close();return}storage.remove('shape-room');}$('#confirm').close();goHome();});
$('#home-button').addEventListener('click',goHome);$('#again').addEventListener('click',()=>{if(mode==='online'){storage.remove('shape-room');session=null;game=null;setup('online');$('#code').value='';}else beginLocal()});
$('#start-online').addEventListener('click',async()=>{if(requestBusy)return;requestBusy=true;$('#start-online').disabled=true;try{applyRoom(await api('start'))}catch(e){notice(e.message);$('#start-online').disabled=false}finally{requestBusy=false}});
$('#share').addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:'Shape Shifters',text:`Join my game. Code: ${session.code}`,url:invite()});else{await navigator.clipboard.writeText(invite());notice('Invite link copied. Send it to your friends.')}}catch(e){if(e.name!=='AbortError')notice(`Share this link: ${invite()}`)}});
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(invite());notice('Invite link copied.')}catch{notice(`Share this link: ${invite()}`)}});
$('#help-open').addEventListener('click',()=>$('#rules').showModal());$('#help-close').addEventListener('click',()=>$('#rules').close());
setTimeout(()=>{$('#splash').classList.add('leaving');setTimeout(()=>$('#splash').remove(),350)},2000);
const code=new URLSearchParams(location.search).get('room');
const saved=storage.get('shape-room');
if(code){setup('online');$('#code').value=code.toUpperCase().slice(0,10);}
else if(saved){mode='online';session=saved;api('state').then(data=>{applyRoom(data);startPolling()}).catch(()=>{storage.remove('shape-room');session=null;mode='cpu1';notice('Your previous online room is unavailable. Start a fresh game below.');});}
