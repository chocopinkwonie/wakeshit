/* ===================================================================
   guide.js — Hướng dẫn chơi game (nút ❓ ở góc trái dưới, phím H)
   Cách dùng: thêm <script src="guide.js?v=1"></script> SAU features.js / market.js / cj.js
   Lần đầu vào game sẽ tự mở một lần. Không sửa file cũ nào.
=================================================================== */
(function(){
const SEEN='wk_guide_seen_v1';
const $g=id=>document.getElementById(id);
const sec=(title,body,open)=>`<details class="rounded-xl border border-pink-200 bg-white/70 px-3 py-2 mt-2"${open?' open':''}><summary class="text-xs font-extrabold text-pink-700 cursor-pointer">${title}</summary><div class="text-[11px] leading-relaxed text-slate-600 mt-1 space-y-1">${body}</div></details>`;

document.body.insertAdjacentHTML('beforeend',`
<div id="guide-modal" class="modal-backdrop hidden">
 <div class="modal glass relative">
  <button id="guide-close" class="absolute top-3 right-3 btn btn-soft !py-1 !px-2 text-xs">✕</button>
  <p class="pill inline-block">HƯỚNG DẪN</p>
  <h2 class="text-xl font-extrabold text-pink-700 mt-2">Cách chơi WAKEONE CITY ❓</h2>
  <p class="text-[11px] text-pink-500 mt-1">Bấm vào từng mục để xem. Mở lại bất cứ lúc nào bằng nút ❓ (hoặc phím H).</p>
  ${sec('🎮 Điều khiển',`
   <p><b>Máy tính:</b> WASD / mũi tên để đi · click xuống đất để đi tới · kéo chuột để xoay · lăn chuột để zoom · <b>E</b> tương tác · <b>Enter</b> chat · <b>H</b> hướng dẫn.</p>
   <p><b>Điện thoại:</b> cần joystick góc trái dưới · chạm đất để đi tới · kéo 1 ngón để xoay · chụm 2 ngón để zoom.</p>
   <p>Nút: 💃 nhảy · 🎵 bật/tắt nhạc · 🎶 chọn bài · 💬 chat (bong bóng 5 giây) · 🎤 mic (mọi người online nghe được) · 🎭 đổi nhân vật · 📈 bảng giá cổ phần.</p>`,true)}
  ${sec('🪙 Kiếm xu',`
   <p>🏁 Chạy vòng quanh khu phố, chạm lần lượt 8 mốc liền kề → xong 1 vòng nhận <b>+100 🪙</b>.</p>
   <p>🎁 Cứ 2 phút có 1 hộp quà rơi từ trời (+10 🪙, tồn tại 90 giây) — nhìn dòng chữ ở góc để biết tọa độ.</p>
   <p>🛥️ Ra bến thuyền sông Hàn, mời 1 bạn đứng gần đi cùng; cá nhảy lên thì bấm 🎣 (+2 🪙/con).</p>
   <p>🛒 Mua đồ DIOR rồi mang sang Chợ Hàn bán giá gấp đôi (mỗi 3 phút bán 1 lần).</p>
   <p>🦹 Đứng sát người chơi khác để cướp xu/đồ — nhưng họ cũng cướp được cậu.</p>`)}
  ${sec('🏆 Kiếm điểm',`
   <p>Đứng gần tòa WAKEONE ở giữa → 🎒 Kho → chạm món để ném lên tường: được điểm và lên bảng xếp hạng.</p>
   <p>⛳ Có gậy golf (cửa hàng thể thao, lần đầu miễn phí) thì chọn "Đập kính" ở cổng WAKEONE.</p>
   <p>🏬 Ném đồ lên tòa CJ: +5 điểm cho cậu và +5 điểm cho CJ.</p>
   <p>💩 Ném đủ 11 cục shit = 1 lượt đổi nhân vật. Đạt 100 / 200 điểm mở khóa nhân vật đặc biệt char_1 / char_2.</p>`)}
  ${sec('🛍️ Mua sắm & túi đồ',`
   <p>Đứng sát cửa hàng sẽ hỏi có vào không. Chạm món để thêm, nút − để bớt, rồi "Bỏ vào túi".</p>
   <p>Đồ ném được tiêu hao khi dùng. Bảo vệ đứng canh trước cửa hàng, không làm hại cậu.</p>`)}
  ${sec('⚠️ Nguy hiểm',`
   <p>🚗 Xe đâm: bị hất ra và có thể rơi mất đồ.</p>
   <p>😵 Va phải NPC đủ 3 lần: mất 10 🪙 hoặc 1 món đồ.</p>
   <p>🌊 Rơi sông Hàn: <b>−10 điểm</b>. Đi qua cầu ở giữa cho an toàn.</p>
   <p>🛡️ Người vừa bị cướp được bảo vệ một lúc.</p>`)}
  ${sec('🗺️ Địa điểm',`
   <p>🎠 Bập bênh: bước lên để bay thẳng lên nóc WAKEONE, chọn 1 người online để cướp xu (1 lần), rồi 🪂 nhảy xuống.</p>
   <p>🪩 Vũ trường (-52, -52): xem biểu diễn, bấm 🪑 để ngồi.</p>
   <p>🛒 Chợ Hàn: bên kia sông, phía đông.</p>
   <p>⚓ Bến thuyền: gần cầu sông Hàn, đi theo cặp.</p>
   <p>📈 Sàn WAKEONE (-84, 0) và 🏬 CJ (-84, -44): phía tây.</p>`)}
  ${sec('📈 Sàn cổ phần Grid & 131',`
   <p>Mua 1 hệ số giá = <b>6 🪙 + 1 điểm</b>. Giá = m + số người đang nắm cổ phần công ty đó.</p>
   <p>Mỗi 30 phút, hệ thống cộng điểm Wakeone + CJ của cả server. Chuẩn là 200: lệch 20 điểm = 1 nhịp (hơn thì tăng, thiếu thì giảm).</p>
   <p>Giá đổi = nhịp × số người nắm công ty đó → càng đông càng lãi to, mà lỗ cũng sâu.</p>
   <p>Phải đứng gần cổng sàn mới mua/bán được. 60 giây cuối mỗi phiên sàn bị khóa. Tối đa 10 cổ phần mỗi công ty.</p>`)}
  ${sec('💡 Mẹo',`
   <p>• Chạy vòng lấy vốn trước, rồi mới vào sàn.</p>
   <p>• Mua cổ phần tốn điểm, nhớ chừa điểm để mở khóa nhân vật.</p>
   <p>• Cả server cùng ném đồ ở Wakeone và CJ thì giá mới lên — rủ bạn bè đi cày.</p>`)}
 </div>
</div>`);

function open(){$g('guide-modal').classList.remove('hidden');try{localStorage.setItem(SEEN,'1')}catch(e){}}
function close(){$g('guide-modal').classList.add('hidden')}
function toggle(){$g('guide-modal').classList.contains('hidden')?open():close()}
$g('guide-close').onclick=close;
$g('guide-modal').addEventListener('pointerdown',e=>{if(e.target===$g('guide-modal'))close()});

/* Nút ❓ ở góc trái dưới (cùng cột với 💬 🎤) */
const btn=document.createElement('button');
btn.id='guide-btn';btn.className='btn btn-round';btn.textContent='❓';btn.title='Hướng dẫn chơi (H)';btn.onclick=toggle;
const side=$g('fx-side');
if(side)side.appendChild(btn);
else{btn.style.cssText='position:fixed;left:12px;bottom:max(160px,env(safe-area-inset-bottom));z-index:25';document.body.appendChild(btn)}

window.addEventListener('keydown',e=>{
 if(typeof e.key!=='string')return;
 if(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;
 const k=e.key.toLowerCase();
 if(k==='h')toggle();else if(k==='escape')close();
});

/* Lần đầu vào game: tự mở hướng dẫn 1 lần */
let seen=false;try{seen=!!localStorage.getItem(SEEN)}catch(e){}
if(!seen){
 const t=setInterval(()=>{
  if(typeof me!=='undefined'&&me){clearInterval(t);setTimeout(open,2500)}
 },500);
}
})();
