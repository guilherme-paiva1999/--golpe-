const fs=require('fs'),vm=require('vm');
const noop=()=>{},ev={addListener:noop};
const chrome={runtime:{onInstalled:ev,onStartup:ev,onMessage:ev,id:'x',getPlatformInfo:noop},alarms:{get:async()=>({}),create:noop,onAlarm:ev},webNavigation:{onBeforeNavigate:ev},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{}}},action:{}};
const ctx={chrome,console,AbortSignal,URL,TextDecoder,fetch:async()=>{throw 0}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../background.js'),'utf8')+';this.T={pontuarPagina,nivelPorRigor,avaliarHost}',ctx);
const T=ctx.T, S=(o)=>Object.assign({pagamento:false,pressao:false,desconto:false,formExterno:false,senha:false,semContato:false},o);
const casos=[
 ['loja NOVA (10 dias) + pagamento + pressão',S({pagamento:true,pressao:true}),10,'perigo','atencao'],
 ['loja NOVA + pagamento + pressão + desconto + sem contato',S({pagamento:true,pressao:true,desconto:true,semContato:true}),10,'perigo','perigo'],
 ['idade DESCONHECIDA + pagamento + pressão',S({pagamento:true,pressao:true}),null,'atencao','atencao'],
 ['idade DESCONHECIDA + só pagamento (loja comum)',S({pagamento:true}),null,'atencao','ok'],
 ['loja ANTIGA (4 anos) + pagamento + pressão + desconto',S({pagamento:true,pressao:true,desconto:true}),1460,'ok','ok'],
 ['loja de 1 ano + só pagamento',S({pagamento:true}),400,'ok','ok'],
 ['formulário envia a outro site, idade desconhecida',S({pagamento:true,formExterno:true}),null,'atencao','atencao'],
 ['página sem sinais',S({}),null,'ok','ok'],
 ['login (senha) em site de 20 dias',S({senha:true}),20,'atencao','atencao'],
];
let ok=0;for(const [n,s,d,eA,eN] of casos){const r=T.pontuarPagina(0,[],s,d,'alto'),a=T.nivelPorRigor(r.pontos,'alto'),r2=T.pontuarPagina(0,[],s,d,'normal'),nn=T.nivelPorRigor(r2.pontos,'normal');
 const bom=a===eA&&nn===eN;ok+=bom;console.log((bom?'OK  ':'ERRO'),n.padEnd(58),'alto:',String(r.pontos).padStart(3),a.padEnd(7),'| normal:',String(r2.pontos).padStart(3),nn);}
console.log(ok+'/'+casos.length+' casos como esperado');
