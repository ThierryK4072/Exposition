
const DB="ExpoCliniqueDB",VER=3;
let db,active=null,start=0,timer=null,selected=null;
const MET={anxiety:"Intensité de l’émotion cible",expectancy:"Probabilité de l’issue redoutée"};
const DEF={anxiety:50,expectancy:50};

document.addEventListener("DOMContentLoaded",init);

function openDB(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("patients")){const s=d.createObjectStore("patients",{keyPath:"id",autoIncrement:true});s.createIndex("code","code",{unique:true})}if(!d.objectStoreNames.contains("sessions")){const s=d.createObjectStore("sessions",{keyPath:"id",autoIncrement:true});s.createIndex("patientId","patientId");s.createIndex("date","date")}if(!d.objectStoreNames.contains("measurements")){const s=d.createObjectStore("measurements",{keyPath:"id",autoIncrement:true});s.createIndex("sessionId","sessionId")}
if(!d.objectStoreNames.contains("optex")){const s=d.createObjectStore("optex",{keyPath:"id",autoIncrement:true});s.createIndex("patientId","patientId");s.createIndex("updatedAt","updatedAt")}
if(!d.objectStoreNames.contains("hierarchies")){const s=d.createObjectStore("hierarchies",{keyPath:"id",autoIncrement:true});s.createIndex("patientId","patientId");s.createIndex("updatedAt","updatedAt")}if(!d.objectStoreNames.contains("scripts")){const s=d.createObjectStore("scripts",{keyPath:"id",autoIncrement:true});s.createIndex("patientId","patientId");s.createIndex("updatedAt","updatedAt")}};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function st(n,m="readonly"){return db.transaction(n,m).objectStore(n)}
function rq(r){return new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
const all=n=>rq(st(n).getAll());
const add=(n,v)=>rq(st(n,"readwrite").add(v));
const put=(n,v)=>rq(st(n,"readwrite").put(v));

async function init(){
  db=await openDB();
  bindNav();bind();buildMetrics();buildSelects();sliders();
  useEmotion.onchange=toggleMetrics;
  useExpectancy.onchange=toggleMetrics;
  for(const id of["useInitialExpectancy","useExpectedSeverity","useExerciseDifficulty","useFinalExpectancy","useActualSeverity","useSurprise"]){
    document.getElementById(id).onchange=toggleSelectableSliders;
  }
  therapeuticTarget.onchange=applyTherapeuticTarget;
  targetEmotionName.oninput=()=>updateEmotionLabels();toggleMetrics();toggleSelectableSliders();applyTherapeuticTarget();updateEmotionLabels();
  buildPredictorCategories();addDefaultHierarchyItems();await refresh();setupPatientSearches();applyScriptType();loadPsychologistName();setupModernRanges();
  if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
}

function bindNav(){document.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>show(b.dataset.v))}
function show(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.v===id));scrollTo(0,0)}
function bind(){
  pf.onsubmit=savePatient;sf.onsubmit=startSession;record.onclick=recordMeasure;
  finish.onclick=openDebrief;df.onsubmit=endSession;hpatient.onchange=renderSessions;
  liveMetric.onchange=liveGraph;hmetric.onchange=renderDetail;
  debriefMetric.onchange=renderDebriefGraph;
  exportall.onclick=exportAll;importall.onclick=importAll;
  exportsession.onclick=exportSession;
  optexForm.onsubmit=saveOptEx;
  newOptExBtn.onclick=clearOptExForm;
  deleteOptExBtn.onclick=deleteOptEx;
  optexPatientFilter.onchange=renderOptExList;
  hierarchyForm.onsubmit=saveHierarchy;
  newHierarchyBtn.onclick=clearHierarchyForm;
  deleteHierarchyBtn.onclick=deleteHierarchy;
  hierarchyPatientFilter.onchange=renderHierarchyList;
  addHierarchyItemBtn.onclick=()=>addHierarchyItem();
  sortHierarchyBtn.onclick=sortHierarchyItems;
  exportOptExPdfBtn.onclick=exportOptExPdf;
  exportHierarchyPdfBtn.onclick=exportHierarchyPdf;
  scriptForm.onsubmit=saveScript;
  newScriptBtn.onclick=clearScriptForm;
  deleteScriptBtn.onclick=deleteScript;
  scriptPatientFilter.onchange=renderScriptList;
  exportScriptPdfBtn.onclick=exportScriptPdf;
  patientListSearch.oninput=renderPatientList;
  savePsychologistBtn.onclick=savePsychologistName;
  scriptType.onchange=applyScriptType;deletesession.onclick=deleteSession;
}

function updateRangeTrack(input){
  const min=Number(input.min||0);
  const max=Number(input.max||100);
  const value=Number(input.value||0);
  const pct=((value-min)/(max-min))*100;
  input.style.background=`linear-gradient(90deg,#111318 0%,#111318 ${pct}%,#d9dde3 ${pct}%,#d9dde3 100%)`;
}

function setupModernRanges(){
  document.querySelectorAll('input[type="range"]').forEach(input=>{
    updateRangeTrack(input);
    input.addEventListener("input",()=>updateRangeTrack(input));
  });
}

function sliders(){[["iex","iexv"],["isev","isevv"],["difficulty","difficultyv"],["fex","fexv"],["asev","asevv"],["surp","surpv"]].forEach(([a,b])=>document.getElementById(a).oninput=e=>document.getElementById(b).textContent=e.target.value)}

function emotionLabel(session=active){
  const name=(session?.targetEmotionName||document.getElementById("targetEmotionName")?.value||"").trim();
  return name ? `Intensité de ${name}` : "Intensité de l’émotion cible";
}
function updateEmotionLabels(session=active){
  const label=emotionLabel(session);
  const title=document.querySelector('#anxiety')?.closest(".metric")?.querySelector("span");
  if(title)title.textContent=label;
}

function buildMetrics(){metrics.innerHTML="";for(const[k,l]of Object.entries(MET)){const d=document.createElement("div");d.className="metric";d.innerHTML=`<span>${l}</span><b id="${k}v">${DEF[k]}</b><input id="${k}" type="range" min="0" max="100" value="${DEF[k]}">`;metrics.appendChild(d);d.querySelector("input").oninput=e=>document.getElementById(k+"v").textContent=e.target.value}}

function syncCurrentMeasureOptions(invalidation){
  const expectancyOption=document.getElementById("expectancyMeasureOption");
  const expectancyMetric=document.getElementById("expectancy")?.closest(".metric");

  if(!invalidation){
    useExpectancy.checked=false;

    if(expectancyOption){
      expectancyOption.hidden=true;
      expectancyOption.classList.add("hidden");
      expectancyOption.style.setProperty("display","none","important");
      expectancyOption.setAttribute("aria-hidden","true");
    }

    if(expectancyMetric){
      expectancyMetric.hidden=true;
      expectancyMetric.classList.add("hidden");
      expectancyMetric.style.setProperty("display","none","important");
      expectancyMetric.setAttribute("aria-hidden","true");
    }
    return;
  }

  if(expectancyOption){
    expectancyOption.hidden=false;
    expectancyOption.classList.remove("hidden");
    expectancyOption.style.removeProperty("display");
    expectancyOption.removeAttribute("aria-hidden");
  }

  if(expectancyMetric){
    expectancyMetric.hidden=!useExpectancy.checked;
    expectancyMetric.classList.toggle("hidden",!useExpectancy.checked);
    expectancyMetric.style.removeProperty("display");
    expectancyMetric.removeAttribute("aria-hidden");
  }
}

function applyTherapeuticTarget(){
  const invalidation=therapeuticTarget.value==="Invalidation des attentes";

  const fearedField=document.getElementById("fearedOutcomeField");
  if(fearedField)fearedField.classList.toggle("hidden",!invalidation);
  fear.required=invalidation;
  if(!invalidation)fear.value="";

  const learningField=document.getElementById("learningGoalField");
  if(learningField)learningField.classList.toggle("hidden",!invalidation);
  if(!invalidation)goal.value="";

  initialExpectancyBlock.classList.toggle("hidden",!invalidation);
  expectedSeverityBlock.classList.toggle("hidden",!invalidation);
  exerciseDifficultyBlock.classList.remove("hidden");
  useExerciseDifficulty.checked=true;
  invalidationPlan.classList.toggle("hidden",!invalidation);
  invalidationReference.classList.toggle("hidden",!invalidation);

  useEmotion.checked=true;
  useExpectancy.checked=invalidation;

  const expectancyOption=document.getElementById("expectancyMeasureOption");
  if(expectancyOption){expectancyOption.classList.toggle("hidden",!invalidation);expectancyOption.style.display=invalidation?"":"none";}

  const expectancySlider=document.getElementById("expectancy")?.closest(".metric");
  if(expectancySlider)expectancySlider.classList.toggle("hidden",!invalidation);

  if(!invalidation){
    useExpectancy.checked=false;
  }

  syncCurrentMeasureOptions(invalidation);
  reorderLiveMetrics(invalidation);
  reorderLiveMeasurementOptions(invalidation);
  toggleMetrics();
}

function applyDebriefTarget(){
  const invalidation=active?.therapeuticTarget==="Invalidation des attentes";

  finalExpectancyBlock.classList.toggle("hidden",!invalidation);
  actualSeverityBlock.classList.toggle("hidden",!invalidation);
  surpriseBlock.classList.toggle("hidden",!invalidation);
  invalidationJournal.classList.toggle("hidden",!invalidation);
  debriefInvalidationReference.classList.toggle("hidden",!invalidation);

  const occurred=document.getElementById("occurredField");
  const actualField=document.getElementById("actualOutcomeField");
  const nextField=document.getElementById("nextStepField");

  if(occurred)occurred.classList.toggle("hidden",!invalidation);
  if(actualField)actualField.classList.toggle("hidden",!invalidation);
  if(nextField)nextField.classList.toggle("hidden",!invalidation);

  debriefMetric.value=invalidation&&debriefMetric.querySelector('option[value="expectancy"]')
    ?"expectancy"
    :"anxiety";
}

function reorderLiveMeasurementOptions(invalidation){
  const options=document.querySelector(".metric-options");
  const emotionLabel=document.getElementById("emotionMeasureOption");
  const expectancyLabel=document.getElementById("expectancyMeasureOption");
  if(!options||!emotionLabel||!expectancyLabel)return;

  if(invalidation){
    options.insertBefore(expectancyLabel,emotionLabel);
  }else{
    options.insertBefore(emotionLabel,expectancyLabel);
  }
}

function reorderLiveMetrics(invalidation){
  const anxietyRow=document.getElementById("anxiety")?.closest(".metric");
  const expectancyRow=document.getElementById("expectancy")?.closest(".metric");
  if(!anxietyRow||!expectancyRow)return;

  if(invalidation){
    metrics.insertBefore(expectancyRow,anxietyRow);
  }else{
    metrics.insertBefore(anxietyRow,expectancyRow);
  }
}

function toggleMetrics(){
  const emotionEnabled=useEmotion.checked;
  const invalidation=active?active.therapeuticTarget==="Invalidation des attentes":therapeuticTarget.value==="Invalidation des attentes";
  syncCurrentMeasureOptions(invalidation);
  if(!invalidation)useExpectancy.checked=false;
  if(!invalidation){
    useExpectancy.checked=false;
    const expectancyOption=document.getElementById("expectancyMeasureOption");
    if(expectancyOption){expectancyOption.classList.add("hidden");expectancyOption.style.display="none";}
    const expectancySlider=document.getElementById("expectancy")?.closest(".metric");
    if(expectancySlider)expectancySlider.classList.add("hidden");
  }
  const expectancyEnabled=invalidation&&useExpectancy.checked;
  document.getElementById("anxiety").closest(".metric").classList.toggle("hidden",!emotionEnabled);
  document.getElementById("expectancy").closest(".metric").classList.toggle("hidden",!expectancyEnabled);


  const available=[];
  if(invalidation){
    if(expectancyEnabled)available.push(["expectancy",MET.expectancy]);
    if(emotionEnabled)available.push(["anxiety",emotionLabel(active)]);
  }else{
    if(emotionEnabled)available.push(["anxiety",MET.anxiety]);
    if(expectancyEnabled)available.push(["expectancy",MET.expectancy]);
  }

  const current=liveMetric.value;
  liveMetric.innerHTML="";
  for(const[k,l]of available){
    const o=document.createElement("option");
    o.value=k;
    o.textContent=l;
    liveMetric.appendChild(o);
  }

  if(available.length===1){
    liveMetric.value=available[0][0];
    liveMetric.classList.add("hidden");
  }else{
    liveMetric.classList.remove("hidden");
    if(available.some(([k])=>k===current))liveMetric.value=current;
    else if(available.length)liveMetric.value=available[0][0];
  }

  liveGraph();
}

