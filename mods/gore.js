/* ===== розчленування вбитих (прапорець SALT_FEAT.gore) =====
   Куди влучив — те й відлітає: голова, рука (по лікоть або від плеча), нога (по коліно або від стегна). Тулуб — після трьох влучань
   (або одного з важкої зброї), вибух поруч — тіло на шматки. Шматок — справжня геометрія моделі з місця влучання: у запечених бійців —
   вершини скінованого меша за поточною позою тіла, у зібраних кодом — їхні деталі. Зсередини шматка — темне м'ясо, на зрізі — кришка,
   на тілі лишається кукса. Бризки й плями — з blood.js, на відриві — густіший викид і калюжа; шматки падають за правилом тяжіння (grav.js),
   лежать ~40 с, одночасно — не більше GORE.max. Лише вбиті вороги; цивільних і своїх не чіпає. Кулі гравця «бачать» тіла тільки під час
   пострілу — приціл геймпада тіл не чіпляє. Вимкнути: ?off=gore. */
const GORE={init:false,parts:[],shot:false,max:40,stat:{hit:0,cut:0,gib:0,blast:0}};
/* частини для відриву: група кістяка, кістки запеченого меша (порядок K10B_BONES), батьківська група для кукси, товщина */
const GORE_P={
  head:{g:m=>m.head,b:[4],par:m=>m.neck,r:.11},
  armL:{g:m=>m.armL.up,b:[11,12,13],par:m=>m.chest,r:.06},armLlo:{g:m=>m.armL.lo,b:[12,13],par:m=>m.armL.up,r:.05},
  armR:{g:m=>m.armR.up,b:[14,15,16],par:m=>m.chest,r:.06},armRlo:{g:m=>m.armR.lo,b:[15,16],par:m=>m.armR.up,r:.05},
  legL:{g:m=>m.legL.th,b:[5,6,7],par:m=>m.hips,r:.085},legLlo:{g:m=>m.legL.sh,b:[6,7],par:m=>m.legL.th,r:.065},
  legR:{g:m=>m.legR.th,b:[8,9,10],par:m=>m.hips,r:.085},legRlo:{g:m=>m.legR.sh,b:[9,10],par:m=>m.legR.th,r:.065}};
/* шматки для «на шматки»: назва, група, кістки, разом із дочірніми (для зібраних кодом), товщина */
const GORE_G=[['head',m=>m.head,[3,4],1,.12],['chest',m=>m.chest,[2],0,.17],['spine',m=>m.spine,[1],0,.15],['hips',m=>m.hips,[0],0,.15],
  ['armL',m=>m.armL.up,[11],0,.06],['armLlo',m=>m.armL.lo,[12,13],1,.05],['armR',m=>m.armR.up,[14],0,.06],['armRlo',m=>m.armR.lo,[15,16],1,.05],
  ['legL',m=>m.legL.th,[5],0,.085],['legLlo',m=>m.legL.sh,[6,7],1,.065],['legR',m=>m.legR.th,[8],0,.085],['legRlo',m=>m.legR.sh,[9,10],1,.065]];
