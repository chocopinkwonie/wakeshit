/* ===================================================================
   bank.js — NGÂN HÀNG MNET: gửi tiền không bị cướp, có lãi theo chu kỳ 30 phút
   Cách dùng: thêm <script src="bank.js?v=1"></script> SAU features.js / market.js (trước ui-fix.js)
   Cần chạy supabase_market.sql rồi supabase_bank.sql. Không sửa file cũ nào.
=================================================================== */
(function(){
const BK={x:-96,z:44,kx:-84,kz:44};   // x,z: tâm tòa nhà · kx,kz: cổng vào ngân hàng
let S=null,St=0,open=false,busy=false,fetching=false,warned=false,lastLogId=null,tick=0;
let signCtx=null,signTex=null,signT=0;

const fmt=(n,d=0)=>Number(n||0).toLocaleString('vi-VN',{maximumFractionDigits:d});
const rateOf = p =>
  p > 5000 ? 10 :
  p >= 2000 ? 7 :
  p >= 500 ? 5 : 0;
const msLeft=()=>S?Math.max(0,S.ms_left-(performance.now()-St)):0;
const clock=ms=>{const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const nearBk=()=>!!player&&Math.hypot(player.position.x-BK.kx,player.position.z-BK.kz)<12;

shopsData.push({id:43,name:'Ngân hàng Mnet',icon:'🏦',x:BK.kx,z:BK.kz,type:'bank',color:0xbfdbfe,shape:'dome'});

/* ---------- UI ---------- */
document.body.insertAdjacentHTML('beforeend',`
<div id="bk-modal" class="modal-backdrop hidden">
 <div class="modal glass relative">
  <button id="bk-close" class="absolute top-3 right-3 btn btn-soft !py-1 !px-2 text-xs">✕</button>
  <p class="pill inline-block">NGÂN HÀNG MNET</p>
  <h2 class="text-xl font-extrabold text-pink-700 mt-2">Ngân hàng Mnet 🏦</h2>
 <p class="text-xs text-pink-500 mt-1">
  🏦 Tiền gửi ngân hàng được bảo vệ, không bị cướp,
  không mất khi va chạm xe hoặc NPC.
  Chỉ thay đổi khi cậu gửi hoặc rút tiền.
  Lãi được tính mỗi chu kỳ 30 phút.
</p>
  <div id="bk-sum" class="mt-3"></div>
  <p id="bk-status" class="text-[11px] font-extrabold mt-2"></p>
  <div class="mt-3 rounded-2xl border border-pink-200 bg-white/70 p-3">
   <div class="flex gap-2">
    <input id="bk-amt" type="number" inputmode="numeric" min="1" step="1" placeholder="Số xu" class="flex-1 min-w-0 rounded-xl border-2 border-pink-200 bg-white px-3 py-2 font-bold text-pink-700 outline-none focus:border-pink-500" style="user-select:text">
   </div>
   <div class="flex flex-wrap gap-1 mt-2">
    <button class="btn btn-soft !py-1 !px-2 text-xs" data-chip="50">50</button>
    <button class="btn btn-soft !py-1 !px-2 text-xs" data-chip="100">100</button>
    <button class="btn btn-soft !py-1 !px-2 text-xs" data-chip="500">500</button>
    <button class="btn btn-soft !py-1 !px-2 text-xs" data-chip="1000">1000</button>
   </div>
   <div class="flex flex-wrap gap-2 mt-2">
    <button id="bk-dep" class="btn btn-pink text-xs flex-1">⬇️ Gửi</button>
    <button id="bk-depall" class="btn btn-pink text-xs flex-1">Gửi hết túi</button>
    <button id="bk-wd" class="btn btn-dark text-xs flex-1">⬆️ Rút</button>
   </div>
   <div class="flex flex-wrap gap-2 mt-2">
    <button id="bk-wdint" class="btn btn-soft text-xs flex-1">💰 Rút lãi</button>
    <button id="bk-wdall" class="btn btn-soft text-xs flex-1">Rút hết</button>
   </div>
  </div>
  <p id="bk-msg" class="text-[11px] font-extrabold text-rose-600 mt-2"></p>
  <div id="bk-hist" class="mt-3"></div>
  <details class="mt-3 text-[11px] text-pink-600">
   <summary class="font-extrabold cursor-pointer">📜 Luật ngân hàng</summary>
  <div class="mt-1 space-y-1">
 <p>• Dưới 500 xu: không có lãi.</p>
 <p>• Từ 500 đến dưới 2000 xu: lãi 5%/chu kỳ.</p>
 <p>• Từ 2000 đến 5000 xu: lãi 7%/chu kỳ.</p>
 <p>• Trên 5000 xu: lãi 10%/chu kỳ.</p>
 <p>• Lãi áp dụng cho toàn bộ tiền gốc.</p>
 <p>• Chu kỳ 30 phút, tiền mới gửi bắt đầu có lãi từ chu kỳ kế tiếp.</p>
 <p>• Lãi tính trên gốc, không lãi kép.</p>
 <p>• Thị trường giảm (tổng điểm Wakeone + CJ ≤ 180) thì không trả lãi.</p>
 <p>• Phải đứng gần cổng ngân hàng mới gửi/rút được.</p>
</div>
  </details>
 </div>
</div>`);
$('bk-close').onclick=closeBk;
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeBk()});
document.querySelectorAll('#bk-modal [data-chip]').forEach(b=>b.onclick=()=>{$('bk-amt').value=b.dataset.chip});
$('bk-amt').addEventListener('keydown',e=>e.stopPropagation());   // gõ số không kích hoạt phím tắt game

function openBk(){open=true;$('bk-modal').classList.remove('hidden');render();refresh()}
function closeBk(){open=false;$('bk-modal').classList.add('hidden')}

const card=(label,val,sub)=>`<div class="rounded-2xl border border-pink-200 bg-white/80 p-2 text-center"><div class="text-[10px] font-extrabold text-pink-500">${label}</div><div class="text-base font-extrabold text-pink-700">${val}</div>${sub?`<div class="text-[10px] text-slate-500">${sub}</div>`:''}</div>`;
function render(){
 if(!S){$('bk-sum').innerHTML='<p class="text-xs text-pink-500">Đang tải dữ liệu ngân hàng...</p>';$('bk-hist').innerHTML='';return}
 const tot = S.principal + S.pending;
const r = rateOf(tot);
const per = S.principal * r / 100;

let hint = '';

if (tot < 500) {
  hint = `Gửi thêm ${fmt(500 - tot)} xu để bắt đầu nhận lãi 5%`;
} else if (tot < 2000) {
  hint = `Gửi thêm ${fmt(2000 - tot)} xu để lên lãi 7%`;
} else if (tot <= 5000) {
  hint = `Gửi thêm ${fmt(5001 - tot)} xu để lên lãi 10%`;
} else {
  hint = 'Cậu đang ở mức lãi cao nhất 10% 🎉';
}
 $('bk-sum').innerHTML=`<div class="grid grid-cols-2 gap-2">
  ${card('🪙 Trong túi (có thể bị cướp)',fmt(S.coins))}
  ${card('🏦 Đang sinh lãi',fmt(S.principal),S.principal?`Lãi ${r}%/chu kỳ ≈ +${fmt(per,2)} 🪙`:'Chưa có')}
  ${card('⏳ Mới gửi',fmt(S.pending),'Sinh lãi từ chu kỳ kế tiếp')}
  ${card(
  '🏦 Tổng số dư ngân hàng',
  fmt(S.bank_total),
  'Tiền của tui'
)}
 </div>
 <p class="text-[11px] font-bold text-pink-700 mt-2">⏱ Chu kỳ kết thúc sau <b id="bk-clock">${clock(msLeft())}</b> · ${hint}</p>`;
 const down=S.mkt_nhip<0;
 const st=$('bk-status');
 st.textContent=down?`⚠️ Chu kỳ này thị trường đang giảm (${S.mkt_total}/200 điểm). Nếu hết chu kỳ vẫn từ 180 điểm trở xuống thì KHÔNG có lãi.`:`✅ Thị trường đang ổn (${S.mkt_total}/200 điểm): giữ tiền tới hết chu kỳ là có lãi.`;
 st.className='text-[11px] font-extrabold mt-2 '+(down?'text-rose-600':'text-emerald-600');
 $('bk-msg').textContent=nearBk()?'':'📍 Đứng gần cổng Ngân hàng Mnet mới gửi/rút được (đang chỉ xem).';
 const can=nearBk()&&!busy;
 ['bk-dep','bk-depall','bk-wd','bk-wdint','bk-wdall'].forEach(id=>$(id).disabled=!can);
 $('bk-hist').innerHTML=(S.history&&S.history.length)?'<div class="text-[11px] font-extrabold text-pink-700 mb-1">🕒 Các chu kỳ gần đây</div>'+S.history.map(h=>`<div class="flex justify-between gap-2 text-[10px] font-bold border-b border-pink-100 py-0.5 ${h.skipped?'text-rose-600':'text-emerald-600'}"><span>${new Date(h.slot*1800000).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span><span>${h.skipped?(h.skipped==='MARKET_DOWN'?'Thị trường giảm · không lãi':'Không có lãi'):'+'+fmt(h.paid,2)+' 🪙'}</span></div>`).join(''):'';
}

/* ---------- Server ---------- */
async function refresh(){
 if(fetching||!supabaseClient||!me)return;fetching=true;
 try{
  const {data,error}=await supabaseClient.rpc('bank_state');
  if(error||!data){if(!warned){warned=true;showToast('Chưa chạy supabase_bank.sql nên ngân hàng chưa hoạt động 🥲')}return}
  S=data;St=performance.now();coins=data.coins;updateCoinHud();
  const l=data.last;
  if(l){
   if(lastLogId!==null&&l.id!==lastLogId)showToast(l.skipped?'🏦 Chu kỳ vừa rồi thị trường giảm, ngân hàng không trả lãi 😢':`🏦 Ngân hàng Mnet trả lãi +${fmt(l.paid,2)} 🪙`);
   lastLogId=l.id;
  }else if(lastLogId===null)lastLogId=0;
  drawSign();if(open)render();
 }finally{fetching=false}
}
function err(m){
 return /NOT_ENOUGH_COIN/.test(m)?'Trong túi không đủ xu 🪙':/NOT_ENOUGH_BALANCE/.test(m)?'Trong ngân hàng không đủ tiền để rút':/NO_INTEREST/.test(m)?'Chưa có lãi để rút (cần tối thiểu 1 🪙)':/NO_ACCOUNT/.test(m)?'Cậu chưa có tiền gửi':/BAD_AMOUNT/.test(m)?'Số xu không hợp lệ':'Không thực hiện được: '+m;
}
async function act(kind){
 if(busy)return;
 if(!nearBk()){showToast('Cần đứng gần cổng Ngân hàng Mnet 📍');return}
 if(!srvOK){showToast('Chưa kết nối được dữ liệu 🥲');return}
 const amt=Math.floor(+$('bk-amt').value||0);
 let fn,args,ok;
 if(kind==='dep'){if(amt<1){showToast('Nhập số xu muốn gửi nha');return}fn='bank_deposit';args={p_amount:amt};ok=`Đã gửi ${fmt(amt)} 🪙 vào ngân hàng 🏦`}
 else if(kind==='depall'){if(!(coins>=1)){showToast('Trong túi chưa có xu để gửi');return}fn='bank_deposit';args={p_amount:Math.floor(coins)};ok=`Đã gửi ${fmt(Math.floor(coins))} 🪙 vào ngân hàng 🏦`}
 else if(kind==='wd'){if(amt<1){showToast('Nhập số xu muốn rút nha');return}fn='bank_withdraw';args={p_kind:'amount',p_amount:amt};ok=`Đã rút ${fmt(amt)} 🪙 về túi`}
 else if(kind==='wdint'){fn='bank_withdraw';args={p_kind:'interest',p_amount:0};ok='Đã rút lãi về túi 💰'}
 else{fn='bank_withdraw';args={p_kind:'all',p_amount:0};ok='Đã rút hết về túi'}
 busy=true;render();
 const {data,error}=await supabaseClient.rpc(fn,args);
 busy=false;
 if(error){showToast(err(error.message||''));await refresh();render();return}
 coins=data.coins;updateCoinHud();sfx(kind.startsWith('dep')?'buy':'lap');showToast(ok);
 $('bk-amt').value='';await refresh();render();
}
$('bk-dep').onclick=()=>act('dep');$('bk-depall').onclick=()=>act('depall');
$('bk-wd').onclick=()=>act('wd');$('bk-wdint').onclick=()=>act('wdint');$('bk-wdall').onclick=()=>act('wdall');

/* ---------- Tòa nhà ---------- */
function drawSign(){
 if(!signCtx)return;
 const c=signCtx;
 c.fillStyle='#1e3a8a';c.fillRect(0,0,512,256);
 c.textAlign='center';c.fillStyle='#fde68a';c.font='bold 64px sans-serif';c.fillText('🏦 MNET BANK',256,80);
 c.fillStyle='#fff';c.font='bold 28px sans-serif';c.fillText('Gửi tiền không lo bị cướp',256,130);
 c.fillStyle='#bfdbfe';c.font='bold 24px sans-serif';c.fillText('Lãi 5% · 7% · 10% / 30 phút',256,172);
 if(S){c.fillStyle=S.mkt_nhip<0?'#fca5a5':'#86efac';c.fillText(S.mkt_nhip<0?'⚠️ Thị trường giảm: chưa có lãi':'✅ Thị trường ổn: có lãi',256,218)}
 signTex.needsUpdate=true;
}
function buildBank(){
 const g=new THREE.Group();g.position.set(BK.x,0,BK.z);
 addBox(g,12,8,14,0x1e3a8a,0,4,0);addBox(g,13,.7,15,0xfde68a,0,8.3,0);addBox(g,1.5,.7,15,0xfde68a,6.8,.35,0);
 for(let z=-5.5;z<=5.5;z+=2.75){const cl=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,7,12),M(0xf8fafc));cl.position.set(6.6,3.7,z);g.add(cl)}
 addBox(g,.3,3.2,2.6,0x94a3b8,6.1,1.6,0);       // cửa kho
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;signCtx=cv.getContext('2d');signTex=new THREE.CanvasTexture(cv);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,4.5),new THREE.MeshBasicMaterial({map:signTex}));
 sign.rotation.y=Math.PI/2;sign.position.set(6.2,5.6,0);g.add(sign);
 scene.add(g);
 for(let z=-6;z<=6;z+=6)colliders.push({x:BK.x,z:BK.z+z,r:6.5});
 addLabel('🏦 NGÂN HÀNG MNET','shop-sign big',()=>new THREE.Vector3(BK.x+6,9.8,BK.z),150);
 drawSign();
}

