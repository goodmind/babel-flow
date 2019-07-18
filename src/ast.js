// @flow

import execa from "execa";
import fs from "fs-extra";
import * as t from "@babel/types";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import template from "@babel/template";
import flow from "flow-bin";

async function getTypeAtPos(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const args = [
    "type-at-pos",
    "--expand-type-aliases",
    "--json",
    filename,
    line,
    column + 1
  ];
  const result = await execa(flow, args);
  return JSON.parse(result.stdout);
}

function getTypeAtPosSync(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const args = [
    "type-at-pos",
    "--expand-type-aliases",
    "--json",
    filename,
    line,
    column + 1
  ];
  return JSON.parse(execa.sync(flow, args).stdout);
}

async function getTypeAtPosExpanded(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const args = [
    "type-at-pos",
    "--expand-type-aliases",
    "--expand-json-output",
    filename,
    line,
    column + 1
  ];
  const result = await execa(flow, args);
  return JSON.parse(result.stdout);
}

function getTypeAtPosExpandedSync(
  { line = 0, column = 0 } = { line: 0, column: 0 },
  filename: string
) {
  const args = [
    "type-at-pos",
    "--expand-type-aliases",
    "--expand-json-output",
    filename,
    line,
    column + 1
  ];
  return JSON.parse(execa.sync(flow, args).stdout);
}

async function dumpTypes(filename: string) {
  const args = ["dump-types", "--json", filename];
  const result = await execa(flow, args);
  return JSON.parse(result.stdout);
}

const defaultPlugins = ["flow", "flowComments"];

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

function fixSymbol(symbol: any) {
  delete symbol.path;
  delete symbol.loc.source;
}

function skip(path, callback) {
  if (t.isProgram(path.node)) return;
  if (t.isImportDeclaration(path.node)) return;
  if (t.isImportSpecifier(path.node)) return;
  if (t.isTypeAlias(path.node)) return;
  if (t.isTypeAlias(path.parent)) return;
  if (t.isGenericTypeAnnotation(path.parent)) return;
  if (t.isGenericTypeAnnotation(path.node)) return;
  if (t.isNewExpression(path.node)) return;
  if (t.isUnaryExpression(path.node)) return;
  if (t.isTypeParameterDeclaration(path.node)) return;
  if (t.isArrowFunctionExpression(path.node)) return;
  if (t.isVariableDeclaration(path.node)) return;
  if (t.isExportNamedDeclaration(path.node)) return;

  // Skip literals
  if (t.isLiteral(path.node)) return;

  // Skip statements
  if (t.isStatement(path.node)) return;

  // Skip all type annotations
  if (t.isTypeAnnotation(path.node)) return;
  if (t.isAnyTypeAnnotation(path.node)) return;
  if (t.isMixedTypeAnnotation(path.node)) return;
  if (t.isBooleanLiteralTypeAnnotation(path.node)) return;
  if (t.isStringTypeAnnotation(path.node)) return;
  if (t.isStringLiteralTypeAnnotation(path.node)) return;
  if (t.isNullLiteralTypeAnnotation(path.node)) return;
  if (t.isUnionTypeAnnotation(path.node)) return;
  if (t.isVoidTypeAnnotation(path.node)) return;

  callback();
}

export function parseFileSync(
  filename: string,
  {
    sourceType = "module",
    plugins = defaultPlugins,
    ...options
  }: { [key: string]: any } = { sourceType: "module", plugins: defaultPlugins }
) {
  const code = fs.readFileSync(filename, { encoding: "utf8" });
  const ast = parser.parse(code, {
    ...options,
    plugins,
    sourceType
  });

  function assignType(path) {
    const symbol = getTypeAtPosSync(path.node.loc.start, filename);
    const type = convertType(symbol.type, plugins);
    if (type !== "(unknown)") {
      //console.log(path.node.type, symbol.type, path.node);
      try {
        symbol.type = template.ast(`type S = ${type}`, {
          plugins
        }).right;
        path.node.symbol = symbol;
        if (t.isIdentifier(path.node)) {
          path.parent.symbol = symbol;
        }
      } catch (err) {
        console.error("Error on ", path.node.loc.start, path.node, path.parent);
        console.error(err);
      }
    }
  }

  traverse(ast, {
    enter(path) {
      skip(path, () => assignType(path));
    }
  });

  return ast;
}

export async function parseFile(
  filename: string,
  {
    sourceType = "module",
    plugins = defaultPlugins,
    ...options
  }: { [key: string]: any } = { sourceType: "module", plugins: defaultPlugins }
) {
  const code = await fs.readFile(filename, { encoding: "utf8" });
  const types: Map<number, Map<number, Map<number, any>>> = new Map();
  for (const type of await dumpTypes(filename)) {
    if (type.line !== type.endline) continue;
    if (!types.has(type.line)) types.set(type.line, new Map());
    if (!types.get(type.line).has(type.start - 1))
      types.get(type.line).set(type.start - 1, new Map());
    types
      .get(type.line)
      .get(type.start - 1)
      .set(type.end, type);
  }
  const ast = parser.parse(code, {
    ...options,
    sourceType,
    plugins
  });

  let promises = [];

  async function assignType(path) {
    const symbol = types
      .get(path.node.loc.start.line)
      .get(path.node.loc.start.column)
      .get(path.node.loc.end.column);
    if (!symbol) return;
    if (typeof symbol.type !== "string") return;
    const type = convertType(symbol.type, plugins);
    if (type !== "(unknown)") {
      try {
        symbol.type = template.ast(`type S = ${type}`, {
          plugins
        }).right;
        fixSymbol(symbol);
        path.node.symbol = symbol;
        // if (t.isIdentifier(path.node)) {
        //   path.parent.symbol = symbol;
        // }
      } catch (err) {
        console.error("Error on ", path.node.loc.start, path.node, path.parent);
        console.error(err);
      }
    }
  }

  traverse(ast, {
    Identifier(path) {
      promises.push(assignType(path));
    },
    enter(path, state) {
      skip(path, () => {
        promises.push(assignType(path));
      });
    }
  });

  await Promise.all(promises);

  return ast;
}
