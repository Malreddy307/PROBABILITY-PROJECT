const D={};const $=id=>document.getElementById(id)||(D[id]=D[id]||document.createElement('input'));
const S={data:[],T:500,res:null};
const fmt=x=>!isFinite(x)?'-':(x!==0&&(Math.abs(x)>=1e5||Math.abs(x)<1e-3))?x.toExponential(3):String(+x.toPrecision(4));
const read=()=>$('data').value.split(/[\s,;]+/).map(Number).filter(v=>isFinite(v)&&v>0);

async function analyze(){
  $('msg').textContent='';
  try{
    const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:read(),confidence:+$('conf').value})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||'Analysis failed.');
    S.data=read().sort((a,b)=>a-b); S.res=j; S.T=4*j.mttf;try{localStorage.setItem('rely',JSON.stringify({data:S.data,res:j}))}catch(e){}
    const L=$('lam'); L.min=j.lam/200; L.max=j.lam*4; L.step=j.lam/400; L.value=j.lam;
    const T=$('t'); T.max=S.T; T.step=S.T/400; T.value=j.mttf/2;
    show(j); draw();
  }catch(e){$('msg').textContent=e.message}
}

function show(j){
  const c=Math.round(j.conf*100), ok=j.ks_p>0.05;
  const box=(l,v,s,c)=>`<div class="stat" ${c?`style="--c:${c}"`:''}><small>${l}</small><b>${v}</b><small>${s||''}</small></div>`;
  $('fit').innerHTML=
    box('Sample size',j.n)+
    box('Failure rate λ (MLE)',fmt(j.lam),`${c}% CI ${fmt(j.lam_ci[0])} to ${fmt(j.lam_ci[1])}`)+
    box('Mean time to failure',fmt(j.mttf),`${c}% CI ${fmt(j.mttf_ci[0])} to ${fmt(j.mttf_ci[1])}`)+
    box('Median life',fmt(j.median),'half of units fail before this')+
    box('Model fit check',`p = ${j.ks_p.toFixed(3)}`,j.ks_p>0.05?'Good fit: failures look exponential':j.ks_p>0.01?'Borderline fit':'Poor fit: failure rate may not be constant',j.ks_p>0.05?'#2de2c5':j.ks_p>0.01?'#ffb84d':'#ff5ea8');
}

const base=(title,xt,yt,o={})=>Object.assign({title:{text:title,font:{family:'Sora',size:17}},
  margin:{l:52,r:12,t:42,b:44},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
  font:{family:'DM Sans',size:11,color:'#e8ecff'},xaxis:{title:xt,gridcolor:'rgba(255,255,255,.12)'},
  yaxis:{title:yt,gridcolor:'rgba(255,255,255,.12)'},legend:{orientation:'h',y:-.28}},o);
const cfg={responsive:true,displaylogo:false};