function toggleSelectableSliders(){for(const [check,slider] of [["useInitialExpectancy","iex"],["useExpectedSeverity","isev"],["useExerciseDifficulty","difficulty"],["useFinalExpectancy","fex"],["useActualSeverity","asev"],["useSurprise","surp"]]){document.getElementById(slider).disabled=!document.getElementById(check).checked;document.getElementById(slider).closest(".selectable-slider").classList.toggle("disabled",!document.getElementById(check).checked)}}
function buildSelects(){for(const select of[liveMetric,debriefMetric]){select.innerHTML="";for(const[k,l]of Object.entries(MET)){const o=document.createElement("option");o.value=k;o.textContent=l;select.appendChild(o)}}}

async function savePatient(e){
  e.preventDefault();
  const p={code:pcode.value.trim(),notes:pnotes.value.trim(),createdAt:new Date().toISOString()};
  try{await add("patients",p)}catch(x){toast("Ce code existe déjà.");return}
  e.target.reset();await refresh();toast("Patient enregistré.");
}

async function startSession(e){
  e.preventDefault();
  applyTherapeuticTarget();
  const pid=Number(document.getElementById("spatient").value);if(!pid){toast("Sélectionnez un patient.");return}
  if(!stitle.value.trim()){toast("Saisissez un titre.");return}
  if(!target.value.trim()){toast("Décrivez la situation cible.");return}
  if(therapeuticTarget.value==="Invalidation des attentes"&&!fear.value.trim()){
    toast("Précisez l’issue redoutée.");
    return;
  }
  const s={patientId:pid,title:stitle.value.trim(),type:stype.value,therapeuticTarget:therapeuticTarget.value,context:scontext.value.trim(),targetEmotionName:targetEmotionName.value.trim(),target:target.value.trim(),fear:therapeuticTarget.value==="Invalidation des attentes"?fear.value.trim():"",initialExpectancy:useInitialExpectancy.checked?+iex.value:null,expectedSeverity:useExpectedSeverity.checked?+isev.value:null,exerciseDifficulty:useExerciseDifficulty.checked?+difficulty.value:null,
plan:{
  betweenSessions:"",
  fearTested:document.getElementById("planFearTested")?.value.trim()||"",
  howTest:document.getElementById("planHowTest")?.value.trim()||"",
  giveUp:document.getElementById("planGiveUp")?.value.trim()||"",
  stay:document.getElementById("planStay")?.value.trim()||"",
  combine:document.getElementById("planCombine")?.value.trim()||"",
  face:document.getElementById("planFace")?.value.trim()||"",
  fullExposure:document.getElementById("planFullExposure")?.value.trim()||""
},
goal:goal.value.trim(),safetyGoal:safetygoal.value.trim(),date:new Date().toISOString(),status:"active"};
  s.id=await add("sessions",s);active=s;start=Date.now();
  if(s.initialExpectancy!==null){expectancy.value=s.initialExpectancy;expectancyv.textContent=s.initialExpectancy}
  if(s.therapeuticTarget==="Habituation"){
    useEmotion.checked=true;
    useExpectancy.checked=false;
    const expectancyOption=document.getElementById("expectancyMeasureOption");
    if(expectancyOption)expectancyOption.classList.add("hidden");
    const expectancySlider=document.getElementById("expectancy")?.closest(".metric");
    if(expectancySlider)expectancySlider.classList.add("hidden");
  }else{
    useEmotion.checked=false;
    useExpectancy.checked=true;
    const expectancyOption=document.getElementById("expectancyMeasureOption");
    if(expectancyOption){expectancyOption.classList.remove("hidden");expectancyOption.style.display="";}
  }
  syncCurrentMeasureOptions(s.therapeuticTarget==="Invalidation des attentes");
  reorderLiveMetrics(s.therapeuticTarget==="Invalidation des attentes");
  reorderLiveMeasurementOptions(s.therapeuticTarget==="Invalidation des attentes");
  toggleMetrics();
  updateEmotionLabels(s);
  const p=await rq(st("patients").get(pid));livetitle.textContent=s.title;livesub.textContent=`${p.code} — ${s.target}`;
  prep.classList.add("hidden");live.classList.remove("hidden");debrief.classList.add("hidden");
  syncCurrentMeasureOptions(s.therapeuticTarget==="Invalidation des attentes");
  startTimer();await liveGraph();toast("Séance démarrée.");
}

function startTimer(){clearInterval(timer);const f=()=>{const sec=Math.floor((Date.now()-start)/1000);document.getElementById("timer").textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")};f();timer=setInterval(f,1000)}

async function recordMeasure(){
  if(!active)return;
  const m={sessionId:active.id,measuredAt:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-start)/100)/10,note:mnote.value.trim(),anxiety:useEmotion.checked?+anxiety.value:null,expectancy:(active.therapeuticTarget==="Invalidation des attentes"&&useExpectancy.checked)?+expectancy.value:null};
  await add("measurements",m);mnote.value="";
  const ms=await measurements(active.id);mstatus.textContent=ms.length+" mesure(s) enregistrée(s)";
  await liveGraph();toast("Mesure enregistrée.");
}

async function openDebrief(){
  if(!active)return;
  live.classList.add("hidden");debrief.classList.remove("hidden");
  updateEmotionLabels(active);
  await populateDebriefMetric();
  applyDebriefTarget();
  await renderDebriefGraph();
  scrollTo(0,0);
}

async function populateDebriefMetric(){
  const ms=await measurements(active.id);
  const available=[];
  if(ms.some(m=>m.anxiety!==null&&m.anxiety!==undefined))available.push(["anxiety",MET.anxiety]);
  if(ms.some(m=>m.expectancy!==null&&m.expectancy!==undefined))available.push(["expectancy",MET.expectancy]);
  const current=debriefMetric.value;
  debriefMetric.innerHTML="";
  for(const[k,l]of available){const o=document.createElement("option");o.value=k;o.textContent=l;debriefMetric.appendChild(o)}
  if(available.some(([k])=>k===current))debriefMetric.value=current;
  debriefMetric.classList.toggle("hidden",available.length===0);
}

async function renderDebriefGraph(){
  if(!active)return;
  const ms=await measurements(active.id);
  const hasEmotion=ms.some(m=>m.anxiety!==null&&m.anxiety!==undefined);
  const hasExpectancy=ms.some(m=>m.expectancy!==null&&m.expectancy!==undefined);

  if(hasEmotion&&hasExpectancy){
    debriefMetric.classList.add("hidden");
    debriefChartSecondaryWrap.classList.remove("hidden");
    draw(debriefChart,ms,"expectancy");
    draw(debriefChartSecondary,ms,"anxiety");
  }else{
    debriefChartSecondaryWrap.classList.add("hidden");
    debriefMetric.classList.toggle("hidden",!(hasEmotion||hasExpectancy));
    draw(debriefChart,ms,hasExpectancy?"expectancy":"anxiety");
  }

  renderObservations(debriefObservations,ms);
}

async function endSession(e){
  e.preventDefault();
  active.status="completed";active.durationSeconds=Math.round((Date.now()-start)/100)/10;
  const invalidation=active.therapeuticTarget==="Invalidation des attentes";
  active.occurred=invalidation?occur.value:null;
  active.actual=invalidation?actual.value.trim():"";
  active.journal={
    howKnow:document.getElementById("howKnow")?.value.trim()||"",
    expectedVsActual:document.getElementById("expectedVsActual")?.value.trim()||""
  };
  active.finalExpectancy=useFinalExpectancy.checked?+fex.value:null;
  active.actualSeverity=useActualSeverity.checked?+asev.value:null;
  active.surprise=useSurprise.checked?+surp.value:null;
  active.learning=learn.value.trim();active.next=invalidation?next.value.trim():"";active.completedAt=new Date().toISOString();
  await put("sessions",active);
  const id=active.id;active=null;start=0;clearInterval(timer);
  prep.classList.remove("hidden");live.classList.add("hidden");debrief.classList.add("hidden");
  sf.reset();stitle.value="Exposition";scontext.value="En séance";targetEmotionName.value="";therapeuticTarget.value="Invalidation des attentes";applyTherapeuticTarget();iex.value=isev.value=70;iexv.textContent=isevv.textContent=70;difficulty.value=50;difficultyv.textContent=50;
  df.reset();fexv.textContent=50;asevv.textContent=0;surpv.textContent=50;toggleSelectableSliders();
  await refresh();selected=id;show("history");await renderDetail();toast("Séance terminée.");
}


function renderPatientList(){
  const patients=window.__patientsCache||[];
  const query=(document.getElementById("patientListSearch")?.value||"").trim().toLocaleLowerCase("fr");
  const filtered=patients.filter(p=>`${p.code} ${p.notes||""}`.toLocaleLowerCase("fr").includes(query));

  plist.innerHTML=filtered.length?"":"<p>Aucun patient.</p>";
  for(const p of filtered){
    const d=document.createElement("div");
    d.className="listitem patient-list-item";
    const firstSentence=(p.notes||"").trim().split(/(?<=[.!?])\s+/)[0]||"";
    d.innerHTML=`
      <div class="patient-list-content">
        <b>${esc(p.code)}</b>
        ${firstSentence?`<small>${esc(firstSentence)}</small>`:""}
      </div>
      <button type="button" class="delete-patient-btn" title="Supprimer ce patient" aria-label="Supprimer ${esc(p.code)}">×</button>
    `;
    d.onclick=()=>showPatientSummary(p.id);
    d.querySelector(".delete-patient-btn").onclick=async event=>{
      event.stopPropagation();
      await deletePatient(p.id,p.code);
    };
    plist.appendChild(d);
  }
}

async function refresh(){
  const ps=(await all("patients")).sort((a,b)=>a.code.localeCompare(b.code)),ss=await all("sessions");
  pc.textContent=ps.length;sc.textContent=ss.length;window.__patientsCache=ps;renderPatientList();
  spatient.innerHTML='<option value="">Sélectionner…</option>';hpatient.innerHTML='<option value="">Tous les patients</option>';
  for(const p of ps){for(const s of[spatient,hpatient]){const o=document.createElement("option");o.value=p.id;o.textContent=p.code;s.appendChild(o)}}
  await renderSessions();
  refreshModulePatientSelectors(ps);
  await renderOptExList();
  await renderHierarchyList();
  await renderScriptList();
  setupPatientSearches();
}


function refreshModulePatientSelectors(patients){
  const selectors=[
    ["optexPatient","Sélectionner…"],
    ["optexPatientFilter","Tous les patients"],
    ["hierarchyPatient","Sélectionner…"],
    ["hierarchyPatientFilter","Tous les patients"],["scriptPatient","Sélectionner…"],["scriptPatientFilter","Tous les patients"]
  ];

  for(const [id,placeholder] of selectors){
    const select=document.getElementById(id);
    if(!select)continue;

    const current=String(select.value||"");
    select.innerHTML="";

    const first=document.createElement("option");
    first.value="";
    first.textContent=placeholder;
    select.appendChild(first);

    for(const patient of patients){
      const option=document.createElement("option");
      option.value=String(patient.id);
      option.textContent=patient.code;
      select.appendChild(option);
    }

    if([...select.options].some(option=>option.value===current)){
      select.value=current;
    }
  }
}


