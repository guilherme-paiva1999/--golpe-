// Paridade: o modelo em JavaScript (modelo.js) dá o mesmo resultado que o Python (recursos.py)?
// Antes: python3 gerar_paridade.py
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../modelo.js'),'utf8')+';this.T={carregarModelo,probGolpe}',ctx);
ctx.T.carregarModelo(JSON.parse(fs.readFileSync(path.join(__dirname,'modelo.json'),'utf8')));
const amostra=JSON.parse(fs.readFileSync(path.join(__dirname,'amostra_paridade.json'),'utf8'));
let ok=0;for(const {host,p} of amostra){const q=ctx.T.probGolpe(host);const b=Math.abs(q-p)<1e-9;ok+=b;
 console.log((b?'OK  ':'ERRO'),host.padEnd(40),'python',p.toFixed(4),'js',q.toFixed(4));}
console.log(ok+'/'+amostra.length+' iguais');
