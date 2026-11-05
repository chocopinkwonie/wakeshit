/* ===================================================================
   features.js — Vũ trường · Nóc WAKEONE · Chợ Hàn · Quà rơi · Char đặc biệt
   Cách dùng:
     1) Thêm  <script src="features.js"></script>  ngay trước </body> (SAU script chính)
     2) Chạy supabase_features.sql trong Supabase > SQL Editor
     3) Dán 10 link YouTube vào DISCO_VIDEOS bên dưới
   Đặt char_1.glb, char_2.glb vào thư mục models/ như các char khác.
=================================================================== */

/* ---------- CẤU HÌNH ---------- */
const DISCO_VIDEOS=[
 '', // 1  ← dán link YouTube (dạng watch?v=..., youtu.be/... hoặc chỉ ID 11 ký tự)
 '', // 2
 '', // 3
 '', // 4
 '', // 5
 '', // 6
 '', // 7
 '', // 8
 '', // 9
 ''  // 10
];
const SPECIAL_CHARS=[{name:'char_1',need:100},{name:'char_2',need:200}];
const SELL_COOLDOWN=180;          // giây giữa 2 lần bán ở Chợ Hàn
const GIFT_SLOT=120000;           // mỗi 2 phút có 1 hộp quà
const GIFT_LIFE=90000;            // hộp quà tồn tại 90 giây

