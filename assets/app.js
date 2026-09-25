
(() => {
  const MAX_LEVEL=10, MIN_LEVEL=0;
  const LEVEL_INFO=[
    {min:0,max:0,label:"Inizio",desc:"Addizioni piccole"},
    {min:1,max:2,label:"Base",desc:"Addizioni e sottrazioni"},
    {min:3,max:4,label:"Tempo",desc:"Orologio"},
    {min:5,max:6,label:"Intermedio",desc:"Moltiplicazioni"},
    {min:7,max:8,label:"Esperto",desc:"Divisioni"},
    {min:9,max:9,label:"Ampio",desc:"Numeri più alti"},
    {min:10,max:10,label:"Adulto",desc:"Mix quotidiano"}
  ];
  const levelInfo=lvl=>LEVEL_INFO.find(t=>lvl>=t.min&&lvl<=t.max)||LEVEL_INFO[LEVEL_INFO.length-1];
  const LS={
    get:function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set:function(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ document.getElementById("storage-warning").classList.remove("hidden"); return false; } }
  };
  document.addEventListener("touchstart",function(){},{passive:true});
  document.addEventListener("contextmenu",function(e){ var t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA")) return; e.preventDefault(); });

  var V2_KEYS={state:"math_training_v2_state",initialized:"math_training_v2_full_auto_initialized",profile:"math_training_v2_profile",history:"math_training_v2_history",skills:"math_training_v2_skills",settings:"math_training_v2_settings"};
  var V1_KEYS=["m_name","m_tutor_name","m_email","m_cap","m_lock","m_mins","m_reached","m_level","m_hist","m_sigs"];
  var V2_CFG={
    mix:{recovery:45,consolidate:25,maintain:20,novel:10},
    masteryDelta:{autonomous:8,second_try:4,hinted:1,shown:-2,wrong:-5,unknown:-8},
    srDays:[1,3,7,14,30,60],
    recentExact:24,recentEquivalent:8,recentMicro:2,
    minAttemptsAcquired:8,slowSec:12,unlockMastery:60,unlockSoftMastery:40,unlockSoftAttempts:6,maxHistory:400
  };
  var PACKS=["addition","subtraction","multiplication","division","clock","money","daily"];
  var PACK_LABEL={addition:"Addizioni",subtraction:"Sottrazioni",multiplication:"Moltiplicazioni",division:"Divisioni",clock:"Orologio",money:"Denaro",daily:"Vita quotidiana"};
  var MASTERY_BANDS=[
    {max:20,id:"none",label:"non ancora allenata"},
    {max:40,id:"emerging",label:"in avvio"},
    {max:60,id:"unstable",label:"ancora instabile"},
    {max:80,id:"consolidating",label:"in consolidamento"},
    {max:95,id:"acquired",label:"solida"},
    {max:100,id:"maintain",label:"da mantenere"}
  ];
  function masteryBand(m){ m=clamp(m,0,100); for(var i=0;i<MASTERY_BANDS.length;i++) if(m<=MASTERY_BANDS[i].max) return MASTERY_BANDS[i]; return MASTERY_BANDS[MASTERY_BANDS.length-1]; }
  function clamp(n,a,b){ n=+n; if(isNaN(n)) n=a; return Math.max(a,Math.min(b,n)); }
  function nowISO(){ return new Date().toISOString(); }
  function daysFrom(iso){ if(!iso) return 999; return (Date.now()-new Date(iso).getTime())/864e5; }
  function addDays(iso,d){ var t=iso?new Date(iso).getTime():Date.now(); return new Date(t+d*864e5).toISOString(); }
  function v2LoadJSON(key, fb){ var raw=LS.get(key); if(!raw) return fb; return JSON.parse(raw); }
  function v2SaveJSON(key, val){ try{ return LS.set(key, JSON.stringify(val)); }catch(e){ return false; } }
  function emptySkillState(){ return {mastery:0,attempts:0,correct:0,wrong:0,autonomousCorrect:0,assistedCorrect:0,hintsUsed:0,consecutiveCorrect:0,consecutiveWrong:0,averageResponseTime:0,lastSeen:null,nextReview:null,reviewInterval:0,srStep:0,lastOutcome:null,workingMax:null,recentWrong:0}; }
  function emptyProfile(){ return {version:2,diagnostic:{count:0,level:1,streak:0},createdAt:nowISO(),updatedAt:nowISO(),skills:{},micros:{},lastSkillId:null,recentSigs:[],recentEq:[],recentMicros:[],forceMode:null}; }
  function defaultPacks(){ return {addition:true,subtraction:true,multiplication:true,division:true,clock:true,money:true,daily:true}; }
  function emptyV2Settings(){ return {name:"",tutorName:"",email:"",cap:MAX_LEVEL,locked:false,mins:2,devMode:false,packs:defaultPacks()}; }
  var storageCorrupt=false;
  var v2Profile=emptyProfile(), v2History=[], v2Settings=emptyV2Settings();
  function ensureSkillState(id){ if(!v2Profile.skills[id]) v2Profile.skills[id]=emptySkillState(); return v2Profile.skills[id]; }
  function ensureMicroState(id){ if(!v2Profile.micros[id]) v2Profile.micros[id]=emptySkillState(); return v2Profile.micros[id]; }

  let NAME="", TUTOR_NAME="", TUTOR="";
  let cap=MAX_LEVEL, locked=false, mins=2, devMode=false, packs=defaultPacks();
  const checkSec=()=>mins*60;
  let level=MIN_LEVEL, reached=MIN_LEVEL;
  let advanceTimer=null, active=false, pausedAt=0, checkpointDue=false, reportText="", focusBeforeModal=null;
  let session=[],cur=null,attempts=0,busy=false,qStart=0,checkTimer=null,replaceNext=false,hintLevel=0,hintsUsed=0;
  const $=id=>document.getElementById(id);
  const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;

  function normalizePacks(p){
    var d=defaultPacks();
    if(!p||typeof p!=="object") return d;
    PACKS.forEach(function(k){ if(typeof p[k]==="boolean") d[k]=p[k]; });
    if(!d.addition && !d.subtraction && !d.multiplication && !d.division && !d.clock && !d.money && !d.daily){ d.addition=true; d.subtraction=true; }
    return d;
  }
  function activePacks(){ return normalizePacks(packs); }

  function packOn(cat){ return !!activePacks()[cat]; }

  function v1Summary(){
    try{
      var records=JSON.parse(LS.get("m_hist")||"[]");
      if(!Array.isArray(records)) return null;
      return {total:records.length,correct:records.filter(function(x){return x&&x.ok===true;}).length};
    }catch(e){return null;}
  }

  function loadV2(){
    try {
      // First launch on the existing V1 URL: clean V2 learning, preserve V1 data and identity.
      if(LS.get(V2_KEYS.initialized)!=="1"){
        v2Profile=emptyProfile(); v2History=[]; v2Settings=emptyV2Settings();
        v2Settings.name=(LS.get("m_name")||"").slice(0,100);
        v2Settings.tutorName=(LS.get("m_tutor_name")||"").slice(0,100);
        var oldEmail=(LS.get("m_email")||"").trim();
        if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oldEmail))v2Settings.email=oldEmail.slice(0,150);
        v2Settings.release="2.10.0";
        if(!saveState()||!LS.set(V2_KEYS.initialized,"1"))throw Error("Impossibile inizializzare il profilo V2.");
        applySettings();return;
      }
      var stored=v2LoadJSON(V2_KEYS.state,null);
      var data=validateBackup(stored||{profile:v2LoadJSON(V2_KEYS.profile,emptyProfile()),history:v2LoadJSON(V2_KEYS.history,[]),settings:v2LoadJSON(V2_KEYS.settings,emptyV2Settings())});
      v2Profile=data.profile; v2History=data.history; v2Settings=data.settings;
    } catch(e){
      storageCorrupt=true;v2Profile=emptyProfile(); v2History=[]; v2Settings=emptyV2Settings();
      document.getElementById("storage-warning").textContent="Dati salvati non validi. Nessun dato sovrascritto: importa un backup valido prima di iniziare.";
      document.getElementById("storage-warning").classList.remove("hidden");
      document.getElementById("btn-start").disabled=true;
    }
    applySettings();
  }
  function applySettings(){
    NAME=v2Settings.name; TUTOR_NAME=v2Settings.tutorName; TUTOR=v2Settings.email;
    cap=v2Settings.cap; mins=v2Settings.mins; locked=false; devMode=false; packs=normalizePacks(v2Settings.packs);
  }

  function saveState(){if(storageCorrupt)return false;return v2SaveJSON(V2_KEYS.state,{release:"2.10.0",profile:v2Profile,history:v2History,settings:v2Settings});}
  function saveV2Profile(){ v2Profile.updatedAt=nowISO(); return saveState(); }
  function saveV2History(){ v2History=v2History.slice(-V2_CFG.maxHistory);return saveState(); }
  function saveV2Settings(){
    v2Settings={release:"2.10.0",name:NAME,tutorName:TUTOR_NAME,email:TUTOR,cap:cap,locked:locked,mins:mins,devMode:devMode,packs:normalizePacks(packs)};
    return saveState();
  }
  function resetV2Profile(){ storageCorrupt=false;$("btn-start").disabled=false;$("storage-warning").classList.add("hidden");v2Profile=emptyProfile(); v2History=[]; saveV2Profile(); saveV2History(); }

  var SKILLS=[
    {id:"add_5",category:"addition",name:"Addizioni entro 5",difficulty:1,prerequisites:[],op:"+"},
    {id:"add_10",category:"addition",name:"Addizioni entro 10",difficulty:2,prerequisites:["add_5"],op:"+"},
    {id:"add_20",category:"addition",name:"Addizioni entro 20",difficulty:3,prerequisites:["add_10"],op:"+"},
    {id:"add_carry",category:"addition",name:"Addizioni con riporto",difficulty:4,prerequisites:["add_10"],op:"+"},
    {id:"add_2digit",category:"addition",name:"Addizioni a due cifre",difficulty:5,prerequisites:["add_20","add_carry"],op:"+"},
    {id:"sub_5",category:"subtraction",name:"Sottrazioni entro 5",difficulty:1,prerequisites:[],op:"-"},
    {id:"sub_10",category:"subtraction",name:"Sottrazioni entro 10",difficulty:2,prerequisites:["sub_5"],op:"-"},
    {id:"sub_20",category:"subtraction",name:"Sottrazioni entro 20",difficulty:3,prerequisites:["sub_10"],op:"-"},
    {id:"sub_borrow",category:"subtraction",name:"Sottrazioni con prestito",difficulty:4,prerequisites:["sub_10"],op:"-"},
    {id:"sub_2digit",category:"subtraction",name:"Sottrazioni a due cifre",difficulty:5,prerequisites:["sub_20","sub_borrow"],op:"-"},
    {id:"mul_2",category:"multiplication",name:"Tabellina del 2",difficulty:5,prerequisites:[],n:2},
    {id:"mul_5",category:"multiplication",name:"Tabellina del 5",difficulty:5,prerequisites:[],n:5},
    {id:"mul_10",category:"multiplication",name:"Tabellina del 10",difficulty:5,prerequisites:[],n:10},
    {id:"mul_3",category:"multiplication",name:"Tabellina del 3",difficulty:6,prerequisites:["mul_2"],n:3},
    {id:"mul_4",category:"multiplication",name:"Tabellina del 4",difficulty:6,prerequisites:["mul_2"],n:4},
    {id:"mul_6",category:"multiplication",name:"Tabellina del 6",difficulty:7,prerequisites:["mul_3"],n:6},
    {id:"mul_7",category:"multiplication",name:"Tabellina del 7",difficulty:7,prerequisites:["mul_2"],n:7},
    {id:"mul_8",category:"multiplication",name:"Tabellina del 8",difficulty:8,prerequisites:["mul_4"],n:8},
    {id:"mul_9",category:"multiplication",name:"Tabellina del 9",difficulty:8,prerequisites:["mul_3"],n:9},
    {id:"mul_mixed",category:"multiplication",name:"Moltiplicazioni miste",difficulty:8,prerequisites:["mul_6","mul_7"]},
    {id:"div_exact_small",category:"division",name:"Divisioni esatte piccole",difficulty:6,prerequisites:[]},
    {id:"div_2",category:"division",name:"Divisioni per 2",difficulty:6,prerequisites:["div_exact_small"],n:2},
    {id:"div_5",category:"division",name:"Divisioni per 5",difficulty:6,prerequisites:["div_exact_small"],n:5},
    {id:"div_10",category:"division",name:"Divisioni per 10",difficulty:6,prerequisites:["div_exact_small"],n:10},
    {id:"div_exact_medium",category:"division",name:"Divisioni esatte medie",difficulty:8,prerequisites:["div_2","div_5"]},
    {id:"div_remainder",category:"division",name:"Divisioni con resto",difficulty:9,prerequisites:["div_exact_medium"]},
    {id:"clock_hour",category:"clock",name:"Ore intere",difficulty:3,prerequisites:[]},
    {id:"clock_half",category:"clock",name:"Ore e mezza",difficulty:4,prerequisites:["clock_hour"]},
    {id:"clock_quarter",category:"clock",name:"Quarti d'ora",difficulty:5,prerequisites:["clock_half"]},
    {id:"clock_5min",category:"clock",name:"Intervalli di 5 minuti",difficulty:6,prerequisites:["clock_quarter"]},
    {id:"clock_minutes",category:"clock",name:"Minuti precisi",difficulty:7,prerequisites:["clock_5min"]},
    {id:"clock_add_30",category:"clock",name:"Tra mezz'ora",difficulty:5,prerequisites:["clock_half"]},
    {id:"clock_add_60",category:"clock",name:"Tra un'ora",difficulty:4,prerequisites:["clock_hour"]},
    {id:"clock_sub_30",category:"clock",name:"Mezz'ora fa",difficulty:6,prerequisites:["clock_add_30"]},
    {id:"clock_sub_60",category:"clock",name:"Un'ora fa",difficulty:5,prerequisites:["clock_add_60"]},
    {id:"clock_interval",category:"clock",name:"Quanto tempo passa",difficulty:7,prerequisites:["clock_minutes"]},
    {id:"clock_daily_context",category:"clock",name:"Orari della giornata",difficulty:6,prerequisites:["clock_hour"]},
    {id:"money_recognize",category:"money",name:"Riconoscere monete",difficulty:3,prerequisites:[]},
    {id:"money_sum",category:"money",name:"Somma di soldi",difficulty:4,prerequisites:["money_recognize"]},
    {id:"money_compare",category:"money",name:"Confrontare importi",difficulty:4,prerequisites:["money_recognize"]},
    {id:"money_total",category:"money",name:"Totale da pagare",difficulty:5,prerequisites:["money_sum"]},
    {id:"money_change",category:"money",name:"Resto",difficulty:6,prerequisites:["money_total"]},
    {id:"money_purchase",category:"money",name:"Acquisto semplice",difficulty:6,prerequisites:["money_change"]},
    {id:"money_budget",category:"money",name:"Budget quotidiano",difficulty:8,prerequisites:["money_purchase"]},
    {id:"time_sequence",category:"daily",name:"Sequenze temporali",difficulty:3,prerequisites:[]},
    {id:"calendar_day",category:"daily",name:"Giorni della settimana",difficulty:3,prerequisites:[]},
    {id:"calendar_date",category:"daily",name:"Date del calendario",difficulty:4,prerequisites:["calendar_day"]},
    {id:"duration",category:"daily",name:"Durate",difficulty:5,prerequisites:["time_sequence"]},
    {id:"quantity",category:"daily",name:"Quantità",difficulty:5,prerequisites:["add_10"]},
    {id:"comparison",category:"daily",name:"Confronti",difficulty:3,prerequisites:["quantity"]},
    {id:"simple_problem",category:"daily",name:"Problema semplice",difficulty:6,prerequisites:["add_20","sub_20"]},
    {id:"real_life_problem",category:"daily",name:"Problema quotidiano",difficulty:8,prerequisites:["simple_problem"]}
  ];
  var SKILL_BY_ID={}; SKILLS.forEach(function(s){ SKILL_BY_ID[s.id]=s; });
  function skillById(id){ return Object.hasOwn(SKILL_BY_ID,id)?SKILL_BY_ID[id]:null; }
  function implementedSkills(){ return SKILLS.filter(function(s){ return packOn(s.category); }); }
  function skillUnlocked(skill){
    if(!skill.prerequisites||!skill.prerequisites.length) return true;
    return skill.prerequisites.every(function(pid){
      var st=ensureSkillState(pid);
      if(st.mastery>=V2_CFG.unlockMastery) return true;
      if(st.attempts>=V2_CFG.unlockSoftAttempts && st.mastery>=V2_CFG.unlockSoftMastery) return true;
      var prereq=skillById(pid);
      if(prereq && !packOn(prereq.category)) return true;
      return false;
    });
  }
  function skillAllowedByCap(skill){ return skill.difficulty<=Math.max(1,cap); }

  function hasCarry(a,b){ return (a%10)+(b%10)>=10; }
  function hasBorrow(a,b){ return (a%10)<(b%10); }
  function hhmm(h,m){ return String((h+24)%24).padStart(2,"0")+":"+String(((m%60)+60)%60).padStart(2,"0"); }
  function clockAllowed(h,m){
    var t=hhmm(h,m), h24=(h+24)%24, mm=((m%60)+60)%60;
    var a=[t, h24+":"+String(mm).padStart(2,"0")];
    if(mm===0){ a.push(String(h24), String(h24).padStart(2,"0")); }
    return a;
  }
  function itemBase(skill, text, target, allowed, hints, extra){
    extra=extra||{};
    return {
      text:text, target:String(target), allowed:(allowed||[String(target)]).map(String),
      cat:PACK_LABEL[skill.category]||skill.category,
      hint:hints[0]||"", hints:hints,
      a:extra.a||0, b:extra.b||0, op:extra.op||"",
      kind:skill.category, skillId:skill.id,
      microId:extra.micro||(skill.id+"|"+target),
      sig:extra.sig||(skill.id+"|"+text),
      eqSig:extra.eq||extra.micro||(skill.id+"|"+target),
      structure:extra.structure||skill.id,
      localDifficulty:extra.diff||skill.difficulty
    };
  }

  function genAddSub(skill){
    var a=1,b=1,tries=0;
    while(tries++<80){
      if(skill.id==="add_5"){ a=rand(1,4); b=rand(1,5-a); }
      else if(skill.id==="add_10"){ a=rand(1,9); b=rand(1,Math.max(1,10-a)); if(a+b<=5&&Math.random()<0.7) continue; }
      else if(skill.id==="add_20"){ a=rand(2,15); b=rand(1,Math.max(1,20-a)); if(a+b<=10&&Math.random()<0.65) continue; }
      else if(skill.id==="add_carry"){ var x=rand(1,9), y=rand(10-x,9); a=rand(0,1)*10+x; b=rand(0,1)*10+y; if(!hasCarry(a,b)) continue; }
      else if(skill.id==="add_2digit"){ a=rand(10,40); b=rand(10,40); }
      else if(skill.id==="sub_5"){ a=rand(2,5); b=rand(1,a); }
      else if(skill.id==="sub_10"){ a=rand(3,10); b=rand(1,a); if(a<=5&&Math.random()<0.6) continue; }
      else if(skill.id==="sub_20"){ a=rand(6,20); b=rand(1,a); if(a<=10&&Math.random()<0.6) continue; }
      else if(skill.id==="sub_borrow"){ var ones=rand(0,8), subOnes=rand(ones+1,9); a=rand(1,2)*10+ones; b=rand(0,Math.floor(a/10))*10+subOnes; if(b>=a||!hasBorrow(a,b)) continue; }
      else if(skill.id==="sub_2digit"){ a=rand(15,40); b=rand(10,a-1); }
      else return null;
      if(skill.op==="-"&&b>=a) continue;
      var target=skill.op==="+"?a+b:a-b;
      var op=skill.op;
      var hints=op==="+"?[a+" e ancora "+b,"Parti da "+a+" e conta "+b+" in più",a+" + "+b+" = "+target]:["Da "+b+" quanto manca a "+a,"Parti da "+a+" e togli "+b,a+" − "+b+" = "+target];
      return itemBase(skill, a+" "+op+" "+b+" = ?", target, [String(target)], hints, {
        a:a,b:b,op:op,micro:(op==="+"?op+"|"+Math.min(a,b)+"|"+Math.max(a,b):op+"|"+a+"|"+b),
        sig:op+"|"+a+"|"+b, structure:op==="+"?(hasCarry(a,b)?"add_carry":"add_plain"):(hasBorrow(a,b)?"sub_borrow":"sub_plain")
      });
    }
    // Deterministic fallback remains in the requested operation and difficulty.
    var fa=skill.id==="sub_borrow"?12:skill.id==="sub_2digit"?22:skill.op==="-"?4:2;
    var fb=skill.id==="sub_borrow"?3:skill.id==="sub_2digit"?11:2;
    var ft=skill.op==="-"?fa-fb:fa+fb;
    return itemBase(skill,fa+" "+skill.op+" "+fb+" = ?",ft,[String(ft)],["Procedi un passo alla volta."],{a:fa,b:fb,op:skill.op});
  }
  function genMul(skill){
    var a,b;
    if(skill.id==="mul_mixed"){ a=rand(2,9); b=rand(2,9); }
    else { a=skill.n||2; b=rand(2,10); if(Math.random()<0.5){ var t=a; a=b; b=t; } }
    var target=a*b;
    return itemBase(skill, a+" x "+b+" = ?", target, [String(target)], [a+" per "+b, "Somma "+a+" per "+b+" volte", a+" x "+b+" = "+target], {a:a,b:b,op:"*",micro:"*|"+Math.min(a,b)+"|"+Math.max(a,b),sig:"*|"+a+"|"+b});
  }
  function genDiv(skill){
    var b,res,a,r=0;
    if(skill.id==="div_remainder"){
      b=rand(3,9); res=rand(2,8); r=rand(1,b-1); a=b*res+r;
      return itemBase(skill, a+" : "+b+" resto = ?", r, [String(r)], ["Quante volte sta "+b+" in "+a+", poi il resto", b+" x "+res+" = "+(b*res)+", avanza "+r, "Resto "+r], {a:a,b:b,op:"/",micro:"%/|"+a+"|"+b,structure:"div_rem"});
    }
    if(skill.n){ b=skill.n; res=rand(2,10); }
    else if(skill.id==="div_exact_medium"){ b=rand(3,9); res=rand(6,12); }
    else { b=rand(2,5); res=rand(2,6); }
    a=b*res;
    return itemBase(skill, a+" : "+b+" = ?", res, [String(res)], [b+" x ? = "+a, "Quante volte sta "+b+" in "+a, a+" : "+b+" = "+res], {a:a,b:b,op:"/",micro:"/|"+a+"|"+b});
  }
  function genClock(skill){
    var h,m,nh,nm,delta=0,text,hints;
    if(["clock_hour","clock_half","clock_quarter","clock_5min","clock_minutes"].includes(skill.id)){
      h=rand(1,12);m=skill.id==="clock_hour"?0:skill.id==="clock_half"?30:skill.id==="clock_quarter"?[15,45][rand(0,1)]:skill.id==="clock_5min"?rand(0,11)*5:rand(0,59);
      var reading=itemBase(skill,"Che ora segna l’orologio?",hhmm(h,m),clockAllowed(h,m),["La lancetta corta indica le ore.","La lancetta lunga indica i minuti. Ogni numero vale 5 minuti."],{structure:"clock_read",sig:skill.id+"|"+h+"|"+m});
      reading.clock={h:h,m:m};return reading;
    }
    if(skill.id==="clock_hour"){ h=rand(8,18); m=0; delta=rand(1,3)*60; }
    else if(skill.id==="clock_half"){ h=rand(8,18); m=Math.random()<0.5?0:30; delta=30; }
    else if(skill.id==="clock_quarter"){ h=rand(8,18); m=[0,15,30,45][rand(0,3)]; delta=15; }
    else if(skill.id==="clock_5min"){ h=rand(8,18); m=rand(0,11)*5; delta=5; }
    else if(skill.id==="clock_minutes"){ h=rand(8,18); m=rand(0,59); delta=rand(3,20); }
    else if(skill.id==="clock_add_30"){ h=rand(8,18); m=Math.random()<0.5?0:30; delta=30; }
    else if(skill.id==="clock_add_60"){ h=rand(8,18); m=0; delta=60; }
    else if(skill.id==="clock_sub_30"){ h=rand(8,18); m=Math.random()<0.5?0:30; delta=-30; }
    else if(skill.id==="clock_sub_60"){ h=rand(9,18); m=0; delta=-60; }
    else if(skill.id==="clock_interval"){
      h=rand(8,16); m=[0,15,30][rand(0,2)]; var h2=h+rand(1,3); var m2=[0,15,30][rand(0,2)];
      var mins=((h2*60+m2)-(h*60+m));
      return itemBase(skill, "Dalle "+hhmm(h,m)+" alle "+hhmm(h2,m2)+" passano ? minuti", mins, [String(mins)], ["Conta le ore e i minuti","Da "+hhmm(h,m)+" a "+hhmm(h2,m2), mins+" minuti"], {structure:"interval"});
    }
    else {
      var ctx=[{n:"colazione",h:8},{n:"pranzo",h:13},{n:"merenda",h:16},{n:"cena",h:20}][rand(0,3)];
      delta=[30,60][rand(0,1)]; h=ctx.h; m=0;
      text="È l'ora di "+ctx.n+" ("+hhmm(h,m)+"). Tra "+(delta===60?"1 ora":"mezz'ora")+" che ora sarà?";
      nh=h+Math.floor(delta/60); nm=m+(delta%60); if(nm>=60){ nh++; nm-=60; }
      return itemBase(skill, text, hhmm(nh,nm), clockAllowed(nh,nm), ["Parti da "+hhmm(h,m),"Aggiungi "+(delta===60?"un'ora":"30 minuti"), hhmm(nh,nm)], {structure:"daily_clock"});
    }
    var start=hhmm(h,m);
    var tot=h*60+m+delta; if(tot<0) tot+=24*60;
    nh=Math.floor(tot/60)%24; nm=tot%60;
    var lab=delta<0?(delta===-60?"un'ora fa":"mezz'ora fa"):(delta===60?"1 ora":delta===30?"mezz'ora":delta+" minuti");
    text=delta<0?("Sono le "+start+". "+(delta===-60?"Un'ora fa":"Mezz'ora fa")+" che ora era?"):("Sono le "+start+". Tra "+lab+", che ora sarà?");
    hints=["Parti da "+start, (delta<0?"Togli ":"Aggiungi ")+lab, hhmm(nh,nm)];
    return itemBase(skill, text, hhmm(nh,nm), clockAllowed(nh,nm), hints, {structure:skill.id,sig:skill.id+"|"+start+"|"+delta});
  }
  function genMoney(skill){
    var coins=[1,2,5,10];
    if(skill.id==="money_recognize"){
      var c=coins[rand(0,3)], type=c<=2?"moneta":"banconota";
      var item=itemBase(skill,"Quanto vale questa "+type+"?",c,[String(c)],["Guarda il numero raffigurato.","Scrivi solo il numero, senza il simbolo euro."],{micro:"coin|"+c});
      item.money={value:c,type:type};return item;
    }
    if(skill.id==="money_sum"){ var x=coins[rand(0,2)], y=coins[rand(0,2)]; return itemBase(skill,x+" euro + "+y+" euro = ?",x+y,[String(x+y)],[x+" e ancora "+y, String(x+y)+" euro"],{a:x,b:y,op:"+"}); }
    if(skill.id==="money_compare"){ var p=rand(2,9), q=rand(1,p-1); return itemBase(skill,p+" euro e "+q+" euro. Quanti euro in più il primo?",p-q,[String(p-q)],["Togli il più piccolo dal più grande", (p-q)+" euro"],{a:p,b:q,op:"-"}); }
    if(skill.id==="money_total"){ var n=rand(2,4), price=rand(2,5); return itemBase(skill,n+" cose da "+price+" euro. Totale?",n*price,[String(n*price)],[price+" per "+n+" volte", String(n*price)+" euro"],{a:n,b:price,op:"*"}); }
    if(skill.id==="money_change"){ var pay=[10,20][rand(0,1)], cost=rand(3,pay-1); return itemBase(skill,"Costa "+cost+" euro. Pago "+pay+". Resto?",pay-cost,[String(pay-cost)],["Da "+cost+" a "+pay, String(pay-cost)+" euro"],{a:pay,b:cost,op:"-"}); }
    if(skill.id==="money_purchase"){ var a=rand(2,6), b=rand(2,6), pay=20; var tot=a+b; return itemBase(skill,"Due cose: "+a+" e "+b+" euro. Pago 20. Resto?",pay-tot,[String(pay-tot)],["Prima "+a+"+"+b+" = "+tot,"Poi 20 − "+tot, String(pay-tot)+" euro"],{structure:"purchase"}); }
    var budget=rand(8,15), spent=rand(2,budget-1); return itemBase(skill,"Ho "+budget+" euro. Spendo "+spent+". Rimangono?",budget-spent,[String(budget-spent)],["Togli "+spent+" da "+budget, String(budget-spent)+" euro"],{a:budget,b:spent,op:"-"});
  }
  function genDaily(skill){
    if(skill.id==="time_sequence"){ var h1=rand(7,16); var add=rand(1,3); return itemBase(skill,"Sono le "+h1+". Tra "+add+(add===1?" ora":" ore")+", che ora è? (solo ora)",(h1+add)%24,[String((h1+add)%24)],["Aggiungi "+add+" ore", String((h1+add)%24)],{structure:"seq"}); }
    if(skill.id==="calendar_day"){
      var days=["lunedì","martedì","mercoledì","giovedì","venerdì","sabato","domenica"];
      var i=rand(0,6), add=rand(1,3), j=(i+add)%7;
      return itemBase(skill, days[i]+" + "+add+" giorni. Che giorno? (1 lun … 7 dom)", j+1, [String(j+1)], ["Conta "+add+" giorni dopo "+days[i], days[j]+" = "+(j+1)], {micro:"dow|"+i+"|"+add});
    }
    if(skill.id==="calendar_date"){ var d=rand(5,20), add=rand(1,5); return itemBase(skill,"Sul calendario siamo al giorno "+d+". Dopo "+add+" giorni, che numero di giorno sarà?",d+add,[String(d+add)],["Aggiungi "+add+" al "+d, String(d+add)],{a:d,b:add,op:"+"}); }
    if(skill.id==="duration"){ var h=rand(1,4); return itemBase(skill,h+(h===1?" ora":" ore")+" = ? minuti",h*60,[String(h*60)],["1 ora = 60 minuti", String(h*60)],{a:h,op:"h"}); }
    if(skill.id==="quantity"){ var n=rand(2,5), q=rand(2,6); return itemBase(skill,n+" gruppi da "+q+". Totale?",n*q,[String(n*q)],[n+" per "+q, String(n*q)],{a:n,b:q,op:"*"}); }
    if(skill.id==="comparison"){ var a=rand(6,20), b=rand(1,a-1); return itemBase(skill,a+" è più grande di "+b+" di quanto?",a-b,[String(a-b)],[a+" − "+b, String(a-b)],{a:a,b:b,op:"-"}); }
    if(skill.id==="simple_problem"){ var a=rand(4,12), b=rand(2,8); if(Math.random()<0.5) return itemBase(skill,"Ho "+a+" mele. Ne prendo "+b+". Totale?",a+b,[String(a+b)],[a+" + "+b, String(a+b)],{a:a,b:b,op:"+"}); return itemBase(skill,"Ho "+(a+b)+" caramelle. Ne do "+b+". Restano?",a,[String(a)],[(a+b)+" − "+b, String(a)],{a:a+b,b:b,op:"-"}); }
    var price=rand(2,6), n=rand(2,4), pay=Math.ceil(n*price/10)*10; return itemBase(skill,"Compro "+n+" cose da "+price+" euro. Pago "+pay+". Resto?",pay-n*price,[String(pay-n*price)],["Prima "+n+" x "+price+" = "+(n*price),"Poi "+pay+" − "+(n*price), String(pay-n*price)],{structure:"real"});
  }
  function generateForSkill(skill, avoid){
    avoid=avoid||{};
    var tries=0, best=null;
    while(tries++<50){
      var item=null;
      if(skill.category==="addition"||skill.category==="subtraction") item=genAddSub(skill);
      else if(skill.category==="multiplication") item=genMul(skill);
      else if(skill.category==="division") item=genDiv(skill);
      else if(skill.category==="clock") item=genClock(skill);
      else if(skill.category==="money") item=genMoney(skill);
      else item=genDaily(skill);
      if(!item) break;
      best=item;
      if(avoid.sigs && avoid.sigs.indexOf(item.sig)>=0) continue;
      if(avoid.eq && avoid.eq.indexOf(item.eqSig)>=0 && tries<30) continue;
      if(avoid.micros && avoid.micros.indexOf(item.microId)>=0 && tries<20) continue;
      best=item; break;
    }
    if(!best) throw new Error("Generatore non disponibile: "+skill.id);
    return best;
  }

  function classifySkill(skill, st){
    var overdue=st.nextReview && new Date(st.nextReview).getTime()<=Date.now();
    if(st.attempts<3 && skillUnlocked(skill)) return "novel";
    if(st.mastery<=40 || st.consecutiveWrong>0 || st.recentWrong>=2) return "recovery";
    if(st.mastery<=80) return "consolidate";
    if(overdue || st.mastery>=81) return "maintain";
    return "consolidate";
  }
  function priorityScore(skill, st){
    var score=10;
    score += (100-st.mastery)*0.45;
    if(st.consecutiveWrong>0) score += 18*st.consecutiveWrong;
    if(st.recentWrong>0) score += 10*st.recentWrong;
    if(st.lastSeen) score += Math.min(25, daysFrom(st.lastSeen)*3); else score += 20;
    if(st.nextReview && new Date(st.nextReview).getTime()<=Date.now()) score += 16 + Math.min(20, daysFrom(st.nextReview)*2);
    if(st.averageResponseTime>=V2_CFG.slowSec) score += 8;
    if(st.attempts && st.hintsUsed/Math.max(1,st.attempts)>0.4) score += 10;
    if(masteryBand(st.mastery).id==="unstable") score += 12;
    if(v2Profile.lastSkillId===skill.id) score -= 16;
    if(st.lastSeen && daysFrom(st.lastSeen)<0.01) score -= 12;
    if(st.mastery>=81 && st.consecutiveCorrect>=3) score -= 14;
    // Punteggio deterministico: la varietà è applicata nella selezione.
    return score;
  }
  function pickBucket(){
    if(v2Profile.forceMode==="easy") return "recovery";
    if(v2Profile.forceMode==="review") return "maintain";
    if(v2Profile.forceMode==="novel") return "novel";
    var r=Math.random()*100, m=V2_CFG.mix;
    if(r<m.recovery) return "recovery";
    if(r<m.recovery+m.consolidate) return "consolidate";
    if(r<m.recovery+m.consolidate+m.maintain) return "maintain";
    return "novel";
  }
  function selectSkill(){
    var allAllowed=implementedSkills().filter(function(s){ return skillAllowedByCap(s); });
    var pool=allAllowed.filter(function(s){
      if(!skillUnlocked(s)) return false;
      if(ensureSkillState(s.id).attempts>0 || s.difficulty<=2) return true;
      var seen=allAllowed.filter(function(t){var st=ensureSkillState(t.id);return st.autonomousCorrect>=2;});
      var frontier=seen.reduce(function(n,t){return Math.max(n,t.difficulty+1);},2);
      return s.difficulty<=frontier;
    });

    // Prima esplorazione adattiva: parte facile e sale solo quando le risposte
    // mostrano che il gradino corrente è gestibile. Un errore fa scendere di un
    // gradino; gli aiuti non fanno salire. In questo modo il test non parte mai
    // direttamente dalle competenze più difficili.
    var diagnostic=v2Profile.diagnostic.count<30 && !v2Profile.forceMode;
    if(diagnostic){
      var target=v2Profile.diagnostic.level;
      // Use exactly the current available tier; lower-tier successes cannot push it up.
      var available=[...new Set(allAllowed.map(s=>s.difficulty))].sort((a,b)=>a-b);
      var tier=available.filter(n=>n<=target).pop()||available[0];
      var choices=allAllowed.filter(s=>s.difficulty===tier);
      var last=v2Profile.lastSkillId && skillById(v2Profile.lastSkillId);
      var varied=last?choices.filter(function(s){return s.category!==last.category;}):choices;
      if(varied.length) choices=varied;
      choices.sort(function(a,b){
        var da=Math.abs(a.difficulty-target), db=Math.abs(b.difficulty-target);
        if(da!==db) return da-db;
        return ensureSkillState(a.id).attempts-ensureSkillState(b.id).attempts;
      });
      var near=choices.slice(0,Math.min(5,choices.length));
      if(near.length) return near[rand(0,near.length-1)];
    }

    if(!pool.length) pool=allAllowed;
    if(!pool.length) throw Error("Nessuna competenza disponibile: alza il limite di difficoltà.");
    var bucket=pickBucket(), order=[bucket,"recovery","consolidate","maintain","novel"], seen={};
    for(var i=0;i<order.length;i++){
      var b=order[i]; if(seen[b]) continue; seen[b]=1;
      var cand=pool.filter(function(s){ return classifySkill(s, ensureSkillState(s.id))===b; });
      if(!cand.length) continue;
      cand.sort(function(a,c){ return priorityScore(c,ensureSkillState(c.id))-priorityScore(a,ensureSkillState(a.id)); });
      var top=cand.slice(0, Math.max(2, Math.min(4, cand.length)));
      return top[rand(0, top.length-1)];
    }
    return pool[rand(0, pool.length-1)];
  }
  function selectQuestion(){
    var skill=selectSkill();
    var item=generateForSkill(skill, {sigs:v2Profile.recentSigs.slice(-V2_CFG.recentExact),eq:v2Profile.recentEq.slice(-V2_CFG.recentEquivalent),micros:v2Profile.recentMicros.slice(-V2_CFG.recentMicro)});
    v2Profile.lastSkillId=skill.id;
    return item;
  }

  function applyDelta(st, delta, sec, outcome, hintsN){
    st.attempts++; st.lastSeen=nowISO(); st.lastOutcome=outcome; st.hintsUsed += hintsN||0;
    st.averageResponseTime = st.attempts===1 ? sec : Math.round(((st.averageResponseTime*(st.attempts-1))+sec)*10/st.attempts)/10;
    if(outcome==="autonomous"||outcome==="second_try"||outcome==="hinted"){
      st.correct++; st.consecutiveCorrect++; st.consecutiveWrong=0; st.recentWrong=Math.max(0,(st.recentWrong||0)-1);
      if(outcome==="autonomous") st.autonomousCorrect++; else st.assistedCorrect++;
    } else { st.wrong++; st.consecutiveWrong++; st.consecutiveCorrect=0; st.recentWrong=(st.recentWrong||0)+1; }
    st.mastery=clamp(st.mastery+delta,0,100);
  }
  function updateSpacedRepetition(st, okAuto){
    if(okAuto && st.mastery>=61 && st.attempts>=3){ st.srStep=st.nextReview?Math.min(V2_CFG.srDays.length-1,(st.srStep||0)+1):0; st.reviewInterval=V2_CFG.srDays[st.srStep]; st.nextReview=addDays(nowISO(), st.reviewInterval); }
    else if(!okAuto){ st.srStep=Math.max(0,(st.srStep||0)-1); st.reviewInterval=V2_CFG.srDays[st.srStep]; st.nextReview=addDays(nowISO(), st.reviewInterval||1); }
  }
  function advanceDiagnostic(d,outcome,difficulty){
    if(d.count>=30)return;d.count++;
    if(outcome==="autonomous"){if(difficulty!=null&&difficulty<d.level)return;d.streak++;if(d.streak>=3){d.level=Math.min(10,d.level+1);d.streak=0;}}
    else {d.streak=0;if(["wrong","unknown","shown"].includes(outcome))d.level=Math.max(1,d.level-1);}
  }
  function evaluateOutcome(ok, attempts, hintsN, unknown, shown){
    if(unknown) return "unknown"; if(shown) return "shown"; if(!ok) return "wrong"; if(hintsN>0) return "hinted"; if(attempts===1) return "autonomous"; return "second_try";
  }
  function learnFromItem(item, user, ok, sec, attempts, hintsN, unknown, shown){
    var outcome=evaluateOutcome(ok, attempts, hintsN, unknown, shown);
    var phaseBefore=v2Profile.diagnostic.count<30?"quadro_iniziale":"allenamento_adattivo";
    var tierBefore=v2Profile.diagnostic.level;
    advanceDiagnostic(v2Profile.diagnostic,outcome,skillById(item.skillId).difficulty);
    var delta=V2_CFG.masteryDelta[outcome]; if(typeof delta!=="number") delta=0;
    var st=ensureSkillState(item.skillId), micro=ensureMicroState(item.microId);
    applyDelta(st, delta, sec, outcome, hintsN); applyDelta(micro, delta, sec, outcome, hintsN);
    updateSpacedRepetition(st, outcome==="autonomous"); updateSpacedRepetition(micro, outcome==="autonomous");
    v2Profile.recentSigs.push(item.sig); if(v2Profile.recentSigs.length>60) v2Profile.recentSigs.shift();
    v2Profile.recentEq.push(item.eqSig); if(v2Profile.recentEq.length>40) v2Profile.recentEq.shift();
    v2Profile.recentMicros.push(item.microId); if(v2Profile.recentMicros.length>20) v2Profile.recentMicros.shift();
    var rec={ts:nowISO(),skillId:item.skillId,microId:item.microId,sig:item.sig,eqSig:item.eqSig,structure:item.structure,q:item.text,user:user,correct:item.target,ok:!!ok,sec:sec,att:attempts,hintsUsed:hintsN||0,hintLevel:item.hintLevel||0,outcome:outcome,autonomous:outcome==="autonomous",masteryAfter:st.mastery,phase:phaseBefore,difficulty:skillById(item.skillId).difficulty,tierBefore:tierBefore,tierAfter:v2Profile.diagnostic.level,mode:v2Profile.forceMode||"automatico"};
    v2History.push(rec); v2History=v2History.slice(-V2_CFG.maxHistory); saveV2Profile(); saveV2History(); return rec;
  }

  function skillSnapshot(){
    return implementedSkills().map(function(s){ var st=ensureSkillState(s.id); return {skill:s,st:st,band:masteryBand(st.mastery),priority:Math.round(priorityScore(s,st)),bucket:classifySkill(s,st)}; });
  }
  function parentReportLines(){
    var rows=skillSnapshot();
    var acquired=rows.filter(function(r){ return r.st.attempts>=V2_CFG.minAttemptsAcquired && r.st.mastery>=81; });
    var unstable=rows.filter(function(r){ return r.st.attempts>0 && r.st.mastery<=60; });
    var review=rows.filter(function(r){ return r.st.nextReview && new Date(r.st.nextReview).getTime()<=Date.now(); });
    var recent=v2History.slice(-12);
    var lines=["Allenamento osservato (non è una valutazione clinica)."];
    lines.push("Percorso V2: "+(v2Profile.diagnostic.count<30?"quadro iniziale "+v2Profile.diagnostic.count+"/30 · gradino "+v2Profile.diagnostic.level:"allenamento adattivo continuo")+" · modalità "+(v2Profile.forceMode||"automatica")+" · limite "+cap+"/10");
    var old=v1Summary();if(old&&old.total)lines.push("Storico V1 conservato separatamente: "+old.total+" esercizi, "+old.correct+" corretti.");
    lines.push("Competenze più solide: "+(acquired.map(function(r){return r.skill.name;}).join(", ")||"ancora nessuna con abbastanza prove"));
    lines.push("Da rinforzare: "+(unstable.map(function(r){return r.skill.name;}).join(", ")||"nessuna evidenza recente"));
    lines.push("Da ripassare: "+(review.map(function(r){return r.skill.name;}).join(", ")||"nessuna in scadenza"));
    var errs=recent.filter(function(x){ return !x.ok; });
    lines.push("Errori recenti: "+(errs.map(function(x){return x.q+" → "+x.user;}).join("; ")||"nessuno in questa finestra"));
    lines.push("Aiuti usati (ultime domande): "+recent.reduce(function(a,x){return a+(x.hintsUsed||0);},0));
    var timed=recent.filter(function(x){return x.sec;});
    var avg=timed.length?Math.round(timed.reduce(function(a,x){return a+x.sec;},0)/timed.length):0;
    lines.push("Tempo medio recente: "+(avg?avg+"s":"—"));
    return lines;
  }

  function resetTheme(){ var top=document.querySelector('.pane-top'); if(top) top.classList.remove('tone-ok','tone-warn','tone-err'); }
  function theme(k){ resetTheme(); var top=document.querySelector('.pane-top'); if(top&&k) top.classList.add('tone-'+k); }
  function derivedLevel(){
    var used=implementedSkills().map(function(s){ return ensureSkillState(s.id); }).filter(function(s){ return s.attempts>0; });
    if(!used.length) return MIN_LEVEL;
    return clamp(Math.round(used.reduce(function(a,s){return a+s.mastery;},0)/used.length/10), MIN_LEVEL, cap);
  }
  function show(id){ ["screen-menu","screen-ex","screen-end","screen-set","screen-tutor"].forEach(function(s){ var el=$(s); if(el) el.classList.toggle("hidden",s!==id); }); $("card").classList.toggle("is-ex",id==="screen-ex"); if(id==="screen-menu") updateMini(); if(id==="screen-set") fillSettings(); if(id==="screen-tutor"){ try{ refreshTutorDashboard(); }catch(e){ console.error("Tutor dashboard:",e); var pr=$("tutor-priorities"); if(pr) pr.innerHTML="<p>Dashboard non disponibile: dati in aggiornamento.</p>"; } } }
  function updateMini(){
    $("coach-text").textContent=NAME?("Ciao "+NAME+"! Pronto a giocare?"):"Ciao! Pronto a giocare?";
    var hint=$("menu-hint");
    if(hint) hint.textContent="Puoi fermarti quando vuoi con «Per oggi basta»: ogni "+mins+" minut"+(mins===1?"o":"i")+" te lo chiederò anch’io.";
  }
  function updateLevelUI(){ level=derivedLevel(); if(level>reached) reached=level; }
  function getAns(){ const el=$("ans"); return el.classList.contains("empty")?"":(el.textContent||"").trim(); }
  function setAns(v){ const el=$("ans"); if(!v){ el.textContent="Risposta"; el.classList.add("empty"); } else { el.textContent=v; el.classList.remove("empty"); } }





  function syncSetSliders(){
    $("set-cap").value=cap; $("set-cap-num").textContent=Math.max(1,cap)+"/10";
    $("set-mins").value=mins; $("set-mins-num").textContent=mins+" min";
    $("set-level-desc").textContent="Limita la difficoltà degli esercizi. Il percorso parte dalle basi e si adatta alle risposte.";
  }

  function fillSettings(){
    $("set-name").value=NAME; $("set-tutor-name").value=TUTOR_NAME; $("set-email").value=TUTOR;
    syncSetSliders(); refreshTutorPanel();
    $("pack-options").innerHTML=PACKS.map(function(k){return '<label class="chk"><input type="checkbox" data-pack="'+k+'" '+(packs[k]?'checked':'')+'>'+PACK_LABEL[k]+'</label>';}).join('');
  }

  function currentHint(){
    if(!cur) return "";
    var n=hintLevel,a=cur.a,b=cur.b,id=cur.skillId;
    // Hints are instructions, never a solved expression or a target string.
    if(cur.op==="+") return n===1?"Parti dal numero più grande.":"Conta avanti di "+Math.min(a,b)+".";
    if(cur.op==="-") return n===1?"Parti dal numero più grande.":"Togli "+b+", un passo alla volta.";
    if(cur.op==="*") return n===1?"Pensa a gruppi tutti uguali.":"Somma "+b+" per "+a+" volte.";
    if(cur.op==="/") return cur.structure==="div_rem"?(n===1?"Forma gruppi da "+b+".":"Il resto è ciò che rimane fuori dai gruppi."):(n===1?"Usa la tabellina al contrario.":b+" × quale numero = "+a+"?");
    if(id==="duration") return n===1?"Trasforma le ore in gruppi di minuti.":a===1?"Conta i minuti di un giro completo.":a+" × 60 = ?";
    if(cur.kind==="clock"){
      if(cur.clock)return n===1?"La lancetta corta indica le ore.":"Per i minuti, conta di 5 con la lancetta lunga.";
      if(cur.structure==="interval")return n===1?"Conta il tempo dall’inizio alla fine.":"Conta prima le ore, poi aggiungi i minuti.";
      return n===1?"Tieni separate ore e minuti.":id.includes("sub")?"Torna indietro del tempo indicato.":"Vai avanti del tempo indicato.";
    }
    if(id==="money_recognize")return n===1?"Cerca il numero sul denaro.":"Scrivi solo il valore, senza la parola euro.";
    if(id==="money_purchase"||id==="real_life_problem")return n===1?"Trova prima la spesa totale.":"Togli la spesa dalla cifra pagata.";
    if(id==="calendar_day")return n===1?"Parti dal giorno indicato e conta avanti.":"1 lun · 2 mar · 3 mer · 4 gio · 5 ven · 6 sab · 7 dom";
    if(id==="time_sequence")return n===1?"Parti dall’ora indicata.":"Conta avanti di un’ora alla volta.";
    return n===1?"Trova i numeri utili.":"Fai un passaggio alla volta.";
  }

  function showHintFeedback(kind){
    var fb=$("fb"); theme(kind); fb.className="fb fb-"+kind+(kind==="warn"?" fb-anim-sad1":" fb-anim-err");
    fb.textContent=kind==="warn"?currentHint():"La risposta è "+cur.target+". Leggi con calma, poi premi Avanti.";
  }

  function nextQ(){
    if(!active) return;
    clearTimeout(advanceTimer); cur=selectQuestion(); attempts=0; hintLevel=0; hintsUsed=0; if(cur) cur.hintLevel=0;
    var visual=$("question-visual");visual.innerHTML="";visual.classList.toggle("hidden",!cur.clock&&!cur.money);
    if(cur.clock){
      var c=cur.clock,marks=Array.from({length:12},(_,i)=>{var a=(i+1)*Math.PI/6;return '<text x="'+(80+59*Math.sin(a))+'" y="'+(85-59*Math.cos(a))+'" text-anchor="middle">'+(i+1)+'</text>';}).join('');
      visual.innerHTML='<svg viewBox="0 0 160 160" role="img" aria-label="Orologio analogico da leggere"><circle cx="80" cy="80" r="76" fill="white" stroke="#ceccdf" stroke-width="2"/>'+marks+'<line x1="80" y1="80" x2="80" y2="41" stroke="#353348" stroke-width="6" stroke-linecap="round" transform="rotate('+(c.h*30+c.m*.5)+' 80 80)"/><line x1="80" y1="80" x2="80" y2="24" stroke="#5e5ce6" stroke-width="4" stroke-linecap="round" transform="rotate('+(c.m*6)+' 80 80)"/><circle cx="80" cy="80" r="5" fill="#353348"/></svg>';
    }
    if(cur.money){
      var amount=cur.money.value;
      visual.innerHTML=amount<=2
        ?'<svg viewBox="0 0 160 160" role="img" aria-label="Moneta con cifra visibile"><circle cx="80" cy="80" r="73" fill="#dbd7bd" stroke="#9d9372" stroke-width="7"/><circle cx="80" cy="80" r="59" fill="#f5edcf" stroke="#ae9e72" stroke-width="2"/><text x="80" y="97" text-anchor="middle" font-size="54" fill="#38354c">'+amount+' €</text></svg>'
        :'<svg viewBox="0 0 160 160" role="img" aria-label="Banconota con cifra visibile"><rect x="5" y="28" width="150" height="104" rx="8" fill="#d5e9dd" stroke="#43816c" stroke-width="5"/><rect x="15" y="39" width="130" height="82" rx="5" fill="none" stroke="#43816c" stroke-width="2"/><text x="80" y="100" text-anchor="middle" font-size="54" fill="#245442">'+amount+' €</text></svg>';
    }
    const qel=$("qtext"); qel.textContent=cur.text; qel.classList.remove("anim-pop"); void qel.offsetWidth; qel.classList.add("anim-pop");
    $("exercise-context").textContent=cur.cat;
    $("answer-format").textContent=cur.clock?"Scrivi ore e minuti · es. 09:30":cur.target.includes(":")?"Scrivi l’orario in 24 ore · es. 09:30":cur.structure==="div_rem"?"Scrivi solo il resto":"Scrivi il numero";
    $("btn-skip").textContent="Passa"; $("btn-skip").disabled=false; $("btn-ok").textContent="Conferma";
    setAns(""); busy=false; replaceNext=false; $("btn-ok").disabled=false; $("fb").className="fb hidden"; resetTheme(); qStart=Date.now();
    refreshTutorLive();$("btn-ok").focus({preventScroll:true});
  }
  function start(){
    clearTimeout(advanceTimer); clearTimeout(checkTimer); active=true; pausedAt=0; checkpointDue=false;
    $("checkpoint").classList.add("hidden"); session=[]; updateLevelUI(); show("screen-ex"); schedulePause(); nextQ();
  }
  function schedulePause(){
    clearTimeout(checkTimer); checkTimer=setTimeout(function(){checkpointDue=true;if(!busy) pauseSession();},checkSec()*1000);
  }
  function pauseSession(){
    if(!active||pausedAt) return; pausedAt=Date.now(); $("cp-text").textContent="Facciamo una pausa? Puoi continuare quando vuoi.";
    $("checkpoint").classList.remove("hidden"); $("cp-continue").focus();
  }

  function afterItem(){
    if(!active) return; if(pausedAt){clearTimeout(advanceTimer);busy=true;$("btn-ok").disabled=false;$("btn-ok").textContent="Avanti";return;} nextQ(); if(checkpointDue) pauseSession();
  }

  function closeItem(user, ok, unknown, shown){
    var sec=Math.round((Date.now()-qStart)/1000);
    session.push(learnFromItem(cur, user, ok, sec, attempts, hintsUsed, unknown, shown));
    updateLevelUI(); refreshTutorLive();
  }
  function normAns(s){
    s=String(s).trim().replace(/\s+/g,"");
    if(/^\d{1,2}[:.]\d{2}$/.test(s)){var p=s.split(/[:.]/);if(+p[0]>23||+p[1]>59)return "invalid";return p[0].padStart(2,"0")+":"+p[1];}
    return /^\d+$/.test(s)?String(Number(s)):"invalid";
  }

  function check(){
    if(!active||pausedAt) return;
    if(busy){if($("btn-ok").textContent==="Avanti") afterItem();return;}
    const val=getAns(); if(!val) return; attempts++;
    const ok=cur.allowed.some(function(a){return normAns(a)===normAns(val);});
    if(ok){
      theme("ok"); $("fb").className="fb fb-ok fb-anim-joy1";var top=document.querySelector(".pane-top");top.classList.remove("anim-celeb");void top.offsetWidth;top.classList.add("anim-celeb"); $("fb").textContent="Giusto.";
      busy=true; $("btn-ok").disabled=true; $("btn-skip").disabled=true;
      closeItem(val,true,false,false); advanceTimer=setTimeout(afterItem,1000);
    }else if(hintLevel<2){
      hintLevel++; hintsUsed++; cur.hintLevel=hintLevel; replaceNext=true; showHintFeedback("warn"); refreshTutorLive();
    }else{finishQuestion(val,false);}
  }
  function finishQuestion(val,unknown){
    busy=true; $("btn-ok").disabled=false; $("btn-ok").textContent="Avanti"; $("btn-skip").disabled=true;
    showHintFeedback("err"); closeItem(val,false,unknown,false);
  }

  function skip(){
    if(!active||busy||pausedAt) return;
    // "Passa" must never discard a correct answer already present in the display.
    var typed=getAns();
    if(typed && cur.allowed.some(function(a){return normAns(a)===normAns(typed);})){
      check();
      return;
    }
    if(hintLevel<2){hintLevel++; hintsUsed++;cur.hintLevel=hintLevel;replaceNext=true;showHintFeedback("warn");return;}
    attempts=Math.max(1,attempts);finishQuestion(typed||"NON_LO_SO",true);
  }

  function finish(title){
    active=false; pausedAt=0; clearTimeout(checkTimer);clearTimeout(advanceTimer);$("checkpoint").classList.add("hidden");
    const ok=session.filter(x=>x.ok).length, auto=session.filter(x=>x.autonomous).length;
    $("end-title").textContent=title;
    reportText="MATH TRAINING V2 — "+(NAME||"Utente")+"\n"+new Date().toLocaleString("it-IT")+"\n\n"+session.length+" esercizi completati · "+ok+" corretti · "+auto+" in autonomia.\nLe domande interrotte non vengono conteggiate.\n\n"+parentReportLines().join("\n")+"\n\n"+session.map((x,i)=>(i+1)+". "+x.q+" → "+x.user+" · "+x.outcome+" · "+x.sec+"s").join("\n");
    $("sum").textContent=session.length+" esercizi completati\n"+ok+" corretti · "+auto+" in autonomia\n\n"+(session.length?"Ogni passo conta. Puoi riprendere quando vuoi.":"Nessun esercizio completato. Puoi ripartire quando vuoi.");
    $("mail-note").textContent="I progressi restano su questo browser. Puoi scaricare il report.";
    $("btn-mail").classList.toggle("hidden",!TUTOR); show("screen-end");
  }

  function enough(){ finish(NAME?("Per oggi basta "+NAME+", sei stato bravo!"):"Per oggi basta, sei stato bravo!"); }

  function tutorLiveText(){
    if(!cur) return "Nessuna domanda attiva.";
    var s=skillById(cur.skillId), st=ensureSkillState(cur.skillId);
    return ["Competenza: "+(s?s.name:cur.skillId)+" ("+cur.skillId+")","Micro: "+cur.microId+" · "+cur.structure,"Mastery: "+st.mastery+" · "+masteryBand(st.mastery).label,"Tentativi "+st.attempts+" · corrette "+st.correct+" · errate "+st.wrong,"Autonome "+st.autonomousCorrect+" · aiuto "+st.assistedCorrect,"Aiuti domanda: "+hintsUsed+" (livello "+hintLevel+")","Tempo medio: "+st.averageResponseTime+"s","Prossima revisione: "+(st.nextReview||"—"),"Priorità "+Math.round(priorityScore(s,st))+" · "+classifySkill(s,st),"Forzatura: "+(v2Profile.forceMode||"no")+" · dev: "+(devMode?"ON":"OFF")].join("\n");
  }
  function refreshTutorLive(){ var el=$("tutor-live"); if(el) el.textContent=tutorLiveText(); }
  function refreshTutorPanel(){
    refreshTutorLive();
    var box=$("tutor-skills"); if(!box) return;
    box.innerHTML=skillSnapshot().map(function(r){ return "<div class='tutor-row'><strong>"+r.skill.id+"</strong> "+r.st.mastery+" · "+r.bucket+" · t"+r.st.attempts+"</div>"; }).join("");
  }
  function setForce(mode){ v2Profile.forceMode=mode||null; saveV2Profile(); refreshTutorPanel(); try{refreshTutorDashboard();}catch(e){} }
  function downloadFile(name,text,type){
    var url=URL.createObjectURL(new Blob([text],{type:type})),a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportV2(){
    var txt=JSON.stringify({profile:v2Profile,history:v2History,settings:v2Settings,exportedAt:nowISO(),app:"math_training_v2",release:"2.10.0"},null,2);
    $("tutor-json").value=txt;downloadFile("math-training-backup.json",txt,"application/json");
  }

  function validateBackup(data){
    if(!data||!data.profile||data.profile.version!==2||!Array.isArray(data.history)||!data.settings) throw Error("Formato backup non valido.");
    var p=data.profile;
    if(!p.skills||typeof p.skills!=="object"||Array.isArray(p.skills)||!p.micros||typeof p.micros!=="object"||Array.isArray(p.micros))throw Error("Profilo non valido.");
    var clean=emptyProfile();
    ["skills","micros"].forEach(function(group){
      Object.keys(p[group]).slice(0,10000).forEach(function(id){
        if(["__proto__","constructor","prototype"].includes(id))throw Error("Chiave non valida.");
        if(group==="skills"&&!skillById(id))return;
        var st=p[group][id];if(!st||typeof st!=="object")throw Error("Competenza non valida.");
        var out=emptySkillState();Object.keys(out).forEach(function(k){
          if(typeof out[k]==="number"){if(st[k]!=null&&(!Number.isFinite(st[k])||st[k]<0))throw Error("Valore numerico non valido.");out[k]=st[k]??out[k];}
          else if(["lastSeen","nextReview"].includes(k)){out[k]=st[k]&&Number.isFinite(Date.parse(st[k]))?st[k]:null;}
        });out.mastery=clamp(out.mastery,0,100);clean[group][id]=out;
      });
    });
    ["recentSigs","recentEq","recentMicros"].forEach(k=>{if(p[k]!=null&&!Array.isArray(p[k]))throw Error("Storico ripetizioni non valido.");clean[k]=(p[k]||[]).filter(x=>typeof x==="string").slice(-60);});
    clean.lastSkillId=skillById(p.lastSkillId)?p.lastSkillId:null;clean.createdAt=Number.isFinite(Date.parse(p.createdAt))?p.createdAt:nowISO();
    var history=data.history.slice(-V2_CFG.maxHistory).map(function(x){
      if(!x||!skillById(x.skillId)||!Number.isFinite(x.sec)||x.sec<0||!Number.isFinite(Date.parse(x.ts))||!Object.hasOwn(V2_CFG.masteryDelta,x.outcome))throw Error("Storico non valido.");
      var y={};["ts","skillId","microId","sig","eqSig","structure","q","user","correct","outcome"].forEach(k=>y[k]=String(x[k]??"").slice(0,1000));
      ["sec","att","hintsUsed","hintLevel","masteryAfter"].forEach(k=>y[k]=Number.isFinite(x[k])?Math.max(0,x[k]):0);
      ["difficulty","tierBefore","tierAfter"].forEach(k=>y[k]=Number.isFinite(x[k])?clamp(x[k],1,10):null);
      y.phase=["quadro_iniziale","allenamento_adattivo"].includes(x.phase)?x.phase:null;
      y.mode=["automatico","easy","review","novel"].includes(x.mode)?x.mode:"automatico";
      y.ok=!!x.ok;y.autonomous=y.outcome==="autonomous";return y;
    });
    if(p.diagnostic&&Number.isFinite(p.diagnostic.count)&&Number.isFinite(p.diagnostic.level)&&Number.isFinite(p.diagnostic.streak)){
      clean.diagnostic={count:clamp(p.diagnostic.count,0,30),level:clamp(p.diagnostic.level,1,10),streak:clamp(p.diagnostic.streak,0,2)};
    }else history.slice(0,30).forEach(x=>advanceDiagnostic(clean.diagnostic,x.outcome));
    var s=data.settings;if(typeof s!=="object"||Array.isArray(s))throw Error("Impostazioni non valide.");
    var settings=emptyV2Settings();settings.release="2.10.0";["name","tutorName","email"].forEach(k=>settings[k]=String(s[k]??"").slice(0,150));
    settings.cap=Number.isFinite(s.cap)?clamp(s.cap,1,10):10;settings.mins=Number.isFinite(s.mins)?clamp(s.mins,1,10):2;settings.packs=normalizePacks(s.packs);
    // Earlier releases ignored pack selection outside dev mode.
    if(!data.release&&!s.release&&!s.devMode)settings.packs=defaultPacks();
    if(!SKILLS.some(x=>settings.packs[x.category]&&x.difficulty<=settings.cap))throw Error("Nessun esercizio disponibile con questi argomenti e difficoltà.");
    return {profile:clean,history:history,settings:settings};
  }
  function importText(raw){
    try{
      if(raw.length>5000000)throw Error("Backup troppo grande (massimo 5 MB).");
      var data=validateBackup(JSON.parse(raw));
      openModal("Sostituire il profilo e lo storico con questo backup?",true,function(ok){
        if(!ok)return;storageCorrupt=false;v2Profile=data.profile;v2History=data.history;v2Settings=data.settings;applySettings();
        saveV2Profile();saveV2History();saveV2Settings();$("btn-start").disabled=false;refreshTutorDashboard();
        $("storage-warning").classList.toggle("hidden",saveState());$("backup-status").textContent="Backup importato. Verifica eventuali avvisi di salvataggio.";$("tutor-test-out").textContent="Backup importato.";
      });
    }catch(e){$("backup-status").textContent="Importazione annullata: "+(e instanceof SyntaxError?"Il file non contiene JSON valido.":e.message);$("tutor-test-out").textContent=$("backup-status").textContent;}
  }
  function importV2(){importText($("tutor-json").value.trim());}

  function v2RunSelfTest(){
    var failures=[],count=0;
    SKILLS.forEach(s=>{for(var i=0;i<100;i++){var item=generateForSkill(s,{});count++;if(item.skillId!==s.id||!item.allowed.includes(item.target)||(!item.target.includes(":")&&(!Number.isFinite(+item.target)||+item.target<0)))failures.push(s.id);}});
    $("tutor-test-out").textContent=count+" esercizi generati · "+failures.length+" anomalie";
  }

  function inputKey(k){
    if(!active||busy||pausedAt)return;
    var value=getAns();if(k==="del"){setAns(value.slice(0,-1));replaceNext=false;return;}
    if(k===":"&&!cur.target.includes(":"))return;
    if(replaceNext){value="";replaceNext=false;}
    if(value.length<6&&!(k===":"&&value.includes(":")))setAns(value+k);
  }
  $("pad").addEventListener("click",e=>{var b=e.target.closest("button");if(b)inputKey(b.dataset.k);});
  document.addEventListener("keydown",e=>{
    if(!$("modal").classList.contains("hidden"))return;
    if(/INPUT|TEXTAREA/.test(e.target.tagName)||!active)return;
    if(/^\d$/.test(e.key)||e.key===":"){e.preventDefault();inputKey(e.key);}
    else if(e.key==="Backspace"){e.preventDefault();inputKey("del");}
    else if(e.key==="Enter"&&!["btn-enough","btn-skip","cp-continue","cp-stop"].includes(e.target.id)){e.preventDefault();check();}
  });
  const setBtn=$("btn-settings");let settingsPressTimer=null;
  setBtn.addEventListener("pointerdown",()=>{setBtn.classList.add("pressing");settingsPressTimer=setTimeout(()=>{setBtn.classList.remove("pressing");show("screen-set");},900);});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>setBtn.addEventListener(ev,()=>{clearTimeout(settingsPressTimer);setBtn.classList.remove("pressing");}));
  setBtn.addEventListener("click",e=>{if(e.detail===0)show("screen-set");});
  $("set-cap").addEventListener("input",function(){ cap=clamp(+$("set-cap").value,MIN_LEVEL,MAX_LEVEL); syncSetSliders(); updateLevelUI(); });

  $("set-mins").addEventListener("input",function(){ mins=clamp(+$("set-mins").value||2,1,10); $("set-mins-num").textContent=mins+" min"; updateMini(); });

  function persistSettings(){
    if(!$("set-email").checkValidity()){$("set-email").reportValidity();return false;}
    var selected={};$("pack-options").querySelectorAll("input").forEach(i=>selected[i.dataset.pack]=i.checked);
    if(!Object.values(selected).some(Boolean)){openModal("Scegli almeno un argomento.",false);return false;}
    NAME=$("set-name").value.trim().slice(0,100);TUTOR_NAME=$("set-tutor-name").value.trim().slice(0,100);TUTOR=$("set-email").value.trim();
    var newCap=Math.max(1,+$("set-cap").value);if(!SKILLS.some(s=>selected[s.category]&&s.difficulty<=newCap)){openModal("Alza la difficoltà massima o scegli un argomento di base.",false);return false;}
    packs=selected;cap=clamp(+$("set-cap").value,1,10);mins=clamp(+$("set-mins").value,1,10);saveV2Settings();updateMini();return true;
  }
  var modalCb=null;

  function openModal(text, needCancel, cb, danger, triple){
    $("modal-text").textContent=text;
    $("modal-no").style.display=needCancel?"":"none";
    $("modal-stay").style.display=triple?"":"none";
    $("modal-yes").textContent=triple?"Salva ed esci":(needCancel?"Conferma":"Ok");
    $("modal-stay").textContent="Salva e rimani";
    $("modal-yes").className=danger?"btn btn-danger":"btn";
    focusBeforeModal=document.activeElement; $("modal").classList.remove("hidden"); modalCb=cb||null; $("modal-yes").focus();
  }
  $("btn-save").onclick=function(){if(persistSettings())show("screen-menu");};
  $("btn-reset-level").onclick=function(){openModal("Azzerare le competenze? Lo storico rimane disponibile.",true,function(ok){if(ok){v2Profile=emptyProfile();saveV2Profile();}},true);};
  $("btn-reset-hist").onclick=function(){openModal("Cancellare lo storico? Gli indici delle competenze rimangono.",true,function(ok){if(ok){v2History=[];saveV2History();}},true);};
  $("btn-reset-all").onclick=function(){openModal("Cancellare profilo, storico e impostazioni V2? Esporta prima un backup.",true,function(ok){if(ok){resetV2Profile();v2Settings=emptyV2Settings();applySettings();saveV2Settings();fillSettings();}},true);};
  $("btn-set-back").onclick=function(){applySettings();show("screen-menu");};
  $("cp-continue").onclick=function(){qStart+=Date.now()-pausedAt;pausedAt=0;checkpointDue=false;$("checkpoint").classList.add("hidden");schedulePause();};
  $("cp-stop").onclick=enough;
  function closeModal(choice){var cb=modalCb;modalCb=null;$("modal").classList.add("hidden");if(focusBeforeModal)focusBeforeModal.focus();if(cb)cb(choice);}
  $("modal-yes").onclick=()=>closeModal("yes");$("modal-stay").onclick=()=>closeModal("stay");$("modal-no").onclick=()=>closeModal(false);
  $("modal").addEventListener("keydown",function(e){if(e.key==="Escape"){closeModal(false);return;}if(e.key!=="Tab")return;var buttons=[...$("modal").querySelectorAll("button")].filter(b=>b.style.display!=="none");var first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"&&active)pauseSession();});
  $("backup-export").onclick=exportV2;$("backup-import").onclick=()=>$("backup-file").click();
  $("backup-file").onchange=async function(){var f=this.files[0];if(f){if(f.size>5000000){$("backup-status").textContent="Backup troppo grande.";return;}importText(await f.text());}this.value="";};
  $("btn-report").onclick=()=>downloadFile("math-training-report.txt",reportText,"text/plain;charset=utf-8");
  $("btn-mail").onclick=()=>{location.href="mailto:"+encodeURIComponent(TUTOR)+"?subject="+encodeURIComponent("Report Math Training")+"&body="+encodeURIComponent(reportText.slice(0,1600)+"\n\nAllega il report scaricato per tutti i dettagli.");};
  $("btn-start").onclick=start; $("btn-enough").onclick=enough; $("btn-ok").onclick=check; $("btn-skip").onclick=skip; $("btn-home").onclick=function(){ show("screen-menu"); };
  $("btn-force-easy").onclick=function(){ setForce("easy"); };
  $("btn-force-review").onclick=function(){ setForce("review"); };
  $("btn-force-new").onclick=function(){ setForce("novel"); };
  $("btn-force-off").onclick=function(){ setForce(null); };
  $("btn-reset-skill").onclick=function(){ if(!cur){openModal("Nessuna competenza selezionata. Completa prima una sessione.",false);return;}openModal("Azzerare la competenza «"+skillById(cur.skillId).name+"»?",true,function(ok){if(ok){v2Profile.skills[cur.skillId]=emptySkillState();saveV2Profile();refreshTutorDashboard();}},true); };
  $("btn-reset-v2").onclick=function(){ openModal("Azzerare il profilo V2? I dati V1 non vengono toccati.", true, function(ok){ if(!ok) return; resetV2Profile(); refreshTutorPanel(); refreshTutorDashboard(); }, true); };
  $("btn-show-json").onclick=function(){ $("tutor-json").value=JSON.stringify({release:"2.10.0",profile:v2Profile,history:v2History,settings:v2Settings},null,2); };
  $("btn-export-v2").onclick=exportV2;
  $("btn-import-v2").onclick=importV2;
  $("btn-selftest").onclick=v2RunSelfTest;

  $("btn-open-tutor").onclick=function(){ if(persistSettings())show("screen-tutor"); };
  $("btn-tutor-back").onclick=function(){ show("screen-set"); };
  var techToggle=$("btn-tech-toggle"); if(techToggle) techToggle.onclick=function(){ var p=$("tech-panel"); if(p) p.open=!p.open; };
  document.querySelectorAll(".info-dot").forEach(function(b){ b.onclick=function(){ var p=$("tip-pop"); if(!p) return; p.textContent=b.getAttribute("data-tip")||""; p.classList.remove("hidden"); clearTimeout(window.__tipTimer); window.__tipTimer=setTimeout(function(){p.classList.add("hidden");},4200); }; });
  function refreshTutorDashboard(){
    /* Dashboard tutor isolata: ogni blocco viene renderizzato indipendentemente,
       così un grafico non può più bloccare il resto della schermata. */
    $("program-state").textContent=({easy:"recupero richiesto",review:"ripasso richiesto",novel:"esplorazione richiesta"})[v2Profile.forceMode]||"adattivo";
    $("tech-mode-note").textContent="Modalità attiva: "+(({easy:"Recupero",review:"Ripasso",novel:"Nuovo"})[v2Profile.forceMode]||"Automatico");
    var snapshot=[];
    try{ snapshot=skillSnapshot()||[]; }catch(e){ console.error("Tutor snapshot",e); snapshot=[]; }
    var used=snapshot.filter(function(r){return r&&r.st&&r.st.attempts>0;});
    var attempts=used.reduce(function(a,r){return a+(r.st.attempts||0);},0);
    var auto=used.reduce(function(a,r){return a+(r.st.autonomousCorrect||0);},0);
    var wrong=used.reduce(function(a,r){return a+(r.st.wrong||0);},0);
    var autonomy=attempts?Math.round(auto/attempts*100):0;
    var weighted=attempts?Math.round(used.reduce(function(a,r){return a+(r.st.mastery||0)*(r.st.attempts||0);},0)/attempts):0;
    var avgTime=attempts?Math.round(used.reduce(function(a,r){return a+(r.st.averageResponseTime||0)*(r.st.attempts||0);},0)/attempts):0;

    try{
      var nameEl=$("dash-name"); if(nameEl) nameEl.textContent=NAME||"Utente";
      var phase=$("learning-status-text");
      if(phase)phase.textContent=v2Profile.diagnostic.count<30
        ?"Quadro iniziale: "+v2Profile.diagnostic.count+"/30 risposte. Gradino corrente "+v2Profile.diagnostic.level+"/10: tre risposte autonome allo stesso gradino permettono di salire. Errori e aiuti modificano il percorso."
        :"Allenamento adattivo continuo: ogni risposta aggiorna la competenza, i ripassi e la scelta delle prossime domande. Modalità "+(v2Profile.forceMode||"automatica")+" · limite "+cap+"/10.";
      var previous=v1Summary(), legacy=$("v1-summary");
      legacy.classList.toggle("hidden",!previous||!previous.total);
      if(previous&&previous.total)$("v1-summary-text").textContent=previous.total+" esercizi, "+previous.correct+" corretti. Conservati sul dispositivo: il livello V2 parte da zero e si adatta alle nuove risposte.";
      var autoEl=$("dash-autonomy"); if(autoEl) autoEl.textContent=autonomy;
      var ring=document.querySelector(".hero-score"); if(ring) ring.style.setProperty("--p",autonomy+"%");
      var status=$("dash-status"); if(status) status.textContent=v2Profile.diagnostic.count<30?("Quadro iniziale · "+v2Profile.diagnostic.count+"/30 prove · dal facile al difficile"):attempts<8?"Raccolta dati in corso":(autonomy>=75?"Buona autonomia generale":autonomy>=50?"Autonomia in consolidamento":"Serve ancora supporto frequente");
      var k=$("tutor-kpi"); if(k) k.innerHTML="<div class='metric'><b>"+attempts+"</b><span>prove</span></div><div class='metric'><b>"+weighted+"%</b><span>indice pratica</span></div><div class='metric'><b>"+wrong+"</b><span>non risolte</span></div><div class='metric'><b>"+(attempts?avgTime+"s":"—")+"</b><span>tempo medio</span></div>";
    }catch(e){ console.error("Tutor KPI",e); }

    try{
      var recent=(Array.isArray(v2History)?v2History:[]).slice(-30), chart=$("trend-chart");
      if(chart){
        if(recent.length<6) chart.innerHTML="<div class='trend-empty'>Servono almeno 6 risposte per confrontare due periodi.</div>";
        else{
          var half=Math.min(10,Math.floor(recent.length/2));
          var prev=recent.slice(-(half*2),-half), now=recent.slice(-half);
          function rates(arr){var n=Math.max(1,arr.length);return {auto:Math.round(arr.filter(function(x){return x.outcome==="autonomous";}).length/n*100),support:Math.round(arr.filter(function(x){return x.outcome==="second_try"||x.outcome==="hinted";}).length/n*100),unresolved:Math.round(arr.filter(function(x){return x.outcome==="wrong"||x.outcome==="unknown"||x.outcome==="shown";}).length/n*100)};}
          var a=rates(prev),b=rates(now),d=b.auto-a.auto;
          var avgPrev=Math.round(prev.reduce((n,x)=>n+x.sec,0)/half),avgNow=Math.round(now.reduce((n,x)=>n+x.sec,0)/half);
          var dateRange=new Date(prev[0].ts).toLocaleDateString("it-IT")+" – "+new Date(now[now.length-1].ts).toLocaleDateString("it-IT");
          var rr=[{lab:"Autonomia",old:a.auto,now:b.auto,good:true},{lab:"Con aiuto",old:a.support,now:b.support},{lab:"Non risolte",old:a.unresolved,now:b.unresolved}];
          chart.innerHTML="<div class='change-grid'>"+rr.map(function(x){var delta=x.now-x.old;return "<div class='change-row'><label>"+x.lab+"</label><div class='change-track'><div class='change-fill' style='width:"+x.now+"%'></div></div><div class='change-val'>"+x.now+"% "+(delta>0?"↑":delta<0?"↓":"=")+Math.abs(delta)+"</div></div>";}).join("")+"<div class='change-summary "+(d>=5?"change-up":d<=-5?"change-down":"change-flat")+"'>"+(d>=5?"Autonomia recente più alta":d<=-5?"Autonomia recente più bassa":"Autonomia sostanzialmente stabile")+" · ultime "+half+" vs "+half+" precedenti.<br>"+dateRange+" · Tempo medio: "+avgPrev+"s → "+avgNow+"s.</div></div>";
        }
      }
      var tn=$("trend-note"); if(tn) tn.textContent=recent.length>=6?"Variazioni in punti percentuali tra blocchi di prove. Argomenti e difficoltà possono cambiare: non dimostra da solo un miglioramento o un peggioramento.":"Il confronto temporale comparirà appena ci saranno abbastanza risposte.";
    }catch(e){ console.error("Tutor trend",e); var ch=$("trend-chart"); if(ch) ch.innerHTML="<div class='trend-empty'>Andamento temporale non ancora disponibile.</div>"; }

    try{
      var groups={};
      snapshot.forEach(function(r){if(!r||!r.skill)return;var p=r.skill.category||"altro";(groups[p]||(groups[p]=[])).push(r);});
      var sb=$("skill-bars");
      if(sb){
        var vals=PACKS.map(function(p){var list=groups[p]||[], seen=list.filter(function(x){return x.st&&x.st.attempts>0;}),att=seen.reduce(function(a,x){return a+(x.st.attempts||0);},0),v=att?Math.round(seen.reduce(function(a,x){return a+(x.st.mastery||0)*(x.st.attempts||0);},0)/att):0;return {key:p,label:PACK_LABEL[p]||p,val:Math.max(0,Math.min(100,v)),seen:att>0};});
        var peak=Math.max(...vals.map(x=>x.val)),scaleMax=[5,10,20,30,40,50,60,80,100].find(n=>n>=peak)||100;
        var cx=135,cy=125,R=78,n=vals.length;
        function point(i,r){var ang=-Math.PI/2+i*2*Math.PI/n;return [(cx+Math.cos(ang)*r).toFixed(1),(cy+Math.sin(ang)*r).toFixed(1)];}
        var svg="";
        [0.25,0.5,0.75,1].forEach(function(scale){svg+="<polygon class='radar-grid' points='"+vals.map(function(x,i){return point(i,R*scale).join(",");}).join(" ")+"'></polygon>";});
        vals.forEach(function(x,i){var q=point(i,R);svg+="<line class='radar-axis' x1='"+cx+"' y1='"+cy+"' x2='"+q[0]+"' y2='"+q[1]+"'></line>";});
        var shape=vals.map(function(x,i){return point(i,R*(x.val/scaleMax)).join(",");}).join(" ");
        svg+="<polygon class='radar-shape' points='"+shape+"'></polygon>";
        vals.forEach(function(x,i){var label=point(i,R+19);svg+="<text x='"+label[0]+"' y='"+label[1]+"' text-anchor='middle' font-size='11'>"+(i+1)+"</text>";if(x.seen){var q=point(i,R*(x.val/scaleMax));svg+="<circle class='radar-dot' cx='"+q[0]+"' cy='"+q[1]+"' r='3'></circle>";}});
        var legend=vals.map(function(x,i){return "<div><b>"+(i+1)+". "+x.label+"</b>"+(x.seen?x.val+"%":"non valutata")+"</div>";}).join("");
        sb.innerHTML="<p class='radar-scale'>Scala adattiva 0–"+scaleMax+"% · valori reali in legenda</p><div class='radar-wrap'><svg class='radar-svg' viewBox='0 0 270 250' role='img' aria-label='Mappa radar delle competenze, scala da zero a "+scaleMax+" percento'>"+svg+"</svg><div class='radar-legend'>"+legend+"</div></div>";
      }
    }catch(e){ console.error("Tutor radar",e); var sb2=$("skill-bars"); if(sb2) sb2.innerHTML="<div class='trend-empty'>Mappa in aggiornamento.</div>"; }

    try{
      var ranked=used.slice().sort(function(a,b){return (b.priority||0)-(a.priority||0);});
      var top=ranked.slice(0,3),pr=$("tutor-priorities");
      if(pr) pr.innerHTML=top.length?top.map(function(r){var au=Math.round((r.st.autonomousCorrect||0)/Math.max(1,r.st.attempts||0)*100),action=r.bucket==="recovery"?"Recupero graduale":r.bucket==="maintain"?"Ripasso distanziato":r.bucket==="novel"?"Esplorazione controllata":"Consolidamento";return "<div class='focus-item'><strong>"+r.skill.name+"</strong><div class='focus-meta'>Autonomia "+au+"% · "+(r.st.wrong||0)+" non risolte · "+(r.st.hintsUsed||0)+" aiuti</div><div class='focus-action'>→ "+action+"</div></div>";}).join(""):"<p>Servono ancora alcune prove per individuare una priorità.</p>";
    }catch(e){ console.error("Tutor priorities",e); var pr2=$("tutor-priorities"); if(pr2) pr2.innerHTML="<p>Priorità in aggiornamento.</p>"; }

    try{
      var buckets={recovery:[],consolidate:[],maintain:[],novel:[]};
      snapshot.forEach(function(r){if(!r||!r.skill)return;if(r.st&&r.st.attempts>0&&buckets[r.bucket])buckets[r.bucket].push(r.skill.name);});
      /* Il prossimo passo deve poter mostrare anche una competenza non ancora provata. */
      var nextNew=snapshot.filter(function(r){return r&&r.skill&&r.st&&r.st.attempts===0&&skillAllowedByCap(r.skill)&&skillUnlocked(r.skill);}).sort(function(a,b){return a.skill.difficulty-b.skill.difficulty;})[0];
      if(nextNew) buckets.novel=[nextNew.skill.name];
      var pl=$("program-list");
      if(pl){var labels={recovery:"RECUPERO",consolidate:"CONSOLIDA",maintain:"MANTIENI",novel:"PROSSIMO"},empty={recovery:"Nessun recupero prioritario",consolidate:"Nessun consolidamento prioritario",maintain:"Nessun mantenimento prioritario",novel:"In attesa di nuovi dati"},seq=["recovery","consolidate","maintain","novel"];pl.innerHTML=seq.map(function(b){return "<div class='program-step'><i></i><b>"+labels[b]+"</b><span>"+(buckets[b][0]||empty[b])+"</span></div>";}).join("");}
    }catch(e){ console.error("Tutor program",e); var pl2=$("program-list"); if(pl2) pl2.innerHTML="<div class='trend-empty'>Programma in aggiornamento.</div>"; }
  }


  loadV2(); updateMini(); updateLevelUI(); show("screen-menu");
})();