function goreMats(){
  const T=SALT.G.THREE,R=SALT.res;
  if(!R.goreIn)R.goreIn=new T.MeshStandardMaterial({color:0x3c0806,roughness:.6,metalness:0,side:T.BackSide});           // нутро шматка
  if(!R.goreCap)R.goreCap=new T.MeshStandardMaterial({color:0x420907,roughness:.34,metalness:.05});                     // зріз і кукса: темне, вологе
  if(!R.goreCapG)R.goreCapG=new T.SphereGeometry(1,10,8);
  return R;
}
/* геометрія частини запеченого бійця: трикутники, усі три вершини яких належать цим кісткам; позиції — у світі за поточною позою, мінус центр */
function goreSkinGeo(mesh,bones,c){
  const T=SALT.G.THREE,g=mesh.geometry,P=g.attributes.position,SI=g.attributes.skinIndex,SW=g.attributes.skinWeight,U=g.attributes.uv,ix=g.index?g.index.array:null;
  if(!P||!SI||!SW||typeof mesh.applyBoneTransform!=='function')return null;
  const n=P.count,set=new Set(bones),dom=new Uint8Array(n);for(let i=0;i<n;i++){const a=SI.getX(i),b=SI.getY(i);dom[i]=set.has(SW.getX(i)>=SW.getY(i)?a:b)?1:0;}
  const map=new Int32Array(n).fill(-1),pos=[],uv=[],idx=[],v=new T.Vector3(),tri=ix?ix.length:n;
  for(let t=0;t+2<tri;t+=3){const a=ix?ix[t]:t,b=ix?ix[t+1]:t+1,d=ix?ix[t+2]:t+2;if(!(dom[a]&&dom[b]&&dom[d]))continue;
    for(const q of [a,b,d]){if(map[q]<0){map[q]=pos.length/3;v.fromBufferAttribute(P,q);mesh.applyBoneTransform(q,v);v.applyMatrix4(mesh.matrixWorld);pos.push(v.x-c.x,v.y-c.y,v.z-c.z);if(U)uv.push(U.getX(q),U.getY(q));}idx.push(map[q]);}}
  if(idx.length<9)return null;
  const o=new T.BufferGeometry();o.setAttribute('position',new T.Float32BufferAttribute(pos,3));if(U)o.setAttribute('uv',new T.Float32BufferAttribute(uv,2));o.setIndex(idx);o.computeVertexNormals();o.computeBoundingSphere();return o;
}
/* частина бійця, зібраного кодом: видимі деталі групи (deep — разом із дочірніми), злиті за матеріалом */
function goreMeshGeo(grp,deep,c){
  const T=SALT.G.THREE,by=new Map();
  const take=o=>{if(!o.isMesh||o.isSkinnedMesh||!o.visible||o.userData.k10hide||o.userData.gore||!o.geometry||!o.geometry.attributes.position)return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.translate(-c.x,-c.y,-c.z);if(!g.attributes.normal)g.computeVertexNormals();
    let l=by.get(o.material);if(!l){l=[];by.set(o.material,l);}l.push(g);};
  if(deep)grp.traverse(o=>{if(o!==grp)take(o);});else grp.children.forEach(take);
  const out=[];by.forEach((l,mat)=>{try{const g=typeof car3Merge==='function'?car3Merge(T,l):l[0];if(g)out.push({geo:g,mat:mat});}catch(e){}});return out;
}
function goreGeos(m,grp,bones,deep,c){
  if(m.k10b){const g=goreSkinGeo(m.k10b,bones,c);return g?[{geo:g,mat:m.k10b.material}]:[];}
  return goreMeshGeo(grp,deep,c);
}
/* шматок у світі: оболонка моделі + нутро зсередини + кришка зрізу; падає за правилом тяжіння */
function gorePart(geos,c,vel,spin,r){
  const T=SALT.G.THREE,R=goreMats(),grp=new T.Group();grp.position.copy(c);
  for(const q of geos){const a=new T.Mesh(q.geo,q.mat);a.castShadow=true;a.receiveShadow=true;a.userData.gore=1;grp.add(a);const bi=new T.Mesh(q.geo,R.goreIn);bi.userData.gore=1;grp.add(bi);}
  const cap=new T.Mesh(R.goreCapG,R.goreCap);cap.scale.setScalar(r*.78);cap.userData.gore=1;grp.add(cap);
  grp.userData.noMerge=true;SALT.G.scene.add(grp);
  const P={o:grp,geos:geos,dec:0};
  if(typeof gravAdd==='function'&&SALT_FEAT.grav!==false)gravAdd(grp,{v:vel,r:Math.max(.04,r*.8),k:.26,w:spin,life:40,onRest:()=>{if(P.dec++<1)try{bloodDecal(grp.position.x,grp.position.z,.1+Math.random()*.12,false);}catch(e){}}});
  else grp.position.y=Math.max(grp.position.y-.3,saltH(c.x,c.z)+r);
  GORE.parts.push(P);goreTrim();return grp;
}
function goreTrim(){
  const lim=SALT.lite||SALT.droneOnly?16:GORE.max;
  for(let i=GORE.parts.length-1;i>=0;i--){const p=GORE.parts[i];if(!p.o.parent){goreFree(p);GORE.parts.splice(i,1);}}      // зняте тяжінням після «терміну»
  while(GORE.parts.length>lim){const p=GORE.parts.shift();try{if(p.o.parent)p.o.parent.remove(p.o);}catch(e){}goreFree(p);}
}
function goreFree(p){for(const q of p.geos)try{q.geo.dispose();}catch(e){}p.geos=[];}
/* густий викид на відриві (частинки vfx.js у тих самих параметрах, що й кров у blood.js) */
function goreSpray(p,dir,k){
  if(SALT_FEAT.blood===false||typeof vfxP!=='function'||typeof VFX==='undefined'||!VFX.ok)return;
  if(typeof vfxFar==='function'&&vfxFar(p,160))return;
  const N=typeof vfxN==='function'?vfxN:(n=>n),R=()=>Math.random()-.5,dx=dir?dir.x:0,dz=dir?dir.z:0;
  for(let i=N(Math.round(16*k));i--;){const v=2+Math.random()*4*k;vfxP(p.x,p.y,p.z,dx*v*.6+R()*3*k,1.4+Math.random()*3.4*k,dz*v*.6+R()*3*k,.5+Math.random()*.6,.032+Math.random()*.04,.018,.36,.012,.012,.95,3,9.8,.35,0,.07);}
  for(let i=N(Math.round(3*k));i--;)vfxP(p.x,p.y,p.z,R()*.8,.35+Math.random()*.5,R()*.8,.6,.08,.5*Math.min(1.6,k),.42,.02,.02,.42,0,.4,2.6,0,0);
}
function goreSnd(p,big){try{if(typeof psPlay==='function'&&typeof PS_DEF!=='undefined'){if(!PS_DEF.goreSplat)PS_DEF.goreSplat=[.5,(w,sr,R)=>{let l=0;for(let i=0;i<w.length;i++){const t=i/sr,e=Math.exp(-t*13),v=R()*2-1;l+=(v-l)*.22;
        w[i]=(l*1.5*e+Math.sin(t*6.2832*(62+46*Math.exp(-t*24)))*Math.exp(-t*20)*.95)*Math.min(1,t*400);}},0,41];
      psPlay('goreSplat',{x:p.x,y:p.y,z:p.z,ref:10},big?1.3:.9,big?.8:1);}}catch(e){}}
