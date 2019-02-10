//@flow

import {
  createEvent,
  type Effect,
  type Event,
  type Store,
  createStore,
  createEffect
} from "effector";

type Status = "pending" | "run" | "error" | "done";

export const onChange: Event<string> = createEvent("change");
export const onAdd: Event<string> = createEvent("add");
export const onUnlink: Event<string> = createEvent("unlink");

export const setOpts: Event<mixed> = createEvent("set options");
export const run: Effect<string, void> = createEffect("run module");

export const state: Store<Map<string, Status>> = createStore(new Map());

export const pending: Store<Set<string>> = state.map(
  (state, set: Set<string>) => {
    let changed = false;
    const keys = new Set();
    for (const [key, val] of state) {
      if (val !== "pending") {
        if (set.has(key)) {
          changed = true;
        }
        continue;
      }
      keys.add(key);
      if (!set.has(key)) {
        changed = true;
      }
    }
    if (!changed) return set;
    return keys;
  },
  new Set()
);

export const next: Store<string | null> = pending.map(pending => {
  if (pending.size === 0) return null;
  const [next] = [...pending];
  return next;
});

state
  .on(run, (state, path) => addItem(state, path, "run"))
  .on(run.fail, (state, { params: path }) => addItem(state, path, "error"))
  .on(run.done, (state, { params: path }) => addItem(state, path, "done"))
  .on(onAdd, (state, path) => addItem(state, path, "pending"))
  .on(onChange, (state, path) => addItem(state, path, "pending"))
  .on(onUnlink, (state, item) => deleteItem(state, item));

function deleteItem<K, V>(state: Map<K, V>, key: K): Map<K, V> {
  if (!state.has(key)) return state;
  const result = new Map(state);
  result.delete(key);
  return result;
}

function addItem<K, V>(state: Map<K, V>, key: K, item: V): Map<K, V> {
  if (state.get(key) === item) return state;
  const result = new Map(state);
  result.set(key, item);
  return result;
}
