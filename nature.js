/* ===================================================================
   nature.js — Ngày/Đêm · Chim · Đom đóm · Câu cá · Mưa & Ốm · Chỗ trú mưa
               · Tiệm ô dù · Tên bị tòa nhà che thì ẩn · Tên NPC nhỏ lại
   -------------------------------------------------------------------
   CÁCH DÙNG
     1) Thêm  <script src="nature.js?v=1"></script>  CUỐI CÙNG trong index.html
        (sau features.js, market.js, world.js, bank.js, voice.js, ui-fix.js ...)
     2) Chạy supabase_nature.sql trong Supabase > SQL Editor
     3) Bỏ file  dom.mp3  cạnh index.html (nhạc phát khi đom đóm xuất hiện)
   Không sửa bất kỳ file cũ nào: file này tự "bọc" (wrap) các hàm có sẵn.
   Debug trong console:  natureDebug.night() / .day() / .rain(true|false|null) / .sick()
=================================================================== */
(function(){
'use strict';

/* ---------- CẤU HÌNH ---------- */
const CFG={
 DAY_SECS:1800,            // 30 phút ngày  (đêm = 3600 - ngày)
 FADE_SECS:120,            // thời gian chuyển sáng/tối
 FF_MAX:20,                // tối đa đom đóm / đêm / người (server cũng kiểm tra)
 FF_REWARD:5,              // xu / con (server quyết định)
 FF_WAVES:3,               // số "đợt" đom đóm xuất hiện mỗi đêm (thi thoảng thôi)
 FF_WAVE_SECS:240,         // mỗi đợt kéo dài 4 phút
 FF_PER_WAVE:10,           // số con mỗi đợt
 FF_RANGE:7,               // phải đứng trong 7m mới bắt được
 FF_SOUND:'dom.mp3',
 RAIN_CHANCE:0.35,         // mỗi nửa giờ có 35% khả năng có 1 cơn mưa (lâu lâu mới mưa)
 RAIN_MIN:240, RAIN_MAX:420,   // mưa 4–7 phút
 SICK_AFTER:180,           // đứng mưa liên tục 3 phút không trú -> ốm
 SICK_SECS:60,             // ốm 1 phút (server giữ giờ)
 SICK_SPEED:0,             // 0 = đứng yên; ví dụ 0.3 = đi chậm 30% tốc độ
 UMB_PRICE:20, UMB_MIN:15, MED_PRICE:15
};
window.NATURE_CFG=CFG;

/* ---------- TIỆN ÍCH ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const ss=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const sh=(id,v)=>{const e=$(id);if(e)e.classList.toggle('hidden',!v)};
const inDiscoRoom=()=>!!player&&player.position.z<-300;
const rpc=(n,a)=>supabaseClient.rpc(n,a);
const errMsg=e=>(e&&e.message)||'';

/* ===================================================================
   CSS + UI
=================================================================== */
document.head.insertAdjacentHTML('beforeend',`<style>
/* tên NPC / bảo vệ nhỏ lại */
.name-tag.npc{font-size:8px!important;padding:1px 6px!important;border-radius:8px!important;font-weight:700!important;opacity:.88;box-shadow:0 2px 5px rgba(0,0,0,.18)!important}
#nat-sick{position:fixed;inset:0;z-index:18;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,0) 35%,rgba(34,197,94,.38) 100%);animation:natSick 2.4s ease-in-out infinite}
@keyframes natSick{0%,100%{opacity:.55}50%{opacity:1}}
#fish-ui.bite{border-color:#ef4444!important;box-shadow:0 0 0 3px rgba(239,68,68,.35),0 10px 25px rgba(0,0,0,.15)}
#fish-bar{transition:none!important}
</style>`);
document.body.insertAdjacentHTML('beforeend',`
<div id="nat-hud" class="fixed glass rounded-xl px-2 py-1 text-[10px] font-extrabold text-pink-700 text-right" style="right:12px;top:92px;z-index:19;pointer-events:none;max-width:48vw;line-height:1.4"></div>
<div id="nat-sick" class="hidden"></div>
<div id="nat-bar" class="fixed flex gap-2 justify-center" style="left:50%;transform:translateX(-50%);bottom:max(112px,env(safe-area-inset-bottom));z-index:25">
 <button id="nat-sit" class="btn btn-pink text-xs hidden">🎣 Ngồi câu cá</button>
 <button id="nat-catch" class="btn btn-pink text-xs hidden">✨ Bắt đom đóm</button>
 <button id="nat-med" class="btn btn-dark text-xs hidden">💊 Uống thuốc</button>
</div>
<div id="fish-ui" class="hidden fixed glass rounded-2xl p-3" style="left:50%;transform:translateX(-50%);bottom:max(112px,env(safe-area-inset-bottom));z-index:26;width:min(320px,88vw)">
 <div id="fish-title" class="text-xs font-extrabold text-pink-700 text-center"></div>
 <div class="progress mt-2"><i id="fish-bar" style="width:0%"></i></div>
 <div class="flex gap-2 mt-2"><button id="fish-act" class="btn btn-pink flex-1 text-sm">🎣 Thả câu</button><button id="fish-stand" class="btn btn-soft text-xs">🧍 Đứng dậy</button></div>
</div>
<div id="nat-shop" class="modal-backdrop hidden">
 <div class="modal glass relative">
  <button id="nat-shop-x" class="absolute top-3 right-3 btn btn-soft !py-1 !px-2 text-xs">✕</button>
  <p class="pill inline-block">TIỆM Ô DÙ</p>
  <h2 class="text-xl font-extrabold text-pink-700 mt-2">Tiệm ô dù ☂️</h2>
  <p class="text-xs text-pink-500 mt-1">Trời mưa đứng ngoài 3 phút là ốm đó nha! Ô giúp cậu đi dưới mưa thoải mái.</p>
  <div class="product-grid mt-4">
   <div class="product" id="nat-buy-umb"><div class="product-emoji">☂️</div><div class="text-xs font-extrabold text-pink-700">Ô che mưa</div><div class="text-[10px] text-pink-500">Kháng mưa ${CFG.UMB_MIN} phút · <b>🪙 ${CFG.UMB_PRICE}</b></div><span class="pill mt-auto">Mua</span></div>
   <div class="product" id="nat-buy-med"><div class="product-emoji">💊</div><div class="text-xs font-extrabold text-pink-700">Thuốc cảm</div><div class="text-[10px] text-pink-500">Hết ốm ngay · <b>🪙 ${CFG.MED_PRICE}</b></div><span class="pill mt-auto">Mua</span></div>
  </div>
  <p id="nat-shop-info" class="text-xs font-bold text-pink-700 mt-3"></p>
 </div>
</div>`);

/* ===================================================================
   THÊM TIỆM Ô DÙ (phải push trước init3DMap để tự có biển, bảo vệ, va chạm)
=================================================================== */
shopsData.push({id:14,name:'Tiệm ô dù',icon:'☂️',x:-50,z:50,type:'umbrella',color:0xbfdbfe,shape:'dome'});

/* ===================================================================
   ĐỒNG HỒ NGÀY/ĐÊM — dùng giờ server (UTC) nên ai cũng thấy cùng lúc.
   Mỗi giờ UTC = 1 chu kỳ: phút 0-29 ngày, phút 30-59 đêm.
=================================================================== */
let clockOff=0,dbgOff=0,natOK=false,built=false,T=0;
const dbg={rain:null};
const nowMs=()=>Date.now()+clockOff+dbgOff;
const phase=()=>((nowMs()/1000)%3600+3600)%3600;
const nightId=()=>Math.floor(nowMs()/3600000);
function dayness(ph){
 const D=CFG.DAY_SECS,F=CFG.FADE_SECS;
 if(ph<D-F)return 1;
 if(ph<D)return 1-ss((ph-(D-F))/F);
 if(ph<3600-F)return 0;
 return ss((ph-(3600-F))/F);
}
function rainAt(){
 if(dbg.rain!==null)return dbg.rain?1:0;
 const t=nowMs()/1000,slot=Math.floor(t/1800),off=t-slot*1800,r=rng(slot*7777+31);
 if(r()>=CFG.RAIN_CHANCE)return 0;
 const st=200+r()*700,du=CFG.RAIN_MIN+r()*(CFG.RAIN_MAX-CFG.RAIN_MIN);
 if(off<st||off>st+du)return 0;
 return Math.min(1,(off-st)/20,(st+du-off)/20);
}

/* ===================================================================
   BẦU TRỜI: sao, mặt trời, mặt trăng, mây, chim
=================================================================== */
let worldBg=null,worldFog=null,hemi=null,sunL=null,sky=null,stars=null,sunM=null,moonM=null;
let cloudMat=null,rainCloudMat=null,clouds=[],rainClouds=[],birds=[],rainLines=null,rainPos=null,rainLocal=null;
const cSkyD=new THREE.Color(0xcdeefd),cSkyN=new THREE.Color(0x0a1230),cDusk=new THREE.Color(0xf4a47c),cRain=new THREE.Color(0x8f9aa6);
const cHD=new THREE.Color(0xffffff),cHN=new THREE.Color(0x8fa3e0),cGD=new THREE.Color(0x94a3b8),cGN=new THREE.Color(0x1c2540);
const cSD=new THREE.Color(0xfffbeb),cSN=new THREE.Color(0x9db4ff),cCD=new THREE.Color(0xffffff),cCN=new THREE.Color(0x2b3558);
const tmp=new THREE.Color(),tmp2=new THREE.Color();

function buildSky(){
 sky=new THREE.Group();scene.add(sky);
 const n=700,pos=new Float32Array(n*3),r=rng(1234);
 for(let i=0;i<n;i++){const th=r()*Math.PI*2,yf=.08+.92*r(),hz=Math.sqrt(1-yf*yf),R=230;pos[i*3]=R*hz*Math.cos(th);pos[i*3+1]=R*yf;pos[i*3+2]=R*hz*Math.sin(th)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
 stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));
 stars.frustumCulled=false;sky.add(stars);
 sunM=new THREE.Mesh(new THREE.SphereGeometry(9,16,12),new THREE.MeshBasicMaterial({color:0xfff2a8,fog:false,transparent:true}));sky.add(sunM);
 moonM=new THREE.Mesh(new THREE.SphereGeometry(7,16,12),new THREE.MeshBasicMaterial({color:0xf1f5f9,fog:false,transparent:true}));sky.add(moonM);
 /* mây (đứng ngoài `sky` để trôi thật) */
 cloudMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,fog:false,depthWrite:false});
 rainCloudMat=new THREE.MeshBasicMaterial({color:0x6b7280,transparent:true,opacity:0,fog:false,depthWrite:false});
 const sph=new THREE.SphereGeometry(1,10,8),cr=rng(55);
 const mkCloud=(mat,arr,spread,y0,y1,big)=>{
  const g=new THREE.Group();
  for(let j=0;j<4;j++){const m=new THREE.Mesh(sph,mat);m.scale.set((5+cr()*4)*big,(1.6+cr()*.9)*big,(3+cr()*2)*big);m.position.set((j-1.5)*5*big+cr()*2,cr()*1.2,cr()*3);g.add(m)}
  g.position.set((cr()-.5)*spread,y0+cr()*(y1-y0),(cr()-.5)*spread);scene.add(g);arr.push({g,sp:1+cr()*1.6});
 };
 for(let i=0;i<16;i++)mkCloud(cloudMat,clouds,440,48,70,1);
 for(let i=0;i<12;i++)mkCloud(rainCloudMat,rainClouds,300,36,46,1.5);
}
function buildBirds(){
 const wingG=new THREE.PlaneGeometry(.9,.3);wingG.translate(.45,0,0);wingG.rotateX(-Math.PI/2);
 const bodyG=new THREE.ConeGeometry(.12,.55,6);bodyG.rotateX(Math.PI/2);
 const mat=new THREE.MeshBasicMaterial({color:0x1f2937,side:THREE.DoubleSide,fog:false}),r=rng(808);
 for(let i=0;i<10;i++){
  const g=new THREE.Group(),pl=new THREE.Group(),pr=new THREE.Group();
  pl.add(new THREE.Mesh(wingG,mat));pr.add(new THREE.Mesh(wingG,mat));pr.scale.x=-1;
  g.add(new THREE.Mesh(bodyG,mat),pl,pr);g.scale.setScalar(1.3);scene.add(g);
  birds.push({g,pl,pr,cx:(r()-.5)*170,cz:(r()-.5)*170,R:15+r()*40,sp:(.12+r()*.18)*(r()<.5?1:-1),a:r()*6.28,alt:16+r()*14,ph:r()*6});
 }
}
function buildRainFx(){
 const N=700;rainLocal=new Float32Array(N*3);rainPos=new Float32Array(N*6);
 for(let i=0;i<N;i++){rainLocal[i*3]=(Math.random()-.5)*44;rainLocal[i*3+1]=Math.random()*30;rainLocal[i*3+2]=(Math.random()-.5)*44}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
 rainLines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xbfd8ff,transparent:true,opacity:0,fog:false}));
 rainLines.frustumCulled=false;rainLines.visible=false;scene.add(rainLines);
}

