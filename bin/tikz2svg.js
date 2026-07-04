#!/usr/bin/env node
import { runCli } from "../src/cli/main.js";

runCli().then((exitCode) => {
  process.exitCode = exitCode;
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
