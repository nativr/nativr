# Public API

```ts
import { createR, NA, isNA } from "nativr";

const r = await createR(); // Worker by default
await r.assign("x", new Float64Array([1, 2, 3, 4]));
const detail = await r.evalDetailed("mean(x)");
await r.dispose();
```

Sessions expose `eval`, `evalDetailed`, `evalRaw`, `assign`, `get`, `call`, `capabilities`, `reset`,
`interrupt`, and `dispose`. Operations mutate one session in submission order.

`eval` unwraps length-one atomic vectors and returns arrays for longer vectors. `NULL` becomes
`null`; R missing values become the canonical exported `NA` marker; ordinary NaN remains JavaScript
`NaN`. `evalRaw` returns versioned typed-array snapshots with explicit missing masks.

Inputs include scalar numbers, booleans, strings, null, homogeneous arrays, supported TypedArrays,
and `NA` inside arrays. `assign(..., { transfer: true })` may detach a transferable Worker input;
the default copies. Unsupported objects are rejected.

Worker timeout or interrupt terminates and recreates the Worker because a synchronous Worker cannot
process a message cooperatively. The thrown error reports `runtimeReset: true`; prior user bindings
are lost. Inline interrupt is cooperative at evaluator checkpoints.
