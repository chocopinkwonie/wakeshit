/* WAKEONE Casino: toà nhà, sảnh, phòng chờ, đồng bộ bàn chơi (host quyết định), vé xu. */
window.CasinoGames=window.CasinoGames||{};
const Casino=(()=>{
 const POS={x:-50,z:-45},q=id=>document.getElementById(id),sb=()=>supabaseClient;
 const GAMES={uno:{t:'UNO',i:'🃏',d:'Đánh hết bài trước',bots:3},ludo:{t:'Cờ cá ngựa',i:'🐴',d:'Đưa 4 ngựa về đích',bots:3}};
 let ov,body,view='menu',curGame=null,lobbyCh=null,lobbyReady=false,rooms=[],room=null,triggered=false,coins=0;
 document.head.insertAdjacentHTML('beforeend','<style>#toast{z-index:60}.uno-card{width:46px;height:68px;border-radius:10px;border:3px solid #fff;color:#fff;font-weight:800;font-size:17px;box-shadow:0 3px 8px rgba(0,0,0,.3);cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center;transition:.15s}.uno-card.ok{transform:translateY(-10px);outline:3px solid #facc15}.sd-c{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:clamp(14px,4.6vw,22px);cursor:pointer}.cg-svg{width:100%;max-width:420px;margin:0 auto;display:block}</style>');

 /* ---- toà nhà trên map ---- */
 function build(){
  const g=new THREE.Group();
  addBox(g,11,5,8,0x7c3aed,0,2.5,0);addBox(g,12,.6,9,0xfacc15,0,5.3,0);addBox(g,10,1.4,7,0x6d28d9,0,6.3,0);
  [-5,5].forEach(x=>[-4.2,4.2].forEach(z=>addBox(g,.7,5,.7,0xfacc15,x,2.5,z)));
  addBox(g,3,3.2,.2,0x1e1b4b,0,1.6,4.05);
  addBox(g,7,1.1,.4,0xfde047,0,4.2,4.2,{emissive:0xfacc15,emissiveIntensity:.8});
  [-3,0,3].forEach(x=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.15,16),new THREE.MeshStandardMaterial({color:0xef4444}));c.rotation.x=Math.PI/2;c.position.set(x,7.4,0);g.add(c)});
  g.position.set(POS.x,0,POS.z);g.rotation.y=Math.atan2(-POS.x,-POS.z);scene.add(g);
  colliders.push({x:POS.x,z:POS.z,r:6.5});
  addLabel('🎰 SÒNG BẠC WAKEONE','shop-sign big',()=>new THREE.Vector3(POS.x,9.5,POS.z),90);
 }
 function check(){
  if(!player)return;const d=Math.hypot(player.position.x-POS.x,player.position.z-POS.z);
  if(d<9.5&&!triggered&&!document.querySelector('.modal-backdrop:not(.hidden)')){triggered=true;open()}else if(d>13)triggered=false;
 }

 /* ---- xu ---- */
 function setCoins(n){coins=+n;const a=q('coin-count'),b=q('cg-coins');if(a)a.textContent=coins;if(b)b.textContent='🪙 '+coins}
 async function refreshCoins(){const {data}=await sb().from('profiles').select('coins').eq('id',myId).single();if(data)setCoins(data.coins)}
 async function pay(g){
  const {data,error}=await sb().rpc('casino_enter',{g});
  if(error){showToast(/NO_COINS/.test(error.message)?'Không đủ xu (cần 10 xu) 🪙':'Lỗi: '+error.message);return false}
  setCoins(data);return true;
 }

 /* ---- giao diện sảnh ---- */
 const set=h=>{body.innerHTML=h},on=(s,f)=>body.querySelectorAll(s).forEach(b=>b.onclick=()=>f(b));
 function ensure(){
  if(ov)return;ov=document.createElement('div');ov.className='modal-backdrop hidden';ov.style.zIndex=45;
  ov.innerHTML=`<div class="modal glass" style="width:min(760px,100%)"><div class="flex justify-between items-center gap-2"><div><span class="pill">🎰 SÒNG BẠC WAKEONE</span> <span id="cg-coins" class="pill">🪙 ${coins}</span></div><button id="cg-x" class="btn btn-soft !py-1 !px-3 text-xs">✕ Ra ngoài</button></div><div id="cg-body" class="mt-3"></div></div>`;
  q('screen-game').appendChild(ov);body=q('cg-body');q('cg-x').onclick=close;
 }
 function open(){ensure();ov.classList.remove('hidden');joinLobby();showMenu()}
 async function close(){if(room)await leaveRoom();ov.classList.add('hidden')}
 function showMenu(){
  view='menu';
  set(`<h2 class="text-lg font-extrabold text-pink-700">Chọn trò chơi</h2><div class="grid sm:grid-cols-3 gap-3 mt-3">${Object.entries(GAMES).map(([k,g])=>`<button class="product text-center" data-g="${k}"><div class="product-emoji">${g.i}</div><b class="text-pink-700">${g.t}</b><span class="text-[11px] text-pink-500">${g.d}<br>Vé 10 xu / trận</span></button>`).join('')}<button class="product text-center" data-g="sudoku"><div class="product-emoji">🔢</div><b class="text-pink-700">Sudoku</b><span class="text-[11px] text-pink-500">10 màn · miễn phí<br>Thắng 1 màn +5 xu</span></button></div>`);
  on('[data-g]',b=>b.dataset.g==='sudoku'?CasinoGames.sudoku.start(body,{back:showMenu,refresh:refreshCoins}):showModes(b.dataset.g));
 }
 function showModes(g){
  curGame=g;view='modes';const G=GAMES[g];
  set(`<button class="btn btn-soft text-xs" data-b>← Quay lại</button><h2 class="text-lg font-extrabold text-pink-700 mt-2">${G.i} ${G.t}</h2><div class="grid sm:grid-cols-2 gap-3 mt-3"><button class="product text-center" data-m="bot"><div class="product-emoji">🤖</div><b class="text-pink-700">Chơi với bot</b><span class="text-[11px] text-pink-500">1 người · vé 10 xu</span></button><button class="product text-center" data-m="fr"><div class="product-emoji">👥</div><b class="text-pink-700">Chơi với bạn</b><span class="text-[11px] text-pink-500">2–4 người · vé 10 xu</span></button></div>`);
  on('[data-b]',showMenu);on('[data-m]',b=>b.dataset.m==='bot'?solo(g):showRooms());
 }
 function showRooms(){
  view='rooms';const list=rooms.filter(r=>r.game===curGame&&r.n<4&&r.hostId!==myId);
  set(`<button class="btn btn-soft text-xs" data-b>← Quay lại</button><div class="flex justify-between items-center gap-2 mt-2"><h2 class="text-lg font-extrabold text-pink-700">Phòng chờ ${GAMES[curGame].t}</h2><button class="btn btn-pink text-xs" data-c>＋ Tạo phòng (10 xu)</button></div><div class="space-y-2 mt-3">${list.length?list.map((r,i)=>`<div class="inventory-row" style="cursor:default"><span class="flex-1 text-sm font-bold text-pink-700">${esc(r.host)} · ${r.n}/4</span><button class="btn btn-pink text-xs" data-j="${i}">Vào (10 xu)</button></div>`).join(''):'<p class="text-xs text-pink-500">Chưa có phòng nào. Tạo phòng rồi rủ bạn vào nhé!</p>'}</div>`);
  on('[data-b]',()=>showModes(curGame));on('[data-c]',createRoom);on('[data-j]',b=>joinRoom(list[+b.dataset.j]));
 }
 function showRoom(){
  view='room';const r=room,G=GAMES[r.game];
  set(`<h2 class="text-lg font-extrabold text-pink-700">${G.i} ${G.t} · phòng ${esc(r.code)}</h2><div class="space-y-2 mt-3">${[0,1,2,3].map(i=>{const s=r.seats[i];return `<div class="inventory-row" style="cursor:default"><span class="text-xl">${s?'🧸':'⏳'}</span><span class="flex-1 text-sm font-bold text-pink-700">${s?esc(s.name)+(i===0?' (chủ phòng)':''):'Đang chờ người chơi...'}</span></div>`}).join('')}</div><div class="flex gap-2 mt-4"><button class="btn btn-soft flex-1" data-l>Rời phòng (hoàn xu)</button>${r.host?`<button class="btn btn-pink flex-1" data-s ${r.seats.length<2?'disabled':''}>Bắt đầu</button>`:'<span class="text-xs text-pink-500 self-center">Chờ chủ phòng bắt đầu...</span>'}</div>`);
  on('[data-l]',()=>leaveRoom());on('[data-s]',startMatch);
 }
 function showGame(){
  view='game';
  set(`<div class="flex justify-between items-center gap-2"><span id="cg-turn" class="text-sm font-extrabold text-pink-700"></span><button class="btn btn-soft text-xs" data-l>Rời bàn</button></div><div id="cg-board" class="mt-2"></div>`);
  on('[data-l]',()=>leaveRoom());renderGame();
 }
 function renderGame(){
  if(!room||view!=='game'||!q('cg-board'))return;
  const G=CasinoGames[room.game],st=room.state,my=room.seats.findIndex(s=>s.id===myId),t=G.turn(st),w=G.winner(st),nm=i=>esc(room.seats[i]?room.seats[i].name:'?');
  q('cg-turn').innerHTML=w>=0?'🏆 '+nm(w)+' thắng!'+(w===my?' 🎉':''):'Lượt: '+nm(t)+(t===my?' (cậu)':'');
  G.render(q('cg-board'),st,my,room.seats,act);
 }

 /* ---- sảnh realtime: ai đang mở phòng ---- */
 function joinLobby(){
  if(lobbyCh)return;
  lobbyCh=sb().channel('casino-lobby',{config:{presence:{key:myId}}});
  lobbyCh.on('presence',{event:'sync'},()=>{rooms=[];Object.values(lobbyCh.presenceState()).forEach(a=>a.forEach(e=>{if(e.room)rooms.push(e)}));if(view==='rooms'&&ov&&!ov.classList.contains('hidden'))showRooms()})
   .subscribe(s=>{if(s==='SUBSCRIBED')lobbyReady=true});
 }
 function advertise(){if(!lobbyReady)return;const r=room;lobbyCh.track(r&&r.host&&!r.solo&&!r.started?{room:r.code,game:r.game,host:myName,hostId:myId,n:r.seats.length}:{u:1})}

 /* ---- phòng ---- */
 const bots=g=>Array.from({length:GAMES[g].bots},(_,i)=>({bot:true,name:'Bot '+(i+1)}));
 async function solo(g){
  if(!await pay(g))return;
  room={game:g,solo:true,host:true,t0:Date.now(),seats:[{id:myId,name:myName,t:Date.now()}].concat(bots(g))};startMatch();
 }
 async function createRoom(){
  if(!await pay(curGame))return;
  room={game:curGame,code:Math.random().toString(36).slice(2,7),host:true,solo:false,started:false,t0:Date.now(),seats:[{id:myId,name:myName,t:Date.now()}]};
  openCh();advertise();showRoom();
 }
 async function joinRoom(e){
  if(!e)return;if(!await pay(e.game))return;
  room={game:e.game,code:e.room,host:false,solo:false,started:false,t0:Date.now(),seats:[]};openCh();showRoom();
 }
 function openCh(){
  const r=room;r.ch=sb().channel('casino-r-'+r.code,{config:{broadcast:{self:false},presence:{key:myId}}});
  r.ch.on('broadcast',{event:'m'},({payload:p})=>onMsg(p)).on('presence',{event:'sync'},onPresence)
   .subscribe(async s=>{if(s==='SUBSCRIBED'){await r.ch.track({n:myName});if(!r.host)send({t:'join',id:myId,name:myName})}});
 }
 const send=p=>{if(room&&room.ch)room.ch.send({type:'broadcast',event:'m',payload:p})};
 function roster(){send({t:'roster',seats:room.seats});advertise();if(view==='room')showRoom()}
 function onMsg(p){
  if(!room||!p)return;
  if(room.host){
   if(p.t==='join'){
    if(room.started||room.seats.length>=4||room.seats.some(s=>s.id===p.id)){send({t:'full',to:p.id});return}
    room.seats.push({id:p.id,name:String(p.name).slice(0,20),t:Date.now()});roster();
   }else if(p.t==='leave')dropSeat(p.id);
   else if(p.t==='act'&&room.started&&room.seats[p.seat]&&room.seats[p.seat].id===p.id)hostAct(p.seat,p.a);
  }else{
   if(p.t==='roster'){room.seats=p.seats;if(!room.started&&view==='room')showRoom()}
   else if(p.t==='full'&&p.to===myId){showToast('Phòng đã đầy hoặc đã bắt đầu');leaveRoom(true)}
   else if(p.t==='start'){room.seats=p.seats;room.started=true;room.state=p.state;sb().rpc('casino_start').then(()=>{});showGame()}
   else if(p.t==='state'){room.state=p.state;if(p.seats)room.seats=p.seats;renderGame()}
   else if(p.t==='closed'){showToast('Chủ phòng đã đóng phòng');leaveRoom(true)}
  }
 }
 function onPresence(){
  if(!room||!room.ch||Date.now()-room.t0<5000)return;
  const keys=Object.keys(room.ch.presenceState());
  if(room.host)room.seats.forEach(s=>{if(!s.bot&&s.id!==myId&&Date.now()-(s.t||0)>5000&&!keys.includes(s.id))dropSeat(s.id)});
  else if(room.seats.length&&!keys.includes(room.seats[0].id)){showToast('Chủ phòng đã rời đi');leaveRoom(true)}
 }
 function dropSeat(id){
  const i=room.seats.findIndex(s=>s.id===id);if(i<0)return;
  if(room.started){room.seats[i]={bot:true,name:room.seats[i].name+' (bot)'};send({t:'state',state:room.state,seats:room.seats});renderGame();hostLoop()}
  else{room.seats.splice(i,1);roster()}
 }
 function startMatch(){
  const G=CasinoGames[room.game];room.started=true;room.state=G.init(room.seats);sb().rpc('casino_start').then(()=>{});
  if(!room.solo)send({t:'start',seats:room.seats,state:room.state});advertise();showGame();hostLoop();
 }
 function act(a){
  const my=room.seats.findIndex(s=>s.id===myId);
  if(room.host)hostAct(my,a);else send({t:'act',seat:my,id:myId,a});
 }
 function hostAct(seat,a){
  const s=CasinoGames[room.game].act(room.state,seat,a);if(!s)return;
  room.state=s;if(!room.solo)send({t:'state',state:s});renderGame();hostLoop();
 }
 function hostLoop(){
  clearTimeout(room.bt);const G=CasinoGames[room.game],st=room.state;if(G.winner(st)>=0)return;
  const t=G.turn(st),s=room.seats[t];
  if(s&&s.bot)room.bt=setTimeout(()=>{if(room&&room.state===st)hostAct(t,G.bot(room.state,t))},900);
 }
 async function leaveRoom(closed){
  const r=room;if(!r)return;room=null;clearTimeout(r.bt);
  if(r.ch){if(!closed)r.ch.send({type:'broadcast',event:'m',payload:r.host&&!r.solo?{t:'closed'}:{t:'leave',id:myId}});setTimeout(()=>sb().removeChannel(r.ch),400)}
  advertise();
  const {data}=await sb().rpc('casino_leave');if(data!=null)setCoins(data);
  if(ov&&!ov.classList.contains('hidden'))showMenu();
 }
 return{build,check,open,refreshCoins};
})();
