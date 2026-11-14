/* bff calendar ♡ — free version (Supabase) */
const CFG = window.BFF_CONFIG;
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

/* ---------- constants ---------- */
const PALETTE=['#FF8FAB','#6FD3BA','#8FB0FF','#FFB547','#B9A4EC','#FF9874','#5CC8E0','#A8D564'];
const EMOJIS=['🐰','🐻','🐱','🐶','🦊','🐼','🐸','🐥','🦄','🐨','🐹','🐧'];
const POPULAR=['Asia/Manila','Asia/Dubai','Asia/Riyadh','Asia/Qatar','Asia/Kuwait','Asia/Hong_Kong','Asia/Singapore','Asia/Taipei','Asia/Tokyo','Asia/Seoul','Australia/Sydney','Pacific/Auckland','Europe/London','Europe/Rome','America/New_York','America/Chicago','America/Los_Angeles','America/Toronto','America/Vancouver','Pacific/Honolulu'];
const Q=15*60000, DAY=864e5;
const deviceTz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Manila'}catch(e){return 'Asia/Manila'}})();
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};

const urlCode=(new URLSearchParams(location.search).get('c')||'').trim().toUpperCase().slice(0,12)||null;
if(urlCode)ls.set('bff.pendingCode',urlCode);

const S={stage:'loading',uid:null,isAnon:true,email:null,myProfile:null,circles:[],circleId:null,
  people:[],me:null,note:'',busy:false,
  tab:'friends',dayIdx:0,dtz:deviceTz,dtzSet:false,unsel:new Set(),dur:60,welcomeMode:null};

/* ---------- time zone helpers ---------- */
const fmtCache={};
function validTz(tz){try{new Intl.DateTimeFormat('en-US',{timeZone:tz});return true}catch(e){return false}}
function parts(ms,tz){
  const f=fmtCache[tz]||(fmtCache[tz]=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}));
  const o={};for(const p of f.formatToParts(new Date(ms)))o[p.type]=p.value;
  return {y:+o.year,m:+o.month,d:+o.day,h:(+o.hour)%24,mi:+o.minute};
}
function offset(ms,tz){const p=parts(ms,tz);return Date.UTC(p.y,p.m-1,p.d,p.h,p.mi)-Math.floor(ms/60000)*60000}
function zoned(y,m,d,h,mi,tz){const g=Date.UTC(y,m-1,d,h,mi);let t=g-offset(g,tz);t=g-offset(t,tz);return t}
function fmtT(ms,tz){const p=parts(ms,tz);const h=p.h%12||12,ap=p.h<12?'am':'pm';return p.mi?`${h}:${String(p.mi).padStart(2,'0')}${ap}`:`${h}${ap}`}
function fmtD(ms,tz){return new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',month:'short',day:'numeric'}).format(ms)}
function city(tz){return String(tz||'').split('/').pop().replace(/_/g,' ')}
function offStr(tz){const o=Math.round(offset(Date.now(),tz)/60000),a=Math.abs(o);return 'GMT'+(o<0?'−':'+')+Math.floor(a/60)+(a%60?':'+String(a%60).padStart(2,'0'):'')}
function hourLbl(h){return (h%12||12)+(h<12?'am':'pm')}

/* ---------- status logic ---------- */
function asleep(p,t){const [a,b]=p.sleep;if(a===b)return false;const q=parts(t,p.tz),h=q.h+q.mi/60;return a<b?(h>=a&&h<b):(h>=a||h<b)}
function statusAt(p,t){
  let free=false;
  for(const b of p.blocks){if(t>=b.s&&t<b.e){if(b.k==='busy')return 'busy';free=true}}
  if(free)return 'free';
  return asleep(p,t)?'sleep':'open';
}
function curBlock(p,t,k){return p.blocks.find(b=>b.k===k&&t>=b.s&&t<b.e)}

/* ---------- misc helpers ---------- */
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sorted(){return [...S.people].sort((a,b)=>(b.id===S.uid)-(a.id===S.uid)||a.nick.localeCompare(b.nick))}
function circle(){return S.circles.find(c=>c.id===S.circleId)||null}
function inviteLink(c){return `${location.origin}${location.pathname}?c=${encodeURIComponent(c.invite_code)}`}
function errMsg(e){return (e&&(e.message||e.error_description))||'Something went wrong'}
let tt;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),3800)}
function avatar(p,sm){return `<div class="av${sm?' sm':''}" style="background:${p.color}2E;border-color:${p.color}">${esc(p.emoji)}</div>`}
function tzList(){let all=[];try{all=Intl.supportedValuesOf('timeZone')}catch(e){}if(!all.length)all=POPULAR;return all}
function tzOptions(sel){
  const pop=POPULAR.filter(validTz);
  const o=z=>`<option value="${esc(z)}"${z===sel?' selected':''}>${esc(city(z))} (${offStr(z)})</option>`;
  const rest=tzList().filter(z=>!pop.includes(z));
  const extra=(!pop.includes(sel)&&!rest.includes(sel)&&validTz(sel))?o(sel):'';
  return `<optgroup label="Popular">${pop.map(o).join('')}</optgroup>${extra}<optgroup label="All time zones">${rest.map(o).join('')}</optgroup>`;
}
function hourOptions(sel){return [...Array(24)].map((_,h)=>`<option value="${h}"${h===sel?' selected':''}>${hourLbl(h)}</option>`).join('')}
function copyText(txt,okMsg){
  const fallback=()=>{const w=document.getElementById('copywrap');w.innerHTML=`<div class="card form" style="margin-top:14px"><b>Copy this 💌</b><textarea class="copybox" readonly>${esc(txt)}</textarea></div>`;w.scrollIntoView({behavior:'smooth'})};
  try{navigator.clipboard.writeText(txt).then(()=>toast(okMsg),fallback)}catch(err){fallback()}
}