async function deletePatient(patientId,patientCode){
  const sessions=(await all("sessions")).filter(s=>s.patientId===patientId);
  const optexRecords=(await all("optex")).filter(r=>r.patientId===patientId);
  const hierarchies=(await all("hierarchies")).filter(r=>r.patientId===patientId);
  const scripts=(await all("scripts")).filter(r=>r.patientId===patientId);

  const linkedCount=sessions.length+optexRecords.length+hierarchies.length+scripts.length;
  const message=linkedCount
    ? `Supprimer ${patientCode} ? Cette action supprimera aussi ${sessions.length} séance(s), ${optexRecords.length} OptEx Nexus et ${hierarchies.length} hiérarchie(s) et ${scripts.length} script(s).`
    : `Supprimer définitivement le patient ${patientCode} ?`;

  if(!confirm(message))return;

  const measurementsAll=await all("measurements");
  const sessionIds=new Set(sessions.map(s=>s.id));
  const linkedMeasurements=measurementsAll.filter(m=>sessionIds.has(m.sessionId));

  const tx=db.transaction(
    ["patients","sessions","measurements","optex","hierarchies","scripts"],
    "readwrite"
  );

  tx.objectStore("patients").delete(patientId);
  sessions.forEach(s=>tx.objectStore("sessions").delete(s.id));
  linkedMeasurements.forEach(m=>tx.objectStore("measurements").delete(m.id));
  optexRecords.forEach(r=>tx.objectStore("optex").delete(r.id));
  hierarchies.forEach(r=>tx.objectStore("hierarchies").delete(r.id));
  scripts.forEach(r=>tx.objectStore("scripts").delete(r.id));

  await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });

  await refresh();
  toast("Patient supprimé.");
}


function setupPatientSearches(){
  const selectorIds=[
    "spatient",
    "hpatient",
    "optexPatient",
    "optexPatientFilter",
    "hierarchyPatient",
    "hierarchyPatientFilter",
    "scriptPatient",
    "scriptPatientFilter"
  ];

  for(const id of selectorIds){
    const select=document.getElementById(id);
    if(!select||select.dataset.autocompleteReady==="1")continue;

    const wrapper=document.createElement("div");
    wrapper.className="patient-autocomplete";
    select.parentNode.insertBefore(wrapper,select);
    wrapper.appendChild(select);
    select.classList.add("patient-select-hidden");

    const input=document.createElement("input");
    input.type="search";
    input.className="patient-autocomplete-input";
    input.placeholder="Commencez à taper un nom ou un code…";
    input.autocomplete="off";

    const list=document.createElement("div");
    list.className="patient-suggestions hidden";

    wrapper.insertBefore(input,select);
    wrapper.appendChild(list);

    const getOptions=()=>[...select.options].slice(1);

    const renderSuggestions=()=>{
      const query=input.value.trim().toLocaleLowerCase("fr");
      const options=getOptions().filter(option=>{
        return !query||option.textContent.toLocaleLowerCase("fr").includes(query);
      });

      list.innerHTML="";
      if(!options.length){
        list.innerHTML='<div class="patient-suggestion-empty">Aucune correspondance</div>';
      }else{
        options.slice(0,12).forEach(option=>{
          const button=document.createElement("button");
          button.type="button";
          button.className="patient-suggestion";
          button.textContent=option.textContent;
          button.onclick=()=>{
            select.value=option.value;
            input.value=option.textContent;
            list.classList.add("hidden");
            select.dispatchEvent(new Event("change",{bubbles:true}));
          };
          list.appendChild(button);
        });
      }
      list.classList.remove("hidden");
    };

    input.addEventListener("input",renderSuggestions);
    input.addEventListener("focus",renderSuggestions);
    input.addEventListener("keydown",event=>{
      if(event.key==="Escape")list.classList.add("hidden");
    });

    document.addEventListener("click",event=>{
      if(!wrapper.contains(event.target))list.classList.add("hidden");
    });

    select.addEventListener("change",()=>{
      const option=select.selectedOptions[0];
      if(option&&option.value)input.value=option.textContent;
      else if(!input.matches(":focus"))input.value="";
    });

    select.dataset.autocompleteReady="1";
  }
}

async function renderSessions(){
  const pid=+hpatient.value||0;
  const ss=(await all("sessions"))
    .filter(s=>!pid||s.patientId===pid)
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  const ps=await all("patients");
  const pm=Object.fromEntries(ps.map(p=>[p.id,p]));

  slist.innerHTML=ss.length?"":"<p>Aucune séance.</p>";

  for(const s of ss){
    const d=document.createElement("div");
    d.className="listitem history-session-item";

    const b=document.createElement("button");
    b.className="history-session-open";
    b.innerHTML=`<b>${esc(s.title)}</b><div>${esc(pm[s.patientId]?.code||"")}</div><small>${fmtDate(s.date)} — ${s.status==="completed"?"Terminée":"En cours"}</small>`;
    b.onclick=async()=>{selected=s.id;await renderDetail()};

    const del=document.createElement("button");
    del.type="button";
    del.className="delete-session-hover";
    del.title="Supprimer cette exposition";
    del.setAttribute("aria-label","Supprimer cette exposition");
    del.onclick=async event=>{
      event.stopPropagation();
      await deleteSessionById(s.id,s.title);
    };

    d.appendChild(b);
    d.appendChild(del);
    slist.appendChild(d);
  }
}


async function deleteSessionById(sessionId,sessionTitle){
  if(!confirm(`Supprimer définitivement l’exposition « ${sessionTitle} » ?`))return;

  const ms=await measurements(sessionId);
  const tx=db.transaction(["sessions","measurements"],"readwrite");
  tx.objectStore("sessions").delete(sessionId);
  ms.forEach(m=>tx.objectStore("measurements").delete(m.id));

  await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });

  if(selected===sessionId){
    selected=null;
    hdetail.classList.add("hidden");
    hempty.classList.remove("hidden");
  }

  await refresh();
  toast("Exposition supprimée.");
}

async function renderDetail(){
  if(!selected)return;
  const s=await rq(st("sessions").get(selected));if(!s)return;
  const p=await rq(st("patients").get(s.patientId)),ms=await measurements(s.id);
  hempty.classList.add("hidden");hdetail.classList.remove("hidden");htitle.textContent=`${s.title} — ${p?.code||""}`;
  const emotion=ms.filter(m=>m.anxiety!==null&&m.anxiety!==undefined),prob=ms.filter(m=>m.expectancy!==null&&m.expectancy!==undefined);
  const emotionMax=emotion.length?Math.max(...emotion.map(m=>+m.anxiety)):null,emotionFinal=emotion.length?+emotion[emotion.length-1].anxiety:null;
  const initialProb=s.initialExpectancy??(prob.length?+prob[0].expectancy:null),finalProb=s.finalExpectancy??(prob.length?+prob[prob.length-1].expectancy:null);
  const summaryRows=[
    ["Date",fmtDate(s.date)],
    ["Type",esc(s.type||"")],
    ["Cible thérapeutique",esc(s.therapeuticTarget||"Non renseignée")],
    ["Cible",esc(s.target||"")],
    ["Nature de l’émotion cible",esc(s.targetEmotionName||"Émotion cible")],
    ["Durée de l’exercice",formatDuration(s.durationSeconds||0)]
  ];

  if(s.fear)summaryRows.splice(4,0,["Résultat redouté",esc(s.fear)]);

  if(s.therapeuticTarget==="Habituation"){
    if(emotion.length)summaryRows.push(["Émotion maximale / finale",`<span class="paired-values"><span>${score(emotionMax)}</span><span>${score(emotionFinal)}</span></span>`]);
    if(s.exerciseDifficulty!==null&&s.exerciseDifficulty!==undefined)summaryRows.push(["Difficulté anticipée",score(s.exerciseDifficulty)]);
    if(s.learning)summaryRows.push(["Bilan",esc(s.learning)]);
  }else{
    if(initialProb!==null||finalProb!==null)summaryRows.push(["Probabilité initiale / finale",`<span class="paired-values"><span>${score(initialProb)}</span><span>${score(finalProb)}</span></span>`]);
    if(s.occurred)summaryRows.push(["Résultat survenu",esc(s.occurred)]);

    if(s.expectedSeverity!==null||s.actualSeverity!==null)summaryRows.push(["Gravité attendue / finale",`<span class="paired-values"><span>${score(s.expectedSeverity)}</span><span>${score(s.actualSeverity)}</span></span>`]);
    if(s.exerciseDifficulty!==null&&s.exerciseDifficulty!==undefined)summaryRows.push(["Difficulté anticipée",score(s.exerciseDifficulty)]);
    if(s.surprise!==null&&s.surprise!==undefined)summaryRows.push(["Surprise",score(s.surprise)]);
    if(s.actual)summaryRows.push(["Ce qui s’est réellement produit",esc(s.actual)]);
    if(s.learning)summaryRows.push(["Apprentissage",esc(s.learning)]);
    if(s.next)summaryRows.push(["Prochaine étape",esc(s.next)]);
  }

  
  if(s.therapeuticTarget==="Invalidation des attentes"&&s.plan){
    const planFields=[
      ["Ce qui est mis à l’épreuve",s.plan.fearTested],
      ["Comment cela est mis à l’épreuve",s.plan.howTest],
      ["Ce à quoi le patient renonce",s.plan.giveUp],
      ["Comment rester dans la situation",s.plan.stay],
      ["Combinaison des éléments",s.plan.combine],
      ["Comment l’affronter",s.plan.face],
      ["Exposition complète",s.plan.fullExposure]
    ];
    for(const[label,value]of planFields){
      if(value)summaryRows.push([label,esc(value)]);
    }
  }

summaryRows.push(["Nombre de mesures",String(ms.length)]);

  hsummary.innerHTML=`<div class="summarygrid">${summaryRows.map(([label,value])=>`<div><b>${label}</b><span>${value}</span></div>`).join("")}</div>`;
  const available=[];
  if(emotion.length)available.push(["anxiety",emotionLabel(s)]);
  if(prob.length)available.push(["expectancy",MET.expectancy]);

  hmetric.innerHTML="";
  for(const[k,l]of available){
    const o=document.createElement("option");
    o.value=k;o.textContent=l;
    hmetric.appendChild(o);
  }

  if(emotion.length&&prob.length){
    hmetric.classList.add("hidden");
    historyChartSecondaryWrap.classList.remove("hidden");
    historyChartPrimaryTitle.textContent="Probabilité de l’issue redoutée";
    historyChartSecondaryTitle.textContent=emotionLabel(s);
    draw(hchart,ms,"expectancy");
    draw(hchartSecondary,ms,"anxiety");
  }else if(available.length){
    hmetric.classList.add("hidden");
    historyChartSecondaryWrap.classList.add("hidden");
    historyChartPrimaryTitle.textContent=available[0][0]==="expectancy"?"Probabilité de l’issue redoutée":emotionLabel(s);
    draw(hchart,ms,available[0][0]);
  }else{
    hmetric.classList.add("hidden");
    historyChartSecondaryWrap.classList.add("hidden");
    historyChartPrimaryTitle.textContent="";
    draw(hchart,[],"anxiety");
  }

  renderObservations(hobservations,ms);
}

function renderObservations(container,ms){
  const notes=ms.filter(m=>m.note&&m.note.trim());
  const isHabituation=s.therapeuticTarget==="Habituation";
  container.innerHTML=notes.length?`<h3>Observations</h3>${notes.map(m=>`<div class="observation"><time>${formatElapsed(m.elapsedSeconds)}</time><span>${esc(m.note)}</span></div>`).join("")}`:'<h3>Observations</h3><p class="muted">Aucune observation enregistrée.</p>';
}

