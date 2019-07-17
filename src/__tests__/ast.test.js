// @flow

import { parseFile } from "../ast";
import { benchAsync } from "./bench";
import generate from "@babel/generator";
import path from "path";

const fixture = path.join(__dirname, "./magic.js");

test("should parse file", async () => {
  const ast = await parseFile(fixture);
  expect(ast).toMatchSnapshot();
  expect(generate(ast).code).toMatchSnapshot();
}, 100000);

// test("time", async () => {
//   expect(await benchAsync(() => parseFile(fixture))).toMatchSnapshot();
// }, 100000);
