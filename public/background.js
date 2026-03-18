// ============================================================
//  EQ of AI — background.js
// ============================================================
importScripts("config.js");

let isRefreshing = false;
let refreshQueue = [];
const actionHistory = [];
const MAX_HISTORY = 50;

chrome.runtime.onInstalled.addListener(()=>validateSession());
chrome.runtime.onStartup.addListener(()=>validateSession());

async function validateSession() {
  try {
    const res = await fetch(ENDPOINTS.validate,{method:"GET",credentials:"include"});
    if (res.ok) return;
    // Only clear storage if definitively unauthorized — not on network error
    if (res.status===401) {
      const stored = await new Promise(r=>chrome.storage.local.get(["user_email"],r));
      if (stored.user_email) {
        // Try refresh before giving up
        const rr = await fetch(ENDPOINTS.refresh,{method:"POST",credentials:"include"});
        if (!rr.ok) {
          chrome.storage.local.remove(["user_email","user_name"]);
          chrome.runtime.sendMessage({type:"AUTH_EXPIRED"}).catch(()=>{});
        }
      }
    }
  } catch(e){ console.warn("[EQ] offline:",e.message); }
}

async function authFetch(url,opts={}) {
  const o={...opts,credentials:"include"};
  let res=await fetch(url,o);
  if(res.status!==401) return res;
  if(isRefreshing) return new Promise((resolve,reject)=>refreshQueue.push({url,o,resolve,reject}));
  isRefreshing=true;
  try {
    const rr=await fetch(ENDPOINTS.refresh,{method:"POST",credentials:"include"});
    if(!rr.ok) throw new Error("refresh:"+rr.status);
    res=await fetch(url,o);
    refreshQueue.forEach(({url:u,o:op,resolve,reject})=>fetch(u,op).then(resolve).catch(reject));
  } catch(err) {
    refreshQueue.forEach(({reject})=>reject(err));
    chrome.storage.local.remove(["user_email","user_name"]);
    chrome.runtime.sendMessage({type:"AUTH_EXPIRED"}).catch(()=>{});
  } finally { isRefreshing=false; refreshQueue=[]; }
  return res;
}

async function fetchWithRetry(url,opts,tries=2,delay=800) {
  for(let i=0;i<=tries;i++) {
    try { return await authFetch(url,opts); }
    catch(err){ if(i===tries) throw err; await new Promise(r=>setTimeout(r,delay*(i+1))); }
  }
}

function getBrowser() {
  const ua=navigator.userAgent;
  return {
    name: ua.includes("Edg")?"Edge":ua.includes("Chrome")?"Chrome"
         :ua.includes("Firefox")?"Firefox"
         :(ua.includes("Safari")&&!ua.includes("Chrome"))?"Safari":"Unknown",
    platform: navigator.platform,
    version: (ua.match(/(?:Chrome|Edg|Firefox|Safari)\/([0-9.]+)/)||[])[1]||"?"
  };
}

function getToday(){ return new Date().toLocaleDateString("en-CA"); }

async function getDisabledCategories() {
  return new Promise(resolve=>{
    chrome.storage.sync.get(["personal","financial","medical"],r=>{
      const d=[];
      if(r.personal===false)  d.push("personal");
      if(r.financial===false) d.push("financial");
      if(r.medical===false)   d.push("medical");
      resolve(d);
    });
  });
}

async function getExposureData() {
  const defaults=[
    {label:"Financial",percentage:0},{label:"Personal",percentage:0},
    {label:"Medical",percentage:0},{label:"Organizational",percentage:0},
  ];
  return new Promise(resolve=>{
    chrome.storage.local.get(["exposureData","exposureDate"],r=>{
      const today=getToday();
      if(r.exposureDate&&r.exposureDate!==today) return resolve(defaults);
      if(!r.exposureData) return resolve(defaults);
      try{ resolve(JSON.parse(r.exposureData)); } catch{ resolve(defaults); }
    });
  });
}

function updateExposure(action,category,score) {
  chrome.storage.local.get(["exposureData","exposureDate"],r=>{
    const today=getToday();
    let data=[
      {label:"Financial",percentage:0},{label:"Personal",percentage:0},
      {label:"Medical",percentage:0},{label:"Organizational",percentage:0},
    ];
    if(r.exposureDate===today&&r.exposureData){try{data=JSON.parse(r.exposureData);}catch{}}
    const delta=Math.min(10,Math.max(1,Math.floor((score||5)/1.5)));
    const cat=(category||"").toLowerCase();
    data=data.map(item=>{
      if(item.label.toLowerCase()===cat){
        const pct=action==="ignored"
          ?Math.min(100,item.percentage+delta)
          :Math.max(0,item.percentage-Math.floor(delta/2));
        return{...item,percentage:pct};
      }
      return item;
    });
    chrome.storage.local.set(
      {exposureData:JSON.stringify(data),exposureDate:today},
      ()=>chrome.runtime.sendMessage({type:"exposureUpdate",data}).catch(()=>{})
    );
  });
}