(function(){
/* ===================================================================
   UI
=================================================================== */
document.head.insertAdjacentHTML('beforeend','<style>#yt-player{position:absolute;inset:0;width:100%;height:100%;border:0}</style>');
document.body.insertAdjacentHTML('beforeend',`
<div id="disco-ui" class="hidden fixed glass rounded-2xl p-2" style="left:50%;transform:translateX(-50%);top:84px;z-index:25;width:min(260px,70vw)">
 <div class="flex items-center justify-between mb-1 text-[11px] font-extrabold text-pink-700"><span id="dv-title">🎤 Sân khấu</span><button id="dv-size" class="btn btn-soft !py-0 !px-2 text-xs">⤢</button></div>
 <div class="relative w-full" style="aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden"><div id="yt-player"></div></div>
 <div class="flex items-center justify-between mt-1"><button id="dv-prev" class="btn btn-soft !py-0 !px-3 text-sm">⏮</button><span id="dv-idx" class="text-[11px] font-extrabold text-pink-700">–</span><button id="dv-next" class="btn btn-soft !py-0 !px-3 text-sm">⏭</button></div>
</div>
<div id="fx-bar" class="fixed flex gap-2 justify-center" style="left:50%;transform:translateX(-50%);bottom:max(64px,env(safe-area-inset-bottom));z-index:25">
 <button id="exit-btn" class="btn btn-dark text-xs hidden">🚪 Ra ngoài</button>
 <button id="seat-btn" class="btn btn-pink text-xs hidden">🪑 Ngồi xuống</button>
 <button id="stand-btn" class="btn btn-soft text-xs hidden">🧍 Đứng dậy</button>
 <button id="down-btn" class="btn btn-dark text-xs hidden">🪂 Nhảy xuống</button>
</div>
<div id="roof-panel" class="hidden fixed glass rounded-2xl p-3" style="left:50%;transform:translateX(-50%);top:190px;z-index:25;width:min(320px,92vw)">
 <div class="text-xs font-extrabold text-pink-700">🏢 Nóc WAKEONE</div>
 <p id="roof-msg" class="text-[11px] text-pink-500 mt-1"></p>
 <div id="roof-list" class="space-y-1 mt-2 max-h-40 overflow-auto"></div>
</div>
<div id="gift-hud" class="hidden fixed glass rounded-full px-3 py-1 text-[11px] font-extrabold text-rose-600" style="left:12px;top:86px;z-index:20"></div>
<div id="market-modal" class="modal-backdrop hidden">
 <div class="modal glass relative">
  <button id="mk-close" class="absolute top-3 right-3 btn btn-soft !py-1 !px-2 text-xs">✕</button>
  <p class="pill inline-block">CHỢ HÀN · BÊN KIA SÔNG</p>
  <h2 class="text-xl font-extrabold text-pink-700 mt-2">Chợ Hàn 🛒</h2>
  <p class="text-xs text-pink-500 mt-1">Thu mua đồ DIOR giá gấp đôi giá mua · mỗi 3 phút được bán 1 lần (bán được nhiều món trong 1 lần).</p>
  <p id="mk-wait" class="text-xs font-extrabold text-rose-600 mt-2"></p>
  <div id="mk-list" class="space-y-2 mt-3"></div>
  <div class="flex items-center justify-between gap-2 mt-4"><span id="mk-total" class="text-xs font-bold text-pink-700"></span><button id="mk-sell" class="btn btn-pink">Bán</button></div>
 </div>
</div>`);

const show=(id,v)=>{const e=$(id);if(e&&e.classList.contains('hidden')===v)e.classList.toggle('hidden',!v)};
const isSpecial=n=>/^char_\d+$/i.test(String(n||''));

/* ===================================================================
   THÊM CỬA HÀNG VÀO BẢN ĐỒ (chạy trước init3DMap nên tự có biển, bảo vệ, va chạm...)
=================================================================== */
shopsData.push({id:12,name:'Chợ Hàn',icon:'🛒',x:114,z:0,type:'market',color:0xfde68a,shape:'box'});
shopsData.push({id:13,name:'Vũ trường WAKEONE',icon:'🪩',x:-52,z:-52,type:'disco',color:0xc4b5fd,shape:'dome'});

/* Nhân vật đặc biệt không được làm NPC / bảo vệ / nhân vật thường */
function noSpecial(fn){return function(){const bak=allChars;allChars=bak.filter(n=>!isSpecial(n));try{return fn.apply(this,arguments)}finally{allChars=bak}}}
syncNpcs=noSpecial(syncNpcs);createGuards=noSpecial(createGuards);
const _lcl=loadCharList;
loadCharList=async function(){await _lcl();allChars=allChars.filter(n=>!isSpecial(n));if(!allChars.length)allChars=CHAR_NAMES.slice()};

/* ===================================================================
   TRẠNG THÁI
=================================================================== */
let inDisco=false,seated=null,onRoof=false,roofRobbed=false,roofBusy=false,roofDir={x:0,z:1},roofSig='',roofTick=0;
let savedEnv=null,savedCam=null,roomG=null,tiles=[],beams=[],ball=null,worldBall=null,discoSeats=[],dvBig=false;
const WORLD_X=[-105,125],WORLD_Z=[-105,105],DR_X=21,DR_Z=[-412,-381];

/* ===================================================================
   KHÔNG GIAN NGOÀI + PHÒNG VŨ TRƯỜNG (dựng sau init3DMap)
=================================================================== */
const _init=init3DMap;
init3DMap=function(){_init();buildExtras()};
function buildExtras(){
 /* Vũ trường ngoài đường: quả cầu disco + đèn neon */
 const d=shopsData.find(s=>s.type==='disco');
 worldBall=new THREE.Mesh(new THREE.SphereGeometry(.8,12,10),new THREE.MeshStandardMaterial({color:0xe5e7eb,metalness:.9,roughness:.2,flatShading:true,emissive:0x7c3aed,emissiveIntensity:.5}));
 worldBall.position.set(d.x,4.3,d.z);scene.add(worldBall);
 /* Chợ Hàn: 2 sạp phụ */
 [[107,-9],[107,9]].forEach(([x,z])=>{
  addBox(scene,3,.9,1.6,0xfde68a,x,.45,z);addBox(scene,3.4,.2,2.2,0xef4444,x,2.3,z);
  addBox(scene,.15,2.2,.15,0x78350f,x-1.5,1.1,z-.9);addBox(scene,.15,2.2,.15,0x78350f,x+1.5,1.1,z-.9);
  colliders.push({x,z,r:1.8});
 });
 buildDisco();
}
function buildDisco(){
 roomG=new THREE.Group();roomG.visible=false;scene.add(roomG);
 const cz=-400,B=(w,h,d,c,x,y,z,o)=>addBox(roomG,w,h,d,c,x,y,z,o);
 B(44,.2,44,0x1b0f33,0,-.1,cz);
 B(44,10,.5,0x2a1546,0,5,-422.25);B(44,10,.5,0x2a1546,0,5,-377.75);B(.5,10,44,0x2a1546,-22.25,5,cz);B(.5,10,44,0x2a1546,22.25,5,cz);
 /* sàn nhảy */
 for(let i=0;i<5;i++)for(let j=0;j<5;j++){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2.9,2.9),new THREE.MeshBasicMaterial({color:0xff00aa}));
  m.rotation.x=-Math.PI/2;m.position.set(-6+i*3,.03,-405+j*3);roomG.add(m);tiles.push(m);
 }
 /* sân khấu */
 B(24,1.2,7,0x3b0764,0,.6,-416.5);B(24,.15,.15,0xf472b6,0,1.25,-413,{emissive:0xf472b6,emissiveIntensity:1});
 B(2,2.4,1.4,0x111827,-10.5,2.4,-416);B(2,2.4,1.4,0x111827,10.5,2.4,-416);
 B(18.6,8.2,.2,0xf0abfc,0,6,-421.8,{emissive:0xf0abfc,emissiveIntensity:.8});
 const cv=document.createElement('canvas');cv.width=1024;cv.height=430;const c=cv.getContext('2d');
 const gr=c.createLinearGradient(0,0,1024,430);gr.addColorStop(0,'#1e1b4b');gr.addColorStop(1,'#831843');c.fillStyle=gr;c.fillRect(0,0,1024,430);
 c.fillStyle='#fff';c.textAlign='center';c.font='bold 72px sans-serif';c.fillText('🎤 SÂN KHẤU WAKEONE',512,190);
 c.font='bold 38px sans-serif';c.fillStyle='#fbcfe8';c.fillText('Video đang chiếu ở khung phía trên màn hình ▲',512,270);
 const scr=new THREE.Mesh(new THREE.PlaneGeometry(17.6,7.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)}));scr.position.set(0,6,-421.6);roomG.add(scr);
 /* đèn chiếu + quả cầu */
 [-2,-1,0,1,2].forEach((k,i)=>{
  const g=new THREE.Group();g.position.set(k*4.5,9.5,-412);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.8,9,16,1,true),new THREE.MeshBasicMaterial({color:[0xf472b6,0x38bdf8,0xfacc15,0x34d399,0xa78bfa][i],transparent:true,opacity:.17,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  cone.position.y=-4.5;g.add(cone);roomG.add(g);beams.push({g,i});
 });
 ball=new THREE.Mesh(new THREE.SphereGeometry(1.4,14,10),new THREE.MeshStandardMaterial({color:0xe5e7eb,metalness:.9,roughness:.2,flatShading:true,emissive:0x7c3aed,emissiveIntensity:.4}));
 ball.position.set(0,8,-399);roomG.add(ball);
 /* cửa ra */
 B(4,5.5,.3,0x22d3ee,0,2.75,-377.5,{emissive:0x22d3ee,emissiveIntensity:.6});
 addLabel('🚪 Lối ra','shop-sign',()=>new THREE.Vector3(0,6.2,-377.5),50);
 addLabel('🎤 Sân khấu','shop-sign big',()=>new THREE.Vector3(0,10.8,-416),70);
 /* bàn + ghế (6 bàn × 2 ghế, quay mặt về sân khấu) */
 [[-12,-392],[12,-392],[-12,-399],[12,-399],[-12,-406],[12,-406]].forEach(([tx,tz])=>{
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.12,16),M(0xf9a8d4));t.position.set(tx,.95,tz);roomG.add(t);
  const l=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.9,8),M(0x64748b));l.position.set(tx,.45,tz);roomG.add(l);
  colliders.push({x:tx,z:tz,r:1});
  [-1.1,1.1].forEach(dx=>{
   const sx=tx+dx,sz=tz+1.5;B(.9,.45,.9,0xdb2777,sx,.25,sz);B(.9,.7,.15,0xbe185d,sx,.8,sz+.4);
   discoSeats.push({x:sx,z:sz});colliders.push({x:sx,z:sz,r:.35});
  });
 });
}
function discoFrame(dt){
 const t=performance.now()/1000;
 tiles.forEach((m,i)=>m.material.color.setHSL((t*.15+i*.045)%1,.85,.55));
 beams.forEach(b=>{b.g.rotation.z=Math.sin(t*1.2+b.i)*.5;b.g.rotation.x=Math.cos(t*.9+b.i*1.7)*.4});
 ball.rotation.y+=dt*.8;
}