/* ---------- data layer ---------- */
function toPerson(pr,blocks){
  return {id:pr.id,nick:pr.nick,emoji:pr.emoji,color:/^#[0-9a-fA-F]{6}$/.test(pr.color)?pr.color:PALETTE[0],
    tz:validTz(pr.tz)?pr.tz:'UTC',sleep:[pr.sleep_start,pr.sleep_end],status:pr.status||'',
    blocks:blocks.filter(b=>b.user_id===pr.id).map(b=>({id:b.id,s:Date.parse(b.starts_at),e:Date.parse(b.ends_at),k:b.kind,label:b.label||'',src:b.src||''}))};
}
async function onSession(session){
  if(!session){S.uid=null;S.stage='welcome';render(true);return}
  S.uid=session.user.id;S.isAnon=!!session.user.is_anonymous;S.email=session.user.email||null;
  await loadMine();
}
async function loadMine(){
  const [pr,mem]=await Promise.all([
    sb.from('profiles').select('*').eq('id',S.uid).maybeSingle(),
    sb.from('circle_members').select('role, circles(id,name,invite_code,created_by)').eq('user_id',S.uid)
  ]);
  if(pr.error||mem.error){S.note="Couldn't reach the calendar — check your connection 🥲";S.stage='app';render(true);return}
  S.myProfile=pr.data;
  S.circles=(mem.data||[]).filter(m=>m.circles).map(m=>({...m.circles,role:m.role}));
  if(!S.myProfile){S.stage='profile';render(true);return}
  const pending=ls.get('bff.pendingCode');
  if(pending){
    const have=S.circles.find(c=>c.invite_code===pending);
    if(have){S.circleId=have.id;ls.set('bff.pendingCode',null)}
    else{
      const {data,error}=await sb.rpc('join_circle',{p_code:pending});
      ls.set('bff.pendingCode',null);
      if(error)toast(errMsg(error));
      else{S.circles.push({...data,role:'member'});S.circleId=data.id;toast(`You joined “${data.name}” 💖`)}
    }
    if(urlCode)history.replaceState(null,'',location.pathname);
  }
  if(!S.circles.length){S.stage='circle';render(true);return}
  if(!S.circleId){const saved=ls.get('bff.circle');S.circleId=S.circles.some(c=>c.id===saved)?saved:S.circles[0].id}
  S.stage='app';
  await loadCircle();
  subscribe();
  cleanupOld();
}
let loading=false,again=false;
async function loadCircle(){
  if(loading){again=true;return}
  loading=true;
  try{
    ls.set('bff.circle',S.circleId);
    const mem=await sb.from('circle_members').select('user_id').eq('circle_id',S.circleId);
    if(mem.error)throw mem.error;
    const ids=(mem.data||[]).map(m=>m.user_id);
    if(!ids.includes(S.uid))ids.push(S.uid);
    const since=new Date(Date.now()-2*DAY).toISOString();
    const [pr,bl]=await Promise.all([
      sb.from('profiles').select('*').in('id',ids),
      sb.from('blocks').select('id,user_id,starts_at,ends_at,kind,label,src').in('user_id',ids).gt('ends_at',since).order('starts_at').limit(1000)
    ]);
    if(pr.error)throw pr.error;if(bl.error)throw bl.error;
    S.people=(pr.data||[]).map(p=>toPerson(p,bl.data||[]));
    S.me=S.people.find(p=>p.id===S.uid)||null;
    S.note='';
  }catch(e){S.note="Couldn't load the latest — will retry soon 🥲"}
  loading=false;
  render();
  if(again){again=false;loadCircle()}
}
let chan=null,reloadT=null;
function subscribe(){
  if(chan)return;
  const kick=()=>{clearTimeout(reloadT);reloadT=setTimeout(loadCircle,600)};
  chan=sb.channel('bff-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'blocks'},kick)
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},kick)
    .on('postgres_changes',{event:'*',schema:'public',table:'circle_members'},kick)
    .subscribe();
}
function cleanupOld(){sb.from('blocks').delete().eq('user_id',S.uid).lt('ends_at',new Date(Date.now()-7*DAY).toISOString()).then(()=>{})}
setInterval(()=>{if(S.stage==='app'&&!document.hidden)loadCircle()},120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.stage==='app')loadCircle()});

async function addBlocks(rows){
  const {error}=await sb.from('blocks').insert(rows.map(r=>({user_id:S.uid,starts_at:new Date(r.s).toISOString(),ends_at:new Date(r.e).toISOString(),kind:r.k,label:r.label||'',src:r.src||''})));
  if(error){toast(errMsg(error));return false}
  await loadCircle();return true;
}

/* ---------- render ---------- */
function render(force){
  document.querySelector('nav.tabs').style.display=S.stage==='app'?'':'none';
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));
  if(S.me&&!S.dtzSet){S.dtz=S.me.tz;S.dtzSet=true}
  document.getElementById('circlebar').innerHTML=S.stage==='app'&&circle()?circleBar():'';
  const v=document.getElementById('view');
  if(S.stage==='app'&&S.tab==='me'&&!force&&document.getElementById('meroot')){
    const mb=document.getElementById('myblocks');if(mb)mb.innerHTML=myBlocks();return;
  }
  if(S.stage==='loading')v.innerHTML=`<div class="card empty">Loading… 💫</div>`;
  else if(S.stage==='welcome')v.innerHTML=vWelcome();
  else if(S.stage==='profile')v.innerHTML=`<div id="meroot">`+profileForm(true)+`</div>`;
  else if(S.stage==='circle')v.innerHTML=vCircleSetup();
  else v.innerHTML=S.tab==='friends'?vFriends():S.tab==='find'?vFind():vMe();
}
function circleBar(){
  const c=circle();
  const sel=S.circles.length>1?`<select class="tzsel" data-ch="circle">${S.circles.map(x=>`<option value="${x.id}"${x.id===c.id?' selected':''}>💞 ${esc(x.name)}</option>`).join('')}</select>`:`<span class="cname">💞 ${esc(c.name)}</span>`;
  return `<div class="cbar">${sel}<button class="btn soft" data-act="invite">+ Invite friends</button></div>`;
}

