import {
  REvaluationError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  dataFrameRowCount,
  doubleVector,
  factorLevels,
  integerVector,
  isAtomic,
  isDataFrame,
  isFactor,
  isMissing,
  listValue,
  logicalVector,
  objectClasses,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RDoubleVector,
  RIntegerVector,
  RList,
  RValue,
  RVector,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";
import { nextRandom, randomState } from "./random.js";

export interface ClusteringBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "numeric" | "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals?: BuiltinDefinition["formals"];
}

const CLUSTERING_SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

const missingFormal = (name: string) => ({ name, span: CLUSTERING_SPAN });
const stringFormal = (name: string, value: string) => ({
  name,
  defaultValue: { kind: "StringLiteral" as const, value, span: CLUSTERING_SPAN },
  span: CLUSTERING_SPAN,
});
const logicalFormal = (name: string, value: boolean) => ({
  name,
  defaultValue: { kind: "LogicalLiteral" as const, value, span: CLUSTERING_SPAN },
  span: CLUSTERING_SPAN,
});
const numericFormal = (name: string, value: number) => ({
  name,
  defaultValue: { kind: "NumericLiteral" as const, value, span: CLUSTERING_SPAN },
  span: CLUSTERING_SPAN,
});
const nullFormal = (name: string) => ({
  name,
  defaultValue: { kind: "NullLiteral" as const, span: CLUSTERING_SPAN },
  span: CLUSTERING_SPAN,
});

export const CLUSTERING_BUILTIN_SPECS: readonly ClusteringBuiltinSpec[] = [
  {
    name: "dist",
    parameters: ["x", "method", "diag", "upper", "p"],
    compatibility: "behavioral",
    implementation: builtinDist,
    formals: [
      missingFormal("x"),
      stringFormal("method", "euclidean"),
      logicalFormal("diag", false),
      logicalFormal("upper", false),
      numericFormal("p", 2),
    ],
  },
  {
    name: "as.dist",
    parameters: ["m", "diag", "upper"],
    compatibility: "behavioral",
    implementation: builtinAsDist,
    formals: [missingFormal("m"), logicalFormal("diag", false), logicalFormal("upper", false)],
  },
  {
    name: "as.dist.default",
    parameters: ["m", "diag", "upper"],
    compatibility: "behavioral",
    implementation: builtinAsDist,
    formals: [missingFormal("m"), logicalFormal("diag", false), logicalFormal("upper", false)],
  },
  {
    name: "as.matrix.dist",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: builtinAsMatrixDist,
    formals: [missingFormal("x"), missingFormal("...")],
  },
  {
    name: "hclust",
    parameters: ["d", "method", "members"],
    compatibility: "behavioral",
    implementation: builtinHclust,
    formals: [missingFormal("d"), stringFormal("method", "complete"), nullFormal("members")],
  },
  {
    name: "cutree",
    parameters: ["tree", "k", "h"],
    compatibility: "behavioral",
    implementation: builtinCutree,
    formals: [missingFormal("tree"), nullFormal("k"), nullFormal("h")],
  },
  {
    name: "as.dendrogram",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinAsDendrogram,
    formals: [missingFormal("object"), missingFormal("...")],
  },
  {
    name: "as.dendrogram.hclust",
    parameters: ["object", "hang", "check", "..."],
    compatibility: "behavioral",
    implementation: builtinAsDendrogram,
    formals: [
      missingFormal("object"),
      numericFormal("hang", -1),
      logicalFormal("check", true),
      missingFormal("..."),
    ],
  },
  {
    name: "order.dendrogram",
    parameters: ["x"],
    compatibility: "behavioral",
    implementation: builtinOrderDendrogram,
    formals: [missingFormal("x")],
  },
  {
    name: "kmeans",
    parameters: ["x", "centers", "iter.max", "nstart", "algorithm", "trace"],
    compatibility: "numeric",
    implementation: builtinKmeans,
  },
];

type DistanceMethod = "euclidean" | "maximum" | "manhattan" | "canberra" | "binary" | "minkowski";
type HclustMethod =
  "ward.D" | "ward.D2" | "single" | "complete" | "average" | "mcquitty" | "median" | "centroid";

interface HierarchicalCluster {
  readonly reference: number;
  readonly size: number;
  readonly height: number;
  readonly minimumLeaf: number;
}

async function builtinDist(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "method", "diag", "upper", "p"]);
  const xArgument = matched.get("x");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in dist().");
  }
  const x = numericMatrix(await invocation.force(xArgument.promise), "x", invocation);
  validateFiniteMatrix(x, "x");
  const method = await clusteringChoice<DistanceMethod>(
    invocation,
    matched.get("method"),
    ["euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski"],
    "euclidean",
    "method",
  );
  const diagonal = await clusteringFlag(invocation, matched.get("diag"), false, "diag");
  const upper = await clusteringFlag(invocation, matched.get("upper"), false, "upper");
  const p = await clusteringPositiveNumber(invocation, matched.get("p"), 2, "p");
  const length = (x.rows * Math.max(0, x.rows - 1)) / 2;
  invocation.context.allocate(length);
  const distances = new Float64Array(length);
  let outputIndex = 0;
  for (let left = 0; left < x.rows - 1; left += 1) {
    for (let right = left + 1; right < x.rows; right += 1) {
      invocation.context.checkpoint();
      distances[outputIndex++] = matrixRowDistance(x, left, right, method, p);
    }
  }
  let output: RVector = doubleVector(distances);
  output = withAttribute(output, "Size", integerVector([x.rows]));
  if (x.rowNames !== undefined)
    output = withAttribute(output, "Labels", characterVector(x.rowNames));
  output = withAttribute(output, "Diag", logicalVector([diagonal ? 1 : 0]));
  output = withAttribute(output, "Upper", logicalVector([upper ? 1 : 0]));
  output = withAttribute(output, "method", characterVector([method]));
  const call = invocation.currentCall();
  if (call.type !== "null") output = withAttribute(output, "call", call);
  return withClasses(output, ["dist"]);
}

async function builtinAsDist(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["m", "diag", "upper"]);
  const matrixArgument = matched.get("m");
  if (matrixArgument === undefined || matrixArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'm' is missing in as.dist().");
  }
  const input = await invocation.force(matrixArgument.promise);
  const diagonal = await clusteringFlag(invocation, matched.get("diag"), false, "diag");
  const upper = await clusteringFlag(invocation, matched.get("upper"), false, "upper");
  if (objectClasses(input)?.includes("dist") === true && isAtomic(input)) {
    let output: RVector = input;
    output = withAttribute(output, "Diag", logicalVector([diagonal ? 1 : 0]));
    output = withAttribute(output, "Upper", logicalVector([upper ? 1 : 0]));
    return output;
  }
  if (!isAtomic(input) || input.type === "complex" || input.type === "raw") {
    throw new RTypeMismatchError("NRT3269", "as.dist() requires a real square matrix.");
  }
  const dimensions = vectorDimensions(input);
  if (dimensions?.length !== 2 || dimensions[0] !== dimensions[1]) {
    throw new RTypeMismatchError("NRT3269", "as.dist() requires a real square matrix.");
  }
  const size = dimensions[0] ?? 0;
  const length = (size * Math.max(0, size - 1)) / 2;
  invocation.context.allocate(length);
  const values = new Float64Array(length);
  const missing = new Uint8Array(length);
  let outputIndex = 0;
  for (let column = 0; column < size - 1; column += 1) {
    for (let row = column + 1; row < size; row += 1) {
      const inputIndex = row + column * size;
      if (isMissing(input, inputIndex) || Number.isNaN(Number(input.values[inputIndex]))) {
        missing[outputIndex] = 1;
      } else {
        values[outputIndex] = Number(input.values[inputIndex] ?? 0);
      }
      outputIndex += 1;
    }
  }
  let output: RVector = doubleVector(values, compactMissing(missing));
  const dimensionNames = matrixDimensionNames(input);
  if (dimensionNames.row !== undefined) {
    output = withAttribute(output, "Labels", characterVector(dimensionNames.row));
  }
  output = withAttribute(output, "Size", integerVector([size]));
  const call = invocation.currentCall();
  if (call.type !== "null") output = withAttribute(output, "call", call);
  output = withClasses(output, ["dist"]);
  output = withAttribute(output, "Diag", logicalVector([diagonal ? 1 : 0]));
  return withAttribute(output, "Upper", logicalVector([upper ? 1 : 0]));
}

