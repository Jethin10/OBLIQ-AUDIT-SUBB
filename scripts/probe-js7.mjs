import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
function hits(k){
  let idx=0, n=0;
  while(true){
    const i=js.indexOf(k, idx);
    if(i<0) break;
    n++;
    if(n<=6){
      console.log("=== "+k+" #"+n+" @"+i+" ===");
      console.log(js.slice(Math.max(0,i-500), i+500).replace(/\n/g," ").slice(0,1000));
      console.log();
    }
    idx=i+k.length;
  }
  console.log(k+": total "+n+"\n");
}
hits('".scroll"');
hits('".scroller"');
hits('".ac "');
hits('".ac ');
hits('"main"');
hits('.hi-fhdr');
hits('.hi-hdr');
hits('[data-sa]');
hits('[data-ia]');
hits('querySelector(".ac');
hits('namespace:"hm"');
hits('namespace: "hm"');
