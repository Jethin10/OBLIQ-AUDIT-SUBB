import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
function ctx(k, r=1000){
  let idx = 0, n=0;
  while(true){
    let i = js.indexOf(k, idx);
    if(i<0) break;
    console.log("=== "+k+" #"+(++n)+" @"+i+" ===");
    console.log(js.slice(Math.max(0,i-600), i+r).replace(/\n/g," ").slice(0,1800));
    console.log();
    idx = i + k.length;
    if(n>6) break;
  }
  if(!n) console.log(k+" NOT FOUND\n");
}
ctx("Smoother");
ctx("smoother");
ctx(".scroll");
ctx("function Vi");
ctx("Vi=");
ctx("const Vi");
ctx("Pu.create");
ctx("Ku(");
ctx(".ac ");
ctx("querySelector(\".ac");
ctx("querySelectorAll(\".ac");
ctx("hm-tm", 1500);
ctx("ttl-wr", 2000);