function applyEnv(d,k,ph){
 /* màu trời + sương mù */
 tmp.copy(cSkyN).lerp(cSkyD,d);
 tmp.lerp(cDusk,Math.max(0,1-Math.abs(d-.5)*3.2)*.5);
 tmp2.copy(cRain).multiplyScalar(.3+.7*d);tmp.lerp(tmp2,k*.8);
 if(worldBg&&worldBg.isColor)worldBg.copy(tmp);
 if(worldFog){worldFog.color.copy(tmp);worldFog.near=lerp(60,110,d)*(1-.45*k);worldFog.far=lerp(190,260,d)*(1-.35*k)}
 /* mặt trời / mặt trăng */
 const a=ph<1800?ph/1800*Math.PI:(ph-1800)/1800*Math.PI;
 const dirX=Math.cos(a)*190,dirY=Math.sin(a)*140+6;
 sunM.position.set(dirX,dirY,-70);moonM.position.set(dirX,dirY,70);
 sunM.material.opacity=ss(d*1.6)*(1-k*.85);sunM.visible=sunM.material.opacity>.02&&ph<1800+1;
 moonM.material.opacity=ss((1-d)*1.6)*(1-k*.7);moonM.visible=moonM.material.opacity>.02&&ph>=1800;
 stars.material.opacity=Math.pow(1-d,1.6)*(1-k*.85);stars.visible=stars.material.opacity>.02;
 /* ánh sáng */
 if(inDiscoRoom()){
  hemi.intensity=1.15;hemi.color.copy(cHD);hemi.groundColor.copy(cGD);sunL.intensity=.9;sunL.color.copy(cSD);
 }else{
  hemi.intensity=lerp(.55,1.15,d)*(1-.28*k);hemi.color.copy(cHN).lerp(cHD,d);hemi.groundColor.copy(cGN).lerp(cGD,d);
  sunL.intensity=lerp(.14,.9,d)*(1-.5*k);sunL.color.copy(cSN).lerp(cSD,d);
  const p=d>.5?sunM.position:moonM.position;sunL.position.set(p.x*.3,Math.max(10,p.y*.3),p.z*.3);
 }
 /* mây */
 tmp.copy(cCN).lerp(cCD,d);tmp2.copy(cRain).multiplyScalar(.35+.65*d);tmp.lerp(tmp2,k*.7);cloudMat.color.copy(tmp);
 cloudMat.opacity=lerp(.5,.92,d);
 rainCloudMat.opacity=k*.95;rainCloudMat.color.copy(cRain).multiplyScalar(.3+.5*d);
}
function skyFrame(dt,d,k){
 sky.position.set(player.position.x,0,player.position.z);
 const wrap=(o,s)=>{o.g.position.x+=s*dt;if(o.g.position.x>230)o.g.position.x=-230};
 clouds.forEach(o=>wrap(o,o.sp));
 const rv=k>.02;rainClouds.forEach(o=>{o.g.visible=rv;if(rv)wrap(o,o.sp*.8)});
 const bv=d>.3&&k<.7&&!inDiscoRoom();
 birds.forEach(b=>{
  b.g.visible=bv;if(!bv)return;
  b.a+=b.sp*dt;const x=b.cx+Math.cos(b.a)*b.R,z=b.cz+Math.sin(b.a)*b.R,y=b.alt+Math.sin(T*.6+b.ph)*1.5;
  const sg=Math.sign(b.sp);b.g.position.set(x,y,z);b.g.rotation.y=Math.atan2(-Math.sin(b.a)*sg,Math.cos(b.a)*sg);
  const f=Math.sin(T*9+b.ph)*.7;b.pl.rotation.z=f;b.pr.rotation.z=f;
 });
 /* mưa rơi */
 const on=k>.02&&!inDiscoRoom();rainLines.visible=on;
 if(on){
  rainLines.material.opacity=.55*k;
  const px=player.position.x,pz=player.position.z,N=rainLocal.length/3,sp=30*dt;
  for(let i=0;i<N;i++){
   let y=rainLocal[i*3+1]-sp;if(y<0)y+=30;rainLocal[i*3+1]=y;
   const x=px+rainLocal[i*3],z=pz+rainLocal[i*3+2];
   rainPos[i*6]=x;rainPos[i*6+1]=y;rainPos[i*6+2]=z;
   rainPos[i*6+3]=x+.06;rainPos[i*6+4]=y+.8;rainPos[i*6+5]=z+.04;
  }
  rainLines.geometry.attributes.position.needsUpdate=true;
 }
}

