const $=id=>document.getElementById(id);
const qs=(s,parent=document)=>parent.querySelector(s);
const qsa=(s,parent=document)=>[...parent.querySelectorAll(s)];
const games=[
 {id:'game',name:'Ô Ăn Quan',desc:'Từng viên sỏi, từng nước đi. Chơi 2 người online hoặc luyện tập với máy.',icon:'🪨',theme:'green',group:'strategy',people:'1–2 người',ready:true,badge:'✦ TRÒ NỔI BẬT'},
 {id:'caro',name:'Caro học trò',desc:'Nối năm dấu X hoặc O. Hai người chơi lần lượt trên cùng một thiết bị.',icon:'✏️',theme:'paper',group:'strategy',people:'2 tại chỗ',ready:true,badge:'CHƠI ĐƯỢC'},
 {id:'rps',name:'Oẳn tù tì',desc:'Búa, bao hay kéo? Chơi nhanh với máy và thử vận may.',icon:'✊',theme:'clay',group:'quick',people:'1 người',ready:true,badge:'CHƠI ĐƯỢC'},
 {id:'ganh',name:'Cờ Gánh',desc:'Những nước cờ mưu trí trên bàn gỗ xưa.',icon:'♟',theme:'amber',group:'strategy',people:'2 người',ready:false},
 {id:'lo-co',name:'Nhảy lò cò',desc:'Những ô gạch cùng tiếng cười sân trường.',icon:'🟫',theme:'clay',group:'nostalgia',people:'1 người',ready:false},
 {id:'chuyen',name:'Chơi chuyền',desc:'Khéo tay, nhanh mắt, nhớ từng nhịp.',icon:'🪵',theme:'green',group:'nostalgia',people:'1 người',ready:false},
 {id:'banh-dua',name:'Banh đũa',desc:'Trò khéo léo quen thuộc trong những buổi chiều.',icon:'🥢',theme:'amber',group:'nostalgia',people:'1 người',ready:false},
 {id:'do-vui',name:'Đố vui dân gian',desc:'Câu đố vui từ ông bà, từ làng xóm.',icon:'📜',theme:'paper',group:'quick',people:'1–4 người',ready:false},
 {id:'bit-mat',name:'Bịt mắt bắt dê',desc:'Tiếng gọi bạn bè vang khắp sân đình.',icon:'🐐',theme:'indigo',group:'nostalgia',people:'2+ người',ready:false},
 {id:'rong-ran',name:'Rồng rắn lên mây',desc:'Một hàng dài nối nhau qua ký ức tuổi nhỏ.',icon:'🐉',theme:'green',group:'nostalgia',people:'2+ người',ready:false}
];
const initial=()=>({cells:Array.from({length:12},(_,i)=>({n:[5,11].includes(i)?0:5,q:[5,11].includes(i)?1:0})),score:[0,0],borrow:[0,0],turn:0,status:'playing',winner:null,seq:0});
const clone=s=>JSON.parse(JSON.stringify(s));
const STORE='san-dinh-session-v2';
const game={state:initial(),visual:initial(),seat:null,connected:[false,false],solo:false,room:'',token:'',socket:null,selected:null,busy:false,rematch:[false,false],lastAnimation:null,reconnectTimer:null,intentional:false,live:false,graphic3d:false,graphics:null,animationSeq:0,animationEvents:new Map()};
let profile={name:'Người bạn sân đình',matches:0,wins:0,rps:0};
try{profile={...profile,...JSON.parse(localStorage.getItem('san-dinh-profile')||'{}')};}catch{}
const saveProfile=()=>{localStorage.setItem('san-dinh-profile',JSON.stringify(profile));updateProfile();};
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
let soundEnabled=localStorage.getItem('san-dinh-sound')!=='off',audio;
function ding(type='stone'){
 if(!soundEnabled)return;
 try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
 oscillator.type=type==='capture'?'triangle':'sine';oscillator.frequency.setValueAtTime(type==='capture'?320:650+Math.random()*290,now);oscillator.frequency.exponentialRampToValueAtTime(type==='capture'?160:280,now+.17);
 gain.gain.setValueAtTime(type==='capture'?.05:.025,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.18);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+.19);
 }catch{}
}
$('sound').onclick=()=>{soundEnabled=!soundEnabled;localStorage.setItem('san-dinh-sound',soundEnabled?'on':'off');$('sound').textContent=soundEnabled?'♫':'♪̸';toast(soundEnabled?'Đã bật âm thanh':'Đã tắt âm thanh');};$('sound').textContent=soundEnabled?'♫':'♪̸';
function nav(page){
 if(!qs(`.page[data-page="${page}"]`))page='home';
 qsa('.page').forEach(e=>e.classList.toggle('active',e.dataset.page===page));
 qsa('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===page));
 const label={home:'TRANG CHỦ',library:'THƯ VIỆN',lobby:'PHÒNG BẠN BÈ',game:'Ô ĂN QUAN',profile:'GÓC KÝ ỨC',rps:'OẲN TÙ TÌ',caro:'CARO HỌC TRÒ'};
 $('crumb').textContent=label[page]||'TRANG CHỦ';history.replaceState(null,'',location.pathname+location.search+'#'+page);window.scrollTo({top:0,behavior:'instant'});
 if(page==='game'&&game.graphics)game.graphics.resize();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b)nav(b.dataset.route);});
