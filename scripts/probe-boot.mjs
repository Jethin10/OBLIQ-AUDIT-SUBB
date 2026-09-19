import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
const tail = js.slice(220800, 221260).replace(/\n/g," ");
console.log(tail.slice(0,1200));
// find where first-run beforeEnter is fired on load: search "once(" "data-barba-namespace" "fh=" "fh =" " let fh" etc
for(const k of ["fh=", "fh =", "dh()", "mh()", "function mh", "const mh", "function dh", "const dh", "namespace", "current:", "next:"]){
  let idx=0, n=0;
  while(true){
    const i=js.indexOf(k, idx);
    if(i<0) break;
    n++;
    if(n<=3) console.log("\n=== "+k+" #"+n+" @"+i+" ===\n"+js.slice(Math.max(0,i-350), i+350).replace(/\n/g," ").slice(0,700));
    idx=i+k.length;
    if(n>=6) break;
  }
  if(!n) console.log(k+" NOT FOUND");
}
