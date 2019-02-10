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

function convertType(type: string, plugins: string[]): string {
  if (type === "any (explicit)") return "any";
  if (type === "any (implicit)") return "any";
  if (type.startsWith("class ")) {
    const ast = template.ast(`${type} {}`, {
      plugins
    });
    return `typeof ${ast.id.name}`;
  }
  return type;
}

export function parseFileSync(
  filename: string,
  {
    sourceType = "module",
    plugins = plugins,
    ...options
  }: { [key: string]: any } = { sourceType: "module", plugins }
) {
  const code = fs.readFileSync(filename, { encoding: "utf8" });
  const ast = parser.parse(code, {
    ...options,
    plugins,
    sourceType
  });

  if (flowVersion === null) {
    throw new Error("flow-bin must be installed");
  }

  function assignType(path) {
    const symbol = getTypeAtPosSync(path.node.loc.start, filename);
    const type = convertType(symbol.type, plugins);
    //console.log(symbol.type);
    if (type !== "(unknown)") {
      try {
        symbol.type = template.ast(`type S = ${type}`, {
          plugins
        }).right;
        path.node.symbol = symbol;
      } catch (err) {
        console.error("Error on ", path.node.loc.start, path.node);
        console.error(err);
      }
    }
  }

  traverse(ast, {
    enter(path) {
      assignType(path);
    }
  });

  return ast;
}

export async function parseFile(
  filename: string,
  {
    sourceType = "module",
    plugins = plugins,
    ...options
  }: { [key: string]: any } = { sourceType: "module", plugins }
) {
  const code = await fs.readFile(filename, { encoding: "utf8" });
  const ast = parser.parse(code, {
    ...options,
    sourceType,
    plugins
  });

  if (flowVersion === null) {
    throw new Error("flow-bin must be installed");
  }

  let promises = [];

  async function assignType(path) {
    const symbol = await getTypeAtPos(path.node.loc.start, filename);
    const type = convertType(symbol.type, plugins);
    //console.log(symbol);
    if (type !== "(unknown)") {
      try {
        symbol.type = template.ast(`type S = ${type}`, {
          plugins
        }).right;
        path.node.symbol = symbol;
      } catch (err) {
        console.error("Error on ", path.node.loc.start, path.node);
        console.error(err);
      }
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
