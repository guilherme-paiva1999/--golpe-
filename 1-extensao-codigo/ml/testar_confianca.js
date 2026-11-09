// Testa só a lógica da pontuação de confiança das lojas (não mede acerto em golpes reais).
const fs=require('fs'),vm=require('vm'),path=require('path');
const noop=()=>{},ev={addListener:noop};
const chrome={runtime:{onInstalled:ev,onStartup:ev,onMessage:ev,id:'x',getPlatformInfo:noop},alarms:{get:async()=>({}),create:noop,onAlarm:ev},webNavigation:{onBeforeNavigate:ev},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{}}},action:{}};
const ctx={chrome,console,AbortSignal,URL,TextDecoder,fetch:async()=>{throw 0}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../alfabetos.js'),'utf8')+fs.readFileSync(path.join(__dirname,'../background.js'),'utf8')+';this.T={pontuarConfianca,limiteConfianca}',ctx);
const T=ctx.T, S=(o)=>Object.assign({pagamento:true,venda:true,cnpjValido:true,contato:true,politicas:true},o);
const casos=[ // nome, sinais, dias, protocolo, esperado(alto)
 ['loja de 4 anos, https, CNPJ, contato, políticas (80: não passa)', S({}),1460,'https:','nao'],
 ['loja de 4 anos com todas as provas + gateway', S({gateway:true}),1460,'https:','ok'],
 ['igual, mas sem políticas', S({politicas:false}),1460,'https:','nao'],
 ['igual, mas sem https', S({}),1460,'http:','nao'],
 ['loja de 1 ano + gateway de pagamento (80: não passa)', S({gateway:true}),400,'https:','nao'],
 ['loja de 1 ano, sem gateway', S({}),400,'https:','nao'],
 ['loja NOVA (10 dias) com todas as provas', S({}),10,'https:','nao'],
 ['loja nova com pressão e desconto', S({pressao:true,desconto:true}),10,'https:','nao'],
 ['idade desconhecida com todas as provas', S({}),null,'https:','nao'],
 ['loja antiga, mas com pressão de tempo', S({pressao:true}),1460,'https:','nao'],
 ['loja em vercel.app (hospedagem grátis) com todas as provas', S({__gratuito:true}),null,'https:','nao'],
 ['golpe: sem provas, formulário externo, 3 dias', {pagamento:true,venda:true,formExterno:true,pressao:true,desconto:true},3,'http:','nao'],
];
let ok=0;for(const [n,s,d,pr,esp] of casos){const r=T.pontuarConfianca(s,d,pr,0,!!(s&&s.__gratuito));const passa=r.confianca>=T.limiteConfianca('alto');const bom=(esp==='ok')===passa;ok+=bom;
 console.log((bom?'OK  ':'ERRO'),n.padEnd(52),String(r.confianca).padStart(3),passa?'passa (90+)':'NÃO passa');}
console.log(ok+'/'+casos.length+' como esperado');