/* ---- tiếng mưa (tổng hợp bằng WebAudio, không cần file) ---- */
let rainSrc=null,rainGain=null,rainLP=null;
function rainSound(k,sheltered){
 const want=(sfxOn&&k>.03&&!inDiscoRoom())?k*(sheltered?.3:.75)*.3:0;
 if(!rainSrc){
  if(want<=0)return;
  const c=audio();if(!c)return;
  const len=c.sampleRate*2,buf=c.createBuffer(1,len,c.sampleRate),a=buf.getChannelData(0);
  for(let i=0;i<len;i++)a[i]=Math.random()*2-1;
  rainSrc=c.createBufferSource();rainSrc.buffer=buf;rainSrc.loop=true;
  const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=500;
  rainLP=c.createBiquadFilter();rainLP.type='lowpass';rainLP.frequency.value=3500;
  rainGain=c.createGain();rainGain.gain.value=0;
  rainSrc.connect(hp);hp.connect(rainLP);rainLP.connect(rainGain);rainGain.connect(c.destination);rainSrc.start();
 }
 const c=audio();if(!c)return;
 rainGain.gain.setTargetAtTime(want,c.currentTime,.5);
 rainLP.frequency.setTargetAtTime(sheltered?900:3500,c.currentTime,.4);
}

/* ===================================================================
   CHỖ TRÚ MƯA (10 chòi) + 4 GHẾ CÂU CÁ CÓ MÁI CHE
=================================================================== */
const PAV=[[19,19],[-19,19],[19,-19],[-19,-19],[40,40],[-40,40],[40,-40],[-40,-40],[106,22],[106,-22]];
const SEATS=[{x:81.4,z:-38},{x:81.4,z:-30},{x:81.4,z:30},{x:81.4,z:38}];
const occ=[];   // hộp che chữ
const addOcc=(cx,cz,hx,hz,y0,y1)=>occ.push({x0:cx-hx,x1:cx+hx,z0:cz-hz,z1:cz+hz,y0,y1});
let rods=[];

function buildShelters(){
 PAV.forEach(([x,z])=>{
  const g=new THREE.Group();
  addBox(g,4.4,.12,4.4,0xfbcfe8,0,.06,0);
  [[-1.9,-1.9],[1.9,-1.9],[-1.9,1.9],[1.9,1.9]].forEach(([a,b])=>addBox(g,.18,2.6,.18,0x9d174d,a,1.3,b));
  addBox(g,4.7,.15,4.7,0xbe185d,0,2.65,0);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.4,1.3,4),M(0xdb2777));roof.rotation.y=Math.PI/4;roof.position.y=3.3;g.add(roof);
  addBox(g,2.6,.3,.7,0x94a3b8,0,.35,-1.5);
  g.position.set(x,0,z);scene.add(g);
  addOcc(x,z,2.4,2.4,2.55,3.95);
  addLabel('☂️ Chỗ trú mưa','shop-sign',()=>new THREE.Vector3(x,4.7,z),45);
  /* cây random không chặn đường vào chòi */
  for(let i=colliders.length-1;i>=0;i--){const c=colliders[i];if(c.r===.7&&Math.hypot(c.x-x,c.z-z)<3.2)colliders.splice(i,1)}
 });
}
function buildFishing(){
 SEATS.forEach((s,i)=>{
  const g=new THREE.Group();
  addBox(g,3.2,.12,3.2,0x92400e,0,.06,0);                       // sàn gỗ
  [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]].forEach(([a,b])=>addBox(g,.14,2.5,.14,0x78350f,a,1.25,b));
  addBox(g,3.5,.14,3.5,0xdb2777,0,2.55,0);addBox(g,2.4,.3,2.4,0xf472b6,0,2.8,0);   // mái che
  addBox(g,.9,.45,.9,0xbe185d,0,.35,0);addBox(g,.12,.8,.9,0x9d174d,-.42,.8,0);    // ghế
  g.position.set(s.x,0,s.z);scene.add(g);
  addOcc(s.x,s.z,1.75,1.75,2.45,2.95);
  addLabel('🎣 Ghế câu cá','shop-sign',()=>new THREE.Vector3(s.x,3.6,s.z),40);
  /* cần câu + dây + phao (chỉ hiện khi có người ngồi) */
  const rg=new THREE.Group(),hx=s.x+.3,hy=1.0,tx=s.x+2.0,ty=2.3,dx=tx-hx,dy=ty-hy,L=Math.hypot(dx,dy);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,L,6),M(0x78350f));
  rod.position.set((hx+tx)/2,(hy+ty)/2,s.z);rod.rotation.z=-Math.atan2(dx,dy);rg.add(rod);
  const bob=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),M(0xef4444));rg.add(bob);
  const lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(tx,ty,s.z),new THREE.Vector3(s.x+6.8,.1,s.z)]);
  const line=new THREE.Line(lg,new THREE.LineBasicMaterial({color:0xffffff}));line.frustumCulled=false;rg.add(line);
  rg.visible=false;scene.add(rg);rods.push({g:rg,bob,lg,tx,ty,z:s.z,bx:s.x+6.8});
 });
}