async function builtinAsMatrixDist(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "..."]);
  const argument = matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in as.matrix.dist().");
  }
  const distance = await invocation.force(argument.promise);
  if (
    (distance.type !== "logical" && distance.type !== "integer" && distance.type !== "double") ||
    objectClasses(distance)?.includes("dist") !== true
  ) {
    throw new RTypeMismatchError("NRT3270", "as.matrix.dist() requires a dist object.");
  }
  const size = distanceObjectSize(distance);
  const expectedLength = (size * Math.max(0, size - 1)) / 2;
  if (size < 0 || distance.length !== expectedLength) {
    throw new RTypeMismatchError("NRT3270", "invalid 'dist' object");
  }
  invocation.context.allocate(size * size);
  const values = new Float64Array(size * size);
  const missing = new Uint8Array(size * size);
  let source = 0;
  for (let column = 0; column < size - 1; column += 1) {
    for (let row = column + 1; row < size; row += 1) {
      invocation.context.checkpoint();
      const lower = row + column * size;
      const upper = column + row * size;
      if (isMissing(distance, source)) {
        missing[lower] = 1;
        missing[upper] = 1;
      } else {
        const value = Number(distance.values[source] ?? 0);
        values[lower] = value;
        values[upper] = value;
      }
      source += 1;
    }
  }
  const suppliedLabels = distance.attributes.get("Labels");
  const labels =
    suppliedLabels?.type === "character" && suppliedLabels.length === size
      ? suppliedLabels
      : characterVector(Array.from({ length: size }, (_, index) => String(index + 1)));
  let output: RVector = withDimensions(doubleVector(values, compactMissing(missing)), [size, size]);
  output = withAttribute(output, "dimnames", listValue([labels, labels]));
  return output;
}

async function builtinHclust(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["d", "method", "members"]);
  const distanceArgument = matched.get("d");
  if (distanceArgument === undefined || distanceArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'd' is missing in hclust().");
  }
  const distance = await invocation.force(distanceArgument.promise);
  if (
    (distance.type !== "logical" && distance.type !== "integer" && distance.type !== "double") ||
    objectClasses(distance)?.includes("dist") !== true
  ) {
    throw new RTypeMismatchError("NRT3270", "dissimilarities of improper length");
  }
  const size = distanceObjectSize(distance);
  if (size < 2 || distance.length !== (size * (size - 1)) / 2) {
    throw new RTypeMismatchError("NRT3270", "dissimilarities of improper length");
  }
  const selected = await clusteringChoice<string>(
    invocation,
    matched.get("method"),
    [
      "complete",
      "ward",
      "ward.D",
      "ward.D2",
      "single",
      "average",
      "mcquitty",
      "median",
      "centroid",
    ],
    "complete",
    "method",
  );
  const method: HclustMethod = selected === "ward" ? "ward.D" : (selected as HclustMethod);
  if (selected === "ward") {
    invocation.context.warn({
      code: "NRW1103",
      message: 'The "ward" method has been renamed to "ward.D"; note new "ward.D2"',
    });
  }
  const memberSizes = await hclustMemberSizes(invocation, matched.get("members"), size);
  const distances = new Map<string, number>();
  let inputIndex = 0;
  for (let left = 0; left < size - 1; left += 1) {
    for (let right = left + 1; right < size; right += 1) {
      if (isMissing(distance, inputIndex)) {
        throw new RTypeMismatchError("NRT3270", "NA/NaN/Inf in foreign function call");
      }
      const value = Number(distance.values[inputIndex] ?? Number.NaN);
      if (!Number.isFinite(value)) {
        throw new RTypeMismatchError("NRT3270", "NA/NaN/Inf in foreign function call");
      }
      distances.set(clusterPairKey(-(left + 1), -(right + 1)), value);
      inputIndex += 1;
    }
  }
  const active: HierarchicalCluster[] = Array.from({ length: size }, (_, index) => ({
    reference: -(index + 1),
    size: memberSizes[index] ?? 1,
    height: 0,
    minimumLeaf: index + 1,
  }));
  const first = new Int32Array(size - 1);
  const second = new Int32Array(size - 1);
  const heights = new Float64Array(size - 1);
  invocation.context.allocate((size - 1) * 5 + distance.length);

  for (let mergeIndex = 0; mergeIndex < size - 1; mergeIndex += 1) {
    let selectedLeft = 0;
    let selectedRight = 1;
    let selectedDistance = Number.POSITIVE_INFINITY;
    for (let left = 0; left < active.length - 1; left += 1) {
      for (let right = left + 1; right < active.length; right += 1) {
        const candidate = distances.get(
          clusterPairKey(active[left]?.reference ?? 0, active[right]?.reference ?? 0),
        );
        if (candidate !== undefined && candidate < selectedDistance) {
          selectedDistance = candidate;
          selectedLeft = left;
          selectedRight = right;
        }
      }
    }
    const leftCluster = active[selectedLeft];
    const rightCluster = active[selectedRight];
    if (
      leftCluster === undefined ||
      rightCluster === undefined ||
      !Number.isFinite(selectedDistance)
    ) {
      throw new RTypeMismatchError("NRT3270", "invalid dissimilarities");
    }
    const [orderedLeft, orderedRight] = orderHclustChildren(leftCluster, rightCluster);
    first[mergeIndex] = orderedLeft.reference;
    second[mergeIndex] = orderedRight.reference;
    heights[mergeIndex] = selectedDistance;
    const merged: HierarchicalCluster = {
      reference: mergeIndex + 1,
      size: leftCluster.size + rightCluster.size,
      height: selectedDistance,
      minimumLeaf: Math.min(leftCluster.minimumLeaf, rightCluster.minimumLeaf),
    };
    for (const other of active) {
      if (other === leftCluster || other === rightCluster) continue;
      const leftDistance = distances.get(clusterPairKey(leftCluster.reference, other.reference));
      const rightDistance = distances.get(clusterPairKey(rightCluster.reference, other.reference));
      if (leftDistance === undefined || rightDistance === undefined) continue;
      distances.set(
        clusterPairKey(merged.reference, other.reference),
        updateHclustDistance(
          method,
          leftDistance,
          rightDistance,
          selectedDistance,
          leftCluster.size,
          rightCluster.size,
          other.size,
        ),
      );
    }
    for (const key of [...distances.keys()]) {
      if (
        clusterPairContains(key, leftCluster.reference) ||
        clusterPairContains(key, rightCluster.reference)
      ) {
        distances.delete(key);
      }
    }
    active.splice(selectedRight, 1);
    active.splice(selectedLeft, 1);
    active.push(merged);
  }

  const merge = withDimensions(integerVector([...first, ...second]), [size - 1, 2]);
  const order = integerVector(hclustLeafOrder(first, second));
  const labels = distance.attributes.get("Labels");
  const methodAttribute = distance.attributes.get("method");
  const call = invocation.currentCall();
  return withClasses(
    listValue(
      [
        merge,
        doubleVector(heights),
        order,
        labels?.type === "character" ? labels : R_NULL,
        characterVector([method]),
        call,
        methodAttribute?.type === "character" ? methodAttribute : R_NULL,
      ],
      ["merge", "height", "order", "labels", "method", "call", "dist.method"],
    ),
    ["hclust"],
  );
}