function cardHTML(g){return `<article class="game-card theme-${g.theme}"><div class="game-art"><div class="art-motif"></div><span class="art-icon">${g.icon}</span><span class="status-chip ${g.ready?'':'soon'}">${g.ready?g.badge:'ĐANG PHÁT TRIỂN'}</span></div><div class="card-body"><h3>${g.name}</h3><p>${g.desc}</p><div class="card-meta"><span>♧ ${g.people}</span><button ${g.ready?'':'disabled'} data-open-game="${g.id}">${g.ready?'Chơi ngay ↗':'Sắp có'}</button></div></div></article>`;}
function renderCards(filter='all'){
 $('home-cards').innerHTML=games.filter(g=>g.ready).slice(0,3).map(cardHTML).join('');
 $('library-cards').innerHTML=games.filter(g=>filter==='all'||(filter==='ready'&&g.ready)||g.group===filter).map(cardHTML).join('');
}
renderCards();
document.addEventListener('click',e=>{const b=e.target.closest('[data-open-game]');if(b){if(b.dataset.openGame==='game'){nav('game');$('tutorial').showModal&&(!localStorage.getItem('sd-tutorial')?$('tutorial').showModal():null);}else nav(b.dataset.openGame);}});
qsa('[data-filter]').forEach(b=>b.onclick=()=>{qsa('[data-filter]').forEach(c=>c.classList.toggle('active',c===b));renderCards(b.dataset.filter);});
$('hero-play').onclick=()=>nav('game');$('hero-invite').onclick=()=>nav('lobby');
qsa('[data-close]').forEach(b=>b.onclick=()=>{const dlg=$(b.dataset.close);dlg.close();localStorage.setItem('sd-tutorial','yes');});
$('tutorial-btn').onclick=()=>$('tutorial').showModal();
$('tutorial').addEventListener('click',e=>{if(e.target===$('tutorial')){$('tutorial').close();localStorage.setItem('sd-tutorial','yes');}});