function draw(){
  const lam=+$('lam').value,t=+$('t').value,T=S.T,n=Math.max(1,Math.round(+$('n').value||1));
  const p=Math.min(.99,Math.max(.01,(+$('p').value||10)/100)), Rt=Math.exp(-lam*t);
  $('lamv').textContent=fmt(lam); $('tv').textContent=fmt(t);
  $('rt').textContent=(Rt*100).toFixed(2)+'%'; $('ft').textContent=((1-Rt)*100).toFixed(2)+'%';
  $('tp').textContent=fmt(-Math.log(1-p)/lam);
  $('ser').textContent=(Math.pow(Rt,n)*100).toFixed(2)+'%';
  $('par').textContent=((1-Math.pow(1-Rt,n))*100).toFixed(2)+'%';
  $('plain').textContent=`In plain words: a part has a ${(Rt*100).toFixed(0)}% chance of still working at time ${fmt(t)}. Half of all parts fail by ${fmt(Math.LN2/lam)}, and ${(p*100).toFixed(0)}% have failed by ${fmt(-Math.log(1-p)/lam)}.`;

  // hero pen trace
  const X=x=>1000*x/T, Y=r=>10+180*(1-r);
  let d='';
  for(let i=0;i<=120;i++){const x=T*i/120;d+=(i?'L':'M')+X(x).toFixed(1)+' '+Y(Math.exp(-lam*x)).toFixed(1)}
  
  const hx=Math.min(1000,X(t));
  $('hline').setAttribute('x1',hx);$('hline').setAttribute('x2',hx);
  $('hdot').setAttribute('cx',hx);$('hdot').setAttribute('cy',Y(Rt));

  if(!document.getElementById('p1'))return;
  const ts=Array.from({length:201},(_,i)=>T*i/200), R=ts.map(x=>Math.exp(-lam*x));
  const emp=S.data.length?{x:[0,...S.data],y:[1,...S.data.map((_,i)=>1-(i+1)/S.data.length)],
    mode:'lines',line:{shape:'hv',color:'#2de2c5',width:2},name:'Observed survival'}:null;
  Plotly.react('p1',[
    {x:ts,y:R,mode:'lines',line:{color:'#ff5ea8',width:3},name:'Reliability R(t)'},
    {x:ts,y:R.map(r=>1-r),mode:'lines',line:{color:'#e8ecff',dash:'dash'},name:'Failed F(t)'},
    ...(emp?[emp]:[]),
    {x:[t],y:[Rt],mode:'markers',marker:{size:11,color:'#e8ecff'},name:'At time t'}
  ],base('Reliability curve','time','probability',{yaxis:{title:'probability',range:[0,1.02],gridcolor:'rgba(255,255,255,.12)'}}),cfg);

  const pdf={x:ts,y:ts.map(x=>lam*Math.exp(-lam*x)),mode:'lines',line:{color:'#ff5ea8',width:3},name:'Fitted density f(t)'};
  Plotly.react('p2',[
    ...(S.data.length?[{x:S.data,type:'histogram',histnorm:'probability density',nbinsx:12,
      marker:{color:'rgba(45,226,197,.45)',line:{color:'#e8ecff',width:1.5}},name:'Your data'}]:[]),pdf
  ],base('Data against fitted density','time','density',{xaxis:{title:'time',range:[0,T],gridcolor:'rgba(255,255,255,.12)'}}),cfg);

  Plotly.react('p3',[
    {x:ts,y:R,mode:'lines',line:{color:'#e8ecff',width:2},name:'Single part'},
    {x:ts,y:R.map(r=>Math.pow(r,n)),mode:'lines',line:{color:'#ff5ea8',width:3},name:`Series of ${n}`},
    {x:ts,y:R.map(r=>1-Math.pow(1-r,n)),mode:'lines',line:{color:'#2de2c5',width:3},name:`Parallel of ${n}`}
  ],base('System layouts: series versus parallel','time','system reliability',{yaxis:{title:'system reliability',range:[0,1.02],gridcolor:'rgba(255,255,255,.12)'}}),cfg);
}

$('run').onclick=analyze;
$('sample').onchange=e=>{const m=+e.target.value;if(!m)return;
  $('data').value=Array.from({length:40},()=>Math.round(-m*Math.log(1-Math.random()))+1).join(', ');
  e.target.selectedIndex=0;analyze()};
