/* ===================================================================
   voice.js — Sửa mic không ai nghe + tách nút Nhạc / Hiệu ứng / Tiếng bạn bè
   Cách dùng: thêm <script src="voice.js?v=1"></script> SAU features.js (trước ui-fix.js)
   Không sửa file cũ. File này thay hẳn hệ thống mic của features.js bằng bản mới:
     • kênh realtime riêng (không bị lẫn với gói tin di chuyển 10 lần/giây)
     • gửi 1 gói offer + 1 gói answer đầy đủ (không gửi từng ICE candidate rời rạc)
     • có TURN dự phòng (mạng 4G / wifi chặn P2P)
     • có bảng trạng thái góc trái: thấy ngay mic có thu tiếng không, nối được bao nhiêu bạn
   Muốn dùng TURN riêng (ổn định hơn), khai báo TRƯỚC khi nạp file này:
     <script>window.WK_ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'turn:...',username:'...',credential:'...'}]</script>
=================================================================== */
(function(){
const ICE=window.WK_ICE||[
 {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
 {urls:'stun:stun.cloudflare.com:3478'},
 /* TURN công cộng dùng thử — có thể bị giới hạn/ngừng, nên thay bằng TURN riêng nếu vẫn không nghe được */
 {urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turns:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}
];
const $v=id=>document.getElementById(id);
let ch=null,ready=false,joined=false,micOn=false,stream=null,voiceMuted=false,needTap=false;
let anaCtx=null,ana=null,level=0,silent=0,warnedSilent=false;
const peers={},out={},inn={},els={},tries={},state={},asked={};

/* ---------- Nút âm thanh: tách riêng Nhạc / Hiệu ứng / Tiếng bạn bè ---------- */
const mb=$v('music-btn');
function mkBtn(id,txt,title){const b=document.createElement('button');b.id=id;b.className='btn btn-round';b.textContent=txt;b.title=title;return b}
const sfxBtn=mkBtn('sfx-btn','🔔','Bật/tắt hiệu ứng âm thanh (tiếng bước, ném, kính vỡ...)');
const voiceBtn=mkBtn('voice-btn','🗣️','Bật/tắt tiếng bạn bè nói (mic của người khác)');
if(mb&&mb.parentElement){mb.insertAdjacentElement('afterend',voiceBtn);mb.insertAdjacentElement('afterend',sfxBtn)}
if(mb)mb.title='Bật/tắt NHẠC (nhạc nền, nhạc nhảy, video vũ trường)';

/* Nút 🎵 chỉ còn điều khiển nhạc: không còn kéo theo hiệu ứng âm thanh */
const _tm=toggleMusic;
toggleMusic=function(){const s=sfxOn;_tm();sfxOn=s};
/* Nhạc nhảy tính là NHẠC: tắt nhạc thì không phát, còn tắt hiệu ứng thì vẫn phát */
const _sd=startDanceMusic;
startDanceMusic=function(){if(!musicOn)return;const s=sfxOn;sfxOn=true;try{_sd()}finally{sfxOn=s}};

sfxBtn.onclick=()=>{
 sfxOn=!sfxOn;sfxBtn.textContent=sfxOn?'🔔':'🔕';
 showToast(sfxOn?'🔔 Đã bật hiệu ứng âm thanh':'🔕 Đã tắt hiệu ứng âm thanh');
};
voiceBtn.onclick=()=>{
 voiceMuted=!voiceMuted;voiceBtn.textContent=voiceMuted?'🔇':'🗣️';
 Object.values(els).forEach(a=>{a.muted=voiceMuted});
 showToast(voiceMuted?'🔇 Đã tắt tiếng bạn bè (cậu sẽ không nghe ai nói)':'🗣️ Đã bật tiếng bạn bè');
};

/* ---------- Bảng trạng thái mic ---------- */
document.body.insertAdjacentHTML('beforeend','<div id="voice-hud" class="glass hidden" style="position:fixed;left:62px;bottom:max(164px,env(safe-area-inset-bottom));z-index:26;border-radius:14px;padding:6px 10px;max-width:min(260px,60vw);font-size:11px;font-weight:800;color:#be185d;line-height:1.35"></div>');
function hud(){
 const el=$v('voice-hud');if(!el)return;
 const L=[],ids=Object.keys(peers);
 if(micOn){
  const ok=ids.filter(i=>/connected|completed/.test(state[i]||'')).length;
  L.push(`🎙️ Mic bật · nối được ${ok}/${ids.length} người`);
  L.push(`<div style="height:6px;border-radius:99px;background:#fce7f3;overflow:hidden;margin:2px 0"><i style="display:block;height:100%;width:${Math.min(100,level)}%;background:${level>3?'#22c55e':'#f472b6'}"></i></div>`);
  ids.forEach(i=>{if(state[i]==='failed')L.push(`⚠️ ${esc(peers[i].name)}: không nối được (mạng chặn)`);else if(state[i]==='retry'||state[i]==='checking'||state[i]==='new')L.push(`⏳ Đang nối ${esc(peers[i].name)}...`)});
  if(!ids.length)L.push('Chưa có ai khác online');
 }
 Object.keys(inn).forEach(i=>{if(els[i]&&els[i].srcObject)L.push(`🔊 ${esc((peers[i]&&peers[i].name)||'bạn')} đang bật mic`+(voiceMuted?' (đang tắt tiếng)':''))});
 if(needTap)L.push('👆 Chạm vào màn hình để nghe bạn bè');
 el.innerHTML=L.join('<br>');el.classList.toggle('hidden',!L.length);
}
setInterval(()=>{
 if(micOn&&ana){
  const d=new Uint8Array(ana.fftSize);ana.getByteTimeDomainData(d);
  let m=0;for(let i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]-128));
  level=Math.min(100,m*2.2);
  if(level<3){silent++;if(silent===30&&!warnedSilent){warnedSilent=true;showToast('Micro đang không thu được tiếng 🤔 Kiểm tra mic có bị tắt / chọn nhầm thiết bị trong hệ thống không')}}else silent=0;
 }else level=0;
 hud();
},400);
document.addEventListener('pointerdown',()=>{
 needTap=false;Object.values(els).forEach(a=>a.play().catch(()=>{needTap=true}));
 if(anaCtx&&anaCtx.state==='suspended')anaCtx.resume();
});

/* ---------- Tín hiệu qua kênh realtime riêng ---------- */
function sig(to,kind,data){if(ch&&ready)ch.send({type:'broadcast',event:'v',payload:{from:myId,to,kind,data}})}
function gathered(pc,ms){
 return new Promise(res=>{
  if(pc.iceGatheringState==='complete')return res();
  const t=setTimeout(done,ms||3000);
  function done(){clearTimeout(t);pc.removeEventListener('icegatheringstatechange',chk);res()}
  function chk(){if(pc.iceGatheringState==='complete')done()}
  pc.addEventListener('icegatheringstatechange',chk);
 });
}
function closeOut(id){const o=out[id];if(o){try{o.pc.close()}catch(e){}delete out[id]}delete state[id]}
function closeIn(id){
 const o=inn[id];if(o){try{o.pc.close()}catch(e){}delete inn[id]}
 const a=els[id];if(a){try{a.pause()}catch(e){}a.srcObject=null;a.remove();delete els[id]}
}
function getEl(id){
 let a=els[id];
 if(!a){a=document.createElement('audio');a.autoplay=true;a.playsInline=true;a.setAttribute('playsinline','');a.style.display='none';document.body.appendChild(a);els[id]=a}
 return a;
}
function retry(id){
 closeOut(id);tries[id]=(tries[id]||0)+1;
 if(tries[id]>4||!micOn){state[id]='failed';return}
 state[id]='retry';setTimeout(()=>call(id),1500*tries[id]);
}
/* Người đang nói (mic bật) gọi tới từng người nghe */
async function call(id){
 if(out[id]||!micOn||!stream||!ready||!peers[id]||(tries[id]||0)>4)return;
 const pc=new RTCPeerConnection({iceServers:ICE});out[id]={pc,t:Date.now()};state[id]='new';
 stream.getTracks().forEach(t=>pc.addTrack(t,stream));
 pc.oniceconnectionstatechange=()=>{
  if(!out[id]||out[id].pc!==pc)return;
  const s=pc.iceConnectionState;state[id]=s;
  if(s==='connected'||s==='completed')tries[id]=0;
  else if(s==='failed')retry(id);
  else if(s==='disconnected')setTimeout(()=>{if(out[id]&&out[id].pc===pc&&pc.iceConnectionState==='disconnected')retry(id)},4000);
 };
 try{
  const off=await pc.createOffer();await pc.setLocalDescription(off);await gathered(pc);
  if(!out[id]||out[id].pc!==pc)return;
  sig(id,'offer',{type:pc.localDescription.type,sdp:pc.localDescription.sdp});
  setTimeout(()=>{if(out[id]&&out[id].pc===pc&&!pc.remoteDescription)retry(id)},12000);
 }catch(e){console.warn('voice call',e);retry(id)}
}
async function onSig(p){
 if(!p||p.to!==myId||!p.from)return;
 const from=p.from;
 try{
  if(p.kind==='offer'){
   closeIn(from);
   const pc=new RTCPeerConnection({iceServers:ICE});inn[from]={pc};
   pc.ontrack=e=>{
    const a=getEl(from);
    a.srcObject=(e.streams&&e.streams[0])?e.streams[0]:new MediaStream([e.track]);
    a.muted=voiceMuted;a.volume=1;
    a.play().then(()=>{needTap=false}).catch(()=>{needTap=true});
   };
   pc.oniceconnectionstatechange=()=>{const s=pc.iceConnectionState;if((s==='failed'||s==='closed')&&inn[from]&&inn[from].pc===pc)closeIn(from)};
   await pc.setRemoteDescription(p.data);
   const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await gathered(pc);
   sig(from,'answer',{type:pc.localDescription.type,sdp:pc.localDescription.sdp});
  }else if(p.kind==='answer'){
   const o=out[from];if(o&&o.pc.signalingState==='have-local-offer')await o.pc.setRemoteDescription(p.data);
  }else if(p.kind==='bye'){closeIn(from)}
  else if(p.kind==='ask'&&micOn){
   const o=out[from];
   if(o){const s=o.pc.iceConnectionState;if(s==='connected'||s==='completed'||Date.now()-o.t<15000)return;closeOut(from)}
   tries[from]=0;call(from);
  }
 }catch(e){console.warn('voice sig',e)}
}
function ask(id){if(Date.now()-(asked[id]||0)<6000)return;asked[id]=Date.now();sig(id,'ask',null)}
function onSync(){
 const st=ch.presenceState();
 Object.keys(peers).forEach(k=>delete peers[k]);
 Object.keys(st).forEach(id=>{if(id===myId)return;const e=st[id][0]||{};peers[id]={name:String(e.name||'???').slice(0,20),mic:!!e.mic}});
 Object.keys(out).forEach(id=>{if(!peers[id])closeOut(id)});
 Object.keys(inn).forEach(id=>{if(!peers[id])closeIn(id)});
 if(micOn)Object.keys(peers).forEach(id=>call(id));
 Object.keys(peers).forEach(id=>{if(peers[id].mic&&!inn[id])ask(id)});
}
function join(){
 if(joined||!supabaseClient||typeof me==='undefined'||!me)return;
 joined=true;
 ch=supabaseClient.channel('wakeone-voice',{config:{broadcast:{self:false},presence:{key:myId}}});
 ch.on('broadcast',{event:'v'},({payload})=>onSig(payload)).on('presence',{event:'sync'},onSync)
  .subscribe(async s=>{
   if(s==='SUBSCRIBED'){ready=true;await ch.track({name:myName,mic:micOn})}
   else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){ready=false;showToast('Kênh thoại mất kết nối, thử tải lại trang nha')}
  });
}
const waitMe=setInterval(()=>{if(typeof me!=='undefined'&&me&&supabaseClient){clearInterval(waitMe);join()}},500);

