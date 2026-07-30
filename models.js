/* myFPV — MODELS
   Геометрія будується один раз і шариться між усіма інстансами.
   Кожна модель = 1 LineSegments (злиті EdgesGeometry) + опційно 1 тіньовий Mesh.
   EdgesGeometry замість wireframe:true — немає діагоналей по квадах, чистий силует.
   Анімовані частини (пропи, башта, кінцівки) — окремі об'єкти в parts.
*/
(function(){
'use strict';

const GEO={}, MAT={};

function cache(k,fn){ if(!GEO[k])GEO[k]=fn(); return GEO[k]; }

function lineMat(color,opacity){
  const k='L'+color+'|'+(opacity==null?1:opacity);
  if(!MAT[k])MAT[k]=new THREE.LineBasicMaterial({color:color,transparent:opacity!=null&&opacity<1,opacity:opacity==null?1:opacity});
  return MAT[k];
}
function fillMat(color,opacity){
  const k='F'+color+'|'+(opacity==null?.9:opacity);
  if(!MAT[k]){
    const m=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:opacity==null?.9:opacity,side:THREE.DoubleSide,depthWrite:true});
    m.polygonOffset=true;m.polygonOffsetFactor=1.6;m.polygonOffsetUnits=1.6;
    MAT[k]=m;
  }
  return MAT[k];
}

function mergePos(geos){
  let n=0;const arrs=[];
  for(const g of geos){
    const gg=g.index?g.toNonIndexed():g;
    const a=gg.attributes.position.array;arrs.push(a);n+=a.length;
  }
  const out=new Float32Array(n);let o=0;
  for(const a of arrs){out.set(a,o);o+=a.length;}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  return g;
}

function T(x,y,z,rx,ry,rz){
  const m=new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx||0,ry||0,rz||0));
  m.setPosition(x||0,y||0,z||0);
  return m;
}

/* пласка деталь: контур у площині XZ, товщина по Y */
function plate(pts,thick){
  const s=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1])));
  const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:false,curveSegments:4});
  g.rotateX(-Math.PI/2);g.translate(0,-thick/2,0);
  return g;
}
/* профіль збоку: pts=[вперед,вгору], екструзія на ширину. Ніс у +Z */
function sideProfile(pts,width){
  const s=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1])));
  const g=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:false,curveSegments:4});
  g.translate(0,0,-width/2);g.rotateY(-Math.PI/2);
  return g;
}

function Rig(){this.e=[];this.f=[];}
Rig.prototype.add=function(geo,m,thresh,noFill){
  const g=m?geo.clone().applyMatrix4(m):geo;
  this.e.push(new THREE.EdgesGeometry(g,thresh==null?1:thresh));
  if(!noFill)this.f.push(g.index?g.toNonIndexed():g);
  return this;
};
Rig.prototype.bake=function(){
  return {e:this.e.length?mergePos(this.e):null,f:this.f.length?mergePos(this.f):null};
};

function build(baked,edgeColor,edgeOpacity,fillColor,fillOpacity){
  const g=new THREE.Group();
  if(baked.f&&fillColor!=null)g.add(new THREE.Mesh(baked.f,fillMat(fillColor,fillOpacity)));
  if(baked.e)g.add(new THREE.LineSegments(baked.e,lineMat(edgeColor,edgeOpacity)));
  return g;
}

const CYL=30, SPH=44; // порогові кути: приховують поздовжні лінії на тілах обертання

/* ───────────────────────── КВАДРОКОПТЕР 5" ───────────────────────── */
const MOT=0.58, PROP_R=0.36;

function propBaked(blades){
  return cache('prop'+blades,function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.034,.028,.036,10),T(0,0,0),CYL);
    const blade=[[.045,-.020],[.13,-.058],[.26,-.050],[.34,-.016],[.345,.010],[.25,.048],[.12,.058],[.045,.026]];
    for(let i=0;i<blades;i++){
      const g=plate(blade,.007);
      g.rotateX(.24);                       // крок лопаті
      g.applyMatrix4(T(0,0,0,0,i*Math.PI*2/blades,0));
      r.add(g,null,1);
    }
    return r.bake();
  });
}

function quadBaked(){
  return cache('quad',function(){
    const r=new Rig();
    // нижня плита рами
    r.add(new THREE.BoxGeometry(.40,.028,.46),T(0,0,0));
    // 4 плеча зі звуженням
    const arm=[[.12,-.060],[.665,-.034],[.665,.034],[.12,.060]];
    for(let i=0;i<4;i++)r.add(plate(arm,.028),T(0,0,0,0,Math.PI/4+i*Math.PI/2,0));
    // стійки стека
    [[-.14,.20],[.14,.20],[-.14,-.20],[.14,-.20]].forEach(p=>
      r.add(new THREE.CylinderGeometry(.018,.018,.20,8),T(p[0],.10,p[1]),CYL));
    // плати: ESC + FC
    r.add(new THREE.BoxGeometry(.28,.022,.30),T(0,.062,0));
    r.add(new THREE.BoxGeometry(.25,.020,.26),T(0,.135,0));
    // верхня плита
    r.add(new THREE.BoxGeometry(.36,.026,.44),T(0,.205,0));
    // акумулятор + стяжка
    r.add(new THREE.BoxGeometry(.26,.100,.42),T(0,.268,-.02));
    r.add(new THREE.BoxGeometry(.29,.012,.05),T(0,.268,.10));
    r.add(new THREE.BoxGeometry(.29,.012,.05),T(0,.268,-.15));
    // мотори: колокол + статор + вал
    for(let i=0;i<4;i++){
      const sx=(i&1)?MOT:-MOT, sz=(i&2)?MOT:-MOT;
      r.add(new THREE.CylinderGeometry(.086,.086,.088,16),T(sx,.075,sz),CYL);
      r.add(new THREE.CylinderGeometry(.060,.060,.055,12),T(sx,.012,sz),CYL);
      r.add(new THREE.CylinderGeometry(.014,.014,.05,8),T(sx,.14,sz),CYL);
      // лапа
      r.add(new THREE.CylinderGeometry(.012,.012,.13,6),T(sx*.92,-.065,sz*.92),CYL);
    }
    // камера у рамці, нахил 22°
    r.add(new THREE.BoxGeometry(.15,.15,.10),T(0,.16,.235,-.38,0,0));
    r.add(new THREE.CylinderGeometry(.048,.052,.075,14),T(0,.185,.30,Math.PI/2-.38,0,0),CYL);
    r.add(new THREE.BoxGeometry(.035,.11,.035),T(-.095,.145,.235));
    r.add(new THREE.BoxGeometry(.035,.11,.035),T(.095,.145,.235));
    // антена VTX
    r.add(new THREE.CylinderGeometry(.012,.009,.42,6),T(0,.39,-.30,-.62,0,0),CYL);
    r.add(new THREE.CylinderGeometry(.023,.023,.06,8),T(0,.561,-.422,-.62,0,0),CYL);
    return r.bake();
  });
}

function payloadBaked(){
  return cache('payload',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.105,.105,.34,14),T(0,0,.02,Math.PI/2,0,0),CYL);
    r.add(new THREE.CylinderGeometry(.105,.045,.16,14),T(0,0,.27,Math.PI/2,0,0),CYL);
    r.add(new THREE.CylinderGeometry(.022,.022,.10,8),T(0,0,.40,Math.PI/2,0,0),CYL);
    for(let i=0;i<4;i++)
      r.add(new THREE.BoxGeometry(.010,.13,.16),T(0,0,-.16,0,i*Math.PI/2,0).multiply(T(0,.09,0)));
    return r.bake();
  });
}

function makeQuad(o){
  o=o||{};
  const col=o.color==null?0x00ff55:o.color;
  const fill=o.fill==null?0x00220f:o.fill;
  const g=new THREE.Group(), parts={props:[]};
  const body=build(quadBaked(),col,o.opacity==null?1:o.opacity,fill,.88);
  body.name='frame';g.add(body);
  const pb=propBaked(o.blades||3);
  for(let i=0;i<4;i++){
    const sx=(i&1)?MOT:-MOT, sz=(i&2)?MOT:-MOT;
    const p=build(pb,col,.85,null);
    p.name='prop'+i;p.position.set(sx,.155,sz);
    g.add(p);parts.props.push(p);
  }
  if(o.payload){
    const pay=build(payloadBaked(),col,1,fill,.9);
    pay.name='payload';pay.position.set(0,-.20,0);
    g.add(pay);parts.payload=pay;
  }
  if(o.scale)g.scale.setScalar(o.scale);
  return {group:g,parts:parts};
}

