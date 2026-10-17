const defaultMaxFrontier = 1024;
const defaultMaxStates = 64 * 1024 * 1024;

/**
 * Recover the cross-stream order of one merged byte capture from the exact stdout and stderr bytes
 * of an independent capture of the same script. Every merged byte is assigned to the stream it came
 * from. The order is accepted only when exactly one assignment reproduces all three byte sequences;
 * an ambiguous or inconsistent capture yields no order rather than a chosen one.
 */
export function alignOrderedOutput(stdout, stderr, merged, options = {}) {
  const maxFrontier = options.maxFrontier ?? defaultMaxFrontier;
  const maxStates = options.maxStates ?? defaultMaxStates;
  for (const value of [stdout, stderr, merged]) {
    if (!(value instanceof Uint8Array)) throw new TypeError("Ordered output requires byte data.");
  }
  const n = stdout.byteLength;
  const m = stderr.byteLength;
  const length = merged.byteLength;
  if (length !== n + m) return { status: "inconsistent", reason: "merged-length-differs" };
  if (m === 0 || n === 0) {
    const only = m === 0 ? stdout : stderr;
    if (!bytesEqual(only, merged)) return { status: "inconsistent", reason: "merged-bytes-differ" };
    const stream = m === 0 ? "stdout" : "stderr";
    return decodeRuns(
      stdout,
      stderr,
      length === 0 ? [] : [{ stream, start: 0, end: length }],
      merged,
    );
  }
  // Frontier k holds every stdout offset i (stderr offset k - i) whose prefixes interleave to the
  // first k merged bytes, with the number of distinct assignments capped at two.
  const offsets = new Int32Array(length + 2);
  let pool = new Int32Array(Math.min(maxStates, Math.max(1024, 2 * (length + 1))));
  let stored = 0;
  const store = (value) => {
    if (stored === pool.length) {
      if (pool.length >= maxStates) return false;
      const grown = new Int32Array(Math.min(maxStates, pool.length * 2));
      grown.set(pool);
      pool = grown;
    }
    pool[stored] = value;
    stored += 1;
    return true;
  };
  let frontier = new Map([[0, 1]]);
  for (let k = 0; ; k += 1) {
    offsets[k] = stored;
    const sorted = [...frontier.keys()].sort((left, right) => left - right);
    for (const i of sorted) {
      if (!store(i)) return { status: "unbounded", reason: "alignment-state-limit" };
    }
    if (k === length) break;
    const byte = merged[k];
    const next = new Map();
    for (const i of sorted) {
      const count = frontier.get(i);
      const j = k - i;
      if (i < n && stdout[i] === byte) next.set(i + 1, Math.min(2, (next.get(i + 1) ?? 0) + count));
      if (j < m && stderr[j] === byte) next.set(i, Math.min(2, (next.get(i) ?? 0) + count));
    }
    if (next.size === 0) return { status: "inconsistent", reason: "merged-bytes-differ" };
    if (next.size > maxFrontier) return { status: "unbounded", reason: "alignment-frontier-limit" };
    frontier = next;
  }
  offsets[length + 1] = stored;
  const total = frontier.get(n);
  if (total === undefined) return { status: "inconsistent", reason: "merged-bytes-differ" };
  if (total > 1) return { status: "ambiguous", reason: "multiple-interleavings" };
  const contains = (k, i) => {
    let low = offsets[k];
    let high = offsets[k + 1] - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (pool[middle] === i) return true;
      if (pool[middle] < i) low = middle + 1;
      else high = middle - 1;
    }
    return false;
  };
  // A unique complete assignment has exactly one reachable predecessor at every step.
  const fromStdout = new Uint8Array(length);
  let i = n;
  for (let k = length; k > 0; k -= 1) {
    const byte = merged[k - 1];
    if (i > 0 && stdout[i - 1] === byte && contains(k - 1, i - 1)) {
      fromStdout[k - 1] = 1;
      i -= 1;
    } else if (k - 1 - i >= 0 && stderr[k - 1 - i] === byte && contains(k - 1, i)) {
      fromStdout[k - 1] = 0;
    } else {
      throw new Error("Ordered output alignment lost its unique path.");
    }
  }
  const runs = [];
  for (let k = 0; k < length; k += 1) {
    const stream = fromStdout[k] === 1 ? "stdout" : "stderr";
    const previous = runs[runs.length - 1];
    if (previous?.stream === stream) previous.end = k + 1;
    else runs.push({ stream, start: k, end: k + 1 });
  }
  return decodeRuns(stdout, stderr, runs, merged);
}

function decodeRuns(stdout, stderr, runs, merged) {
  // Decode exactly as the separate capture decodes each whole stream.
  const decode = (bytes) => Buffer.from(bytes).toString("utf8");
  const events = runs.map((run) => ({
    stream: run.stream,
    text: decode(merged.subarray(run.start, run.end)),
  }));
  // Stream text is decoded as a whole elsewhere. A run boundary inside a multibyte sequence would
  // decode differently, so such an order is not representable as exact text events.
  for (const [stream, bytes] of [
    ["stdout", stdout],
    ["stderr", stderr],
  ]) {
    const joined = events
      .filter((event) => event.stream === stream)
      .map((event) => event.text)
      .join("");
    if (joined !== decode(bytes)) {
      return { status: "undecodable", reason: "event-boundary-splits-encoded-text" };
    }
  }
  return { status: "complete", events };
}

function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
