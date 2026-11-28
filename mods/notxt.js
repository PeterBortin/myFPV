/* 1139: правило «без написів на моделях». Рушій (assets/saltline.js) малює текст на текстурах реквізиту: логотипи й трафарети
   контейнерів, ящиків, смітників, наліпки на зброї. Тут цей текст не малюється. Рішення — раз на полотно: якщо перший fillText на
   ньому кличе безпосередньо код рушія, на цьому полотні написів не буде; полотна гри (приціл, мапа, HUD) не чіпаються, навіть коли
   їх малюють із циклу рушія. Решта графіки (смуги, стрілки, кола) лишається. Вимкнути: ?off=notxt */
function saltNoTxt(){
  if(SALT_FEAT.notxt===false||saltNoTxt.on||typeof CanvasRenderingContext2D==='undefined')return;saltNoTxt.on=1;
  try{const P=CanvasRenderingContext2D.prototype,of=P.fillText,W=new WeakMap();
    P.fillText=function(){const c=this.canvas;let v=c?W.get(c):false;
      if(v===undefined){v=false;if(SALT_FEAT.notxt!==false)try{const fr=String(new Error().stack||'').split('\n').slice(1,4).filter(l=>!/fillText/.test(l))[0]||'';v=/saltline\.js/.test(fr);}catch(e){}
        W.set(c,v);if(v)SALT.noTxtN=(SALT.noTxtN||0)+1;}
      if(v)return;return of.apply(this,arguments);};
  }catch(e){saltFeatFail('notxt',e);}
}