/* ---------- Bật / tắt mic ---------- */
async function toggleMic(){
 if(micOn){stopMic();return}
 if(!window.isSecureContext){showToast('Mic chỉ chạy khi mở bằng https 🔒');return}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){showToast('Trình duyệt không hỗ trợ mic 🥲');return}
 try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false})}
 catch(e){
  showToast(e&&e.name==='NotFoundError'?'Không tìm thấy micro nào 🎙️':'Micro đang bị chặn — bấm biểu tượng 🔒 cạnh thanh địa chỉ → cho phép Micro rồi thử lại');
  return;
 }
 micOn=true;silent=0;warnedSilent=false;Object.keys(tries).forEach(k=>tries[k]=0);
 $v('mic-btn').classList.add('mic-on');$v('mic-btn').textContent='🎙️';
 try{
  const AC=window.AudioContext||window.webkitAudioContext;anaCtx=anaCtx||new AC();
  ana=anaCtx.createAnalyser();ana.fftSize=256;anaCtx.createMediaStreamSource(stream).connect(ana);
  if(anaCtx.state==='suspended')anaCtx.resume();
 }catch(e){ana=null}
 const tr=stream.getAudioTracks()[0];if(tr)tr.onended=()=>{if(micOn)stopMic()};
 if(ready)ch.track({name:myName,mic:true});
 Object.keys(peers).forEach(id=>call(id));
 showToast('🎙️ Mic đang bật — xem góc trái để biết đã nối tới ai');
}
function stopMic(){
 micOn=false;
 Object.keys(out).forEach(id=>{sig(id,'bye',null);closeOut(id)});
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 ana=null;level=0;
 $v('mic-btn').classList.remove('mic-on');$v('mic-btn').textContent='🎤';
 if(ready)ch.track({name:myName,mic:false});
 showToast('Đã tắt mic');
}
$v('mic-btn').onclick=toggleMic;   // ghi đè nút mic cũ của features.js
window.addEventListener('beforeunload',()=>{Object.keys(out).forEach(id=>sig(id,'bye',null))});
})();