/* ───────────────────────── ПІХОТИНЕЦЬ ───────────────────────── */
function soldierBaked(){
  return cache('sol',function(){
    const r=new Rig();
    // корпус одним об'ємом: вузька талія -> широка броня на грудях
    r.add(sideProfile([[-.12,-.20],[.10,-.20],[.125,.16],[.125,.31],[-.135,.31],[-.125,.06]],.36),T(0,.06,0));
    r.add(new THREE.BoxGeometry(.44,.14,.24),T(0,.325,0));                    // плечі / розвантаження
    r.add(new THREE.BoxGeometry(.175,.165,.185),T(0,.465,.015));              // голова
    r.add(new THREE.SphereGeometry(.132,14,8,0,Math.PI*2,0,Math.PI*.52),T(0,.505,0),SPH); // шолом
    r.add(new THREE.BoxGeometry(.28,.32,.145),T(0,.16,-.20));                 // рюкзак
    // автомат навскіс по груді
    const RIF=T(.15,.12,.10,0,-.30,.16);
    r.add(new THREE.BoxGeometry(.05,.095,.32),RIF.clone());
    r.add(new THREE.CylinderGeometry(.013,.013,.22,6),RIF.clone().multiply(T(0,.03,.27,Math.PI/2,0,0)),CYL);
    r.add(new THREE.BoxGeometry(.045,.135,.065),RIF.clone().multiply(T(0,-.085,.02)));
    return r.bake();
  });
}
function thighBaked(){
  return cache('thigh',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.132,.42,.148),T(0,-.21,0));
    r.add(new THREE.BoxGeometry(.116,.09,.132),T(0,-.425,.004));   // коліно
    return r.bake();
  });
}
function shinBaked(){
  return cache('shin',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.108,.38,.128),T(0,-.19,.004));
    r.add(new THREE.BoxGeometry(.128,.085,.215),T(0,-.422,.042));   // ступня
    return r.bake();
  });
}
function upArmBaked(){
  return cache('uparm',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.115,.33,.125),T(0,-.165,0));
    r.add(new THREE.BoxGeometry(.102,.08,.112),T(0,-.335,.006));    // лікоть
    return r.bake();
  });
}
function foreArmBaked(){
  return cache('forearm',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.10,.30,.11),T(0,-.15,.006));
    r.add(new THREE.BoxGeometry(.085,.09,.115),T(0,-.335,.016));    // кисть
    return r.bake();
  });
}
/* кінцівка з суглобом: root обертається в стегні/плечі, joint — у коліні/лікті */
function limb(colBaked,jointBaked,col,jointY){
  const root=build(colBaked,col,.95,null);
  const joint=build(jointBaked,col,.95,null);
  joint.position.y=jointY;
  root.add(joint);
  root.joint=joint;
  return root;
}
function soldierFarBaked(){
  return cache('solFar',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.40,.60,.26),T(0,.14,0));
    r.add(new THREE.BoxGeometry(.17,.30,.19),T(0,.56,0));
    r.add(new THREE.BoxGeometry(.145,.86,.17),T(-.10,-.50,.04));
    r.add(new THREE.BoxGeometry(.145,.86,.17),T(.10,-.50,-.04));
    r.add(new THREE.CylinderGeometry(.02,.02,.55,4),T(.16,.16,.20,Math.PI/2,0,0),CYL);
    return r.bake();
  });
}

function manpadsBaked(){
  return cache('manpads',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.105,.105,1.62,10,1,true),T(0,0,.34,Math.PI/2,0,0),CYL);
    r.add(new THREE.TorusGeometry(.105,.022,4,10),T(0,0,1.15),CYL,true);
    r.add(new THREE.CylinderGeometry(.125,.105,.30,10),T(0,0,-.62,Math.PI/2,0,0),CYL);
    r.add(new THREE.BoxGeometry(.10,.20,.22),T(0,-.16,.10));        // рукоятка
    r.add(new THREE.BoxGeometry(.09,.14,.26),T(.10,.09,.30));       // приціл
    return r.bake();
  });
}
function makeSoldier(color,kind){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group(), parts={};
  const near=new THREE.Group();near.name='near';
  const torso=build(soldierBaked(),col,.95,0x220400,.82);
  near.add(torso);
  parts.torso=torso;
  const th=thighBaked(), sh=shinBaked(), ua=upArmBaked(), fa=foreArmBaked();
  parts.legL=limb(th,sh,col,-.425);parts.legL.position.set(-.092,-.115,0);
  parts.legR=limb(th,sh,col,-.425);parts.legR.position.set( .092,-.115,0);
  parts.armL=limb(ua,fa,col,-.335);parts.armL.position.set(-.250,.325,0);parts.armL.rotation.z=.11;
  parts.armR=limb(ua,fa,col,-.335);parts.armR.position.set( .250,.325,0);parts.armR.rotation.z=-.11;
  near.add(parts.legL,parts.legR,parts.armL,parts.armR);
  if(kind==='manpads'){
    const tube=build(manpadsBaked(),col,.95,null);
    tube.position.set(.20,.40,0);tube.rotation.x=-.22;
    near.add(tube);parts.tube=tube;
  }
  const far=build(soldierFarBaked(),col,.9,null);far.name='far';far.visible=false;
  g.add(near,far);
  parts.near=near;parts.far=far;
  return {group:g,parts:parts};
}

/* ───────────────────────── ТАНК ───────────────────────── */
function tankHullBaked(){
  return cache('tankHull',function(){
    const r=new Rig();
    // корпус: нахилена лобова, борти
    r.add(sideProfile([[-3.85,-.10],[-3.85,.80],[-1.30,.98],[1.30,.98],[3.90,.30],[3.90,-.10]],3.05),T(0,0,0));
    // надгусеничні полиці
    r.add(new THREE.BoxGeometry(.42,.14,7.2),T(-1.72,.72,-.10));
    r.add(new THREE.BoxGeometry(.42,.14,7.2),T( 1.72,.72,-.10));
    // гусеничні полотна
    [-1.68,1.68].forEach(sx=>{
      r.add(sideProfile([[-3.55,-.62],[-3.95,-.10],[-3.95,.30],[3.95,.30],[3.95,-.10],[3.55,-.62]],.50),T(sx,0,0));
      // опорні котки
      for(let i=0;i<6;i++)
        r.add(new THREE.CylinderGeometry(.46,.46,.30,12),T(sx,-.30,-2.75+i*1.10,0,0,Math.PI/2),CYL);
      // ведуче колесо / направляюче
      r.add(new THREE.CylinderGeometry(.40,.40,.32,12),T(sx,-.18,-3.55,0,0,Math.PI/2),CYL);
      r.add(new THREE.CylinderGeometry(.40,.40,.32,12),T(sx,-.18, 3.55,0,0,Math.PI/2),CYL);
      // підтримуючі ролики
      for(let i=0;i<3;i++)
        r.add(new THREE.CylinderGeometry(.16,.16,.22,8),T(sx,.42,-1.6+i*1.7,0,0,Math.PI/2),CYL);
    });
    // бочки на кормі
    r.add(new THREE.CylinderGeometry(.34,.34,.86,14),T(-.80,.55,-4.15,0,0,Math.PI/2),CYL);
    r.add(new THREE.CylinderGeometry(.34,.34,.86,14),T( .80,.55,-4.15,0,0,Math.PI/2),CYL);
    // ящики ЗІП
    r.add(new THREE.BoxGeometry(.55,.42,1.30),T(-1.72,1.00,-2.10));
    r.add(new THREE.BoxGeometry(.55,.42,.90),T( 1.72,1.00,-2.30));
    return r.bake();
  });
}
function tankTurretBaked(){
  return cache('tankTur',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(1.14,1.48,.66,14),T(0,.33,0),20);        // литий погон
    r.add(sideProfile([[-.10,0],[1.55,.06],[1.62,.34],[-.10,.40]],1.90),T(0,.62,.55)); // лобова маска
    r.add(new THREE.BoxGeometry(1.60,.44,.72),T(0,.42,-1.42));                // кормова ніша
    r.add(new THREE.CylinderGeometry(.36,.36,.24,12),T(-.44,.76,-.28),CYL);   // люк
    r.add(new THREE.CylinderGeometry(.30,.30,.20,12),T( .50,.74,-.30),CYL);
    r.add(new THREE.BoxGeometry(.22,.16,.60),T(.50,.92,.10));                 // кулемет
    r.add(new THREE.CylinderGeometry(.055,.055,.55,6),T(.50,.99,.55,Math.PI/2,0,0),CYL);
    // блоки димових гранат
    for(let s=0;s<2;s++)for(let i=0;i<4;i++)
      r.add(new THREE.CylinderGeometry(.085,.085,.30,8),T((s?1:-1)*(1.02),.50,.30-i*.22,Math.PI/2,0,.25),CYL);
    // антени
    r.add(new THREE.CylinderGeometry(.022,.010,1.70,5),T(-1.05,1.30,-1.20,-.12,0,.10),CYL);
    r.add(new THREE.CylinderGeometry(.022,.010,1.40,5),T( 1.05,1.15,-1.25,-.12,0,-.10),CYL);
    return r.bake();
  });
}
function tankBarrelBaked(){
  return cache('tankBar',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.145,.130,4.70,10),T(0,0,2.30,Math.PI/2,0,0),CYL);
    r.add(new THREE.CylinderGeometry(.225,.225,2.10,10),T(0,0,1.30,Math.PI/2,0,0),CYL); // теплозахисний кожух
    r.add(new THREE.CylinderGeometry(.215,.215,.52,10),T(0,0,4.45,Math.PI/2,0,0),CYL);  // дульне гальмо
    r.add(new THREE.TorusGeometry(.148,.022,4,10),T(0,0,3.90),CYL,true);
    r.add(new THREE.TorusGeometry(.228,.024,4,10),T(0,0,2.34),CYL,true);
    r.add(new THREE.BoxGeometry(.06,.30,.36),T(0,0,4.45));
    return r.bake();
  });
}