/* --- welcome / onboarding --- */
function vWelcome(){
  const code=ls.get('bff.pendingCode');
  let h=`<div class="card form welcome">
    <div class="big">👯‍♀️</div>
    <h3>See when your besties are free</h3>
    <p>Share when you're busy, find the best time for calls — even across time zones 🌏</p>`;
  if(code){
    h+=`<div class="note" style="text-align:center">💌 You've been invited to a circle!<br><b>Code: ${esc(code)}</b></div>
      <button class="btn full" data-act="start">Join my friends ♡</button>`;
  }else if(S.welcomeMode==='code'){
    h+=`<form id="codeform"><label class="l">Invite code</label><input type="text" name="code" maxlength="12" placeholder="e.g. K7XBQ2" autocapitalize="characters" required>
      <div style="margin-top:12px"><button class="btn full">Join ♡</button></div></form>
      <p class="hint" style="text-align:center"><a href="#" data-act="wmode" data-m="">← back</a></p>`;
  }else{
    h+=`<button class="btn full" data-act="start">✨ Start a circle</button>
      <div style="height:10px"></div>
      <button class="btn soft full" data-act="wmode" data-m="code">I have an invite code</button>`;
  }
  h+=`</div>`;
  if(S.welcomeMode==='email'){
    h+=`<form class="card form" id="emailform" style="margin-top:14px"><label class="l">Your email</label><input type="text" inputmode="email" name="email" placeholder="you@email.com" required>
      <div style="margin-top:12px"><button class="btn mint full">Email me a sign-in link</button></div>
      <p class="hint">Only works if you added your email to your account before.</p></form>`;
  }else{
    h+=`<p class="hint" style="text-align:center;margin-top:16px">Used it before on another phone? <a href="#" data-act="wmode" data-m="email">Sign in with email</a></p>`;
  }
  h+=`<p class="hint" style="text-align:center;margin-top:10px;font-size:12px">By continuing you agree to our <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</p>`;
  return h;
}
function vCircleSetup(){
  return `<h2>Make your circle 💞</h2>
  <form class="card form" id="newcircle"><label class="l">Circle name</label><input type="text" name="name" maxlength="40" placeholder="e.g. Ate's besties, College gang" required>
  <div style="margin-top:14px"><button class="btn full">Create circle</button></div>
  <p class="hint">You'll get an invite link to send in the group chat.</p></form>
  <h2>…or join one</h2>
  <form class="card form" id="codeform"><label class="l">Invite code</label><input type="text" name="code" maxlength="12" placeholder="e.g. K7XBQ2" autocapitalize="characters" required>
  <div style="margin-top:12px"><button class="btn soft full">Join ♡</button></div></form>`;
}