async function measurements(id){const r=await rq(st("measurements").index("sessionId").getAll(IDBKeyRange.only(id)));return r.sort((a,b)=>a.elapsedSeconds-b.elapsedSeconds)}
async function liveGraph(){
  const ms=active?await measurements(active.id):[];
  const invalidation=active?.therapeuticTarget==="Invalidation des attentes";
  const emotionEnabled=useEmotion.checked;
  const expectancyEnabled=invalidation&&useExpectancy.checked;

  if(invalidation&&emotionEnabled&&expectancyEnabled){
    liveChartSecondaryWrap.classList.remove("hidden");
    draw(liveChart,ms,"expectancy");
    draw(liveChartSecondary,ms,"anxiety");
  }else{
    liveChartSecondaryWrap.classList.add("hidden");
    draw(liveChart,ms,expectancyEnabled&&!emotionEnabled?"expectancy":"anxiety");
  }
}

function draw(c,ms,key){
  const ratio=devicePixelRatio||1,w=c.clientWidth||700,h=Math.max(320,Math.min(440,w*.58));
  c.width=w*ratio;c.height=h*ratio;
  const x=c.getContext("2d");x.setTransform(ratio,0,0,ratio,0,0);x.clearRect(0,0,w,h);
  const L=58,R=24,T=28,B=48,PW=w-L-R,PH=h-T-B;
  const bg=x.createLinearGradient(0,T,0,T+PH);bg.addColorStop(0,"#f7faff");bg.addColorStop(1,"#ffffff");
  x.fillStyle=bg;roundRect(x,L,T,PW,PH,14);x.fill();
  x.font="12px -apple-system,BlinkMacSystemFont,sans-serif";x.strokeStyle="#e6eaf0";x.lineWidth=1;x.fillStyle="#667085";x.textAlign="right";
  for(let v=0;v<=100;v+=20){const y=T+PH-v/100*PH;x.beginPath();x.moveTo(L,y);x.lineTo(w-R,y);x.stroke();x.fillText(v,L-10,y+4)}
  const valid=ms.filter(m=>m[key]!==null&&m[key]!==undefined);
  if(!valid.length){x.textAlign="center";x.fillStyle="#98a2b3";x.fillText("Aucune mesure pour cet indicateur",L+PW/2,T+PH/2);c._chartState={points:[],key};attachHover(c);return}
  const max=Math.max(1,...valid.map(m=>m.elapsedSeconds/60));
  const pts=valid.map(m=>({x:L+(m.elapsedSeconds/60/max)*PW,y:T+PH-(+m[key])/100*PH,measurement:m,value:+m[key]}));
  const fill=x.createLinearGradient(0,T,0,T+PH);fill.addColorStop(0,"rgba(36,87,197,.22)");fill.addColorStop(1,"rgba(36,87,197,0)");
  x.beginPath();x.moveTo(pts[0].x,T+PH);pts.forEach(p=>x.lineTo(p.x,p.y));x.lineTo(pts[pts.length-1].x,T+PH);x.closePath();x.fillStyle=fill;x.fill();
  x.strokeStyle="#2457c5";x.lineWidth=3;x.lineJoin="round";x.lineCap="round";x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.stroke();
  for(const p of pts){x.fillStyle="white";x.beginPath();x.arc(p.x,p.y,6,0,Math.PI*2);x.fill();x.strokeStyle="#2457c5";x.lineWidth=3;x.stroke()}
  x.fillStyle="#667085";x.textAlign="center";for(let i=0;i<=4;i++)x.fillText((max*i/4).toFixed(1),L+PW*i/4,T+PH+24);x.fillText("Temps écoulé (minutes)",L+PW/2,h-8);
  c._chartState={points:pts,key};attachHover(c);
}

function attachHover(c){
  if(c._hoverBound)return;
  c._hoverBound=true;
  c.addEventListener("mousemove",e=>{
    const state=c._chartState||{points:[]};
    const rect=c.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    let nearest=null,dist=Infinity;
    for(const p of state.points){const d=Math.hypot(mx-p.x,my-p.y);if(d<dist){dist=d;nearest=p}}
    const tooltip=c.parentElement.querySelector(".chart-tooltip");
    if(!tooltip)return;
    if(nearest&&dist<=14){
      const note=(nearest.measurement.note||"").trim();
      tooltip.innerHTML=`<strong>${state.key==="anxiety"?emotionLabel(active):MET[state.key]} : ${nearest.value}/100</strong><div>${formatElapsed(nearest.measurement.elapsedSeconds)}</div>${note?`<div>${esc(note)}</div>`:""}`;
      tooltip.style.left=nearest.x+"px";tooltip.style.top=nearest.y+"px";tooltip.classList.remove("hidden");
    }else tooltip.classList.add("hidden");
  });
  c.addEventListener("mouseleave",()=>{const tooltip=c.parentElement.querySelector(".chart-tooltip");if(tooltip)tooltip.classList.add("hidden")});
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h)}

async function exportAll(){downloadJson({application:"ExpoClinique",version:1,exportedAt:new Date().toISOString(),patients:await all("patients"),sessions:await all("sessions"),measurements:await all("measurements"),optex:await all("optex"),hierarchies:await all("hierarchies"),scripts:await all("scripts")},"ExpoClinique_sauvegarde_"+new Date().toISOString().slice(0,10)+".json")}
async function importAll(){if(!importfile.files.length){toast("Sélectionnez un fichier.");return}try{const d=JSON.parse(await importfile.files[0].text());if(d.application!=="ExpoClinique")throw 0;const t=db.transaction(["patients","sessions","measurements","optex","hierarchies","scripts"],"readwrite");for(const n of["patients","sessions","measurements","optex","hierarchies","scripts"])t.objectStore(n).clear();d.patients.forEach(v=>t.objectStore("patients").put(v));d.sessions.forEach(v=>t.objectStore("sessions").put(v));d.measurements.forEach(v=>t.objectStore("measurements").put(v));
    (d.optex||[]).forEach(v=>t.objectStore("optex").put(v));
    (d.hierarchies||[]).forEach(v=>t.objectStore("hierarchies").put(v));
    (d.scripts||[]).forEach(v=>t.objectStore("scripts").put(v));await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=no});selected=null;await refresh();toast("Sauvegarde restaurée.")}catch(e){toast("Fichier non reconnu.")}}

async function exportSession(){
  if(!selected)return;
  const s=await rq(st("sessions").get(selected));
  const p=await rq(st("patients").get(s.patientId));
  const ms=await measurements(s.id);
  try{
    const pdf=await createSessionPdf(s,p,ms);
    openPdfBlob(pdf,`${safeName(p.code)}_${s.date.slice(0,10)}_${safeName(s.title)}.pdf`);
  }catch(error){
    console.error(error);
    toast("Impossible de générer le PDF.");
  }
}

async function createSessionPdf(s,p,ms){
  const W=1240,H=1754,M=70;
  const pages=[];
  let canvas,ctx,y;

  const emotion=ms.filter(m=>m.anxiety!==null&&m.anxiety!==undefined);
  const prob=ms.filter(m=>m.expectancy!==null&&m.expectancy!==undefined);
  const emotionMax=emotion.length?Math.max(...emotion.map(m=>+m.anxiety)):null;
  const emotionFinal=emotion.length?+emotion[emotion.length-1].anxiety:null;
  const initialProb=s.initialExpectancy??(prob.length?+prob[0].expectancy:null);
  const finalProb=s.finalExpectancy??(prob.length?+prob[prob.length-1].expectancy:null);
  const notes=ms.filter(m=>m.note&&m.note.trim());
  const habituation=s.therapeuticTarget==="Habituation";

  function newPage(title=true){
    if(canvas)pages.push(canvas.toDataURL("image/jpeg",0.94));
    canvas=document.createElement("canvas");
    canvas.width=W;canvas.height=H;
    ctx=canvas.getContext("2d");
    ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
    y=M;
    if(title){
      text("Compte rendu d’exposition",M,y+18,42,"700","#101828");
      text(`${p.code}  •  ${fmtDate(s.date)}`,M,y+58,21,"400","#667085");
      if(getPsychologistName())text(`Professionnel : ${getPsychologistName()}`,W-M,y+58,18,"400","#667085","right");
      text(`Date d’édition : ${formattedEditionDate()}`,W-M,y+82,15,"400","#98a2b3","right");
      ctx.strokeStyle="#d0d5dd";
      ctx.beginPath();ctx.moveTo(M,y+88);ctx.lineTo(W-M,y+88);ctx.stroke();
      y+=120;
    }
  }

  function text(t,x0,y0,size=22,weight="400",color="#172033",align="left"){
    ctx.fillStyle=color;
    ctx.font=`${weight} ${size}px Arial`;
    ctx.textAlign=align;
    ctx.textBaseline="alphabetic";
    ctx.fillText(String(t??""),x0,y0);
  }

  function wrapLines(t,maxW,size=20,weight="400"){
    ctx.font=`${weight} ${size}px Arial`;
    const words=String(t??"").split(/\s+/).filter(Boolean);
    const lines=[];let line="";
    for(const word of words){
      const test=line?line+" "+word:word;
      if(ctx.measureText(test).width>maxW&&line){
        lines.push(line);line=word;
      }else line=test;
    }
    if(line)lines.push(line);
    return lines;
  }

  function ensure(space){
    if(y+space>H-M-35)newPage(false);
  }

  function paragraph(label,value,opts={}){
    if(value===null||value===undefined||value==="")return;
    const maxW=opts.maxW||W-2*M;
    const size=opts.size||20;
    const lineH=opts.lineH||27;
    const lines=wrapLines(value,maxW,size,"400");
    const needed=34+lines.length*lineH+18;
    ensure(needed);
    text(label,M,y,17,"700","#475467");
    y+=30;
    ctx.fillStyle="#344054";
    ctx.font=`400 ${size}px Arial`;
    ctx.textAlign="left";
    lines.forEach(line=>{ctx.fillText(line,M,y);y+=lineH;});
    y+=18;
  }

  function cardRow(cards){
    if(!cards.length)return;
    const gap=14;
    const perRow=3;
    for(let i=0;i<cards.length;i+=perRow){
      const rowCards=cards.slice(i,i+perRow);
      const cardW=(W-2*M-gap*(rowCards.length-1))/rowCards.length;
      ensure(145);
      rowCards.forEach((card,j)=>{
        const x0=M+j*(cardW+gap);
        ctx.beginPath();ctx.roundRect(x0,y,cardW,120,16);
        ctx.fillStyle="#fff";ctx.fill();
        ctx.strokeStyle="#d0d5dd";ctx.stroke();
        text(card[0],x0+16,y+30,16,"700","#475467");
        if(card[2]){
          text(card[1],x0+16,y+72,26,"700","#101828");
          text(card[3],x0+16,y+98,14,"400","#98a2b3");
          text(card[2],x0+cardW-16,y+72,26,"700","#2457c5","right");
          text(card[4],x0+cardW-16,y+98,14,"400","#98a2b3","right");
        }else{
          text(card[1],x0+16,y+72,28,"700","#101828");
          text(card[3]||"",x0+16,y+98,14,"400","#98a2b3");
        }
      });
      y+=138;
    }
  }

  function drawGraphSection(metricKey,label){
    ensure(330);
    text(label.toUpperCase(),M,y,17,"700","#475467");
    const graph=document.createElement("canvas");
    graph.width=1090;graph.height=260;graph.style.width="1090px";
    drawStatic(graph,ms,metricKey);
    ctx.drawImage(graph,M,y+18,W-2*M,260);
    y+=305;
  }

  newPage(true);

  // Context
  paragraph("Type",s.type||"—",{size:20});
  paragraph("Cible thérapeutique",s.therapeuticTarget||"—",{size:20});
  paragraph("Durée",formatDuration(s.durationSeconds||0),{size:20});
  paragraph("Cible",s.target||"—",{size:20});
  if(!habituation&&s.fear)paragraph("Issue redoutée",s.fear,{size:20});

  // Indicators
  ensure(36);
  text("INDICATEURS",M,y,17,"700","#475467");
  y+=24;
  const cards=[["Nombre de mesures",String(ms.length),"","Total",""]];
  if(habituation){
    if(emotion.length)cards.push([emotionLabel(s),scorePlain(emotionMax),scorePlain(emotionFinal),"Maximum","Finale"]);
    if(s.exerciseDifficulty!==null&&s.exerciseDifficulty!==undefined)cards.push(["Difficulté",scorePlain(s.exerciseDifficulty),"","Anticipée",""]);
  }else{
    if(initialProb!==null||finalProb!==null)cards.push(["Probabilité",scorePlain(initialProb),scorePlain(finalProb),"Initiale","Finale"]);
    if(emotion.length)cards.push([emotionLabel(s),scorePlain(emotionMax),scorePlain(emotionFinal),"Maximum","Finale"]);
    if(s.expectedSeverity!==null||s.actualSeverity!==null)cards.push(["Gravité",scorePlain(s.expectedSeverity),scorePlain(s.actualSeverity),"Attendue","Finale"]);
    if(s.exerciseDifficulty!==null&&s.exerciseDifficulty!==undefined)cards.push(["Difficulté",scorePlain(s.exerciseDifficulty),"","Anticipée",""]);
    if(s.surprise!==null&&s.surprise!==undefined)cards.push(["Surprise",scorePlain(s.surprise),"","Évaluation",""]);
  }
  cardRow(cards);

  // Clinical narrative
  if(habituation){
    paragraph("Bilan de l’exercice",s.learning||"Aucun bilan renseigné.",{size:20});
  }else{
    paragraph("L’issue redoutée s’est-elle produite ?",s.occurred||"Non renseigné",{size:20});
    paragraph("Ce qui s’est réellement produit",s.actual,{size:19});
    if(s.journal?.howKnow)paragraph("Comment le savez-vous ?",s.journal.howKnow,{size:19});
    if(s.journal?.expectedVsActual)paragraph("À quoi vous attendiez-vous ? Qu’est-ce qui s’est passé ?",s.journal.expectedVsActual,{size:19});
    paragraph("Apprentissage",s.learning,{size:19});
    paragraph("Prochaine étape",s.next,{size:19});

    if(s.plan){
      const planItems=[
        ["Ce qui est mis à l’épreuve",s.plan.fearTested],
        ["Comment cela est mis à l’épreuve",s.plan.howTest],
        ["Ce à quoi le patient renonce",s.plan.giveUp],
        ["Comment rester dans la situation",s.plan.stay],
        ["Combinaison des éléments",s.plan.combine],
        ["Comment l’affronter",s.plan.face],
        ["Exposition complète",s.plan.fullExposure]
      ];
      for(const[label,value]of planItems)paragraph(label,value,{size:18});
    }
  }

  // Graphs
  if(prob.length)drawGraphSection("expectancy","Probabilité de l’issue redoutée");
  if(emotion.length)drawGraphSection("anxiety",emotionLabel(s));

  // Observations
  if(notes.length){
    ensure(40);
    text("OBSERVATIONS",M,y,17,"700","#475467");
    y+=30;
    for(const note of notes){
      const lines=wrapLines(note.note,W-2*M-90,17,"400");
      const needed=Math.max(30,lines.length*23)+14;
      ensure(needed);
      text(formatElapsed(note.elapsedSeconds),M,y,16,"700","#2457c5");
      ctx.fillStyle="#344054";
      ctx.font="400 17px Arial";
      let yy=y;
      lines.forEach(line=>{ctx.fillText(line,M+90,yy);yy+=23;});
      y+=needed;
    }
  }

  
  pages.push(canvas.toDataURL("image/jpeg",0.94));
  return imagesToPdf(pages,W,H);
}