function makeTank(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group(), parts={};
  g.add(build(tankHullBaked(),col,.95,0x200500,.85));
  const tur=build(tankTurretBaked(),col,.95,0x200500,.85);
  tur.position.set(0,.98,-.35);
  const bar=build(tankBarrelBaked(),col,.95,0x200500,.85);
  bar.position.set(0,.62,1.05);
  tur.add(bar);g.add(tur);
  parts.turret=tur;parts.barrel=bar;
  return {group:g,parts:parts};
}

/* ───────────────────────── КРИЛО (fixed-wing) ───────────────────────── */
function wingBaked(){
  return cache('wing',function(){
    const r=new Rig();
    // планформа: стріловидне літаюче крило (y = -вперед)
    const pl=[[0,-1.10],[1.60,.38],[1.52,.64],[0,.64],[-1.52,.64],[-1.60,.38]];
    r.add(plate(pl,.070),T(0,0,0));
    // фюзеляж: вузький, по центру товщини крила
    r.add(sideProfile([[-.90,-.11],[.62,-.12],[.90,-.02],[.90,.07],[.60,.15],[-.90,.13]],.22),T(0,0,0));
    r.add(new THREE.CylinderGeometry(.105,.055,.34,10),T(0,-.01,1.02,Math.PI/2,0,0),CYL);
    r.add(new THREE.SphereGeometry(.062,10,8),T(0,-.02,1.16),SPH);
    r.add(new THREE.BoxGeometry(.20,.07,.46),T(0,.15,-.26));      // горб під двигун
    // кілі на кінцях крила: вертикальні, по хорді законцівки
    [-1.50,1.50].forEach(sx=>{
      r.add(new THREE.BoxGeometry(.028,.40,.30),T(sx,.235,-.48));
      r.add(new THREE.BoxGeometry(.028,.13,.20),T(sx,.47,-.53));
    });
    // мотогондола (штовхаючий)
    r.add(new THREE.CylinderGeometry(.10,.085,.30,10),T(0,.02,-1.06,Math.PI/2,0,0),CYL);
    return r.bake();
  });
}
function makeWing(o){
  o=o||{};
  const col=o.color==null?0xff1400:o.color;
  const g=new THREE.Group(), parts={};
  g.add(build(wingBaked(),col,.95,0x200500,.8));
  const p=build(propBaked(2),col,.8,null);
  p.position.set(0,.02,-1.24);p.rotation.x=Math.PI/2;p.scale.setScalar(.78);
  g.add(p);parts.props=[p];
  if(o.scale)g.scale.setScalar(o.scale);
  return {group:g,parts:parts};
}

/* ───────────────────────── ЦИВІЛЬНИЙ ТРАНСПОРТ ───────────────────────── */
const CAR_PROFILES={
  sedan:{pts:[[-2.15,-.32],[-2.15,.08],[-1.70,.12],[-1.42,.54],[-.50,.70],[.52,.70],[1.26,.34],[1.98,.28],[2.15,.08],[2.15,-.32]],w:1.76,wh:.33,ax:[1.42,-1.40]},
  van:{pts:[[-2.55,-.34],[-2.55,.90],[-1.10,1.02],[1.30,1.02],[1.95,.52],[2.35,.34],[2.55,.06],[2.55,-.34]],w:1.92,wh:.36,ax:[1.70,-1.68]},
  truck:{pts:[[-2.90,-.30],[-2.90,1.44],[-1.05,1.56],[1.06,1.56],[1.52,.98],[2.20,.72],[2.58,.34],[2.58,-.30]],w:2.06,wh:.40,ax:[1.72,-1.78],amb:1}
};
function carBaked(v){
  return cache('car'+v,function(){
    const P=CAR_PROFILES[v], r=new Rig();
    r.add(sideProfile(P.pts,P.w),T(0,0,0));
    const hx=P.w/2-.06;
    [[hx,P.ax[0]],[-hx,P.ax[0]],[hx,P.ax[1]],[-hx,P.ax[1]]].forEach(p=>
      r.add(new THREE.CylinderGeometry(P.wh,P.wh,.24,12),T(p[0],-.28,p[1],0,0,Math.PI/2),CYL,true));
    if(P.amb){                                   // Евак: маячок + хрест + вікна
      r.add(new THREE.BoxGeometry(1.10,.14,.30),T(0,1.63,.55));
      r.add(new THREE.BoxGeometry(.26,.16,.24),T(-.42,1.72,.55));
      r.add(new THREE.BoxGeometry(.26,.16,.24),T( .42,1.72,.55));
      r.add(new THREE.BoxGeometry(.05,.13,.62),T(P.w/2-.02,.98,-.60));
      r.add(new THREE.BoxGeometry(.05,.62,.13),T(P.w/2-.02,.98,-.60));
      r.add(new THREE.BoxGeometry(.05,.13,.62),T(-P.w/2+.02,.98,-.60));
      r.add(new THREE.BoxGeometry(.05,.62,.13),T(-P.w/2+.02,.98,-.60));
      r.add(new THREE.BoxGeometry(1.62,.46,.05),T(0,1.08,1.02));
      r.add(new THREE.BoxGeometry(.05,.44,1.30),T(P.w/2-.03,1.08,.18));
      r.add(new THREE.BoxGeometry(.05,.44,1.30),T(-P.w/2+.03,1.08,.18));
    }
    return r.bake();
  });
}
function lampBaked(){
  return cache('lamp',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.22,.16,.07),T(0,0,0));
    return r.bake();
  });
}
function makeCar(v,color){
  const g=new THREE.Group();
  g.add(build(carBaked(v||'sedan'),color==null?0xffaa00:color,.9,null));
  const P=CAR_PROFILES[v||'sedan'], lm=lampBaked();
  [-.52,.52].forEach(sx=>{
    const l=build(lm,0xffffcc,.9,null);
    l.position.set(sx,0,P.pts[P.pts.length-1][0]-.02);g.add(l);
  });
  return {group:g,parts:{}};
}

