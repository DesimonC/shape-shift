import test from 'node:test';
import assert from 'node:assert/strict';
import {polygon,area,clip,inside,touches,validatePlacement,validateLayout,resolve,computerLayout,circleInSquare} from '../public/engine.js';
const s=(type,x,y,angle=0)=>({type,x,y,angle});
const fallback=[s('triangle',2,2),s('square',7,2),s('circle',2,7),s('barrier',7,7)];
test('four different shapes required, integer snapping and bounded rotation',()=>{
 assert.equal(validateLayout(fallback),null);assert.ok(validateLayout(fallback.slice(1)));
 assert.ok(validatePlacement(s('circle',2.5,2)));assert.ok(validatePlacement(s('circle',2,2,4)));
 assert.ok(validateLayout([fallback[0],fallback[0],fallback[2],fallback[3]]));
});
test('10% off-board limit uses area; own overlap rejected but edge touching allowed',()=>{
 assert.ok(validatePlacement(s('square',1,3)));assert.equal(validatePlacement(s('circle',1,1)),null);
 assert.ok(validatePlacement(s('circle',3,3),[s('square',3,3)]));
 assert.equal(area(clip(polygon(s('square',5,2)),polygon(s('square',2,2)))),0);
 assert.equal(validatePlacement(s('circle',7,7),[s('square',2,2)]),null);
});
test('rotated clipping, area and touching stay consistent',()=>{
 const p=polygon(s('square',5,5,45));assert.ok(Math.abs(area(p)-9)<1e-7);
 assert.ok(inside([5,5],p));assert.ok(!inside([0,0],p));
 assert.ok(Math.abs(area(clip(p,p))-9)<1e-7);
 assert.ok(touches(p,polygon(s('circle',5,5))));assert.ok(!touches(p,polygon(s('circle',0,0))));
});
test('only triangle tips kill, never its middle or edges; square immune',()=>{
 const r=resolve([[s('triangle',5,5)],[s('circle',5,3)],[s('circle',5,5)],[s('square',5,3)]]);
 assert.ok(r.removed.includes('1-circle'));assert.ok(!r.removed.includes('2-circle'));assert.ok(!r.removed.includes('3-square'));
});
test('mutual triangle destruction is simultaneous and deterministic',()=>{
 const layouts=[[s('triangle',5,5)],[s('triangle',5,3,180)]];
 const r=resolve(layouts);assert.deepEqual(new Set(r.removed),new Set(['0-triangle','1-triangle']));
 assert.deepEqual(resolve(layouts),r);
});
test('a barrier touching a target sacrifices itself and protects any owner',()=>{
 const r=resolve([[s('triangle',5,5)],[s('circle',5,3)],[s('barrier',5,2,0)]]);
 assert.ok(!r.removed.includes('1-circle'));assert.ok(r.removed.includes('2-barrier'));assert.ok(r.events.some(e=>e.kind==='block'));
});
test('a direct tip hit sacrifices a barrier',()=>{
 const r=resolve([[s('triangle',5,5)],[s('barrier',5,3,90)]]);
 assert.ok(r.removed.includes('1-barrier'));
});
test('surviving circle inside opponent square overrides score',()=>{
 const r=resolve([[s('circle',5,5)],[s('square',5,5)]]);
 assert.deepEqual(r.ultimate,[0]);assert.deepEqual(r.winners,[0]);
 assert.equal(r.scores[0].total,0);assert.ok(r.scores[1].total>0);
});
test('shared ultimate victory and eliminated circle cannot win',()=>{
 const r=resolve([[s('circle',2,2),s('square',7,7)],[s('square',2,2),s('circle',7,7)]]);
 assert.deepEqual(r.winners,[0,1]);
 const killed=resolve([[s('circle',5,3)],[s('square',5,3)],[s('triangle',5,5)]]);
 assert.ok(killed.removed.includes('0-circle'));assert.deepEqual(killed.ultimate,[]);
});
test('containment accounts for square rotation and full radius',()=>{
 assert.ok(circleInSquare(s('circle',5,5),s('square',5,5,45)));
 assert.ok(!circleInSquare(s('circle',6,5),s('square',5,5,45)));
});
test('clear area scoring double circle, union overlap counted once, shared ties',()=>{
 const r=resolve([[s('circle',2,2)],[s('circle',8,8)]]);assert.equal(r.scores[0].total,200);assert.deepEqual(r.winners,[0,1]);
 const overlap=resolve([[s('square',5,5)],[s('square',6,5)],[s('square',6,5)]]);
 assert.ok(Math.abs(overlap.scores[0].total-100/3)<1e-6);
});
test('no mutation of inputs, off-board area excluded from score',()=>{
 const layouts=[[s('square',1,3)],[s('circle',8,8)]];const before=structuredClone(layouts);const r=resolve(layouts);
 assert.deepEqual(layouts,before);assert.ok(r.scores[0].total<100);
});
test('200 independent computer layouts obey all human placement rules',()=>{
 let seed=42;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<200;i++)assert.equal(validateLayout(computerLayout(rng)),null);
});
test('50 complete four-player games have valid finite scores and a winner',()=>{
 let seed=123;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<50;i++){
  const r=resolve(Array.from({length:4},()=>computerLayout(rng)));
  assert.ok(r.winners.length);for(const p of r.scores)assert.ok(Number.isFinite(p.total)&&p.total>=0&&p.total<=500.00001);
 }
});
