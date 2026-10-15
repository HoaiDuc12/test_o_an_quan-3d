/** Authoritative, deterministic Ô Ăn Quan rules. 12-cell circular track:
 * 0..4 = bottom (P0), 5 = right Quan, 6..10 = top (P1), 11 = left Quan.
 * Direction +1/-1 advances one track position. Each Quan = 10 points,
 * but cannot be picked up to sow; stones deposited in Quan pits can be captured.
 * Regional rule variants exist; this game uses the documented variant below.
 */
export const QUAN = [5,11];
export const SIDE = [[0,1,2,3,4],[6,7,8,9,10]];
export const isQuan = i => QUAN.includes(i);
export const wrap = n => (n % 12 + 12) % 12;
export const points = (count, mandarin) => count + mandarin * 10;
export function initialState(){return {cells:Array.from({length:12},(_,i)=>({n:isQuan(i)?0:5,q:isQuan(i)?1:0})),score:[0,0],borrow:[0,0],turn:0,status:'playing',winner:null,seq:0};}
export function clone(s){return structuredClone(s);}
export function totalValue(s){return s.cells.reduce((a,c)=>a+points(c.n,c.q),0)+s.score[0]+s.score[1]-s.borrow[0]-s.borrow[1];}
function empty(c){return c.n===0 && c.q===0;}
function collect(s,i,p,events){const c=s.cells[i]; const value=points(c.n,c.q);if(!value)return; s.score[p]+=value; events.push({type:'capture',pit:i,n:c.n,q:c.q,value,player:p});c.n=0;c.q=0;}
function cleanSide(s,p,events){ const own=SIDE[p];if(own.some(i=>s.cells[i].n>0)) return;
  // 'Cháy quân': replenish 5 own pits, borrowing points if score is insufficient.
  for(const i of own){s.cells[i].n++;events.push({type:'refill',pit:i,player:p});}
  s.score[p]-=5; if(s.score[p]<0){s.borrow[p]+=-s.score[p];s.score[p]=0;}
}
function finalize(s,events){
  // Game ends only when both Quan pieces have been captured.
  if(QUAN.some(i=>s.cells[i].q>0))return;
  for(let p=0;p<2;p++)for(const i of SIDE[p])collect(s,i,p,events);
  s.status='finished';const a=s.score[0]-s.borrow[0],b=s.score[1]-s.borrow[1];s.winner=a===b?'draw':a>b?0:1;
  events.push({type:'finish',winner:s.winner});
}
export function applyMove(prev,player,pit,dir){
 if(prev.status!=='playing')throw Error('Trận đấu đã kết thúc');
 if(player!==prev.turn)throw Error('Chưa đến lượt bạn');
 if(![-1,1].includes(dir))throw Error('Hướng không hợp lệ');
 if(!SIDE[player].includes(pit) || prev.cells[pit].n<=0)throw Error('Ô được chọn không hợp lệ');
 const s=clone(prev),events=[];
 let source=pit,iterations=0;
 while(iterations++<160){
   const amount=s.cells[source].n;s.cells[source].n=0;events.push({type:'pickup',pit:source,n:amount});
   let last=source;
   for(let k=0;k<amount;k++){last=wrap(last+dir);s.cells[last].n++;events.push({type:'drop',from:source,pit:last,k});}
   const next=wrap(last+dir);
   if(isQuan(next))break; // Quan boundary ends sowing sequence.
   if(s.cells[next].n>0){source=next;continue;}
   // Empty separator => capture the occupied pit beyond; repeat along empty/occupied pairs.
   let separator=next;
   for(let j=0;j<6;j++){
     const target=wrap(separator+dir);
     if(empty(s.cells[target]))break;
     collect(s,target,player,events);
     const after=wrap(target+dir);
     if(!empty(s.cells[after]))break;
     separator=after;
   }
   break;
 }
 if(iterations>=160)throw Error('Quá nhiều bước rải quân');
 finalize(s,events);
 if(s.status==='playing'){
    s.turn=1-player;
    cleanSide(s,s.turn,events);
 }
 s.seq=prev.seq+1;
 return {state:s,events};
}