function drawStatic(c,ms,key){
  const x=c.getContext("2d"),w=c.width,h=c.height,L=70,R=28,T=34,B=58,PW=w-L-R,PH=h-T-B;
  x.fillStyle="white";x.fillRect(0,0,w,h);x.strokeStyle="#e6eaf0";x.fillStyle="#667085";x.font="18px Arial";x.textAlign="right";
  for(let v=0;v<=100;v+=20){const yy=T+PH-v/100*PH;x.beginPath();x.moveTo(L,yy);x.lineTo(w-R,yy);x.stroke();x.fillText(v,L-12,yy+6)}
  const valid=ms.filter(m=>m[key]!==null&&m[key]!==undefined);if(!valid.length)return;
  const max=Math.max(1,...valid.map(m=>m.elapsedSeconds/60)),pts=valid.map(m=>({x:L+(m.elapsedSeconds/60/max)*PW,y:T+PH-(+m[key])/100*PH}));
  const fill=x.createLinearGradient(0,T,0,T+PH);fill.addColorStop(0,"rgba(36,87,197,.22)");fill.addColorStop(1,"rgba(36,87,197,0)");
  x.beginPath();x.moveTo(pts[0].x,T+PH);pts.forEach(p=>x.lineTo(p.x,p.y));x.lineTo(pts[pts.length-1].x,T+PH);x.closePath();x.fillStyle=fill;x.fill();
  x.strokeStyle="#2457c5";x.lineWidth=5;x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.stroke();
  for(const p of pts){x.fillStyle="white";x.beginPath();x.arc(p.x,p.y,8,0,Math.PI*2);x.fill();x.strokeStyle="#2457c5";x.lineWidth=4;x.stroke()}
  x.fillStyle="#667085";x.textAlign="center";for(let i=0;i<=4;i++)x.fillText((max*i/4).toFixed(1),L+PW*i/4,T+PH+30);x.fillText("Temps écoulé (minutes)",L+PW/2,h-12);
}

function imagesToPdf(dataUrls,w,h){
  const enc=new TextEncoder(),objects=[],offsets=[0];
  const pushObj=s=>objects.push(enc.encode(s));
  pushObj("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds=[],imageIds=[];
  for(let i=0;i<dataUrls.length;i++){pageIds.push(3+i*3);imageIds.push(5+i*3)}
  pushObj(`<< /Type /Pages /Count ${dataUrls.length} /Kids [${pageIds.map(id=>id+" 0 R").join(" ")}] >>`);
  for(let i=0;i<dataUrls.length;i++){
    const pageId=3+i*3,contentId=4+i*3,imageId=5+i*3;
    const pdfW=595.28,pdfH=841.89;
    pushObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream=`q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im${i} Do\nQ\n`;
    pushObj(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const binary=atob(dataUrls[i].split(",")[1]),bytes=new Uint8Array(binary.length);
    for(let j=0;j<binary.length;j++)bytes[j]=binary.charCodeAt(j);
    const head=enc.encode(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    const tail=enc.encode("\nendstream");
    const allBytes=new Uint8Array(head.length+bytes.length+tail.length);allBytes.set(head);allBytes.set(bytes,head.length);allBytes.set(tail,head.length+bytes.length);
    objects.push(allBytes);
  }
  const header=enc.encode("%PDF-1.4\n");
  let total=header.length;
  const chunks=[header];
  objects.forEach((obj,i)=>{offsets[i+1]=total;const pre=enc.encode(`${i+1} 0 obj\n`),post=enc.encode("\nendobj\n");chunks.push(pre,obj,post);total+=pre.length+obj.length+post.length});
  const xrefOffset=total;
  let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)xref+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(enc.encode(xref));
  return new Blob(chunks,{type:"application/pdf"});
}

async function deleteSession(){if(!selected||!confirm("Supprimer définitivement cette séance ?"))return;const ms=await measurements(selected),t=db.transaction(["sessions","measurements"],"readwrite");t.objectStore("sessions").delete(selected);ms.forEach(m=>t.objectStore("measurements").delete(m.id));await new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=no});selected=null;hdetail.classList.add("hidden");hempty.classList.remove("hidden");await refresh();toast("Séance supprimée.")}