/* ───────────────────────── ШАСІ-ХЕЛПЕРИ (y=0 — земля) ───────────────────────── */
function tracks(r,sx,halfLen,top,botR,n){
  for(let s=0;s<2;s++){
    const x=s?sx:-sx;
    r.add(sideProfile([[-halfLen+.40,botR*.30],[-halfLen,top*.55],[-halfLen,top],[halfLen,top],[halfLen,top*.55],[halfLen-.40,botR*.30]],.52),T(x,0,0));
    const step=(halfLen*2-1.3)/(n-1);
    for(let i=0;i<n;i++)
      r.add(new THREE.CylinderGeometry(botR,botR,.30,12),T(x,botR,-halfLen+.65+i*step,0,0,Math.PI/2),CYL);
  }
}
function addTruckBase(r,halfLen,wid,axles,wr){
  const hw=wid/2, R=wr||.56;
  r.add(sideProfile([[-halfLen,R+.06],[-halfLen,R+.46],[halfLen,R+.46],[halfLen,R+.06]],wid*.90),T(0,0,0));
  r.add(sideProfile([[halfLen-2.05,R+.46],[halfLen-2.00,R+2.16],[halfLen-.55,R+2.24],[halfLen-.10,R+1.54],[halfLen,R+1.04],[halfLen,R+.46]],wid*.98),T(0,0,0));
  r.add(new THREE.BoxGeometry(wid*.80,.58,.09),T(0,R+1.80,halfLen-.58));
  for(let i=0;i<axles.length;i++){
    r.add(new THREE.CylinderGeometry(R,R,.36,12),T(-hw+.15,R,axles[i],0,0,Math.PI/2),CYL,true);
    r.add(new THREE.CylinderGeometry(R,R,.36,12),T( hw-.15,R,axles[i],0,0,Math.PI/2),CYL,true);
  }
}

/* ───────────────────────── РАКЕТА ───────────────────────── */
function missileBaked(){
  return cache('msl',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.20,.20,3.40,10),T(0,0,0,Math.PI/2,0,0),CYL);
    // носовий обтікач: конус + оживальна вставка
    r.add(new THREE.CylinderGeometry(.20,.135,.46,10),T(0,0,1.93,Math.PI/2,0,0),CYL);
    r.add(new THREE.ConeGeometry(.135,.72,10),T(0,0,2.52,Math.PI/2,0,0),CYL);
    r.add(new THREE.SphereGeometry(.048,8,6),T(0,0,2.90),SPH);
    // реактивний двигун: сопло + камера
    r.add(new THREE.CylinderGeometry(.175,.175,.40,10),T(0,0,-1.88,Math.PI/2,0,0),CYL);
    r.add(new THREE.CylinderGeometry(.115,.205,.44,10),T(0,0,-2.28,Math.PI/2,0,0),CYL);
    r.add(new THREE.TorusGeometry(.20,.022,4,10),T(0,0,-2.48),CYL,true);
    for(let i=0;i<4;i++){
      r.add(new THREE.BoxGeometry(.030,.46,.62),T(0,0,0,0,0,i*Math.PI/2).multiply(T(0,.44,-1.38)));
      r.add(new THREE.BoxGeometry(.026,.28,.40),T(0,0,0,0,0,i*Math.PI/2+Math.PI/4).multiply(T(0,.32,.58)));
    }
    return r.bake();
  });
}
function makeMissile(color){
  return {group:build(missileBaked(),color==null?0xffcc44:color,1,null),parts:{}};
}

/* ───────────────────────── ЗРК НА ГУСЕНИЦЯХ ───────────────────────── */
function samHullBaked(){
  return cache('samHull',function(){
    const r=new Rig();
    tracks(r,1.52,4.15,1.02,.42,6);
    r.add(sideProfile([[-4.05,.92],[-4.05,1.98],[-1.30,2.18],[2.00,2.18],[3.70,1.66],[4.10,.92]],2.86),T(0,0,0));
    r.add(new THREE.BoxGeometry(1.46,.54,1.05),T(0,2.44,2.42));
    r.add(new THREE.BoxGeometry(1.18,.34,.09),T(0,2.50,2.92));
    r.add(new THREE.CylinderGeometry(1.42,1.58,.30,16),T(0,2.30,-.40),20);
    r.add(new THREE.BoxGeometry(.50,.40,1.15),T(-1.62,2.36,-2.30));
    r.add(new THREE.CylinderGeometry(.022,.010,1.80,5),T(1.48,3.10,-2.55,-.10,0,.09),CYL);
    return r.bake();
  });
}
function samLauncherBaked(){
  return cache('samLau',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(2.80,.28,3.70),T(0,0,0));
    r.add(new THREE.BoxGeometry(2.62,.20,.28),T(0,.24,1.32));
    r.add(new THREE.BoxGeometry(2.62,.20,.28),T(0,.24,-1.28));
    r.add(new THREE.BoxGeometry(.52,.72,.52),T(0,-.48,-1.40));
    r.add(new THREE.BoxGeometry(.90,.60,.34),T(0,.30,1.95));
    // 4 пускові труби, ракети лежать у них
    [-1.04,-.35,.35,1.04].forEach(x=>{
      r.add(new THREE.CylinderGeometry(.29,.29,3.30,10,1,true),T(x,.44,.30,Math.PI/2,0,0),CYL);
      r.add(new THREE.TorusGeometry(.29,.035,4,10),T(x,.44,1.95,0,0,0),CYL,true);
      r.add(new THREE.TorusGeometry(.29,.035,4,10),T(x,.44,-1.35,0,0,0),CYL,true);
      r.add(new THREE.BoxGeometry(.06,.34,.30),T(x,.16,-.90));
    });
    return r.bake();
  });
}
function makeSam(color){
  const col=color==null?0xff2a00:color, fill=0x200500;
  const g=new THREE.Group(), parts={missiles:[]};
  g.add(build(samHullBaked(),col,.95,fill,.85));
  const yaw=new THREE.Group();yaw.position.set(0,2.44,-.40);g.add(yaw);
  const pitch=new THREE.Group();pitch.position.set(0,.24,-.25);yaw.add(pitch);
  pitch.add(build(samLauncherBaked(),col,.95,fill,.85));
  const mb=missileBaked();
  [-1.04,-.35,.35,1.04].forEach(x=>{
    const m=build(mb,0xffcc44,1,null);
    m.position.set(x,.44,.34);m.scale.setScalar(.90);
    pitch.add(m);parts.missiles.push(m);
  });
  parts.turret=yaw;parts.launcher=pitch;
  return {group:g,parts:parts};
}

/* ───────────────────────── ВАНТАЖІВКА З ПАКЕТОМ ТРУБ ───────────────────────── */
function samTruckBaked(){
  return cache('samTruck',function(){
    const r=new Rig();
    addTruckBase(r,4.50,2.48,[2.90,-1.85,-3.02],.58);
    r.add(new THREE.BoxGeometry(2.26,.24,4.60),T(0,1.16,-1.55));
    // рама-люлька в кормі
    r.add(new THREE.BoxGeometry(.22,1.30,.22),T(-1.06,1.90,-.10));
    r.add(new THREE.BoxGeometry(.22,1.30,.22),T( 1.06,1.90,-.10));
    for(let i=0;i<6;i++){
      const x=(i%3-1)*.80, z=-2.55+(((i/3)|0)*1.05);
      r.add(new THREE.CylinderGeometry(.36,.36,3.15,10),T(x,2.92,z,-.07,0,0),CYL);
      r.add(new THREE.TorusGeometry(.36,.035,4,10),T(x,4.45,z-.03,-.07,0,0),CYL,true);
    }
    r.add(new THREE.BoxGeometry(2.56,.20,.20),T(0,4.35,-2.05));
    r.add(new THREE.BoxGeometry(2.56,.20,.20),T(0,1.60,-2.15));
    r.add(new THREE.BoxGeometry(.44,.62,.44),T(1.18,1.60,1.40));
    return r.bake();
  });
}
function makeSamTruck(color){
  const col=color==null?0xff2a00:color;
  const g=build(samTruckBaked(),col,.95,0x200500,.85);
  return {group:g,parts:{}};
}