async function builtinAsDendrogram(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["object", "hang", "check", "..."]);
  const objectArgument = matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in as.dendrogram().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (objectClasses(object)?.includes("dendrogram") === true) return object;
  if (object.type !== "list" || objectClasses(object)?.includes("hclust") !== true) {
    throw new RTypeMismatchError("NRT3271", "invalid object for as.dendrogram");
  }
  const merge = namedListField(object, "merge");
  const heights = namedListField(object, "height");
  const labels = namedListField(object, "labels");
  if (merge?.type !== "integer" || heights?.type !== "double") {
    throw new RTypeMismatchError("NRT3271", "invalid hclust object");
  }
  const dimensions = vectorDimensions(merge);
  const rows = dimensions?.[0] ?? 0;
  if (dimensions?.length !== 2 || dimensions[1] !== 2 || heights.length !== rows) {
    throw new RTypeMismatchError("NRT3271", "invalid hclust object");
  }
  const build = (reference: number): RValue => {
    if (reference < 0) {
      const observation = -reference;
      let leaf: RVector = integerVector([observation]);
      leaf = withAttribute(leaf, "members", integerVector([1]));
      leaf = withAttribute(leaf, "height", doubleVector([0]));
      leaf = withAttribute(
        leaf,
        "label",
        labels?.type === "character"
          ? characterVector([labels.values[observation - 1] ?? String(observation)])
          : integerVector([observation]),
      );
      leaf = withAttribute(leaf, "leaf", logicalVector([1]));
      return withClasses(leaf, ["dendrogram"]);
    }
    const row = reference - 1;
    const left = build(merge.values[row] ?? 0);
    const right = build(merge.values[row + rows] ?? 0);
    const leftMembers = dendrogramMembers(left);
    const rightMembers = dendrogramMembers(right);
    const midpoint = (dendrogramMidpoint(left) + leftMembers + dendrogramMidpoint(right)) / 2;
    let branch: RVector = listValue([left, right]);
    branch = withAttribute(branch, "members", integerVector([leftMembers + rightMembers]));
    branch = withAttribute(branch, "midpoint", doubleVector([midpoint]));
    branch = withAttribute(branch, "height", doubleVector([heights.values[row] ?? 0]));
    return withClasses(branch, ["dendrogram"]);
  };
  return build(rows);
}

interface CutreeInput {
  readonly merge: RIntegerVector;
  readonly heights: RDoubleVector | RIntegerVector;
  readonly rows: number;
  readonly labels?: readonly string[];
}

async function builtinCutree(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["tree", "k", "h"]);
  const treeArgument = matched.get("tree");
  if (treeArgument === undefined || treeArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'tree' is missing in cutree().");
  }
  const tree = cutreeInput(await invocation.force(treeArgument.promise));
  const kArgument = matched.get("k");
  const kValue =
    kArgument === undefined || kArgument.promise.missing
      ? R_NULL
      : await invocation.force(kArgument.promise);
  if (kValue.type !== "null") {
    const counts = cutreeClusterCounts(kValue, tree.rows + 1, invocation);
    return cutreeOutput(
      tree,
      counts.map((count) => tree.rows + 1 - count),
      counts.map(String),
    );
  }

  const hArgument = matched.get("h");
  const hValue =
    hArgument === undefined || hArgument.promise.missing
      ? R_NULL
      : await invocation.force(hArgument.promise);
  if (hValue.type === "null") {
    throw new REvaluationError("NRE2258", "either 'k' or 'h' must be specified");
  }
  for (let index = 1; index < tree.heights.length; index += 1) {
    const previous = Number(tree.heights.values[index - 1] ?? Number.NaN);
    const current = Number(tree.heights.values[index] ?? Number.NaN);
    if (isMissing(tree.heights, index - 1) || isMissing(tree.heights, index)) {
      throw new RTypeMismatchError("NRT3273", "invalid 'height' component of 'tree'");
    }
    if (current < previous) {
      throw new REvaluationError(
        "NRE2258",
        "the 'height' component of 'tree' is not sorted (increasingly)",
      );
    }
  }
  const thresholds = cutreeHeights(hValue);
  return cutreeOutput(
    tree,
    thresholds.map((threshold) => {
      if (!Number.isFinite(threshold)) return 0;
      let merges = 0;
      while (
        merges < tree.rows &&
        Number(tree.heights.values[merges] ?? Number.POSITIVE_INFINITY) <= threshold
      ) {
        merges += 1;
      }
      return merges;
    }),
    thresholds.map(cutreeHeightLabel),
  );
}

function cutreeInput(value: RValue): CutreeInput {
  if (value.type !== "list" || objectClasses(value)?.includes("hclust") !== true) {
    throw new RTypeMismatchError("NRT3273", "invalid 'tree' ('merge' component)");
  }
  const merge = namedListField(value, "merge");
  const heights = namedListField(value, "height");
  const labels = namedListField(value, "labels");
  const dimensions = merge?.type === "integer" ? vectorDimensions(merge) : undefined;
  const rows = dimensions?.[0] ?? 0;
  if (
    merge?.type !== "integer" ||
    dimensions?.length !== 2 ||
    dimensions[1] !== 2 ||
    rows < 1 ||
    (heights?.type !== "double" && heights?.type !== "integer") ||
    heights.length !== rows
  ) {
    throw new RTypeMismatchError("NRT3273", "invalid 'tree' ('merge' component)");
  }
  const size = rows + 1;
  for (let row = 0; row < rows; row += 1) {
    for (const reference of [merge.values[row] ?? 0, merge.values[row + rows] ?? 0]) {
      if (
        reference === 0 ||
        (reference < 0 && -reference > size) ||
        (reference > 0 && reference > row)
      ) {
        throw new RTypeMismatchError("NRT3273", "invalid 'tree' ('merge' component)");
      }
    }
  }
  if (labels !== undefined && labels.type !== "null") {
    if (labels.type !== "character" || labels.length !== size) {
      throw new RTypeMismatchError("NRT3273", "invalid 'tree' ('labels' component)");
    }
    return { merge, heights, rows, labels: [...labels.values] };
  }
  return { merge, heights, rows };
}

