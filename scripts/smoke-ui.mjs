const baseUrl = process.env.OBLIQ_BASE_URL || "http://localhost:3002";
const checks = [
  ["landing page", "/"],
  ["login page", "/login"],
  ["health API", "/api/health"],
  ["landing stylesheet", "/landing/wp-content/themes/ario/assets/css/app.css"],
  ["landing forms", "/landing/obliq-forms.js"],
];

let failures = 0;

for (const [label, path] of checks) {
  try {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
    if (response.status < 200 || response.status >= 400) {
      failures += 1;
      console.error(`FAIL ${label}: ${response.status} ${path}`);
    } else {
      console.log(`PASS ${label}: ${response.status} ${path}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`Smoke check failed: ${failures}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`Smoke check passed: ${checks.length}/${checks.length} checks passed.`);