/* ───────────────────────── ЗУ-23: СПАРКА ───────────────────────── */
function zuMountBaked(){
  return cache('zuMount',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.34,.44,.34,12),T(0,0,0),CYL);
    r.add(new THREE.BoxGeometry(.70,.52,.60),T(0,.36,-.12));
    r.add(new THREE.BoxGeometry(.86,.66,.09),T(0,.62,.34));      // щиток
    r.add(new THREE.BoxGeometry(.34,.30,.34),T(0,.20,-.50));      // сидіння
    return r.bake();
  });
}
function zuBarrelsBaked(){
  return cache('zuBar',function(){
    const r=new Rig();
    for(let s=0;s<2;s++){
      const x=(s?1:-1)*.22;
      r.add(new THREE.CylinderGeometry(.075,.075,2.10,10),T(x,0,1.00,Math.PI/2,0,0),CYL);
      r.add(new THREE.CylinderGeometry(.105,.105,.52,10),T(x,0,2.00,Math.PI/2,0,0),CYL);
      r.add(new THREE.BoxGeometry(.19,.24,.62),T(x,0,-.24));
    }
    r.add(new THREE.BoxGeometry(.30,.44,.34),T(0,.02,-.52));
    return r.bake();
  });
}
function zuTurret(g,col,y,scale){
  const yaw=new THREE.Group();yaw.position.set(0,y,0);
  if(scale)yaw.scale.setScalar(scale);
  yaw.add(build(zuMountBaked(),col,.95,0x200500,.85));
  const pitch=new THREE.Group();pitch.position.set(0,.44,.10);
  pitch.add(build(zuBarrelsBaked(),col,.95,null));
  yaw.add(pitch);g.add(yaw);
  return {turret:yaw,barrels:pitch};
}
function zuCarriageBaked(){
  return cache('zuCar',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(1.70,.20,2.10),T(0,.56,0));
    r.add(new THREE.CylinderGeometry(.42,.42,.22,12),T(-.92,.42,.30,0,0,Math.PI/2),CYL,true);
    r.add(new THREE.CylinderGeometry(.42,.42,.22,12),T( .92,.42,.30,0,0,Math.PI/2),CYL,true);
    r.add(new THREE.BoxGeometry(.14,.14,1.80),T(0,.40,-1.85,-.10,0,0));
    r.add(new THREE.BoxGeometry(.12,.44,.12),T(-.62,.34,.95,.35,0,0));
    r.add(new THREE.BoxGeometry(.12,.44,.12),T( .62,.34,.95,.35,0,0));
    return r.bake();
  });
}
function makeZu(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group();
  g.add(build(zuCarriageBaked(),col,.95,0x200500,.85));
  const p=zuTurret(g,col,.68);
  return {group:g,parts:p};
}
function pickupBaked(){
  return cache('pickup',function(){
    const r=new Rig();
    r.add(sideProfile([[-2.60,.50],[-2.60,1.22],[-.35,1.22],[-.30,2.10],[.62,2.20],[1.42,1.60],[2.55,1.42],[2.62,.94],[2.62,.50]],2.02),T(0,0,0));
    r.add(new THREE.BoxGeometry(1.72,.50,.09),T(0,1.86,.30));
    r.add(new THREE.BoxGeometry(1.94,.44,.10),T(0,1.32,-2.52));
    [[-.90,1.55],[.90,1.55],[-.90,-1.62],[.90,-1.62]].forEach(p=>
      r.add(new THREE.CylinderGeometry(.46,.46,.30,12),T(p[0],.46,p[1],0,0,Math.PI/2),CYL,true));
    return r.bake();
  });
}
function makeZuPickup(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group();
  g.add(build(pickupBaked(),col,.95,0x200500,.85));
  const p=zuTurret(g,col,1.30,.86);
  p.turret.position.z=-1.35;
  return {group:g,parts:p};
}

/* ───────────────────────── РЛС ───────────────────────── */
function radarBodyBaked(){
  return cache('radarBody',function(){
    const r=new Rig();
    addTruckBase(r,4.10,2.44,[2.60,-1.70,-2.86],.56);
    r.add(new THREE.BoxGeometry(2.30,1.55,4.20),T(0,1.86,-1.10));
    r.add(new THREE.BoxGeometry(1.05,.30,.30),T(0,2.72,-3.05));
    for(let i=0;i<4;i++)
      r.add(new THREE.CylinderGeometry(.09,.09,1.05,6),T((i&1?1:-1)*.85,3.10,-1.10+(i&2?1:-1)*1.35),CYL);
    r.add(new THREE.BoxGeometry(2.10,.20,3.20),T(0,3.68,-1.10));
    return r.bake();
  });
}
function radarAntBaked(){
  return cache('radarAnt',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(3.60,2.05,.16),T(0,1.05,0,.22,0,0));
    for(let i=0;i<5;i++)r.add(new THREE.BoxGeometry(3.40,.07,.07),T(0,.30+i*.42,-.10,.22,0,0));
    r.add(new THREE.BoxGeometry(.22,.60,.22),T(0,.20,.18));
    r.add(new THREE.CylinderGeometry(.05,.05,1.10,6),T(0,1.15,.55,.22,0,0),CYL);
    return r.bake();
  });
}
function makeRadar(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group(), parts={};
  g.add(build(radarBodyBaked(),col,.95,0x200500,.85));
  const ant=build(radarAntBaked(),col,.95,null);
  ant.position.set(0,3.78,-1.10);
  g.add(ant);parts.antenna=ant;
  return {group:g,parts:parts};
}

/* ───────────────────────── БТР ───────────────────────── */
function apcHullBaked(){
  return cache('apcHull',function(){
    const r=new Rig();
    r.add(sideProfile([[-3.60,.58],[-3.60,1.62],[-3.10,2.00],[1.05,2.05],[2.55,1.90],[3.62,1.30],[3.62,.72]],2.72),T(0,0,0));
    r.add(new THREE.BoxGeometry(1.15,.40,.09),T(0,1.86,3.30));
    r.add(new THREE.BoxGeometry(.55,.34,.09),T(-.90,1.80,3.28,0,.30,0));
    [-2.55,-1.05,1.00,2.45].forEach(z=>{
      r.add(new THREE.CylinderGeometry(.62,.62,.34,12),T(-1.38,.62,z,0,0,Math.PI/2),CYL,true);
      r.add(new THREE.CylinderGeometry(.62,.62,.34,12),T( 1.38,.62,z,0,0,Math.PI/2),CYL,true);
    });
    r.add(new THREE.BoxGeometry(1.10,.90,.12),T(0,1.20,-3.62));  // кормові двері
    return r.bake();
  });
}
function apcTurretBaked(){
  return cache('apcTur',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(.62,.78,.62,14),T(0,.31,0),20);
    r.add(new THREE.BoxGeometry(.34,.30,.50),T(0,.42,.62));
    return r.bake();
  });
}
function makeApc(color){
  const col=color==null?0xff2a00:color, fill=0x200500;
  const g=new THREE.Group(), parts={};
  g.add(build(apcHullBaked(),col,.95,fill,.85));
  const yaw=new THREE.Group();yaw.position.set(0,2.02,.35);g.add(yaw);
  yaw.add(build(apcTurretBaked(),col,.95,fill,.85));
  const bar=new THREE.Group();bar.position.set(0,.42,.62);
  const rb=new Rig();
  rb.add(new THREE.CylinderGeometry(.055,.055,1.85,8),T(0,0,.90,Math.PI/2,0,0),CYL);
  rb.add(new THREE.CylinderGeometry(.030,.030,1.20,6),T(.16,-.06,.62,Math.PI/2,0,0),CYL);
  bar.add(build(rb.bake(),col,.95,null));
  yaw.add(bar);
  parts.turret=yaw;parts.barrel=bar;
  return {group:g,parts:parts};
}