function cutreeClusterCounts(
  value: RValue,
  size: number,
  invocation: BuiltinInvocation,
): readonly number[] {
  if (
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double" &&
    value.type !== "raw"
  ) {
    throw new RTypeMismatchError("NRT3273", "invalid 'k' argument");
  }
  if (value.length === 0) {
    invocation.context.warn({
      code: "NRW1104",
      message: "no non-missing arguments to min; returning Inf",
    });
    invocation.context.warn({
      code: "NRW1104",
      message: "no non-missing arguments to max; returning -Inf",
    });
    return [];
  }
  return Array.from({ length: value.length }, (_, index) => {
    if (isMissing(value, index)) {
      throw new RTypeMismatchError("NRT3273", "missing value where TRUE/FALSE needed");
    }
    const count = Math.trunc(Number(value.values[index] ?? Number.NaN));
    if (!Number.isFinite(count) || count < 1 || count > size) {
      throw new RTypeMismatchError("NRT3273", `elements of 'k' must be between 1 and ${size}`);
    }
    return count;
  });
}

function cutreeHeights(value: RValue): readonly number[] {
  if (
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double" &&
    value.type !== "raw"
  ) {
    throw new RTypeMismatchError("NRT3273", "invalid 'h' argument");
  }
  return Array.from({ length: value.length }, (_, index) => {
    if (isMissing(value, index)) {
      throw new RTypeMismatchError("NRT3273", "invalid 'h' argument");
    }
    const threshold = Number(value.values[index] ?? Number.NaN);
    if (Number.isNaN(threshold)) {
      throw new RTypeMismatchError("NRT3273", "invalid 'h' argument");
    }
    return threshold;
  });
}

function cutreeHeightLabel(value: number): string {
  if (value === Number.POSITIVE_INFINITY) return "Inf";
  if (value === Number.NEGATIVE_INFINITY) return "-Inf";
  return Object.is(value, -0) ? "0" : String(value);
}

function cutreeOutput(
  tree: CutreeInput,
  appliedMerges: readonly number[],
  columnLabels: readonly string[],
): RVector {
  const partitions = appliedMerges.map((count) => cutreePartition(tree, count));
  if (partitions.length === 1) {
    const partition = partitions[0] ?? new Int32Array();
    return tree.labels === undefined
      ? integerVector(partition)
      : withNames(integerVector(partition), tree.labels);
  }
  const size = tree.rows + 1;
  const values = new Int32Array(size * partitions.length);
  for (let column = 0; column < partitions.length; column += 1) {
    values.set(partitions[column] ?? new Int32Array(), column * size);
  }
  let output: RVector = withDimensions(integerVector(values), [size, partitions.length]);
  output = withAttribute(
    output,
    "dimnames",
    listValue([
      tree.labels === undefined ? R_NULL : characterVector(tree.labels),
      columnLabels.length === 0 ? R_NULL : characterVector(columnLabels),
    ]),
  );
  return output;
}

function cutreePartition(tree: CutreeInput, appliedMerges: number): Int32Array {
  const size = tree.rows + 1;
  const parent = Int32Array.from({ length: size }, (_, index) => index);
  const representative = new Int32Array(tree.rows);
  const find = (leaf: number): number => {
    let root = leaf;
    while ((parent[root] ?? root) !== root) root = parent[root] ?? root;
    let current = leaf;
    while ((parent[current] ?? current) !== root) {
      const next = parent[current] ?? current;
      parent[current] = root;
      current = next;
    }
    return root;
  };
  const resolve = (reference: number): number =>
    reference < 0 ? -reference - 1 : (representative[reference - 1] ?? 0);
  for (let row = 0; row < appliedMerges; row += 1) {
    const left = find(resolve(tree.merge.values[row] ?? 0));
    const right = find(resolve(tree.merge.values[row + tree.rows] ?? 0));
    const root = Math.min(left, right);
    parent[left] = root;
    parent[right] = root;
    representative[row] = root;
  }
  const groups = new Map<number, number>();
  const output = new Int32Array(size);
  for (let leaf = 0; leaf < size; leaf += 1) {
    const root = find(leaf);
    let group = groups.get(root);
    if (group === undefined) {
      group = groups.size + 1;
      groups.set(root, group);
    }
    output[leaf] = group;
  }
  return output;
}

async function builtinOrderDendrogram(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x"]);
  const xArgument = matched.get("x");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in order.dendrogram().");
  }
  const input = await invocation.force(xArgument.promise);
  if (objectClasses(input)?.includes("dendrogram") !== true) {
    throw new RTypeMismatchError("NRT3271", "'order.dendrogram' requires a dendrogram");
  }
  const leaves: number[] = [];
  collectDendrogramLeaves(input, leaves);
  return integerVector(leaves);
}

async function clusteringChoice<T extends string>(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  choices: readonly T[],
  fallback: T,
  name: string,
): Promise<T> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3272", `'${name}' must be one non-missing character value.`);
  }
  const supplied = value.values[0] ?? "";
  const exact = choices.find((choice) => choice === supplied);
  if (exact !== undefined) return exact;
  const matches = choices.filter((choice) => choice.startsWith(supplied));
  if (matches.length !== 1) {
    throw new REvaluationError("NRE2130", `'arg' should be one of ${choices.join(", ")}`);
  }
  return matches[0] as T;
}

async function clusteringFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3272", `'${name}' must be one non-missing logical value.`);
  }
  return Number(value.values[0] ?? 0) !== 0;
}

async function clusteringPositiveNumber(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3272", `'${name}' must be one positive number.`);
  }
  const result = Number(value.values[0] ?? Number.NaN);
  if (!(result > 0) || !Number.isFinite(result)) {
    throw new RTypeMismatchError("NRT3272", `'${name}' must be one positive number.`);
  }
  return result;
}

function matrixRowDistance(
  matrix: NumericMatrix,
  left: number,
  right: number,
  method: DistanceMethod,
  p: number,
): number {
  let total = 0;
  let maximum = 0;
  let binaryUnion = 0;
  let binaryDifference = 0;
  for (let column = 0; column < matrix.columns; column += 1) {
    const leftValue = matrix.values[left + column * matrix.rows] ?? 0;
    const rightValue = matrix.values[right + column * matrix.rows] ?? 0;
    const difference = Math.abs(leftValue - rightValue);
    if (method === "maximum") {
      maximum = Math.max(maximum, difference);
    } else if (method === "manhattan") {
      total += difference;
    } else if (method === "canberra") {
      const denominator = Math.abs(leftValue) + Math.abs(rightValue);
      if (denominator > 0) total += difference / denominator;
    } else if (method === "binary") {
      const leftPresent = leftValue !== 0;
      const rightPresent = rightValue !== 0;
      if (leftPresent || rightPresent) {
        binaryUnion += 1;
        if (leftPresent !== rightPresent) binaryDifference += 1;
      }
    } else if (method === "minkowski") {
      total += difference ** p;
    } else {
      total += difference * difference;
    }
  }
  if (method === "maximum") return maximum;
  if (method === "binary") return binaryUnion === 0 ? 0 : binaryDifference / binaryUnion;
  if (method === "minkowski") return total ** (1 / p);
  return method === "euclidean" ? Math.sqrt(total) : total;
}

