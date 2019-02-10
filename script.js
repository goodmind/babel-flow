#!/usr/bin/env node
const { parseFile, parseFileSync } = require("./dist");
const path = require("path");

async function main() {
  const file = parseFileSync(path.join(process.cwd(), process.argv[2]));
  console.log(file.program);
}

main().catch(console.error);
