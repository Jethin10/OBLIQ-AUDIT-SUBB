// Polls the audit service health endpoint; exit 0 when ready, 1 on timeout.
const url = process.env.HEALTH_URL || "http://localhost:3000/api/health";
const maxSeconds = Number(process.env.HEALTH_TIMEOUT || 40);

const start = Date.now();
while (Date.now() - start < maxSeconds * 1000) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log("healthy");
      process.exit(0);
    }
  } catch {
    // server not up yet
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.error(`server not ready after ${maxSeconds}s`);
process.exit(1);
