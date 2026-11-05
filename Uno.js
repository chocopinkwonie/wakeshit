/* UNO: 2-4 người (host quyết định), bot tự chơi. Luật rút gọn: không cần hô UNO, rút 1 lá là hết lượt. */
window.CasinoGames=window.CasinoGames||{};
CasinoGames.uno=(()=>{
 const CN={R:'#ef4444',Y:'#eab308',G:'#22c55e',B:'#3b82f6',W:'#334155'},L={S:'⦸',R:'⇄',D:'+2',W:'🌈',F:'+4'};
 let pick=null;
 const lab=c=>L[c.v]||c.v;
 const sh=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 function deck(){
  const d=[];
  'RYGB'.split('').forEach(c=>{d.push({c,v:'0'});for(let i=1;i<=9;i++)d.push({c,v:''+i},{c,v:''+i});'SRD'.split('').forEach(v=>d.push({c,v},{c,v}))});
  for(let i=0;i<4;i++)d.push({c:'W',v:'W'},{c:'W',v:'F'});
  return sh(d);
 }
 const top=st=>st.disc[st.disc.length-1];
 const ok=(st,c)=>c.c==='W'||c.c===st.color||c.v===top(st).v;
 const nx=(st,s,k=1)=>((s+st.dir*k)%st.n+st.n*2)%st.n;
 function draw(st,s,k){
  for(let i=0;i<k;i++){
   if(!st.deck.length){const t=st.disc.pop();st.deck=sh(st.disc);st.disc=[t]}
   if(st.deck.length)st.hands[s].push(st.deck.pop());
  }
 }
 return{
  init(seats){
   const n=seats.length,d=deck(),hands=seats.map(()=>d.splice(0,7)),t=d.splice(d.findIndex(c=>/^\d$/.test(c.v)),1)[0];
   return{n,hands,deck:d,disc:[t],color:t.c,turn:0,dir:1,win:-1};
  },
  turn:st=>st.win>=0?-1:st.turn,
  winner:st=>st.win,
  act(st,seat,a){
   if(st.win>=0||seat!==st.turn)return null;st=JSON.parse(JSON.stringify(st));
   if(a.t==='draw'){draw(st,seat,1);st.turn=nx(st,seat);return st}
   if(a.t!=='play')return null;
   const h=st.hands[seat],c=h[a.i];
   if(!c||!ok(st,c))return null;
   if(c.c==='W'&&!'RYGB'.includes(a.col))return null;
   h.splice(a.i,1);st.disc.push(c);st.color=c.c==='W'?a.col:c.c;
   if(!h.length){st.win=seat;return st}
   if(c.v==='S')st.turn=nx(st,seat,2);
   else if(c.v==='R'){st.dir*=-1;st.turn=st.n===2?seat:nx(st,seat)}
   else if(c.v==='D'){draw(st,nx(st,seat),2);st.turn=nx(st,seat,2)}
   else if(c.v==='F'){draw(st,nx(st,seat),4);st.turn=nx(st,seat,2)}
   else st.turn=nx(st,seat);
   return st;
  },
  bot(st,s){
   const h=st.hands[s],ix=h.map((c,i)=>i).filter(i=>ok(st,h[i]));
   if(!ix.length)return{t:'draw'};
   const nw=ix.filter(i=>h[i].c!=='W'),pool=nw.length?nw:ix,i=pool[Math.floor(Math.random()*pool.length)];
   const cnt={R:0,Y:0,G:0,B:0};h.forEach(c=>{if(cnt[c.c]!==undefined)cnt[c.c]++});
   return{t:'play',i,col:Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]};
  },
  render(el,st,my,seats,act){
   const mine=my>=0&&st.turn===my&&st.win<0;if(!mine)pick=null;
   const t=top(st),hand=my>=0?st.hands[my]:[];
   el.innerHTML=`<div class="flex flex-wrap gap-2 justify-center">${seats.map((s,i)=>i===my?'':`<span class="pill ${i===st.turn?'!bg-pink-500 !text-white':''}">${esc(s.name)} · 🃏${st.hands[i].length}</span>`).join('')}</div>
   <div class="flex items-center justify-center gap-4 my-4"><button class="uno-card" data-d style="background:#1e293b;${mine?'':'opacity:.6'}">RÚT</button><div class="uno-card" style="background:${CN[t.c]};width:62px;height:92px;font-size:24px">${lab(t)}</div><div class="w-8 h-8 rounded-full border-4 border-white shadow" style="background:${CN[st.color]}"></div></div>
   ${pick!==null?`<div class="flex gap-2 justify-center mb-3"><span class="text-xs font-bold text-pink-700 self-center">Chọn màu:</span>${'RYGB'.split('').map(c=>`<button data-col="${c}" class="w-9 h-9 rounded-full border-4 border-white shadow" style="background:${CN[c]}"></button>`).join('')}</div>`:''}
   <div class="flex flex-wrap gap-1 justify-center pt-2">${hand.map((c,i)=>`<button class="uno-card ${mine&&ok(st,c)?'ok':''}" data-i="${i}" style="background:${CN[c.c]}">${lab(c)}</button>`).join('')}</div>`;
   el.querySelector('[data-d]').onclick=()=>{if(mine)act({t:'draw'})};
   el.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{
    if(!mine)return;const i=+b.dataset.i,c=hand[i];
    if(!ok(st,c)){showToast('Lá này chưa đánh được 🥺');return}
    if(c.c==='W'){pick=i;this.render(el,st,my,seats,act)}else act({t:'play',i});
   });
   el.querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>{const i=pick;pick=null;act({t:'play',i,col:b.dataset.col})});
  }
 };
})();