/* ───────────────────────── САУ ───────────────────────── */
function artyHullBaked(){
  return cache('artyHull',function(){
    const r=new Rig();
    tracks(r,1.42,3.55,.95,.40,6);
    r.add(sideProfile([[-3.45,.86],[-3.45,1.90],[-.90,2.05],[1.90,2.05],[3.20,1.42],[3.50,.86]],2.66),T(0,0,0));
    r.add(new THREE.BoxGeometry(1.20,.36,.09),T(0,2.10,2.60));
    return r.bake();
  });
}
function artyTurretBaked(){
  return cache('artyTur',function(){
    const r=new Rig();
    r.add(sideProfile([[-1.85,0],[-1.60,1.10],[1.30,1.15],[1.70,.55],[1.70,0]],2.34),T(0,0,0));
    r.add(new THREE.CylinderGeometry(.42,.42,.24,12),T(-.55,1.22,-.55),CYL);
    r.add(new THREE.BoxGeometry(.24,.18,.60),T(.55,1.22,-.20));
    return r.bake();
  });
}
function makeArty(color){
  const col=color==null?0xff2a00:color, fill=0x200500;
  const g=new THREE.Group(), parts={};
  g.add(build(artyHullBaked(),col,.95,fill,.85));
  const yaw=new THREE.Group();yaw.position.set(0,2.02,-.20);g.add(yaw);
  yaw.add(build(artyTurretBaked(),col,.95,fill,.85));
  const bar=new THREE.Group();bar.position.set(0,.72,1.30);
  const rb=new Rig();
  rb.add(new THREE.CylinderGeometry(.155,.140,4.30,10),T(0,0,2.10,Math.PI/2,0,0),CYL);
  rb.add(new THREE.CylinderGeometry(.24,.24,1.10,10),T(0,0,.70,Math.PI/2,0,0),CYL);
  rb.add(new THREE.CylinderGeometry(.22,.22,.46,10),T(0,0,4.10,Math.PI/2,0,0),CYL);
  bar.add(build(rb.bake(),col,.95,null));
  yaw.add(bar);
  parts.turret=yaw;parts.barrel=bar;
  return {group:g,parts:parts};
}

/* ───────────────────────── РЕБ ───────────────────────── */
function ewBodyBaked(){
  return cache('ewBody',function(){
    const r=new Rig();
    addTruckBase(r,4.05,2.42,[2.55,-1.68,-2.82],.56);
    r.add(new THREE.BoxGeometry(2.28,1.85,4.30),T(0,2.00,-1.05));
    for(let i=0;i<3;i++)r.add(new THREE.BoxGeometry(2.34,.08,.08),T(0,1.35+i*.72,-1.05));
    r.add(new THREE.CylinderGeometry(.16,.20,2.30,8),T(0,4.05,-1.05),CYL);
    r.add(new THREE.BoxGeometry(.60,.34,.60),T(0,3.00,1.05));
    return r.bake();
  });
}
function ewDishBaked(){
  return cache('ewDish',function(){
    const r=new Rig();
    r.add(new THREE.CylinderGeometry(1.05,.90,.14,16),T(0,0,0,Math.PI/2,0,0),CYL);
    r.add(new THREE.TorusGeometry(1.02,.05,4,18),T(0,0,.08,0,0,0),CYL,true);
    r.add(new THREE.CylinderGeometry(.05,.05,.80,6),T(0,0,.44,Math.PI/2,0,0),CYL);
    r.add(new THREE.BoxGeometry(.24,.24,.16),T(0,0,.84));
    r.add(new THREE.BoxGeometry(1.70,.10,.10),T(0,0,-.16));
    return r.bake();
  });
}
function makeEw(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group(), parts={};
  g.add(build(ewBodyBaked(),col,.95,0x200500,.85));
  const d=build(ewDishBaked(),col,.95,null);
  d.position.set(0,5.15,-1.05);
  g.add(d);parts.dish=d;
  return {group:g,parts:parts};
}

/* ───────────────────────── ТЕНТОВАНА ВАНТАЖІВКА / ЗАПРАВНИК ───────────────────────── */
function tentTruckBaked(){
  return cache('tent',function(){
    const r=new Rig();
    addTruckBase(r,4.30,2.44,[2.70,-1.75,-2.92],.56);
    r.add(new THREE.BoxGeometry(2.34,.90,4.60),T(0,1.42,-1.20));
    // тент: натягнута напівоболонка по всій довжині кузова
    r.add(new THREE.CylinderGeometry(1.20,1.20,4.56,12,1,true,-Math.PI/2,Math.PI),T(0,1.84,-1.20,Math.PI/2,0,0),CYL);
    // торцеві полотнища
    r.add(new THREE.CircleGeometry(1.20,12,0,Math.PI),T(0,1.84,-3.48,0,0,0),CYL);
    r.add(new THREE.CircleGeometry(1.20,12,0,Math.PI),T(0,1.84,1.08,0,0,0),CYL);
    // дуги поперек кузова
    for(let i=0;i<5;i++)
      r.add(new THREE.TorusGeometry(1.20,.055,4,14,Math.PI),T(0,1.84,-3.40+i*1.13),CYL,true);
    // поздовжні ремені
    r.add(new THREE.BoxGeometry(.07,.07,4.56),T(-.86,2.68,-1.20));
    r.add(new THREE.BoxGeometry(.07,.07,4.56),T( .86,2.68,-1.20));
    r.add(new THREE.BoxGeometry(.07,.07,4.56),T(0,3.04,-1.20));
    return r.bake();
  });
}
function fuelTruckBaked(){
  return cache('fuel',function(){
    const r=new Rig();
    addTruckBase(r,4.35,2.44,[2.72,-1.78,-2.95],.56);
    r.add(new THREE.CylinderGeometry(1.16,1.16,4.90,14),T(0,2.06,-1.25,Math.PI/2,0,0),CYL);
    for(let i=0;i<4;i++)r.add(new THREE.TorusGeometry(1.17,.05,4,14),T(0,2.06,-3.30+i*1.36),CYL,true);
    r.add(new THREE.CylinderGeometry(.16,.16,.90,8),T(0,3.14,-3.40,Math.PI/2,0,0),CYL);
    r.add(new THREE.BoxGeometry(.50,.34,.50),T(0,3.30,-1.25));
    r.add(new THREE.BoxGeometry(2.20,.60,.30),T(0,1.10,-3.80));
    return r.bake();
  });
}
function makeTruckTent(color){return {group:build(tentTruckBaked(),color==null?0xff2a00:color,.95,0x200500,.85),parts:{}};}
function makeFuel(color){return {group:build(fuelTruckBaked(),color==null?0xff2a00:color,.95,0x200500,.85),parts:{}};}

/* ───────────────────────── КВАДРОЦИКЛ ───────────────────────── */
function motoBaked(){
  return cache('moto',function(){
    const r=new Rig();
    [[-.54,.66],[.54,.66],[-.54,-.62],[.54,-.62]].forEach(p=>
      r.add(new THREE.CylinderGeometry(.33,.33,.26,10),T(p[0],.33,p[1],0,0,Math.PI/2),CYL,true));
    r.add(sideProfile([[-.92,.36],[-.62,.60],[.20,.64],[.66,.56],[.86,.42],[.86,.28],[-.92,.26]],.98),T(0,0,0));
    r.add(new THREE.BoxGeometry(.44,.20,.58),T(0,.74,-.16));       // сідло
    r.add(new THREE.BoxGeometry(.10,.34,.10),T(0,.78,.52));        // стійка керма
    r.add(new THREE.BoxGeometry(.72,.07,.07),T(0,.96,.52));        // кермо
    r.add(new THREE.BoxGeometry(.52,.16,.30),T(0,.72,-.78));       // багажник
    r.add(new THREE.BoxGeometry(.36,.48,.26),T(0,1.06,-.14));      // водій
    r.add(new THREE.BoxGeometry(.44,.12,.20),T(0,1.20,-.02));
    r.add(new THREE.SphereGeometry(.145,10,7,0,Math.PI*2,0,Math.PI*.60),T(0,1.42,-.08),SPH);
    return r.bake();
  });
}
function makeMoto(color){return {group:build(motoBaked(),color==null?0xff2a00:color,.95,null),parts:{}};}