/* --- friends --- */
function banners(){return S.note?`<div class="note">${esc(S.note)}</div>`:''}
function vFriends(){
  const now=Date.now();let h=banners();
  const ppl=sorted();
  if(ppl.length<=1&&circle())h+=`<button class="join card" data-act="invite"><b>💌 Invite your friends</b><span>Send the link to the group chat — they're in with one tap</span></button>`;
  h+=`<h2>Right now</h2><div class="now-list">`+(ppl.length?ppl.map(p=>nowCard(p,now)).join(''):`<div class="card empty">Loading your besties… 💫</div>`)+`</div>`;
  if(ppl.length){
    h+=`<div class="row-between"><h2>Schedule</h2>${tzSelect()}</div>`+dayStrip()+legend()+`<div class="card tl">${timeline()}</div>`;
    h+=`<p class="hint" style="text-align:center">Tap a colored block for details 👆</p>`;
  }
  return h;
}
function nowCard(p,now){
  const st=statusAt(p,now);let pill;
  if(st==='busy'){const b=curBlock(p,now,'busy');pill=`<span class="pill busy">🙅 busy${b?' till '+fmtT(b.e,p.tz):''}</span>`}
  else if(st==='free')pill=`<span class="pill free">📞 free to talk!</span>`;
  else if(st==='sleep')pill=`<span class="pill sleep">😴 sleeping</span>`;
  else pill=`<span class="pill open">✨ probably free</span>`;
  return `<div class="now card">${avatar(p)}<div class="nw"><div class="nn"><b>${esc(p.nick)}</b>${p.id===S.uid?'<span class="you">you</span>':''}</div><div class="nt">🕐 ${fmtT(now,p.tz)} in ${esc(city(p.tz))}</div>${p.status?`<div class="ns">“${esc(p.status)}”</div>`:''}</div>${pill}</div>`;
}
function tzSelect(){
  const zs=[...new Set([S.me?S.me.tz:deviceTz,...sorted().map(p=>p.tz),S.dtz])];
  return `<select class="tzsel" data-ch="dtz" aria-label="Show times in">${zs.map(z=>`<option value="${esc(z)}"${z===S.dtz?' selected':''}>🌏 ${esc(city(z))} time</option>`).join('')}</select>`;
}
function dayList(){const p=parts(Date.now(),S.dtz);return [...Array(7)].map((_,i)=>{const d=new Date(Date.UTC(p.y,p.m-1,p.d+i));return {y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate(),wd:i===0?'Today':['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]}})}
function dayStrip(){return `<div class="days">${dayList().map((d,i)=>`<button class="day${i===S.dayIdx?' on':''}" data-act="day" data-i="${i}"><small>${d.wd}</small><b>${d.d}</b></button>`).join('')}</div>`}
function legend(){return `<div class="legend"><span><i style="background:var(--mint)"></i>free to talk</span><span><i style="background:var(--pink)"></i>busy</span><span><i style="background:#E6DDFA"></i>sleeping</span><span><i style="background:var(--butterS);border:1px solid #F4D27A"></i>probably free</span></div>`}
function dayBounds(i){const d=dayList()[i],tz=S.dtz;const s=zoned(d.y,d.m,d.d,0,0,tz);const n=new Date(Date.UTC(d.y,d.m-1,d.d+1));const e=zoned(n.getUTCFullYear(),n.getUTCMonth()+1,n.getUTCDate(),0,0,tz);return [s,e,d]}
function segments(p,s,e,fn){
  const N=Math.round((e-s)/Q),out=[];let cur=null,a=0;
  for(let i=0;i<=N;i++){const st=i<N?fn(p,s+i*Q):null;if(st!==cur){if(cur!==null)out.push([a,i,cur]);cur=st;a=i}}
  return {N,out};
}
function axis(s,e,d,tz){
  const pos=t=>((t-s)/(e-s)*100).toFixed(3)+'%';
  let h=`<div class="axis">`;
  for(let hr=0;hr<=24;hr+=6){const l=hr===0?'4%':hr===24?'96%':pos(zoned(d.y,d.m,d.d,hr,0,tz));h+=`<span style="left:${l}">${hr===24?'12am':hourLbl(hr)}</span>`}
  return h+`</div>`;
}
function timeline(){
  const [s,e,d]=dayBounds(S.dayIdx),tz=S.dtz,now=Date.now();
  const pos=t=>((t-s)/(e-s)*100).toFixed(3)+'%';
  let h=axis(s,e,d,tz);
  const grid=[3,6,9,12,15,18,21].map(hr=>`<div class="grid" style="left:${pos(zoned(d.y,d.m,d.d,hr,0,tz))}"></div>`).join('');
  const nl=now>=s&&now<e?`<div class="nowline" style="left:${pos(now)}"></div>`:'';
  for(const p of sorted()){
    const {N,out}=segments(p,s,e,statusAt);
    const diff=Math.round((offset(now,p.tz)-offset(now,tz))/36e5*2)/2;
    const rel=p.tz===tz||diff===0?'same time':diff>0?`${diff}h ahead`:`${-diff}h behind`;
    h+=`<div class="tl-row"><div class="tl-name">${avatar(p,1)}<b>${esc(p.nick)}</b><small>· ${esc(city(p.tz))} · ${rel}</small></div><div class="bar">${grid}`+
      out.filter(x=>x[2]!=='open').map(([a,b,st])=>`<div class="seg s-${st}" style="left:${(a/N*100).toFixed(3)}%;width:${((b-a)/N*100).toFixed(3)}%" data-act="seg" data-p="${esc(p.id)}" data-s="${s+a*Q}" data-e="${s+b*Q}" data-st="${st}"></div>`).join('')+nl+`</div></div>`;
  }
  return h;
}

/* --- find a time --- */
function group(){return sorted().filter(p=>!S.unsel.has(p.id))}
function vFind(){
  let h=banners();const ppl=sorted();
  if(ppl.length<2)return h+`<div class="card empty">Once friends join, I'll find times that work for everyone 💞<br><br><button class="btn soft" data-act="invite">+ Invite friends</button></div>`;
  h+=`<h2>Who's in?</h2><div class="chips">${ppl.map(p=>`<button class="chip${S.unsel.has(p.id)?' off':''}" data-act="who" data-p="${esc(p.id)}">${avatar(p,1)}${esc(p.nick)}</button>`).join('')}</div>`;
  h+=`<h2>How long?</h2><div class="seg-ctl">${[[30,'30 min'],[60,'1 hr'],[120,'2 hrs'],[180,'3 hrs']].map(([m,l])=>`<button data-act="dur" data-m="${m}" class="${S.dur===m?'on':''}">${l}</button>`).join('')}</div>`;
  const g=group();
  if(!g.length)return h+`<div class="card empty" style="margin-top:14px">Pick at least one friend ☝️</div>`;
  h+=`<div class="row-between"><h2>Awake overlap</h2>${tzSelect()}</div><div class="card ovl">${overlap(g)}</div>`;
  h+=`<h2>Best times this week ✨</h2>`+slots(g);
  return h;
}
function overlap(g){
  const [s,e,d]=dayBounds(0),tz=S.dtz;
  const fn=(_,t)=>g.every(p=>!asleep(p,t))?'free':'sleep';
  const {N,out}=segments(null,s,e,fn);
  let h=axis(s,e,d,tz)+`<div class="bar">`+out.map(([a,b,st])=>`<div class="seg s-${st==='free'?'free':'sleep'}" style="left:${(a/N*100).toFixed(3)}%;width:${((b-a)/N*100).toFixed(3)}%"></div>`).join('')+`</div>`;
  const wins=out.filter(x=>x[2]==='free').map(([a,b])=>`${fmtT(s+a*Q,tz)}–${fmtT(s+b*Q,tz)}`);
  h+=wins.length?`<p>🌞 Everyone's usually awake <b>${wins.join(', ')}</b> (${esc(city(tz))} time)</p>`:`<p>😅 No hour where everyone's awake — someone will need to stay up a little!</p>`;
  return h;
}
function findSlots(g,dur){
  const D=dur*60000,step=30*60000;let t=Math.ceil(Date.now()/step)*step;const end=t+7*DAY,res=[];
  for(;t+D<=end;t+=step){
    let ok=true,all=true,score=0;
    for(const p of g){
      let pf=false;
      for(let u=t;u<t+D;u+=Q){const st=statusAt(p,u);if(st==='busy'||st==='sleep'){ok=false;break}if(st==='free')pf=true}
      if(!ok)break;
      if(pf)score+=3;else all=false;
      const hh=parts(t,p.tz).h;score+=(hh>=9&&hh<22)?1:-1;
    }
    if(ok)res.push({t,score,all});
  }
  res.sort((a,b)=>b.score-a.score||a.t-b.t);
  const pick=[];for(const r of res){if(pick.every(x=>Math.abs(x.t-r.t)>=Math.max(D,3*36e5)))pick.push(r);if(pick.length>=6)break}
  return pick.sort((a,b)=>a.t-b.t);
}
function slots(g){
  const list=findSlots(g,S.dur),tz=S.dtz;
  if(!list.length)return `<div class="card empty">No time works for everyone this week 🥲<br>Try a shorter call or fewer people.</div>`;
  return list.map(r=>{
    const who=g.map(p=>`<span>${esc(p.emoji)} ${esc(p.nick)}</span><span>${parts(r.t,p.tz).d!==parts(r.t,tz).d?fmtD(r.t,p.tz)+' · ':''}${fmtT(r.t,p.tz)}</span>`).join('');
    return `<div class="card slot"><div class="when">${fmtD(r.t,tz)} · ${fmtT(r.t,tz)} <small>${esc(city(tz))} time</small>${r.all?'<span class="pill free">💖 everyone marked free</span>':''}</div><div class="who">${who}</div><button class="btn soft" data-act="copy" data-t="${r.t}">Copy invite for the group chat 💌</button></div>`;
  }).join('');
}
function inviteText(t){
  const g=group(),byTz=[...new Set(g.map(p=>p.tz))];
  const mins=S.dur>=60?(S.dur/60)+' hr':S.dur+' min';
  return `📞 bff call? ${mins}\n`+byTz.map(z=>`• ${fmtD(t,z)}, ${fmtT(t,z)} — ${city(z)} (${g.filter(p=>p.tz===z).map(p=>p.nick).join(', ')})`).join('\n')+`\nreply with 💖 if you're in!`;
}

/* --- me --- */
function profileForm(first){
  const pr=S.myProfile;
  const m=pr?{nick:pr.nick,emoji:pr.emoji,color:pr.color,tz:pr.tz,sleep:[pr.sleep_start,pr.sleep_end],status:pr.status}
    :{nick:'',emoji:'🐰',color:PALETTE[0],tz:validTz(deviceTz)?deviceTz:'Asia/Manila',sleep:[23,7],status:''};
  return `<h2>${first?'Hi! Tell us about you 👋':'My profile'}</h2>
  <form class="card form" id="prof">
    <label class="l">Pick your buddy</label>
    <div class="emojis">${EMOJIS.map(e=>`<button type="button" data-act="emoji" data-e="${e}" class="${e===m.emoji?'on':''}">${e}</button>`).join('')}</div>
    <input type="hidden" name="emoji" value="${esc(m.emoji)}">
    <label class="l">Nickname</label><input type="text" name="nick" maxlength="24" placeholder="e.g. Aim" value="${esc(m.nick)}" required>
    <label class="l">Your color</label>
    <div class="colors">${PALETTE.map(c=>`<button type="button" data-act="color" data-c="${c}" class="${c===m.color?'on':''}" style="background:${c}" aria-label="color"></button>`).join('')}</div>
    <input type="hidden" name="color" value="${m.color}">
    <label class="l">Where are you? (time zone)</label><select name="tz">${tzOptions(m.tz)}</select>
    <p class="hint">Moved abroad or traveling? Just change this — everyone's view updates automatically ✈️</p>
    <label class="l">Usually asleep 😴</label>
    <div class="two"><select name="s0">${hourOptions(m.sleep[0])}</select><select name="s1">${hourOptions(m.sleep[1])}</select></div>
    <label class="l">Status (optional)</label><input type="text" name="status" maxlength="60" placeholder="on night shift this week 🌙" value="${esc(m.status)}">
    <div style="margin-top:16px"><button class="btn full">${first?'Continue ♡':'Save profile'}</button></div>
  </form>`;
}
function vMe(){
  let h=`<div id="meroot">`+banners()+profileForm(false);
  const m=S.me;
  if(m){
    const p=parts(Date.now(),m.tz),ds=`${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`,nh=(p.h+1)%24;
    h+=`<h2>Add busy / free time</h2>
    <form class="card form" id="addb">
      <div class="kind"><button type="button" class="b on" data-act="kind" data-k="busy">🙅 Busy</button><button type="button" class="f" data-act="kind" data-k="free">📞 Free to call</button></div>
      <input type="hidden" name="k" value="busy">
      <label class="l">When (${esc(city(m.tz))} time)</label>
      <input type="date" name="d" value="${ds}" required>
      <div class="two" style="margin-top:8px"><input type="time" name="a" value="${String(nh).padStart(2,'0')}:00" required aria-label="start"><input type="time" name="b" value="${String((nh+2)%24).padStart(2,'0')}:00" required aria-label="end"></div>
      <p class="hint">Ends after midnight? That's fine — it rolls into the next day 🌙</p>
      <label class="l">Repeat</label>
      <select name="rep"><option value="0">Just once</option><option value="d14">Every day · 2 weeks</option><option value="wd4">Weekdays · 4 weeks</option><option value="w4">Every week · 4 weeks</option><option value="w8">Every week · 8 weeks</option></select>
      <label class="l">What is it? (optional)</label><input type="text" name="label" maxlength="60" placeholder="work shift, gym, date night…">
      <label class="check"><input type="checkbox" name="priv" checked> Keep it private (friends just see “busy”)</label>
      <div style="margin-top:16px"><button class="btn full">Add to my calendar</button></div>
    </form>
    <h2>Import from my phone calendar</h2>
    <div class="card form">
      <div style="font-size:14px">Upload a calendar file (<b>.ics</b>) and your events for the next 5 weeks show up as busy. Re-upload anytime to refresh — old imports get replaced.</div>
      <label class="check"><input type="checkbox" id="icsnames"> Show event names to friends</label>
      <label class="file"><span class="btn mint full" style="display:block;text-align:center">📅 Choose .ics file</span><input type="file" accept=".ics,text/calendar" data-ch="ics"></label>
      <details><summary>How do I get my .ics file?</summary>
        <ol><li><b>Google Calendar:</b> on a computer, go to calendar.google.com → ⚙️ Settings → Import &amp; export → Export. Unzip it and upload your calendar's .ics.</li>
        <li><b>iPhone / iCloud:</b> on a Mac, open Calendar → select your calendar → File → Export. On iPhone only, add a Google account in Settings → Calendar → Accounts, then use the Google steps.</li>
        <li><b>Outlook:</b> Calendar → Share → Publish, then download the ICS link.</li></ol>
      </details>
    </div>
    <div class="row-between"><h2>My upcoming plans</h2>${m.blocks.some(b=>b.src==='ics')?`<button class="btn soft" data-act="clrics">Clear imported</button>`:''}</div>
    <div class="card mine" id="myblocks">${myBlocks()}</div>`;
  }
  h+=circlesCard()+accountCard();
  return h+`</div>`;
}
function circlesCard(){
  return `<h2>My circles</h2><div class="card mine">${S.circles.map(c=>`<div class="mi"><span class="dot" style="background:var(--pink)"></span><div class="t"><b>${esc(c.name)}</b><small>Code ${esc(c.invite_code)}${c.role==='owner'?' · you made this':''}</small></div><button class="btn soft" data-act="invite" data-c="${c.id}">Invite</button><button class="x" data-act="leave" data-c="${c.id}" aria-label="leave circle" title="Leave circle">✕</button></div>`).join('')}
  <form id="codeform" class="mi" style="gap:8px"><input type="text" name="code" maxlength="12" placeholder="Join with a code" autocapitalize="characters" required><button class="btn soft">Join</button></form>
  <form id="newcircle" class="mi" style="gap:8px"><input type="text" name="name" maxlength="40" placeholder="New circle name" required><button class="btn soft">Create</button></form></div>`;
}
function accountCard(){
  if(S.isAnon||!S.email){
    return `<h2>Keep your account 🔐</h2><form class="card form" id="linkemail">
      <div style="font-size:14px">Right now you're signed in on <b>this device only</b>. Add your email so you can sign in on another phone and never lose your calendar.</div>
      <label class="l">Email</label><input type="text" inputmode="email" name="email" placeholder="you@email.com" required>
      <div style="margin-top:12px"><button class="btn mint full">Save my account</button></div>
      <p class="hint">We'll email you a link to confirm. That's it — no password.</p></form>`+dangerZone();
  }
  return `<h2>Account</h2><div class="card form"><div style="font-size:14px">Signed in as <b>${esc(S.email)}</b> ✅</div><div style="margin-top:12px"><button class="btn soft" data-act="signout">Sign out</button></div></div>`+dangerZone();
}
function dangerZone(){
  return `<div class="card form" style="margin-top:12px"><div style="font-size:14px"><b>Delete my account</b><br><span class="hint" style="margin:0">Removes your profile, all your plans and your circle memberships for good. Circles with nobody left in them are deleted too.</span></div>
  <div style="margin-top:12px"><button class="btn soft" data-act="delacct">Delete my account</button></div></div>
  <p class="hint" style="text-align:center;margin-top:14px"><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p>`;
}
function myBlocks(){
  const m=S.me;if(!m)return '';
  const now=Date.now(),bl=m.blocks.filter(b=>b.e>now).slice(0,60);
  if(!bl.length)return `<div class="empty">Nothing yet — add your work hours or upload your calendar 🌷</div>`;
  return bl.map(b=>`<div class="mi"><span class="dot" style="background:${b.k==='busy'?'var(--pink)':'var(--mint)'}"></span><div class="t">${fmtD(b.s,m.tz)} · ${fmtT(b.s,m.tz)}–${fmtT(b.e,m.tz)}<small>${b.k==='busy'?'Busy':'Free to call'}${b.label?' · '+esc(b.label):''}${b.src==='ics'?' · 📅 imported':''}</small></div><button class="x" data-act="del" data-id="${esc(b.id)}" aria-label="delete">✕</button></div>`).join('');
}

/* ---------- .ics import ---------- */
function parseICS(text){
  const lines=text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);const evs=[];let cur=null;
  for(const ln of lines){
    if(/^BEGIN:VEVENT/i.test(ln)){cur={};continue}
    if(/^END:VEVENT/i.test(ln)){if(cur)evs.push(cur);cur=null;continue}
    if(!cur)continue;
    const i=ln.indexOf(':');if(i<0)continue;
    const head=ln.slice(0,i),val=ln.slice(i+1);const [name,...ps]=head.split(';');const params={};
    ps.forEach(p=>{const j=p.indexOf('=');if(j>0)params[p.slice(0,j).toUpperCase()]=p.slice(j+1).replace(/^"|"$/g,'')});
    const N=name.toUpperCase();
    if(N==='DTSTART'||N==='DTEND')cur[N]={val,params};
    else if(N==='SUMMARY')cur.summary=val.replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1');
    else if(N==='RRULE')cur.rrule=val;
    else if(N==='TRANSP')cur.transp=val.trim().toUpperCase();
    else if(N==='STATUS')cur.status=val.trim().toUpperCase();
    else if(N==='DURATION')cur.duration=val.trim();
    else if(N==='EXDATE')(cur.ex=cur.ex||[]).push(...val.split(',').map(v=>({val:v,params})));
  }
  return evs;
}
function icsTime(o,defTz){
  const v=String(o.val).trim(),tz=o.params&&o.params.TZID&&validTz(o.params.TZID)?o.params.TZID:defTz;
  let m=v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m)return {ms:zoned(+m[1],+m[2],+m[3],0,0,defTz),allDay:true,tz:defTz};
  m=v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if(!m)return null;
  if(m[7])return {ms:Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]),tz:defTz};
  return {ms:zoned(+m[1],+m[2],+m[3],+m[4],+m[5],tz),tz};
}
function durMs(s){const m=String(s).match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);if(!m)return 36e5;return ((+m[1]||0)*7*DAY)+((+m[2]||0)*DAY)+((+m[3]||0)*36e5)+((+m[4]||0)*60000)+((+m[5]||0)*1000)}
function expandICS(evs,defTz,from,to){
  const out=[],WD=['SU','MO','TU','WE','TH','FR','SA'];
  for(const ev of evs){
    if(!ev.DTSTART||ev.transp==='TRANSPARENT'||ev.status==='CANCELLED')continue;
    const st=icsTime(ev.DTSTART,defTz);if(!st||st.allDay)continue;
    const en=ev.DTEND?icsTime(ev.DTEND,defTz):null;
    const dur=en&&en.ms>st.ms?en.ms-st.ms:(ev.duration?durMs(ev.duration):36e5);
    if(dur>2*DAY)continue;
    const label=String(ev.summary||'').slice(0,60);
    if(!ev.rrule){if(st.ms+dur>from&&st.ms<to)out.push({s:st.ms,e:st.ms+dur,label});continue}
    const r={};ev.rrule.split(';').forEach(p=>{const [k,v]=p.split('=');r[(k||'').toUpperCase()]=v});
    const iv=Math.max(1,+(r.INTERVAL||1)),count=r.COUNT?+r.COUNT:Infinity;
    let until=Infinity;if(r.UNTIL){const u=icsTime({val:r.UNTIL,params:{}},defTz);if(u)until=u.ms+(u.allDay?DAY:0)}
    const ex=new Set((ev.ex||[]).map(x=>{const t=icsTime(x,defTz);return t&&t.ms}));
    const tz=st.tz,p0=parts(st.ms,tz),d0=new Date(Date.UTC(p0.y,p0.m-1,p0.d)),wd0=d0.getUTCDay();
    const byday=r.BYDAY?r.BYDAY.split(',').map(x=>x.slice(-2).toUpperCase()):null;
    let k0=0;if(count===Infinity&&st.ms<from-3*DAY){k0=Math.floor((from-st.ms)/DAY)-2;if(r.FREQ==='WEEKLY'||r.FREQ==='DAILY')k0-=k0%(r.FREQ==='WEEKLY'?7*iv:iv)}
    let n=0;
    for(let k=Math.max(0,k0);k<k0+400&&k<4000;k++){
      const dt=new Date(Date.UTC(p0.y,p0.m-1,p0.d+k)),wd=dt.getUTCDay();let match=false;
      if(r.FREQ==='DAILY')match=k%iv===0&&(!byday||byday.includes(WD[wd]));
      else if(r.FREQ==='WEEKLY'){const wk=Math.floor((k+wd0)/7);match=wk%iv===0&&(byday?byday.includes(WD[wd]):wd===wd0)}
      else if(r.FREQ==='MONTHLY'){const md=(dt.getUTCFullYear()-p0.y)*12+dt.getUTCMonth()-(p0.m-1);match=!byday&&dt.getUTCDate()===p0.d&&md%iv===0}
      else if(r.FREQ==='YEARLY')match=dt.getUTCMonth()===p0.m-1&&dt.getUTCDate()===p0.d&&(dt.getUTCFullYear()-p0.y)%iv===0;
      if(!match)continue;
      const occ=zoned(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate(),p0.h,p0.mi,tz);
      if(occ<st.ms)continue;
      n++;if(n>count||occ>until||occ>to)break;
      if(!ex.has(occ)&&occ+dur>from)out.push({s:occ,e:occ+dur,label});
    }
  }
  return out;
}

