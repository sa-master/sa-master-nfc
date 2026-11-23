/* Лічильник відвідувань (GoatCounter, без cookie). Статистику бачить лише власник кабінету. */
(function(){
  var s=document.createElement("script");
  s.async=true; s.src="//gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter","https://sa-master.goatcounter.com/count");
  document.head.appendChild(s);
  window.SMStats={ event:function(name){ try{ if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:name,title:name,event:true}); }catch(e){} } };
})();