/* ───────────────────────── ЦИВІЛЬНИЙ ───────────────────────── */
function civBaked(){
  return cache('civ',function(){
    const r=new Rig();
    r.add(sideProfile([[-.11,-.20],[.09,-.20],[.115,.16],[.115,.32],[-.12,.32],[-.115,.06]],.34),T(0,.06,0));
    r.add(new THREE.BoxGeometry(.36,.10,.20),T(0,.34,0));
    r.add(new THREE.CylinderGeometry(.045,.045,.07,8),T(0,.42,0),CYL);
    r.add(new THREE.BoxGeometry(.165,.20,.175),T(0,.545,.01));
    r.add(new THREE.BoxGeometry(.175,.05,.19),T(0,.655,.02));    // кепка
    return r.bake();
  });
}
function makeCivilian(color){
  const col=color==null?0x00b4ff:color;
  const g=new THREE.Group(), parts={};
  const near=new THREE.Group();near.name='near';
  const torso=build(civBaked(),col,.9,null);
  near.add(torso);parts.torso=torso;
  const th=thighBaked(), sh=shinBaked(), ua=upArmBaked(), fa=foreArmBaked();
  parts.legL=limb(th,sh,col,-.425);parts.legL.position.set(-.086,-.115,0);
  parts.legR=limb(th,sh,col,-.425);parts.legR.position.set( .086,-.115,0);
  parts.armL=limb(ua,fa,col,-.335);parts.armL.position.set(-.205,.335,0);
  parts.armR=limb(ua,fa,col,-.335);parts.armR.position.set( .205,.335,0);
  near.add(parts.legL,parts.legR,parts.armL,parts.armR);
  const far=build(cache('civFar',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.34,.58,.24),T(0,.16,0));
    r.add(new THREE.BoxGeometry(.17,.28,.19),T(0,.56,0));
    r.add(new THREE.BoxGeometry(.135,.84,.16),T(-.09,-.48,.03));
    r.add(new THREE.BoxGeometry(.135,.84,.16),T(.09,-.48,-.03));
    return r.bake();
  }),col,.85,null);
  far.name='far';far.visible=false;
  g.add(near,far);
  parts.near=near;parts.far=far;
  return {group:g,parts:parts};
}

/* ───────────────────────── ОПОРА ЛЕП ───────────────────────── */
function pylonBaked(h,armW){
  return cache('pyl'+h+'_'+armW,function(){
    const r=new Rig();
    const base=1.55, topW=.52;
    for(let i=0;i<4;i++){
      const sx=(i&1)?1:-1, sz=(i&2)?1:-1;
      const g=new THREE.BufferGeometry();
      const bx=sx*base, bz=sz*base, tx=sx*topW, tz=sz*topW;
      const seg=new THREE.CylinderGeometry(.075,.075,h,4);
      const mid=new THREE.Matrix4().makeTranslation((bx+tx)/2,h/2,(bz+tz)/2);
      const tilt=new THREE.Matrix4().makeRotationZ(-(tx-bx)/h);
      const tilt2=new THREE.Matrix4().makeRotationX((tz-bz)/h);
      r.add(seg,mid.multiply(tilt).multiply(tilt2),CYL);
    }
    const lv=Math.max(3,Math.round(h/3.4));
    for(let k=0;k<lv;k++){
      const y0=h*k/lv, y1=h*(k+1)/lv;
      const w0=base+(topW-base)*(k/lv), w1=base+(topW-base)*((k+1)/lv);
      for(let s=0;s<4;s++){
        const a=s*Math.PI/2;
        const p0x=Math.cos(a)*w0*1.41, p0z=Math.sin(a)*w0*1.41;
        const p1x=Math.cos(a+Math.PI/2)*w1*1.41, p1z=Math.sin(a+Math.PI/2)*w1*1.41;
        const dx=p1x-p0x, dy=y1-y0, dz=p1z-p0z;
        const len=Math.hypot(dx,dy,dz);
        const br=new THREE.CylinderGeometry(.038,.038,len,4);
        const m=new THREE.Matrix4().makeTranslation((p0x+p1x)/2,(y0+y1)/2,(p0z+p1z)/2);
        const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx/len,dy/len,dz/len));
        m.multiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
        r.add(br,m,CYL,true);
        r.add(new THREE.CylinderGeometry(.034,.034,w0*2.6,4),T(0,y0,Math.cos(a)*w0,0,0,Math.PI/2),CYL,true);
      }
    }
    for(let a=0;a<2;a++){
      const y=h-.6-a*2.5;
      r.add(new THREE.BoxGeometry(armW*2,.16,.30),T(0,y,0));
      r.add(new THREE.BoxGeometry(armW*1.4,.12,.22),T(0,y+.55,0));
      for(let s=-1;s<=1;s+=1){
        if(!s&&a)continue;
        const x=s*armW*.92;
        r.add(new THREE.CylinderGeometry(.055,.055,.42,6),T(x,y-.32,0),CYL);
        r.add(new THREE.BoxGeometry(.20,.10,.20),T(x,y-.56,0));
      }
    }
    return r.bake();
  });
}
function makePylon(o){
  o=o||{};
  const h=o.height||26, armW=o.armW||3.4;
  const g=build(pylonBaked(h,armW),o.color==null?0x2f6b3a:o.color,.9,null);
  return {group:g,parts:{},height:h,armW:armW};
}

/* ───────────────────────── МАЙДАНЧИК ЗАПУСКУ ───────────────────────── */
function padBaked(){
  return cache('pad',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(4.60,.16,4.60),T(0,.08,0));
    r.add(new THREE.TorusGeometry(1.55,.06,4,26),T(0,.19,0,Math.PI/2,0,0),CYL,true);
    r.add(new THREE.BoxGeometry(.34,.05,2.10),T(0,.19,0));
    r.add(new THREE.BoxGeometry(2.10,.05,.34),T(0,.19,0));
    r.add(new THREE.BoxGeometry(.90,.62,.55),T(1.55,.44,-1.55));   // кейс
    r.add(new THREE.BoxGeometry(.75,.50,.48),T(-1.62,.38,-1.62));
    r.add(new THREE.CylinderGeometry(.075,.095,4.20,8),T(-1.90,2.20,1.85),CYL);
    r.add(new THREE.BoxGeometry(.70,.90,.10),T(-1.90,4.05,1.85,0,.4,0));
    for(let i=0;i<4;i++)r.add(new THREE.BoxGeometry(.62,.06,.06),T(-1.90,3.35+i*.30,1.85,0,.4,0));
    r.add(new THREE.CylinderGeometry(.05,.05,2.60,6),T(1.95,1.40,1.90),CYL);
    r.add(new THREE.SphereGeometry(.14,10,7),T(1.95,2.78,1.90),SPH);
    return r.bake();
  });
}
function makePad(color){
  return {group:build(padBaked(),color==null?0x00ff77:color,.85,null),parts:{}};
}

