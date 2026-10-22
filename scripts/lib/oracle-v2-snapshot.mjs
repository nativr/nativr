/** Decode the tagged observer graph; original complex values must be represented by token lists. */
export function snapshotToPlain(snapshot) {
  if (snapshot.type === "null") return null;
  if (snapshot.type === "list" || snapshot.type === "pairlist") {
    const values = snapshot.values.map(snapshotToPlain);
    const names = snapshot.names;
    if (
      names !== undefined &&
      names.length === values.length &&
      names.every((name) => name.length > 0) &&
      new Set(names).size === names.length
    ) {
      return Object.fromEntries(names.map((name, index) => [name, values[index]]));
    }
    return values;
  }
  if (snapshot.type === "complex") {
    throw new Error("Oracle-v2 graph payload contains an untagged complex snapshot.");
  }
  if (snapshot.type === "formula") return { ...snapshot };
  if (snapshot.type === "symbol") return snapshot.name;
  if (snapshot.type === "language") return snapshot.source;
  if (snapshot.type === "expression") return [...snapshot.sources];
  const values = Array.from(snapshot.values, (value, index) => {
    if (snapshot.missing?.[index] === 1) return null;
    if (snapshot.type === "logical") return value === 1;
    return value;
  });
  return values.length === 1 ? values[0] : values;
}