function compactMissing(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((value) => value === 1) ? mask : undefined;
}

function distanceObjectSize(value: RVector): number {
  const size = value.attributes.get("Size");
  if (
    (size?.type === "integer" || size?.type === "double") &&
    size.length === 1 &&
    !isMissing(size, 0)
  ) {
    return Math.trunc(Number(size.values[0] ?? 0));
  }
  return Math.trunc((1 + Math.sqrt(1 + 8 * value.length)) / 2);
}

async function hclustMemberSizes(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  size: number,
): Promise<readonly number[]> {
  if (argument === undefined) return Array.from({ length: size }, () => 1);
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return Array.from({ length: size }, () => 1);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== size
  ) {
    throw new RTypeMismatchError("NRT3270", "invalid length of members");
  }
  return Array.from({ length: size }, (_, index) => {
    if (isMissing(value, index)) throw new RTypeMismatchError("NRT3270", "invalid members");
    const member = Number(value.values[index] ?? Number.NaN);
    if (!(member > 0) || !Number.isFinite(member)) {
      throw new RTypeMismatchError("NRT3270", "invalid members");
    }
    return member;
  });
}

function clusterPairKey(left: number, right: number): string {
  return left < right ? `${left},${right}` : `${right},${left}`;
}

function clusterPairContains(key: string, reference: number): boolean {
  const [left, right] = key.split(",").map(Number);
  return left === reference || right === reference;
}

function orderHclustChildren(
  left: HierarchicalCluster,
  right: HierarchicalCluster,
): readonly [HierarchicalCluster, HierarchicalCluster] {
  if (left.height !== right.height)
    return left.height < right.height ? [left, right] : [right, left];
  return left.minimumLeaf < right.minimumLeaf ? [left, right] : [right, left];
}

function updateHclustDistance(
  method: HclustMethod,
  leftDistance: number,
  rightDistance: number,
  mergeDistance: number,
  leftSize: number,
  rightSize: number,
  otherSize: number,
): number {
  if (method === "single") return Math.min(leftDistance, rightDistance);
  if (method === "complete") return Math.max(leftDistance, rightDistance);
  if (method === "average") {
    return (leftSize * leftDistance + rightSize * rightDistance) / (leftSize + rightSize);
  }
  if (method === "mcquitty") return (leftDistance + rightDistance) / 2;
  if (method === "median") {
    return (leftDistance + rightDistance) / 2 - mergeDistance / 4;
  }
  if (method === "centroid") {
    const total = leftSize + rightSize;
    return (
      (leftSize * leftDistance + rightSize * rightDistance) / total -
      (leftSize * rightSize * mergeDistance) / (total * total)
    );
  }
  const total = leftSize + rightSize + otherSize;
  if (method === "ward.D2") {
    return Math.sqrt(
      Math.max(
        0,
        ((leftSize + otherSize) * leftDistance ** 2 +
          (rightSize + otherSize) * rightDistance ** 2 -
          otherSize * mergeDistance ** 2) /
          total,
      ),
    );
  }
  return (
    ((leftSize + otherSize) * leftDistance +
      (rightSize + otherSize) * rightDistance -
      otherSize * mergeDistance) /
    total
  );
}

function hclustLeafOrder(first: Int32Array, second: Int32Array): readonly number[] {
  const rows = first.length;
  const leaves: number[] = [];
  const visit = (reference: number): void => {
    if (reference < 0) {
      leaves.push(-reference);
      return;
    }
    const row = reference - 1;
    visit(first[row] ?? 0);
    visit(second[row] ?? 0);
  };
  if (rows > 0) visit(rows);
  return leaves;
}

function namedListField(value: RList, name: string): RValue | undefined {
  const names = vectorNames(value);
  const index = names?.indexOf(name) ?? -1;
  return index < 0 ? undefined : value.values[index];
}

function dendrogramMembers(value: RValue): number {
  if (!isAtomic(value) && value.type !== "list") return 1;
  const members = value.attributes.get("members");
  return members?.type === "integer" || members?.type === "double"
    ? Number(members.values[0] ?? 1)
    : 1;
}

function dendrogramMidpoint(value: RValue): number {
  if (!isAtomic(value) && value.type !== "list") return 0;
  const midpoint = value.attributes.get("midpoint");
  return midpoint?.type === "integer" || midpoint?.type === "double"
    ? Number(midpoint.values[0] ?? 0)
    : 0;
}

function collectDendrogramLeaves(value: RValue, output: number[]): void {
  if (value.type === "integer" && value.length === 1) {
    output.push(value.values[0] ?? 0);
    return;
  }
  if (value.type !== "list") {
    throw new RTypeMismatchError("NRT3271", "invalid dendrogram");
  }
  for (const child of value.values) collectDendrogramLeaves(child, output);
}

type KmeansAlgorithm = "Hartigan-Wong" | "Lloyd" | "Forgy" | "MacQueen";

const KMEANS_ALGORITHMS: readonly KmeansAlgorithm[] = [
  "Hartigan-Wong",
  "Lloyd",
  "Forgy",
  "MacQueen",
];

interface NumericMatrix {
  readonly values: Float64Array;
  readonly rows: number;
  readonly columns: number;
  readonly rowNames?: readonly string[];
  readonly columnNames?: readonly string[];
}

interface KmeansFit {
  readonly cluster: Int32Array;
  readonly centers: Float64Array;
  readonly withinss: Float64Array;
  readonly size: Int32Array;
  readonly totalWithinss: number;
  readonly iterations: number;
  readonly ifault?: number;
}

