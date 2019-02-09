// @flow

import execa from "execa";
import fs from "fs-extra";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import template from "@babel/template";

function flowBinVersion(): string | null {
  try {
    //$FlowFixMe
    const version = require("flow-bin/package.json").version;
    return version;
  } catch (e) {
    return null;
  }
}

const flowVersion = flowBinVersion();

async function getTypeAtPos(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const command = `npx flow type-at-pos --expand-type-aliases --json ${filename} ${line} ${column +
    1}`;
  const result = await execa.shell(command);
  return JSON.parse(result.stdout);
}

function getTypeAtPosSync(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const command = `npx flow type-at-pos --expand-type-aliases --json ${filename} ${line} ${column +
    1}`;
  return JSON.parse(execa.shellSync(command).stdout);
}

function getTypeAtPosExpandedSync(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const command = `npx flow type-at-pos --expand-type-aliases --expand-json-output ${filename} ${line} ${column +
    1}`;
  return JSON.parse(execa.shellSync(command).stdout);
}

const plugins = ["flow", "flowComments"];

export function parseFileSync(filename: string) {
  const code = fs.readFileSync(filename, { encoding: "utf8" });
  const ast = parser.parse(code, { plugins });

  if (flowVersion === null) {
    throw new Error("flow-bin must be installed");
  }

  function assignType(path) {
    const symbol = getTypeAtPosSync(path.node.loc.start, filename);
    if (symbol.type !== "(unknown)") {
      symbol.type = template.ast(`type S = ${symbol.type}`, {
        plugins
      }).right;
      path.node.symbol = symbol;
    }
  }

  traverse(ast, {
    enter(path) {
      assignType(path);
    }
  });

  return ast;
}

export async function parseFile(filename: string) {
  const code = await fs.readFile(filename, { encoding: "utf8" });
  const ast = parser.parse(code, { plugins });

  if (flowVersion === null) {
    throw new Error("flow-bin must be installed");
  }

  let promises = [];

  async function assignType(path) {
    const symbol = await getTypeAtPos(path.node.loc.start, filename);
    if (symbol.type !== "(unknown)") {
      symbol.type = template.ast(`type S = ${symbol.type}`, {
        plugins
      }).right;
      path.node.symbol = symbol;
    }
  }

  traverse(ast, {
    enter(path) {
      promises.push(assignType(path));
    }
  });

  await Promise.all(promises);

  return ast;
}