/* ===================================================================
   VÀO / RA VŨ TRƯỜNG
=================================================================== */
function enterDisco(){
 if(inDisco||flight||!scene)return;
 inDisco=true;nearShop=null;pendingShop=null;targetPosition=null;
 if(isDancing){isDancing=false;player.position.y=0;stopDanceMusic()}
 savedEnv={bg:scene.background,fog:scene.fog};
 scene.background=new THREE.Color(0x120a24);scene.fog=new THREE.Fog(0x120a24,40,130);
 roomG.visible=true;
 player.position.set(0,0,-385);player.rotation.y=Math.PI;
 cameraAngle=0;cameraElevation=Math.PI/5;cameraDistance=14;
 if(bgm)bgm.pause();
 show('ctx-btn',false);show('nearby-player-panel',false);$('lb').style.display='none';
 show('disco-ui',true);layoutDV();startVideo();sfx('bell');
 lastSig='';showToast('🪩 Chào mừng tới vũ trường! Lại gần ghế rồi bấm 🪑 để ngồi xem');
}
function exitDisco(){
 if(!inDisco)return;
 if(seated)standUp();
 inDisco=false;roomG.visible=false;
 scene.background=savedEnv.bg;scene.fog=savedEnv.fog;
 const d=shopsData.find(s=>s.type==='disco'),L=Math.hypot(d.x,d.z);
 player.position.set(d.x-d.x/L*8.5,0,d.z-d.z/L*8.5);targetPosition=null;
 if(isDancing){isDancing=false;stopDanceMusic()}
 cameraDistance=18;cameraElevation=Math.PI/5;
 stopVideo();show('disco-ui',false);$('lb').style.display='';
 if(bgm&&musicOn)bgm.play().catch(()=>{});
 lastSig='';showToast('Ra khỏi vũ trường 👋');
}
function nearestSeat(){let b=null,bd=2.6;discoSeats.forEach(s=>{const d=Math.hypot(player.position.x-s.x,player.position.z-s.z);if(d<bd){bd=d;b=s}});return b}
function sitDown(s){
 if(!s||seated)return;
 if(isDancing){isDancing=false;stopDanceMusic()}
 seated=s;targetPosition=null;player.position.set(s.x,.35,s.z);player.rotation.y=Math.PI;
 savedCam={a:cameraAngle,e:cameraElevation,d:cameraDistance};
 cameraAngle=0;cameraElevation=.3;cameraDistance=7;dvBig=true;layoutDV();
 showToast('Cậu đang ngồi xem biểu diễn 🎤 (bấm nút đi hoặc 🧍 để đứng dậy)');
}
function standUp(){
 if(!seated)return;const s=seated;seated=null;
 player.position.set(s.x,0,s.z+1.3);
 if(savedCam){cameraAngle=savedCam.a;cameraElevation=savedCam.e;cameraDistance=savedCam.d}
 dvBig=false;layoutDV();
}