$('dl').onclick=()=>{const j=S.res;if(!j){$('msg').textContent='Fit your data first, then download the report.';return}
  const rows=[['metric','value'],['sample size',j.n],['lambda (MLE)',j.lam],['MTTF',j.mttf],['median life',j.median],['lambda CI low',j.lam_ci[0]],['lambda CI high',j.lam_ci[1]],['MTTF CI low',j.mttf_ci[0]],['MTTF CI high',j.mttf_ci[1]],['KS p-value',j.ks_p],[],['failure times'],...S.data.map(x=>[x])];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));
  a.download='reliability-report.csv';a.click()};
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=()=>{$('data').value=r.result;analyze()};r.readAsText(f)};
['lam','t','p','n'].forEach(id=>$(id).addEventListener('input',draw));
$('hpath').addEventListener('animationend',e=>e.target.classList.remove('draw'));
const getLam=()=>{const e=document.getElementById('lam');return e?+e.value:(S.res?S.res.lam:0.01)};
try{const sv=JSON.parse(localStorage.getItem('rely'));if(sv&&sv.res){const j=sv.res;S.data=sv.data;S.res=j;S.T=4*j.mttf;
  const L=$('lam');L.min=j.lam/200;L.max=j.lam*4;L.step=j.lam/400;L.value=j.lam;
  const T=$('t');T.max=S.T;T.step=S.T/400;T.value=j.mttf/2;show(j)}}catch(e){}
draw();

/* live loop: hero pen + failure simulator share one clock */
S.play=true;S.el=0;S.t0=performance.now();S.cyc=-1;S.lu=0;
$('play').onclick=()=>{S.play=!S.play;$('play').textContent=S.play?'Pause':'Play';if(S.play)S.t0=performance.now()-S.el};
$('reset').onclick=()=>{S.t0=performance.now();S.el=0;S.cyc=-1};
const CY=12000,N=60,cv=document.getElementById('sim'),cx=cv&&cv.getContext('2d');
function frame(now){
  if(S.play)S.el=now-S.t0;
  const cyc=Math.floor(S.el/CY),ph=Math.min(1,(S.el%CY)/10000),lam=getLam(),T=S.T;
  if(cyc!==S.cyc||lam!==S.lu){S.cyc=cyc;S.lu=lam;S.f=Array.from({length:N},()=>-Math.log(1-Math.random())/lam)}
  let d='';const k=Math.max(1,Math.round(120*ph));
  for(let i=0;i<=k;i++){const x=T*ph*i/k;d+=(i?'L':'M')+(1000*x/T).toFixed(1)+' '+(10+180*(1-Math.exp(-lam*x))).toFixed(1)}
  $('hpath').setAttribute('d',d);
  $('hpen').setAttribute('cx',1000*ph);$('hpen').setAttribute('cy',10+180*(1-Math.exp(-lam*T*ph)));
  S.tn=T*ph;
  if(!cv){requestAnimationFrame(frame);return}
  if(cv.width!==cv.clientWidth)cv.width=cv.clientWidth;
  const W=cv.width,tn=T*ph;let up=0;cx.clearRect(0,0,W,220);
  S.f.forEach((f,i)=>{const on=f>tn;if(on)up++;cx.fillStyle=on?'#2de2c5':'#ff5ea8';cx.globalAlpha=on?1:.5;
    cx.beginPath();cx.arc(20+(i%20)*((W-40)/19),22+Math.floor(i/20)*30,8,0,7);cx.fill()});
  cx.globalAlpha=1;cx.lineWidth=2;cx.setLineDash([5,5]);cx.strokeStyle='rgba(255,255,255,.5)';cx.beginPath();
  for(let i=0;i<=100;i++)cx[i?'lineTo':'moveTo'](20+i/100*(W-40),210-90*Math.exp(-lam*T*i/100));
  cx.stroke();cx.setLineDash([]);cx.strokeStyle='#ffb84d';cx.beginPath();
  for(let i=0;i<=Math.round(100*ph);i++)cx[i?'lineTo':'moveTo'](20+i/100*(W-40),210-90*S.f.filter(v=>v>T*i/100).length/N);
  cx.stroke();
  $('live').textContent=`Working ${up} of ${N} (${(100*up/N).toFixed(0)}%), theory ${(100*Math.exp(-lam*tn)).toFixed(0)}%, time ${fmt(tn)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('simdl').onclick=()=>{if(!S.f)return;
  const rows=[['unit','failure_time','status_now'],...S.f.map((f,i)=>[i+1,f.toFixed(3),f>S.tn?'working':'failed'])];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));
  a.download='simulation-run.csv';a.click()};
