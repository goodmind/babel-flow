// @flow

import { parseFile } from "../ast";
import path from "path";

test("should parse file", async () => {
  const fixture = path.join(__dirname, "../../example/service.js");
  expect(await parseFile(fixture)).toMatchSnapshot();
}, 100000);