/* ---------- events ---------- */
function getCaptcha(){
  if(!CFG.turnstileSiteKey)return Promise.resolve(undefined);
  return new Promise((res,rej)=>{
    let n=0;
    const go=()=>{
      const box=document.getElementById('captcha');box.innerHTML='';box.style.display='flex';
      try{window.turnstile.render(box,{sitekey:CFG.turnstileSiteKey,appearance:'interaction-only',
        callback:t=>{box.style.display='none';res(t)},
        'before-interactive-callback':()=>{toast('Quick human check 👇 tap the box');box.scrollIntoView({behavior:'smooth',block:'center'})},
        'error-callback':()=>{box.style.display='none';rej(new Error('Human check failed — please try again 🙏'))}})}
      catch(e){rej(e)}
    };
    (function wait(){if(window.turnstile)go();else if(n++<50)setTimeout(wait,200);else rej(new Error("Couldn't load the human check — check your connection"))})();
  });
}
async function startAnon(){
  if(S.busy)return;S.busy=true;
  try{
    let captchaToken;
    try{captchaToken=await getCaptcha()}catch(e){toast(e.message);return}
    const {error}=await sb.auth.signInAnonymously({options:{captchaToken}});
    if(error)toast(errMsg(error));
  }finally{S.busy=false}
}
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act;
  if(el.tagName==='A')e.preventDefault();
  if(a==='tab'){S.tab=el.dataset.tab;render(true);window.scrollTo(0,0)}
  else if(a==='start')startAnon();
  else if(a==='wmode'){S.welcomeMode=el.dataset.m||null;render(true)}
  else if(a==='day'){S.dayIdx=+el.dataset.i;render()}
  else if(a==='seg'){
    const p=S.people.find(x=>x.id===el.dataset.p);if(!p)return;
    const s=+el.dataset.s,en=+el.dataset.e,st=el.dataset.st,tz=S.dtz;
    const word={busy:'🙅 Busy',free:'📞 Free to talk',sleep:'😴 Sleeping'}[st];
    const lbl=st!=='sleep'?(p.blocks.find(b=>b.k===st&&b.s<en&&b.e>s&&b.label)||{}).label:'';
    const theirs=p.tz!==tz?` (${fmtT(s,p.tz)}–${fmtT(en,p.tz)} for ${p.nick})`:'';
    toast(`${p.emoji} ${p.nick}: ${word}${lbl?' · '+lbl:''} · ${fmtT(s,tz)}–${fmtT(en,tz)} ${city(tz)} time${theirs}`);
  }
  else if(a==='who'){const id=el.dataset.p;S.unsel.has(id)?S.unsel.delete(id):S.unsel.add(id);render()}
  else if(a==='dur'){S.dur=+el.dataset.m;render()}
  else if(a==='copy')copyText(inviteText(+el.dataset.t),'Copied! Paste it in the group chat 💌');
  else if(a==='invite'){
    const c=S.circles.find(x=>x.id===(el.dataset.c||S.circleId));if(!c)return;
    copyText(`💞 Join our bff calendar so we know when everyone's free!\n${inviteLink(c)}\n(code: ${c.invite_code})`,'Invite link copied! Paste it in the group chat 💌');
  }
  else if(a==='emoji'||a==='color'||a==='kind'){
    el.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===el));
    el.form[a==='kind'?'k':a].value=el.dataset[a==='emoji'?'e':a==='color'?'c':'k'];
  }
  else if(a==='del'){
    const {error}=await sb.from('blocks').delete().eq('id',el.dataset.id);
    if(error)toast(errMsg(error));else loadCircle();
  }
  else if(a==='clrics'){
    const {error}=await sb.from('blocks').delete().eq('user_id',S.uid).eq('src','ics');
    if(error)toast(errMsg(error));else{toast('Imported events cleared 🧹');loadCircle()}
  }
  else if(a==='leave'||a==='delacct'){
    if(!el.dataset.armed){el.dataset.armed='1';el.dataset.orig=el.textContent;el.textContent=a==='leave'?'Leave? tap again':'Tap again to delete forever';el.classList.add('danger');setTimeout(()=>{if(el.isConnected){delete el.dataset.armed;el.textContent=el.dataset.orig;el.classList.remove('danger')}},4000);return}
    el.disabled=true;
    if(a==='leave'){
      const id=el.dataset.c;const {error}=await sb.rpc('leave_circle',{p_circle:id});
      if(error){toast(errMsg(error));el.disabled=false;return}
      S.circles=S.circles.filter(c=>c.id!==id);toast('You left the circle 👋');
      if(!S.circles.length){S.circleId=null;S.people=[];S.stage='circle';render(true);return}
      if(S.circleId===id){S.circleId=S.circles[0].id;S.people=[]}
      render(true);loadCircle();
    }else{
      const {error}=await sb.rpc('delete_my_account');
      if(error){toast(errMsg(error));el.disabled=false;return}
      await sb.auth.signOut();ls.set('bff.circle',null);
      Object.assign(S,{people:[],me:null,circles:[],circleId:null,myProfile:null,tab:'friends'});
      toast('Your account was deleted. Bye for now 💌');
    }
  }
  else if(a==='signout'){await sb.auth.signOut();S.people=[];S.me=null;S.circles=[];S.circleId=null;S.myProfile=null;ls.set('bff.circle',null)}
});
document.addEventListener('change',async e=>{
  const el=e.target,c=el.dataset&&el.dataset.ch;
  if(c==='dtz'){S.dtz=el.value;S.dayIdx=0;render()}
  else if(c==='circle'){S.circleId=el.value;S.people=[];S.unsel.clear();render(true);loadCircle()}
  else if(c==='ics'){
    const f=el.files&&el.files[0];if(!f||!S.me)return;
    const showNames=document.getElementById('icsnames')?.checked;
    el.value='';
    try{
      const txt=await f.text();
      const now=Date.now(),list=expandICS(parseICS(txt),S.me.tz,now-DAY,now+35*DAY).slice(0,300);
      const del=await sb.from('blocks').delete().eq('user_id',S.uid).eq('src','ics');
      if(del.error)throw del.error;
      if(list.length&&!(await addBlocks(list.map(x=>({s:x.s,e:x.e,k:'busy',label:showNames?x.label:'',src:'ics'})))))return;
      if(!list.length)loadCircle();
      toast(list.length?`Imported ${list.length} event${list.length>1?'s':''} 🎉`:'No timed events found in the next 5 weeks 🤔');
    }catch(err){toast("Couldn't read that file — is it an .ics calendar?")}
  }
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  const btn=f.querySelector('button:not([type=button])');if(btn)btn.disabled=true;
  try{
    if(f.id==='prof'){
      const nick=f.nick.value.trim();if(!nick){toast('Add a nickname first 🌷');return}
      const row={id:S.uid,nick,emoji:f.emoji.value,color:f.color.value,tz:f.tz.value,sleep_start:+f.s0.value,sleep_end:+f.s1.value,status:f.status.value.trim().slice(0,60),updated_at:new Date().toISOString()};
      const {data,error}=await sb.from('profiles').upsert(row).select().single();
      if(error){toast(errMsg(error));return}
      const first=!S.myProfile;S.myProfile=data;S.dtz=row.tz;S.dtzSet=true;
      if(S.stage!=='app'){await loadMine();if(first)toast(`Welcome, ${nick}! ${row.emoji}`)}
      else{toast('Saved ✨');await loadCircle();render(true)}
    }
    else if(f.id==='newcircle'){
      const {data,error}=await sb.rpc('create_circle',{p_name:f.name.value.trim()});
      if(error){toast(errMsg(error));return}
      S.circles.push({...data,role:'owner'});S.circleId=data.id;S.people=[];
      if(S.stage!=='app'){S.stage='app';subscribe()}
      S.tab='friends';render(true);await loadCircle();
      toast(`“${data.name}” is ready! Tap “Invite friends” to share 💌`);
    }
    else if(f.id==='codeform'){
      const code=f.code.value.trim().toUpperCase();if(!code)return;
      if(!S.uid){ls.set('bff.pendingCode',code);await startAnon();return}
      const {data,error}=await sb.rpc('join_circle',{p_code:code});
      if(error){toast(errMsg(error));return}
      if(!S.circles.some(c=>c.id===data.id))S.circles.push({...data,role:'member'});
      S.circleId=data.id;S.people=[];
      if(S.stage!=='app'){S.stage='app';subscribe()}
      S.tab='friends';render(true);await loadCircle();toast(`You joined “${data.name}” 💖`);
    }
    else if(f.id==='emailform'){
      const email=f.email.value.trim();
      let captchaToken;try{captchaToken=await getCaptcha()}catch(err){toast(err.message);return}
      const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname,captchaToken}});
      if(error)toast(/signups? not allowed|not found/i.test(error.message)?"No account with that email yet — tap “Start a circle” instead 🌷":errMsg(error));
      else toast('Check your email for the sign-in link ✨');
    }
    else if(f.id==='linkemail'){
      const email=f.email.value.trim();
      const {error}=await sb.auth.updateUser({email},{emailRedirectTo:location.origin+location.pathname});
      if(error)toast(errMsg(error));else toast('Almost done! Tap the link we emailed you to confirm 💌');
    }
    else if(f.id==='addb'){
      const m=S.me;if(!m)return;
      const [y,mo,dd]=f.d.value.split('-').map(Number),[ah,am]=f.a.value.split(':').map(Number),[bh,bm]=f.b.value.split(':').map(Number);
      if(!y||isNaN(ah)||isNaN(bh)){toast('Pick a date and times ⏰');return}
      const rep=f.rep.value,days=[];
      if(rep==='0')days.push(0);
      else if(rep==='d14')for(let k=0;k<14;k++)days.push(k);
      else if(rep==='wd4')for(let k=0;k<28;k++){const w=new Date(Date.UTC(y,mo-1,dd+k)).getUTCDay();if(w>0&&w<6)days.push(k)}
      else{const n=rep==='w8'?8:4;for(let k=0;k<n;k++)days.push(k*7)}
      const label=f.priv.checked?'':f.label.value.trim().slice(0,60),k=f.k.value==='free'?'free':'busy';
      const rows=days.map(off=>{const s=zoned(y,mo,dd+off,ah,am,m.tz);let en=zoned(y,mo,dd+off,bh,bm,m.tz);if(en<=s)en+=DAY;return {s,e:en,k,label}});
      if(await addBlocks(rows)){toast(days.length>1?`Added ${days.length} times 🗓️`:'Added 🗓️');f.label.value=''}
    }
  }finally{if(btn)btn.disabled=false}
});

/* ---------- boot ---------- */
render(true);
setInterval(()=>{if(S.stage==='app'&&S.tab!=='me')render()},60000);
let lastUid;
sb.auth.onAuthStateChange((ev,session)=>{
  const id=session?session.user.id:null;
  if(session){S.isAnon=!!session.user.is_anonymous;S.email=session.user.email||null}
  if(id===lastUid){if(ev==='USER_UPDATED'&&S.stage==='app'&&S.tab==='me')render(true);return}
  lastUid=id;
  setTimeout(()=>onSession(session),0);
});