async function builtinKmeans(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, [
    "x",
    "centers",
    "iter.max",
    "nstart",
    "algorithm",
    "trace",
  ]);
  const xArgument = matched.get("x");
  const centersArgument = matched.get("centers");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in kmeans().");
  }
  if (centersArgument === undefined || centersArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'centers' is missing in kmeans().");
  }
  const x = numericMatrix(await invocation.force(xArgument.promise), "x", invocation);
  if (x.rows === 0) {
    throw new RTypeMismatchError("NRT3268", "kmeans() requires at least one observation.");
  }
  validateFiniteMatrix(x, "x");
  const iterationLimit = await kmeansPositiveInteger(
    invocation,
    matched.get("iter.max"),
    10,
    "iter.max",
  );
  const startCount = await kmeansPositiveInteger(invocation, matched.get("nstart"), 1, "nstart");
  const algorithm = await kmeansAlgorithm(invocation, matched.get("algorithm"));
  const trace = await kmeansFlag(invocation, matched.get("trace"), false, "trace");
  const centersValue = await invocation.force(centersArgument.promise);
  const scalarCenterCount = kmeansCenterCount(centersValue);
  const distinctRows = distinctDataRows(x);

  let clusterCount: number;
  let explicitCenters: Float64Array | undefined;
  let starts: number;
  if (scalarCenterCount !== undefined) {
    clusterCount = scalarCenterCount;
    if (clusterCount > x.rows) {
      throw new RTypeMismatchError(
        "NRT3268",
        "cannot take a sample larger than the population without replacement.",
      );
    }
    if (clusterCount > distinctRows.length) {
      throw new RTypeMismatchError("NRT3268", "more cluster centers than distinct data points.");
    }
    starts = startCount;
  } else {
    const supplied = numericMatrix(centersValue, "centers", invocation);
    validateFiniteMatrix(supplied, "centers");
    if (supplied.columns !== x.columns) {
      throw new RTypeMismatchError(
        "NRT3268",
        "kmeans() centers must have the same number of columns as x.",
      );
    }
    if (supplied.rows === 0 || supplied.rows > x.rows) {
      throw new RTypeMismatchError("NRT3268", "kmeans() has an invalid number of centers.");
    }
    if (distinctDataRows(supplied).length !== supplied.rows) {
      throw new RTypeMismatchError("NRT3268", "initial centers are not distinct.");
    }
    clusterCount = supplied.rows;
    explicitCenters = Float64Array.from(supplied.values);
    starts = 1;
  }

  invocation.context.allocate(
    x.rows * 3 + x.columns * Math.max(1, clusterCount) * 3 + clusterCount * 3,
  );
  let best: KmeansFit | undefined;
  for (let start = 0; start < starts; start += 1) {
    invocation.context.checkpoint();
    const initial =
      explicitCenters === undefined
        ? sampleInitialCenters(x, distinctRows, clusterCount, invocation)
        : Float64Array.from(explicitCenters);
    const fit =
      clusterCount === 1
        ? fitSingleCluster(x)
        : algorithm === "Hartigan-Wong"
          ? fitHartiganWong(x, initial, clusterCount, iterationLimit, trace, invocation)
          : algorithm === "MacQueen"
            ? fitMacQueen(x, initial, clusterCount, iterationLimit, invocation)
            : fitLloyd(x, initial, clusterCount, iterationLimit, invocation);
    if (best === undefined || fit.totalWithinss < best.totalWithinss) best = fit;
  }
  if (best === undefined) throw new Error();
  if (best.ifault === 2) {
    invocation.context.warn({
      code: "NRW1102",
      message: `did not converge in ${iterationLimit} iteration${iterationLimit === 1 ? "" : "s"}`,
    });
  }
  return kmeansResult(x, best, invocation);
}

function numericMatrix(
  value: RValue,
  role: "x" | "centers",
  invocation: BuiltinInvocation,
): NumericMatrix {
  if (value.type === "list" && isDataFrame(value)) {
    const rows = dataFrameRowCount(value);
    const columns = value.length;
    invocation.context.allocate(rows * columns);
    const output = new Float64Array(rows * columns);
    let coercionWarning = false;
    for (let column = 0; column < columns; column += 1) {
      const input = value.values[column];
      if (input === undefined || !isAtomic(input) || input.type === "complex") {
        throw new RTypeMismatchError(
          "NRT3268",
          `kmeans() ${role} data-frame columns must be coercible atomic vectors.`,
        );
      }
      for (let row = 0; row < rows; row += 1) {
        const converted = matrixCell(input, row);
        output[row + column * rows] = converted.value;
        coercionWarning ||= converted.warned;
      }
    }
    if (coercionWarning) {
      invocation.context.warn({ code: "NRW1006", message: "NAs introduced by coercion" });
    }
    const rowNames = dataFrameRowNames(value);
    const columnNames = vectorNames(value);
    return {
      values: output,
      rows,
      columns,
      ...(rowNames === undefined ? {} : { rowNames }),
      ...(columnNames === undefined ? {} : { columnNames }),
    };
  }
  if (!isAtomic(value) || value.type === "complex") {
    throw new RTypeMismatchError(
      "NRT3268",
      `kmeans() ${role} must be a real atomic vector, matrix, or numeric data frame.`,
    );
  }
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined && dimensions.length !== 2) {
    throw new RTypeMismatchError("NRT3268", `kmeans() ${role} must be two-dimensional.`);
  }
  const rows = dimensions?.[0] ?? value.length;
  const columns = dimensions?.[1] ?? 1;
  invocation.context.allocate(value.length);
  const output = new Float64Array(value.length);
  let coercionWarning = false;
  for (let index = 0; index < value.length; index += 1) {
    const converted = matrixCell(value, index);
    output[index] = converted.value;
    coercionWarning ||= converted.warned;
  }
  if (coercionWarning) {
    invocation.context.warn({ code: "NRW1006", message: "NAs introduced by coercion" });
  }
  const dimensionNames = matrixDimensionNames(value);
  const vectorRowNames = dimensions === undefined ? vectorNames(value) : dimensionNames.row;
  return {
    values: output,
    rows,
    columns,
    ...(vectorRowNames === undefined ? {} : { rowNames: vectorRowNames }),
    ...(dimensions === undefined || dimensionNames.column === undefined
      ? {}
      : { columnNames: dimensionNames.column }),
  };
}

function matrixCell(
  value: Exclude<RVector, RList> & { readonly type: string },
  index: number,
): { readonly value: number; readonly warned: boolean } {
  if (isMissing(value, index)) return { value: Number.NaN, warned: false };
  if (isFactor(value)) {
    const label = factorLevels(value)[(value.values[index] ?? 0) - 1] ?? "";
    const number = numericText(label);
    return { value: number, warned: Number.isNaN(number) };
  }
  if (value.type === "character") {
    const number = numericText(value.values[index] ?? "");
    return { value: number, warned: Number.isNaN(number) };
  }
  if (value.type === "complex") return { value: Number.NaN, warned: false };
  return { value: value.values[index] ?? 0, warned: false };
}

function numericText(value: string): number {
  if (value.trim() === "") return Number.NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : Number.NaN;
}

function dataFrameRowNames(value: RList): readonly string[] | undefined {
  const rowNames = value.attributes.get("row.names");
  return rowNames?.type === "character" &&
    rowNames.missing?.some((missing) => missing === 1) !== true
    ? rowNames.values
    : undefined;
}

function matrixDimensionNames(value: RVector): {
  readonly row?: readonly string[];
  readonly column?: readonly string[];
} {
  const dimnames = value.attributes.get("dimnames");
  if (dimnames?.type !== "list" || dimnames.length !== 2) return {};
  const row = dimnames.values[0];
  const column = dimnames.values[1];
  return {
    ...(row?.type === "character" && row.missing === undefined ? { row: row.values } : {}),
    ...(column?.type === "character" && column.missing === undefined
      ? { column: column.values }
      : {}),
  };
}

function validateFiniteMatrix(value: NumericMatrix, role: "x" | "centers"): void {
  if ([...value.values].some((entry) => !Number.isFinite(entry))) {
    throw new RTypeMismatchError("NRT3268", `NA/NaN/Inf in kmeans() ${role}.`);
  }
}

function kmeansCenterCount(value: RValue): number | undefined {
  if (!isAtomic(value) || value.length !== 1) return undefined;
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isMissing(value, 0)
  ) {
    return undefined;
  }
  const count = Math.trunc(value.values[0] ?? 0);
  if (!Number.isFinite(count) || count < 1) {
    throw new RTypeMismatchError("NRT3268", "kmeans() centers must be a positive number.");
  }
  return count;
}

