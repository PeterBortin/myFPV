/* ===== цивільні: людська поведінка (прапорець SALT_FEAT.civ5) =====
   Надбудова над Yuka (bots.js, тротуари walk2), укриттям від ракет (civ2), сценками (civ3) і жестами (civ4): перехоплює людину лише на час своєї дії.
   · хода: у кожного свій темп і постава — бадьорий, спокійний, літній (сутулий, повільний), «руки в кишенях», з пакетом; плавний розгін і гальмування;
     плечі в протифазі до кроку, голова випереджає поворот; зустрічні розходяться правим боком;
   · погляд: на гравця, що підійшов, на машину поруч, на дрон чи шахед у небі (дехто показує рукою) — і далі у своїх справах;
   · побут: сідають на лавки зупинок (справжня поза сидячи), розглядають вітрини, стоять біля стіни, зупиняються й озираються;
   · небезпека: на стрілянину біжать, прикривши голову, до укриття за перешкодою від стрільця (машина, контейнер, будинок), там пригинаються й виглядають;
     біля тіла — шок, руки до голови, задкують і тікають; коли стихне — повертаються обережно: повільніше, озираючись;
   · маршрути: перед проїжджою частиною зупиняються, дивляться ліворуч і праворуч, пропускають машини, переходять швидше; заходять у двері
     будинків (і зникають усередині), нові люди частіше виходять з під'їздів (двері беруться там, де їх ставить генератор фасадів).
   Пози — поворотами кісток поверх штатної (працює і для запечених моделей людей). Вимкнути: ?off=civ5. */