/* ===================================================================
   VIDEO YOUTUBE (IFrame API, tự chuyển bài khi hết / lỗi)
=================================================================== */
let ytPlayer=null,ytQueue=null,vIdx=0,vErr=0;
const ytId=s=>{s=String(s||'').trim();if(!s)return null;const m=s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);if(m)return m[1];return /^[\w-]{11}$/.test(s)?s:null};
const vids=()=>DISCO_VIDEOS.map(ytId).filter(Boolean);
window.onYouTubeIframeAPIReady=()=>{if(ytQueue){const f=ytQueue;ytQueue=null;f()}};
function loadYT(cb){
 if(window.YT&&YT.Player){cb();return}
 ytQueue=cb;
 if(!$('yt-api')){const s=document.createElement('script');s.id='yt-api';s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s)}
}
function layoutDV(){
 const p=$('disco-ui');p.style.width=dvBig?'min(760px,94vw)':'min(260px,70vw)';
 $('dv-size').textContent=dvBig?'⤡':'⤢';
}
function updateDVLabel(){const l=vids();$('dv-idx').textContent=l.length?`${vIdx+1}/${l.length}`:'chưa có video';$('dv-title').textContent=l.length?'🎤 Đang biểu diễn':'🎤 Chưa có video (điền link vào features.js)'}
function startVideo(){
 const l=vids();vIdx=Math.min(vIdx,Math.max(0,l.length-1));vErr=0;updateDVLabel();
 if(!l.length)return;
 loadYT(()=>{
  if(!inDisco)return;
  const id=vids()[vIdx];
  if(ytPlayer){ytPlayer.loadVideoById(id);return}
  ytPlayer=new YT.Player('yt-player',{width:'100%',height:'100%',videoId:id,
   playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1},
   events:{onReady:e=>e.target.playVideo(),
    onStateChange:e=>{if(e.data===0)stepVideo(1);else if(e.data===1)vErr=0},
    onError:()=>{vErr++;if(vErr<=vids().length){showToast('Video này không phát được, chuyển bài ⏭');stepVideo(1)}}}});
 });
}
function stopVideo(){if(ytPlayer&&ytPlayer.stopVideo)try{ytPlayer.stopVideo()}catch(e){}}
function stepVideo(d){
 const l=vids();if(!l.length)return;
 vIdx=(vIdx+d+l.length)%l.length;updateDVLabel();
 if(ytPlayer&&ytPlayer.loadVideoById)ytPlayer.loadVideoById(l[vIdx]);
}
$('dv-prev').onclick=()=>stepVideo(-1);$('dv-next').onclick=()=>stepVideo(1);
$('dv-size').onclick=()=>{dvBig=!dvBig;layoutDV()};
$('exit-btn').onclick=exitDisco;
$('seat-btn').onclick=()=>sitDown(nearestSeat());
$('stand-btn').onclick=standUp;

