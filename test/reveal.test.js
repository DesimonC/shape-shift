import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve,polygon,COLORS} from '../public/engine.js';
import {scoringShapes} from '../public/reveal.js';
const s=(type,x,y)=>({type,x,y,angle:0});
const points=s=>polygon(s).map(([x,y])=>`${x*100},${y*100}`).join(' ');

test('overlaps are cut from both players, without outlines or tip decorations',()=>{
  const r=resolve([[s('square',5,5)],[s('square',6,5)]]);
  const svg=scoringShapes(r);
  const masks=[...svg.matchAll(/<mask\b[^>]*>(.*?)<\/mask>/g)].map(m=>m[1]);
  assert.equal(masks.length,2);
  r.shapes.forEach((shape,i)=>{
    assert.ok(masks[1-i].includes(`<polygon points="${points(shape)}" fill="black"/>`));
    assert.ok(!masks[i].includes(`points="${points(shape)}"`));
  });
  assert.equal(r.scores[0].total,25);
  assert.equal(r.scores[1].total,25);
  assert.doesNotMatch(svg,/stroke|<text|<circle|fill-opacity/);
  assert.ok(svg.includes(`fill="${COLORS[0]}" mask="url(#scoring-area-0)"`));
});

test('destroyed and sacrificed shapes neither appear nor cut surviving areas',()=>{
  for(const target of [s('circle',5,3),s('barrier',5,3)]){
    const r=resolve([[s('triangle',5,5)],[target]]);
    assert.ok(r.removed.includes(`1-${target.type}`));
    const svg=scoringShapes(r);
    assert.equal((svg.match(/<mask\b/g)||[]).length,1);
    assert.ok(!svg.includes(`points="${points(target)}"`));
    assert.ok(!svg.includes('fill="black"'));
  }
});

test('multiple opponents are all subtracted; masks stay within the scoring board',()=>{
  const r=resolve([[s('square',1,3)],[s('square',2,3)],[s('circle',3,3)]]);
  const svg=scoringShapes(r);
  const masks=[...svg.matchAll(/<mask\b([^>]*)>(.*?)<\/mask>/g)];
  for(const mask of masks){
    assert.match(mask[1],/x="0" y="0" width="1000" height="1000"/);
    assert.equal((mask[2].match(/fill="black"/g)||[]).length,2);
  }
});

test('ultimate victory still resolves when its circle has no clear-area points',()=>{
  const r=resolve([[s('circle',5,5)],[s('square',5,5)]]);
  assert.deepEqual(r.ultimate,[0]);
  assert.equal(r.scores[0].total,0);
  assert.ok(scoringShapes(r).includes(`points="${points(r.shapes[1])}" fill="black"`));
});
