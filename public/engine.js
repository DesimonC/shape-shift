// Shared deterministic rules: browser, computer players and server validation.
export const TYPES = ['triangle','square','circle','barrier'];
export const COLORS = ['#54d8ff','#ff7ca4','#ffd369','#b8a0ff'];
const EPS=1e-7;
export function polygon(s) {
  const a=s.angle*Math.PI/180,c=Math.cos(a),n=Math.sin(a);
  let p;
  if(s.type==='circle') p=Array.from({length:72},(_,i)=>[1*Math.cos(i*Math.PI/36),1*Math.sin(i*Math.PI/36)]);
  else if(s.type==='square') p=[[-2,-2],[2,-2],[2,2],[-2,2]];
  else if(s.type==='triangle') p=[[0,-2],[2,2],[-2,2]];
  else p=[[-2,-.14],[2,-.14],[2,.14],[-2,.14]];
  return p.map(([x,y])=>[s.x+x*c-y*n,s.y+x*n+y*c]);
}
export function area(p){return Math.abs(p.reduce((a,v,i)=>{let w=p[(i+1)%p.length];return a+v[0]*w[1]-w[0]*v[1]},0)/2)}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
export function clip(poly, boundary) {
  let out=poly;
  for(let i=0;i<boundary.length&&out.length;i++){
    const a=boundary[i],b=boundary[(i+1)%boundary.length],input=out;out=[];
    let prev=input.at(-1),dp=cross(a,b,prev);
    for(const cur of input){const dc=cross(a,b,cur);
      if((dc>=-EPS)!==(dp>=-EPS)){const t=dp/(dp-dc);out.push([prev[0]+t*(cur[0]-prev[0]),prev[1]+t*(cur[1]-prev[1])])}
      if(dc>=-EPS)out.push(cur);prev=cur;dp=dc;
    }
  } return out;
}
const BOARD=[[0,0],[10,0],[10,10],[0,10]];
export function inside(p,poly){return poly.every((v,i)=>cross(v,poly[(i+1)%poly.length],p)>=-EPS)}
export function containsPoint(s,p){return s.type==='circle'?Math.hypot(p[0]-s.x,p[1]-s.y)<=1+EPS:inside(p,polygon(s));}
export function touches(a,b){
  // Separating axis test includes edge contact; valid for our convex shapes.
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],axis=[p[1]-q[1],q[0]-p[0]];
    const aa=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),bb=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);
    if(Math.max(...aa)<Math.min(...bb)-EPS||Math.max(...bb)<Math.min(...aa)-EPS)return false;
  }return true;
}
export function validatePlacement(s,others=[]) {
  if(!s||!TYPES.includes(s.type)||![s.x,s.y,s.angle].every(Number.isFinite))return 'Choose a valid shape and position.';
  if(s.x<0||s.x>10||s.y<0||s.y>10||s.x%1||s.y%1||s.angle%15||s.angle<0||s.angle>345)return 'Shapes must snap to the grid; rotation uses 15° steps.';
  const p=polygon(s);
  if(area(clip(p,BOARD))/area(p)<.9-EPS)return 'Keep at least 90% of the shape on the board.';
  for(const t of others){if(t.type===s.type)return 'You already placed that shape.';if(area(clip(p,polygon(t)))>EPS)return 'Your own shapes cannot overlap. Touching edges is fine.';}
  return null;
}
export function validateLayout(layout) {
  if(!Array.isArray(layout)||layout.length!==4)return 'Place all four shapes before locking in.';
  for(let i=0;i<layout.length;i++){const e=validatePlacement(layout[i],layout.slice(0,i));if(e)return e;}
  return null;
}
export function circleInSquare(c,s){
  const a=-s.angle*Math.PI/180,dx=c.x-s.x,dy=c.y-s.y;
  const x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
  return Math.abs(x)+1<=2+EPS&&Math.abs(y)+1<=2+EPS;
}
// Exact union area, via inclusion/exclusion, for at most 12 opponent shapes.
function unionIntersection(p,opponents,start=0) {
  let total=0;
  for(let i=start;i<opponents.length;i++){
    const c=clip(p,opponents[i]);const a=area(c);
    if(a>EPS)total+=a-unionIntersection(c,opponents,i+1);
  }return total;
}
export function resolve(layouts) {
  const shapes=layouts.flatMap((layout,owner)=>layout.map(s=>({...s,owner,id:`${owner}-${s.type}`})));
  const polygons=new Map(shapes.map(s=>[s.id,polygon(s)])),removed=new Set(),events=[];
  const barriers=shapes.filter(s=>s.type==='barrier');
  // Resolve triangle duels simultaneously first, then only survivors attack
  // other shapes. Barriers protect throughout both stages of the reveal.
  const triangles=shapes.filter(s=>s.type==='triangle');
  function attack(attackers,duels){
  for(const tri of attackers)for(const [tipIndex,tip] of polygons.get(tri.id).entries()){
    const targets=shapes.filter(t=>t.owner!==tri.owner&&t.type!=='square'&&(duels?t.type==='triangle':t.type!=='triangle')&&containsPoint(t,tip));
    if(duels&&!targets.length)continue;
    const direct=barriers.filter(b=>inside(tip,polygons.get(b.id)));
    if(direct.length){for(const b of direct){removed.add(b.id);events.push({kind:'block',by:b.id,target:tri.id,tip:tipIndex})}continue;}
    for(const target of targets){
      const guards=barriers.filter(b=>b.id!==target.id&&touches(polygons.get(b.id),polygons.get(target.id)));
      if(guards.length){for(const b of guards){removed.add(b.id);events.push({kind:'block',by:b.id,target:target.id,tip:tipIndex})}}
      else {removed.add(target.id);events.push({kind:'destroy',by:tri.id,target:target.id,tip:tipIndex})}
    }
  }
  }
  attack(triangles,true);
  attack(triangles.filter(t=>!removed.has(t.id)),false);
  const survivors=shapes.filter(s=>!removed.has(s.id));
  const ultimate=[...new Set(survivors.filter(c=>c.type==='circle'&&survivors.some(s=>s.type==='square'&&s.owner!==c.owner&&circleInSquare(c,s))).map(c=>c.owner))];
  const scores=layouts.map((_,owner)=>{
    const opponents=survivors.filter(s=>s.owner!==owner).map(s=>polygons.get(s.id));
    const breakdown=shapes.filter(s=>s.owner===owner).map(s=>{
      const onBoard=clip(polygons.get(s.id),BOARD),clear=removed.has(s.id)?0:Math.max(0,area(onBoard)-unionIntersection(onBoard,opponents));
      const percent=clear/area(polygons.get(s.id))*100,points=percent*(s.type==='circle'?2:1);
      return {type:s.type,removed:removed.has(s.id),percent,points};
    });return {owner,total:breakdown.reduce((n,s)=>n+s.points,0),breakdown};
  });
  const high=Math.max(...scores.map(s=>s.total));
  return {shapes,removed:[...removed],events,scores,ultimate,winners:ultimate.length?ultimate:scores.filter(s=>Math.abs(s.total-high)<.005).map(s=>s.owner)};
}
export function computerLayout(random=Math.random) {
  // Generate independently, with no access to opponents' hidden positions.
  for(let retry=0;retry<100;retry++){
    const layout=[];
    for(const type of TYPES){
      for(let attempt=0;attempt<400;attempt++){
        const s={type,x:1+Math.floor(random()*9),y:1+Math.floor(random()*9),angle:Math.floor(random()*24)*15};
        if(!validatePlacement(s,layout)){layout.push(s);break;}
      }
    }if(!validateLayout(layout))return layout;
  }
  return [{type:'triangle',x:2,y:2,angle:0},{type:'square',x:7,y:2,angle:0},{type:'circle',x:2,y:7,angle:0},{type:'barrier',x:7,y:7,angle:0}];
}
