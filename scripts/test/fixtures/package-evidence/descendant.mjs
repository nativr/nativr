import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

writeFileSync(process.argv[2], String(process.pid));
spawn(process.execPath, [fileURLToPath(new URL("wait.mjs", import.meta.url)), process.argv[3]], {
  shell: false,
  windowsHide: true,
  stdio: "ignore",
}).on("error", () => {
  process.exitCode = 2;
});
setInterval(() => {}, 1000);
