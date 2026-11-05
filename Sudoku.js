/* Sudoku 10 màn, chơi một mình. Đáp án nằm trên server; thắng màn lần đầu +5 xu. */
window.CasinoGames=window.CasinoGames||{};
CasinoGames.sudoku={
 start(el,api){
  const sb=supabaseClient;let lv=0,puz='',cur=[],sel=-1;
  const box=i=>((i/27|0)*3)+((i%9)/3|0);
  function bad(){
   const b=new Set();
   for(let i=0;i<81;i++){if(!cur[i])continue;for(let j=0;j<81;j++)if(j!==i&&cur[j]===cur[i]&&((j/9|0)===(i/9|0)||j%9===i%9||box(j)===box(i))){b.add(i);break}}
   return b;
  }
  async function levels(){
   lv=0;const {data}=await sb.from('sudoku_progress').select('level'),done=(data||[]).map(r=>r.level),max=Math.max(0,...done);
   el.innerHTML=`<button class="btn btn-soft text-xs" data-b>← Quay lại</button><h2 class="text-lg font-extrabold text-pink-700 mt-2">🔢 Sudoku · chọn màn</h2><p class="text-xs text-pink-500">Thắng mỗi màn lần đầu +5 xu. Qua màn trước mới mở màn sau.</p><div class="grid grid-cols-5 gap-2 mt-3">${Array.from({length:10},(_,i)=>{const n=i+1,lock=n>max+1;return `<button class="btn ${done.includes(n)?'btn-pink':'btn-soft'}" data-l="${n}" ${lock?'disabled':''}>${lock?'🔒':n}${done.includes(n)?' ✓':''}</button>`}).join('')}</div>`;
   el.querySelector('[data-b]').onclick=api.back;
   el.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>play(+b.dataset.l));
  }
  async function play(n){
   const {data,error}=await sb.rpc('sudoku_get',{lv:n});
   if(error){showToast(error.message);return}
   lv=n;puz=data;cur=puz.split('').map(Number);sel=-1;draw();
  }
  function draw(){
   const B=bad();
   el.innerHTML=`<div class="flex justify-between items-center"><button class="btn btn-soft text-xs" data-b>← Chọn màn</button><b class="text-pink-700">Màn ${lv}/10</b></div>
   <div class="grid grid-cols-9 mx-auto mt-2" style="max-width:380px;border:3px solid #9d174d">${cur.map((v,i)=>{const g=puz[i]!=='0',c=i%9,r=i/9|0;
    return `<div class="sd-c" data-c="${i}" style="background:${i===sel?'#fde68a':g?'#fce7f3':'#fff'};color:${B.has(i)?'#dc2626':g?'#9d174d':'#2563eb'};border-right:${c%3===2&&c<8?'3px solid #9d174d':'1px solid #fbcfe8'};border-bottom:${r%3===2&&r<8?'3px solid #9d174d':'1px solid #fbcfe8'}">${v||''}</div>`}).join('')}</div>
   <div class="grid grid-cols-5 gap-2 mx-auto mt-3" style="max-width:380px">${[1,2,3,4,5,6,7,8,9,0].map(v=>`<button class="btn btn-soft" data-n="${v}">${v||'✕'}</button>`).join('')}</div>
   <button class="btn btn-pink w-full mt-3" data-s style="max-width:380px;display:block;margin-left:auto;margin-right:auto">Nộp bài</button>`;
   el.querySelector('[data-b]').onclick=levels;
   el.querySelectorAll('[data-c]').forEach(c=>c.onclick=()=>{const i=+c.dataset.c;if(puz[i]==='0'){sel=i;draw()}});
   el.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>put(+b.dataset.n));
   el.querySelector('[data-s]').onclick=submit;
  }
  function put(v){if(sel<0)return;cur[sel]=v;draw()}
  async function submit(){
   if(cur.includes(0)||bad().size){showToast('Chưa xong hoặc còn ô bị trùng 🥺');return}
   const {data,error}=await sb.rpc('sudoku_claim',{lv,grid:cur.join('')});
   if(error){showToast(/WRONG/.test(error.message)?'Chưa đúng đáp án, kiểm tra lại nha!':error.message);return}
   showToast(data>0?'Giải xong! +5 xu 🪙🎉':'Giải xong! (màn này đã nhận xu rồi)');
   api.refresh();levels();
  }
  const key=e=>{
   if(!el.isConnected||!lv||!el.querySelector('[data-s]'))return;
   if(/^[1-9]$/.test(e.key))put(+e.key);else if(['Backspace','Delete','0'].includes(e.key))put(0);
  };
  if(!CasinoGames.sudoku._k){CasinoGames.sudoku._k=1;document.addEventListener('keydown',e=>CasinoGames.sudoku._h&&CasinoGames.sudoku._h(e))}
  CasinoGames.sudoku._h=key;
  levels();
 }
};
