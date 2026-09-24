const MAX_LEVEL=10, MIN_LEVEL=0;
const LEVEL_INFO=[
  {min:0,max:0,label:"Inizio",desc:"Solo addizioni piccole"},
  {min:1,max:2,label:"Base",desc:"Addizioni e sottrazioni"},
  {min:3,max:4,label:"Tempo",desc:"Orologio"},
  {min:5,max:6,label:"Intermedio",desc:"Moltiplicazioni e frazioni"},
  {min:7,max:8,label:"Esperto",desc:"Divisioni"},
  {min:9,max:9,label:"Ampio",desc:"Numeri piu alti"},
  {min:10,max:10,label:"Adulto",desc:"Mix, soldi, percentuali"}
];
const levelInfo=lvl=>LEVEL_INFO.find(t=>lvl>=t.min&&lvl<=t.max)||LEVEL_INFO[LEVEL_INFO.length-1];
const LS={
  get:function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set:function(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } },
  clear:function(){ try{ localStorage.clear(); }catch(e){} }
};
document.addEventListener("touchstart",function(){},{passive:true});
document.addEventListener("contextmenu",function(e){ var t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA")) return; e.preventDefault(); });
const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