const pits=new Map();const positions=[[0,'Dân 1'],[1,'Dân 2'],[2,'Dân 3'],[3,'Dân 4'],[4,'Dân 5'],[5,'Quan phải'],[6,'Dân 6'],[7,'Dân 7'],[8,'Dân 8'],[9,'Dân 9'],[10,'Dân 10'],[11,'Quan trái']];
function makePit(index){
 const btn=document.createElement('button');btn.className='pit'+([5,11].includes(index)?' quan':'');btn.type='button';btn.dataset.pit=index;btn.setAttribute('aria-label',`${positions[index][1]}`);
 btn.innerHTML='<span class="stones" aria-hidden="true"></span><span class="pit-count"></span><span class="pit-tag"></span><span class="pit-tooltip" aria-hidden="true"></span>';
 pits.set(index,btn);return btn;
}
[10,9,8,7,6].forEach(i=>$('top-row').append(makePit(i)));
[0,1,2,3,4].forEach(i=>$('bottom-row').append(makePit(i)));
$('left-quan').append(makePit(11));$('right-quan').append(makePit(5));
const positionSet=[[30,35],[60,42],[45,65],[65,67],[26,67],[48,45],[49,35],[79,56],[30,49],[69,27],[45,18]];
function drawPit(i){
 const btn=pits.get(i),c=game.visual.cells[i];if(!btn||!c)return;
 const quan=[5,11].includes(i),total=c.n+c.q,shown=Math.min(c.n,quan?6:8);
 btn.setAttribute('aria-label',`${quan?'Ô Quan':'Ô Dân'} ${i+1}: ${c.n} quân dân${c.q?' và '+c.q+' quân quan':''}`);
 btn.classList.toggle('selected',game.selected===i);
 btn.classList.toggle('selectable',canSelect(i));
 const stones=qs('.stones',btn);stones.replaceChildren();
 for(let k=0;k<shown;k++){
  const o=document.createElement('i');o.className='stone c'+(1+(i+k*3)%4);
  const [x,y]=positionSet[(k+i*2)%positionSet.length];o.style.left=x+'%';o.style.top=y+'%';o.style.setProperty('--rot',((i*39+k*47)%150-70)+'deg');stones.append(o);
 }
 if(c.q){const o=document.createElement('i');o.className='stone mandarin';o.style.left='50%';o.style.top='50%';stones.append(o);}
 qs('.pit-count',btn).textContent=quan?(c.q?c.q+' Quan':(c.n||'0')):String(c.n);
 qs('.pit-tag',btn).textContent=quan?'QUAN':i<5?'DÂN':'DÂN';
 qs('.pit-tooltip',btn).textContent=`${quan?'Ô Quan':'Ô Dân'} · ${c.n} sỏi${c.q?' · '+c.q+' Quan':''}`;
}
function canSelect(i){return !game.busy && game.live && game.seat===game.state.turn && game.connected.every(Boolean) && game.state.status==='playing' && (game.seat===0?i>=0&&i<=4:i>=6&&i<=10) && game.state.cells[i].n>0;}
function drawBoard(){for(let i=0;i<12;i++)drawPit(i);if(game.graphics)game.graphics.setState(game.visual.cells,game.selected,game.seat,canSelect);}
function selectPit(i){
 if(!canSelect(i)){if(game.live&&game.state.turn!==game.seat)toast('Đang chờ đối thủ đi quân');else if(!game.live)toast('Hãy tạo phòng hoặc chơi với máy trước nhé');else toast('Hãy chọn ô Dân còn quân thuộc phía bạn');return;}
 game.selected=game.selected===i?null:i;updateControls();drawBoard();if(game.selected!==null)ding();
}
$('board').addEventListener('click',e=>{const b=e.target.closest('[data-pit]');if(b)selectPit(+b.dataset.pit);});
function updateControls(){
 const active=game.selected!==null && canSelect(game.selected);$('go-left').disabled=$('go-right').disabled=!active;
 $('selection-title').textContent=game.selected===null?'Chọn một ô Dân':`Ô Dân ${game.selected<5?game.selected+1:game.selected-5}`;
 $('selection-desc').textContent=game.selected===null?'Chạm ô sáng bên mình rồi chọn hướng để bắt đầu rải quân.':'Chọn một trong hai hướng rải. Quân sẽ được thả lần lượt lên bàn.';
 $('selected-display').textContent=game.selected===null?'—':game.state.cells[game.selected].n+' viên';
 $('selected-meta').textContent=game.selected===null?'Chưa chọn ô':'Sẵn sàng rải quân';
}
function updateGameUI(){
 $('score-bottom').textContent=String(game.state.score[0]-game.state.borrow[0]).padStart(2,'0');
 $('score-top').textContent=String(game.state.score[1]-game.state.borrow[1]).padStart(2,'0');
 $('player1-name').textContent=game.solo?'Bạn':game.seat===0?'Bạn':'Người chơi 1';
 $('player2-name').textContent=game.solo?'Máy chơi':game.seat===1?'Bạn':'Người chơi 2';
 $('player-bottom').style.opacity=game.state.turn===0?'1':'.75';$('player-top').style.opacity=game.state.turn===1?'1':'.75';
 let status='Tạo phòng hoặc tập chơi với máy để bắt đầu.';
 if(game.live){
  status=game.state.status==='finished'?(game.state.winner==='draw'?'Hai bên hòa nhau!':`Người chơi ${game.state.winner+1} thắng cuộc!`):!game.connected.every(Boolean)?'Đang đợi người bạn vào phòng…':game.state.turn===game.seat?'Đến lượt bạn! Hãy chọn một ô Dân sáng lên.':game.solo?'Máy đang nghĩ nước đi…':'Đến lượt đối thủ. Bạn chờ chút nhé!';
 }
 if(game.busy)status='Từng viên sỏi đang được rải trên bàn…';
 $('game-status').textContent=status;
 $('connection').textContent=game.live?(game.connected.every(Boolean)?'● ĐÃ SẴN SÀNG':'● ĐANG CHỜ'):'● CHƯA VÀO PHÒNG';
 $('room-caption').textContent=game.live?(game.solo?'Luyện tập với máy':'Phòng '+game.room):'Chưa có phòng chơi';
 $('room-detail').textContent=game.live?(game.solo?'Bạn có thể luyện tập ngay.':'Gửi mã phòng hoặc sao chép liên kết mời cho người bạn muốn chơi cùng.'):'Chơi với máy hoặc tạo phòng riêng.';
 $('room-code-row').hidden=!game.live||game.solo;$('room-code').textContent=game.room||'------';
 $('in-game-create').hidden=$('in-game-solo').hidden=game.live;
 $('leave-room').hidden=!game.live;
 $('play-again').hidden=!game.live||game.state.status!=='finished';
 $('play-again').textContent=game.rematch[game.seat]?'Đã sẵn sàng · chờ bạn':'↻ Chơi ván mới';
 $('board-subtitle').textContent=game.live?game.solo?'Chế độ tập với máy · không cần chờ ai':'Mã phòng: '+game.room+' · chia sẻ để chơi cùng nhau':'Chọn một ô để xem số quân. Đăng nhập không bắt buộc.';
 updateControls();drawBoard();
}
function move(dir){if(game.selected===null||!canSelect(game.selected))return;const pit=game.selected;game.selected=null;game.busy=true;game.state.turn=game.state.turn;wsSend({type:'move',pit,dir,seq:game.state.seq});updateGameUI();}
$('go-left').onclick=()=>move(-1);$('go-right').onclick=()=>move(1);$('cancel-selection').onclick=()=>{game.selected=null;updateGameUI();};
window.addEventListener('keydown',e=>{if(!qs('.page[data-page="game"]').classList.contains('active')||e.target.matches('input,textarea'))return;if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}else if(e.key==='ArrowRight'){e.preventDefault();move(1);}else if(e.key==='Escape'){game.selected=null;updateGameUI();}});
function wsSend(obj){if(game.socket?.readyState===WebSocket.OPEN)game.socket.send(JSON.stringify(obj));}
const sessionSave=()=>{if(game.room&&game.token)localStorage.setItem(STORE,JSON.stringify({room:game.room,token:game.token}));};
function startConnection(intent, auto=false){
 if(game.socket?.readyState===WebSocket.OPEN||game.socket?.readyState===WebSocket.CONNECTING){wsSend(intent);return;}
 game.intentional=false;
 const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);game.socket=ws;
 ws.onopen=()=>{clearTimeout(game.reconnectTimer);wsSend(intent);};
 ws.onmessage=e=>{
  let msg;try{msg=JSON.parse(e.data);}catch{return;}
  if(msg.type==='error'){
    toast(msg.message);game.busy=false;
    if(auto||msg.message.includes('Phòng không tồn tại')||msg.message.includes('Phiên không hợp lệ')){localStorage.removeItem(STORE);game.room='';game.token='';game.live=false;game.seat=null;game.intentional=true;ws.close();nav('lobby');}
    updateGameUI();return;
  }
  if(msg.type==='left')return;
  if(msg.type==='animation'){
    if(msg.seq>game.visual.seq)game.animationEvents.set(msg.seq,msg.events);
    return;
  }
  if(msg.type==='state')queueServerState(msg);
 };
 ws.onclose=()=>{
   if(ws!==game.socket)return;
   game.connected=[false,false];game.busy=false;updateGameUI();
   if(!game.intentional&&game.token&&game.room){
    $('connection').textContent='● MẤT KẾT NỐI · ĐANG THỬ LẠI';
    clearTimeout(game.reconnectTimer);
    game.reconnectTimer=setTimeout(()=>startConnection({type:'resume',code:game.room,token:game.token},true),2400);
   }else if(!game.intentional)toast('Không kết nối được máy chủ. Vui lòng kiểm tra mạng.');
 };
 ws.onerror=()=>{};
}
let animationId=0;
let playback=false;
const pendingStates=[];
async function queueServerState(msg){
 pendingStates.push(msg);
 if(playback)return;
 playback=true;
 try{while(pendingStates.length){await applyServerState(pendingStates.shift());}}
 finally{playback=false;}
}
function updateAchievements(s){
 if(s.status==='finished'){
  const key=`finished:${game.room}:${s.seq}`;
  if(!sessionStorage.getItem(key)){
   sessionStorage.setItem(key,'1');profile.matches++;
   if(s.winner===game.seat)profile.wins++;
   saveProfile();
  }
 }
}
async function applyServerState(msg){
 const prev=game.visual;
 const fresh=msg.state;
 game.state=fresh;game.live=true;game.room=msg.room;game.token=msg.token;game.seat=msg.seat;game.solo=!!msg.solo;game.connected=msg.connected;game.rematch=msg.rematch||[false,false];sessionSave();updateAchievements(fresh);
 const events=game.animationEvents.get(fresh.seq);
 const animation=events&&prev.seq!==fresh.seq?{seq:fresh.seq,events}:null;
 game.animationEvents.delete(fresh.seq);game.selected=null;
 if(animation){
   const id=++animationId;game.busy=true;updateGameUI();
   await animateMove(animation.events,prev,fresh,id);
   if(animationId!==id)return;
 }
 game.visual=clone(fresh);game.busy=false;updateGameUI();
 if(fresh.status==='finished')toast(fresh.winner==='draw'?'Hòa rồi! Một ván nữa chứ?':`Ván đấu kết thúc · ${fresh.winner===game.seat?'Bạn thắng!':'Thử sức lần nữa nhé!'}`);
}
function stonePosition(i){const el=pits.get(i),rect=el?.getBoundingClientRect(),outer=$('board-wrap').getBoundingClientRect();return rect?{x:rect.left-outer.left+rect.width/2,y:rect.top-outer.top+rect.height/2}:null;}
function popParticle(from,to,ms=105){
 if(!qs('.page[data-page="game"]').classList.contains('active')||game.graphic3d)return Promise.resolve();
 const a=stonePosition(from),b=stonePosition(to);if(!a||!b)return Promise.resolve();
 const o=document.createElement('span');o.className='flying-stone';o.style.left=a.x+'px';o.style.top=a.y+'px';$('flying-stones').append(o);
 const dx=b.x-a.x,dy=b.y-a.y;
 const anim=o.animate([{transform:'translate(-50%,-50%) translate(0,0) scale(1)',opacity:.9},{transform:`translate(-50%,-50%) translate(${dx*.5}px,${dy*.5-32}px) scale(1.28)`,opacity:1,offset:.52},{transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.9)`,opacity:1}],{duration:ms,easing:'cubic-bezier(.3,.1,.3,1)'});
 return anim.finished.catch(()=>{}).then(()=>o.remove());
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function animateMove(events,previous,final,id){
 game.visual=clone(previous);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const drops=events.filter(e=>e.type==='drop').length;
 const duration=reduce?0:(drops>60?58:drops>35?78:119);
 for(const e of events){
  if(id!==animationId)return;
  if(e.type==='pickup'){game.visual.cells[e.pit].n=0;drawPit(e.pit);if(!reduce)await pause(50);}
  else if(e.type==='drop'){await popParticle(e.from,e.pit,duration);game.visual.cells[e.pit].n++;drawPit(e.pit);ding();}
  else if(e.type==='capture'){
    if(!reduce)await pause(90);
    game.visual.cells[e.pit].n=0;game.visual.cells[e.pit].q=0;drawPit(e.pit);ding('capture');toast(`✦ Ăn được ${e.value} điểm!`);
  }else if(e.type==='refill'){game.visual.cells[e.pit].n++;drawPit(e.pit);}
  if(game.graphics)game.graphics.setState(game.visual.cells,game.selected,game.seat,canSelect);
 }
 game.visual=clone(final);
}
function requestRoom(solo=false){
 if(game.live){toast('Bạn đang ở trong một phòng. Hãy rời phòng trước khi tạo phòng khác.');nav('game');return;}
 nav('game');$('game-status').textContent='Đang tạo phòng…';startConnection({type:'create',solo});
}
function joinRoom(code){
 code=String(code||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(code)){toast('Mã phòng cần đủ 6 ký tự.');return;}
 if(game.live&&game.room===code){nav('game');return;}
 if(game.live){toast('Hãy rời phòng cũ trước khi tham gia phòng mới.');return;}
 nav('game');startConnection({type:'join',code});
}
$('make-room').onclick=$('in-game-create').onclick=()=>requestRoom(false);
$('solo-start').onclick=$('in-game-solo').onclick=()=>requestRoom(true);
$('join-room').onclick=()=>joinRoom($('room-input').value);
$('room-input').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom(e.target.value);});
$('copy-link').onclick=async()=>{const link=`${location.origin}/?room=${encodeURIComponent(game.room)}#game`;try{await navigator.clipboard.writeText(link);toast('Đã sao chép liên kết mời!');}catch{toast('Mã phòng: '+game.room);}};
$('play-again').onclick=()=>wsSend({type:'rematch'});
$('leave-room').onclick=()=>{
 if(!confirm('Bạn muốn rời phòng hiện tại? Trận chơi sẽ không được giữ lại.'))return;
 wsSend({type:'leave'});game.intentional=true;clearTimeout(game.reconnectTimer);
 game.socket?.close();game.socket=null;localStorage.removeItem(STORE);animationId++;
 pendingStates.length=0;game.animationEvents.clear();game.room='';game.token='';game.live=false;game.solo=false;game.seat=null;game.state=initial();game.visual=initial();game.busy=false;game.selected=null;game.connected=[false,false];updateGameUI();nav('lobby');toast('Bạn đã rời phòng.');
};

// Optional adaptive 3D renderer, dynamically imported only when requested.
$('graphics-btn').onclick=async()=>{
 if(game.graphic3d){game.graphic3d=false;$('three-viewport').hidden=true;$('board-wrap').classList.remove('in-3d');$('graphics-btn').textContent='◈ Xem 3D';$('fps-badge').textContent='MƯỢT · 2.5D';$('reset-view').hidden=true;game.graphics?.stop();return;}
 $('graphics-btn').disabled=true;$('graphics-btn').textContent='Đang mở 3D…';
 try{
   if(!game.graphics){const mod=await import('/three-mode.js');game.graphics=await mod.makeThreeView($('three-viewport'),selectPit);}
   game.graphic3d=true;$('three-viewport').hidden=false;$('board-wrap').classList.add('in-3d');game.graphics.setState(game.visual.cells,game.selected,game.seat,canSelect);game.graphics.start();game.graphics.resize();$('graphics-btn').textContent='▦ Xem nhẹ';$('fps-badge').textContent='TƯƠNG TÁC · 3D';$('reset-view').hidden=false;
 }catch(e){console.error(e);toast('Không tải được chế độ 3D. Bạn vẫn có thể chơi mượt ở chế độ mặc định.');$('graphics-btn').textContent='◈ Xem 3D';}
 $('graphics-btn').disabled=false;
};
$('reset-view').onclick=()=>game.graphics?.reset();

function updateProfile(){
 $('profile-name').textContent=profile.name;$('stat-matches').textContent=profile.matches;$('stat-wins').textContent=profile.wins;$('stat-rps').textContent=profile.rps;
}
$('edit-name').onclick=()=>{const name=prompt('Bạn muốn được gọi là gì? (tối đa 22 ký tự)',profile.name);if(name===null)return;const clean=name.trim().slice(0,22);if(clean){profile.name=clean;saveProfile();toast('Đã đổi tên trên thiết bị này!');}};updateProfile();
const hands=['✊','✋','✌️'];let rpsScore=[0,0],rpsBusy=false;
qsa('[data-rps]').forEach(b=>b.onclick=async()=>{
 if(rpsBusy)return;rpsBusy=true;const me=Number(b.dataset.rps),bot=Math.floor(Math.random()*3);
 $('rps-message').textContent='Oẳn tù tì…';for(let j=0;j<4;j++){$('rps-hand-me').textContent=hands[j%3];$('rps-hand-ai').textContent=hands[j%3];await pause(95);} $('rps-hand-me').textContent=hands[me];$('rps-hand-ai').textContent=hands[bot];
 const result=(me-bot+3)%3;if(result===1){rpsScore[0]++;$('rps-message').textContent='Bạn thắng rồi! ✦';ding('capture');}else if(result===2){rpsScore[1]++;$('rps-message').textContent='Máy thắng lượt này!';}else $('rps-message').textContent='Hòa! Chơi lại nào!';
 $('rps-me').textContent=rpsScore[0];$('rps-ai').textContent=rpsScore[1];profile.rps++;saveProfile();rpsBusy=false;
});
$('rps-reset').onclick=()=>{rpsScore=[0,0];$('rps-me').textContent='0';$('rps-ai').textContent='0';$('rps-message').textContent='Bạn chọn trước nhé!';$('rps-hand-me').textContent='✊';$('rps-hand-ai').textContent='✊';};
let caro=Array(100).fill(''),caroTurn='X',caroDone=false;
function drawCaro(win=[]){$('caro-grid').innerHTML='';caro.forEach((piece,i)=>{const b=document.createElement('button');b.type='button';b.textContent=piece;b.className=(piece==='O'?'o ':'')+(win.includes(i)?'win':'');b.disabled=!!piece||caroDone;b.setAttribute('aria-label',`Hàng ${Math.floor(i/10)+1} cột ${i%10+1}${piece?' '+piece:''}`);b.onclick=()=>playCaro(i);$('caro-grid').append(b);});}
function findCaroWin(idx){const x=idx%10,y=Math.floor(idx/10),piece=caro[idx];for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){const line=[idx];for(const sign of [-1,1])for(let s=1;s<5;s++){const xx=x+sign*s*dx,yy=y+sign*s*dy;if(xx<0||xx>=10||yy<0||yy>=10||caro[yy*10+xx]!==piece)break;line.push(yy*10+xx);}if(line.length>=5)return line;}return null;}
function playCaro(idx){if(caro[idx]||caroDone)return;caro[idx]=caroTurn;ding();const win=findCaroWin(idx);if(win){caroDone=true;$('caro-status').textContent=caroTurn+' thắng rồi! ✦';toast('Năm dấu liên tiếp!');}else if(caro.every(Boolean)){caroDone=true;$('caro-status').textContent='Hòa rồi!';}else{caroTurn=caroTurn==='X'?'O':'X';$('caro-status').textContent='Đến lượt '+caroTurn;}drawCaro(win||[]);}
$('caro-reset').onclick=()=>{caro=Array(100).fill('');caroTurn='X';caroDone=false;$('caro-status').textContent='Đến lượt X';drawCaro();};drawCaro();

const urlCode=new URLSearchParams(location.search).get('room');let stored;
try{stored=JSON.parse(localStorage.getItem(STORE)||'null');}catch{}
if(urlCode&&/^[a-z0-9]{6}$/i.test(urlCode)){
 const code=urlCode.toUpperCase();if(stored?.room===code){game.room=stored.room;game.token=stored.token;nav('game');startConnection({type:'resume',code:stored.room,token:stored.token},true);}else{joinRoom(code);}
}else if(stored?.room&&stored.token){game.room=stored.room;game.token=stored.token;nav('game');startConnection({type:'resume',code:stored.room,token:stored.token},true);}
else if(location.hash){nav(location.hash.slice(1));}
updateGameUI();
if('serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

// --- XỬ LÝ NHẠC NỀN & ÂM THANH ---
const soundBtn = document.getElementById('sound');
const bgm = document.getElementById('bgm-audio');

let isMuted = true; // Ban đầu mặc định tắt để tuân thủ Autoplay Policy của trình duyệt

if (soundBtn && bgm) {
  // Giảm âm lượng xuống mức êm ái (30%) để không làm chói tai
  bgm.volume = 0.3;

  soundBtn.addEventListener('click', async () => {
    if (isMuted) {
      try {
        await bgm.play();
        isMuted = false;
        soundBtn.classList.add('active');
        soundBtn.textContent = '♪'; // Biểu tượng khi đang bật
        soundBtn.title = 'Tắt nhạc';
      } catch (err) {
        console.warn('Trình duyệt chặn autoplay:', err);
      }
    } else {
      bgm.pause();
      isMuted = true;
      soundBtn.classList.remove('active');
      soundBtn.textContent = '♫'; // Biểu tượng khi tắt
      soundBtn.title = 'Bật nhạc';
    }
  });
}

// Tự động bật nhạc ở cú chạm/click đầu tiên của người chơi vào trang web (tùy chọn)
function enableAudioOnFirstInteraction() {
  if (isMuted && bgm) {
    bgm.play().then(() => {
      isMuted = false;
      if (soundBtn) {
        soundBtn.classList.add('active');
        soundBtn.textContent = '♪';
      }
    }).catch(() => {});
  }
  window.removeEventListener('pointerdown', enableAudioOnFirstInteraction);
}
window.addEventListener('pointerdown', enableAudioOnFirstInteraction, { once: true });