function downloadJson(d,n){const u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=u;a.download=n;a.click();URL.revokeObjectURL(u)}
function toast(m){const e=document.getElementById("toast");e.textContent=m;e.classList.remove("hidden");clearTimeout(e.t);e.t=setTimeout(()=>e.classList.add("hidden"),2200)}
const score=v=>v===null||v===undefined||Number.isNaN(+v)?"Non enregistré":`${v}/100`;
const scorePlain=v=>v===null||v===undefined||Number.isNaN(+v)?"Non enregistré":`${v}/100`;
const formatDuration=s=>`${Math.floor((s||0)/60)} min ${Math.floor((s||0)%60)} s`;
const formatElapsed=s=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,"0")}`;
const fmtDate=v=>new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
const safeName=v=>String(v||"document").replace(/[^\p{L}\p{N}_-]+/gu,"_");
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}


// ---------------------------------------------------------------------
// OptEx Nexus
// ---------------------------------------------------------------------
const PREDICTOR_CATEGORIES = [
  ["physical", "Sensations physiques"],
  ["situations", "Situations et caractéristiques"],
  ["objects", "Objets"],
  ["thoughts", "Pensées et images mentales"],
  ["other", "Autres prédicteurs"]
];

function predictorHelp(key){
  const help={
    physical:"Sensations internes ou signes corporels interprétés comme annonçant l’issue redoutée.",
    situations:"Contextes, lieux, moments ou caractéristiques environnementales associés à une augmentation du risque perçu.",
    objects:"Objets ou stimuli externes qui activent ou renforcent la prédiction de l’issue.",
    thoughts:"Pensées, images mentales, souvenirs ou anticipations qui renforcent la menace.",
    other:"Tout autre élément perçu comme augmentant la probabilité de l’issue redoutée."
  };
  return help[key]||"";
}

function buildPredictorCategories(data={}){
  predictorCategories.innerHTML="";
  for(const[key,label]of PREDICTOR_CATEGORIES){
    const section=document.createElement("section");
    section.className="predictor-category";
    section.innerHTML=`
      <div class="predictor-category-header">
        <div>
          <h4>${label}</h4>
          <p>${predictorHelp(key)}</p>
        </div>
        <button type="button" class="secondary add-predictor-btn">Ajouter une entrée</button>
      </div>
      <div class="predictor-entry-list"></div>`;
    predictorCategories.appendChild(section);
    const list=section.querySelector(".predictor-entry-list");
    section.querySelector(".add-predictor-btn").onclick=()=>addPredictorEntry(list,key);
    const entries=Array.isArray(data[key])?data[key]:[];
    if(entries.length)entries.forEach(entry=>addPredictorEntry(list,key,entry));
    else addPredictorEntry(list,key);
  }
}

function addPredictorEntry(list,key,entry={}){
  const row=document.createElement("div");
  row.className="predictor-entry";
  row.dataset.category=key;
  row.innerHTML=`
    <textarea class="predictor-text" rows="2" placeholder="Décrire un prédicteur précis">${esc(entry.text||"")}</textarea>
    <select class="predictor-type">
      <option value="">—</option>
      <option value="SC">SC</option>
      <option value="OS">OS</option>
    </select>
    <label class="maximal-label"><input type="checkbox" class="predictor-maximal"> Prédiction maximale</label>
    <button type="button" class="remove-predictor" title="Supprimer">×</button>`;
  row.querySelector(".predictor-type").value=entry.type||"";
  row.querySelector(".predictor-maximal").checked=!!entry.maximal;
  row.querySelector(".remove-predictor").onclick=()=>{
    row.remove();
    if(!list.children.length)addPredictorEntry(list,key);
  };
  list.appendChild(row);
}

function collectPredictors(){
  const data={};
  for(const[key]of PREDICTOR_CATEGORIES)data[key]=[];
  document.querySelectorAll(".predictor-entry").forEach(row=>{
    const text=row.querySelector(".predictor-text").value.trim();
    if(!text)return;
    data[row.dataset.category].push({
      text,
      type:row.querySelector(".predictor-type").value,
      maximal:row.querySelector(".predictor-maximal").checked
    });
  });
  return data;
}

async function saveOptEx(e){
  e.preventDefault();
  const patientId=Number(document.getElementById("optexPatient").value);
  if(!patientId){
    toast("Sélectionnez un patient.");
    return;
  }
  const id=Number(optexId.value)||null;
  const record={
    patientId,
    title:optexTitle.value.trim()||"OptEx Nexus",
    outcome:optexOutcome.value.trim(),
    predictors:collectPredictors(),
    principalCS:optexPrincipalCS.value.trim(),
    inhibitors:{
      safetyBehaviors:optexSafetyBehaviors.value.trim(),
      reassuringThoughts:optexReassuringThoughts.value.trim(),
      counterphobicObjects:optexCounterphobicObjects.value.trim(),
      safePlaces:optexSafePlaces.value.trim(),
      other:optexOtherInhibitors.value.trim()
    },
    optimalExposure:optexOptimalExposure.value.trim(),
    duration:optexDuration.value.trim(),
    updatedAt:new Date().toISOString()
  };
  if(id){
    record.id=id;
    const old=await rq(st("optex").get(id));
    record.createdAt=old?.createdAt||record.updatedAt;
    await put("optex",record);
  }else{
    record.createdAt=record.updatedAt;
    record.id=await add("optex",record);
    optexId.value=record.id;
  }
  deleteOptExBtn.classList.remove("hidden");
  await renderOptExList();
  toast("OptEx Nexus enregistré.");
}

function clearOptExForm(){
  optexForm.reset();
  optexId.value="";
  optexTitle.value="OptEx Nexus";
  deleteOptExBtn.classList.add("hidden");
  buildPredictorCategories();
  scrollTo(0,0);
}

async function renderOptExList(){
  const pid=Number(optexPatientFilter?.value)||0;
  const records=(await all("optex"))
    .filter(r=>!pid||r.patientId===pid)
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  const patients=await all("patients");
  const map=Object.fromEntries(patients.map(p=>[p.id,p]));

  optexList.innerHTML=records.length?"":"<p class='muted'>Aucun Nexus enregistré.</p>";

  for(const r of records){
    const wrap=document.createElement("div");
    wrap.className="module-list-item-wrap";

    const b=document.createElement("button");
    b.type="button";
    b.className="module-list-item";
    b.innerHTML=`<strong>${esc(r.title||"OptEx Nexus")}</strong><small>${esc(map[r.patientId]?.code||"")} · ${esc(r.outcome||"")}</small>`;
    b.onclick=()=>loadOptEx(r.id);

    const del=document.createElement("button");
    del.type="button";
    del.className="module-delete-btn";
    del.title="Supprimer cet OptEx Nexus";
    del.setAttribute("aria-label","Supprimer cet OptEx Nexus");
    del.onclick=async event=>{
      event.stopPropagation();
      if(!confirm("Supprimer définitivement cet OptEx Nexus ?"))return;
      await rq(st("optex","readwrite").delete(r.id));
      if(Number(optexId.value)===r.id)clearOptExForm();
      await renderOptExList();
      toast("OptEx Nexus supprimé.");
    };

    wrap.appendChild(b);
    wrap.appendChild(del);
    optexList.appendChild(wrap);
  }
}

async function loadOptEx(id){
  const r=await rq(st("optex").get(id));if(!r)return;
  optexId.value=r.id;optexPatient.value=r.patientId;
  document.getElementById("optexPatient").dispatchEvent(new Event("change",{bubbles:true}));
  const optexPatientSearch=document.getElementById("optexPatient")?.parentElement?.querySelector(".patient-autocomplete-input");
  if(optexPatientSearch){
    const selectedOption=document.getElementById("optexPatient").selectedOptions[0];
    optexPatientSearch.value=selectedOption?.value?selectedOption.textContent:"";
  }optexTitle.value=r.title||"OptEx Nexus";
  optexOutcome.value=r.outcome||"";optexPrincipalCS.value=r.principalCS||"";
  buildPredictorCategories(r.predictors||{});
  optexSafetyBehaviors.value=r.inhibitors?.safetyBehaviors||"";
  optexReassuringThoughts.value=r.inhibitors?.reassuringThoughts||"";
  optexCounterphobicObjects.value=r.inhibitors?.counterphobicObjects||"";
  optexSafePlaces.value=r.inhibitors?.safePlaces||"";
  optexOtherInhibitors.value=r.inhibitors?.other||"";
  optexOptimalExposure.value=r.optimalExposure||"";
  optexDuration.value=r.duration||"";
  deleteOptExBtn.classList.remove("hidden");
  scrollTo(0,0);
}

async function deleteOptEx(){
  const id=Number(optexId.value);if(!id)return;
  if(!confirm("Supprimer définitivement cet OptEx Nexus ?"))return;
  await rq(st("optex","readwrite").delete(id));
  clearOptExForm();await renderOptExList();toast("OptEx Nexus supprimé.");
}

// ---------------------------------------------------------------------
// Hiérarchie des peurs
// ---------------------------------------------------------------------
function addDefaultHierarchyItems(){
  if(!hierarchyItems.children.length){
    addHierarchyItem();addHierarchyItem();addHierarchyItem();addHierarchyItem();addHierarchyItem();
  }
}

function addHierarchyItem(item={}){
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td class="level-cell"></td>
    <td><input class="hierarchy-description" value="${esc(item.description||"")}" placeholder="Décrire la situation ou l’exercice"></td>
    <td><input class="score-input hierarchy-emotion" type="number" min="0" max="100" value="${item.emotion??50}"></td>
    
    
    <td><button type="button" class="remove-item" title="Supprimer">×</button></td>`;
  
  
  tr.querySelector(".remove-item").onclick=()=>{tr.remove();renumberHierarchyItems()};
  hierarchyItems.appendChild(tr);
  renumberHierarchyItems();updateHierarchyRowStyles();
}

function renumberHierarchyItems(){
  [...hierarchyItems.children].forEach((tr,i)=>tr.querySelector(".level-cell").textContent=i+1);
}

function updateHierarchyRowStyles(){}

function collectHierarchyItems(){
  return [...hierarchyItems.children].map((tr,i)=>({
    order:i+1,
    description:tr.querySelector(".hierarchy-description").value.trim(),
    emotion:Number(tr.querySelector(".hierarchy-emotion").value),
    status:""
  })).filter(x=>x.description);
}

function sortHierarchyItems(){
  const items=collectHierarchyItems().sort((a,b)=>a.emotion-b.emotion);
  hierarchyItems.innerHTML="";
  for(const item of items)addHierarchyItem(item);
  if(!items.length)addHierarchyItem();
}

async function saveHierarchy(e){
  e.preventDefault();
  const id=Number(hierarchyId.value)||null;
  const items=collectHierarchyItems();
  if(!items.length){toast("Ajoutez au moins un exercice.");return}
  const record={
    patientId:Number(hierarchyPatient.value),
    title:hierarchyTitle.value.trim(),
    outcome:hierarchyOutcome.value.trim(),
    items,
    notes:hierarchyNotes.value.trim(),
    updatedAt:new Date().toISOString()
  };
  if(id){
    record.id=id;
    const old=await rq(st("hierarchies").get(id));
    record.createdAt=old?.createdAt||record.updatedAt;
    await put("hierarchies",record);
  }else{
    record.createdAt=record.updatedAt;
    record.id=await add("hierarchies",record);
    hierarchyId.value=record.id;
  }
  deleteHierarchyBtn.classList.remove("hidden");
  await renderHierarchyList();
  toast("Hiérarchie enregistrée.");
}

function clearHierarchyForm(){
  hierarchyForm.reset();hierarchyId.value="";
  hierarchyItems.innerHTML="";addDefaultHierarchyItems();
  deleteHierarchyBtn.classList.add("hidden");
  scrollTo(0,0);
}

async function renderHierarchyList(){
  const pid=Number(hierarchyPatientFilter?.value)||0;
  const records=(await all("hierarchies"))
    .filter(r=>!pid||r.patientId===pid)
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  const patients=await all("patients");
  const map=Object.fromEntries(patients.map(p=>[p.id,p]));

  hierarchyList.innerHTML=records.length?"":"<p class='muted'>Aucune hiérarchie enregistrée.</p>";

  for(const r of records){
    const wrap=document.createElement("div");
    wrap.className="module-list-item-wrap";

    const b=document.createElement("button");
    b.type="button";
    b.className="module-list-item";
    b.innerHTML=`<strong>${esc(r.title)}</strong><small>${esc(map[r.patientId]?.code||"")} · ${r.items?.length||0} exercice(s)</small>`;
    b.onclick=()=>loadHierarchy(r.id);

    const del=document.createElement("button");
    del.type="button";
    del.className="module-delete-btn";
    del.title="Supprimer cette hiérarchie";
    del.setAttribute("aria-label","Supprimer cette hiérarchie");
    del.onclick=async event=>{
      event.stopPropagation();
      if(!confirm("Supprimer définitivement cette hiérarchie ?"))return;
      await rq(st("hierarchies","readwrite").delete(r.id));
      if(Number(hierarchyId.value)===r.id)clearHierarchyForm();
      await renderHierarchyList();
      toast("Hiérarchie supprimée.");
    };

    wrap.appendChild(b);
    wrap.appendChild(del);
    hierarchyList.appendChild(wrap);
  }
}

async function loadHierarchy(id){
  const r=await rq(st("hierarchies").get(id));if(!r)return;
  hierarchyId.value=r.id;hierarchyPatient.value=r.patientId;
  document.getElementById("hierarchyPatient").dispatchEvent(new Event("change",{bubbles:true}));
  const hierarchyPatientSearch=document.getElementById("hierarchyPatient")?.parentElement?.querySelector(".patient-autocomplete-input");
  if(hierarchyPatientSearch){
    const selectedOption=document.getElementById("hierarchyPatient").selectedOptions[0];
    hierarchyPatientSearch.value=selectedOption?.value?selectedOption.textContent:"";
  }
  hierarchyTitle.value=r.title||"";hierarchyOutcome.value=r.outcome||"";
  hierarchyNotes.value=r.notes||"";
  hierarchyItems.innerHTML="";
  for(const item of r.items||[])addHierarchyItem(item);
  if(!r.items?.length)addHierarchyItem();
  deleteHierarchyBtn.classList.remove("hidden");
  scrollTo(0,0);
}

async function deleteHierarchy(){
  const id=Number(hierarchyId.value);if(!id)return;
  if(!confirm("Supprimer définitivement cette hiérarchie ?"))return;
  await rq(st("hierarchies","readwrite").delete(id));
  clearHierarchyForm();await renderHierarchyList();toast("Hiérarchie supprimée.");
}


async function exportOptExPdf(){
  const id=Number(optexId.value);
  if(!id){toast("Enregistrez d’abord le Nexus.");return}
  const r=await rq(st("optex").get(id));
  const p=await rq(st("patients").get(r.patientId));
  const blob=createOptExPdf(r,p);
  openPdfBlob(blob,`${safeName(p.code)}_${safeName(r.title||"OptEx_Nexus")}.pdf`);
}

