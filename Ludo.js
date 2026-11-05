/* Cờ cá ngựa: 2-4 người, mỗi người 4 ngựa. Ra quân cần 6, đá ngựa khi đáp trúng, về đích cần đúng số, được 6 thì tung tiếp (tối đa 3 lần). */
window.CasinoGames=window.CasinoGames||{};
CasinoGames.ludo=(()=>{
 const COL=['#ef4444','#22c55e','#eab308','#3b82f6'],R=150,CX=200,CY=200,GOAL=56;
 const slot=(n,s)=>n===2?s*2:s,ang=i=>2*Math.PI*i/52-Math.PI/2,pt=(a,r)=>[CX+r*Math.cos(a),CY+r*Math.sin(a)];
 const abs=(n,s,p)=>(13*slot(n,s)+p)%52;
 function xy(n,s,p,j){
  const sl=slot(n,s);
  if(p<0)return pt(ang(13*sl)+(j%2?.08:-.08),R+(j<2?24:44));
  if(p<=50)return pt(ang(abs(n,s,p)),R);
  return pt(ang((13*sl+50)%52),p<=55?R-22*(p-50):R-132);
 }
 const mv=(st,s)=>{const d=st.dice;return st.pos[s].map((p,i)=>i).filter(i=>{const p=st.pos[s][i];return p<0?d===6:p+d<=GOAL})};
 function captures(st,s,i){
  const p=st.pos[s][i]<0?0:st.pos[s][i]+st.dice;if(p>50)return 0;
  const a=abs(st.n,s,p);if(a%13===0)return 0;let k=0;
  st.pos.forEach((P,o)=>{if(o!==s)P.forEach(q=>{if(q>=0&&q<=50&&abs(st.n,o,q)===a)k++})});return k;
 }
 return{
  init(seats){const n=seats.length;return{n,pos:seats.map(()=>[-1,-1,-1,-1]),turn:0,dice:0,last:0,six:0,win:-1,msg:''}},
  turn:st=>st.win>=0?-1:st.turn,
  winner:st=>st.win,
  act(st,seat,a){
   if(st.win>=0||seat!==st.turn)return null;st=JSON.parse(JSON.stringify(st));st.msg='';
   if(a.t==='roll'){
    if(st.dice)return null;st.dice=1+Math.floor(Math.random()*6);st.last=st.dice;
    if(!mv(st,seat).length){st.msg='Không đi được, mất lượt';st.dice=0;st.six=0;st.turn=(seat+1)%st.n}
    return st;
   }
   if(a.t==='move'){
    if(!st.dice||!mv(st,seat).includes(a.i))return null;
    const d=st.dice,P=st.pos[seat],c=captures(st,seat,a.i);
    P[a.i]=P[a.i]<0?0:P[a.i]+d;
    if(P[a.i]<=50){const ab=abs(st.n,seat,P[a.i]);if(ab%13!==0)st.pos.forEach((Q,o)=>{if(o!==seat)Q.forEach((q,k)=>{if(q>=0&&q<=50&&abs(st.n,o,q)===ab)Q[k]=-1})})}
    if(c)st.msg='Đá ngựa đối thủ! 💥';
    if(P.every(p=>p===GOAL)){st.win=seat;st.dice=0;return st}
    st.dice=0;
    if(d===6&&st.six<2)st.six++;else{st.six=0;st.turn=(seat+1)%st.n}
    return st;
   }
   return null;
  },
  bot(st,s){
   if(!st.dice)return{t:'roll'};
   let best=-1,bi=0;
   mv(st,s).forEach(i=>{const p=st.pos[s][i],np=p<0?0:p+st.dice;const sc=captures(st,s,i)*60+(np===GOAL?50:0)+(p<0?30:0)+(p<=50&&np>50?15:0)+np+Math.random();if(sc>best){best=sc;bi=i}});
   return{t:'move',i:bi};
  },
  render(el,st,my,seats,act){
   const n=st.n,can=st.turn===my&&st.dice&&st.win<0?mv(st,my):[];
   let s='<svg viewBox="0 0 400 400" class="cg-svg"><circle cx="200" cy="200" r="196" fill="#fff7fb" stroke="#fbcfe8" stroke-width="4"/>';
   for(let i=0;i<52;i++){const [x,y]=pt(ang(i),R);let f='#fff';for(let k=0;k<n;k++)if(13*slot(n,k)===i)f=COL[slot(n,k)];s+=`<circle cx="${x}" cy="${y}" r="9" fill="${f}" stroke="#cbd5e1"/>`}
   for(let k=0;k<n;k++){
    for(let p=51;p<=GOAL;p++){const [x,y]=xy(n,k,p,0);s+=`<circle cx="${x}" cy="${y}" r="${p===GOAL?13:8}" fill="${COL[slot(n,k)]}" opacity=".35"/>`}
    for(let j=0;j<4;j++){const [x,y]=xy(n,k,-1,j);s+=`<circle cx="${x}" cy="${y}" r="13" fill="${COL[slot(n,k)]}" opacity=".2"/>`}
   }
   for(let k=0;k<n;k++)for(let j=0;j<4;j++){
    const [x,y]=xy(n,k,st.pos[k][j],j),c=k===my&&can.includes(j);
    s+=`<circle ${c?`data-p="${j}"`:''} cx="${x+(j-1.5)*1.5}" cy="${y}" r="10.5" fill="${COL[slot(n,k)]}" stroke="${c?'#facc15':'#fff'}" stroke-width="${c?4:2}" ${c?'style="cursor:pointer"':''}/>`;
   }
   s+='</svg>';
   const d=st.dice||st.last;
   el.innerHTML=`<div class="flex flex-wrap gap-2 justify-center mb-2">${seats.map((x,i)=>`<span class="pill" style="${i===st.turn?'outline:2px solid #db2777;':''}"><span style="color:${COL[slot(n,i)]}">●</span> ${esc(x.name)}${i===my?' (cậu)':''}</span>`).join('')}</div>${s}
   <div class="text-center mt-2"><span class="text-4xl">${d?'⚀⚁⚂⚃⚄⚅'[d-1]:'🎲'}</span> <span class="text-xs font-bold text-pink-600">${esc(st.msg||'')}</span>
   ${st.turn===my&&!st.dice&&st.win<0?'<button class="btn btn-pink ml-2" data-r>🎲 Tung xúc xắc</button>':''}${can.length?'<div class="text-xs text-pink-600 font-bold">Chạm ngựa viền vàng để đi</div>':''}</div>`;
   const r=el.querySelector('[data-r]');if(r)r.onclick=()=>act({t:'roll'});
   el.querySelectorAll('[data-p]').forEach(c=>c.onclick=()=>act({t:'move',i:+c.dataset.p}));
  }
 };
})();
