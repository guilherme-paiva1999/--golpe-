// Mede as regras da extensão no feed público do OpenPhish. Uso: node medir_openphish.js feed.txt phishing.txt
const fs=require('fs'),vm=require('vm');
const noop=()=>{},ev={addListener:noop};
const chrome={runtime:{onInstalled:ev,onStartup:ev,onMessage:ev,id:'x',getPlatformInfo:noop},alarms:{get:async()=>({}),create:noop,onAlarm:ev},webNavigation:{onBeforeNavigate:ev},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{}}},action:{}};
const ctx={chrome,console,AbortSignal,URL,TextDecoder,fetch:async()=>{throw 0}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../background.js'),'utf8')+';this.T={avaliarHost,nivelDe}',ctx);
const urls=fs.readFileSync(process.argv[2]||'feed.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean);
const hosts=[...new Set(urls.map(u=>{try{return new URL(u).hostname.toLowerCase()}catch(e){return null}}).filter(Boolean))];
const db=new Set(fs.readFileSync(process.argv[3]||'phishing.txt','utf8').split('\n').map(s=>s.trim().toLowerCase()));
let avisa=0,perigo=0,naLista=0,hospedagem=0;const naoPega=[];
for(const h of hosts){const r=ctx.T.avaliarHost(h),n=ctx.T.nivelDe(r.pontos);if(n!=='ok')avisa++;else naoPega.push(h);if(n==='perigo')perigo++;
  const p=h.split('.');let achou=false;for(let i=0;i<p.length-1;i++)if(db.has(p.slice(i).join('.')))achou=true;if(achou)naLista++;
  if(/(vercel\.app|blogspot\.com|github\.io|netlify\.app|web\.app|pages\.dev|weebly\.com|wixsite\.com|herokuapp\.com)$/.test(h))hospedagem++;}
const pct=(a)=>(100*a/hosts.length).toFixed(1)+'%';
console.log('URLs no feed:',urls.length,'| sites (hosts) distintos:',hosts.length);
console.log('regras avisam (atenção+):',avisa,pct(avisa),'| bloqueiam (perigo):',perigo,pct(perigo));
console.log('já constam no Phishing.Database:',naLista,pct(naLista),'| em hospedagem gratuita:',hospedagem,pct(hospedagem));
console.log('exemplos que as regras NÃO pegam:',naoPega.slice(0,8).join(' , '));
