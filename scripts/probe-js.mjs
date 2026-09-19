import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
function ctx(k, r=600){
  let i = js.indexOf(k);
  if(i<0){ console.log(k+" NOT FOUND"); return; }
  console.log("=== "+k+" ===");
  console.log(js.slice(Math.max(0,i-800), i+r));
  console.log();
}
ctx("Vi()", 400);
ctx(".scroll", 1200);
ctx(".ac .crs", 2000);
ctx(".ac .prct-cb", 2000);
ctx(".ac #hm-abt", 800);
ctx("ScrollSmoother", 800);
ctx("normalizeScroll", 400);
ctx("data-barba", 800);
