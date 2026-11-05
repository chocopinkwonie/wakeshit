/* ===================================================================
   ui-fix.js — Sửa giao diện cho laptop / điện thoại: zoom vỡ, chữ & khung tràn
   Cách dùng: thêm <script src="ui-fix.js?v=1"></script> SAU các file khác (cuối cùng, trước </body>)
   Không sửa file cũ nào. Chỉ chèn CSS ghi đè + vài listener resize.
=================================================================== */
(function(){
const css=`
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
html,body{height:100%}
@supports(height:100dvh){html,body{height:100dvh}}
body{overscroll-behavior:none;-webkit-touch-callout:none}
input,textarea,select{font-size:16px!important}           /* chống iOS tự zoom khi bấm vào ô nhập */
:root{--hb:88px}                                           /* đáy thanh header, JS cập nhật */

/* --- Khung (modal): luôn nằm gọn trong màn hình --- */
.modal-backdrop{position:fixed!important;padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important}
.modal{width:min(560px,100%)!important;max-height:88vh!important;max-height:calc(100dvh - 20px)!important;padding:clamp(12px,3.6vw,20px)!important;overflow-x:hidden!important;overflow-y:auto!important;overflow-wrap:anywhere;word-break:break-word}
.modal h2{font-size:clamp(16px,4.8vw,20px)!important;line-height:1.25}
.modal p,.modal span,.modal div{min-width:0}
.product-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))!important}
.product .text-xs,.product .text-\\[10px\\]{overflow-wrap:anywhere}
.inventory-row{min-width:0;flex-wrap:wrap}
.inventory-row>.flex-1{flex:1 1 120px;min-width:0}
.pill{white-space:nowrap}
#ex-cards .flex,#ex-hist>div{flex-wrap:wrap;gap:4px}
#ex-cards .text-right{text-align:left}

/* --- Thông báo & bảng nổi: xếp theo chiều dọc dưới header, không đè nhau --- */
#toast{top:calc(var(--hb) + 78px)!important;width:max-content;max-width:min(92vw,440px)!important;white-space:normal!important;overflow-wrap:anywhere;line-height:1.3;border-radius:18px!important}
#nearby-player-panel,#invite-panel{top:calc(var(--hb) + 6px)!important;max-width:92vw}
#borrow-panel{top:calc(var(--hb) + 130px)!important;max-width:92vw}
#boat-invite{top:calc(var(--hb) + 78px)!important;max-width:92vw}
#roof-panel{top:calc(var(--hb) + 130px)!important;max-height:42vh;max-height:42dvh;overflow:auto}
#gift-hud{top:calc(var(--hb) + 6px)!important;max-width:62vw;white-space:normal!important;line-height:1.25;border-radius:14px!important}
#lb{top:calc(var(--hb) + 40px)!important;width:min(176px,46vw)!important}
#disco-ui{top:calc(var(--hb) + 6px)!important;max-width:96vw}
#chat-bar{max-width:min(440px,calc(100vw - 24px))!important}
#fx-bar{flex-wrap:wrap;max-width:94vw}

/* --- Cột nút phải / trái: quá cao thì tự xuống cột mới thay vì tràn lên đè header --- */
#ui-right{max-height:calc(100vh - var(--hb) - 24px);max-height:calc(100dvh - var(--hb) - 24px);flex-wrap:wrap-reverse;justify-content:flex-end;align-content:flex-end}
#fx-side{max-height:calc(100vh - var(--hb) - 190px);max-height:calc(100dvh - var(--hb) - 190px);flex-wrap:wrap;justify-content:flex-end;align-content:flex-start}

/* --- Nhãn trên đầu nhân vật / biển hiệu: không quá rộng --- */
.name-tag,.shop-sign{max-width:72vw;overflow:hidden;text-overflow:ellipsis}
.name-tag.chat-bubble{overflow:visible}
header .glass{min-width:0}
#online-users-list{max-width:100%!important}

/* --- Màn nhỏ --- */
@media (max-width:480px){
 .btn{padding:8px 11px;font-size:12px}
 .btn-round{width:38px;height:38px;font-size:18px}
 .name-tag,.shop-sign{font-size:10px;padding:3px 8px}
 .shop-sign.big{font-size:11px}
 #toast{font-size:11px!important;padding:8px 12px!important}
 .pop-points{font-size:24px}
}
/* --- Điện thoại nằm ngang / màn thấp --- */
@media (max-height:520px){
 #hint{display:none!important}
 .btn-round{width:34px;height:34px;font-size:16px}
 #ui-right .btn.text-xs,#fx-bar .btn{padding:6px 9px;font-size:11px}
 #joy{width:104px!important;height:104px!important}
 #joy-knob{left:26px!important;top:26px!important}
 #lb{width:min(150px,40vw)!important}
 .modal{padding:12px!important}
}
`;
const st=document.createElement('style');st.id='ui-fix-css';st.textContent=css;document.head.appendChild(st);

/* Khóa zoom cả trang (Safari bỏ qua user-scalable=no) nhưng vẫn cho zoom camera trong game */
const vp=document.querySelector('meta[name=viewport]');
if(vp)vp.content='width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));

/* Đánh dấu cột nút phải để CSS xử lý */
function tagRight(){const mb=document.getElementById('music-btn');if(mb&&mb.parentElement&&mb.parentElement.id!=='ui-right')mb.parentElement.id='ui-right'}

/* Đo đáy header → các bảng nổi tự dịch xuống theo */
function setHb(){
 const h=document.querySelector('#screen-game header');
 let b=h?h.getBoundingClientRect().bottom:0;if(!(b>40))b=88;
 document.documentElement.style.setProperty('--hb',Math.round(b)+'px');
}
/* Zoom trình duyệt / xoay màn hình / thanh địa chỉ co giãn: cập nhật lại canvas + độ nét */
function fit(){
 tagRight();setHb();
 try{
  if(typeof renderer!=='undefined'&&renderer){
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
   if(typeof resizeRenderer==='function')resizeRenderer();
  }
 }catch(e){}
}
let raf=0;const fitSoon=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(fit)};
window.addEventListener('resize',fitSoon);
window.addEventListener('orientationchange',()=>setTimeout(fit,250));
if(window.visualViewport)window.visualViewport.addEventListener('resize',fitSoon);
const cc=document.getElementById('canvas-container');
if(cc&&window.ResizeObserver)new ResizeObserver(fitSoon).observe(cc);
setInterval(()=>{if(!document.hidden){tagRight();setHb()}},1000);
fit();
})();
