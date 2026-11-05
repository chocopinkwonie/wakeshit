/* ===================================================================
   cj.js — Tòa nhà CJ: ném đồ lên tường để tích điểm cho công ty CJ
   (mỗi lần ném +5 điểm CJ, 20 lần = 100 điểm chuẩn mỗi phiên 30 phút)
   Cách dùng: thêm <script src="cj.js?v=1"></script> SAU features.js (trước hay sau market.js đều được)
   Cần chạy supabase_market.sql. Không sửa file cũ nào.
=================================================================== */
(function(){
const CJ={x:-96,z:-44,kx:-84,kz:-44};   // tâm tòa nhà · cổng vào
const PTS=5;
let busy=false,open=false,signCtx=null,signTex=null,signT=0;
const flyers=[],geo=new THREE.PlaneGeometry(.9,.9);
const nearCj=()=>!!player&&Math.hypot(player.position.x-CJ.kx,player.position.z-CJ.kz)<12;
const mst=()=>window.WKMarket?WKMarket.state():null;

shopsData.push({id:42,name:'CJ',icon:'🏬',x:CJ.kx,z:CJ.kz,type:'cj',color:0xfecaca,shape:'box'});

document.body.insertAdjacentHTML('beforeend',`
<div id="cj-modal" class="modal-backdrop hidden">
 <div class="modal glass relative">
  <button id="cj-close" class="absolute top-3 right-3 btn btn-soft !py-1 !px-2 text-xs">✕</button>
  <p class="pill inline-block">CÔNG TY CJ · TÍCH ĐIỂM</p>
  <h2 class="text-xl font-extrabold text-pink-700 mt-2">Tòa nhà CJ 🏬</h2>
  <p class="text-xs text-pink-500 mt-1">Chạm vào món để ném lên tường CJ (+${PTS} điểm cho cậu và cho CJ). Điểm CJ + Wakeone quyết định giá cổ phần Grid & 131.</p>
  <div class="progress mt-3"><i id="cj-prog" style="width:0%"></i></div>
  <p id="cj-prog-text" class="text-[11px] font-bold text-pink-700 mt-1"></p>
  <div id="cj-list" class="space-y-2 mt-3"></div>
 </div>
</div>`);
$('cj-close').onclick=closeCj;
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeCj()});
function openCj(){open=true;$('cj-modal').classList.remove('hidden');renderCj();if(window.WKMarket)WKMarket.refresh().then(()=>{if(open)renderCj()})}
function closeCj(){open=false;$('cj-modal').classList.add('hidden')}