function createOptExPdf(r,p){
  const W=1240,H=1754,M=62,G=24,CW=(W-2*M-G)/2,BOTTOM=H-122;
  const LX=M,RX=M+CW+G,pages=[];
  let c,x,leftY,rightY;

  const predictors=[];
  for(const[key,label]of PREDICTOR_CATEGORIES){
    const items=Array.isArray(r.predictors?.[key])?r.predictors[key]:[];
    if(items.length)predictors.push({label,items});
  }

  const inhibitors=[
    ["Comportements de sécurité",r.inhibitors?.safetyBehaviors],
    ["Pensées rassurantes",r.inhibitors?.reassuringThoughts],
    ["Objets contra-phobiques",r.inhibitors?.counterphobicObjects],
    ["Endroits sûrs",r.inhibitors?.safePlaces],
    ["Autres inhibiteurs",r.inhibitors?.other]
  ].filter(([,v])=>String(v||"").trim());

  function text(t,xx,yy,size=18,weight="400",color="#172033",align="left"){
    x.fillStyle=color;x.font=`${weight} ${size}px Arial`;x.textAlign=align;x.textBaseline="alphabetic";x.fillText(String(t??""),xx,yy);
  }

  function wrap(t,maxW,size=15,weight="400"){
    x.font=`${weight} ${size}px Arial`;
    const lines=[];
    for(const paragraph of String(t??"").replace(/\r/g,"").split("\n")){
      const words=paragraph.split(/\s+/).filter(Boolean);
      if(!words.length){lines.push("");continue}
      let line="";
      for(const word of words){
        const test=line?`${line} ${word}`:word;
        if(line&&x.measureText(test).width>maxW){lines.push(line);line=word}else line=test;
      }
      if(line)lines.push(line);
    }
    return lines.length?lines:["—"];
  }

  function box(xx,yy,w,h,stroke="#d0d5dd",fill="#fff"){
    x.fillStyle=fill;x.strokeStyle=stroke;x.lineWidth=1.4;x.beginPath();x.roundRect(xx,yy,w,h,14);x.fill();x.stroke();
  }

  function footer(){text("Synthèse générée avec Exposition",W-M,H-34,14,"400","#98a2b3","right")}

  function page(first=false){
    if(c){footer();pages.push(c.toDataURL("image/jpeg",.94))}
    c=document.createElement("canvas");c.width=W;c.height=H;x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,W,H);
    text(first?"OptEx Nexus":"OptEx Nexus — suite",M,72,first?36:27,"700","#101828");
    text(`${p.code}  •  ${r.title||"OptEx Nexus"}`,M,110,19,"400","#667085");
    if(getPsychologistName())text(`Professionnel : ${getPsychologistName()}`,W-M,110,17,"400","#667085","right");
    if(typeof formattedEditionDate==="function")text(`Date d’édition : ${formattedEditionDate()}`,W-M,134,14,"400","#98a2b3","right");
    x.strokeStyle="#d0d5dd";x.beginPath();x.moveTo(M,154);x.lineTo(W-M,154);x.stroke();
    leftY=rightY=184;
    box(LX,leftY,CW,48,"#e0c3c9","#fff8fa");text("1. Prédicteurs de l’issue redoutée",LX+16,leftY+31,18,"700","#8f2335");
    box(RX,rightY,CW,48,"#c7cdf4","#f7f8ff");text("2. Inhibiteurs",RX+16,rightY+31,18,"700","#2838b9");
    leftY+=66;rightY+=66;
  }

  function need(side,h){
    const yy=side==="left"?leftY:rightY;
    if(yy+h>BOTTOM)page(false);
  }

  function heading(side,label,color){
    need(side,32);
    const xx=side==="left"?LX:RX;
    let yy=side==="left"?leftY:rightY;
    text(label,xx+4,yy,16.5,"700",color);
    if(side==="left")leftY=yy+27;else rightY=yy+27;
  }

  function pred(group,item,first){
    if(first)heading("left",group,"#8f2335");
    const lines=wrap(`• ${item.text||"—"}`,CW-28,14.5);
    const meta=[item.type,item.maximal?"Prédiction maximale":""].filter(Boolean).join(" • ");
    need("left",lines.length*20+(meta?18:0)+12);
    for(const line of lines){text(line,LX+8,leftY,14.5,"400","#344054");leftY+=20}
    if(meta){text(meta,LX+20,leftY,12,"400","#98a2b3");leftY+=18}
    leftY+=9;
  }

  function inhib(label,value){
    heading("right",label,"#2838b9");
    const lines=wrap(value,CW-24,14.5);
    need("right",lines.length*20+14);
    for(const line of lines){text(line,RX+8,rightY,14.5,"400","#344054");rightY+=20}
    rightY+=14;
  }

  page(true);

  // Issue redoutée au-dessus des colonnes sur la première page
  const issue=wrap(r.outcome||"—",W-2*M-36,19,"600");
  const ih=Math.max(80,issue.length*27+34);
  box(M,178,W-2*M,ih,"#d0d5dd","#f8fafc");
  text("Issue redoutée",M+18,204,15.5,"700","#475467");
  let iy=233;
  for(const line of issue){text(line,M+18,iy,19,"600","#101828");iy+=27}
  leftY=rightY=178+ih+24;
  box(LX,leftY,CW,48,"#e0c3c9","#fff8fa");text("1. Prédicteurs de l’issue redoutée",LX+16,leftY+31,18,"700","#8f2335");
  box(RX,rightY,CW,48,"#c7cdf4","#f7f8ff");text("2. Inhibiteurs",RX+16,rightY+31,18,"700","#2838b9");
  leftY+=66;rightY+=66;

  if(predictors.length){
    for(const group of predictors)group.items.forEach((item,i)=>pred(group.label,item,i===0));
  }else{text("Aucun prédicteur renseigné.",LX+8,leftY,14.5,"400","#667085");leftY+=26}

  if(r.principalCS){
    heading("left","Principal stimulus conditionnel","#8f2335");
    const lines=wrap(r.principalCS,CW-24,14.5);
    need("left",lines.length*20+12);
    for(const line of lines){text(line,LX+8,leftY,14.5,"400","#344054");leftY+=20}
    leftY+=12;
  }

  if(inhibitors.length){
    for(const[label,value]of inhibitors)inhib(label,value);
  }else{text("Aucun inhibiteur renseigné.",RX+8,rightY,14.5,"400","#667085");rightY+=26}

  // Exposition optimale sous les colonnes
  let y=Math.max(leftY,rightY)+24;
  const exp=wrap(r.optimalExposure||"—",W-2*M-34,16.5);
  const dur=wrap(r.duration||"—",W-2*M-34,15.5);
  const ref="Craske, M. G., Treanor, M., Zbozinek, T. D., & Vervliet, B. (2022). Optimizing exposure therapy with an inhibitory retrieval approach and the OptEx Nexus. Behaviour Research and Therapy, 152, 104069.";
  const refs=wrap(ref,W-2*M-24,13);
  const needed=44+Math.max(88,exp.length*23+48)+18+Math.max(72,dur.length*21+44)+22+22+refs.length*18;
  if(y+needed>BOTTOM){page(false);y=Math.max(leftY,rightY)+24}

  text("3. Exposition optimale",M,y,22,"700","#101828");y+=36;
  const eh=Math.max(88,exp.length*23+48);box(M,y,W-2*M,eh);
  text("Exercice proposé",M+18,y+28,15.5,"700","#475467");
  let yy=y+53;for(const line of exp){text(line,M+18,yy,16.5,"400","#344054");yy+=23}y+=eh+18;

  const dh=Math.max(72,dur.length*21+44);box(M,y,W-2*M,dh);
  text("Durée ou critère d’arrêt",M+18,y+27,15.5,"700","#475467");
  yy=y+50;for(const line of dur){text(line,M+18,yy,15.5,"400","#344054");yy+=21}y+=dh+20;

  text("Référence",M,y,14,"700","#667085");y+=21;
  for(const line of refs){text(line,M,y,13,"400","#98a2b3");y+=18}

  footer();pages.push(c.toDataURL("image/jpeg",.94));
  return imagesToPdf(pages,W,H);
}

async function exportHierarchyPdf(){
  const id=Number(hierarchyId.value);
  if(!id){toast("Enregistrez d’abord la hiérarchie.");return}
  const r=await rq(st("hierarchies").get(id));
  const p=await rq(st("patients").get(r.patientId));
  const blob=createHierarchyPdf(r,p);
  openPdfBlob(blob,`${safeName(p.code)}_${safeName(r.title||"Hierarchie")}.pdf`);
}

function createHierarchyPdf(r,p){
  const W=1240,H=1754,M=70;
  const c=document.createElement("canvas");c.width=W;c.height=H;
  const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,W,H);

  const text=(t,xx,yy,size=22,weight="400",color="#172033",align="left")=>{
    x.fillStyle=color;x.font=`${weight} ${size}px Arial`;x.textAlign=align;x.fillText(String(t??""),xx,yy)
  };
  const wrap=(t,xx,yy,maxW,size=19,weight="400",color="#344054",lh=25,max=2)=>{
    x.font=`${weight} ${size}px Arial`;x.fillStyle=color;x.textAlign="left";
    const words=String(t??"").split(/\s+/).filter(Boolean);let line="",lines=[];
    for(const w of words){const test=line?line+" "+w:w;if(x.measureText(test).width>maxW&&line){lines.push(line);line=w;if(lines.length===max-1)break}else line=test}
    if(line&&lines.length<max)lines.push(line);
    lines.forEach((l,i)=>x.fillText(l,xx,yy+i*lh));
  };

  text("Hiérarchie des peurs",M,90,46,"700","#101828");
  text(`${p.code}  •  ${r.title}`,M,132,22,"400","#667085");
  if(getPsychologistName())text(`Professionnel : ${getPsychologistName()}`,W-M,132,18,"400","#667085","right");
  text(`Date d’édition : ${formattedEditionDate()}`,W-M,156,15,"400","#98a2b3","right");
  text("Issue redoutée principale",M,188,18,"700","#475467");
  wrap(r.outcome||"—",M,222,W-2*M,22,"500","#101828",30,2);

  const top=300,rowH=74;
  x.fillStyle="#f8fafc";x.fillRect(M,top,W-2*M,54);
  text("Niveau",M+18,top+35,17,"700","#475467");
  text("Situation ou exercice",M+130,top+35,17,"700","#475467");
  text("Émotion",W-360,top+35,17,"700","#475467");
  

  let y=top+54;
  (r.items||[]).slice(0,17).forEach((item,i)=>{
    if(i%2===1){x.fillStyle="#fafafa";x.fillRect(M,y,W-2*M,rowH)}
    x.strokeStyle="#eaecf0";x.beginPath();x.moveTo(M,y+rowH);x.lineTo(W-M,y+rowH);x.stroke();
    text(i+1,M+30,y+44,20,"700","#2457c5");
    wrap(item.description,M+130,y+30,W-560,18,"400","#172033",23,2);
    text(`${item.emotion}/100`,W-360,y+44,20,"700","#101828");
    
    y+=rowH;
  });

  if((r.items||[]).length>17)text(`+ ${(r.items||[]).length-17} exercice(s) non affiché(s)`,M,y+34,17,"400","#98a2b3");

  text("Notes générales",M,1608,18,"700","#475467");
  wrap(r.notes||"Aucune note.",M,1640,W-2*M,18,"400","#344054",24,3);
  text("Synthèse générée avec Exposition",W-M,H-38,15,"400","#98a2b3","right");

  return imagesToPdf([c.toDataURL("image/jpeg",0.94)],W,H);
}

function openPdfBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const win=window.open(url,"_blank");
  if(!win){
    const a=document.createElement("a");
    a.href=url;a.download=filename;a.click();
  }
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}



function savePsychologistName(){
  localStorage.setItem("expositionPsychologistName",psychologistName.value.trim());
  toast("Nom du psychologue enregistré.");
}
function loadPsychologistName(){psychologistName.value=localStorage.getItem("expositionPsychologistName")||"";}
function formattedEditionDate(){return new Intl.DateTimeFormat("fr-FR",{dateStyle:"long",timeStyle:"short"}).format(new Date());}

function getPsychologistName(){return localStorage.getItem("expositionPsychologistName")||"";}

