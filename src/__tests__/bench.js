//@flow

import time from "pretty-hrtime";

export function bench(cb) {
  let from;
  let to;
  from = process.hrtime();
  cb();
  to = process.hrtime(from);
  return time(to, { verbose: true });
}

export async function benchAsync(cb) {
  let from;
  let to;
  from = process.hrtime();
  await cb();
  to = process.hrtime(from);
  return time(to, { verbose: true });
}