/* ===================================================================
   BỤI CÂY + ĐOM ĐÓM
=================================================================== */
let FF_SPOTS=[];
const WATER_SPOTS=[{x:90,z:-30,w:1},{x:91,z:-55,w:1},{x:90,z:28,w:1},{x:91,z:55,w:1},{x:90,z:75,w:1},{x:92,z:-78,w:1}];
function buildFireflySpots(){
 const r=rng(90210),okSpot=(x,z)=>
  Math.max(Math.abs(x),Math.abs(z))>28&&!onRoad(x,z,4)&&!inRiver(x,z,6)&&!nearSeesaw(x,z)&&Math.abs(z)<98&&x>-98&&x<76&&
  !shopsData.some(s=>Math.hypot(x-s.x,z-s.z)<10)&&!PAV.some(p=>Math.hypot(x-p[0],z-p[1])<8)&&!SEATS.some(s=>Math.hypot(x-s.x,z-s.z)<8);
 for(let i=0;i<600&&FF_SPOTS.length<14;i++){const x=(r()-.5)*190,z=(r()-.5)*190;if(okSpot(x,z))FF_SPOTS.push({x,z})}
 if(!FF_SPOTS.length)FF_SPOTS=[{x:-60,z:0},{x:60,z:-40},{x:0,z:-90}];
 const bg=new THREE.DodecahedronGeometry(1),bm=[M(0x15803d),M(0x166534)];
 FF_SPOTS.forEach((s,i)=>{
  for(let j=0;j<4;j++){const b=new THREE.Mesh(bg,bm[j%2]);b.scale.setScalar(.6+((i*7+j*3)%5)*.12);b.position.set(s.x+Math.cos(j*1.9)*1.2,.4,s.z+Math.sin(j*1.9)*1.2);scene.add(b)}
 });
}
let glowTex=null;
function glow(){
 if(glowTex)return glowTex;
 const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');
 const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,200,1)');g.addColorStop(.25,'rgba(255,230,90,.75)');g.addColorStop(1,'rgba(255,220,60,0)');
 c.fillStyle=g;c.fillRect(0,0,64,64);return glowTex=new THREE.CanvasTexture(cv);
}
let ffs=[],parts=[],ffCount=0,ffBusy=false,ffWave=-1,ffWaveNight=-1,ffAudio=null,ffToastedMax=false;
const waveCache={night:-2,list:[]};
function waves(n){
 if(waveCache.night===n)return waveCache.list;
 const r=rng(((n*2654435761)>>>0)^0xA5A5),list=[],seg=1620/CFG.FF_WAVES;
 for(let k=0;k<CFG.FF_WAVES;k++){const st=1800+60+k*seg+r()*(seg-CFG.FF_WAVE_SECS);list.push({k,start:st,end:st+CFG.FF_WAVE_SECS})}
 waveCache.night=n;waveCache.list=list;return list;
}
function clearFireflies(){ffs.forEach(f=>{scene.remove(f.s);f.s.material.dispose()});ffs=[]}
function spawnWave(n,k){
 clearFireflies();
 const r=rng(n*131+k*977+3),spots=[];
 for(let i=0;i<3;i++)spots.push(FF_SPOTS[Math.floor(r()*FF_SPOTS.length)]);
 spots.push(WATER_SPOTS[Math.floor(r()*WATER_SPOTS.length)]);
 for(let i=0;i<CFG.FF_PER_WAVE;i++){
  const sp=spots[i%4],a=r()*Math.PI*2,rad=1+r()*(sp.w?4:2.6);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glow(),color:0xfff176,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:0}));
  s.scale.setScalar(.9);scene.add(s);
  ffs.push({s,bx:sp.x+Math.cos(a)*rad,bz:sp.z+Math.sin(a)*rad,by:sp.w?.9+r()*1.0:.7+r()*1.6,ph:r()*6.28,dead:false});
 }
 /* báo gợi ý chỗ gần nhất + phát nhạc dom.mp3 */
 let best=spots[0],bd=1e9;spots.forEach(s=>{const d=Math.hypot(player.position.x-s.x,player.position.z-s.z);if(d<bd){bd=d;best=s}});
 showToast(`✨ Đom đóm xuất hiện gần (${Math.round(best.x)}, ${Math.round(best.z)})! Lại gần rồi chạm vào để bắt (+${CFG.FF_REWARD} 🪙)`);
 playFirefly();
}
function playFirefly(){
 if(!sfxOn)return;
 try{
  if(!ffAudio){ffAudio=new Audio(encodeURI(CFG.FF_SOUND));ffAudio.volume=.75;
   ffAudio.addEventListener('ended',()=>{if(bgm)bgm.volume=.35});ffAudio.addEventListener('error',()=>{if(bgm)bgm.volume=.35})}
  ffAudio.currentTime=0;if(bgm)bgm.volume=.1;
  ffAudio.play().catch(()=>{if(bgm)bgm.volume=.35});
 }catch(e){}
}
function burst(pos){
 for(let i=0;i<10;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glow(),color:0xfff59d,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
  s.scale.setScalar(.35);s.position.copy(pos);scene.add(s);
  parts.push({s,v:new THREE.Vector3((Math.random()-.5)*3,Math.random()*2.5,(Math.random()-.5)*3),t:0});
 }
}
function partsFrame(dt){
 for(let i=parts.length-1;i>=0;i--){
  const p=parts[i];p.t+=dt;p.s.position.addScaledVector(p.v,dt);p.s.material.opacity=Math.max(0,1-p.t/.8);
  if(p.t>.8){scene.remove(p.s);p.s.material.dispose();parts.splice(i,1)}
 }
}
function nearestFF(){
 let best=null,bd=1e9;
 ffs.forEach(f=>{if(f.dead||f.s.material.opacity<.05)return;const d=player.position.distanceTo(f.s.position);if(d<bd){bd=d;best=f}});
 return best?{f:best,d:bd}:null;
}
async function catchFirefly(f){
 if(ffBusy||f.dead)return;
 if(ffCount>=CFG.FF_MAX){showToast(`Đêm nay cậu bắt đủ ${CFG.FF_MAX} con rồi 😴`);return}
 if(!srvOK||!natOK){showToast('Chưa kết nối được dữ liệu 🥲 (chạy supabase_nature.sql)');return}
 ffBusy=true;
 const {data,error}=await rpc('catch_firefly');
 ffBusy=false;
 if(error){
  const m=errMsg(error);
  if(/LIMIT/.test(m)){ffCount=CFG.FF_MAX;showToast(`Đêm nay cậu bắt đủ ${CFG.FF_MAX} con rồi 😴`)}
  else if(/NOT_NIGHT/.test(m))showToast('Chưa phải ban đêm theo giờ server 🌞');
  else if(/TOO_FAST/.test(m))showToast('Bắt chậm lại xíu nha ✨');
  else showToast('Không bắt được: '+m);
  return;
 }
 f.dead=true;f.s.visible=false;burst(f.s.position);
 ffCount=data.count;coins=data.coins;updateCoinHud();sfx('ping');popPoints('+'+CFG.FF_REWARD+' 🪙 ✨');
 showToast(`✨ Bắt được đom đóm! (${ffCount}/${CFG.FF_MAX} đêm nay)`);
}
function tapFirefly(cx,cy){
 const el=renderer.domElement,r=el.getBoundingClientRect();let best=null,bd=46;
 ffs.forEach(f=>{
  if(f.dead||f.s.material.opacity<.05)return;
  const v=f.s.position.clone().project(camera);if(v.z>1)return;
  const sx=(v.x*.5+.5)*r.width+r.left,sy=(-v.y*.5+.5)*r.height+r.top,d=Math.hypot(sx-cx,sy-cy);
  if(d<bd){bd=d;best=f}
 });
 if(!best)return false;
 const dist=player.position.distanceTo(best.s.position);
 if(dist>CFG.FF_RANGE+1){showToast(`Đom đóm còn xa quá (${Math.round(dist)}m), lại gần hơn nha ✨`);return true}
 catchFirefly(best);return true;
}
function fireflyFrame(dt,d,ph){
 partsFrame(dt);
 const n=nightId(),ws=waves(n);
 if(ffWaveNight!==n){ffWaveNight=n;ffWave=-1;ffToastedMax=false;clearFireflies();if(natOK)loadStatus()}
 let act=-1;
 if(ph>=1800)for(const w of ws)if(ph>=w.start&&ph<w.end){act=w.k;break}
 if(act!==ffWave){
  const was=ffWave;ffWave=act;
  if(act<0)clearFireflies();
  else if(!inDiscoRoom()||true){
   /* vào giữa đợt (vừa tải trang) thì chỉ dựng lại, không phát nhạc/thông báo */
   const late=ph-ws[act].start>20&&was===-1&&T<8;
   if(late){const sm=sfxOn;sfxOn=false;try{spawnWave(n,act)}finally{sfxOn=sm}}else spawnWave(n,act);
  }
 }
 const vis=ffCount>=CFG.FF_MAX?0:clamp((.7-d)/.4,0,1);
 ffs.forEach(f=>{
  if(f.dead)return;const t=T+f.ph;
  f.s.position.set(f.bx+Math.sin(t*.7)*.9,f.by+Math.sin(t*1.3)*.35,f.bz+Math.cos(t*.6)*.9);
  const fl=.55+.45*Math.sin(T*5+f.ph*3);f.s.material.opacity=fl*vis;f.s.scale.setScalar(.7+.35*fl);
 });
 if(ffCount>=CFG.FF_MAX&&!ffToastedMax&&ffs.length){ffToastedMax=true;showToast(`🌙 Cậu đã bắt đủ ${CFG.FF_MAX} đom đóm đêm nay!`)}
}

