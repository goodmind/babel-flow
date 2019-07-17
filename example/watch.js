// @flow

import { createEvent } from "effector";

const target = {
  watch(fn) {}
};

const wow = createEvent();
const event = createEvent();

target.watch(() => {});

event.watch(() => {
  wow();
});