/* ===================================================================
   BẬP BÊNH → NÓC WAKEONE (cướp xu 1 lần)
=================================================================== */
const ROOF_Y=12;
checkSeesaws=function(){
 if(inDisco||onRoof)return;
 const now=performance.now();if(now-lastLaunch<3500)return;
 for(const s of seesawObjs){
  if(Math.hypot(player.position.x-s.x,player.position.z-s.z)<2.2){
   lastLaunch=now;targetPosition=null;if(isDancing)stopDanceMusic();isDancing=false;s.kick=1;
   const L=Math.hypot(s.x,s.z);roofDir={x:s.x/L,z:s.z/L};
   flight={t:0,dur:1.7,fx:player.position.x,fz:player.position.z,tx:roofDir.x*2.6,tz:roofDir.z*2.6,y0:player.position.y,y1:ROOF_Y,arc:10,land:landOnRoof};
   showToast('🚀 Bập bênh phóng thẳng lên nóc WAKEONE!');sfx('boing');flash('rgba(250,204,21,.45)');
   if(srvOK)supabaseClient.rpc('seesaw_launch').then(()=>{});
   return;
  }
 }
};
updateFlight=function(dt){
 flight.t+=dt;const u=Math.min(1,flight.t/flight.dur),y0=flight.y0||0,y1=flight.y1||0;
 player.position.x=flight.fx+(flight.tx-flight.fx)*u;
 player.position.z=flight.fz+(flight.tz-flight.fz)*u;
 player.position.y=y0+(y1-y0)*u+Math.sin(Math.PI*u)*(flight.arc===undefined?16:flight.arc);
 player.rotation.y+=dt*14;
 if(u>=1){player.position.y=y1;const land=flight.land;flight=null;sfx('land');if(land)land()}
};
function landOnRoof(){
 onRoof=true;roofRobbed=false;nearBuilding=true;roofSig='';
 show('ctx-btn',false);show('nearby-player-panel',false);closeActionModal();
 show('roof-panel',true);renderRoof(true);
 showToast('🏢 Cậu đang đứng trên nóc WAKEONE! Chọn 1 người để cướp xu (1 lần)');
}
function jumpDown(){
 if(!onRoof||flight)return;
 onRoof=false;show('roof-panel',false);
 flight={t:0,dur:1.2,fx:player.position.x,fz:player.position.z,tx:roofDir.x*9.5,tz:roofDir.z*9.5,y0:ROOF_Y,y1:0,arc:3,land:null};
 sfx('boing');
}
$('down-btn').onclick=jumpDown;
function renderRoof(force){
 const others=onlineList.filter(o=>o.id!==myId);
 const sig=others.map(o=>o.id).join(',')+'|'+roofRobbed;
 if(!force&&sig===roofSig)return;roofSig=sig;
 $('roof-msg').textContent=roofRobbed?'Cậu đã dùng lượt cướp rồi 😎 Nhảy xuống thôi!':'Chọn 1 người chơi online để cướp xu — chỉ 1 lần mỗi lần lên nóc!';
 const el=$('roof-list');el.innerHTML='';
 others.forEach(o=>{
  const row=document.createElement('div');row.className='inventory-row';row.style.cursor='default';
  row.innerHTML=`<span class="text-xl">🧸</span><span class="flex-1 text-xs font-extrabold text-pink-700">${esc(o.name)}</span>`;
  const b=document.createElement('button');b.className='btn btn-pink !py-1 !px-2 text-xs';b.textContent='🦹 Cướp';b.disabled=roofRobbed;
  b.onclick=()=>roofRob(o.id,o.name);row.appendChild(b);el.appendChild(row);
 });
 if(!others.length)el.innerHTML='<div class="text-[11px] text-pink-500 text-center py-2">Không có ai khác online để cướp 🥲</div>';
}
async function roofRob(id,name){
 if(roofRobbed||roofBusy)return;
 if(!srvOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 roofBusy=true;
 const {data,error}=await supabaseClient.rpc('roof_rob',{p_target:id});
 roofBusy=false;
 if(error){
  const m=error.message||'';
  showToast(/PROTECTED/.test(m)?name+' vừa bị cướp, đang được bảo vệ 🛡️':/NO_TOKEN/.test(m)?'Cậu cần bay lên bằng bập bênh trước nha':/TOO_FAST/.test(m)?'Cướp chậm lại xíu nha ⏳':'Không cướp được: '+m);
  return;
 }
 if(!data||!data.amount){showToast(name+' không có xu để cướp 😅 (cậu vẫn còn lượt)');return}
 roofRobbed=true;coins=data.coins;updateCoinHud();sfx('rob');
 showToast(`🦹 Cậu cướp được ${data.amount} 🪙 của ${name} từ trên nóc nhà!`);popPoints('+'+data.amount+' 🪙');
 if(rtChannel&&rtReady)rtChannel.send({type:'broadcast',event:'robbed',payload:{to:id,from:myName,lost:'coins',amount:data.amount}});
 renderRoof(true);
}

/* ===================================================================
   CHỢ HÀN: bán đồ DIOR giá x2, 3 phút / lần
=================================================================== */
let mkSel={},mkWait=0,mkTimer=null,mkBusy=false;
const fashionInv=()=>inventory.filter(i=>/^fash\d+$/.test(i.id));
async function openMarket(){
 mkSel={};renderMarket();$('market-modal').classList.remove('hidden');
 if(srvOK){
  const {data,error}=await supabaseClient.rpc('sell_wait');
  if(!error&&data!=null)mkWait=+data;else if(error)showToast('Chưa chạy SQL cho Chợ Hàn 🥲');
 }
 clearInterval(mkTimer);mkTimer=setInterval(()=>{if(mkWait>0)mkWait--;renderMarketHead()},1000);renderMarketHead();
}
function closeMarket(){$('market-modal').classList.add('hidden');clearInterval(mkTimer)}
function renderMarket(){
 const l=$('mk-list');l.innerHTML='';
 const inv=fashionInv();
 inv.forEach(it=>{
  const n=mkSel[it.id]||0,row=document.createElement('div');row.className='inventory-row'+(n?' current':'');
  row.innerHTML=`<span class="text-2xl">${it.emoji}</span><span class="flex-1"><span class="block text-xs font-extrabold text-pink-700">${it.name}</span><span class="text-[10px] text-pink-500">Mua 🪙${it.price} → bán 🪙${it.price*2} · có ×${it.count}</span></span>${n?'<button class="minus btn btn-soft !py-0 !px-2 text-sm">−</button>':''}<span class="pill">${n?'bán '+n:'chạm để chọn'}</span>`;
  row.onclick=()=>{mkSel[it.id]=Math.min(it.count,n+1);renderMarket()};
  const mb=row.querySelector('.minus');if(mb)mb.onclick=e=>{e.stopPropagation();mkSel[it.id]=Math.max(0,n-1);renderMarket()};
  l.appendChild(row);
 });
 if(!inv.length)l.innerHTML='<div class="text-center text-sm text-pink-500 py-6">Cậu chưa có đồ DIOR nào. Qua DIOR mua rồi mang sang đây bán nha 👜</div>';
 renderMarketHead();
}
function renderMarketHead(){
 let total=0;fashionInv().forEach(it=>total+=(mkSel[it.id]||0)*it.price*2);
 $('mk-total').textContent=total?`Nhận được: 🪙 ${total}`:'Chưa chọn món nào';
 $('mk-wait').textContent=mkWait>0?`⏳ Còn ${Math.floor(mkWait/60)}:${String(mkWait%60).padStart(2,'0')} nữa mới bán được tiếp`:'✅ Có thể bán ngay!';
 $('mk-sell').disabled=mkWait>0||!total||mkBusy;
}
async function sellMarket(){
 if(mkBusy||mkWait>0)return;
 const items={};let n=0;Object.entries(mkSel).forEach(([k,v])=>{if(v>0){items[k]=v;n+=v}});
 if(!n){showToast('Cậu chưa chọn món nào!');return}
 if(!srvOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 mkBusy=true;
 const {data,error}=await supabaseClient.rpc('sell_items',{items});
 mkBusy=false;
 if(error){
  const m=error.message||'';
  showToast(/COOLDOWN/.test(m)?'Chưa đủ 3 phút, đợi thêm nha ⏳':/NO_ITEM/.test(m)?'Cậu không đủ đồ để bán!':'Không bán được: '+m);
  if(/COOLDOWN/.test(m)){const r=await supabaseClient.rpc('sell_wait');if(r.data!=null)mkWait=+r.data}
  mkSel={};await loadInventory();renderMarket();return;
 }
 coins=data.coins;mkWait=SELL_COOLDOWN;mkSel={};await loadInventory();updateCoinHud();
 popPoints('+'+data.earned+' 🪙');sfx('lap');showToast(`Đã bán ở Chợ Hàn, nhận ${data.earned} 🪙 (gấp đôi giá mua)!`);
 renderMarket();
}
$('mk-close').onclick=closeMarket;$('mk-sell').onclick=sellMarket;

/* ===================================================================
   QUÀ RƠI TỪ TRỜI (+10 🪙): mọi người thấy cùng 1 hộp quà vì vị trí sinh theo mốc thời gian
=================================================================== */
let gift=null,giftClaimed=-1,giftBusy=false,giftHudT=0;
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function giftPos(slot){
 const r=rng(slot*7919+13);
 for(let i=0;i<80;i++){
  const x=(r()-.5)*190,z=(r()-.5)*190;
  if(Math.hypot(x,z)>16&&!onRoad(x,z,2)&&!inRiver(x,z,5)&&!nearSeesaw(x,z)&&!shopsData.some(s=>Math.hypot(x-s.x,z-s.z)<9))return{x,z};
 }
 return{x:20,z:20};
}
function removeGift(){if(!gift)return;scene.remove(gift.g);scene.remove(gift.beam);gift=null}
function giftFrame(dt){
 const now=Date.now(),slot=Math.floor(now/GIFT_SLOT),tIn=now-slot*GIFT_SLOT;
 if(gift&&(gift.slot!==slot||tIn>=GIFT_LIFE))removeGift();
 if(!gift&&tIn<GIFT_LIFE&&slot!==giftClaimed){
  const p=giftPos(slot),g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xf43f5e,roughness:.6})));
  const r1=new THREE.Mesh(new THREE.BoxGeometry(1.06,1.06,.18),new THREE.MeshStandardMaterial({color:0xfde047}));
  const r2=new THREE.Mesh(new THREE.BoxGeometry(.18,1.06,1.06),new THREE.MeshStandardMaterial({color:0xfde047}));
  g.add(r1,r2);g.position.set(p.x,50,p.z);scene.add(g);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,40,12,1,true),new THREE.MeshBasicMaterial({color:0xf472b6,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  beam.position.set(p.x,20,p.z);scene.add(beam);
  gift={slot,x:p.x,z:p.z,g,beam};
  if(!inDisco)showToast(`🎁 Quà rơi từ trời xuống tại (${Math.round(p.x)}, ${Math.round(p.z)})! Chạy tới nhặt +10 🪙`);
 }
 if(!gift){show('gift-hud',false);return}
 const fall=Math.min(1,tIn/4000);
 gift.g.position.y=.6+(1-fall)*(1-fall)*50+(fall>=1?(Math.sin(now/300)+1)*.12:0);
 gift.g.rotation.y+=dt*2;
 const d=Math.hypot(player.position.x-gift.x,player.position.z-gift.z);
 giftHudT-=dt;
 if(giftHudT<=0){
  giftHudT=.5;
  const hud=$('gift-hud');
  hud.textContent=`🎁 Quà tại (${Math.round(gift.x)}, ${Math.round(gift.z)}) · cách ${Math.round(d)}m · còn ${Math.max(0,Math.ceil((GIFT_LIFE-tIn)/1000))}s`;
  show('gift-hud',!inDisco);
 }
 if(fall>=1&&!giftBusy&&!inDisco&&!onRoof&&!flight&&d<2.6)claimGift();
}
async function claimGift(){
 if(!gift||giftBusy)return;
 const slot=gift.slot;
 if(!srvOK){giftClaimed=slot;removeGift();showToast('Chưa kết nối được dữ liệu 🥲');return}
 giftBusy=true;
 const {data,error}=await supabaseClient.rpc('claim_gift',{p_slot:slot});
 giftBusy=false;giftClaimed=slot;removeGift();
 if(error){showToast(/ALREADY/.test(error.message||'')?'Cậu nhặt hộp quà này rồi 😅':'Không nhặt được quà: '+error.message);return}
 coins=data.coins;updateCoinHud();popPoints('+10 🪙 🎁');sfx('lap');showToast('🎁 Nhặt được quà từ trời! +10 🪙');
}

