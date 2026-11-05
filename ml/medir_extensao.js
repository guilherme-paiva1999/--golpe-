// Mede quantos golpes DESCONHECIDOS (fora das listas) as regras da extensão pegam.
// Uso: node medir_extensao.js ../background.js hosts_teste.json  (hosts_teste.json vem de treinar.py)
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync(process.argv[2]||'../background.js','utf8');
const noop=()=>{}, ev={addListener:noop};
const chrome={runtime:{onInstalled:ev,onStartup:ev,onMessage:ev,id:'x',getPlatformInfo:noop},alarms:{get:async()=>({}),create:noop,onAlarm:ev},webNavigation:{onBeforeNavigate:ev},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{}}}};
const ctx={chrome,console,AbortSignal,URL,TextDecoder,fetch:async()=>{throw 0}};
vm.createContext(ctx); vm.runInContext(code+';this.T={avaliarHost,nivelDe}',ctx);
const d=JSON.parse(fs.readFileSync(process.argv[3]||'/tmp/hosts_teste.json','utf8'));
const golpes=d.filter(x=>x.y===1), normais=d.filter(x=>x.y===0);
function rodar(lista){let atencao=0,perigo=0,zero=0;const por={};
  for(const x of lista){const r=ctx.T.avaliarHost(x.host.toLowerCase());const n=ctx.T.nivelDe(r.pontos);
    if(n!=='ok')atencao++; if(n==='perigo')perigo++;}
  return {n:lista.length,avisa:atencao,perigo};}
const g=rodar(golpes), n=rodar(normais);
const br=golpes.filter(x=>x.host.endsWith('.br')); const gb=rodar(br);
// com http (golpes sem https ganham +10) e com idade < 30 dias (+30) como cenário com RDAP
function cenario(lista,extra){let c=0;for(const x of lista){const r=ctx.T.avaliarHost(x.host.toLowerCase());if(ctx.T.nivelDe(r.pontos+extra)!=='ok')c++;}return c;}
const pct=(a,b)=>(100*a/b).toFixed(1)+'%';
console.log('GOLPES testados:',g.n);
console.log('  extensão avisa (atenção ou perigo), SÓ regras:',g.avisa,'=',pct(g.avisa,g.n));
console.log('  desses, nível "perigo" (bloqueia):',g.perigo,'=',pct(g.perigo,g.n));
console.log('  golpes .br:',gb.n,'-> avisa',pct(gb.avisa,gb.n));
//console.log('  cenário +10 (sem https):',pct(cenario(golpes,10),g.n),'| +30 (domínio novo, via RDAP):',pct(cenario(golpes,30),g.n),'| +40 (os dois):',pct(cenario(golpes,40),g.n));
console.log('SITES NORMAIS testados:',n.n,'-> avisa (falso alerta):',n.avisa,'=',pct(n.avisa,n.n));