function updateRiskCounts(detections) {
  const today=getToday();
  chrome.storage.local.get(["riskCounts","riskDate","riskTracked"],r=>{
    const isToday=r.riskDate===today;
    let counts =isToday&&r.riskCounts  ?r.riskCounts  :{high:0,medium:0,low:0};
    let tracked=isToday&&r.riskTracked ?r.riskTracked :[];
    let changed=false;
    detections.forEach(d=>{
      const key=`${(d.type||"?").toLowerCase()}:${(d.value||"").substring(0,40)}`;
      if(tracked.includes(key)) return;
      tracked.push(key); changed=true;
      const lv=(d.risk_level||"medium").toLowerCase();
      if(lv==="high") counts.high++;
      else if(lv==="low") counts.low++;
      else counts.medium++;
    });
    if(!changed) return;
    chrome.storage.local.set(
      {riskCounts:counts,riskDate:today,riskTracked:tracked},
      ()=>chrome.runtime.sendMessage({type:"riskCountsUpdate",data:counts}).catch(()=>{})
    );
  });
}

const TYPES=["Financial","Personal","Medical","Organizational","Network","Travel","Technical"];

function saveDailyScore(data_type,score,action) {
  if(!TYPES.includes(data_type)) return;
  const today=getToday();
  chrome.storage.local.get("dailyScores",r=>{
    const all=r.dailyScores||{};
    if(!all[today]) all[today]=Object.fromEntries(TYPES.map(t=>[t,[]]));
    if(!Array.isArray(all[today][data_type])) all[today][data_type]=[];
    all[today][data_type].push({score:parseInt(score)||5,action,ts:Date.now()});
    const keys=Object.keys(all).sort().slice(-30);
    chrome.storage.local.set({dailyScores:Object.fromEntries(keys.map(k=>[k,all[k]]))});
  });
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{

    if(msg.type==="BLUR_EVENT") {
      const{websiteDomain,input:userInput,hintCategories}=msg.payload;
      const[disabled_categories,exposureData]=await Promise.all([
        getDisabledCategories(),getExposureData()
      ]);
      try {
        const res=await fetchWithRetry(ENDPOINTS.aiValidate,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            input:userInput,websiteDomain,exposureData,
            disabled_categories,hintCategories:hintCategories||[],
            browserDetails:getBrowser(),
          }),
        });
        if(!res?.ok){console.warn("[EQ] aiValidate:",res?.status);return;}
        const{tracking_id,data}=await res.json();
        if(!Array.isArray(data)||!data.length) return;
        updateRiskCounts(data);
        if(websiteDomain) chrome.storage.local.set({websiteDomain});
        chrome.tabs.query({active:true,currentWindow:true},tabs=>{
          if(!tabs?.length) return;
          chrome.tabs.sendMessage(tabs[0].id,{type:"SHOW_ALERT",sensitiveData:data,tracking_id}).catch(()=>{});
        });
      } catch(err){console.error("[EQ] BLUR_EVENT:",err);}
    }

    if(msg.type==="USER_ACTION") {
      const{action,metadata,tracking_id}=msg;
      const rawType=metadata.data_type||"";
      const data_type=rawType.charAt(0).toUpperCase()+rawType.slice(1).toLowerCase();
      updateExposure(action,data_type,parseInt(metadata.score)||5);
      saveDailyScore(data_type,metadata.score,action);
      actionHistory.unshift({action,data_type,score:metadata.score,value:metadata.value,ts:Date.now()});
      if(actionHistory.length>MAX_HISTORY) actionHistory.pop();
      fetchWithRetry(ENDPOINTS.aiAction,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({tracking_id,action,metadata,domain:sender?.url}),
      }).catch(err=>console.error("[EQ] action:",err));
    }

    if(msg.type==="WEEKLY_FEEDBACK") {
      const{msg:message,rating,tracking_id}=msg;
      chrome.storage.local.get("user_email",r=>{
        fetchWithRetry(ENDPOINTS.feedback,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({user_email:r.user_email||"",message,rating:parseInt(rating),tracking_id}),
        }).catch(err=>console.error("[EQ] feedback:",err));
      });
    }

    if(msg.type==="GET_STATS") sendResponse({history:actionHistory.slice(0,20)});

  })();
  return true;
});