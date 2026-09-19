import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
// Full hm namespace view
const i = js.indexOf('namespace:"hm"');
console.log(js.slice(Math.max(0,i-500), i+9000).replace(/\n/g," ").slice(0,9500));
console.log("\n\n=== PRELOADER refs ===");
let idx=0,n=0;
while(true){
  const j=js.indexOf("#prldr",idx);
  if(j<0)break;
  n++;
  if(n<=10) console.log("#prldr #"+n+" @"+j+": "+js.slice(Math.max(0,j-300),j+300).replace(/\n/g," ").slice(0,600));
  idx=j+6;
}
console.log("total #prldr:",n);