/* ===================================================================
   NHÂN VẬT ĐẶC BIỆT (100 điểm → char_1, 200 điểm → char_2)
=================================================================== */
let unlockedSp=[],baseChar=null,knownUnlocked=null,myScore=0;
async function loadExtra(){
 if(!supabaseClient||!myId)return;
 const {data,error}=await supabaseClient.from('profiles').select('unlocked,base_char,gift_slot,score').eq('id',myId).maybeSingle();
 if(error||!data)return;
 unlockedSp=data.unlocked||[];baseChar=data.base_char||null;myScore=data.score||0;
 if(data.gift_slot&&Number(data.gift_slot)>giftClaimed)giftClaimed=Number(data.gift_slot);
 if(knownUnlocked===null)knownUnlocked=unlockedSp.slice();
 else unlockedSp.forEach(n=>{if(!knownUnlocked.includes(n)){knownUnlocked.push(n);showToast(`🌟 Đạt điểm cao! Mở khóa nhân vật đặc biệt ${n} — vào 🎭 Tủ nhân vật để đổi`);sfx('win')}});
}
const _ls=loadState;
loadState=async function(){
 await _ls();
 if(myChar&&isSpecial(myChar)&&!allChars.includes(myChar))allChars.push(myChar);
 await loadExtra();
};
const _ll=loadLeaderboard;
loadLeaderboard=async function(){await _ll();await loadExtra()};

