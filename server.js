import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { initialState, applyMove, SIDE } from './rules.js';

const port = Number(process.env.PORT || 3000);
const root = resolve('public');
const rooms = new Map();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/health') {
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    res.end(JSON.stringify({ok:true,rooms:rooms.size})); return;
  }
  let decoded;try {decoded=decodeURIComponent(path);}catch {res.writeHead(400);res.end('Bad request');return;}
  const target = resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
  if (!target.startsWith(root + sep)) {res.writeHead(403);res.end('Forbidden');return;}
  try {
    if (!(await stat(target)).isFile()) throw new Error('not file');
    const data=await readFile(target);
    res.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream','cache-control': /\.(html|js|css|webmanifest)$/.test(target)?'no-cache':'public, max-age=3600','x-content-type-options':'nosniff'});
    res.end(data);
  }catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}
});
const wss = new WebSocketServer({server, maxPayload:2048});
const send=(ws,msg)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));};
const makeCode=()=>{let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));return code;};
const makeToken=()=>randomBytes(24).toString('base64url');
const online=r=>r.players.map(p=>Boolean(p.bot || p.socket?.readyState===WebSocket.OPEN));
function broadcast(r){const connected=online(r);r.players.forEach((p,seat)=>send(p.socket,{type:'state',room:r.id,seat,token:p.token,connected,solo:r.solo,state:r.state,rematch:r.rematch}));}
function seatIn(ws,r,seat){const p=r.players[seat];if(p.socket&&p.socket!==ws){p.socket.close(4001,'New connection');}p.socket=ws;ws.room=r.id;ws.seat=seat;r.updated=Date.now();broadcast(r);}
function error(ws,message){send(ws,{type:'error',message});}
function advance(r,pit,dir,player){
  const {state,events}=applyMove(r.state,player,pit,dir);
  r.state=state;r.updated=Date.now();r.rematch=[false,false];
  for(const p of r.players)send(p.socket,{type:'animation',events,seq:state.seq});
  broadcast(r);
  if(r.solo&&state.status==='playing'&&state.turn===1)queueBot(r);
}
function queueBot(r){
  if(r.botPending)return;
  r.botPending=true;
  setTimeout(()=>{
    r.botPending=false;
    if(rooms.get(r.id)!==r || !r.solo || r.state.turn!==1 || r.state.status!=='playing' || !online(r)[0])return;
    const moves=[];
    for(const pit of SIDE[1])if(r.state.cells[pit].n>0)for(const dir of [-1,1]){
      try {const next=applyMove(r.state,1,pit,dir);const captured=next.events.filter(e=>e.type==='capture'&&e.player===1).reduce((sum,e)=>sum+e.value,0);moves.push({pit,dir,score:captured + Math.random()*3});}catch{}
    }
    moves.sort((a,b)=>b.score-a.score);
    if(moves[0])advance(r,moves[0].pit,moves[0].dir,1);
  },1050);
}
wss.on('connection', ws=>{
  ws.room=null;ws.seat=null;ws.alive=true;
  ws.on('pong',()=>ws.alive=true);
  ws.on('message', raw=>{
    let msg;try{msg=JSON.parse(raw.toString());}catch{error(ws,'Dữ liệu không hợp lệ');return;}
    try{
      if(msg.type==='create'){
        if(ws.room)throw Error('Bạn đã ở trong phòng');
        const solo=msg.solo===true,id=makeCode();
        const room={id,solo,state:initialState(),players:[{token:makeToken(),socket:null,bot:false},{token:null,socket:null,bot:solo}],rematch:[false,false],updated:Date.now(),botPending:false};
        rooms.set(id,room);seatIn(ws,room,0);return;
      }
      if(msg.type==='join'||msg.type==='resume'){
        if(ws.room)throw Error('Bạn đã ở trong phòng');
        const id=String(msg.code||'').trim().toUpperCase(),r=rooms.get(id);
        if(!r)throw Error('Phòng không tồn tại hoặc đã hết hạn');
        if(msg.type==='resume'){
          const seat=r.players.findIndex(p=>p.token && p.token===msg.token);
          if(seat<0)throw Error('Phiên không hợp lệ. Vui lòng tạo hoặc vào phòng mới.');
          seatIn(ws,r,seat);if(r.solo&&r.state.turn===1)queueBot(r);return;
        }
        if(r.solo)throw Error('Phòng luyện tập với máy, không thể tham gia');
        const seat=r.players.findIndex(p=>!p.token);
        if(seat<0)throw Error('Phòng đã đủ người, hãy dùng một mã khác');
        r.players[seat].token=makeToken();seatIn(ws,r,seat);return;
      }
      const r=rooms.get(ws.room);
      if(!r||r.players[ws.seat]?.socket!==ws)throw Error('Bạn chưa vào phòng');
      if(msg.type==='leave'){
        const seat=ws.seat;r.players[seat].socket=null;r.players[seat].token=null;
        ws.room=null;ws.seat=null;r.updated=Date.now();
        send(ws,{type:'left'});
        if(r.solo||r.players.every(p=>!p.token)){rooms.delete(r.id);}else{r.state=initialState();r.rematch=[false,false];broadcast(r);}
        return;
      }
      if(msg.type==='move'){
        if(!online(r).every(Boolean))throw Error('Đang chờ người chơi còn lại');
        if(msg.seq!==r.state.seq)throw Error('Nước đi đã cũ. Vui lòng thử lại.');
        if(r.solo && ws.seat!==0)throw Error('Chỉ người chơi được điều khiển quân');
        advance(r,msg.pit,msg.dir,ws.seat);return;
      }
      if(msg.type==='rematch'){
        if(r.state.status!=='finished')throw Error('Ván chưa kết thúc');
        r.rematch[ws.seat]=true;
        if(r.solo)r.rematch[1]=true;
        if(r.rematch.every(Boolean)){r.state=initialState();r.rematch=[false,false];}
        r.updated=Date.now();broadcast(r);return;
      }
      throw Error('Lệnh không hợp lệ');
    }catch(e){error(ws,e.message);}
  });
  ws.on('close',()=>{
    const r=rooms.get(ws.room);
    if(r&&r.players[ws.seat]?.socket===ws){r.players[ws.seat].socket=null;r.updated=Date.now();broadcast(r);}
  });
});
setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
  const now=Date.now();for(const [code,r] of rooms){if(now-r.updated>3*60*60*1000&&r.players.every(p=>!p.socket))rooms.delete(code);}
},30000).unref();
server.listen(port,'0.0.0.0',()=>console.log(`Sân Đình Tuổi Thơ running at http://localhost:${port}`));