/* ===================================================================
   MƯA → ỐM (đồng bộ Supabase để F5 không né được)
=================================================================== */
let rainK=0,exposure=0,sickUntil=0,sickBusy=false,umbUntil=0,umbMesh=null,sickLabel=null,warned=0;
const sickActive=()=>performance.now()<sickUntil;
const umbActive=()=>performance.now()<umbUntil;
const sickOthers={},sickOtherLabels={};
function sheltered(){
 if(inDiscoRoom())return true;
 const x=player.position.x,z=player.position.z;
 if(PAV.some(p=>Math.abs(x-p[0])<2.2&&Math.abs(z-p[1])<2.2&&player.position.y<2))return true;
 if(fishing||SEATS.some(s=>Math.abs(x-s.x)<1.6&&Math.abs(z-s.z)<1.6&&player.position.y<2))return true;
 if(shopsData.some(s=>Math.hypot(x-s.x,z-s.z)<5))return true;     // sát cửa hàng / chợ / tiệm
 return false;
}
function buildUmbrella(){
 umbMesh=new THREE.Group();
 const c=new THREE.Mesh(new THREE.ConeGeometry(.8,.4,14),M(0xf472b6));c.position.y=2.45;
 const s=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.1,6),M(0x78350f));s.position.y=1.95;
 umbMesh.add(c,s);umbMesh.visible=false;player.add(umbMesh);
}
function startSick(ms,silent){
 sickUntil=performance.now()+ms;exposure=0;targetPosition=null;
 if(fishing)standFish();
 if(!sickLabel)sickLabel=addLabel('🤢💊 Cậu bị ốm','name-tag chat-bubble',()=>player.position.clone().setY(player.position.y+3.1),999);
 if(!silent){showToast(`🤒 Cậu bị ốm vì dầm mưa! Đứng yên ${Math.round(ms/1000)} giây (hoặc uống thuốc cảm)`);sfx('lose')}
}
function endSick(){
 sickUntil=0;if(sickLabel){removeLabel(sickLabel);sickLabel=null}
 showToast('💪 Cậu khỏe lại rồi! Nhớ tránh mưa nha ☔');sfx('win');
}
async function becomeSick(){
 if(sickBusy)return;sickBusy=true;
 let ms=CFG.SICK_SECS*1000;
 if(srvOK&&natOK){
  const {data,error}=await rpc('nature_get_sick');
  if(!error&&data){
   if(data.protected){umbUntil=performance.now()+(data.umbrella_ms||0);exposure=0;sickBusy=false;return}
   ms=data.sick_ms||ms;
  }
 }
 startSick(ms);sickBusy=false;
}
function weatherFrame(dt,rt){
 const sheltd=sheltered();
 umbMesh.visible=umbActive()&&rt>.02;
 if(sickActive()){exposure=0;return}
 if(sickLabel)endSick();
 if(rt>.3&&!sheltd&&!umbActive()){
  exposure+=dt;
  if(warned<1&&exposure>60){warned=1;showToast('🌧️ Cậu bắt đầu thấy lạnh... tìm chòi trú mưa hoặc mua ô ☂️')}
  if(warned<2&&exposure>120){warned=2;showToast('⚠️ Sắp ốm rồi! Chạy vào chòi ☂️ / sát cửa hàng ngay!')}
  if(exposure>=CFG.SICK_AFTER)becomeSick();
 }else{exposure=Math.max(0,exposure-dt*2);if(exposure<1)warned=0}
}

