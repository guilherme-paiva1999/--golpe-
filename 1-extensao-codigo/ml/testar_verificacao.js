// Testa a lógica da verificação completa da tela de bloqueio (cada prova ruim diminui a confiança)
// e a mensagem para a pessoa de confiança. Não mede acerto em golpes reais.
const fs=require('fs'),vm=require('vm'),path=require('path');
const noop=()=>{},ev={addListener:noop};
const chrome={runtime:{onInstalled:ev,onStartup:ev,onMessage:ev,id:'x',getPlatformInfo:noop},alarms:{get:async()=>({}),create:noop,onAlarm:ev},webNavigation:{onBeforeNavigate:ev},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{}}},action:{}};
const ctx={chrome,console,AbortSignal,URL,TextDecoder,fetch:async()=>{throw 0}};ctx.self=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8')+';this.T={confiancaDaVerificacao}',ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../pessoa.js'),'utf8'),ctx);
const T=ctx.T,P=ctx.EGolpePessoa;
let ok=0,n=0;const t=(nome,v,e)=>{n++;const b=JSON.stringify(v)===JSON.stringify(e);ok+=b;console.log((b?'OK  ':'ERRO'),nome.padEnd(62),JSON.stringify(v));};
const conf=(base,prova)=>T.confiancaDaVerificacao({confianca:base},Object.assign({protocolo:'https:'},prova)).confianca;

t('site novo (5 dias) tira 40 + sem empresa',conf(30,{dias:5}),0);
t('idade desconhecida tira 10',conf(30,{dias:null}),20);
t('site antigo (4 anos) soma 20',conf(30,{dias:1500}),50);
t('sem cadeado tira 10',conf(30,{dias:1500,protocolo:'http:'}),40);
t('CNPJ inexistente tira 25',conf(30,{dias:1500,empresa:{existe:false}}),25);
t('CNPJ baixado tira 25',conf(30,{dias:1500,empresa:{existe:true,ativa:false,situacao:'BAIXADA'}}),25);
t('empresa ativa antiga soma 10 (+5 por 5 anos ou mais)',conf(30,{dias:1500,empresa:{existe:true,ativa:true,abertura:'2010-01-01',razao:'X'}}),65);
t('pessoa física tira 5',conf(30,{dias:1500,pf:true}),45);
t('RA "Não recomendado" tira 40',conf(30,{dias:1500,ra:{nota:'nao_recomendado'}}),10);
t('consumidor.gov.br ruim (resolve 20%, nota 1,5) tira 10',conf(30,{dias:1500,consumidor:{periodo:'x',dados:['Ruim',500,70,20,1.5]}}),40);
t('em lista de golpe: confiança zero, mesmo com provas boas',conf(30,{lista:'phishing',dias:4000,empresa:{existe:true,ativa:true,abertura:'2000-01-01'}}),0);
t('Procon-SP não zera (é reclamação, não golpe confirmado)',conf(30,{lista:'procon',dias:1500}),50);
t('hospedagem gratuita tira 15',conf(30,{gratuito:true}),15);
t('nunca passa de 100 nem fica abaixo de 0',[conf(95,{dias:4000,empresa:{existe:true,ativa:true,abertura:'2000-01-01'}}),conf(5,{dias:3})],[100,0]);
const r=T.confiancaDaVerificacao({confianca:30},{protocolo:'https:',dias:5,ml:{p:0.97,pontos:25}});
t('itens: lista, idade, cadeado, empresa, reclamações, RA, IA',r.itens.map(i=>i.titulo).length,7);
t('IA aparece como "contra" quando o nome parece golpe',r.itens.find(i=>i.titulo==='Inteligência artificial').efeito,'contra');

t('telefone com DDD vira 55+DDD',P.telefone('(11) 98765-4321'),'5511987654321');
t('telefone fixo com DDD',P.telefone('11 3333-4444'),'551133334444');
t('telefone já com +55',P.telefone('+55 21 99999-8888'),'5521999998888');
t('telefone sem DDD é recusado',P.telefone('98765-4321'),'');
t('12 dígitos sem 55 é recusado',P.telefone('119187654321'),'');
t('e-mail válido',P.emailValido('maria@email.com'),true);
t('e-mail inválido',P.emailValido('maria@'),false);
const msg=P.mensagem('Maria da Silva','https://golpe.xyz/pix');
t('mensagem cita o primeiro nome e o link',[msg.startsWith('Oi, Maria!'),msg.includes('https://golpe.xyz/pix'),msg.includes('golpe?')],[true,true,true]);
t('link do WhatsApp',P.linkWhats({telefone:'11987654321'},'oi').startsWith('https://wa.me/5511987654321?text=oi'),true);
t('sem telefone, sem link do WhatsApp',P.linkWhats({telefone:''},'oi'),'');
t('pessoa válida precisa de nome e (WhatsApp ou e-mail)',[P.valida({nome:'Ana',telefone:'11987654321'}),P.valida({nome:'Ana',email:'a@b.com'}),P.valida({nome:'',telefone:'11987654321'}),P.valida({nome:'Ana'})],[true,true,false,false]);
console.log(ok+'/'+n+' como esperado');