function renderCj(){
 const s=mst(),v=s?s.cj:0;
 $('cj-prog').style.width=Math.min(100,v)+'%';
 $('cj-prog-text').textContent=`CJ phiên này: ${v}/100 điểm · mỗi lần ném +${PTS}`;
 const l=$('cj-list');l.innerHTML='';
 const items=inventory.filter(i=>i.type==='throwable');
 items.forEach(it=>{
  const row=document.createElement('div');row.className='inventory-row';
  row.innerHTML=`<span class="text-2xl">${it.emoji}</span><span class="flex-1 text-xs font-extrabold text-pink-700">${it.name}</span><span class="pill">×${it.count}</span>`;
  row.onclick=()=>cjThrow(it);l.appendChild(row);
 });
 if(!items.length)l.innerHTML='<div class="text-center text-sm text-pink-500 py-6">Cậu chưa có đồ ném nào. Ghé các cửa hàng mua nhé 🛒</div>';
}
async function cjThrow(it){
 if(busy)return;
 if(!nearCj()){showToast('Cần đứng gần cổng CJ 📍');return}
 if(!srvOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 busy=true;
 const emo=it.emojiThrow||it.emoji;
 const {data,error}=await supabaseClient.rpc('cj_throw',{p_item:it.id,p_emoji:emo});
 busy=false;
 if(error){
  const m=error.message||'';
  showToast(/TOO_FAST/.test(m)?'Ném chậm lại xíu nha!':/NO_ITEM/.test(m)?'Cậu không còn món này nữa!':'Không ném được: '+m);
  await loadInventory();if(open)renderCj();return;
 }
 fxThrow(emo);sfx('throw');popPoints('+'+data.pts+' điểm 🏆');
 await loadInventory();loadLeaderboard();
 if(window.WKMarket)await WKMarket.refresh();
 if(open)renderCj();
}

/* ---------- Tòa nhà ---------- */
function drawSign(){
 if(!signCtx)return;
 const c=signCtx,s=mst(),v=s?s.cj:0;
 c.fillStyle='#b91c1c';c.fillRect(0,0,512,256);
 c.fillStyle='#fff';c.textAlign='center';c.font='bold 120px sans-serif';c.fillText('CJ',256,130);
 c.font='bold 30px sans-serif';c.fillStyle='#fecaca';c.fillText('Ném đồ lên tường · +'+PTS+' điểm',256,180);
 c.fillStyle='#fde68a';c.fillText('Phiên này: '+v+'/100',256,225);
 signTex.needsUpdate=true;
}
function buildCJ(){
 const g=new THREE.Group();g.position.set(CJ.x,0,CJ.z);
 addBox(g,10,9,12,0xf87171,0,4.5,0);addBox(g,11,.6,13,0x7f1d1d,0,9.3,0);addBox(g,4,3,.1,0xe5e7eb,5.05,1.5,0);
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;signCtx=cv.getContext('2d');signTex=new THREE.CanvasTexture(cv);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(8,4),new THREE.MeshBasicMaterial({map:signTex}));
 sign.rotation.y=Math.PI/2;sign.position.set(5.1,6.2,0);g.add(sign);
 scene.add(g);
 for(let z=-4;z<=4;z+=4)colliders.push({x:CJ.x,z:CJ.z+z,r:6});
 addLabel('🏬 CJ','shop-sign big',()=>new THREE.Vector3(CJ.x+5,10.8,CJ.z),150);
 drawSign();
}

/* ---------- Hiệu ứng ném: bay tới tường rồi dính 90 giây ---------- */
function fxThrow(emo){
 const m=new THREE.Mesh(geo,decalMaterial(emo));
 m.position.set(player.position.x,player.position.y+1.5,player.position.z);scene.add(m);
 flyers.push({m,t:0,from:m.position.clone(),to:new THREE.Vector3(CJ.x+5.2,1.2+Math.random()*5.5,CJ.z+(Math.random()-.5)*10),stuck:0});
}
function fxFrame(dt){
 for(let i=flyers.length-1;i>=0;i--){
  const f=flyers[i];
  if(f.t<1){
   f.t=Math.min(1,f.t+dt/.5);
   f.m.position.lerpVectors(f.from,f.to,f.t);f.m.position.y+=Math.sin(Math.PI*f.t)*2;
   f.m.rotation.z+=dt*12;
   if(f.t>=1){f.m.rotation.set(0,Math.PI/2,0);f.m.position.copy(f.to)}
  }else{f.stuck+=dt;if(f.stuck>90){scene.remove(f.m);flyers.splice(i,1)}}
 }
}

/* ---------- Gắn vào game ---------- */
const _init=init3DMap;
init3DMap=function(){
 _init();buildCJ();
 setTimeout(()=>showToast('🏬 Tòa CJ ở (-84, -44): ném đồ để tích điểm cho thị trường!'),18000);
};
const _os=openShop;
openShop=function(id){
 const s=shopsData.find(x=>x.id===id);
 if(s&&s.type==='cj'){openCj();return}
 _os(id);
};
const _cn=checkNearby;
checkNearby=function(){
 _cn();
 const pt=document.querySelector('#shop-prompt-modal p.text-xs');
 if(pt&&pendingShop&&pendingShop.type==='cj')pt.textContent='Tòa nhà CJ: ném đồ lên tường để tích điểm cho thị trường cổ phần. Vào nhé?';
};
const _us=updateSeesaws;
updateSeesaws=function(dt){
 _us(dt);
 if(!scene||!player||!signCtx)return;
 fxFrame(dt);
 signT-=dt;if(signT<=0){signT=2;if(Math.hypot(player.position.x-CJ.x,player.position.z-CJ.z)<80)drawSign()}
};
})();