async function kmeansPositiveInteger(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: "iter.max" | "nstart",
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    !isAtomic(value) ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3268", `'${name}' must be positive.`);
  }
  const result = Math.trunc(value.values[0] ?? 0);
  if (!Number.isFinite(result) || result < 1) {
    throw new RTypeMismatchError("NRT3268", `'${name}' must be positive.`);
  }
  return result;
}

async function kmeansAlgorithm(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<KmeansAlgorithm> {
  if (argument === undefined || argument.promise.missing) return "Hartigan-Wong";
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3268", "kmeans() algorithm must be one character choice.");
  }
  const choice = value.values[0] ?? "";
  const exact = KMEANS_ALGORITHMS.find((candidate) => candidate === choice);
  if (exact !== undefined) return exact;
  const partial = KMEANS_ALGORITHMS.filter((candidate) => candidate.startsWith(choice));
  if (partial.length === 1) return partial[0] as KmeansAlgorithm;
  throw new REvaluationError(
    "NRE2139",
    `'algorithm' should be one of ${KMEANS_ALGORITHMS.map((item) => `"${item}"`).join(", ")}`,
  );
}

async function kmeansFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (!isAtomic(value) || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3268", `kmeans() ${name} must be logical.`);
  }
  if (value.type === "character") {
    const text = (value.values[0] ?? "").toLowerCase();
    if (text === "true" || text === "t") return true;
    if (text === "false" || text === "f") return false;
    throw new RTypeMismatchError("NRT3268", `kmeans() ${name} must be logical.`);
  }
  if (value.type === "complex") {
    const real = value.real[0] ?? 0;
    const imaginary = value.imaginary[0] ?? 0;
    return real !== 0 || imaginary !== 0;
  }
  return (value.values[0] ?? 0) !== 0;
}

function distinctDataRows(value: NumericMatrix): readonly number[] {
  const firstByKey = new Map<string, number>();
  for (let row = 0; row < value.rows; row += 1) {
    const key = matrixRowKey(value, row);
    if (!firstByKey.has(key)) firstByKey.set(key, row);
  }
  return [...firstByKey.values()];
}

function matrixRowKey(value: NumericMatrix, row: number): string {
  return Array.from({ length: value.columns }, (_unused, column) => {
    const item = value.values[row + column * value.rows] ?? 0;
    return Object.is(item, -0) ? "0" : String(item);
  }).join("\u0000");
}

function sampleInitialCenters(
  x: NumericMatrix,
  distinctRows: readonly number[],
  clusterCount: number,
  invocation: BuiltinInvocation,
): Float64Array {
  const pool = [...distinctRows];
  const random = randomState(invocation);
  for (let index = 0; index < clusterCount; index += 1) {
    const selected = index + Math.floor(nextRandom(random) * (pool.length - index));
    [pool[index], pool[selected]] = [pool[selected] ?? 0, pool[index] ?? 0];
  }
  const centers = new Float64Array(clusterCount * x.columns);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const row = pool[cluster] ?? 0;
    for (let column = 0; column < x.columns; column += 1) {
      centers[cluster + column * clusterCount] = x.values[row + column * x.rows] ?? 0;
    }
  }
  return centers;
}

function fitSingleCluster(x: NumericMatrix): KmeansFit {
  const cluster = new Int32Array(x.rows);
  const centers = recomputeCenters(x, cluster, 1).centers;
  const summary = summarizeClusters(x, cluster, centers, 1);
  return {
    cluster,
    centers,
    withinss: summary.withinss,
    size: summary.size,
    totalWithinss: summary.totalWithinss,
    iterations: 1,
  };
}

function fitLloyd(
  x: NumericMatrix,
  initial: Float64Array,
  clusterCount: number,
  iterationLimit: number,
  invocation: BuiltinInvocation,
): KmeansFit {
  let centers: Float64Array<ArrayBufferLike> = Float64Array.from(initial);
  let previous: Int32Array<ArrayBufferLike> = new Int32Array(x.rows).fill(-1);
  let latest: Int32Array<ArrayBufferLike> = previous;
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    latest = assignClusters(x, centers, clusterCount, invocation);
    const changed = !sameAssignments(latest, previous);
    const recomputed = recomputeCenters(x, latest, clusterCount);
    requireNonemptyClusters(recomputed.size);
    centers = recomputed.centers;
    if (!changed) return finishKmeans(x, latest, centers, clusterCount, iteration);
    previous = latest;
  }
  return finishKmeans(x, latest, centers, clusterCount, iterationLimit + 1, 2);
}

function fitMacQueen(
  x: NumericMatrix,
  initial: Float64Array,
  clusterCount: number,
  iterationLimit: number,
  invocation: BuiltinInvocation,
): KmeansFit {
  const cluster = assignClusters(x, initial, clusterCount, invocation);
  let recomputed = recomputeCenters(x, cluster, clusterCount);
  requireNonemptyClusters(recomputed.size);
  let centers = recomputed.centers;
  let size = recomputed.size;
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    let changed = false;
    for (let row = 0; row < x.rows; row += 1) {
      invocation.context.checkpoint();
      const current = cluster[row] ?? 0;
      const selected = nearestCenter(x, row, centers, clusterCount);
      if (selected === current || (size[current] ?? 0) <= 1) continue;
      transferPoint(x, row, current, selected, centers, size);
      cluster[row] = selected;
      changed = true;
    }
    if (!changed) return finishKmeans(x, cluster, centers, clusterCount, iteration);
  }
  recomputed = recomputeCenters(x, cluster, clusterCount);
  centers = recomputed.centers;
  size = recomputed.size;
  requireNonemptyClusters(size);
  return finishKmeans(x, cluster, centers, clusterCount, iterationLimit + 1, 2);
}

function fitHartiganWong(
  x: NumericMatrix,
  initial: Float64Array,
  clusterCount: number,
  iterationLimit: number,
  trace: boolean,
  invocation: BuiltinInvocation,
): KmeansFit {
  const cluster = assignClusters(x, initial, clusterCount, invocation);
  const recomputed = recomputeCenters(x, cluster, clusterCount);
  requireNonemptyClusters(recomputed.size);
  const centers = recomputed.centers;
  const size = recomputed.size;
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    let transferred = false;
    for (let row = 0; row < x.rows; row += 1) {
      invocation.context.checkpoint();
      const current = cluster[row] ?? 0;
      if ((size[current] ?? 0) <= 1) continue;
      const removal =
        ((size[current] ?? 0) / ((size[current] ?? 0) - 1)) *
        squaredDistance(x, row, centers, current, clusterCount);
      let selected = current;
      let bestAddition = removal;
      for (let candidate = 0; candidate < clusterCount; candidate += 1) {
        if (candidate === current) continue;
        const addition =
          ((size[candidate] ?? 0) / ((size[candidate] ?? 0) + 1)) *
          squaredDistance(x, row, centers, candidate, clusterCount);
        if (addition < bestAddition) {
          bestAddition = addition;
          selected = candidate;
        }
      }
      if (selected === current) continue;
      transferPoint(x, row, current, selected, centers, size);
      cluster[row] = selected;
      transferred = true;
    }
    const summary = summarizeClusters(x, cluster, centers, clusterCount);
    traceKmeans(trace, iteration, summary, invocation);
    if (!transferred) return finishKmeans(x, cluster, centers, clusterCount, iteration, 0);
  }
  return finishKmeans(x, cluster, centers, clusterCount, iterationLimit + 1, 2);
}

