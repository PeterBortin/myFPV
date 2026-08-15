/* myFPV — стартовий термінал МФ-3000 (vanilla). Механіку гри не змінює:
   запускає її через існуючі startWithGeo() / startWithManual(),
   а прогрес завантаження читає з #loading-bar / #loading-text. */
(function(){
'use strict';

const CFG_KEY='myfpv.lobby.cfg.v1', SES_KEY='myfpv.term.session';
const DEF={mission:'',craft:'fpv',warhead:'frag',coords:'50.4501, 30.5234',area:'Київ',time:'day',wx:'clear',chan:'off',diff:'std',god:false,sens:55,quality:'med',range:60,callsign:'ЯСТРУБ',vol:70};

const TABS=[
  {id:'prep',label:'Підготовка',icon:'Checklist'},
  {id:'hangar',label:'Ангар',icon:'Package'},
  {id:'data',label:'Дані',icon:'Book'},
  {id:'sys',label:'Система',icon:'Gear'}
];
const STEPS=[
  {n:'01',label:'Район',kick:'Крок 01 · район вильоту'},
  {n:'02',label:'Борт',kick:'Крок 02 · апарат'},
  {n:'03',label:'БЧ',kick:'Крок 03 · бойова частина'},
  {n:'04',label:'Умови',kick:'Крок 04 · умови вильоту'},
  {n:'05',label:'Завдання',kick:'Крок 05 · бойове завдання'}
];

const CRAFT={fpv:'Коптер 5"',wing:'Крило'};
const WARHEAD={frag:'Осколкова',heat:'Кумулятивна',thermo:'Термобарична'};
const TIME={day:'День',night:'Ніч',therm:'Тепловізор'};
const WX={clear:'Ясно',dyn:'Погодні умови'};
const CHAN={off:'Чисте відео',digital:'Цифра',analog:'Аналог'};
const QUAL={low:'Низька',med:'Середня',high:'Висока'};
const DIFF={train:'Тренування',std:'Стандарт',hard:'Висока'};

const AREAS=[
  {n:'Київ',c:'50.4501, 30.5234',t:'Щільна забудова, широкі проспекти, річка й мости.',b:[9,8,4]},
  {n:'Харків',c:'49.9935, 36.2304',t:'Багатоповерхівки впритул до промзони.',b:[8,7,5]},
  {n:'Одеса',c:'46.4825, 30.7233',t:'Порт, склади, приватний сектор на схилах.',b:[7,5,6]},
  {n:'Львів',c:'49.8397, 24.0297',t:'Стара забудова, вузькі вулиці, дахи впритул.',b:[8,4,3]},
  {n:'Дніпро',c:'48.4647, 35.0462',t:'Пагорби над річкою, заводські корпуси.',b:[7,7,5]},
  {n:'Запоріжжя',c:'47.8388, 35.1396',t:'Промисловий вузол, гребля, широка вода.',b:[6,6,6]},
  {n:'Миколаїв',c:'46.9750, 31.9946',t:'Верфі, лимани, довгі відкриті ділянки.',b:[5,4,8]},
  {n:'Херсон',c:'46.6354, 32.6169',t:'Низька забудова, плавні, мало орієнтирів.',b:[4,3,9]}
];
const AREA_BARS=['Щільність забудови','Висотність','Відкриті ділянки'];

const CRAFT_D={
  fpv:{k:'quad',tag:'Основний апарат',
    s:[['Швидкість',6],['Маневреність',9],['Дальність',4],['Стійкість',5]],
    note:'Тримає висоту, коли стік відпущено. Заходить у вікна, під мости й на дахи. Несе один скидний боєприпас і ракету по захопленій цілі.',
    kv:[['Зависання','Так'],['Боєзапас','Скид + ракета'],['Робоча висота','0–120 м'],['Поведінка','Тримає точку']]},
  wing:{k:'wing',tag:'Дальній рейд',
    s:[['Швидкість',9],['Маневреність',3],['Дальність',9],['Стійкість',6]],
    note:'Не зависає — тримає швидкість. Далі летить і рівніше йде на маршруті, але у щільній забудові розвернутися майже неможливо.',
    kv:[['Зависання','Ні'],['Боєзапас','У корпусі'],['Робоча висота','30–400 м'],['Поведінка','Постійний рух']]}
};
const WH_D={
  frag:{s:[['Проти піхоти',9],['Проти броні',2],['Проти укриттів',4],['Радіус ураження',8]],
    note:'Проти піхоти й неброньованої техніки. Найбільший радіус ураження — прощає промах на кілька метрів.',
    kv:[['Тип','Осколкова'],['Влучання','Не критичне'],['Ціль','Піхота, логістика']]},
  heat:{s:[['Проти піхоти',3],['Проти броні',9],['Проти укриттів',5],['Радіус ураження',3]],
    note:'Проти броні. Точне влучання обовʼязкове: дах і корма пробиваються, лоб танка — ні.',
    kv:[['Тип','Кумулятивна'],['Влучання','Критичне'],['Ціль','Танки, БТР, САУ']]},
  thermo:{s:[['Проти піхоти',7],['Проти броні',5],['Проти укриттів',9],['Радіус ураження',6]],
    note:'Проти укриттів і будівель. По рухомій цілі працює погано — розрахована на закриті обʼєми.',
    kv:[['Тип','Термобарична'],['Влучання','Помірне'],['Ціль','Будівлі, укриття']]}
};
const WH_TAG={frag:'Площа',heat:'Броня',thermo:'Обʼєм'};

const MODELS_DATA=[
  {k:'quad',n:'Коптер 5"',icon:'Zap',side:'own',grp:'own',cls:'Свій апарат',role:'Ударний дрон',mob:'Висока, зависання',arms:'Скидний боєприпас',note:'Основний апарат. Тримає висоту при відпущеному стіку, несе один боєприпас і ракету.'},
  {k:'wing',n:'Крило',icon:'Zap',side:'own',grp:'own',cls:'Свій апарат',role:'Дальній рейд',mob:'Тільки поступальний рух',arms:'Боєприпас у корпусі',note:'Не зависає — тримає швидкість. Далі летить, гірше маневрує у щільній забудові.'},
  {k:'tank',n:'Танк',icon:'Shield',side:'threat',grp:'ground',cls:'Ціль',role:'Броньована техніка',mob:'Гусенична, рухома',arms:'Гармата, кулемет',note:'Башта відслідковує дрон. Найтовща броня в лобі, дах — найслабший.'},
  {k:'apc',n:'БТР',icon:'Shield',side:'threat',grp:'ground',cls:'Ціль',role:'Броньована техніка',mob:'Рухома, дорогами',arms:'Автоматична гармата',note:'Швидший за танк, легша броня. Часто в колоні з логістикою.'},
  {k:'arty',n:'САУ',icon:'Shield',side:'threat',grp:'ground',cls:'Ціль',role:'Артилерія',mob:'Гусенична, рухома',arms:'Гаубиця',note:'Не веде вогонь по дрону. Пріоритетна ціль у місіях.'},
  {k:'sam',n:'ЗРК на гусеницях',icon:'Alert',side:'threat',grp:'aa',cls:'Ціль',role:'ППО',mob:'Гусенична, рухома',arms:'Зенітні керовані ракети',note:'Бере на супровід на висоті. Попередження про пуск приходить на HUD.'},
  {k:'samTruck',n:'ЗРК на шасі',icon:'Alert',side:'threat',grp:'aa',cls:'Ціль',role:'ППО',mob:'Колісна',arms:'Пакет труб',note:'Мобільна ППО. Розгортається біля важливих обʼєктів.'},
  {k:'zu',n:'ЗУ-23-2',icon:'Alert',side:'threat',grp:'aa',cls:'Ціль',role:'Ближня ППО',mob:'На причепі',arms:'Спарка 23 мм',note:'Найнебезпечніша на малій висоті. Трасери видно здалеку.'},
  {k:'zuPickup',n:'ЗУ-23 на пікапі',icon:'Alert',side:'threat',grp:'aa',cls:'Ціль',role:'Ближня ППО',mob:'Колісна, швидка',arms:'Спарка 23 мм',note:'Виїжджає на позицію й відкриває вогонь з ходу.'},
  {k:'dshk',n:'ДШК',icon:'Alert',side:'threat',grp:'aa',cls:'Ціль',role:'Вогнева точка',mob:'Стаціонарна',arms:'Кулемет 12,7 мм',note:'Стоїть на дахах і в укриттях. Мала дальність, висока щільність вогню.'},
  {k:'radar',n:'РЛС',icon:'Telescope',side:'support',grp:'ground',cls:'Ціль',role:'Розвідка',mob:'Стаціонарна',arms:'Немає',note:'Антена обертається. Знищення відкриває коридор для підльоту.'},
  {k:'ew',n:'РЕБ',icon:'Megaphone',side:'threat',grp:'ground',cls:'Ціль',role:'Подавлення',mob:'Колісна',arms:'Глушіння каналу',note:'Псує відеосигнал у радіусі. Чим ближче — тим більше артефактів на HUD.'},
  {k:'fuel',n:'Заправник',icon:'Package',side:'support',grp:'ground',cls:'Ціль',role:'Логістика',mob:'Колісна',arms:'Немає',note:'Детонує з великим факелом. Уражає техніку поруч.'},
  {k:'truckTent',n:'Тентована вантажівка',icon:'Package',side:'support',grp:'ground',cls:'Ціль',role:'Логістика',mob:'Колісна',arms:'Немає',note:'Везе піхоту. Після влучання десант висипається з кузова.'},
  {k:'moto',n:'Квадроцикл',icon:'Package',side:'support',grp:'ground',cls:'Ціль',role:'Логістика',mob:'Колісна, швидка',arms:'Немає',note:'Найшвидша наземна ціль. Складна для скидання боєприпасу.'},
  {k:'soldier',n:'Піхотинець',icon:'Person',side:'threat',grp:'ground',cls:'Ціль',role:'Піхота',mob:'Пішохідна',arms:'Стрілецька зброя, ПЗРК',note:'Ходить дорогами й дахами. Частина розрахунків має ПЗРК.'},
  {k:'su34',n:'Су-34',icon:'Zap',side:'threat',grp:'air',cls:'Ціль',role:'Авіація',mob:'Повітряна',arms:'КАБ, ракети',note:'Проходить на висоті. Перехоплення можливе тільки ракетою.'},
  {k:'su35',n:'Су-35',icon:'Zap',side:'threat',grp:'air',cls:'Ціль',role:'Авіація',mob:'Повітряна',arms:'Ракети «повітря-повітря»',note:'Швидкий, маневрений. Реагує на пуск по собі.'},
  {k:'mig31',n:'МіГ-31',icon:'Zap',side:'threat',grp:'air',cls:'Ціль',role:'Авіація',mob:'Повітряна, велика висота',arms:'«Кинжал» на центральному вузлі',note:'Носій. Ракета відчіпляється при пуску і йде окремою ціллю.'},
  {k:'mi8',n:'Мі-8',icon:'Zap',side:'support',grp:'air',cls:'Ціль',role:'Вертоліт',mob:'Повітряна, низька висота',arms:'Немає або НАР',note:'Висаджує десант. Точка виходу — бічні двері.'},
  {k:'mi24',n:'Мі-24',icon:'Zap',side:'threat',grp:'air',cls:'Ціль',role:'Вертоліт',mob:'Повітряна, низька висота',arms:'Гармата, блоки НАР',note:'Заходить на цілі парами. Небезпечний у ближній зоні.'},
  {k:'ka52',n:'Ка-52',icon:'Zap',side:'threat',grp:'air',cls:'Ціль',role:'Вертоліт',mob:'Повітряна, зависання',arms:'Гармата, ПТРК',note:'Соосна колонка. Зависає й веде вогонь з місця.'},
  {k:'missile',n:'Крилата ракета',icon:'Skip',side:'threat',grp:'air',cls:'Ціль',role:'Засіб ураження',mob:'Повітряна, маршова',arms:'Бойова частина',note:'Іде по маршруту на малій висоті. Збивається ракетою або таранем.'}
];
const HF=[{id:'all',label:'Усі'},{id:'own',label:'Свої'},{id:'ground',label:'Наземні'},{id:'aa',label:'ППО'},{id:'air',label:'Повітряні'}];
const MODEL_COLOR={own:0x64fe13,threat:0xd99a9a,support:0xa8bd97};

const MANUAL=[
  {title:'Лівий стик',icon:'Rows',rows:[{keys:['W'],act:'Тяга вгору'},{keys:['S'],act:'Тяга вниз'},{keys:['A'],act:'Розворот вліво'},{keys:['D'],act:'Розворот вправо'}]},
  {title:'Правий стик',icon:'Rows',rows:[{keys:['P'],act:'Нахил вперед'},{keys:[';'],act:'Нахил назад'},{keys:["'"],act:'Крен вправо'},{keys:['L'],act:'Крен вліво'},{keys:['↑','↓','←','→'],act:'Дублюють тягу і крен'}]},
  {title:'Зброя',icon:'Zap',rows:[{keys:['Space'],act:'Скинути боєприпас'},{keys:['Shift'],act:'Пуск ракети по захваченій цілі'},{keys:['R'],act:'Змінити бойову частину'},{keys:['−'],act:'Удар «Іскандер-М» по цілі'},{keys:['='],act:'Удар «Циркон» по цілі'}]},
  {title:'Камера і зір',icon:'EyeClosed',rows:[{keys:['Z'],act:'Цикл режимів зору'},{keys:['N'],act:'Нічний режим'},{keys:['T'],act:'Тепловізор'},{keys:['/'],act:'Вид від першої особи'}]},
  {title:'Ланка',icon:'People',rows:[{keys:['3'],act:'Розвідник — розвідка'},{keys:['4'],act:'Розвідник — тримати позицію'},{keys:['5'],act:'Розвідник — повернення на базу'}]},
  {title:'Апарат і система',icon:'Gear',rows:[{keys:['1'],act:'Коптер'},{keys:['2'],act:'Крило'},{keys:['Tab'],act:'Безсмертя'},{keys:['U'],act:'Звук'},{keys:['M'],act:'MODE 1 / MODE 2 (геймпад)'},{keys:['G'],act:'ACRO / ANGLE (геймпад)'}]}
];

const MISSIONS=[
  {id:'hunt',name:'Полювання',time:250,goal:'4 позначені цілі',brief:'Знищити позначені цілі',fail:'Збиття або вихід таймера'},
  {id:'recon',name:'Розвідка',time:225,goal:'5 точок маршруту',brief:'Пролетіти над точками, не бути збитим',fail:'Збиття або вихід таймера'},
  {id:'sead',name:'Прорив ППО',time:330,goal:'до 5 засобів ППО',brief:'Знищити засоби ППО й відкрити коридор',fail:'Збиття або вихід таймера'},
  {id:'survive',name:'Виживання',time:205,goal:'дожити до кінця хвилі',brief:'Дожити до кінця хвилі прильотів',fail:'Збиття'},
  {id:'race',name:'Гонка',time:160,goal:'фінішна точка',brief:'Долетіти до фінішної точки за час',fail:'Вихід таймера'},
  {id:'convoy',name:'Колона',time:215,goal:'до 5 машин',brief:'Розбити колону, поки вона не вийшла із зони',fail:'Колона пройшла 1150 м'},
  {id:'fuel',name:'Паливо',time:200,goal:'до 3 заправників',brief:'Спалити паливозаправники — детонація зробить решту',fail:'Збиття або вихід таймера'},
  {id:'clean',name:'Чиста робота',time:235,goal:'3 цілі',brief:'Три цілі без жодних втрат серед цивільних',fail:'Втрати серед цивільних'},
  {id:'ambush',name:'Засідка',time:200,goal:'2 цілі',brief:'Дві цілі, не піднімаючись вище 60 м над рельєфом',fail:'Понад 60 м AGL довше 3 с'},
  {id:'heliport',name:'Вертолітний майдан',time:245,goal:'3 машини на стоянці',brief:'Знищити машини на землі до запуску двигунів',fail:'Борти запустили двигуни за 120 с'},
  {id:'airdrop',name:'Зірвати десант',time:190,goal:'1 борт',brief:'Збити Мі-8 до того, як десант зійде на землю',fail:'Десант зійшов на землю'},
  {id:'roofsquad',name:'Дах',time:220,goal:'5 бійців',brief:'Вибити десант, що закріпився на покрівлі',fail:'Збиття або вихід таймера'},
  {id:'intercept',name:'Перехоплення',time:175,goal:'1 борт або РЛС наведення',brief:'Зірвати пуск «Кинжала»: таран ракети або РЛС наведення',fail:'Пуск «Кинжала» відбувся'}
];
const BOOT_STEPS=['Геодані OSM','Будинки й дороги','Рельєф висот','Техніка й піхота'];
const COLD=[
  'МФ-3000 · польовий термінал підготовки',
  'ПЗУ 64К ................ ок',
  'перевірка памʼяті ...... ок',
  'відеоканал 5.8 ГГц ..... сигнал є',
  'геобаза OSM ............ підключено',
  'рельєф висот ........... підключено'
];

var cfg=loadCfg();
var tab='prep', step=0, sub=0, hf='all', model='quad', spin=true, cur=0, lastKey='';
var okStep=[false,false,false,false,false];
var alive=true, bootMode=false, coldOn=false, sawBoot=false, raf=0, lt=0, tw=0, coldT=0;
var px=0,py=0,tpx=0,tpy=0;
var bgCtx=null,bgCv=null,bgB=[],bgZ=0;
var R=null,RSC=null,RCAM=null,PIV=null,GRID=null,T3=null,stageKey='quad';
var holdRaf=0,holdT0=0,holdOn=false,holdP=0;

function $(s,r){return (r||document).querySelector(s);}
function loadCfg(){var c={},k;for(k in DEF)c[k]=DEF[k];try{var r=localStorage.getItem(CFG_KEY);if(r){var j=JSON.parse(r);for(k in j)if(k in c)c[k]=j[k];}}catch(e){}return c;}
function save(){try{localStorage.setItem(CFG_KEY,JSON.stringify(cfg));}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ic(n,s){return '<oc-icon name="'+n+'" size="'+(s||16)+'"></oc-icon>';}
function mmss(s){s=Math.max(0,Math.round(s||0));var m=Math.floor(s/60);return (m<10?'0':'')+m+':'+((s%60)<10?'0':'')+(s%60);}
function nn(i){return (i<9?'0':'')+(i+1);}
function msn(){for(var i=0;i<MISSIONS.length;i++)if(MISSIONS[i].id===cfg.mission)return MISSIONS[i];return null;}
function areaIdx(){for(var i=0;i<AREAS.length;i++)if(AREAS[i].n===cfg.area)return i;return -1;}

/* ─────────── частини ─────────── */
function opt(a,v,num,title,meta,on){
  return '<button class="lb-opt'+(on?' on':'')+'" data-a="'+a+'" data-v="'+esc(v)+'">'+
    '<i>'+num+'</i><s>'+esc(title)+'</s>'+(meta?'<em>'+esc(meta)+'</em>':'')+'</button>';
}
function gh(t){return '<div class="lb-gh">'+esc(t)+'</div>';}
function bars(list,warnIdx){
  var h='<div class="lb-bars">',i,j;
  for(i=0;i<list.length;i++){
    var v=Math.max(0,Math.min(10,list[i][1])),w=(warnIdx&&warnIdx.indexOf(i)>=0);
    h+='<div class="lb-stat"><span>'+esc(list[i][0])+'</span><div class="lb-seg10">';
    for(j=0;j<10;j++)h+='<u'+(j<v?(w?' class="w"':' class="f"'):'')+'></u>';
    h+='</div><b>'+v+'</b></div>';
  }
  return h+'</div>';
}
function kvs(list){var h='<div class="lb-kvs">',i;
  for(i=0;i<list.length;i++)h+='<div class="lb-kv"><span>'+esc(list[i][0])+'</span><b>'+esc(list[i][1])+'</b></div>';
  return h+'</div>';}
function h2(t){return '<div class="lb-h2">'+esc(t)+'</div>';}
function head(title,tags){
  return '<div class="lb-kick" id="lb-kick"></div><h1>'+esc(title)+'</h1>'+(tags?'<div class="lb-tags">'+tags+'</div>':'');
}
function nextBtn(){
  if(step>=STEPS.length-1)return '';
  var s=STEPS[step+1];
  return '<button class="lb-next" data-a="next"><span>Далі · '+s.n+' '+esc(s.label)+'</span><u>Enter '+ic('ChevronRight',13)+'</u></button>';
}

/* ─────────── каркас ─────────── */
function shell(){
  var d=document.createElement('div');
  d.id='lobby';
  d.innerHTML=
   '<div id="lb-room"></div>'+
   '<div id="lb-dev">'+
     '<div class="lb-plate"><span>Модель МФ-3000</span><span class="hide-s">· польовий термінал підготовки</span>'+
       '<span class="sp"></span>'+
       '<span class="lb-led a"><u></u>живлення</span>'+
       '<span class="lb-led a hide-s" style="animation-delay:.8s"><u></u>канал</span>'+
       '<span class="lb-sig"><u></u><u></u><u></u><u></u></span>'+
       '<b id="lb-clock">--:--</b></div>'+
     '<div id="lb-crt">'+
       '<canvas id="lb-bg"></canvas>'+
       '<div id="lb-screen">'+
         '<div id="lb-tabs"></div><div id="lb-sub"></div>'+
         '<div id="lb-body"></div><div id="lb-status"></div>'+
         '<div id="lb-drawer" data-a="menu"></div>'+
       '</div>'+
       '<div id="lb-cold"></div>'+
       '<div id="lb-load">'+
         '<div class="box">'+
           '<div class="kick">Завантаження сектора</div><h2 id="lb-area">—</h2>'+
           '<div id="lb-blocks"></div>'+
           '<div class="st"><span id="lb-stage-txt">запит геоданих</span><b id="lb-pct">0%</b></div>'+
           '<div id="lb-lines"></div>'+
         '</div>'+
         '<div id="lb-hex"></div>'+
       '</div>'+
       '<div id="lb-roll"></div><div id="lb-scan"></div><div id="lb-vig"></div><div id="lb-noise"></div>'+
     '</div>'+
     '<div class="lb-plate"><span class="lb-knob"></span><span class="lb-knob"></span><span class="lb-vent"></span>'+
       '<span class="hide-s">канал 5.8 ГГц · геодані OSM · рельєф висот</span>'+
       '<span class="sp"></span><span class="hide-s">матеріал навчальний</span></div>'+
   '</div>';
  document.body.appendChild(d);
  bgCv=$('#lb-bg');
  var b='',i;for(i=0;i<48;i++)b+='<u></u>';
  $('#lb-blocks').innerHTML=b;
  clock();setInterval(clock,10000);
}
function clock(){
  var e=$('#lb-clock');if(!e)return;var d=new Date();
  e.textContent=(d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();
}

/* ─────────── кроки підготовки ─────────── */
var STEPB=[];

STEPB[0]=function(){
  var ai=areaIdx(),A=ai>=0?AREAS[ai]:null,i;
  var l='';
  l+=gh('Готові райони');
  for(i=0;i<AREAS.length;i++)l+=opt('area',String(i),nn(i),AREAS[i].n,AREAS[i].c.split(',')[0],ai===i);
  var p=cfg.coords.split(/[,\s]+/),lat=parseFloat(p[0]),lon=parseFloat(p[1]);
  var mx=Math.max(2,Math.min(98,((isFinite(lon)?lon:31)-21)/19*100));
  var my=Math.max(4,Math.min(96,(52.6-(isFinite(lat)?lat:49))/8.8*100));
  var r=head(A?A.n:'Власні координати','<span class="lb-tag ac">'+esc(cfg.coords)+'</span><span class="lb-tag">OpenStreetMap</span><span class="lb-tag">Рельєф висот</span>')+
   '<p class="lb-lead">'+esc(A?A.t:'Сцена будується з реальних геоданих за координатами. Порожні райони доростають процедурно.')+'</p>'+
   '<div class="lb-mini"><u style="left:8px;top:7px;">22° сх. д.</u><u style="right:8px;top:7px;">40° сх. д.</u>'+
     '<u style="left:8px;bottom:7px;">44° пн. ш.</u><u style="right:8px;bottom:7px;">52° пн. ш.</u>'+
     '<span class="lb-mk" style="left:'+mx.toFixed(1)+'%;top:'+my.toFixed(1)+'%;"></span></div>';
  if(A)r+=h2('Оцінка забудови')+bars([[AREA_BARS[0],A.b[0]],[AREA_BARS[1],A.b[1]],[AREA_BARS[2],A.b[2]]]);
  r+=h2('Власні координати')+
   '<div style="max-width:340px;"><label class="lb-fl" for="lb-coords">Широта, довгота</label>'+
   '<input class="lb-in" type="text" id="lb-coords" value="'+esc(cfg.coords)+'" placeholder="50.4501, 30.5234"></div>'+
   '<div class="lb-note">Карта доростає під час польоту, тож межі в сцени немає.</div>'+nextBtn();
  return {c:'two',g:'g2',l:l,r:r};
};

STEPB[1]=function(){
  var d=CRAFT_D[cfg.craft],l='';
  l+=gh('Апарат');
  l+=opt('craft','fpv','01',CRAFT.fpv,'зависання',cfg.craft==='fpv');
  l+=opt('craft','wing','02',CRAFT.wing,'дальність',cfg.craft==='wing');
  l+=gh('Позивний')+
    '<div class="lb-full" style="padding:10px 12px 4px;"><input class="lb-in" type="text" id="lb-callsign" maxlength="12" value="'+esc(cfg.callsign)+'"></div>';
  var r=head(CRAFT[cfg.craft],'<span class="lb-tag ac">'+esc(d.tag)+'</span><span class="lb-tag">Позивний '+esc(cfg.callsign)+'</span>')+
   '<div id="lb-stage" style="--sh:250px;"></div>'+
   '<div class="lb-stage-b"><span>Подіум · геометрія з гри</span>'+
     '<button class="lb-btn gh" data-a="spin" style="height:22px;">'+(spin?'Пауза':'Обертати')+'</button></div>'+
   '<p class="lb-lead" style="margin-top:20px;">'+esc(d.note)+'</p>'+
   h2('Характеристики')+bars(d.s)+h2('Дані')+kvs(d.kv)+nextBtn();
  return {c:'two',g:'g2',l:l,r:r};
};

STEPB[2]=function(){
  var d=WH_D[cfg.warhead],l='',i=0,k;
  l+=gh('Бойова частина');
  for(k in WARHEAD){l+=opt('warhead',k,nn(i),WARHEAD[k],WH_TAG[k],cfg.warhead===k);i++;}
  var r=head(WARHEAD[cfg.warhead],'<span class="lb-tag ac">'+esc(WH_TAG[cfg.warhead])+'</span><span class="lb-tag">'+esc(CRAFT[cfg.craft])+'</span>')+
   '<p class="lb-lead">'+esc(d.note)+'</p>'+
   h2('Ефективність')+bars(d.s)+h2('Дані')+kvs(d.kv)+
   '<div class="lb-note">У польоті бойову частину можна змінити клавішею R.</div>'+nextBtn();
  return {c:'two',g:'g2',l:l,r:r};
};

STEPB[3]=function(){
  var l='',k,i;
  l+=gh('Час доби');i=0;
  for(k in TIME){l+=opt('time',k,nn(i),TIME[k],'',cfg.time===k);i++;}
  l+=gh('Погода');i=0;
  for(k in WX){l+=opt('wx',k,nn(i),WX[k],'',cfg.wx===k);i++;}
  l+=gh('Відеоканал');i=0;
  for(k in CHAN){l+=opt('chan',k,nn(i),CHAN[k],'',cfg.chan===k);i++;}
  l+=gh('Складність');i=0;
  for(k in DIFF){l+=opt('diff',k,nn(i),DIFF[k],'',cfg.diff===k);i++;}
  l+=gh('Режим')+opt('god','1','—','Безсмертя',cfg.god?'увімк':'вимк',cfg.god);

  var vis=cfg.time==='day'?9:cfg.time==='night'?4:6;
  if(cfg.wx==='dyn')vis-=2;
  var th=cfg.time==='therm'?9:cfg.time==='night'?6:3;
  var jam=cfg.chan==='off'?0:cfg.chan==='digital'?4:7;
  if(cfg.wx==='dyn')jam+=1;
  var aa=cfg.diff==='train'?1:cfg.diff==='std'?5:9;
  vis=Math.max(1,Math.min(10,vis));jam=Math.max(0,Math.min(10,jam));
  var DN={train:'ППО не стріляє — можна вивчати карту й керування.',std:'Звичайна щільність ППО і техніки.',hard:'Більше ППО, швидша реакція, менше підказок.'};
  var tags='<span class="lb-tag ac">'+esc(TIME[cfg.time])+'</span><span class="lb-tag">'+esc(WX[cfg.wx])+'</span>'+
    '<span class="lb-tag">'+esc(CHAN[cfg.chan])+'</span><span class="lb-tag'+(cfg.diff==='hard'?' dg':'')+'">'+esc(DIFF[cfg.diff])+'</span>'+
    (cfg.god?'<span class="lb-tag am">Безсмертя</span>':'');
  var r=head('Умови вильоту',tags)+
   '<p class="lb-lead">'+esc(DN[cfg.diff])+'</p>'+
   h2('Прогноз')+bars([['Видимість',vis],['Тепловий контраст',th],['Ризик глушіння',jam],['Щільність ППО',aa]],[2,3])+
   (cfg.god?'<div class="lb-note">Безсмертя увімкнено: апарат не руйнується, результат не йде в журнал.</div>':'')+
   h2('Що це змінює')+kvs([
     ['Зір','Перемикається клавішами Z, N, T'],
     ['Відеоканал',cfg.chan==='off'?'Без артефактів':'Артефакти при РЕБ і дальності'],
     ['Погода',cfg.wx==='dyn'?'Вітер і опади в польоті':'Штиль, чисте небо'],
     ['ППО',cfg.diff==='train'?'Не відкриває вогонь':'Реагує на висоту й дальність']
   ])+nextBtn();
  return {c:'two',g:'g2',l:l,r:r};
};

STEPB[4]=function(){
  var m=msn(),i,l='';
  l+=gh('Завдання');
  l+=opt('mis','','—','Випадкове','без вибору',!m);
  for(i=0;i<MISSIONS.length;i++)l+=opt('mis',MISSIONS[i].id,nn(i),MISSIONS[i].name,mmss(MISSIONS[i].time),!!m&&m.id===MISSIONS[i].id);
  var A=areaIdx()>=0?AREAS[areaIdx()]:null;
  var r=head(m?m.name:'Випадкове завдання',
      '<span class="lb-tag ac">'+(m?mmss(m.time):'—')+'</span><span class="lb-tag">'+esc(A?A.n:cfg.coords)+'</span>'+
      '<span class="lb-tag">'+esc(CRAFT[cfg.craft])+'</span><span class="lb-tag">'+esc(WARHEAD[cfg.warhead])+'</span>')+
    '<p class="lb-lead">'+esc(m?m.brief:'Симулятор дасть випадкове завдання з тринадцяти. Обери конкретне зліва, якщо хочеш повторити його ще раз.')+'</p>'+
    (m?kvs([['Ціль',m.goal],['Провал',m.fail],['Час',mmss(m.time)],['Район',A?A.n:cfg.coords]]):'')+
    h2('Польотне завдання')+
    kvs([['Позивний',cfg.callsign],['Апарат',CRAFT[cfg.craft]],['Бойова частина',WARHEAD[cfg.warhead]],
         ['Умови',TIME[cfg.time]+' · '+WX[cfg.wx]],['Складність',DIFF[cfg.diff]+(cfg.god?' · безсмертя':'')],['Координати',cfg.coords]])+
    '<button class="lb-hold" id="lb-hold"><span class="t1">Утримуй для вильоту</span>'+
      '<span class="lay"><span class="fill"></span><span class="t2">Запуск</span></span></button>'+
    '<div class="lb-hint">Тримай кнопку або пробіл 0,7 с</div>'+
    '<div class="lb-row" style="margin-top:18px;">'+
      '<button class="lb-btn" data-a="launch-geo">'+ic('Location',14)+'Злетіти з моєї локації</button>'+
      '<button class="lb-btn gh" data-a="step" data-v="0">'+ic('ChevronLeft',14)+'Змінити район</button></div>';
  return {c:'two',cw:'352px',l:l,r:r};
};

/* ─────────── інші вкладки ─────────── */
function pgHangar(){
  var list=MODELS_DATA.filter(function(d){return hf==='all'||d.grp===hf;});
  var m=null,i;for(i=0;i<MODELS_DATA.length;i++)if(MODELS_DATA[i].k===model)m=MODELS_DATA[i];
  if(!m)m=MODELS_DATA[0];
  var l='',last='';
  for(i=0;i<list.length;i++){
    var d=list[i],g=d.grp==='own'?'Свої апарати':d.grp==='aa'?'ППО і вогневі точки':d.grp==='air'?'Повітряні цілі':'Наземні цілі';
    if(g!==last){l+=gh(g);last=g;}
    l+=opt('mod',d.k,nn(i),d.n,d.role,d.k===model);
  }
  var r=head(m.n,'<span class="lb-tag'+(m.side==='own'?' ac':m.side==='threat'?' dg':'')+'">'+esc(m.cls)+'</span><span class="lb-tag">'+esc(m.role)+'</span>')+
   '<div id="lb-stage"></div>'+
   '<div class="lb-stage-b"><span>Подіум · геометрія з гри</span>'+
     '<button class="lb-btn gh" data-a="spin" style="height:22px;">'+(spin?'Пауза':'Обертати')+'</button></div>'+
   '<p class="lb-lead" style="margin-top:20px;">'+esc(m.note)+'</p>'+
   kvs([['Клас',m.cls],['Роль',m.role],['Рухомість',m.mob],['Озброєння',m.arms]]);
  return {c:'two',cw:'300px',l:l,r:r};
}

function pgManual(){
  var h=head('Керування')+
   '<p class="lb-lead">Розкладка клавіатури й повний перелік дій. Геймпад і тач працюють паралельно.</p>'+
   '<div style="border:1px solid var(--n4);background:var(--n1);padding:12px;margin-bottom:26px;overflow-x:auto;max-width:1000px;">'+
     '<img src="keyboard.svg" alt="Розкладка клавіатури myFPV" style="display:block;width:100%;min-width:680px;height:auto;"></div>'+
   '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px 28px;max-width:1000px;">';
  for(var i=0;i<MANUAL.length;i++){var g=MANUAL[i];
    h+='<div>'+h2(g.title)+'<div style="display:flex;flex-direction:column;gap:8px;">';
    for(var j=0;j<g.rows.length;j++){var r=g.rows[j],ks='';
      for(var q=0;q<r.keys.length;q++)ks+='<kbd class="lb-kbd">'+esc(r.keys[q])+'</kbd>';
      h+='<div style="display:flex;align-items:center;gap:10px;"><span style="display:flex;gap:4px;flex:0 0 auto;">'+ks+'</span>'+
         '<span style="font-size:13px;line-height:18px;color:var(--n8);">'+esc(r.act)+'</span></div>';}
    h+='</div></div>';}
  return {c:'one',r:h+'</div>'};
}

function pgAbout(){
  return {c:'one',r:head('Про myFPV','<span class="lb-tag ac">Версія 0.9.4</span>')+
   '<div style="max-width:560px;">'+
   '<p style="font-size:16px;line-height:26px;margin-bottom:16px;">Симулятор FPV-дрона, що будує сцену з реальних геоданих: будинки, дороги, рельєф висот. Карта доростає під час польоту, тому можна летіти в будь-який бік без межі.</p>'+
   '<p style="font-size:14px;line-height:22px;color:var(--n8);margin-bottom:20px;">Два апарати: коптер 5" і крило. Техніка й піхота живуть у сцені самостійно — рухаються дорогами, займають дахи, відкривають вогонь. ППО реагує на висоту й дальність.</p>'+
   kvs([['Апарати','Коптер 5", крило'],['Карта','OpenStreetMap + рельєф'],['Керування','Клавіатура, геймпад, тач'],['Режими зору','День, ніч, тепловізор']])+
   '<div class="lb-note">Геодані — OpenStreetMap, рельєф — відкриті моделі висот. Матеріал не призначений для бойового застосування.</div></div>'};
}

function pgSys(){
  var k,h=head('Система')+'<div style="max-width:560px;">'+
   h2('Керування')+
   '<div class="lb-fl" style="display:flex;justify-content:space-between;"><span>Чутливість стіків</span><span id="lb-v-sens" style="color:var(--ac2);">'+cfg.sens+'</span></div>'+
   '<input type="range" min="20" max="100" step="5" value="'+cfg.sens+'" data-a="sens">'+
   h2('Графіка')+'<div class="lb-row" style="gap:6px;margin-bottom:16px;">';
  for(k in QUAL)h+='<button class="lb-btn'+(cfg.quality===k?'':'')+'" data-a="quality" data-v="'+k+'" style="'+(cfg.quality===k?'border-color:var(--ac);color:var(--acd);background:var(--ac);':'')+'">'+esc(QUAL[k])+'</button>';
  h+='</div>'+
   '<div class="lb-fl" style="display:flex;justify-content:space-between;"><span>Дальність прорисовки</span><span id="lb-v-range" style="color:var(--ac2);">'+Math.round(cfg.range*18)+' м</span></div>'+
   '<input type="range" min="20" max="100" step="10" value="'+cfg.range+'" data-a="range">'+
   h2('Звук')+
   '<div class="lb-fl" style="display:flex;justify-content:space-between;"><span>Гучність</span><span id="lb-v-vol" style="color:var(--ac2);">'+cfg.vol+'%</span></div>'+
   '<input type="range" min="0" max="100" step="5" value="'+cfg.vol+'" data-a="vol">'+
   h2('Термінал')+
   '<div class="lb-row"><button class="lb-btn" data-a="cold">'+ic('Workflow',14)+'Перезапустити термінал</button>'+
   '<button class="lb-btn" data-a="reset">'+ic('Trash',14)+'Скинути налаштування</button></div>'+
   '<div class="lb-note">Чутливість, якість і дальність зберігаються в терміналі; гра підхопить їх, коли зʼявляться відповідні перемикачі.</div>'+
   '</div>';
  return {c:'one',r:h};
}

/* ─────────── рендер ─────────── */
function body(){
  if(tab==='prep')return STEPB[step]();
  if(tab==='hangar')return pgHangar();
  if(tab==='data')return sub===0?pgManual():pgAbout();
  return pgSys();
}
function paintTabs(){
  var e=$('#lb-tabs');if(!e)return;
  var i,ti=0;for(i=0;i<TABS.length;i++)if(TABS[i].id===tab)ti=i;
  var h='<button class="lb-burger" data-a="menu" aria-label="Меню"><u></u><u></u><u></u></button>'+
    '<div class="lb-brand"><b>myFPV</b><span>МФ-3000</span></div>'+
    '<span class="lb-cur">'+nn(ti)+' '+esc(TABS[ti].label)+'</span>';
  for(i=0;i<TABS.length;i++)h+='<button class="lb-tab'+(TABS[i].id===tab?' on':'')+'" data-a="tab" data-v="'+TABS[i].id+'">'+
    '<i>'+nn(i)+'</i>'+ic(TABS[i].icon,14)+esc(TABS[i].label)+'</button>';
  e.innerHTML=h;
  var d=$('#lb-drawer');
  if(d){h='';
    for(i=0;i<TABS.length;i++)h+='<button class="lb-dr-i'+(TABS[i].id===tab?' on':'')+'" data-a="tab" data-v="'+TABS[i].id+'">'+
      '<i>'+nn(i)+'</i>'+ic(TABS[i].icon,16)+'<s>'+esc(TABS[i].label)+'</s></button>';
    d.innerHTML=h;}
}
function paintSub(){
  var e=$('#lb-sub');if(!e)return;var h='',i;
  if(tab==='prep'){
    h+='<button class="lb-arw" data-a="stepd" data-v="-1" aria-label="Попередній крок">'+ic('ChevronLeft',16)+'</button>';
    for(i=0;i<STEPS.length;i++){
      if(i)h+='<span class="lb-link'+(okStep[i-1]?' done':'')+'"></span>';
      h+='<button class="lb-step'+(i===step?' on':'')+(okStep[i]?' done':'')+'" data-a="step" data-v="'+i+'">'+
         '<i>'+(okStep[i]&&i!==step?'✓':STEPS[i].n)+'</i><s>'+esc(STEPS[i].label)+'</s></button>';
    }
    h+='<span class="lb-count">'+STEPS[step].n+' / 05</span>'+
       '<button class="lb-arw" data-a="stepd" data-v="1" aria-label="Наступний крок">'+ic('ChevronRight',16)+'</button>';
  }else if(tab==='hangar'){
    for(i=0;i<HF.length;i++)h+='<button class="lb-sub-i'+(HF[i].id===hf?' on':'')+'" data-a="hf" data-v="'+HF[i].id+'">'+esc(HF[i].label)+'</button>';
  }else if(tab==='data'){
    h+='<button class="lb-sub-i'+(sub===0?' on':'')+'" data-a="sub" data-v="0">Керування</button>'+
       '<button class="lb-sub-i'+(sub===1?' on':'')+'" data-a="sub" data-v="1">Про проєкт</button>';
  }
  e.innerHTML=h;
}
function paintStatus(){
  var e=$('#lb-status');if(!e)return;
  var n=0,i;for(i=0;i<5;i++)if(okStep[i])n++;
  var seg='';for(i=0;i<5;i++)seg+='<u'+(okStep[i]?' class="f"':'')+'></u>';
  e.innerHTML='<button id="lb-go" data-a="go5">'+ic('Play',18)+'Виліт</button>'+
    '<div class="lb-st-info"><span>Чек-лист</span><span class="lb-chk">'+seg+'</span><b>'+n+'/5</b>'+
    '<span class="hide-s">Позивний <b>'+esc(cfg.callsign)+'</b></span>'+
    '<span class="hide-s">Район <b>'+esc(cfg.area||'вручну')+'</b></span>'+
    '<span class="sp"></span>'+
    '<span class="lb-keys"><s><b>↑↓</b>вибір</s><s><b>←→</b>крок</s><s class="k3"><b>⏎</b>обрати</s><s class="k4"><b>␣</b>виліт</s></span></div>';
}
function paintBody(){
  var el=$('#lb-body');if(!el)return;
  var col=$('#lb-col'),det=$('#lb-det');
  var keep=el.getAttribute('data-k')===key(),cs=keep&&col?col.scrollTop:0,ds=keep&&det?det.scrollTop:0;
  var b=body();
  el.className=b.c;
  el.setAttribute('data-k',key());
  document.getElementById('lobby').style.setProperty('--cw',b.cw||'332px');
  el.innerHTML=b.c==='two'?'<div id="lb-col"'+(b.g?' class="'+b.g+'"':'')+'>'+b.l+'</div><div id="lb-det">'+b.r+'</div>':'<div id="lb-det">'+b.r+'</div>';
  el.style.animation='none';void el.offsetWidth;el.style.animation='lbscan 150ms linear';
  col=$('#lb-col');det=$('#lb-det');
  if(keep){if(col)col.scrollTop=cs;if(det)det.scrollTop=ds;}
  if(!keep)cur=-1;
  var rows=rowList();
  if(cur<0){cur=0;for(var i=0;i<rows.length;i++)if(rows[i].className.indexOf('on')>=0){cur=i;break;}}
  cur=Math.max(0,Math.min(rows.length-1,cur));
  paintCur(!keep);
  typeKick(tab==='prep'?STEPS[step].kick:tab==='hangar'?'Ангар · каталог моделей':tab==='data'?(sub===0?'Довідка · керування':'Довідка · проєкт'):'Термінал · налаштування');
  bindHold();
  if((tab==='prep'&&step===1)||tab==='hangar'){stageKey=(tab==='hangar')?model:(cfg.craft==='wing'?'wing':'quad');mountStage();}
}
function key(){return tab+'|'+(tab==='prep'?step:tab==='data'?sub:tab==='hangar'?hf:'');}
function render(){paintTabs();paintSub();paintBody();paintStatus();}

function rowList(){var c=$('#lb-col');return c?c.querySelectorAll('.lb-opt'):[];}
function paintCur(scroll){
  var r=rowList(),i;
  for(i=0;i<r.length;i++){
    if(i===cur)r[i].classList.add('cur');else r[i].classList.remove('cur');
  }
  if(scroll===false)return;
  var c=$('#lb-col'),e=r[cur];
  if(c&&e){
    var top=e.offsetTop,bot=top+e.offsetHeight;
    if(top<c.scrollTop+8)c.scrollTop=Math.max(0,top-8);
    else if(bot>c.scrollTop+c.clientHeight-8)c.scrollTop=bot-c.clientHeight+8;
  }
}
function moveCur(d){
  var r=rowList();if(!r.length)return;
  cur=(cur+d+r.length)%r.length;paintCur(true);
}
function hitCur(){var r=rowList();if(r[cur])r[cur].click();}
function stepBy(d){
  if(tab==='prep'){var s=Math.max(0,Math.min(STEPS.length-1,step+d));if(s!==step){if(d>0)okStep[step]=true;step=s;cur=-1;render();}return;}
  if(tab==='data'){sub=sub?0:1;cur=-1;render();return;}
  if(tab==='hangar'){var i=0,j;for(j=0;j<HF.length;j++)if(HF[j].id===hf)i=j;hf=HF[(i+d+HF.length)%HF.length].id;cur=-1;render();}
}
function typeKick(text){
  if(tw)clearInterval(tw);
  var el=$('#lb-kick');if(!el)return;
  var i=0;el.innerHTML='<span class="lb-caret"></span>';
  tw=setInterval(function(){
    i++;var e=$('#lb-kick');
    if(!e){clearInterval(tw);tw=0;return;}
    e.innerHTML=esc(text.slice(0,i))+'<span class="lb-caret"></span>';
    if(i>=text.length){clearInterval(tw);tw=0;}
  },26);
}

/* ─────────── дії ─────────── */
function act(a,v){
  if(a==='menu'){document.body.classList.toggle('lb-menu');return;}
  if(a==='stepd'){stepBy(+v);return;}
  if(a==='tab'){document.body.classList.remove('lb-menu');if(tab!==v){tab=v;cur=-1;render();}return;}
  if(a==='step'){var s=+v;if(s!==step){step=s;cur=-1;render();}return;}
  if(a==='sub'){sub=+v;cur=-1;render();return;}
  if(a==='hf'){hf=v;cur=-1;render();return;}
  if(a==='next'){okStep[step]=true;if(step<STEPS.length-1){step++;cur=-1;}render();return;}
  if(a==='go5'){tab='prep';step=4;cur=-1;render();return;}
  if(a==='area'){var A=AREAS[+v];cfg.area=A.n;cfg.coords=A.c;okStep[0]=true;save();render();return;}
  if(a==='craft'){cfg.craft=v;okStep[1]=true;save();render();return;}
  if(a==='warhead'){cfg.warhead=v;okStep[2]=true;save();render();return;}
  if(a==='time'||a==='wx'||a==='chan'||a==='diff'){cfg[a]=v;okStep[3]=true;save();render();return;}
  if(a==='god'){cfg.god=!cfg.god;okStep[3]=true;save();render();return;}
  if(a==='mis'){cfg.mission=(cfg.mission===v?'':v);okStep[4]=true;save();render();return;}
  if(a==='mod'){model=v;render();return;}
  if(a==='spin'){spin=!spin;render();return;}
  if(a==='quality'){cfg.quality=v;save();render();return;}
  if(a==='reset'){for(var k in DEF)cfg[k]=DEF[k];okStep=[false,false,false,false,false];save();render();return;}
  if(a==='cold'){coldStart();return;}
  if(a==='launch'){launch(false);return;}
  if(a==='launch-geo'){launch(true);return;}
}
document.addEventListener('click',function(e){
  var l=document.getElementById('lobby');if(!l||!alive)return;
  if(coldOn){e.preventDefault();e.stopPropagation();coldEnd();return;}
  var t=e.target;
  while(t&&t!==l&&!(t.getAttribute&&t.getAttribute('data-a')))t=t.parentNode;
  if(!t||t===l)return;
  e.preventDefault();e.stopPropagation();
  var r=rowList(),i;
  for(i=0;i<r.length;i++)if(r[i]===t){cur=i;break;}
  act(t.getAttribute('data-a'),t.getAttribute('data-v'));
},true);
document.addEventListener('mouseover',function(e){
  if(!alive)return;var c=$('#lb-col');if(!c||!c.contains(e.target))return;
  var t=e.target;while(t&&t!==c&&String(t.className||'').indexOf('lb-opt')<0)t=t.parentNode;
  if(!t||t===c)return;
  var r=rowList(),i;for(i=0;i<r.length;i++)if(r[i]===t&&i!==cur){cur=i;paintCur(false);return;}
});
document.addEventListener('input',function(e){
  var l=document.getElementById('lobby');if(!l||!alive||!l.contains(e.target))return;
  var t=e.target,a=t.getAttribute&&t.getAttribute('data-a'),s;
  if(a==='sens'){cfg.sens=+t.value;save();s=$('#lb-v-sens');if(s)s.textContent=cfg.sens;return;}
  if(a==='range'){cfg.range=+t.value;save();s=$('#lb-v-range');if(s)s.textContent=Math.round(cfg.range*18)+' м';return;}
  if(a==='vol'){cfg.vol=+t.value;save();s=$('#lb-v-vol');if(s)s.textContent=cfg.vol+'%';return;}
  if(t.id==='lb-coords'){cfg.coords=t.value;cfg.area='';okStep[0]=true;save();paintStatus();return;}
  if(t.id==='lb-callsign'){cfg.callsign=(t.value||'').toUpperCase();t.value=cfg.callsign;save();paintStatus();return;}
});

/* ─────────── утримати для вильоту ─────────── */
function bindHold(){
  var b=$('#lb-hold');if(!b)return;
  b.addEventListener('pointerdown',function(e){e.preventDefault();holdStart();});
  b.addEventListener('pointerup',holdEnd);
  b.addEventListener('pointerleave',holdEnd);
  b.addEventListener('pointercancel',holdEnd);
}
function holdStart(){
  if(holdOn||bootMode)return;
  var b=$('#lb-hold');
  if(!b){tab='prep';step=4;cur=-1;render();return;}
  holdOn=true;holdT0=Date.now();b.classList.add('armed');holdTick();
}
function holdTick(){
  if(!holdOn)return;
  var b=$('#lb-hold');if(!b){holdOn=false;return;}
  holdP=Math.min(1,(Date.now()-holdT0)/700);
  var lay=b.querySelector('.lay');
  if(lay)lay.style.clipPath='inset(0 '+((1-holdP)*100).toFixed(1)+'% 0 0)';
  if(holdP>=1){holdOn=false;b.classList.remove('armed');launch(false);return;}
  holdRaf=requestAnimationFrame(holdTick);
}
function holdEnd(){
  if(!holdOn)return;
  holdOn=false;cancelAnimationFrame(holdRaf);
  var b=$('#lb-hold');if(!b)return;
  b.classList.remove('armed');
  var lay=b.querySelector('.lay'),p=holdP,t0=Date.now();
  (function back(){
    var k=Math.max(0,p*(1-(Date.now()-t0)/200));
    if(lay)lay.style.clipPath='inset(0 '+((1-k)*100).toFixed(1)+'% 0 0)';
    if(k>0&&!holdOn)requestAnimationFrame(back);
  })();
}

/* ─────────── холодний старт ─────────── */
function coldStart(){
  var e=$('#lb-cold');if(!e)return;
  coldOn=true;document.body.classList.add('lb-cold');
  e.innerHTML='';e.style.animation='none';void e.offsetWidth;e.style.animation='';
  var i=0;
  if(coldT)clearInterval(coldT);
  coldT=setInterval(function(){
    var c=$('#lb-cold');if(!c||!coldOn){clearInterval(coldT);coldT=0;return;}
    if(i<COLD.length){
      c.insertAdjacentHTML('beforeend','<div'+(i?'':' class="dim"')+'>'+esc(COLD[i])+'</div>');
      i++;return;
    }
    if(i===COLD.length){
      c.insertAdjacentHTML('beforeend','<div>профіль пілота ......... '+esc(cfg.callsign)+'</div>');i++;return;
    }
    c.insertAdjacentHTML('beforeend','<div>&gt; запуск інтерфейсу підготовки<span class="lb-caret"></span></div>');
    clearInterval(coldT);coldT=0;
    setTimeout(function(){if(coldOn)coldEnd();},560);
  },135);
}
function coldEnd(){
  if(!coldOn)return;
  coldOn=false;
  if(coldT){clearInterval(coldT);coldT=0;}
  document.body.classList.remove('lb-cold');
  try{sessionStorage.setItem(SES_KEY,'1');}catch(e){}
  var s=$('#lb-screen');
  if(s){s.style.animation='none';void s.offsetWidth;s.style.animation='lbon 380ms cubic-bezier(.33,1,.68,1) both';}
}

/* ─────────── фон-реплей ─────────── */
function mkB(z){var s=Math.random()<.5?-1:1;
  return {x:s*(70+Math.random()*470),z:z,w:24+Math.random()*72,d:24+Math.random()*72,h:26+Math.random()*190,t:Math.random()<.1};}
function initBg(){bgCtx=bgCv?bgCv.getContext('2d'):null;bgB=[];for(var i=0;i<110;i++)bgB.push(mkB(40+Math.random()*1000));}
function drawBg(dt){
  if(!bgCtx||!bgCv)return;
  var dpr=Math.min(window.devicePixelRatio||1,1.5);
  var W=bgCv.clientWidth||1,H=bgCv.clientHeight||1;
  if(bgCv.width!==((W*dpr)|0)||bgCv.height!==((H*dpr)|0)){bgCv.width=(W*dpr)|0;bgCv.height=(H*dpr)|0;}
  var c=bgCtx;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  var f=Math.max(W,H)*.85,cx=W*.5+px*30,cy=H*.58+py*20,eye=46,zn=34,zx=1100;
  var P=function(x,y,z){return [cx+(x/z)*f,cy+(y/z)*f];};
  var sp=34*dt;bgZ+=sp;
  c.lineWidth=1;c.strokeStyle='rgba(100,254,19,0.075)';c.beginPath();
  var step2=90,off=bgZ%step2,z,gx,a,b;
  for(z=zn+off;z<zx;z+=step2){var y=cy+(eye/z)*f;if(y<H+20){c.moveTo(0,y);c.lineTo(W,y);}}
  for(gx=-720;gx<=720;gx+=120){a=P(gx,eye,zn);b=P(gx,eye,zx);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);}
  c.stroke();
  c.strokeStyle='rgba(100,254,19,0.13)';c.beginPath();c.moveTo(0,cy);c.lineTo(W,cy);c.stroke();
  var marks=[];
  c.strokeStyle='rgba(100,254,19,0.3)';c.beginPath();
  for(var i=0;i<bgB.length;i++){
    var o=bgB[i];o.z-=sp;
    if(o.z<zn){bgB[i]=mkB(zx+Math.random()*160);continue;}
    var zf=o.z,zb=o.z+o.d;if(zf>zx)continue;
    var x0=o.x-o.w/2,x1=o.x+o.w/2,yb=eye,yt=eye-o.h;
    var p1=P(x0,yb,zf),p2=P(x1,yb,zf),p3=P(x1,yt,zf),p4=P(x0,yt,zf);
    var q2=P(x1,yb,zb),q3=P(x1,yt,zb),q4=P(x0,yt,zb);
    c.moveTo(p1[0],p1[1]);c.lineTo(p4[0],p4[1]);c.lineTo(p3[0],p3[1]);c.lineTo(p2[0],p2[1]);
    c.moveTo(p4[0],p4[1]);c.lineTo(q4[0],q4[1]);c.lineTo(q3[0],q3[1]);c.lineTo(p3[0],p3[1]);
    c.moveTo(q2[0],q2[1]);c.lineTo(q3[0],q3[1]);
    if(o.t&&zf<520)marks.push([P(o.x,yt-16,zf),zf]);
  }
  c.stroke();
  if(marks.length){
    c.strokeStyle='rgba(217,154,154,0.4)';c.beginPath();
    for(var j=0;j<marks.length;j++){
      var m=marks[j],p=m[0],r=Math.max(7,26-m[1]/26),k=4;
      c.moveTo(p[0]-r,p[1]-r+k);c.lineTo(p[0]-r,p[1]-r);c.lineTo(p[0]-r+k,p[1]-r);
      c.moveTo(p[0]+r-k,p[1]-r);c.lineTo(p[0]+r,p[1]-r);c.lineTo(p[0]+r,p[1]-r+k);
      c.moveTo(p[0]-r,p[1]+r-k);c.lineTo(p[0]-r,p[1]+r);c.lineTo(p[0]-r+k,p[1]+r);
      c.moveTo(p[0]+r-k,p[1]+r);c.lineTo(p[0]+r,p[1]+r);c.lineTo(p[0]+r,p[1]+r-k);
    }
    c.stroke();
  }
}

/* ─────────── подіум ─────────── */
function mountStage(){
  var host=$('#lb-stage');if(!host)return;
  if(!window.THREE||!window.MODELS){setTimeout(function(){if($('#lb-stage'))mountStage();},150);return;}
  T3=window.THREE;
  if(!R){
    R=new T3.WebGLRenderer({antialias:true,alpha:true});
    R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    R.domElement.style.display='block';
    RSC=new T3.Scene();RCAM=new T3.PerspectiveCamera(34,1,.1,400);
    PIV=new T3.Group();RSC.add(PIV);
    GRID=new T3.GridHelper(40,20,0x2f3d25,0x1a2314);
    GRID.material.transparent=true;GRID.material.opacity=.5;RSC.add(GRID);
  }
  if(R.domElement.parentNode!==host)host.appendChild(R.domElement);
  fitStage();swapModel();
}
function fitStage(){
  var host=$('#lb-stage');if(!R||!host)return;
  var w=Math.max(80,host.clientWidth),h=Math.max(80,host.clientHeight);
  R.setSize(w,h);RCAM.aspect=w/h;RCAM.updateProjectionMatrix();
}
function swapModel(){
  if(!PIV||!window.MODELS)return;
  while(PIV.children.length)PIV.remove(PIV.children[0]);
  var d=null,i;for(i=0;i<MODELS_DATA.length;i++)if(MODELS_DATA[i].k===stageKey)d=MODELS_DATA[i];
  if(!d)d=MODELS_DATA[0];
  var res=null,col=MODEL_COLOR[d.side];
  try{res=window.MODELS[d.k]?window.MODELS[d.k]({color:col,fill:0x0d1209}):null;}
  catch(e){try{res=window.MODELS[d.k](col);}catch(e2){res=null;}}
  var g=res?(res.group||res):null;if(!g)return;
  PIV.add(g);
  var box=new T3.Box3().setFromObject(g),size=new T3.Vector3(),ctr=new T3.Vector3();
  box.getSize(size);box.getCenter(ctr);
  var r=Math.max(size.x,size.y,size.z)||2;
  g.position.sub(ctr);g.position.y+=size.y/2;
  var dd=r*2.35;
  RCAM.position.set(dd*.72,r*.85+dd*.3,dd*.72);
  RCAM.lookAt(0,size.y*.42,0);
  PIV.rotation.y=0;
  if(GRID)GRID.scale.setScalar(Math.max(.25,r/16));
}

/* ─────────── запуск гри ─────────── */
function noise(ms,then){
  var n=$('#lb-noise');if(n)n.style.display='block';
  setTimeout(function(){if(n)n.style.display='none';then();},ms);
}
function pk(row,v){
  var r=document.getElementById(row);if(!r)return;
  var e=r.querySelector('.pk[data-v="'+v+'"]');
  if(e&&e.className.indexOf('on')<0)e.click();
}
function applyPicks(){
  var mode=cfg.diff==='train'?'train':(cfg.mission?'mission':'free');
  pk('pick-mode',mode);pk('pick-wx',cfg.wx);pk('pick-chan',cfg.chan);
}
function launch(useGeo){
  if(bootMode)return;
  try{applyPicks();}catch(e){console.warn('lobby picks:',e);}
  window.LOBBY_MISSION=cfg.mission||'';
  noise(620,function(){
    bootMode=true;
    document.body.classList.add('lb-boot');
    var a=$('#lb-area');if(a)a.textContent=cfg.area||cfg.coords||'Сектор';
    paintLines(0);mirror();
  try{
      if(useGeo){ if(typeof startWithGeo==='function')startWithGeo(); }
      else{
        var i=document.getElementById('coords-input');
        if(i)i.value=cfg.coords;
        if(typeof startWithManual==='function')startWithManual();
      }
    }catch(e){console.error('lobby launch:',e);}
  });
}
function paintLines(p){
  var el=$('#lb-lines');if(!el)return;
  var h='',i;
  for(i=0;i<BOOT_STEPS.length;i++){
    var done=p*BOOT_STEPS.length>=i+1,now=!done&&p*BOOT_STEPS.length>i;
    h+='<div class="'+(done?'ok':now?'on':'')+'"><span>'+(done?'▪':now?'▸':'·')+'</span>'+
       '<span>'+esc(BOOT_STEPS[i])+'</span><span class="dots"></span>'+
       '<span>'+(done?'готово':now?'обробка':'у черзі')+'</span></div>';
  }
  el.innerHTML=h;
}
function hexDump(){
  var el=$('#lb-hex');if(!el)return;
  var h='',i,j,s;
  for(i=0;i<16;i++){s='';for(j=0;j<6;j++)s+=(256+((Math.random()*256)|0)).toString(16).slice(1)+' ';h+='<div>'+s+'</div>';}
  el.innerHTML=h;
}
function mirror(){
  if(!bootMode)return;
  var gb=document.getElementById('loading-bar'),gt=document.getElementById('loading-text');
  var w=gb&&gb.style.width?gb.style.width:'0%',p=parseFloat(w)||0;
  var blocks=$('#lb-blocks'),st=$('#lb-stage-txt'),pc=$('#lb-pct');
  if(blocks){var u=blocks.children,n=Math.round(p/100*u.length),i;
    for(i=0;i<u.length;i++)u[i].className=i<n?'f':'';}
  if(pc)pc.textContent=Math.round(p)+'%';
  if(st)st.textContent=(gt&&gt.textContent)?gt.textContent:'запит геоданих';
  paintLines(p/100);hexDump();
  setTimeout(mirror,150);
}
function applyAfter(){
  try{if(cfg.craft==='wing'&&typeof setCraft==='function')setCraft('wing');}catch(e){}
  try{
    if(typeof visionApply==='function'){
      if(cfg.time==='night'){night=true;thermal=false;visionApply();}
      else if(cfg.time==='therm'){thermal=true;night=false;visionApply();}
    }
  }catch(e){}
  try{if(typeof godApply==='function'){god=!!cfg.god;godApply();}}catch(e){}
  try{if(cfg.vol===0&&typeof setMute==='function')setMute(true);}catch(e){}
}
function shutdown(){
  if(!alive)return;
  alive=false;bootMode=false;coldOn=false;
  window.removeEventListener('keydown',keyGuard,true);
  window.removeEventListener('keyup',keyGuard,true);
  if(raf)cancelAnimationFrame(raf);
  if(tw)clearInterval(tw);
  if(coldT)clearInterval(coldT);
  document.body.classList.remove('lb-on','lb-boot','lb-cold','lb-menu');
  try{if(R){if(R.forceContextLoss)R.forceContextLoss();R.dispose();R=null;}}catch(e){}
  applyAfter();
  var l=document.getElementById('lobby');
  if(l&&l.parentNode)l.parentNode.removeChild(l);
}

/* ─────────── клавіатура ─────────── */
function keyGuard(e){
  if(!alive)return;
  e.stopImmediatePropagation();
  if(coldOn){if(e.type==='keydown'){e.preventDefault();coldEnd();}return;}
  if(bootMode)return;
  var t=e.target,tag=t&&t.tagName,typing=(tag==='INPUT'||tag==='TEXTAREA'),k=e.key;
  if(e.type==='keyup'){if(k===' '&&!typing)holdEnd();return;}
  if(typing){if(k==='Enter'||k==='Escape')t.blur();return;}
  if(k==='ArrowDown'){e.preventDefault();moveCur(1);return;}
  if(k==='ArrowUp'){e.preventDefault();moveCur(-1);return;}
  if(k==='ArrowRight'){e.preventDefault();stepBy(1);return;}
  if(k==='ArrowLeft'){e.preventDefault();stepBy(-1);return;}
  if(k==='Enter'){e.preventDefault();hitCur();return;}
  if(k===' '){e.preventDefault();if(!e.repeat)holdStart();return;}
  if(k>='1'&&k<='4'){e.preventDefault();act('tab',TABS[+k-1].id);return;}
}

/* ─────────── цикл і старт ─────────── */
function loop(){
  if(!alive)return;
  raf=requestAnimationFrame(loop);
  var now=Date.now(),dt=Math.min(.05,(now-(lt||now))/1000);lt=now;
  var k=Math.min(1,dt*4);px+=(tpx-px)*k;py+=(tpy-py)*k;
  if(!bootMode)drawBg(dt);
  if(R&&!bootMode&&$('#lb-stage')){if(spin)PIV.rotation.y+=.008;R.render(RSC,RCAM);}
}
function boot(){
  if(document.getElementById('lobby'))return;
  window.addEventListener('keydown',keyGuard,true);
  window.addEventListener('keyup',keyGuard,true);
  shell();
  document.body.classList.add('lb-on');
  initBg();render();
  var seen=false;try{seen=sessionStorage.getItem(SES_KEY)==='1';}catch(e){}
  if(!seen)coldStart();
  window.addEventListener('mousemove',function(e){
    tpx=(e.clientX/Math.max(1,window.innerWidth)-.5)*2;
    tpy=(e.clientY/Math.max(1,window.innerHeight)-.5)*2;
  });
  window.addEventListener('resize',function(){if(R&&$('#lb-stage'))fitStage();});
  loop();
  setInterval(function(){
    if(!alive)return;
    var b=/(^|\s)boot(\s|$)/.test(document.body.className);
    if(b)sawBoot=true;
    if(sawBoot&&!b)shutdown();
  },150);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
