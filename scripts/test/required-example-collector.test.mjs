import assert from "node:assert/strict";
import test from "node:test";
import {
  installCollector,
  isLocalBlobResponse,
} from "../../tests/e2e/helpers/required-example-profile.ts";

test("only successful same-origin Blob content is excluded from served HTTP assets", () => {
  const local = new URL("blob:http://127.0.0.1:4173/owned-preview");
  assert.equal(isLocalBlobResponse(local, 200), true);
  for (const [url, status] of [
    ["http://127.0.0.1:4173/favicon.ico", 200],
    ["http://127.0.0.1:4173/unknown.html", 200],
    ["blob:http://127.0.0.1:4173/owned-preview", 404],
    ["blob:http://127.0.0.1:4174/owned-preview", 200],
    ["blob:http://127.0.0.1:4173/owned-preview?changed=1", 200],
    ["blob:http://127.0.0.1:4173/owned-preview#changed", 200],
    ["data:text/html,owned", 200],
  ])
    assert.equal(isLocalBlobResponse(new URL(url), status), false);
});

// Deterministic owned DOM stand-in only: no browser launch, Playwright execution or runtime import.
function withCollector(run) {
  const keys = [
    "window",
    "document",
    "Element",
    "MutationObserver",
    "addEventListener",
    "innerWidth",
    "innerHeight",
  ];
  const saved = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const documentEvents = new Map();
  let loaded;
  let changed;
  const button = { id: "run", disabled: false };
  const status = { textContent: "Runtime ready" };
  const dot = { dataset: { state: "ready" } };
  const elapsed = { textContent: "0.0 ms" };
  const elements = new Map([
    ["run", button],
    ["runtime-status", status],
    ["status-dot", dot],
    ["elapsed", elapsed],
  ]);
  class OwnedElement {
    closest() {
      return button;
    }
  }
  const document = {
    visibilityState: "visible",
    getElementById: (id) => elements.get(id),
    addEventListener: (name, fn) => {
      documentEvents.set(name, fn);
    },
  };
  Object.assign(globalThis, {
    window: {},
    document,
    Element: OwnedElement,
    MutationObserver: class {
      constructor(fn) {
        changed = fn;
      }
      observe() {}
    },
    addEventListener: (name, fn) => {
      assert.equal(name, "DOMContentLoaded");
      loaded = fn;
    },
    innerWidth: 1280,
    innerHeight: 720,
  });
  try {
    installCollector({ expectedIds: ["required-001:1", "required-002:1"] });
    loaded();
    const collector = globalThis.window.__nativrRequiredExampleProfile;
    const click = () => documentEvents.get("click")({ target: new OwnedElement() });
    const batch = (oldValues, disabled, state, text = "0.0 ms") => {
      button.disabled = disabled;
      dot.dataset.state = state;
      elapsed.textContent = text;
      changed(oldValues.map((oldValue) => ({ oldValue })));
    };
    const hideAndShow = () => {
      document.visibilityState = "hidden";
      documentEvents.get("visibilitychange")();
      document.visibilityState = "visible";
      documentEvents.get("visibilitychange")();
    };
    run({ collector, click, batch, hideAndShow });
  } finally {
    for (const key of keys) {
      const previous = saved.get(key);
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    }
  }
}

test("collector observes two separate generations with identical results and elapsed text", () =>
  withCollector(({ collector, click, batch }) => {
    for (const id of ["required-001:1", "required-002:1"]) {
      collector.arm(id);
      click();
      batch([null], true, "running", "—");
      batch([""], false, "ready");
    }
    const state = collector.snapshot();
    assert.deepEqual(state.issues, []);
    assert.equal(state.pending, false);
    assert.equal(state.readyObserved, true);
    assert.deepEqual(
      state.rows.map((row) => [
        row.activationCount,
        row.busyCount,
        row.completionCount,
        row.displayedEvaluatorElapsedMs,
      ]),
      [
        [1, 1, 1, 0],
        [1, 1, 1, 0],
      ],
    );
  }));

test("duplicate same-state writes do not fabricate extra busy/completion events", () =>
  withCollector(({ collector, click, batch }) => {
    collector.arm("required-001:1");
    click();
    batch([null, "", ""], true, "running", "—");
    batch(["", ""], true, "running", "—");
    batch(["", null, null], false, "ready");
    batch([null, null], false, "ready");
    const state = collector.snapshot();
    assert.deepEqual(state.issues, []);
    assert.equal(state.rows[0].busyCount, 1);
    assert.equal(state.rows[0].completionCount, 1);
  }));

test("collapsed busy and completion are rejected without invented timestamps", () =>
  withCollector(({ collector, click, batch }) => {
    collector.arm("required-001:1");
    click();
    batch([null, ""], false, "ready");
    const state = collector.snapshot();
    assert.deepEqual(state.issues, ["batched-transition"]);
    assert.equal(state.rows[0].busyObservedAtMs, null);
    assert.equal(state.rows[0].settledObservedAtMs, null);
    assert.equal(state.pending, true);
  }));

test("overlapping arming, duplicate click and unarmed click are explicit failures", () =>
  withCollector(({ collector, click, batch }) => {
    click();
    collector.arm("required-001:1");
    click();
    click();
    assert.throws(() => collector.arm("required-002:1"), /PROFILE_ARM/);
    batch([null], true, "running");
    assert.deepEqual(collector.snapshot().issues, [
      "unarmed-activation",
      "duplicate-activation",
      "overlap",
      "unexpected-transition",
    ]);
  }));

test("temporary hidden intervals remain marked even when visible at both endpoints", () =>
  withCollector(({ collector, click, batch, hideAndShow }) => {
    collector.arm("required-001:1");
    click();
    batch([null], true, "running");
    hideAndShow();
    batch([""], false, "ready");
    assert.equal(collector.snapshot().rows[0].visible, false);
  }));

test("error completion records no stale elapsed value", () =>
  withCollector(({ collector, click, batch }) => {
    collector.arm("required-001:1");
    click();
    batch([null], true, "running");
    batch([""], false, "error", "999.0 ms");
    const row = collector.snapshot().rows[0];
    assert.equal(row.terminal, "error");
    assert.equal(row.displayedEvaluatorElapsedMs, null);
  }));
