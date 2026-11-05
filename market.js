/* ===================================================================
   market.js — SÀN WAKEONE: tòa nhà lớn để giao dịch cổ phần Grid & Start-up
   Cách dùng: thêm <script src="market.js?v=3"></script> SAU features.js
   Cần chạy supabase_market.sql, rồi supabase_market_update.sql, rồi supabase_market_fix.sql (bản v3).
   Không sửa file cũ nào. Đổi vị trí tòa nhà ở EX bên dưới.

   Logic vận hành (server quyết định, client chỉ hiển thị):
   - Tổng điểm phiên (Wakeone + CJ) < 50  → giữ nguyên giá
   - 50–199 → +1 nhịp · đúng 200 → +2 nhịp · trên 200 → +1 nhịp mỗi 20 điểm (tối đa 10)
   - Giá chỉ tăng, không có cơ chế giảm
   - Grid : Start-up luôn = 6 : 1 (Start-up +1/nhịp, Grid +6/nhịp)
   - Hệ số khởi điểm: Start-up 10, Grid 60
   - Reset Game và lúc không có ai chơi đều giữ nguyên giá
=================================================================== */
(function(){
const EX={x:-96,z:0,kx:-84,kz:0};   // x,z: tâm tòa nhà · kx,kz: cổng giao dịch (chạm vào để vào sàn)
const FREEZE_MS=60000;                     // 60 giây cuối phiên khóa giao dịch
const RATIO=6;                             // Grid : Start-up
const NAMES={grid:'GRID',c131:'START-UP'}; // tên hiển thị (key server vẫn là grid / c131)
let ST=null,STt=0,lastSlot=null,exOpen=false,busy=false,tick=0,fetching=false,warned=false,ratioWarned=false;
let boardTex=null,boardCtx=null,boardT=0,lastFrozen=null,lastNear=null;

const fmt=n=>Number(n||0).toLocaleString('vi-VN');
// Số nhịp dự kiến — phải khớp với market_settle() trên server
const nhipOf=t=>t<50?0:t<200?1:Math.min(10,2+Math.trunc((t-200)/20));
const msLeft=()=>ST?Math.max(0,ST.ms_left-(performance.now()-STt)):0;
const frozen=()=>!!ST&&msLeft()<FREEZE_MS;
const nearEx=()=>!!player&&Math.hypot(player.position.x-EX.kx,player.position.z-EX.kz)<12;
const clock=ms=>{const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const show=(id,v)=>{const e=$(id);if(e)e.classList.toggle('hidden',!v)};

shopsData.push({id:41,name:'Sàn WAKEONE',icon:'📈',x:EX.kx,z:EX.kz,type:'exchange',color:0xfde68a,shape:'dome'});

/* ---------- UI ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div id="ex-modal" class="modal-backdrop hidden">
 <div class="modal glass relative">
  <button id="ex-close" class="absolute top-3 right-3 btn btn-soft !py-1 !px-2 text-xs">✕</button>
  <p class="pill inline-block">SÀN GIAO DỊCH · WAKEONE EXCHANGE</p>
  <h2 class="text-xl font-extrabold text-pink-700 mt-2">Sàn cổ phần 📈</h2>
  <div id="ex-sum" class="mt-2"></div>
  <p id="ex-msg" class="text-[11px] font-extrabold text-rose-600 mt-2"></p>
  <div id="ex-cards" class="space-y-3 mt-3"></div>
  <div id="ex-hist" class="mt-3"></div>
  <details class="mt-3 text-[11px] text-pink-600">
   <summary class="font-extrabold cursor-pointer">📜 Luật chơi</summary>
   <div class="mt-1 space-y-1">
    <p>• Khởi điểm: Start-up 60 🪙 : 10 điểm (hệ số 10), Grid 360 🪙 : 60 điểm (hệ số 60). Grid : Start-up luôn giữ tỉ lệ 6 : 1.</p>
    <p>• Mua 1 hệ số giá = 6 🪙 + 1 điểm. Bán nhận lại theo giá hiện tại.</p>
    <p>• Mỗi 30 phút chốt phiên theo tổng điểm Wakeone (ném đồ lên tường) + CJ (ném đồ ở tòa CJ).</p>
    <p>• Dưới 50 điểm: giữ nguyên giá. Từ 50: +1 nhịp · đúng 200: +2 nhịp · trên 200: thêm 1 nhịp mỗi 20 điểm (tối đa 10 nhịp).</p>
    <p>• Mỗi nhịp: Start-up +1 hệ số, Grid +6 hệ số. Giá chỉ tăng, không giảm.</p>
    <p>• Reset game hoặc lúc không có ai chơi, giá vẫn được giữ nguyên.</p>
    <p>• Tối đa 10 cổ phần mỗi công ty. 60 giây cuối phiên sàn khóa.</p>
   </div>
  </details>
 </div>
</div>`);
const side=$('fx-side');
if(side){const b=document.createElement('button');b.id='ex-btn';b.className='btn btn-round';b.textContent='📈';b.title='Bảng giá cổ phần';b.onclick=openEx;side.appendChild(b)}

function openEx(){exOpen=true;show('ex-modal',true);renderEx();refresh()}
function closeEx(){exOpen=false;show('ex-modal',false)}
$('ex-close').onclick=closeEx;
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeEx()});

const bar=(label,v,max)=>{const p=Math.max(0,Math.min(100,v/max*100));return `<div class="mt-1"><div class="flex justify-between text-[10px] font-extrabold text-pink-700"><span>${label}</span><span>${v}/${max}</span></div><div class="progress"><i style="width:${p}%"></i></div></div>`};
const arrow=d=>d>0?`<span class="text-emerald-600">▲ +${d}</span>`:'<span class="text-slate-400">–</span>';

function card(key,name,emoji){
 const c=ST[key],mine=(ST.mine&&ST.mine[key])||{qty:0,coins:0,pts:0};
 const buyP=c.price+(mine.qty>0?0:1),val=mine.qty*c.price;
 const plC=val*6-mine.coins,plP=val-mine.pts;
 const can=nearEx()&&!frozen()&&!busy;
 const dis=can?'':'disabled';
 const pl=mine.qty?`<p class="text-[11px] font-extrabold mt-1 ${plC>=0?'text-emerald-600':'text-rose-600'}">Lãi/lỗ: ${plC>=0?'+':''}${fmt(plC)} 🪙 · ${plP>=0?'+':''}${fmt(plP)} điểm</p>`:'';
 return `<div class="inventory-row" style="cursor:default;flex-direction:column;align-items:stretch">
  <div class="flex items-center gap-2"><span class="text-3xl">${emoji}</span>
   <span class="flex-1"><span class="block text-sm font-extrabold text-pink-700">${name} · ${arrow(c.delta)}</span>
   <span class="text-[10px] text-pink-500">👥 ${c.holders} người nắm · hệ số giá ${c.price}</span></span>
   <span class="text-right"><span class="block text-xs font-extrabold text-rose-600">Mua: ${fmt(buyP*6)} 🪙 + ${buyP} điểm</span>
   <span class="block text-[10px] font-bold text-pink-600">Bán: ${fmt(c.price*6)} 🪙 + ${c.price} điểm</span></span></div>
  <div class="flex items-center justify-between gap-2 mt-2"><span class="pill">Đang nắm ×${mine.qty}</span>
   <span class="flex gap-1"><button class="btn btn-pink !py-1 !px-2 text-xs" data-t="buy" data-c="${key}" data-q="1" ${dis}>Mua 1</button>
   <button class="btn btn-pink !py-1 !px-2 text-xs" data-t="buy" data-c="${key}" data-q="5" ${dis}>Mua 5</button>
   <button class="btn btn-dark !py-1 !px-2 text-xs" data-t="sell" data-c="${key}" data-q="1" ${mine.qty&&can?'':'disabled'}>Bán 1</button>
   <button class="btn btn-soft !py-1 !px-2 text-xs" data-t="sell" data-c="${key}" data-q="all" ${mine.qty&&can?'':'disabled'}>Bán hết</button></span></div>${pl}</div>`;
}
function renderEx(){
 if(!ST){$('ex-sum').innerHTML='<p class="text-xs text-pink-500">Đang tải dữ liệu sàn...</p>';$('ex-cards').innerHTML='';$('ex-hist').innerHTML='';return}
 const tot=ST.wake+ST.cj,nh=nhipOf(tot);
 const plan=nh>0?'📈 +'+nh+' nhịp':'➖ giữ nguyên giá (cần ≥ 50 điểm để tăng)';
 $('ex-sum').innerHTML=`<div class="flex justify-between text-[11px] font-extrabold text-pink-700"><span>⏳ Hết phiên sau <b id="ex-clock">${clock(msLeft())}</b></span><span>🪙 ${fmt(ST.me.coins)} · 🏆 ${fmt(ST.me.score)}</span></div>
  ${bar('🏢 Wakeone',ST.wake,100)}${bar('🏬 CJ',ST.cj,100)}
  <p class="text-[11px] font-extrabold mt-1 text-pink-700">Tổng ${tot}/200 → dự kiến ${plan}</p>`;
 $('ex-msg').textContent=!nearEx()?'📍 Đứng gần cổng Sàn WAKEONE mới mua/bán được (đang chỉ xem).':frozen()?'🔒 60 giây cuối phiên: sàn tạm khóa, chờ phiên mới.':'';
 $('ex-cards').innerHTML=card('grid',NAMES.grid,'🟦')+card('c131',NAMES.c131,'🟩');
 const h=ST.history||[];
 $('ex-hist').innerHTML=h.length?'<div class="text-[11px] font-extrabold text-pink-700 mb-1">🕒 Các phiên gần đây</div>'+h.map(r=>`<div class="flex justify-between text-[10px] font-bold text-slate-600 border-b border-pink-100 py-0.5"><span>${new Date(r.slot*1800000).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span><span>${r.total} điểm</span><span>${r.nhip>0?'+'+r.nhip+' nhịp':'giữ giá'}</span><span>Grid m${r.grid_m} · ${NAMES.c131} m${r.c131_m}</span></div>`).join(''):'';
}
$('ex-cards').onclick=e=>{const b=e.target.closest('button[data-t]');if(b&&!b.disabled)trade(b.dataset.t,b.dataset.c,b.dataset.q)};

/* ---------- Gọi server ---------- */
async function refresh(){
 if(fetching||!supabaseClient||!me)return;fetching=true;
 try{
  const {data,error}=await supabaseClient.rpc('market_state');
  if(error||!data){if(!warned){warned=true;showToast('Chưa chạy supabase_market.sql nên sàn chưa hoạt động 🥲')}return}

  const prev=lastSlot;ST=data;STt=performance.now();
  // Chỉ ghi log để dễ phát hiện khi server còn lệch tỉ lệ 6:1 (chưa chạy supabase_market_fix.sql)
  if(!ratioWarned&&data.grid&&data.c131&&data.grid.price!==data.c131.price*RATIO){
   ratioWarned=true;
   console.warn('[Market] Giá lệch tỉ lệ '+RATIO+':1 ->',data.grid.price,data.c131.price);
  }
  if(data.me){coins=data.me.coins;updateCoinHud()}
  if(prev!==null&&data.slot!==prev){
   const h=(data.history||[])[0];
   if(h&&+h.slot===prev){
    showToast(h.nhip>0
     ?`📊 Hết phiên! ${h.total} điểm → +${h.nhip} nhịp · Grid ${data.grid.price} · ${NAMES.c131} ${data.c131.price}`
     :`📊 Hết phiên! ${h.total} điểm (chưa đủ 50) → giá giữ nguyên`);
   }
  }
  lastSlot=data.slot;drawBoard();if(exOpen)renderEx();
 }finally{fetching=false}
}
function errText(m){
 return /FROZEN/.test(m)?'Sàn đang khóa 60 giây cuối phiên 🔒':/NOT_ENOUGH_COIN/.test(m)?'Không đủ xu 🪙':/NOT_ENOUGH_SCORE/.test(m)?'Không đủ điểm 🏆 (ném đồ lên WAKEONE/CJ để kiếm)':/MAX_SHARES/.test(m)?'Tối đa 10 cổ phần mỗi công ty':/NO_SHARES/.test(m)?'Cậu không có đủ cổ phần để bán':'Không giao dịch được: '+m;
}
async function trade(t,c,q){
 if(busy)return;
 if(!nearEx()){showToast('Cần đứng gần cổng Sàn WAKEONE 📍');return}
 if(!srvOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 const mine=(ST&&ST.mine&&ST.mine[c])||{qty:0};
 const qty=q==='all'?mine.qty:+q;if(!qty)return;
 busy=true;renderEx();
 // Gửi đúng số lượng người chơi bấm — giá do server tính
 const {data,error}=await supabaseClient.rpc(t==='buy'?'market_buy':'market_sell',{p_company:c,p_qty:qty});
 busy=false;
 if(error){showToast(errText(error.message||''));await refresh();renderEx();return}
 sfx(t==='buy'?'buy':'lap');
 showToast(`${t==='buy'?'Đã mua':'Đã bán'} ${qty} cổ phần ${NAMES[c]} (hệ số giá ${data.price})`);
 await refresh();renderEx();
}

/* ---------- Tòa nhà lớn + bảng điện tử ---------- */
function drawBoard(){
 if(!boardCtx)return;
 const c=boardCtx,W=1024,H=256,g=c.createLinearGradient(0,0,W,H);
 g.addColorStop(0,'#1e1b4b');g.addColorStop(1,'#701a75');c.fillStyle=g;c.fillRect(0,0,W,H);
 c.textAlign='center';c.fillStyle='#fde68a';c.font='bold 34px sans-serif';c.fillText('📈 SÀN WAKEONE',W/2,42);
 if(!ST){c.fillStyle='#fff';c.font='bold 30px sans-serif';c.fillText('Đang kết nối...',W/2,150)}
 else{
  [[NAMES.grid,ST.grid,260,'#a5b4fc'],[NAMES.c131,ST.c131,764,'#6ee7b7']].forEach(([n,d,x,col])=>{
   c.fillStyle=col;c.font='bold 40px sans-serif';c.fillText(n,x,100);
   c.fillStyle='#fff';c.font='bold 84px sans-serif';c.fillText(String(d.price),x,185);
   c.fillStyle=d.delta>0?'#4ade80':'#cbd5e1';c.font='bold 30px sans-serif';
   c.fillText(d.delta>0?'▲ +'+d.delta:'–',x,226);
  });
  c.fillStyle='#fbcfe8';c.font='bold 30px sans-serif';
  c.fillText('⏳ '+clock(msLeft()),W/2,130);
  c.font='bold 24px sans-serif';c.fillText(`${ST.wake+ST.cj}/200 điểm`,W/2,170);
 }
 boardTex.needsUpdate=true;
}
function buildExchange(){
 const g=new THREE.Group();g.position.set(EX.x,0,EX.z);
 addBox(g,12,9,26,0x7c3aed,0,4.5,0);
 addBox(g,14,.7,28,0xfde68a,0,9.3,0);
 addBox(g,2,.3,30,0x94a3b8,7.2,.15,0);
 for(let z=-11;z<=11;z+=4.4){const cl=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,8,12),M(0xfef3c7));cl.position.set(7,4,z);g.add(cl)}
 addBox(g,6,17,6,0x6366f1,-.5,8.5,-16.5);addBox(g,6,17,6,0x10b981,-.5,8.5,16.5);
 for(let z=-4;z<=4;z+=2)addBox(g,.12,2.2,1.2,0xfef08a,6.05,2.2,z*2.2,{emissive:0xfef08a,emissiveIntensity:.5});
 const cv=document.createElement('canvas');cv.width=1024;cv.height=256;boardCtx=cv.getContext('2d');
 boardTex=new THREE.CanvasTexture(cv);
 const board=new THREE.Mesh(new THREE.PlaneGeometry(22,5.5),new THREE.MeshBasicMaterial({map:boardTex}));
 board.rotation.y=Math.PI/2;board.position.set(6.15,6.3,0);g.add(board);
 scene.add(g);
 for(let z=-12;z<=12;z+=4)colliders.push({x:EX.x,z:EX.z+z,r:6.5});
 colliders.push({x:EX.x,z:EX.z-16.5,r:4},{x:EX.x,z:EX.z+16.5,r:4});
 addLabel('📈 SÀN WAKEONE','shop-sign big',()=>new THREE.Vector3(EX.x+7,11.5,EX.z),170);
 addLabel('🟦 '+NAMES.grid,'shop-sign',()=>new THREE.Vector3(EX.x,18.5,EX.z-16.5),120);
 addLabel('🟩 '+NAMES.c131,'shop-sign',()=>new THREE.Vector3(EX.x,18.5,EX.z+16.5),120);
 drawBoard();
}

/* ---------- Gắn vào game (nối chuỗi, không ghi đè logic cũ) ---------- */
const _init=init3DMap;
init3DMap=function(){
 _init();buildExchange();refresh();
 // Cập nhật gần real-time: mở sàn → 3 giây/lần, đóng sàn → 6 giây/lần (để bảng điện tử ngoài map vẫn tươi)
 setInterval(()=>{if(document.hidden)return;tick++;if(exOpen||tick%2===0)refresh()},3000);
 setTimeout(()=>showToast('📈 Sàn WAKEONE ở phía tây (-84, 0): mua/bán cổ phần Grid & Start-up!'),14000);
};
const _os=openShop;
openShop=function(id){
 const s=shopsData.find(x=>x.id===id);
 if(s&&s.type==='exchange'){openEx();return}
 _os(id);
};
const _cn=checkNearby;
checkNearby=function(){
 _cn();
 const pt=document.querySelector('#shop-prompt-modal p.text-xs');
 if(pt&&pendingShop&&pendingShop.type==='exchange')pt.textContent='Cổng Sàn WAKEONE: mua bán cổ phần Grid & Start-up. Vào sàn nhé?';
};
const _us=updateSeesaws;
updateSeesaws=function(dt){
 _us(dt);
 if(!scene||!player||!boardCtx)return;
 boardT-=dt;if(boardT>0)return;boardT=1;
 const ck=$('ex-clock');if(ck)ck.textContent=clock(msLeft());
 if(ST&&msLeft()<=0)refresh();
 if(exOpen){const f=frozen(),n=nearEx();if(f!==lastFrozen||n!==lastNear){lastFrozen=f;lastNear=n;renderEx()}}
 if(Math.hypot(player.position.x-EX.x,player.position.z-EX.z)<90)drawBoard();
};
window.WKMarket={state:()=>ST,refresh};
})();
