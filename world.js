/* world.js: sắp xếp lại map cho cân đối + 3 tòa CJ / GRID / 131 + Chợ sông Hàn + Sòng bạc WAKEONE.
   Nạp SAU features.js. Không cần sửa code trong index.html ngoài việc thêm thẻ <script>. */
(()=>{
 /* Sông Hàn mở rộng bờ tây (x 75→92) để có chỗ cho chợ + sòng bạc */
 RIVER.x0=92;RIVER.x1=100;
 shopsData.push({id:12,name:'Chợ sông Hàn',icon:'🛶',x:82,z:-24,type:'vegetable',color:0xbbf7d0,shape:'dome'});

 const css=document.createElement('style');
 css.textContent='.shop-sign.red{background:#dc2626!important}.shop-sign.teal{background:#0e7490!important}.shop-sign.amber{background:#d97706!important}';
 document.head.appendChild(css);

 const TOWERS=[
  {x:-90,z:-90,w:16,d:16,h:44,base:'#dc2626',win:'#7f1d1d',cols:6,rows:14,roof:0x991b1b,trim:0x7f1d1d,ant:8,text:'CJ',signBg:'#b91c1c',c:11.5,cls:'red',label:'🏢 CJ',r:14},
  {x:0,z:-92,w:12,d:12,h:30,base:'#0e7490',win:'#cffafe',cols:5,rows:10,roof:0x155e75,trim:0x164e63,ant:5,text:'GRID',signBg:'#0e7490',c:8.8,cls:'teal',label:'🏢 GRID',r:11},
  {x:-90,z:90,w:10,d:10,h:24,base:'#f59e0b',win:'#78350f',cols:4,rows:8,roof:0xb45309,trim:0x92400e,ant:4,text:'131',signBg:'#d97706',c:7.5,cls:'amber',label:'🏢 131',r:10}
 ];
 const FOUNTAINS=[[52,-52,1,'⛲ Vườn hoa'],[-52,-52,1,'⛲ Vườn hoa'],[-52,52,1,'⛲ Vườn hoa'],[0,92,2,'⛲ Hồ Sen']];
 const CLEAR=[...TOWERS.map(t=>[t.x,t.z,t.r]),...FOUNTAINS.map(f=>[f[0],f[1],6*f[2]+1]),[82,-42,10]];

 function facade(base,win,cols,rows){
  const c=document.createElement('canvas');c.width=256;c.height=512;const x=c.getContext('2d');
  x.fillStyle=base;x.fillRect(0,0,256,512);
  const cw=256/cols,rh=512/rows;
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){x.fillStyle=Math.random()<.18?'#fde68a':win;x.fillRect(i*cw+cw*.18,j*rh+rh*.2,cw*.64,rh*.6)}
  return new THREE.CanvasTexture(c);
 }
 function signPlane(text,w,h,bg,font){
  const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const x=c.getContext('2d');
  x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle='#fff';x.font='800 '+font+'px Quicksand,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2+4);
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));
 }
 function tower(o){
  const g=new THREE.Group(),{x,z,w,d,h}=o;
  const side=new THREE.MeshStandardMaterial({map:facade(o.base,o.win,o.cols,o.rows),roughness:.6}),top=M(o.roof);
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),[side,side,top,top,side,side]);body.position.y=h/2;g.add(body);
  addBox(g,w+2,1.2,d+2,o.trim,0,.6,0);
  addBox(g,w+.6,1,d+.6,o.trim,0,h+.5,0);
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,o.ant,8),M(0x94a3b8));ant.position.y=h+1+o.ant/2;g.add(ant);
  const sg=signPlane(o.text,w*.7,w*.32,o.signBg,150);sg.position.set(0,h-w*.28,d/2+.06);g.add(sg);
  addBox(g,w*.28,3,.3,0x1e293b,0,1.5,d/2+.2);
  g.position.set(x,0,z);g.rotation.y=Math.atan2(-x,-z);scene.add(g);
  colliders.push({x,z,r:o.c});
  addLabel(o.label,'shop-sign big '+o.cls,()=>new THREE.Vector3(x,h+4,z),220);
 }
 function fountain(x,z,k,label){
  const g=new THREE.Group();
  const pad=new THREE.Mesh(new THREE.CircleGeometry(6*k,32),M(0xfbcfe8));pad.rotation.x=-Math.PI/2;pad.position.y=.07;g.add(pad);
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(3*k,3.3*k,.7,28),M(0xf9a8d4));basin.position.y=.35;g.add(basin);
  const wt=new THREE.Mesh(new THREE.CylinderGeometry(2.7*k,2.7*k,.1,28),new THREE.MeshStandardMaterial({color:0x38bdf8,transparent:true,opacity:.85}));wt.position.y=.72;g.add(wt);
  const pil=new THREE.Mesh(new THREE.CylinderGeometry(.25*k,.4*k,2.2*k,10),M(0xf472b6));pil.position.y=1.5*k;g.add(pil);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.55*k,12,10),M(0x38bdf8));ball.position.y=2.7*k;g.add(ball);
  g.position.set(x,0,z);scene.add(g);colliders.push({x,z,r:3.4*k});
  addLabel(label,'shop-sign',()=>new THREE.Vector3(x,4.5*k,z),45);
 }
 /* gỡ cây/bụi mọc ngẫu nhiên đè lên chỗ xây mới */
 function purge(x,z,r){
  for(let i=scene.children.length-1;i>=0;i--){
   const o=scene.children[i];if(Math.hypot(o.position.x-x,o.position.z-z)>=r)continue;
   const tree=o.isGroup&&o.children.length===2&&o.children[0].geometry&&o.children[0].geometry.type==='CylinderGeometry';
   const bush=o.isMesh&&o.geometry&&o.geometry.type==='DodecahedronGeometry';
   if(tree||bush)scene.remove(o);
  }
  for(let i=colliders.length-1;i>=0;i--)if(colliders[i].r===.7&&Math.hypot(colliders[i].x-x,colliders[i].z-z)<r)colliders.splice(i,1);
 }

 const _init=init3DMap;
 init3DMap=function(){
  _init();
  CLEAR.forEach(([x,z,r])=>purge(x,z,r));
  TOWERS.forEach(tower);
  FOUNTAINS.forEach(f=>fountain(...f));
  if(typeof Casino!=='undefined')Casino.build();
 };
 const _cn=checkNearby;
 checkNearby=function(){_cn();if(typeof Casino!=='undefined')Casino.check()};
 /* đang ngồi trong sòng bạc thì đứng yên (tránh bị xe đụng / rơi sông) */
 const _mp=movePlayer;
 movePlayer=function(dt){if(typeof Casino!=='undefined'&&typeof Casino.isOpen==='function'&&Casino.isOpen())return;_mp(dt)};
})();