/* ---- tiệm ô dù ---- */
function openUmbShop(){updateShopInfo();sh('nat-shop',true)}
function updateShopInfo(){$('nat-shop-info').textContent=`Cậu có 🪙 ${coins}`+(umbActive()?` · ☂️ còn ${fmt((umbUntil-performance.now())/1000)}`:'')+(sickActive()?' · 🤒 đang ốm':'')}
async function buyUmb(){
 if(!srvOK||!natOK){showToast('Chưa kết nối được dữ liệu 🥲 (chạy supabase_nature.sql)');return}
 if(coins<CFG.UMB_PRICE){showToast(`Thiếu ${CFG.UMB_PRICE-coins} 🪙!`);return}
 const {data,error}=await rpc('nature_buy_umbrella');
 if(error){showToast(/NOT_ENOUGH/.test(errMsg(error))?'Không đủ xu 🪙':'Không mua được: '+errMsg(error));return}
 coins=data.coins;umbUntil=performance.now()+data.umbrella_ms;updateCoinHud();updateShopInfo();sfx('buy');showToast(`☂️ Đã mua ô! Kháng mưa ${CFG.UMB_MIN} phút`);
}
async function buyMed(){
 if(!sickActive()){showToast('Cậu đang khỏe mà, chưa cần thuốc 😄');return}
 if(!srvOK||!natOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 if(coins<CFG.MED_PRICE){showToast(`Thiếu ${CFG.MED_PRICE-coins} 🪙!`);return}
 const {data,error}=await rpc('nature_buy_medicine');
 if(error){const m=errMsg(error);showToast(/NOT_ENOUGH/.test(m)?'Không đủ xu 🪙':/NOT_SICK/.test(m)?'Cậu không bị ốm':'Không mua được: '+m);return}
 coins=data.coins;updateCoinHud();sfx('buy');sickUntil=performance.now()-1;updateShopInfo();
}

/* ===================================================================
   CÂU CÁ (server quyết định thời điểm cắn + loại cá + tiền)
=================================================================== */
const seatOwners={};
let fishing=null;   // {i,state:'idle'|'wait'|'bite'|'reeling',biteAt,win,winEnd,busy,cam}
const seatBusy=i=>{const o=seatOwners[i];return !!o&&Date.now()-o.t<12000};
function nearSeatIdx(){
 let b=-1,bd=2.8;
 SEATS.forEach((s,i)=>{const d=Math.hypot(player.position.x-s.x,player.position.z-s.z);if(d<bd&&player.position.y<2){bd=d;b=i}});
 return b;
}
function sitFish(i){
 if(fishing||sickActive()||flight||inDiscoRoom()||i<0)return;
 if(seatBusy(i)){showToast('Ghế này có người ngồi rồi 🪑');return}
 if(isDancing){isDancing=false;stopDanceMusic()}
 const s=SEATS[i];
 fishing={i,state:'idle',busy:false,cam:{a:cameraAngle,e:cameraElevation,d:cameraDistance}};
 targetPosition=null;player.position.set(s.x,.35,s.z);player.rotation.y=Math.PI/2;
 cameraAngle=-Math.PI/2;cameraElevation=.32;cameraDistance=8;
 nsend('seat',{i,id:myId,name:myName,on:1});sfx('click');
 showToast('🎣 Cậu đang ngồi câu cá (có mái che). Bấm Thả câu!');
}
function standFish(){
 const f=fishing;if(!f)return;
 if(f.state==='wait'||f.state==='bite')cancelCast();
 fishing=null;const s=SEATS[f.i];
 player.position.set(s.x-2.4,0,s.z);
 if(f.cam){cameraAngle=f.cam.a;cameraElevation=f.cam.e;cameraDistance=f.cam.d}
 nsend('seat',{i:f.i,id:myId,name:myName,on:0});
}
function cancelCast(){if(srvOK&&natOK)rpc('fish_cancel').then(()=>{},()=>{})}
async function castLine(){
 const f=fishing;if(!f||f.state!=='idle'||f.busy)return;
 if(!srvOK||!natOK){showToast('Chưa kết nối được dữ liệu 🥲 (chạy supabase_nature.sql)');return}
 f.busy=true;const t0=performance.now();
 const {data,error}=await rpc('fish_cast');
 f.busy=false;
 if(fishing!==f){if(!error)cancelCast();return}
 if(error){showToast(/SICK/.test(errMsg(error))?'Cậu đang ốm, chưa câu được 🤒':'Không thả câu được: '+errMsg(error));return}
 f.state='wait';f.win=data.window_ms||2500;f.biteAt=performance.now()+data.delay_ms-(performance.now()-t0)/2;
 sfx('throw');showToast('🎣 Đã thả câu... chờ cá cắn nha (nhìn cái phao)');
}
async function reelLine(){
 const f=fishing;if(!f||f.busy)return;
 if(f.state==='idle'){castLine();return}
 if(f.state==='wait'){f.state='idle';cancelCast();showToast('Kéo sớm quá, cá sợ chạy mất 🐟💨');return}
 if(f.state!=='bite')return;
 f.busy=true;f.state='reeling';
 const {data,error}=await rpc('fish_reel');
 f.busy=false;if(fishing===f)f.state='idle';
 if(error){showToast('Không kéo được: '+errMsg(error));return}
 if(!data.ok){showToast(data.reason==='EARLY'?'Kéo sớm quá, cá chạy mất 🐟💨':'Chậm mất rồi, cá chạy mất 🥲');return}
 coins=data.coins;updateCoinHud();
 const ico=data.kind==='legend'?'🐉':data.kind==='rare'?'🐠':'🐟',tag=data.kind==='legend'?'HUYỀN THOẠI! ':data.kind==='rare'?'Cá hiếm! ':'';
 popPoints('+'+data.reward+' 🪙 '+ico);sfx(data.kind==='common'?'lap':'win');
 showToast(`${ico} ${tag}Câu được ${data.name}! +${data.reward} 🪙`);
}
function fishFrame(){
 const t=performance.now();
 rods.forEach((r,i)=>{
  const mine=fishing&&fishing.i===i,vis=mine||seatBusy(i);
  r.g.visible=vis;if(!vis)return;
  let y=.1+Math.sin(T*2+i)*.035;
  if(mine&&fishing.state==='bite')y=-.05+Math.sin(T*30)*.06;
  r.bob.position.set(r.bx,y,r.z);r.lg.attributes.position.setXYZ(1,r.bx,y,r.z);r.lg.attributes.position.needsUpdate=true;
 });
 if(!fishing)return;
 const f=fishing,s=SEATS[f.i];
 player.position.set(s.x,.35,s.z);player.rotation.y=Math.PI/2;
 if(f.state==='wait'&&t>=f.biteAt){f.state='bite';f.winEnd=t+f.win;sfx('ping');if(navigator.vibrate)try{navigator.vibrate(150)}catch(e){}}
 else if(f.state==='bite'&&t>f.winEnd){f.state='idle';cancelCast();showToast('Cá cắn mà cậu kéo không kịp 😅')}
}
function fishUI(){
 const f=fishing;sh('fish-ui',!!f);if(!f)return;
 const ui=$('fish-ui'),bar=$('fish-bar'),act=$('fish-act'),title=$('fish-title');
 ui.classList.toggle('bite',f.state==='bite');
 if(f.state==='bite'){
  const left=clamp((f.winEnd-performance.now())/f.win,0,1);
  title.textContent='🐟 CÁ CẮN CÂU! KÉO CẦN NGAY!';bar.style.width=(left*100)+'%';bar.style.background='linear-gradient(90deg,#ef4444,#f97316)';act.textContent='🐟 KÉO CẦN!';
 }else{
  bar.style.background='';bar.style.width='0%';
  title.textContent=f.state==='wait'?'⏳ Đang chờ cá cắn (10–30 giây)... đừng kéo sớm!':f.state==='reeling'?'Đang kéo...':'Bấm Thả câu để bắt đầu';
  act.textContent=f.state==='wait'?'⬆️ Kéo (sớm sẽ hụt)':f.state==='idle'?'🎣 Thả câu':'...';
 }
}

/* ===================================================================
   CHANNEL REALTIME RIÊNG (đồng bộ ghế câu + trạng thái ốm)
=================================================================== */
let nch=null,nchReady=false,hbT=0;
function setupNatureChannel(){
 if(!supabaseClient)return;
 nch=supabaseClient.channel('wakeone-nature',{config:{broadcast:{self:false}}});
 nch.on('broadcast',{event:'seat'},({payload:p})=>{
  if(!p||p.id===myId)return;
  if(p.on)seatOwners[p.i]={id:p.id,name:String(p.name||'').slice(0,20),t:Date.now()};
  else if(seatOwners[p.i]&&seatOwners[p.i].id===p.id)delete seatOwners[p.i];
 }).on('broadcast',{event:'st'},({payload:p})=>{
  if(!p||p.id===myId)return;sickOthers[p.id]=p.sick?Date.now()+7000:0;
 }).subscribe(s=>{nchReady=(s==='SUBSCRIBED')});
}
function nsend(event,payload){if(nch&&nchReady)try{nch.send({type:'broadcast',event,payload})}catch(e){}}
function heartbeat(dt){
 hbT-=dt;if(hbT>0)return;hbT=4;
 if(fishing)nsend('seat',{i:fishing.i,id:myId,name:myName,on:1});
 if(sickActive())nsend('st',{id:myId,sick:1});
}
function sickOthersFrame(){
 const now=Date.now();
 for(const id in sickOthers){
  const on=sickOthers[id]>now&&otherPlayers[id];
  if(on&&!sickOtherLabels[id])sickOtherLabels[id]=addLabel('🤢💊 Ốm','name-tag chat-bubble',()=>{const m=otherPlayers[id];return m?m.position.clone().setY(m.position.y+3.1):new THREE.Vector3(0,-99,0)},70);
  else if(!on&&sickOtherLabels[id]){removeLabel(sickOtherLabels[id]);delete sickOtherLabels[id]}
 }
}

/* ===================================================================
   TRẠNG THÁI TỪ SERVER
=================================================================== */
let statusWarned=false;
async function loadStatus(){
 if(!supabaseClient||!srvOK){natOK=false;return}
 const t0=Date.now();
 const {data,error}=await rpc('nature_status');
 if(error||!data){
  natOK=false;
  if(!statusWarned){statusWarned=true;setTimeout(()=>showToast('⚠️ Chưa chạy supabase_nature.sql nên đom đóm / câu cá / ốm chưa được lưu'),2500)}
  return;
 }
 natOK=true;clockOff=data.server_ms-(t0+Date.now())/2;
 ffCount=data.night===nightId()?data.ff_count:0;
 if(data.sick_ms>0&&!sickActive())startSick(data.sick_ms,true);
 if(data.umbrella_ms>0)umbUntil=performance.now()+data.umbrella_ms;
}

/* ===================================================================
   TÊN BỊ TÒA NHÀ CHE → ẨN (thay cho updateUIElements gốc)
=================================================================== */
function buildOccluders(){
 shopsData.forEach(s=>addOcc(s.x,s.z,2.35,2.35,0,s.shape==='box'?3.4:4.2));
 addOcc(0,0,5.05,5.05,0,12.1);   // tòa WAKEONE
}
function occluded(cx,cy,cz,px,py,pz){
 const dx=px-cx,dy=py-cy,dz=pz-cz;
 for(let i=0;i<occ.length;i++){
  const o=occ[i];
  if(cx>o.x0&&cx<o.x1&&cy>o.y0&&cy<o.y1&&cz>o.z0&&cz<o.z1)continue;
  let t0=0,t1=.96,a,b,q;
  if(Math.abs(dx)<1e-6){if(cx<o.x0||cx>o.x1)continue}else{a=(o.x0-cx)/dx;b=(o.x1-cx)/dx;if(a>b){q=a;a=b;b=q}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)continue}
  if(Math.abs(dy)<1e-6){if(cy<o.y0||cy>o.y1)continue}else{a=(o.y0-cy)/dy;b=(o.y1-cy)/dy;if(a>b){q=a;a=b;b=q}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)continue}
  if(Math.abs(dz)<1e-6){if(cz<o.z0||cz>o.z1)continue}else{a=(o.z0-cz)/dz;b=(o.z1-cz)/dz;if(a>b){q=a;a=b;b=q}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)continue}
  return true;
 }
 return false;
}
function updateLabels(){
 if(!camera||!player)return;
 const w=container.clientWidth,h=container.clientHeight,cp=camera.position,skip=inDiscoRoom()||!built;
 labels.forEach(l=>{
  const p=l.get(),v=p.clone().project(camera),d=cp.distanceTo(p);
  let show=v.z<1&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2&&d<l.maxD+cameraDistance;
  if(show&&!skip&&occluded(cp.x,cp.y,cp.z,p.x,p.y,p.z))show=false;
  l.el.style.display=show?'block':'none';
  if(show){l.el.style.left=((v.x*.5+.5)*w)+'px';l.el.style.top=((-v.y*.5+.5)*h)+'px'}
 });
}
updateUIElements=updateLabels;