/* відрив частини */
function goreCut(b,part,dir,pt){
  const D=GORE_P[part],m=b.m,g=b.gore||(b.gore={cut:{},tor:0});if(!D||g.cut[part])return false;
  const grp=D.g(m);if(!grp)return false;const T=SALT.G.THREE,R=goreMats();
  m.g.updateMatrixWorld(true);const c=new T.Vector3();grp.getWorldPosition(c);
  const geos=goreGeos(m,grp,D.b,true,c);if(!geos.length)return false;
  const d=dir||new T.Vector3((Math.random()-.5),0,(Math.random()-.5)).normalize(),sp=3.2+Math.random()*3;
  gorePart(geos,c,new T.Vector3(d.x*sp+(Math.random()-.5)*2,2+Math.random()*2.6,d.z*sp+(Math.random()-.5)*2),new T.Vector3((Math.random()-.5)*14,0,(Math.random()-.5)*14),D.r);
  grp.scale.setScalar(.001);g.cut[part]=1;if(GORE_P[part+'lo'])g.cut[part+'lo']=1;                             // від плеча / стегна — разом із нижньою частиною
  const st=new T.Mesh(R.goreCapG,R.goreCap);st.scale.setScalar(D.r*.85);st.position.copy(grp.position);st.userData.gore=1;D.par(m).add(st);   // кукса
  goreSpray(c,d,part==='head'?1.5:1);goreSnd(c,false);
  try{bloodDecal(c.x+d.x*.4,c.z+d.z*.4,part==='head'?.42:.3,true);}catch(e){}
  GORE.stat.cut++;return true;
}
/* тіло на шматки */
function goreGib(b,at,dir,big){
  const m=b.m;if(!m||b.gib)return;const T=SALT.G.THREE,g=b.gore||(b.gore={cut:{},tor:0});b.gib=true;
  m.g.updateMatrixWorld(true);const o=at||b.pos;let made=0;
  for(const q of GORE_G){if(g.cut[q[0]])continue;const grp=q[1](m);if(!grp)continue;const c=new T.Vector3();grp.getWorldPosition(c);
    if(q[0]==='head')c.y+=.06;
    let geos=[];try{geos=goreGeos(m,grp,q[2],!!q[3],c);}catch(e){geos=[];}if(!geos.length)continue;
    let dx=c.x-o.x,dz=c.z-o.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const sp=(big?6:3.5)+Math.random()*(big?6:3.5);
    gorePart(geos,c,new T.Vector3(dx*sp+(dir?dir.x*2:0)+(Math.random()-.5)*2.4,(big?4:2.4)+Math.random()*(big?5:3),dz*sp+(dir?dir.z*2:0)+(Math.random()-.5)*2.4),new T.Vector3((Math.random()-.5)*18,0,(Math.random()-.5)*18),q[4]);made++;}
  if(m.rifle&&m.rifle.visible)try{goreDrop(m,o);}catch(e){}
  m.g.visible=false;
  const c0=new T.Vector3(b.pos.x,b.pos.y+.35,b.pos.z);goreSpray(c0,dir,big?2.2:1.7);goreSnd(c0,true);
  try{bloodDecal(b.pos.x,b.pos.z,.7,true);for(let i=0;i<4;i++){const a=Math.random()*6.283,r=.8+Math.random()*1.8;bloodDecal(b.pos.x+Math.cos(a)*r,b.pos.z+Math.sin(a)*r,.18+Math.random()*.2,false);}}catch(e){}
  GORE.stat.gib++;GORE.made=(GORE.made||0)+made;
}
/* автомат падає окремо */
function goreDrop(m,at){
  const T=SALT.G.THREE,r=m.rifle;r.updateMatrixWorld(true);const c=new T.Vector3();r.getWorldPosition(c);const geos=goreMeshGeo(r,true,c);if(!geos.length)return;
  const grp=new T.Group();grp.position.copy(c);for(const q of geos){const a=new T.Mesh(q.geo,q.mat);a.castShadow=true;grp.add(a);}grp.userData.noMerge=true;SALT.G.scene.add(grp);r.visible=false;
  GORE.parts.push({o:grp,geos:geos});if(typeof gravAdd==='function')gravAdd(grp,{v:new T.Vector3((c.x-at.x)*2,2.5,(c.z-at.z)*2),r:.05,k:.3,w:new T.Vector3((Math.random()-.5)*8,0,(Math.random()-.5)*8),life:40});
}
/* влучання в тіло: куди саме — за капсулами кісток у поточній позі */
const _gv={};
function goreSegs(b){
  const m=b.m,g=b.gore||{cut:{}},T=SALT.G.THREE,V=n=>_gv[n]||(_gv[n]=new T.Vector3()),wp=(o,n)=>o.getWorldPosition(V(n)),S=[];
  if(!g.cut.head){const h=wp(m.head,'h'),h2=m.head.localToWorld(V('h2').set(0,.17,.03));S.push({p:'head',a:h,b:h2,r:.12});}
  S.push({p:'torso',a:wp(m.hips,'hp'),b:wp(m.neck,'nk'),r:.17});
  for(const sd of ['L','R']){const A=m['arm'+sd],Lg=m['leg'+sd];
    if(!g.cut['arm'+sd]){S.push({p:'arm'+sd,a:wp(A.up,'au'+sd),b:wp(A.lo,'al'+sd),r:.065});if(!g.cut['arm'+sd+'lo'])S.push({p:'arm'+sd+'lo',a:V('al'+sd),b:A.hand?wp(A.hand,'ah'+sd):V('al'+sd),r:.055});}
    if(!g.cut['leg'+sd]){S.push({p:'leg'+sd,a:wp(Lg.th,'lt'+sd),b:wp(Lg.sh,'ls'+sd),r:.09});if(!g.cut['leg'+sd+'lo'])S.push({p:'leg'+sd+'lo',a:V('ls'+sd),b:wp(Lg.ft,'lf'+sd),r:.07});}}
  return S;
}
function goreCapsule(o,d,a,b,r,lim){
  const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,wx=o.x-a.x,wy=o.y-a.y,wz=o.z-a.z,A=d.x*d.x+d.y*d.y+d.z*d.z,B=d.x*ux+d.y*uy+d.z*uz,C=ux*ux+uy*uy+uz*uz,Dd=d.x*wx+d.y*wy+d.z*wz,E=ux*wx+uy*wy+uz*wz,den=A*C-B*B;
  let s=den>1e-9?(A*E-B*Dd)/den:0;s=s<0?0:s>1?1:s;
  const px=a.x+ux*s,py=a.y+uy*s,pz=a.z+uz*s,t=((px-o.x)*d.x+(py-o.y)*d.y+(pz-o.z)*d.z)/(A||1);if(t<0||t>lim)return -1;
  const qx=o.x+d.x*t-px,qy=o.y+d.y*t-py,qz=o.z+d.z*t-pz,dd=qx*qx+qy*qy+qz*qz;if(dd>r*r)return -1;return Math.max(0,t-Math.sqrt(r*r-dd));
}
function goreRay(o,d,lim){
  let best=null;
  for(const b of LIFE.bots){if(b.alive||b.side!=='enemy'||b.gib||!b.m||!b.m.g||!b.m.g.visible||!b.m.legL||b.dead>24)continue;
    const dx=b.pos.x-o.x,dz=b.pos.z-o.z;if(dx*dx+dz*dz>(lim+2.5)*(lim+2.5))continue;
    b.m.g.updateMatrixWorld(true);
    for(const s of goreSegs(b)){const t=goreCapsule(o,d,s.a,s.b,s.r,lim);if(t>=0&&t<lim){lim=t;best={b:b,t:t,p:s.p};}}}
  return best;
}
function goreHit(b,part,a,pt,dir){
  const g=b.gore||(b.gore={cut:{},tor:0});GORE.stat.hit++;
  const cat=part==='head'?'head':part==='torso'?'torso':part.charAt(0)==='a'?'arm':'leg';
  try{bloodHit(b,pt,dir,cat);}catch(e){}
  if(part==='torso'){g.tor++;if(g.tor>=3||a>=55)goreGib(b,pt,dir,false);return;}
  if(!goreCut(b,part,dir,pt)){g.tor++;if(g.tor>=3)goreGib(b,pt,dir,false);}
}
/* вибух: близько — на шматки, далі — відриває одну-дві частини (і тих, кого цей самий вибух щойно вбив) */
function goreBlast(at,rad,dmg){
  if(SALT_FEAT.gore===false||!rad||typeof LIFE==='undefined')return;const T=SALT.G.THREE;
  for(const b of LIFE.bots){if(b.alive||b.side!=='enemy'||b.gib||!b.m||!b.m.legL||!b.m.g||!b.m.g.visible||b.dead>24)continue;const d=Math.hypot(b.pos.x-at.x,b.pos.z-at.z);if(d>rad)continue;
    GORE.stat.blast++;const dir=new T.Vector3(b.pos.x-at.x,0,b.pos.z-at.z).normalize();
    if(d<rad*.6||(dmg||0)>=180&&d<rad*.8)goreGib(b,at,dir,true);
    else{const L=['armL','armR','legL','legR','head','armLlo','armRlo','legLlo','legRlo'],n=1+(Math.random()<.5?1:0);for(let i=0;i<n;i++)goreCut(b,L[(Math.random()*L.length)|0],dir,null);}}
}
function goreInit(G){
  if(GORE.init)return;GORE.init=true;
  try{const ps=G.combat.playerShot;G.combat.playerShot=function(){GORE.shot=true;try{return ps.apply(this,arguments);}finally{GORE.shot=false;}};}catch(e){}
  const er=G.enemies.raycast.bind(G.enemies);
  G.enemies.raycast=(o,d,max)=>{const hit=er(o,d,max);if(!GORE.shot||SALT_FEAT.gore===false)return hit;
    try{const lim=hit?hit.dist:(max||300),q=goreRay(o,d,lim);if(q){const b=q.b,part=q.p,pt=new G.THREE.Vector3(o.x+d.x*q.t,o.y+d.y*q.t,o.z+d.z*q.t);
        return {enemy:{alive:true,pos:b.pos,type:'corpse',damage(a,p2,dir){try{goreHit(b,part,a,p2||pt,dir||d);}catch(e){saltFeatFail('gore',e);}return false;}},point:pt,dist:q.t,part:'body',normal:d.clone().negate()};}}
    catch(e){saltFeatFail('gore',e);}return hit;};
  if(typeof saltBlast==='function'){const o=saltBlast;saltBlast=function(at,rad){const r=o.apply(this,arguments);try{goreBlast(at,rad,arguments[2]);}catch(e){saltFeatFail('gore',e);}return r;};}
}
function goreStep(G,dt){if(SALT_FEAT.gore===false)return;goreInit(G);if((GORE.tT=(GORE.tT||0)-dt)<=0){GORE.tT=2;goreTrim();}}