/* ---------- Gắn vào game ---------- */
const _init=init3DMap;
init3DMap=function(){
 _init();buildBank();refresh();
 setInterval(()=>{if(document.hidden)return;tick++;if(open||tick%15===0)refresh()},4000);
 setTimeout(()=>showToast('🏦 Ngân hàng Mnet ở (-84, 44): gửi xu không bị cướp, có lãi mỗi 30 phút!'),22000);
};
const _os=openShop;
openShop=function(id){
 const s=shopsData.find(x=>x.id===id);
 if(s&&s.type==='bank'){openBk();return}
 _os(id);
};
const _cn=checkNearby;
checkNearby=function(){
 _cn();
 const pt=document.querySelector('#shop-prompt-modal p.text-xs');
 if(pt&&pendingShop&&pendingShop.type==='bank')pt.textContent='Ngân hàng Mnet: gửi xu không bị cướp, nhận lãi mỗi 30 phút. Vào nhé?';
};
const _us=updateSeesaws;
updateSeesaws=function(dt){
 _us(dt);
 if(!scene||!player||!signCtx)return;
 signT-=dt;if(signT>0)return;signT=1;
 const ck=$('bk-clock');if(ck)ck.textContent=clock(msLeft());
 if(S&&msLeft()<=0&&!fetching)refresh();
 if(open){const n=nearBk();if(n!==bk_lastNear){bk_lastNear=n;render()}}
};
let bk_lastNear=null;
})();
