const baseUrl = process.env.OBLIQ_BASE_URL || "http://localhost:3002";
const response = await fetch(baseUrl);
const html = await response.text();
const runtime = "/landing/wp-content/themes/ario/assets/js/app.js";
const failures = [];

if (!response.ok) failures.push("landing returned " + response.status);
if (!html.includes(runtime)) {
  failures.push("landing no longer ships the reference animation runtime");
}
if (!html.includes('id="prldr"') || !html.includes("crs-wr")) {
  failures.push("landing markup lost the preloader or cursor the runtime drives");
}

if (failures.length) {
  failures.forEach((failure) => console.error("FAIL " + failure));
  process.exit(1);
}

console.log("PASS landing ships the reference animation runtime with its preloader and cursor.");