async function showPatientSummary(patientId){
  const p=await rq(st("patients").get(patientId)); if(!p)return;
  const sessions=(await all("sessions")).filter(x=>x.patientId===patientId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const optex=(await all("optex")).filter(x=>x.patientId===patientId).sort((a,b)=>new Date(b.createdAt||b.updatedAt)-new Date(a.createdAt||a.updatedAt));
  const hierarchies=(await all("hierarchies")).filter(x=>x.patientId===patientId).sort((a,b)=>new Date(b.createdAt||b.updatedAt)-new Date(a.createdAt||a.updatedAt));
  const scripts=(await all("scripts")).filter(x=>x.patientId===patientId).sort((a,b)=>new Date(b.createdAt||b.updatedAt)-new Date(a.createdAt||a.updatedAt));

  patientSummaryTitle.textContent=p.code;
  patientSummaryContent.innerHTML=`
    <div class="patient-summary-section">
      <h4>Profil</h4>
      <p><strong>Date de création :</strong> ${p.createdAt?fmtDate(p.createdAt):"Non renseignée"}</p>
      <p><strong>Problématique :</strong> ${esc(p.notes||"Non renseignée")}</p>
    </div>
    <div class="patient-summary-section"><h4>Expositions (${sessions.length})</h4>
      ${sessions.length?sessions.map(x=>`<button class="patient-summary-link" data-kind="session" data-id="${x.id}"><span>${esc(x.title)}</span><small>${fmtDate(x.date)}</small></button>`).join(""):"<p>Aucune exposition.</p>"}
    </div>
    <div class="patient-summary-section"><h4>OptEx Nexus (${optex.length})</h4>
      ${optex.length?optex.map(x=>`<button class="patient-summary-link" data-kind="optex" data-id="${x.id}"><span>${esc(x.title||"OptEx Nexus")}</span><small>${fmtDate(x.createdAt||x.updatedAt)}</small></button>`).join(""):"<p>Aucun OptEx Nexus.</p>"}
    </div>
    <div class="patient-summary-section"><h4>Hiérarchies (${hierarchies.length})</h4>
      ${hierarchies.length?hierarchies.map(x=>`<button class="patient-summary-link" data-kind="hierarchy" data-id="${x.id}"><span>${esc(x.title)}</span><small>${fmtDate(x.createdAt||x.updatedAt)}</small></button>`).join(""):"<p>Aucune hiérarchie.</p>"}
    </div>
    <div class="patient-summary-section"><h4>Scripts et scénarios (${scripts.length})</h4>
      ${scripts.length?scripts.map(x=>`<button class="patient-summary-link" data-kind="script" data-id="${x.id}"><span>${esc(x.eventName)} — ${x.type==="catastrophe"?"Scénario catastrophe":"Souvenir traumatique"}</span><small>${fmtDate(x.createdAt||x.updatedAt)}</small></button>`).join(""):"<p>Aucun script.</p>"}
    </div>`;

  patientSummaryEmpty.classList.add("hidden");
  patientSummaryPanel.classList.remove("hidden");

  patientSummaryContent.querySelectorAll(".patient-summary-link").forEach(button=>{
    button.onclick=async()=>{
      const id=Number(button.dataset.id);
      const kind=button.dataset.kind;
      if(kind==="session"){selected=id;show("history");await renderDetail();}
      if(kind==="optex"){show("optex");await loadOptEx(id);}
      if(kind==="hierarchy"){show("hierarchy");await loadHierarchy(id);}
      if(kind==="script"){show("script");await loadScript(id);}
    };
  });
}

// ---------------------------------------------------------------------
// Rédaction de script traumatique
// ---------------------------------------------------------------------
function applyScriptType(){
  const trauma=scriptType.value==="trauma";
  traumaScriptFields.classList.toggle("hidden",!trauma);
  catastropheScriptFields.classList.toggle("hidden",trauma);
  traumaReminder.classList.toggle("hidden",!trauma);
  catastropheReminder.classList.toggle("hidden",trauma);
}

async function saveScript(e){
  e.preventDefault();
  const patientId=Number(document.getElementById("scriptPatient").value);
  if(!patientId){toast("Sélectionnez un patient.");return}

  const eventName=scriptEventName.value.trim();
  if(!eventName){toast("Saisissez un nom d’événement.");return}

  const id=Number(scriptId.value)||null;
  const type=scriptType.value;
  const record={patientId,type,eventName,
    before:type==="trauma"?scriptBefore.value.trim():"",
    beginning:type==="trauma"?scriptBeginning.value.trim():"",
    hotspot:type==="trauma"?scriptHotspot.value.trim():"",
    end:type==="trauma"?scriptEnd.value.trim():"",
    after:type==="trauma"?scriptAfter.value.trim():"",
    catastropheTrigger:type==="catastrophe"?catastropheTrigger.value.trim():"",
    catastropheBeginning:type==="catastrophe"?catastropheBeginning.value.trim():"",
    catastropheWorst:type==="catastrophe"?catastropheWorst.value.trim():"",
    catastropheConsequences:type==="catastrophe"?catastropheConsequences.value.trim():"",
    catastropheEnding:type==="catastrophe"?catastropheEnding.value.trim():"",
    updatedAt:new Date().toISOString()};

  if(id){
    record.id=id;
    const old=await rq(st("scripts").get(id));
    record.createdAt=old?.createdAt||record.updatedAt;
    await put("scripts",record);
  }else{
    record.createdAt=record.updatedAt;
    record.id=await add("scripts",record);
    scriptId.value=record.id;
  }

  deleteScriptBtn.classList.remove("hidden");
  await renderScriptList();
  toast("Script enregistré.");
}

function clearScriptForm(){
  scriptForm.reset();
  scriptId.value="";
  scriptType.value="trauma";
  applyScriptType();
  deleteScriptBtn.classList.add("hidden");
  scrollTo(0,0);
}

async function renderScriptList(){
  const filter=Number(document.getElementById("scriptPatientFilter")?.value)||0;
  const records=(await all("scripts"))
    .filter(r=>!filter||r.patientId===filter)
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));

  const patients=await all("patients");
  const map=Object.fromEntries(patients.map(p=>[p.id,p]));

  scriptList.innerHTML=records.length?"":"<p class='muted'>Aucun script enregistré.</p>";

  for(const r of records){
    const wrap=document.createElement("div");
    wrap.className="module-list-item-wrap";

    const b=document.createElement("button");
    b.type="button";
    b.className="module-list-item";
    b.innerHTML=`<strong>${esc(r.eventName)}</strong><small>${esc(map[r.patientId]?.code||"")} · ${r.type==="catastrophe"?"Scénario catastrophe":"Souvenir traumatique"}</small>`;
    b.onclick=()=>loadScript(r.id);

    const del=document.createElement("button");
    del.type="button";
    del.className="module-delete-btn";
    del.title="Supprimer ce script";
    del.setAttribute("aria-label","Supprimer ce script");
    del.onclick=async event=>{
      event.stopPropagation();
      if(!confirm("Supprimer définitivement ce script ?"))return;
      await rq(st("scripts","readwrite").delete(r.id));
      if(Number(scriptId.value)===r.id)clearScriptForm();
      await renderScriptList();
      toast("Script supprimé.");
    };

    wrap.appendChild(b);
    wrap.appendChild(del);
    scriptList.appendChild(wrap);
  }
}

async function loadScript(id){
  const r=await rq(st("scripts").get(id));
  if(!r)return;

  scriptId.value=r.id;
  scriptPatient.value=r.patientId;
  scriptPatient.dispatchEvent(new Event("change",{bubbles:true}));
  scriptType.value=r.type||"trauma";
  applyScriptType();
  scriptEventName.value=r.eventName||"";
  scriptBefore.value=r.before||"";
  scriptBeginning.value=r.beginning||"";
  scriptHotspot.value=r.hotspot||"";
  scriptEnd.value=r.end||"";
  scriptAfter.value=r.after||"";
  catastropheTrigger.value=r.catastropheTrigger||"";
  catastropheBeginning.value=r.catastropheBeginning||"";
  catastropheWorst.value=r.catastropheWorst||"";
  catastropheConsequences.value=r.catastropheConsequences||"";
  catastropheEnding.value=r.catastropheEnding||"";
  deleteScriptBtn.classList.remove("hidden");
  scrollTo(0,0);
}

async function deleteScript(){
  const id=Number(scriptId.value);
  if(!id)return;
  if(!confirm("Supprimer définitivement ce script ?"))return;
  await rq(st("scripts","readwrite").delete(id));
  clearScriptForm();
  await renderScriptList();
  toast("Script supprimé.");
}

async function exportScriptPdf(){
  const id=Number(scriptId.value);
  if(!id){toast("Enregistrez d’abord le script.");return}

  const r=await rq(st("scripts").get(id));
  const p=await rq(st("patients").get(r.patientId));
  const blob=createScriptPdf(r,p);
  openPdfBlob(blob,`${safeName(p.code)}_${safeName(r.eventName)}_${r.type==="catastrophe"?"scenario_catastrophe":"souvenir_traumatique"}.pdf`);
}

function createScriptPdf(r,p){
  const W=1240,H=1754,M=74;
  const pages=[];
  let c,x,y;

  const catastrophe=r.type==="catastrophe";
  const sections=catastrophe
    ? [
        ["Déclencheur et contexte initial",r.catastropheTrigger],
        ["Début de la catastrophe",r.catastropheBeginning],
        ["Le pire moment",r.catastropheWorst],
        ["Conséquences durables",r.catastropheConsequences],
        ["Fin du scénario",r.catastropheEnding]
      ]
    : [
        ["Avant l’événement — en sécurité",r.before],
        ["Début de l’événement",r.beginning],
        ["Hot spot",r.hotspot],
        ["Fin de l’événement",r.end],
        ["Une fois l’événement terminé — de nouveau en sécurité",r.after]
      ];

  function text(t,xx,yy,size=22,weight="400",color="#172033",align="left"){
    x.fillStyle=color;
    x.font=`${weight} ${size}px Arial`;
    x.textAlign=align;
    x.textBaseline="alphabetic";
    x.fillText(String(t??""),xx,yy);
  }

  function wrapLines(t,maxW,size=20,weight="400"){
    x.font=`${weight} ${size}px Arial`;
    const words=String(t??"").split(/\s+/).filter(Boolean);
    const lines=[];
    let line="";

    for(const word of words){
      const test=line?`${line} ${word}`:word;
      if(x.measureText(test).width>maxW&&line){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    }
    if(line)lines.push(line);
    return lines.length?lines:["—"];
  }

  function addPage(showHeader=true){
    if(c)pages.push(c.toDataURL("image/jpeg",0.94));

    c=document.createElement("canvas");
    c.width=W;
    c.height=H;
    x=c.getContext("2d");
    x.fillStyle="#fff";
    x.fillRect(0,0,W,H);

    y=M;

    if(showHeader){
      text(catastrophe?"Scénario catastrophe":"Script traumatique",M,92,44,"700","#101828");
      text(`${p.code}  •  ${r.eventName}`,M,132,22,"400","#667085");

      if(getPsychologistName()){
        text(`Professionnel : ${getPsychologistName()}`,W-M,132,18,"400","#667085","right");
      }
      if(typeof formattedEditionDate==="function"){
        text(`Date d’édition : ${formattedEditionDate()}`,W-M,156,15,"400","#98a2b3","right");
      }

      x.strokeStyle="#d0d5dd";
      x.beginPath();
      x.moveTo(M,178);
      x.lineTo(W-M,178);
      x.stroke();

      y=220;
    }else{
      text(catastrophe?"Scénario catastrophe — suite":"Script traumatique — suite",M,74,24,"700","#101828");
      text(`${p.code}  •  ${r.eventName}`,M,106,17,"400","#667085");
      x.strokeStyle="#e4e7ec";
      x.beginPath();
      x.moveTo(M,130);
      x.lineTo(W-M,130);
      x.stroke();
      y=170;
    }
  }

  function ensureSpace(required){
    if(y+required>H-90){
      addPage(false);
    }
  }

  function drawSection(title,content){
    const lines=wrapLines(content,W-2*M,19,"400");
    const lineH=27;

    ensureSpace(62);

    text(title,M,y,21,"700","#101828");
    y+=34;

    for(const line of lines){
      ensureSpace(lineH+8);
      x.fillStyle="#344054";
      x.font="400 19px Arial";
      x.textAlign="left";
      x.fillText(line,M,y);
      y+=lineH;
    }

    y+=30;
  }

  addPage(true);

  for(const [title,content] of sections){
    drawSection(title,content||"—");
  }

  text("Synthèse générée avec Exposition",W-M,H-38,15,"400","#98a2b3","right");
  pages.push(c.toDataURL("image/jpeg",0.94));

  return imagesToPdf(pages,W,H);
}