/* ===================================================================
   HUD + NÚT
=================================================================== */
let hudT=0,lastHud='',lastNight=null,lastRain=false;
function hudFrame(dt,ph,rt){
 hudT-=dt;if(hudT>0)return;hudT=.25;
 const disco=inDiscoRoom();sh('nat-hud',!disco);
 const night=ph>=1800,left=night?3600-ph:1800-ph,lines=[];
 lines.push(`${night?'🌙 Đêm':'🌞 Ngày'} · còn ${fmt(left)}`);
 if(rt>.05)lines.push('🌧️ Đang mưa');
 if(umbActive())lines.push(`☂️ ô còn ${fmt((umbUntil-performance.now())/1000)}`);
 if(rt>.3&&exposure>5&&!sickActive())lines.push(`<span style="color:#dc2626">⚠️ ướt ${fmt(exposure)}/${fmt(CFG.SICK_AFTER)}</span>`);
 if(sickActive())lines.push(`<span style="color:#16a34a">🤒 ốm · ${fmt((sickUntil-performance.now())/1000)}</span>`);
 if(night){
  const nf=nearestFF();
  lines.push(`✨ ${ffCount}/${CFG.FF_MAX}`+(nf&&ffCount<CFG.FF_MAX?` · cách ${Math.round(nf.d)}m`:''));
 }
 const html=lines.join('<br>');if(html!==lastHud){lastHud=html;$('nat-hud').innerHTML=html}
 /* nút */
 const si=nearSeatIdx(),nf=nearestFF();
 sh('nat-sit',!disco&&!fishing&&!sickActive()&&si>=0&&!flight);
 if(si>=0)$('nat-sit').textContent=seatBusy(si)?'🎣 Ghế có người':'🎣 Ngồi câu cá';
 sh('nat-catch',!fishing&&!!nf&&nf.d<=CFG.FF_RANGE&&ffCount<CFG.FF_MAX);
 sh('nat-med',sickActive());$('nat-med').textContent='💊 Uống thuốc (🪙'+CFG.MED_PRICE+')';
 sh('nat-sick',sickActive());
 if(!$('nat-shop').classList.contains('hidden'))updateShopInfo();
}