function assignClusters(
  x: NumericMatrix,
  centers: Float64Array,
  clusterCount: number,
  invocation: BuiltinInvocation,
): Int32Array {
  const output = new Int32Array(x.rows);
  for (let row = 0; row < x.rows; row += 1) {
    invocation.context.checkpoint();
    output[row] = nearestCenter(x, row, centers, clusterCount);
  }
  return output;
}

function nearestCenter(
  x: NumericMatrix,
  row: number,
  centers: Float64Array,
  clusterCount: number,
): number {
  let selected = 0;
  let best = squaredDistance(x, row, centers, 0, clusterCount);
  for (let cluster = 1; cluster < clusterCount; cluster += 1) {
    const distance = squaredDistance(x, row, centers, cluster, clusterCount);
    if (distance < best) {
      best = distance;
      selected = cluster;
    }
  }
  return selected;
}

function squaredDistance(
  x: NumericMatrix,
  row: number,
  centers: Float64Array,
  cluster: number,
  clusterCount: number,
): number {
  let total = 0;
  for (let column = 0; column < x.columns; column += 1) {
    const difference =
      (x.values[row + column * x.rows] ?? 0) - (centers[cluster + column * clusterCount] ?? 0);
    total += difference * difference;
  }
  return total;
}

function recomputeCenters(
  x: NumericMatrix,
  cluster: Int32Array,
  clusterCount: number,
): { readonly centers: Float64Array; readonly size: Int32Array } {
  const centers = new Float64Array(clusterCount * x.columns);
  const size = new Int32Array(clusterCount);
  for (let row = 0; row < x.rows; row += 1) {
    const selected = cluster[row] ?? 0;
    size[selected] = (size[selected] ?? 0) + 1;
    for (let column = 0; column < x.columns; column += 1) {
      const index = selected + column * clusterCount;
      centers[index] = (centers[index] ?? 0) + (x.values[row + column * x.rows] ?? 0);
    }
  }
  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
    if (size[clusterIndex] === 0) continue;
    for (let column = 0; column < x.columns; column += 1) {
      const index = clusterIndex + column * clusterCount;
      centers[index] = (centers[index] ?? 0) / (size[clusterIndex] ?? 1);
    }
  }
  return { centers, size };
}

function transferPoint(
  x: NumericMatrix,
  row: number,
  from: number,
  to: number,
  centers: Float64Array,
  size: Int32Array,
): void {
  const fromSize = size[from] ?? 0;
  const toSize = size[to] ?? 0;
  for (let column = 0; column < x.columns; column += 1) {
    const value = x.values[row + column * x.rows] ?? 0;
    const fromIndex = from + column * size.length;
    const toIndex = to + column * size.length;
    centers[fromIndex] = ((centers[fromIndex] ?? 0) * fromSize - value) / (fromSize - 1);
    centers[toIndex] = ((centers[toIndex] ?? 0) * toSize + value) / (toSize + 1);
  }
  size[from] = (size[from] ?? 0) - 1;
  size[to] = (size[to] ?? 0) + 1;
}

function sameAssignments(left: Int32Array, right: Int32Array): boolean {
  return left.every((value, index) => value === right[index]);
}

function requireNonemptyClusters(size: Int32Array): void {
  if ([...size].some((value) => value === 0)) {
    throw new REvaluationError("NRE2141", "empty cluster: try a better set of initial centers.");
  }
}

function finishKmeans(
  x: NumericMatrix,
  cluster: Int32Array,
  centers: Float64Array,
  clusterCount: number,
  iterations: number,
  ifault?: number,
): KmeansFit {
  const recomputed = recomputeCenters(x, cluster, clusterCount);
  requireNonemptyClusters(recomputed.size);
  const summary = summarizeClusters(x, cluster, recomputed.centers, clusterCount);
  return {
    cluster: Int32Array.from(cluster),
    centers: recomputed.centers,
    withinss: summary.withinss,
    size: summary.size,
    totalWithinss: summary.totalWithinss,
    iterations,
    ...(ifault === undefined ? {} : { ifault }),
  };
}

function summarizeClusters(
  x: NumericMatrix,
  cluster: Int32Array,
  centers: Float64Array,
  clusterCount: number,
): { readonly withinss: Float64Array; readonly size: Int32Array; readonly totalWithinss: number } {
  const withinss = new Float64Array(clusterCount);
  const size = new Int32Array(clusterCount);
  for (let row = 0; row < x.rows; row += 1) {
    const selected = cluster[row] ?? 0;
    size[selected] = (size[selected] ?? 0) + 1;
    withinss[selected] =
      (withinss[selected] ?? 0) + squaredDistance(x, row, centers, selected, clusterCount);
  }
  return {
    withinss,
    size,
    totalWithinss: withinss.reduce((sum, value) => sum + value, 0),
  };
}

function traceKmeans(
  trace: boolean,
  iteration: number,
  summary: { readonly totalWithinss: number },
  invocation: BuiltinInvocation,
): void {
  if (!trace) return;
  invocation.context.writeOutput({
    stream: "stdout",
    text: `kmeans iteration ${iteration}: withinss = ${String(summary.totalWithinss)}\n`,
  });
}

function kmeansResult(x: NumericMatrix, fit: KmeansFit, invocation: BuiltinInvocation): RList {
  const clusterCount = fit.size.length;
  let cluster = integerVector(Array.from(fit.cluster, (value) => value + 1));
  if (x.rowNames !== undefined) cluster = withNames(cluster, x.rowNames);
  let centers = withDimensions(doubleVector(fit.centers), [clusterCount, x.columns]);
  centers = withAttribute(
    centers,
    "dimnames",
    listValue([
      characterVector(Array.from({ length: clusterCount }, (_unused, index) => String(index + 1))),
      x.columnNames === undefined ? R_NULL : characterVector(x.columnNames),
    ]),
  );
  const totalSumSquares = kmeansTotalSumSquares(x);
  const betweenSumSquares = totalSumSquares - fit.totalWithinss;
  const ifault = fit.ifault === undefined ? R_NULL : integerVector([fit.ifault]);
  invocation.context.allocate(9);
  return withClasses(
    listValue(
      [
        cluster,
        centers,
        doubleVector([totalSumSquares]),
        doubleVector(fit.withinss),
        doubleVector([fit.totalWithinss]),
        doubleVector([betweenSumSquares]),
        integerVector(fit.size),
        integerVector([fit.iterations]),
        ifault,
      ],
      [
        "cluster",
        "centers",
        "totss",
        "withinss",
        "tot.withinss",
        "betweenss",
        "size",
        "iter",
        "ifault",
      ],
    ),
    ["kmeans"],
  );
}

function kmeansTotalSumSquares(x: NumericMatrix): number {
  let total = 0;
  for (let column = 0; column < x.columns; column += 1) {
    let mean = 0;
    for (let row = 0; row < x.rows; row += 1) {
      mean += x.values[row + column * x.rows] ?? 0;
    }
    mean /= x.rows;
    for (let row = 0; row < x.rows; row += 1) {
      const difference = (x.values[row + column * x.rows] ?? 0) - mean;
      total += difference * difference;
    }
  }
  return total;
}
