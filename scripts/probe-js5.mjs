import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
// Find ScrollSmoother instantiation: look for .create( near smoother, or "smooth:" etc
const idxs = [];
let idx = 0;
while(true){
  const i = js.indexOf("Smoother", idx);
  if(i<0) break;
  idxs.push(i);
  idx = i+7;
}
console.log("Smoother occurrences:", idxs.length);
for(const i of idxs){
  console.log("=== @"+i+" ===");
  console.log(js.slice(Math.max(0,i-1200), i+1200).replace(/\n/g," ").slice(0,2400));
  console.log();
}
// Also look for create({ with wrapper/content keys nearby
const re = /wrapper[\s\S]{0,40}content|content[\s\S]{0,40}wrapper/g;
let m; let n=0;
while((m=re.exec(js)) && n<10){
  n++;
  console.log("WRAP/CONTENT "+n+" @"+m.index+": "+js.slice(Math.max(0,m.index-600), m.index+600).replace(/\n/g," ").slice(0,1200));
  console.log();
}
// Look for main init function calls: search "create(" occurrences with smooth context
const re2 = /\.create\(/g;
let m2; let n2=0;
const hits=[];
while((m2=re2.exec(js)) && n2<40){
  n2++;
  hits.push(m2.index);
}
console.log("create( count", hits.length);
for(const h of hits.slice(0,20)){
  const ctx = js.slice(Math.max(0,h-400), h+600).replace(/\n/g," ").slice(0,1000);
  if(/smooth|Scroll|scroller|wrapper|content|trigger/i.test(ctx)){
    console.log("--- create @"+h+": "+ctx);
  }
}