/* ===================================================================
   VÒNG LẶP CHÍNH (gắn vào updateSeesaws, được animate() gọi mỗi frame)
=================================================================== */
let errOnce=false;
function natureFrame(dt){
 if(!built||!player||!scene)return;
 T+=dt;
 const ph=phase(),d=dayness(ph),rt=rainAt();
 rainK+=(rt-rainK)*Math.min(1,dt*.6);if(Math.abs(rt-rainK)<.002)rainK=rt;
 applyEnv(d,rainK,ph);skyFrame(dt,d,rainK);
 rainSound(rainK,sheltered());
 /* thông báo chuyển ngày/đêm/mưa */
 const night=ph>=1800;
 if(lastNight!==null&&lastNight!==night)showToast(night?'🌙 Màn đêm buông xuống... đom đóm sắp xuất hiện thi thoảng đó ✨':'🌅 Trời sáng rồi! Chim bay lượn khắp nơi 🐦');
 lastNight=night;
 const rn=rt>.3;if(lastRain!==rn&&dbg.rain===null||(lastRain!==rn))showToast(rn?'🌧️ Trời mưa rồi! Tìm chòi ☂️ trú, đứng ngoài quá 3 phút sẽ bị ốm!':'🌤️ Mưa tạnh rồi');
 lastRain=rn;
 fireflyFrame(dt,d,ph);fishFrame();fishUI();weatherFrame(dt,rt);heartbeat(dt);sickOthersFrame();hudFrame(dt,ph,rt);
}
const _us=updateSeesaws;
updateSeesaws=function(dt){
 _us.apply(this,arguments);
 try{natureFrame(dt)}catch(e){if(!errOnce){errOnce=true;console.error('nature.js',e)}}
};

/* ===================================================================
   BỌC CÁC HÀM CŨ
=================================================================== */
const _mp=movePlayer;
movePlayer=function(dt){
 if(sickActive()&&!flight){
  targetPosition=null;
  if(CFG.SICK_SPEED<=0)return;
  return _mp.call(this,dt*CFG.SICK_SPEED);
 }
 if(fishing){
  const f=(moveKeys.w-moveKeys.s)+joy.f,r=(moveKeys.d-moveKeys.a)+joy.r;
  if(f||r)standFish();else{targetPosition=null;return}
 }
 return _mp.apply(this,arguments);
};
const _td=triggerDance;
triggerDance=function(){
 if(fishing||sickActive()){showToast('Giờ chưa nhảy được nha 🎣🤒');return}
 return _td.apply(this,arguments);
};
const _os=openShop;
openShop=function(id){
 const s=shopsData.find(x=>x.id===id);
 if(s&&s.type==='umbrella'){openUmbShop();return}
 return _os.apply(this,arguments);
};
const _ii=init3DMap;
init3DMap=function(){
 _ii.apply(this,arguments);
 try{buildNature()}catch(e){console.error('nature.js build',e)}
};

function buildNature(){
 if(built)return;
 worldBg=scene.background;worldFog=scene.fog;
 hemi=scene.children.find(o=>o.isHemisphereLight);sunL=scene.children.find(o=>o.isDirectionalLight);
 if(!hemi||!sunL){hemi=new THREE.HemisphereLight(0xffffff,0x94a3b8,1.15);sunL=new THREE.DirectionalLight(0xfffbeb,.9);scene.add(hemi,sunL)}
 buildSky();buildBirds();buildRainFx();buildShelters();buildFishing();buildFireflySpots();buildOccluders();buildUmbrella();
 setupNatureChannel();
 const el=renderer.domElement;let pd=null;
 el.addEventListener('pointerdown',e=>{pd={x:e.clientX,y:e.clientY,t:Date.now()}},true);
 el.addEventListener('pointerup',e=>{
  if(!pd)return;const m=Math.hypot(e.clientX-pd.x,e.clientY-pd.y),dt=Date.now()-pd.t;pd=null;
  if(m<8&&dt<350&&ffs.length&&tapFirefly(e.clientX,e.clientY))setTimeout(()=>{targetPosition=null},0);
 },true);
 built=true;
 loadStatus();
 setTimeout(()=>showToast('🌞🌙 Ngày/đêm đổi mỗi 30 phút · ban đêm có đom đóm · bờ sông Hàn có ghế câu cá 🎣'),14000);
}

/* ===================================================================
   NÚT / PHÍM
=================================================================== */
$('nat-sit').onclick=()=>sitFish(nearSeatIdx());
$('nat-catch').onclick=()=>{const n=nearestFF();if(n)catchFirefly(n.f)};
$('nat-med').onclick=buyMed;
$('fish-act').onclick=reelLine;$('fish-stand').onclick=standFish;
$('nat-shop-x').onclick=()=>sh('nat-shop',false);
$('nat-shop').addEventListener('click',e=>{if(e.target===$('nat-shop'))sh('nat-shop',false)});
$('nat-buy-umb').onclick=buyUmb;$('nat-buy-med').onclick=buyMed;
window.addEventListener('keydown',e=>{
 if(typeof e.key!=='string')return;
 if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
 const k=e.key.toLowerCase();
 if(k==='escape')sh('nat-shop',false);
 if(!built)return;
 if(fishing&&(k==='e'||k===' ')){e.preventDefault();reelLine();return}
 if(k==='e'&&!fishing&&!modalOpen()){const i=nearSeatIdx();if(i>=0&&!sickActive())sitFish(i)}
});

/* ---- debug ---- */
window.natureDebug={
 phase:s=>{dbgOff=0;dbgOff=s*1000-(nowMs()%3600000)},
 night:()=>window.natureDebug.phase(1850),day:()=>window.natureDebug.phase(60),
 rain:v=>{dbg.rain=v},sick:()=>startSick(CFG.SICK_SECS*1000),
 state:()=>({phase:phase(),dayness:dayness(phase()),rain:rainAt(),exposure,ffCount,natOK})
};
})();
