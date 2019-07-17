// @flow

import { parseFile } from "../ast";
import { benchAsync } from "./bench";
import path from "path";

const fixture = path.join(__dirname, "../../example/service.js");

test("should parse file", async () => {
  expect(await parseFile(fixture)).toMatchSnapshot();
}, 100000);

// test("time", async () => {
//   expect(await benchAsync(() => parseFile(fixture))).toMatchSnapshot();
// }, 1000000);
