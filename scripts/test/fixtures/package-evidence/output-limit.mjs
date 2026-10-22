import { writeFileSync } from "node:fs";

writeFileSync(process.argv[2], String(process.pid));
process.stdout.write("x".repeat(4096));
setInterval(() => {}, 1000);
