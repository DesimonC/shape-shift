import {COLORS,polygon} from './engine.js';

const points=s=>polygon(s).map(([x,y])=>`${x*100},${y*100}`).join(' ');

// Match scoring: surviving shapes, clipped to the board, minus the union of
// surviving opponents. Mask the fill only: outlines, tip dots and labels would
// otherwise leave visible marks in areas that earned no points.
export function scoringShapes(result) {
  const removed=new Set(result.removed);
  const survivors=result.shapes.filter(s=>!removed.has(s.id));
  return survivors.map((s,i)=>{
    const id=`scoring-area-${i}`;
    const overlaps=survivors.filter(other=>other.owner!==s.owner)
      .map(other=>`<polygon points="${points(other)}" fill="black"/>`).join('');
    return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000" style="mask-type:luminance"><rect width="1000" height="1000" fill="white"/>${overlaps}</mask></defs><polygon points="${points(s)}" fill="${COLORS[s.owner]}" mask="url(#${id})"/>`;
  }).join('');
}
