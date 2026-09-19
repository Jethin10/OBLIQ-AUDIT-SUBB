import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
// find ScrollSmoother wrapper/content selectors
for (const k of ["#smooth-wrapper", "#smooth-content", "smooth-wrapper", "smooth-content", ".ScrollSmoother", "create(", "wrapper:", "content:", "data-barba=\"container\"", "data-barba", "'container'", "\"container\""]) {
  const i = js.indexOf(k);
  if (i<0) { console.log(k+" NOT FOUND"); continue; }
  console.log("=== "+k+" @"+i+" ===");
  console.log(js.slice(Math.max(0,i-700), i+700).replace(/\n/g," ").slice(0,1400));
  console.log();
}