const _rcm=noSpecial(renderCharModal);
renderCharModal=function(){
 _rcm();
 const l=$('char-list');
 const head=document.createElement('div');head.className='text-[11px] font-extrabold text-pink-700 pt-2';head.textContent='⭐ Nhân vật đặc biệt (mở khóa bằng điểm, đổi miễn phí)';l.appendChild(head);
 SPECIAL_CHARS.forEach(sp=>{
  const ok=unlockedSp.includes(sp.name),cur=myChar===sp.name,row=document.createElement('div');
  row.className='inventory-row'+(cur?' current':'')+(!ok?' locked':'');
  row.innerHTML=`<span class="text-2xl">${cur?'🌸':ok?'⭐':'🔒'}</span><span class="flex-1"><span class="block text-xs font-extrabold text-pink-700">${esc(sp.name)}</span><span class="text-[10px] text-pink-500">${cur?'Đang dùng':ok?'Chạm để đổi':`Cần đạt ${sp.need} điểm (cậu có ${myScore})`}</span></span>`;
  row.onclick=()=>{if(cur)showToast('Cậu đang là '+sp.name+' rồi mà 😆');else if(!ok)showToast(`Cần đạt ${sp.need} điểm để mở khóa ${sp.name} 🏆`);else setFreeChar(sp.name)};
  l.appendChild(row);
 });
 if(isSpecial(myChar)&&baseChar){
  const row=document.createElement('div');row.className='inventory-row';
  row.innerHTML=`<span class="text-2xl">↩️</span><span class="flex-1"><span class="block text-xs font-extrabold text-pink-700">Về nhân vật thường: ${esc(baseChar)}</span><span class="text-[10px] text-pink-500">Miễn phí</span></span>`;
  row.onclick=()=>setFreeChar(baseChar);l.appendChild(row);
 }
};
async function setFreeChar(n){
 if(!srvOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 const t=await loadChar(n);
 if(!t){showToast('Không tải được '+n+'.glb nên chưa đổi được 🥲');return}
 const {data,error}=await supabaseClient.rpc('set_special_char',{p_char:n});
 if(error){showToast(/LOCKED/.test(error.message||'')?'Chưa mở khóa nhân vật này 🔒':'Không đổi được: '+error.message);return}
 myChar=n;baseChar=data.base||baseChar;
 dress(player,playerFallback,n);lastSig='';
 if(rtChannel&&rtReady)rtChannel.track({name:myName,char:myChar});
 updateCharBtn();closeCharModal();showToast('Đã đổi thành '+n+'! ✨');sfx('win');
}

/* ===================================================================
   GẮN VÀO VÒNG LẶP GAME
=================================================================== */
const _os=openShop;
openShop=function(id){
 const s=shopsData.find(x=>x.id===id);
 if(s&&s.type==='disco'){enterDisco();return}
 if(s&&s.type==='market'){openMarket();return}
 _os(id);
};
const worldOnly=fn=>function(){if(inDisco||onRoof)return;return fn.apply(this,arguments)};
checkCarCollision=worldOnly(checkCarCollision);checkCharCollision=worldOnly(checkCharCollision);
checkRobbery=worldOnly(checkRobbery);checkRiver=worldOnly(checkRiver);checkCheckpoints=worldOnly(checkCheckpoints);

const _cn=checkNearby;
checkNearby=function(){
 if(inDisco){
  let near=null;nearId=null;
  for(const id in otherPlayers){const o=otherPlayers[id];if(player.position.distanceTo(o.position)<5){near=o.userData.name;nearId=id;break}}
  $('nearby-player-panel').classList.toggle('hidden',!near);
  if(near)$('nearby-player-text').textContent=`Đang đứng cạnh ${near}!`;
  return;
 }
 if(onRoof){nearBuilding=true;return}
 _cn();
 const pt=document.querySelector('#shop-prompt-modal p.text-xs');
 if(pt&&pendingShop)pt.textContent=pendingShop.type==='disco'?'Cậu đang đứng trước vũ trường. Vào xem biểu diễn nhé?':pendingShop.type==='market'?'Chợ Hàn thu mua đồ DIOR giá gấp đôi. Vào bán nhé?':'Cậu đã đứng sát cửa hàng. Có muốn vào mua sắm không?';
};

const _td=triggerDance;
triggerDance=function(){if(onRoof||seated){showToast('Xuống đất / đứng dậy mới nhảy được nha 💃');return}_td()};
const _sdm=startDanceMusic;
startDanceMusic=function(){if(inDisco)return;_sdm()};
const _tm=toggleMusic;
toggleMusic=function(){if(inDisco){showToast('Trong vũ trường chỉ nghe nhạc từ sân khấu 🎤');return}_tm()};

movePlayer=function(dt){
 const f=(moveKeys.w-moveKeys.s)+joy.f,r=(moveKeys.d-moveKeys.a)+joy.r;
 if(seated){targetPosition=null;if(f||r)standUp();else return}
 if(onRoof)targetPosition=null;
 const speed=(onRoof?6:10)*dt;let nx=player.position.x,nz=player.position.z,mx=0,mz=0;
 if(f||r){
  targetPosition=null;
  mx=-Math.sin(cameraAngle)*f+Math.cos(cameraAngle)*r;mz=-Math.cos(cameraAngle)*f-Math.sin(cameraAngle)*r;
  const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len}
 }else if(targetPosition){
  const dx=targetPosition.x-nx,dz=targetPosition.z-nz,d=Math.hypot(dx,dz);
  if(d>.4){mx=dx/d;mz=dz/d}else targetPosition=null;
 }
 if(mx||mz){
  const tx=nx+mx*speed,tz=nz+mz*speed;
  if(onRoof){nx=tx;nz=tz}
  else if(blocked(nx,nz)||!blocked(tx,tz)){nx=tx;nz=tz}else if(!blocked(tx,nz))nx=tx;else if(!blocked(nx,tz))nz=tz;else targetPosition=null;
  if(!isDancing)player.rotation.y=Math.atan2(mx,mz);
 }
 if(inDisco){nx=Math.max(-DR_X,Math.min(DR_X,nx));nz=Math.max(DR_Z[0],Math.min(DR_Z[1],nz))}
 else if(onRoof){nx=Math.max(-4.6,Math.min(4.6,nx));nz=Math.max(-4.6,Math.min(4.6,nz))}
 else{nx=Math.max(WORLD_X[0],Math.min(WORLD_X[1],nx));nz=Math.max(WORLD_Z[0],Math.min(WORLD_Z[1],nz))}
 player.position.x=nx;player.position.z=nz;
};

updateCamera=function(){
 const by=(onRoof||flight)?player.position.y:0;
 const h=cameraDistance*Math.cos(cameraElevation),y=cameraDistance*Math.sin(cameraElevation);
 camera.position.set(player.position.x+Math.sin(cameraAngle)*h,by+y+1,player.position.z+Math.cos(cameraAngle)*h);
 camera.lookAt(player.position.x,by+1.1,player.position.z);
};

const _us=updateSeesaws;
updateSeesaws=function(dt){
 _us(dt);
 if(!scene||!player||!roomG)return;
 if(inDisco)discoFrame(dt);
 if(worldBall)worldBall.rotation.y+=dt;
 giftFrame(dt);
 show('exit-btn',inDisco);show('seat-btn',inDisco&&!seated&&!!nearestSeat());show('stand-btn',!!seated);show('down-btn',onRoof&&!flight);
 if(onRoof){roofTick+=dt;if(roofTick>1.5){roofTick=0;renderRoof(false)}}
};

window.addEventListener('keydown',e=>{
 if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
 if(e.key.toLowerCase()!=='e'||!inDisco)return;
 if(seated)standUp();else sitDown(nearestSeat());
});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeMarket()});
})();