const CIV5={init:false,seats:[],seatT:0,doors:new Map(),gone:[],stat:{bench:0,wall:0,look:0,cover:0,shock:0,curb:0,door:0,out:0,sky:0,pass:0,glance:0}};
/* двері з генератора фасадів: точка на ґанку й нормаль назовні */
function civ5Door(x,z,nx,nz){
  const k=Math.round(x*2)+'_'+Math.round(z*2);if(CIV5.doors.has(k))return;
  CIV5.doors.set(k,{x:x+nx*.9,z:z+nz*.9,nx:nx,nz:nz,dx:x,dz:z});if(CIV5.doors.size>2400)CIV5.doors.delete(CIV5.doors.keys().next().value);
}
function civ5DoorNear(x,z,r,minP){
  const P=SALT.G&&SALT.G.player?SALT.G.player.pos:null;let best=null,bd=r;
  const nav=SALT.G&&SALT.G.physics?SALT.G.physics.nav:null;
  CIV5.doors.forEach(d=>{const dd=Math.hypot(d.x-x,d.z-z);if(dd<bd&&(!minP||!P||Math.hypot(d.x-P.x,d.z-P.z)>minP)){let ok=true;try{ok=!nav||nav.isWalkable(d.x,d.z);}catch(e){}if(ok){bd=dd;best=d;}}});return best;
}
/* профіль людини: тип ходи, темп, постава; насіння — з її ж фази, щоб не мінялось */
function civ5Prof(b){
  if(b.c5)return b.c5;let s=((b.ph||1)*1e5|0)^((b.pos.x*31+b.pos.z*17)|0);if(s<=0)s=s+2147483646||7;
  const R=()=>{s=(s*16807)%2147483647;return s/2147483647;};const r=R();
  const type=r<.15?'old':r<.37?'brisk':r<.53?'pocket':r<.65?'bag':'calm';
  const c={type:type,spd:{old:.66,brisk:1.2,pocket:.93,bag:.9,calm:1}[type]*(.92+R()*.16),run:type==='old'?.6:.88+R()*.22,
    post:{old:.22,brisk:.04,pocket:.1,bag:.07,calm:.05}[type]+R()*.04,arm:type==='brisk'?1.3:type==='old'?.5:type==='bag'?.6:1,
    st:'',t:0,cd:5+R()*12,v:0,lk:0,lp:0,pk:0,cau:0,cross:0,curbCd:0,glT:0,glCd:4+R()*6,skyCd:0,seen:new Set(),R:R,born:LIFE.t,last:LIFE.t};
  b.c5=c;return c;
}
function civ5Spd(b){const c=b&&b.c5;if(!c||SALT_FEAT.civ5===false)return 1;return c.spd*(c.cau>0?.62:1)*(c.cross>0?1.35:1);}
function civ5Run(b){const c=b&&b.c5;if(!c||SALT_FEAT.civ5===false)return 1;return c.run;}
/* перед кроком Yuka: плавність і розходження правим боком */
function civ5Pre(b,k,dt){
  if(SALT_FEAT.civ5===false)return;const c=civ5Prof(b),v=k.veh,fl=k.flee&&k.flee.active;
  v.maxForce=fl?11:(c.type==='old'?2.2:3);
  if(fl)return;
  if((c.pT=(c.pT||0)-dt)<=0){c.pT=.25;c.pass=0;const sp=Math.hypot(v.velocity.x,v.velocity.z);
    if(sp>.4){const ux=v.velocity.x/sp,uz=v.velocity.z/sp;
      for(const o of LIFE.bots){if(o===b||!o.alive||o.side!=='civ')continue;const dx=o.pos.x-b.pos.x,dz=o.pos.z-b.pos.z,d=Math.hypot(dx,dz);if(d>4.5||d<.3)continue;
        if((dx*ux+dz*uz)/d<.72)continue;const ov=o.yk&&o.yk.veh?o.yk.veh.velocity:null;if(ov&&(ov.x*ux+ov.z*uz)>-.25)continue;   // лише назустріч
        if(Math.abs(-dx*uz+dz*ux)<1){c.pass=1;CIV5.stat.pass++;break;}}}}
  if(c.pass){const vx=v.velocity.x,vz=v.velocity.z,sp=Math.hypot(vx,vz)||1;v.velocity.x+=-vz/sp*1.4*dt;v.velocity.z+=vx/sp*1.4*dt;}   // праворуч від курсу
}
/* проїжджа частина: відстань до краю (мінус — уже на дорозі); лише вулиці, проспекти, магістралі */
function civ5Road(x,z){
  const I=typeof g2Roads==='function'?g2Roads():null;if(!I||typeof RG==='undefined')return 99;const wx=x+SALT.ox,wz=z+SALT.oz,l=I.m.get(Math.floor(wx/40)*100003+Math.floor(wz/40));if(!l)return 99;let best=99;
  for(const s of l){const rd=s.rd;if(!rd||!rd.veh||rd.k==='lane'||rd.k==='track'||!RG.D[rd.k])continue;const ux=s.bx-s.ax,uz=s.bz-s.az,L=ux*ux+uz*uz||1;let t=((wx-s.ax)*ux+(wz-s.az)*uz)/L;t=t<0?0:t>1?1:t;
    const d=Math.hypot(wx-s.ax-ux*t,wz-s.az-uz*t)-RG.D[rd.k]/2;if(d<best)best=d;}
  return best;
}
/* крок самостійно: розгін/гальмування, поворот, перевірка прохідності; true — дійшов */
function civ5Go(b,c,tx,tz,spd,dt,free){
  const G=SALT.G,dx=tx-b.pos.x,dz=tz-b.pos.z,d=Math.hypot(dx,dz),near=d<.3;
  c.v+=((near?0:Math.min(spd,d*2.2+.25))-c.v)*Math.min(1,dt*(spd>2.5?4.5:2.4));
  if(near){b.sp=c.v<.15?0:c.v;return true;}
  const ty=Math.atan2(dx,dz),dy=((ty-b.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;b.yaw+=dy*Math.min(1,dt*(spd>2.5?8:5));
  const st=Math.min(d,c.v*dt),nx=b.pos.x+dx/d*st,nz=b.pos.z+dz/d*st;let ok=true;
  if(!free)try{ok=G.physics.nav.isWalkable(nx,nz)&&landAt(SALT.ox+nx,SALT.oz+nz)!==6;}catch(e){}
  if(!ok){c.blk=(c.blk||0)+dt;b.sp=0;c.v*=.5;return false;}
  c.blk=0;b.pos.x=nx;b.pos.z=nz;try{b.pos.y=saltBotY(G.physics,nx,nz,b.pos.y);}catch(e){}b.sp=c.v;return false;
}
/* 1138b: маршрут по сітці прохідності (паркани, будинки) — один раз на рішення; без маршруту рішення не приймається */
function civ5Route(b,c,tx,tz,fx,fz){
  const G=SALT.G,T=G.THREE,nav=G.physics.nav;let p=null;
  try{const a=new T.Vector3(b.pos.x,0,b.pos.z),e=new T.Vector3(tx,0,tz);p=nav.clearLine(a,e)?[e]:nav.findPath(a,e);}catch(_){p=null;}
  if(!p||!p.length)return false;const L=p[p.length-1];if(Math.hypot(L.x-tx,L.z-tz)>1.2)return false;
  c.pp=p.map(q=>({x:q.x,z:q.z}));if(Math.hypot(L.x-tx,L.z-tz)>.35)c.pp.push({x:tx,z:tz,free:1});              // добирання до точки поза сіткою — вільним кроком
  if(fx!=null)c.pp.push({x:fx,z:fz,free:1});c.pi=0;return true;                                                   // останні метри (під дах зупинки) — так само
}
function civ5GoP(b,c,spd,dt){
  const pp=c.pp;if(!pp||!pp.length)return true;const q=pp[Math.min(c.pi,pp.length-1)],last=c.pi>=pp.length-1;
  const ar=civ5Go(b,c,q.x,q.z,spd,dt,q.free&&Math.hypot(q.x-b.pos.x,q.z-b.pos.z)<1.9);if(last)return ar;if(ar||Math.hypot(q.x-b.pos.x,q.z-b.pos.z)<.8)c.pi++;return false;
}
function civ5Sync(b){try{if(b.yk&&b.yk.veh){b.yk.veh.position.set(b.pos.x,0,b.pos.z);b.yk.veh.velocity.set(0,0,0);}}catch(e){}}
function civ5Face(b,ty,dt,k){const dy=((ty-b.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;b.yaw+=dy*Math.min(1,dt*(k||4));}
function civ5End(b,c,cd){if(c.seat&&c.seat.used===b)c.seat.used=null;c.seat=null;c.st='';c.t=0;c.cd=cd==null?8+c.R()*12:cd;b.crouch=false;b.sp=0;civ5Sync(b);}
/* загроза від стрілянини (ракети й вибухи веде civ2) */
function civ5Threat(b){
  const now=LIFE.t,P=SALT.G.player.pos,H=typeof BOTS!=='undefined'?BOTS.heard:null;
  if(now-LIFE.fireT<3.5&&Math.hypot(P.x-b.pos.x,P.z-b.pos.z)<55)return {x:P.x,z:P.z};
  if(H&&!H.boom&&now-H.t<2&&Math.hypot(H.x-b.pos.x,H.z-b.pos.z)<60)return {x:H.x,z:H.z};
  for(const e of LIFE.bots)if(e.side==='enemy'&&e.alive&&e.burst>0&&e.pos.distanceTo(b.pos)<45)return {x:e.pos.x,z:e.pos.z};
  return null;
}
/* укриття: точка за перешкодою з протилежного від стрільця боку */
function civ5CoverPt(b,th){
  const cand=[],G=SALT.G;let best=null,bs=-1e9;
  for(const e of DEST.list){if(e.dead||!e.bb||!(e.r>=.7))continue;const d=Math.hypot(e.c.x-b.pos.x,e.c.z-b.pos.z);if(d>24)continue;
    cand.push({x:e.c.x,z:e.c.z,r:Math.min(2.6,Math.max(e.bb.max.x-e.bb.min.x,e.bb.max.z-e.bb.min.z)/2)});}
  for(const car of LIFE.cars){const p=car.g.position,d=Math.hypot(p.x-b.pos.x,p.z-b.pos.z);if(d<24&&!(car.v>.5))cand.push({x:p.x,z:p.z,r:1.3});}
  try{const w=typeof civ2Wall==='function'?civ2Wall(b.pos.x,b.pos.z,18):null;if(w&&w.b)cand.push({x:w.b.cx-SALT.ox,z:w.b.cz-SALT.oz,r:Math.min(14,Math.max(w.b.hw,w.b.hd)),bld:1});}catch(e){}
  const d0=Math.hypot(b.pos.x-th.x,b.pos.z-th.z);
  for(const q of cand){const ax=q.x-th.x,az=q.z-th.z,al=Math.hypot(ax,az)||1,px=q.x+ax/al*(q.r+.7),pz=q.z+az/al*(q.r+.7),db=Math.hypot(px-b.pos.x,pz-b.pos.z);if(db>26)continue;
    let ok=true;try{ok=G.physics.nav.isWalkable(px,pz)&&landAt(SALT.ox+px,SALT.oz+pz)!==6;}catch(e){}if(!ok)continue;
    const s=-db+Math.min(Math.hypot(px-th.x,pz-th.z),45)*.25-(Math.hypot(px-th.x,pz-th.z)<d0-6?6:0);if(s>bs){bs=s;best={x:px,z:pz};}}
  return best;
}
/* небо: шахед або дрон над головою */
function civ5Sky(b){
  const p0=b.pos;let best=null,bd=380;
  try{if(typeof SH!=='undefined')for(const s of SH.list){const p=s.g&&s.g.position;if(!p)continue;const d=Math.hypot(p.x-p0.x,p.z-p0.z);if(d<bd){bd=d;best=p;}}}catch(e){}
  try{const F=SALT.fly;if(F&&F.on&&F.pos&&F.pos.y-p0.y>3&&Math.hypot(F.pos.x-p0.x,F.pos.z-p0.z)<45)best=F.pos;}catch(e){}
  return best;
}
/* лавки зупинок: лава шукається за геометрією (дошка на висоті ~0,5 м), лицем — від скла до дороги */
function civ5Seats(){
  CIV5.seats=CIV5.seats.filter(s=>s.e&&!s.e.dead&&DEST.list.indexOf(s.e)>=0);
  for(const e of DEST.list){if(e.name!=='x_bus_stop'||e.dead||e.c5s||!e.ranges||!e.bb)continue;e.c5s=1;
    /* 1138b: орієнтація з самої форми — верх сидіння (нормаль угору на висоті 0,44–0,6 м) дає довгу вісь лави (головні компоненти),
       планки спинки (0,7–1 м) кажуть, де зад; без спинки — бік ближче до проїзної частини; останнє — до середини габариту */
    const y0=e.bb.min.y,S=[],K=[];
    for(const r of e.ranges){if(!r.mesh)continue;const g=r.mesh.geometry,A=g.attributes.position,N=g.attributes.normal;
      for(let i=r.s;i<r.s+r.c;i++){const y=A.getY(i)-y0;if(y>.44&&y<.6&&(!N||N.getY(i)>.85))S.push(A.getX(i),A.getZ(i));else if(y>.7&&y<1.02)K.push(A.getX(i),A.getZ(i));}}
    const n=S.length/2;if(n<6)continue;let bx=0,bz=0;for(let i=0;i<S.length;i+=2){bx+=S[i];bz+=S[i+1];}bx/=n;bz/=n;
    let xx=0,zz=0,xz=0;for(let i=0;i<S.length;i+=2){const dx=S[i]-bx,dz=S[i+1]-bz;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;}
    const th=.5*Math.atan2(2*xz,xx-zz),ax=Math.cos(th),az=Math.sin(th);let fx=-az,fz=ax,sg=0;
    if(K.length>=8){let kx=0,kz=0;for(let i=0;i<K.length;i+=2){kx+=K[i];kz+=K[i+1];}kx/=K.length/2;kz/=K.length/2;const d=(kx-bx)*fx+(kz-bz)*fz;if(Math.abs(d)>.06)sg=d>0?-1:1;}
    if(!sg){const a=civ5Road(bx+fx*3,bz+fz*3),b=civ5Road(bx-fx*3,bz-fz*3);if(Math.abs(a-b)>.5&&Math.min(a,b)<40)sg=a<b?1:-1;}
    if(!sg)sg=((e.c.x-bx)*fx+(e.c.z-bz)*fz)>=0?1:-1;
    fx*=sg;fz*=sg;let lo=1e9,hi=-1e9;for(let i=0;i<S.length;i+=2){const t=(S[i]-bx)*ax+(S[i+1]-bz)*az;if(t<lo)lo=t;if(t>hi)hi=t;}
    const mid=(hi+lo)/2,cx=bx+ax*mid,cz=bz+az*mid;e.c5f={x:fx,z:fz,bx:cx,bz:cz,len:hi-lo,how:K.length>=8?'back':'road'};
    for(const o of (hi-lo>2.2?[-.62,.62]:[0]))CIV5.seats.push({x:cx+ax*o+fx*.46,z:cz+az*o+fz*.46,fx:fx,fz:fz,yaw:Math.atan2(fx,fz),e:e,used:null});}
}
function civ5Seat(b){let best=null,bd=40;for(const s of CIV5.seats){if(s.used&&s.used.alive&&s.used.c5&&s.used.c5.seat===s)continue;const d=Math.hypot(s.x-b.pos.x,s.z-b.pos.z);if(d<bd){bd=d;best=s;}}return best;}
/* стани, що вже тривають; true — людиною кермує цей модуль */
function civ5State(b,c,dt){
  const G=SALT.G,P=G.player.pos;c.t+=dt;
  switch(c.st){
    case 'cover-go':{const th=civ5Threat(b);if(th)c.th=th;const ar=civ5Go(b,c,c.cv.x,c.cv.z,4.4*c.run,dt);b.crouch=false;c.pose='runcover';
      if(ar){c.st='cover';c.t=0;c.q=0;}else if(c.blk>1.2||c.t>12){civ5End(b,c,2);c.covT=LIFE.t;return false;}return true;}
    case 'cover':{b.sp=0;c.v=0;const th=civ5Threat(b);if(th){c.th=th;c.q=0;}else c.q+=dt;
      const peek=(c.t%5)>3.6;b.crouch=!peek;c.pose=peek?'peek':'cower';civ5Face(b,Math.atan2(c.th.x-b.pos.x,c.th.z-b.pos.z)+(peek?0:Math.PI*.85),dt,3);
      if(c.q>7+c.R()*5){civ5End(b,c,10);c.cau=14;c.covT=LIFE.t;return false;}return true;}
    case 'shock':{b.sp=0;c.pose='shock';const ty=Math.atan2(c.sx-b.pos.x,c.sz-b.pos.z);
      if(c.t<1.7){civ5Face(b,ty,dt,6);return true;}
      if(c.t<3.4){const dx=b.pos.x-c.sx,dz=b.pos.z-c.sz,l=Math.hypot(dx,dz)||1;civ5Go(b,c,b.pos.x+dx/l,b.pos.z+dz/l,1,dt);b.yaw=ty;return true;}
      civ5End(b,c,6);c.cau=12;try{if(b.yk)b.yk.th={x:c.sx,z:c.sz,t:LIFE.t};}catch(e){}return false;}
    case 'curb':{b.sp=0;c.v=0;civ5Face(b,Math.atan2(c.cux,c.cuz),dt,6);c.pose='';
      let car=false;const cx=b.pos.x+c.cux*4,cz=b.pos.z+c.cuz*4;
      for(const q of LIFE.cars){if(q.wreck)continue;const p=q.g.position,dx=cx-p.x,dz=cz-p.z,d=Math.hypot(dx,dz);if(d>30)continue;const sp=q.v||0;if(sp<.6&&d>6)continue;
        const hx=q.yk?q.yk.hx:Math.sin(q.g.rotation.y),hz=q.yk?q.yk.hz:Math.cos(q.g.rotation.y);if(d<6||(dx*hx+dz*hz)/d>.3){car=true;break;}}
      if(car&&c.t<9)c.wait=Math.max(c.wait,c.t+.7);
      if(c.t>=c.wait){c.st='';c.cross=6;c.curbCd=9;c.cd=Math.max(c.cd,4);CIV5.stat.cross=(CIV5.stat.cross||0)+1;return false;}return true;}
    case 'seat-go':{const s=c.seat;if(!s||(s.used&&s.used!==b)){civ5End(b,c,6);return false;}
      if(civ5GoP(b,c,1.25*c.spd,dt)){c.st='sit';c.t=0;c.dur=14+c.R()*24;}else if(c.blk>1.5||c.t>40){civ5End(b,c,10);return false;}return true;}
    case 'sit':{const s=c.seat;b.sp=0;c.v=0;if(!s||s.e.dead){civ5End(b,c);return false;}b.pos.x+=(s.x-b.pos.x)*Math.min(1,dt*4);b.pos.z+=(s.z-b.pos.z)*Math.min(1,dt*4);civ5Face(b,s.yaw,dt,5);c.pose='sit';
      if(c.t>c.dur){c.st='stand';c.t=0;}return true;}
    case 'stand':{b.sp=0;c.pose='';if(c.t>.7){civ5End(b,c,20+c.R()*20);return false;}return true;}
    case 'wall-go':{const w=c.wl;if(civ5GoP(b,c,1.1*c.spd,dt)){c.st='wall';c.t=0;c.dur=6+c.R()*8;}else if(c.blk>1.5||c.t>25){civ5End(b,c);return false;}return true;}
    case 'wall':{b.sp=0;c.v=0;const w=c.wl;civ5Face(b,Math.atan2(w.b.cx-SALT.ox-b.pos.x,w.b.cz-SALT.oz-b.pos.z),dt,3);c.pose='window';if(c.t>c.dur){civ5End(b,c,14+c.R()*16);return false;}return true;}
    case 'look':{b.sp=0;c.v=0;c.pose='look';if(c.t>c.dur){civ5End(b,c,10+c.R()*12);return false;}return true;}
    case 'sky':{b.sp=0;c.v=0;const p=civ5Sky(b);if(p)c.sk=p;c.pose=c.point?'point':'sky';if(c.sk)civ5Face(b,Math.atan2(c.sk.x-b.pos.x,c.sk.z-b.pos.z),dt,2.5);
      if(c.t>c.dur||!p&&c.t>1){civ5End(b,c,6);c.skyCd=22;return false;}return true;}
    case 'door-go':{const d=c.door;if(civ5GoP(b,c,1.15*c.spd,dt)){c.st='door-in';c.t=0;c.v=0;}else if(c.blk>1.5||c.t>40){civ5End(b,c);return false;}return true;}
    case 'door-in':{const d=c.door;civ5Face(b,Math.atan2(-d.nx,-d.nz),dt,6);c.pose=c.t<.75?'reach':'';            // рука до клямки, крок у дверний отвір
      if(c.t>.55)civ5Go(b,c,d.dx+d.nx*.1,d.dz+d.nz*.1,.85,dt,true);else b.sp=0;
      if(!b.c5gone&&(c.t>1.6||Math.hypot(b.pos.x-d.dx,b.pos.z-d.dz)<.32)){if(b.m&&b.m.g)b.m.g.visible=false;b.c5gone=true;CIV5.gone.push(b);CIV5.stat.door++;}return true;}
    case 'out':{const d=c.door;c.pose='';
      if(!c.po){civ5Go(b,c,d.dx+d.nx*1.4,d.dz+d.nz*1.4,.9*c.spd,dt,true);let w=true;try{w=SALT.G.physics.nav.isWalkable(b.pos.x,b.pos.z);}catch(e){}   // з порога на ґанок — повз сітку,
        if((w&&Math.hypot(b.pos.x-d.dx,b.pos.z-d.dz)>.85)||c.t>3){c.po=1;c.blk=0;}return true;}                                                              // доки не стане на прохідне
      if(civ5Go(b,c,d.dx+d.nx*3.4,d.dz+d.nz*3.4,1.05*c.spd,dt)||c.t>9||c.blk>1){c.po=0;civ5End(b,c,6);return false;}return true;}
  }
  c.st='';return false;
}
/* цивільний: що вирішує цей модуль (після civ2 й civ4) */
function civ5Own(b,dt){
  if(SALT_FEAT.civ5===false||b.side!=='civ'||!b.alive||b.swim||b.inCar||b.c5gone)return false;
  if(b.m&&b.m.g&&b.m.g.visible===false)return false;
  const c=civ5Prof(b),now=LIFE.t;
  if(now-c.last>.6&&c.st){civ5End(b,c,4);}                             // кермував хтось інший (ховався від ракет тощо) — свій стан скидаємо
  c.last=now;c.cau=Math.max(0,c.cau-dt);c.cross=Math.max(0,c.cross-dt);c.curbCd=Math.max(0,c.curbCd-dt);c.skyCd=Math.max(0,c.skyCd-dt);
  if(c.pose&&!c.st)c.pose='';
  /* щойно з'явився — інколи виходить з під'їзду */
  if(!c.outDone){c.outDone=1;if(now>8&&c.R()<.42){const d=civ5DoorNear(b.pos.x,b.pos.z,30,12);if(d){b.pos.x=d.dx+d.nx*.25;b.pos.z=d.dz+d.nz*.25;try{b.pos.y=saltBotY(SALT.G.physics,b.pos.x,b.pos.z,b.pos.y);}catch(e){}b.yaw=Math.atan2(d.nx,d.nz);c.door=d;c.st='out';c.t=0;c.po=0;c.v=0;CIV5.stat.out++;civ5Sync(b);return true;}}}
  const th=civ5Threat(b);
  if(th&&c.st!=='cover-go'&&c.st!=='cover'){if(c.st)civ5End(b,c,2);if(!(c.covT&&now-c.covT<18)){const p=civ5CoverPt(b,th);let okL=!!p;if(p)try{const T=SALT.G.THREE,nav=SALT.G.physics.nav;okL=nav.isWalkable(p.x,p.z)&&nav.clearLine(new T.Vector3(b.pos.x,0,b.pos.z),new T.Vector3(p.x,0,p.z));}catch(e){okL=true;}   // 1138b: лише укриття, до якого видно прохід — інакше тікає (Yuka)
    if(okL){c.cv=p;c.th=th;c.st='cover-go';c.t=0;c.v=Math.max(c.v,1.5);CIV5.stat.cover++;}else c.covT=now-12;}}   // нема куди — наступна спроба за 6 с (без пошуку щокадру)
  if(c.st)return civ5State(b,c,dt);
  if(th)return false;                                                    // сховатись нікуди — тікає, як раніше (Yuka)
  /* тіло поруч — шок */
  for(const o of LIFE.bots){if(o.alive||!o.m||!o.m.g||o.m.g.visible===false||o.dead>40||c.seen.has(o))continue;const dx=o.pos.x-b.pos.x,dz=o.pos.z-b.pos.z,d=Math.hypot(dx,dz);if(d>8)continue;
    if((dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw))/(d||1)<.15&&d>2.5)continue;c.seen.add(o);c.st='shock';c.t=0;c.sx=o.pos.x;c.sz=o.pos.z;CIV5.stat.shock++;return civ5State(b,c,dt);}
  /* перехід дороги */
  if(c.curbCd<=0&&c.cross<=0&&b.yk&&b.yk.veh&&(c.cT=(c.cT||0)-dt)<=0){c.cT=.25;const v=b.yk.veh.velocity,sp=Math.hypot(v.x,v.z);
    if(sp>.45){const ux=v.x/sp,uz=v.z/sp,on=civ5Road(b.pos.x,b.pos.z),ah=civ5Road(b.pos.x+ux*1.3,b.pos.z+uz*1.3);
      if(on>.25&&ah<-.3&&on-ah>.8){c.st='curb';c.t=0;c.cux=ux;c.cuz=uz;c.wait=1.5+c.R()*1.1;CIV5.stat.curb++;return civ5State(b,c,dt);}}}
  /* небо */
  if(c.skyCd<=0&&(c.skT=(c.skT||0)-dt)<=0){c.skT=1;const p=civ5Sky(b);if(p&&c.R()<.5){c.st='sky';c.t=0;c.sk=p;c.dur=2.4+c.R()*2.6;c.point=c.R()<.4;CIV5.stat.sky++;return civ5State(b,c,dt);}}
  /* побут */
  if((c.cd-=dt)<=0){c.cd=4+c.R()*6;if(typeof CIV2!=='undefined'&&CIV2.danger)return false;const r=c.R();
    if(r<.3){const s=civ5Seat(b);if(s&&civ5Route(b,c,s.x+s.fx*1.3,s.z+s.fz*1.3,s.x,s.z)){s.used=b;c.seat=s;c.st='seat-go';c.t=0;CIV5.stat.bench++;return civ5State(b,c,dt);}}
    if(r>=.3&&r<.4&&now-c.born>25){const d=civ5DoorNear(b.pos.x,b.pos.z,18);if(d&&civ5Route(b,c,d.x,d.z)){c.door=d;c.st='door-go';c.t=0;return civ5State(b,c,dt);}}
    if(r>=.4&&r<.52){let w=null;try{w=typeof civ2Wall==='function'?civ2Wall(b.pos.x,b.pos.z,12):null;}catch(e){}if(w&&w.b&&w.d>1&&civ5Route(b,c,w.x,w.z)){c.wl=w;c.st='wall-go';c.t=0;CIV5.stat.wall++;return civ5State(b,c,dt);}}
    if(r>=.52&&r<.64){c.st='look';c.t=0;c.dur=2.2+c.R()*2.2;CIV5.stat.look++;return civ5State(b,c,dt);}}
  return false;
}
/* погляд: куди дивиться голова (світовий курс і нахил); null — уперед */
function civ5LookAt(b,c,dt){
  const G=SALT.G,P=G.player.pos;
  if(c.st==='curb'){const y0=Math.atan2(c.cux,c.cuz),t=c.t;return {y:t<.7?y0+1.15:t<1.4?y0-1.15:t<c.wait-.3?y0+Math.sin(t*2.2)*1.1:y0,p:0};}
  if(c.st==='look')return {y:b.yaw+Math.sin(c.t*1.4)*1.05,p:-.12+Math.sin(c.t*.9)*.12};
  if(c.st==='sky'&&c.sk){const dx=c.sk.x-b.pos.x,dz=c.sk.z-b.pos.z;return {y:Math.atan2(dx,dz),p:-Math.min(.75,Math.atan2(c.sk.y-b.pos.y-1.6,Math.hypot(dx,dz)))};}
  if((c.st==='cover'||c.st==='cover-go')&&c.th)return {y:Math.atan2(c.th.x-b.pos.x,c.th.z-b.pos.z),p:c.st==='cover'?0:.3};
  if(c.st==='wall')return {y:b.yaw+Math.sin(c.t*.6)*.35,p:.06};
  if(c.st==='sit'){if(c.t%9<3)return {y:b.yaw+Math.sin(c.t*.8)*.7,p:.05};return {y:b.yaw,p:.35};}   // сидить: роззирається або дивиться в телефон
  /* погляд на гравця, що підійшов, і на машину поруч — кілька секунд */
  c.glCd-=dt;
  if(c.glT>0){c.glT-=dt;const q=c.glO;if(q)return {y:Math.atan2(q.x-b.pos.x,q.z-b.pos.z),p:c.glCar?.12:0};}
  else if(c.glCd<=0){c.glCd=1;const dx=P.x-b.pos.x,dz=P.z-b.pos.z,d=Math.hypot(dx,dz);
    if(d<7&&d>.8&&(dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw))/d>.1){c.glT=1.6+c.R()*1.4;c.glO=P;c.glCar=0;c.glCd=8+c.R()*6;CIV5.stat.glance++;}
    else for(const q of LIFE.cars){const p=q.g.position,ex=p.x-b.pos.x,ez=p.z-b.pos.z,e=Math.hypot(ex,ez);if(e<11&&(q.v||0)>2&&(ex*Math.sin(b.yaw)+ez*Math.cos(b.yaw))/e>-.2){c.glT=1.2;c.glO=p;c.glCar=1;c.glCd=6+c.R()*5;break;}}}
  return null;
}
/* поза поверх штатної: постава, плечі, руки за типом ходи, сидіння, укриття, шок, жести; голова — останньою */
function civ5Pose(m,dt,b){
  const c=b.c5;if(!c||!b.alive||b.side!=='civ'||b.swim)return;
  const K=m.k,mov=Math.min(1,K.sp/1.2),L=m.armL,R=m.armR,c4=m.c4&&m.c4.k>.05,on=c.pose&&c.st;
  c.pk+=((on?1:0)-c.pk)*Math.min(1,dt*5);const k=c.pk;
  const mix=(o,x,y,z,w)=>{if(!o)return;const q=w==null?k:w;o.rotation.x+=(x-o.rotation.x)*q;o.rotation.y+=(y-o.rotation.y)*q;o.rotation.z+=(z-o.rotation.z)*q;};
  try{
    /* хода: постава, плечі в протифазі, розмах рук */
    if(c.pose!=='sit'){m.spine.rotation.x+=c.post*(1-K.cr)*(1-k*.7);m.head.rotation.x-=c.post*.45*(1-K.cr);}
    if(mov>.05&&!c4){m.chest.rotation.y+=Math.sin(m.ph)*.08*mov*Math.min(1.2,c.arm);
      if(c.type==='pocket'&&k<.5){mix(L.up,.1,0,.16,1-k);mix(R.up,.1,0,-.16,1-k);if(L.lo){mix(L.lo,-.72,0,0,1-k);mix(R.lo,-.72,0,0,1-k);}}
      else if(c.type==='bag'&&k<.5){mix(R.up,.02,0,-.08,(1-k)*.85);if(R.lo)mix(R.lo,-.12,0,0,(1-k)*.85);}
      else if(c.arm!==1){const s=Math.sin(m.ph)*(c.arm-1)*.32*mov;L.up.rotation.x-=s;R.up.rotation.x+=s;}}
    if(c.type==='bag'&&R.hand){if(!c.bag){const T=SALT.G.THREE;const bg=new T.Mesh(SALT.res.c5bagG||(SALT.res.c5bagG=(()=>{const g=new T.BoxGeometry(.27,.32,.09);g.translate(0,-.2,0);return g;})()),SALT.res.c5bagM||(SALT.res.c5bagM=new T.MeshStandardMaterial({color:0x8a7f6c,roughness:.95})));bg.castShadow=true;R.hand.add(bg);c.bag=bg;}
      c.bag.rotation.set(-R.up.rotation.x*.6,0,0);c.bag.visible=c.pose!=='sit'&&c.pose!=='point';}
    if(k>.01&&!c4){
      if(c.pose==='sit'){                                                       // сидить: таз на лаві, стегна вперед, гомілки вниз, руки на колінах
        m.hips.position.y+=(.63-m.hips.position.y)*k;m.hips.position.z+=(-.43-m.hips.position.z)*k;m.hips.rotation.x*=1-k;
        for(const g of [m.legL,m.legR]){mix(g.th,-1.5,0,g.sd*.06);mix(g.sh,1.48,0,0);mix(g.ft,.05,0,0);}
        m.spine.rotation.x+=(-.12-m.spine.rotation.x)*k;mix(L.up,-.42,0,.1);mix(R.up,-.42,0,-.1);if(L.lo){mix(L.lo,-.95,0,0);mix(R.lo,-.95,0,0);}}
      else if(c.pose==='runcover'||c.pose==='cower'){mix(L.up,-2.25,0,-.52);mix(R.up,-2.25,0,.52);if(L.lo){mix(L.lo,-2.05,0,0);mix(R.lo,-2.05,0,0);}m.head.rotation.x+=.4*k;m.spine.rotation.x+=(c.pose==='cower'?.35:.25)*k;}
      else if(c.pose==='peek'){mix(L.up,-.5,0,.2);mix(R.up,-.5,0,-.2);if(L.lo){mix(L.lo,-1.4,0,0);mix(R.lo,-1.4,0,0);}}
      else if(c.pose==='shock'){mix(L.up,-1.95,0,-.36);mix(R.up,-1.95,0,.36);if(L.lo){mix(L.lo,-2.15,0,0);mix(R.lo,-2.15,0,0);}m.spine.rotation.x-=.12*k;}
      else if(c.pose==='point'){mix(R.up,-2.3,0,-.25);if(R.lo)mix(R.lo,-.15,0,0);}
      else if(c.pose==='reach'){mix(R.up,-1.35,0,-.15);if(R.lo)mix(R.lo,-.35,0,0);}
      else if(c.pose==='window'){mix(L.up,.15,0,.25,k*.6);mix(R.up,.15,0,-.25,k*.6);if(L.lo){mix(L.lo,-1.2,0,0,k*.6);mix(R.lo,-1.2,0,0,k*.6);}}}
    /* голова: на ціль погляду (тулуб частково довертає), інакше — трохи випереджає поворот */
    if(!(m.c4&&m.c4.k>.3)){const la=civ5LookAt(b,c,dt);let ly=0,lp=0;
      if(la){ly=((la.y-m.g.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;lp=la.p||0;}
      else{ly=((b.yaw-m.g.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;ly=Math.max(-.5,Math.min(.5,ly*1.4));}
      ly=Math.max(-1.25,Math.min(1.25,ly));c.lk+=(ly-c.lk)*Math.min(1,dt*(la?4.5:3));c.lp+=(lp-c.lp)*Math.min(1,dt*4);
      const hy=Math.max(-.85,Math.min(.85,c.lk));m.head.rotation.y+=hy;m.chest.rotation.y+=(c.lk-hy)*.8+c.lk*.12;m.head.rotation.x+=c.lp;}
  }catch(e){}
}
function civ5Init(G){
  if(CIV5.init)return;CIV5.init=true;
  if(typeof civ2Own==='function'){const o=civ2Own;civ2Own=function(b,dt){const r=o.apply(this,arguments);if(r)return r;try{return civ5Own(b,dt);}catch(e){if(!CIV5.e1){CIV5.e1=1;console.error('civ5',e);}return false;}};}
  if(typeof saltPose==='function'){const o=saltPose;saltPose=function(m,sp,dt,cr,pr,b){const r=o.apply(this,arguments);if(b&&b.c5&&SALT_FEAT.civ5!==false)civ5Pose(m,dt,b);return r;};}
}
function civ5Step(G,dt){
  if(SALT_FEAT.civ5===false)return;civ5Init(G);
  if((CIV5.seatT-=dt)<=0){CIV5.seatT=2;try{civ5Seats();}catch(e){}}
  for(const b of CIV5.gone){const i=LIFE.bots.indexOf(b);if(i>=0){try{G.scene.remove(b.m.g);}catch(e){}LIFE.bots.splice(i,1);}if(b.c5&&b.c5.seat)b.c5.seat.used=null;}CIV5.gone.length=0;   // зайшов у під'їзд — більше не рахується
}
