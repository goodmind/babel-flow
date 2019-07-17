// @flow

import { parseFile } from "../ast";
import { benchAsync } from "./bench";
import path from "path";

const fixture0 = path.join(__dirname, "../../example/service.js");
const fixture1 = path.join(__dirname, "../../example/watch.js");

test("should parse service file", async () => {
  expect(await parseFile(fixture0)).toMatchSnapshot();
}, 100000);

test("should parse watch file", async () => {
  expect(await parseFile(fixture1)).toMatchSnapshot();
}, 100000);

// test("time", async () => {
//   expect(await benchAsync(() => parseFile(fixture))).toMatchSnapshot();
// }, 1000000);