/* ───────────────────────── ДАХОВІ ЗАСОБИ ───────────────────────── */
function dshkBaked(){
  return cache('dshk',function(){
    const r=new Rig();
    for(let i=0;i<3;i++)
      r.add(new THREE.CylinderGeometry(.026,.026,.82,5),T(0,0,0,0,i*2.094,0).multiply(T(0,.32,.24,-.44,0,0)),CYL);
    r.add(new THREE.BoxGeometry(.17,.13,.22),T(0,.66,0));
    r.add(new THREE.BoxGeometry(.30,.05,.30),T(0,.03,0));
    return r.bake();
  });
}
function dshkGunBaked(){
  return cache('dshkGun',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.14,.20,.70),T(0,0,-.10));
    r.add(new THREE.CylinderGeometry(.045,.045,1.35,8),T(0,.02,.90,Math.PI/2,0,0),CYL);
    for(let i=0;i<5;i++)r.add(new THREE.TorusGeometry(.055,.014,4,8),T(0,.02,.45+i*.20),CYL,true);
    r.add(new THREE.BoxGeometry(.26,.22,.20),T(-.19,.02,-.16));     // коробка
    r.add(new THREE.BoxGeometry(.10,.24,.10),T(0,-.16,-.34));
    return r.bake();
  });
}
function makeDshk(color){
  const col=color==null?0xff5500:color;
  const g=new THREE.Group(), parts={};
  g.add(build(dshkBaked(),col,.95,null));
  const yaw=new THREE.Group();yaw.position.set(0,.74,0);g.add(yaw);
  const pitch=new THREE.Group();pitch.position.set(0,.05,0);pitch.scale.setScalar(.85);yaw.add(pitch);
  pitch.add(build(dshkGunBaked(),col,.95,null));
  parts.turret=yaw;parts.barrels=pitch;
  return {group:g,parts:parts};
}
function makeZuStatic(color){
  const col=color==null?0xff5500:color;
  const g=new THREE.Group();
  const base=new Rig();
  base.add(new THREE.BoxGeometry(1.90,.24,1.90),T(0,.12,0));
  for(let i=0;i<4;i++)base.add(new THREE.BoxGeometry(.30,.44,.30),T((i&1?1:-1)*.72,.34,(i&2?1:-1)*.72));
  g.add(build(base.bake(),col,.95,0x200500,.85));
  const p=zuTurret(g,col,.50);
  return {group:g,parts:p};
}
function makeRoofEw(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group(), parts={};
  const b=new Rig();
  b.add(new THREE.BoxGeometry(1.10,.80,1.10),T(0,.40,0));
  b.add(new THREE.CylinderGeometry(.10,.13,2.20,8),T(0,1.85,0),CYL);
  g.add(build(b.bake(),col,.95,0x200500,.85));
  const d=build(ewDishBaked(),col,.95,null);
  d.position.set(0,3.00,0);d.scale.setScalar(.72);
  g.add(d);parts.dish=d;
  return {group:g,parts:parts};
}
/* обладнання покрівель: усе злите в один меш на чанк */
function makeRoofClutter(items,color){
  const r=new Rig();
  const pip=(x,z,p)=>{
    let inside=false;
    for(let a=0,b=p.length-1;a<p.length;b=a++){
      const xi=p[a].x,zi=p[a].z,xj=p[b].x,zj=p[b].z;
      if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))inside=!inside;
    }
    return inside;
  };
  for(let n=0;n<items.length;n++){
    const it=items[n], y=it.y;
    let p=it.pts||null;
    if(p&&p.length>2){
      const l=p[p.length-1];
      if(Math.abs(l.x-p[0].x)<1e-6&&Math.abs(l.z-p[0].z)<1e-6)p=p.slice(0,-1);
    }
    if(!p||p.length<3)continue;
    const rnd=(s)=>{const x=Math.sin(it.seed*12.9898+s*78.233)*43758.5453;return x-Math.floor(x);};
    let cx=0,cz=0;
    for(const q of p){cx+=q.x;cz+=q.z;}
    cx/=p.length;cz/=p.length;
    // парапет: короб по кожному ребру, зсунутий усередину на 0.35 м
    const t=.17, IN=.35;
    for(let k=0;k<p.length;k++){
      const a=p[k],b=p[(k+1)%p.length];
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
      if(len<1.2)continue;
      let nx=-dz/len,nz=dx/len;
      if((a.x+dx/2-cx)*nx+(a.z+dz/2-cz)*nz>0){nx=-nx;nz=-nz;}
      r.add(new THREE.BoxGeometry(t,.50,len),
        T(a.x+dx/2+nx*IN,y+.25,a.z+dz/2+nz*IN,0,Math.atan2(dx,dz),0));
    }
    if(it.hw<3.2||it.hd<3.2)continue;
    // точка всередині полігону, з відступом від країв
    const spot=(s)=>{
      for(let k=0;k<14;k++){
        const px=cx+(rnd(s+k*3)-.5)*it.hw*1.5, pz=cz+(rnd(s+k*3+1)-.5)*it.hd*1.5;
        if(pip(px,pz,p)&&pip(px+1.1,pz,p)&&pip(px-1.1,pz,p)&&pip(px,pz+1.1,p)&&pip(px,pz-1.1,p))
          return {x:px,z:pz};
      }
      return null;
    };
    const sh=spot(1);
    if(sh){
      const sw=Math.min(2.2,it.hw*.5),sd=Math.min(2.0,it.hd*.5);
      r.add(new THREE.BoxGeometry(sw,2.30,sd),T(sh.x,y+1.15,sh.z));
      r.add(new THREE.BoxGeometry(sw+.16,.10,sd+.16),T(sh.x,y+2.34,sh.z));
    }
    const nv=2+((rnd(3)*3)|0);
    for(let k=0;k<nv;k++){
      const v=spot(40+k*7);
      if(!v)continue;
      if(rnd(30+k)<.5){
        r.add(new THREE.BoxGeometry(.95,.70,.95),T(v.x,y+.35,v.z));
        r.add(new THREE.BoxGeometry(1.10,.09,1.10),T(v.x,y+.74,v.z));
      }else{
        r.add(new THREE.CylinderGeometry(.34,.34,.85,8),T(v.x,y+.42,v.z),CYL);
        r.add(new THREE.CylinderGeometry(.44,.44,.10,8),T(v.x,y+.90,v.z),CYL);
      }
    }
    if(rnd(4)<.6){
      const b2=spot(120);
      if(b2){
        r.add(new THREE.CylinderGeometry(.62,.62,1.35,10),T(b2.x,y+.68,b2.z),CYL);
        r.add(new THREE.TorusGeometry(.62,.05,4,10),T(b2.x,y+1.34,b2.z,Math.PI/2,0,0),CYL,true);
      }
    }
    const na=1+((rnd(7)*3)|0);
    for(let k=0;k<na;k++){
      const a2=spot(200+k*11);
      if(!a2)continue;
      r.add(new THREE.CylinderGeometry(.035,.020,2.2+rnd(8+k)*1.6,5),T(a2.x,y+1.4,a2.z),CYL);
    }
  }
  const bk=r.bake();
  const g=new THREE.Group();
  if(bk.f)g.add(new THREE.Mesh(bk.f,fillMat(0x02180c,.9)));
  if(bk.e)g.add(new THREE.LineSegments(bk.e,lineMat(color==null?0x1f8f4a:color,.85)));
  return {group:g,parts:{}};
}

/* ───────────────── ПУСКОВА РАМПА ДЛЯ КРИЛА ───────────────── */
const RAMP_TILT=.24;
function railBaked(){
  return cache('rail',function(){
    const r=new Rig();
    const L=6.4;
    // дві направляючі балки з нахилом
    [-.44,.44].forEach(sx=>{
      r.add(new THREE.BoxGeometry(.16,.16,L),T(sx,1.30,0,-RAMP_TILT,0,0));
      r.add(new THREE.BoxGeometry(.10,.10,L*.92),T(sx,1.46,0,-RAMP_TILT,0,0));
    });
    // поперечини
    for(let i=0;i<6;i++){
      const t=(i/5-.5)*L*.9;
      r.add(new THREE.BoxGeometry(.92,.09,.09),T(0,1.30+t*Math.sin(RAMP_TILT)*-1,t*Math.cos(RAMP_TILT),-RAMP_TILT,0,0));
    }
    // стійки та опорна рама
    r.add(new THREE.BoxGeometry(1.15,.18,2.5),T(0,.16,-.4));
    [[-.50,-1.35],[.50,-1.35],[-.50,.55],[.50,.55]].forEach(p=>
      r.add(new THREE.CylinderGeometry(.075,.075,1.0,7),T(p[0],.66,p[1]),CYL));
    r.add(new THREE.CylinderGeometry(.07,.07,1.9,7),T(0,.95,1.55,-.85,0,0),CYL);
    // гідроциліндр підйому
    r.add(new THREE.CylinderGeometry(.11,.11,1.5,8),T(0,.80,-1.45,-.55,0,0),CYL);
    // генератор і кабель-блок
    r.add(new THREE.BoxGeometry(.80,.55,1.05),T(-1.25,.44,-1.5));
    r.add(new THREE.BoxGeometry(.34,.22,.34),T(1.20,.30,-1.6));
    return r.bake();
  });
}
function makeWingRail(color){
  const g=build(railBaked(),color==null?0x00ff77:color,.85,0x001b0d,.55);
  return {group:g,parts:{tilt:RAMP_TILT,railY:1.52,railZ:0}};
}

window.MODELS={
  quad:makeQuad, soldier:makeSoldier, civilian:makeCivilian, tank:makeTank, wing:makeWing, car:makeCar,
  sam:makeSam, samTruck:makeSamTruck, zu:makeZu, zuPickup:makeZuPickup, radar:makeRadar,
  missile:makeMissile, apc:makeApc, arty:makeArty, ew:makeEw,
  dshk:makeDshk, zuStatic:makeZuStatic, roofEw:makeRoofEw, roofClutter:makeRoofClutter,
  truckTent:makeTruckTent, fuel:makeFuel, moto:makeMoto, pylon:makePylon, pad:makePad,
  wingRail:makeWingRail, RAMP_TILT:RAMP_TILT,
  mats:MAT, lineMat:lineMat, fillMat:fillMat, mergePos:mergePos, plate:plate, sideProfile:sideProfile
};
})();
