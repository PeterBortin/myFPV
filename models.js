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
function legBaked(){
  return cache('leg',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.130,.42,.145),T(0,-.21,0));
    r.add(new THREE.BoxGeometry(.108,.38,.128),T(0,-.60,.005));
    r.add(new THREE.BoxGeometry(.128,.085,.215),T(0,-.832,.042));
    return r.bake();
  });
}
function armBaked(){
  return cache('arm',function(){
    const r=new Rig();
    r.add(new THREE.BoxGeometry(.115,.33,.125),T(0,-.165,0));
    r.add(new THREE.BoxGeometry(.10,.30,.11),T(0,-.47,.02));
    r.add(new THREE.BoxGeometry(.085,.09,.115),T(0,-.655,.03));
    return r.bake();
  });
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

function makeSoldier(color){
  const col=color==null?0xff2a00:color;
  const g=new THREE.Group(), parts={};
  const near=new THREE.Group();near.name='near';
  near.add(build(soldierBaked(),col,.95,0x220400,.82));
  const lb=legBaked(), ab=armBaked();
  parts.legL=build(lb,col,.95,null);parts.legL.position.set(-.092,-.115,0);
  parts.legR=build(lb,col,.95,null);parts.legR.position.set( .092,-.115,0);
  parts.armL=build(ab,col,.95,null);parts.armL.position.set(-.250,.325,0);parts.armL.rotation.z=.11;
  parts.armR=build(ab,col,.95,null);parts.armR.position.set( .250,.325,0);parts.armR.rotation.z=-.11;
  near.add(parts.legL,parts.legR,parts.armL,parts.armR);
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
    r.add(new THREE.CylinderGeometry(.145,.130,4.70,14),T(0,0,2.30,Math.PI/2,0,0),CYL);
    r.add(new THREE.CylinderGeometry(.225,.225,2.10,14),T(0,0,1.30,Math.PI/2,0,0),CYL); // теплозахисний кожух
    r.add(new THREE.CylinderGeometry(.215,.215,.52,14),T(0,0,4.45,Math.PI/2,0,0),CYL);  // дульне гальмо
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
    // гондола
    r.add(sideProfile([[-.60,-.02],[.60,.02],[.76,.13],[.58,.23],[-.60,.21]],.26),T(0,.09,.06));
    // обтікач камери
    r.add(new THREE.SphereGeometry(.110,12,8),T(0,-.02,.60),SPH);
    // вінглети
    r.add(new THREE.BoxGeometry(.032,.30,.34),T(-1.55,.14,-.48,0,0,-.16));
    r.add(new THREE.BoxGeometry(.032,.30,.34),T( 1.55,.14,-.48,0,0, .16));
    // мотогондола (штовхаючий)
    r.add(new THREE.CylinderGeometry(.085,.075,.22,12),T(0,.11,-.60,Math.PI/2,0,0),CYL);
    return r.bake();
  });
}
function makeWing(o){
  o=o||{};
  const col=o.color==null?0xff1400:o.color;
  const g=new THREE.Group(), parts={};
  g.add(build(wingBaked(),col,.95,0x200500,.8));
  const p=build(propBaked(2),col,.8,null);
  p.position.set(0,.11,-.74);p.rotation.x=Math.PI/2;p.scale.setScalar(.85);
  g.add(p);parts.props=[p];
  if(o.scale)g.scale.setScalar(o.scale);
  return {group:g,parts:parts};
}

/* ───────────────────────── ЦИВІЛЬНИЙ ТРАНСПОРТ ───────────────────────── */
const CAR_PROFILES={
  sedan:{pts:[[-2.15,-.32],[-2.15,.08],[-1.70,.12],[-1.42,.54],[-.50,.70],[.52,.70],[1.26,.34],[1.98,.28],[2.15,.08],[2.15,-.32]],w:1.76,wh:.33,ax:[1.42,-1.40]},
  van:{pts:[[-2.55,-.34],[-2.55,.90],[-1.10,1.02],[1.30,1.02],[1.95,.52],[2.35,.34],[2.55,.06],[2.55,-.34]],w:1.92,wh:.36,ax:[1.70,-1.68]},
  truck:{pts:[[-3.60,-.34],[-3.60,1.55],[-.10,1.55],[-.10,1.10],[.90,1.05],[1.55,.42],[3.15,.30],[3.30,.02],[3.30,-.34]],w:2.20,wh:.44,ax:[2.30,-2.30]}
};
function carBaked(v){
  return cache('car'+v,function(){
    const P=CAR_PROFILES[v], r=new Rig();
    r.add(sideProfile(P.pts,P.w),T(0,0,0));
    const hx=P.w/2-.06;
    [[hx,P.ax[0]],[-hx,P.ax[0]],[hx,P.ax[1]],[-hx,P.ax[1]]].forEach(p=>
      r.add(new THREE.CylinderGeometry(P.wh,P.wh,.24,12),T(p[0],-.28,p[1],0,0,Math.PI/2),CYL,true));
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

window.MODELS={
  quad:makeQuad, soldier:makeSoldier, tank:makeTank, wing:makeWing, car:makeCar,
  lineMat:lineMat, fillMat:fillMat, mergePos:mergePos, plate:plate, sideProfile:sideProfile
};
})();
