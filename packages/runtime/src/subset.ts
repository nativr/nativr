import { REvaluationError, RTypeMismatchError, RUnsupportedFeatureError } from "./errors.js";
import {
  R_NULL,
  characterVector,
  complexVector,
  dataFrameRowCount,
  dataFrameValue,
  doubleVector,
  factorLevels,
  integerVector,
  isAtomic,
  isDataFrame,
  isFactor,
  isMissing,
  isVector,
  listValue,
  logicalVector,
  missingValue,
  rawVector,
  vectorNames,
  vectorDimensions,
  vectorClasses,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "./values.js";
import type {
  OperatorContext,
  RCharacterVector,
  RComplexVector,
  RDoubleVector,
  RIntegerVector,
  RList,
  RLogicalVector,
  RPairlist,
  RRawVector,
  RValue,
  RVector,
} from "./values.js";

type AtomicVector =
  RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector | RRawVector | RCharacterVector;
type ListLike = RList | RPairlist;
type IndexableValue = RVector | RPairlist;
type SelectedIndex = number | undefined;
interface ArrayDimensionNames {
  readonly axes: readonly (readonly string[] | undefined)[];
  readonly labels?: readonly string[];
}
interface CoordinateSelection {
  readonly positions: readonly SelectedIndex[];
  readonly hasMissing: boolean;
  readonly skippedRows: number;
}
interface ReplacementSelection {
  readonly positions: readonly SelectedIndex[];
  readonly resultLength: number;
  readonly names?: readonly string[];
}

/** Apply one-dimensional `[` semantics for the documented index subset. */
export function subsetVector(
  target: IndexableValue,
  index: RValue | undefined,
  context: OperatorContext,
): RVector {
  const selected = resolveSubsetIndices(target, index);
  context.allocate(selected.length);
  const sourceNames = vectorNames(target);
  const outputNames =
    sourceNames === undefined
      ? undefined
      : selected.map((position) => (position === undefined ? "" : (sourceNames[position] ?? "")));

  if (target.type === "list" || target.type === "pairlist") {
    const values = selected.map((position) =>
      position === undefined ? R_NULL : (target.values[position] ?? R_NULL),
    );
    for (let index_ = 0; index_ < values.length; index_ += 1) context.checkpoint();
    const output = listValue(values, outputNames);
    return target.type === "pairlist" ? output : preserveSubsetAttributes(target, output);
  }

  return preserveSubsetAttributes(target, subsetAtomic(target, selected, outputNames, context));
}

function preserveSubsetAttributes<T extends RVector>(source: RVector, output: T): T {
  const attributes = new Map(output.attributes);
  for (const name of ["class", "levels", "row.names"]) {
    const value = source.attributes.get(name);
    if (value !== undefined) attributes.set(name, value);
  }
  return attributes.size === output.attributes.size &&
    [...attributes].every(([name, value]) => output.attributes.get(name) === value)
    ? output
    : { ...output, attributes };
}

/** Apply two-dimensional matrix or data-frame `[` semantics. */
export function subsetTwoDimensions(
  target: IndexableValue,
  rowIndex: RValue | undefined,
  columnIndex: RValue | undefined,
  drop: boolean,
  context: OperatorContext,
): RVector {
  return subsetDimensions(target, [rowIndex, columnIndex], drop, context);
}

/** Apply rectangular array or data-frame `[` semantics in column-major order. */
export function subsetDimensions(
  target: IndexableValue,
  indices: readonly (RValue | undefined)[],
  drop: boolean,
  context: OperatorContext,
): RVector {
  if (isDataFrame(target)) {
    if (indices.length !== 2) {
      throw new RTypeMismatchError("NRT3310", "A data frame requires two subscripts.");
    }
    return subsetDataFrame(target, indices[0], indices[1], drop, context);
  }
  const dimensions = vectorDimensions(target);
  if (dimensions === undefined || dimensions.length !== indices.length) {
    throw new RTypeMismatchError("NRT3310", "Incorrect number of array dimensions.");
  }
  const dimNames = arrayDimensionNames(target, dimensions);
  const selectedAxes = dimensions.map((length, axis) =>
    resolveArrayAxisIndices(length, indices[axis], dimNames?.axes[axis], context),
  );
  const selectedNames = selectedAxes.map((selected, axis) =>
    selectedAxisNames(selected, dimNames?.axes[axis]),
  );
  const positions = arrayPositions(selectedAxes, dimensions);
  context.allocate(positions.length);
  let output: RVector =
    target.type === "pairlist"
      ? listValue(
          positions.map((position) =>
            position === undefined ? R_NULL : (target.values[position] ?? R_NULL),
          ),
        )
      : subsetAtomic(target, positions, undefined, context);
  if (target.type === "pairlist") {
    for (let index = 0; index < positions.length; index += 1) context.checkpoint();
  }
  const retainedAxes = selectedAxes.flatMap((selected, axis) =>
    !drop || selected.length !== 1 ? [axis] : [],
  );
  if (dimensions.length === 1) {
    const names = selectedNames[0];
    if (retainedAxes.length === 0) {
      return names === undefined ? output : withNames(output, names);
    }
    output = withDimensions(output, [selectedAxes[0]?.length ?? 0]);
    if (dimNames !== undefined) {
      output = withAttribute(
        output,
        "dimnames",
        listValue(
          [names === undefined ? R_NULL : characterVector(names)],
          dimNames.labels === undefined ? undefined : [dimNames.labels[0] ?? ""],
        ),
      );
    }
    return output;
  }
  if (retainedAxes.length === 0) return output;
  if (retainedAxes.length === 1) {
    const names = selectedNames[retainedAxes[0] ?? 0];
    return names === undefined ? output : withNames(output, names);
  }
  output = withDimensions(
    output,
    retainedAxes.map((axis) => selectedAxes[axis]?.length ?? 0),
  );
  const retainedNames = retainedAxes.map((axis) => selectedNames[axis]);
  if (dimNames !== undefined) {
    output = withAttribute(
      output,
      "dimnames",
      listValue(
        retainedNames.map((names) => (names === undefined ? R_NULL : characterVector(names))),
        dimNames?.labels === undefined
          ? undefined
          : retainedAxes.map((axis) => dimNames.labels?.[axis] ?? ""),
      ),
    );
  }
  return output;
}

/** Apply GNU R's row-wise coordinate-matrix array subscript semantics. */
export function subsetCoordinateMatrix(
  target: IndexableValue,
  index: RValue,
  context: OperatorContext,
): RVector {
  const positions = coordinateMatrixSelection(target, index, context).positions;
  context.allocate(positions.length);
  const dataFrameTarget: RList | undefined =
    target.type === "list" && isDataFrame(target) ? target : undefined;
  if (dataFrameTarget !== undefined) {
    return subsetDataFrameCoordinates(dataFrameTarget, positions, context);
  }
  if (target.type === "list" || target.type === "pairlist") {
    const values = positions.map((position) =>
      position === undefined ? R_NULL : (target.values[position] ?? R_NULL),
    );
    for (let offset = 0; offset < values.length; offset += 1) context.checkpoint();
    return listValue(values);
  }
  return subsetAtomic(target, positions, undefined, context);
}

/** Replace a two-dimensional matrix or data-frame selection. */
export function replaceTwoDimensions(
  target: RVector,
  rowIndex: RValue | undefined,
  columnIndex: RValue | undefined,
  replacement: RValue,
  context: OperatorContext,
): RVector {
  return replaceDimensions(target, [rowIndex, columnIndex], replacement, context);
}

/** Replace a rectangular array or data-frame selection in column-major order. */
export function replaceDimensions(
  target: RVector,
  indices: readonly (RValue | undefined)[],
  replacement: RValue,
  context: OperatorContext,
): RVector {
  if (isDataFrame(target)) {
    if (indices.length !== 2) {
      throw new RTypeMismatchError("NRT3311", "A data frame requires two replacement subscripts.");
    }
    return replaceDataFrameSubset(target, indices[0], indices[1], replacement, context);
  }
  const dimensions = vectorDimensions(target);
  if (dimensions === undefined || dimensions.length !== indices.length) {
    throw new RTypeMismatchError("NRT3311", "Incorrect number of array replacement dimensions.");
  }
  const dimNames = arrayDimensionNames(target, dimensions);
  const selectedAxes = dimensions.map((length, axis) =>
    resolveArrayAxisIndices(length, indices[axis], dimNames?.axes[axis], context),
  );
  if (selectedAxes.some((selected) => selected.some((position) => position === undefined))) {
    throw new REvaluationError("NRE2212", "Missing array subscripts cannot be replaced.");
  }
  const positions = arrayPositions(selectedAxes, dimensions).map((position) => (position ?? 0) + 1);
  const updated = replaceVectorSubset(target, integerVector(positions), replacement, context);
  if (updated.type === "pairlist") {
    throw new RTypeMismatchError("NRT3315", "Matrix replacement produced an invalid pairlist.");
  }
  return updated;
}

/** Replace elements selected by a row-wise coordinate matrix. */
export function replaceCoordinateMatrix(
  target: RVector,
  index: RValue,
  replacement: RValue,
  context: OperatorContext,
): RVector {
  const selection = coordinateMatrixSelection(target, index, context);
  if (isDataFrame(target)) {
    return replaceDataFrameCoordinates(target, index, replacement, selection, context);
  }
  const positions = selection.positions.flatMap((position) =>
    position === undefined ? [] : [position + 1],
  );
  const updated = replaceVectorSubset(target, integerVector(positions), replacement, context);
  if (updated.type === "pairlist") {
    throw new RTypeMismatchError(
      "NRT3315",
      "Coordinate-matrix replacement produced an invalid pairlist.",
    );
  }
  return updated;
}

/** Apply one-dimensional `[[` semantics and drop the selected element name. */
export function extractVectorElement(
  target: IndexableValue,
  index: RValue,
  context: OperatorContext,
  exact: boolean | null = true,
): RValue {
  if (
    (target.type === "list" || target.type === "pairlist") &&
    (index.type === "integer" || index.type === "double" || index.type === "character") &&
    index.length > 1
  ) {
    let current: RValue = target;
    for (let offset = 0; offset < index.length; offset += 1) {
      if (current.type !== "list" && current.type !== "pairlist") {
        throw new RTypeMismatchError(
          "NRT3312",
          "Recursive [[ extraction reached a non-vector value before the final subscript.",
        );
      }
      current = extractVectorElement(current, scalarSubscript(index, offset), context, exact);
    }
    return current;
  }
  const position = resolveExactIndex(target, index, exact, context);
  if (position === undefined || position >= target.length) {
    if ((target.type === "list" || target.type === "pairlist") && index.type === "character") {
      return R_NULL;
    }
    throw new REvaluationError("NRE2202", "Subscript is out of bounds.");
  }
  context.checkpoint();
  if (target.type === "list" || target.type === "pairlist") {
    return target.values[position] ?? R_NULL;
  }
  context.allocate(1);
  return subsetAtomic(target, [position], undefined, context);
}

function scalarSubscript(
  index: RIntegerVector | RDoubleVector | RCharacterVector,
  position: number,
): RIntegerVector | RDoubleVector | RCharacterVector {
  if (isMissing(index, position)) {
    throw new REvaluationError("NRE2203", "[[ does not accept a missing subscript.");
  }
  switch (index.type) {
    case "integer":
      return integerVector([index.values[position] ?? 0]);
    case "double":
      return doubleVector([index.values[position] ?? 0]);
    case "character":
      return characterVector([index.values[position] ?? ""]);
  }
}

/** Resolve `$` extraction with GNU R's default unique partial-name matching. */
export function extractListMember(target: RValue, name: string, context: OperatorContext): RValue {
  if (target.type !== "list" && target.type !== "pairlist") {
    throw new RTypeMismatchError("NRT3304", "The $ operator requires a list or pairlist.");
  }
  const names = vectorNames(target);
  if (names === undefined) return R_NULL;
  const exact = names.indexOf(name);
  const partial = exact >= 0 ? exact : uniquePartialNameIndex(names, name);
  if (partial === undefined) return R_NULL;
  context.checkpoint();
  return target.values[partial] ?? R_NULL;
}

/** Replace a one-dimensional `[` selection without mutating the source vector. */
export function replaceVectorSubset(
  target: IndexableValue,
  index: RValue | undefined,
  replacement: RValue,
  context: OperatorContext,
): IndexableValue {
  const dataFrameTarget: RList | undefined =
    target.type === "list" && isDataFrame(target) ? target : undefined;
  if (dataFrameTarget !== undefined) {
    return replaceDataFrameColumns(dataFrameTarget, index, replacement, context);
  }
  const selection = resolveReplacementSelection(target, index);
  const replacementLength = valueReplacementLength(replacement);
  if (selection.positions.some((position) => position === undefined) && replacementLength !== 1) {
    throw new REvaluationError(
      "NRE2212",
      "Missing subscripts require a replacement of length one.",
    );
  }
  const selected = selection.positions.flatMap((position) =>
    position === undefined ? [] : [position],
  );
  if (selected.length === 0) return target;
  if (target.type === "list" || target.type === "pairlist") {
    if (replacement.type === "null") {
      const removed = new Set(selected);
      const extendedValues = Array.from(
        { length: selection.resultLength },
        (_, position) => target.values[position] ?? R_NULL,
      );
      const values = extendedValues.filter((_, position) => !removed.has(position));
      const existingNames = selection.names;
      const names =
        existingNames === undefined
          ? undefined
          : existingNames.filter((_, position) => !removed.has(position));
      context.allocate(values.length);
      return cloneAsList(target, values, names);
    }
    if (replacementLength === 0) {
      throw new REvaluationError("NRE2213", "Replacement has length zero.");
    }
    const values = Array.from(
      { length: selection.resultLength },
      (_, position) => target.values[position] ?? R_NULL,
    );
    if (selected.length % replacementLength !== 0) recyclingWarning(context);
    for (let offset = 0; offset < selected.length; offset += 1) {
      const position = selected[offset] ?? 0;
      values[position] = listReplacementItem(replacement, offset % replacementLength, context);
      context.checkpoint();
    }
    context.allocate(values.length);
    return cloneAsList(target, values, selection.names);
  }
  if (!isAtomic(replacement) || replacement.length === 0) {
    throw new RTypeMismatchError(
      "NRT3129",
      "Atomic replacement requires a non-empty atomic vector.",
    );
  }
  if (selected.length % replacement.length !== 0) recyclingWarning(context);
  const factorTarget: RIntegerVector | undefined =
    target.type === "integer" && isFactor(target) ? target : undefined;
  if (factorTarget !== undefined) {
    return replaceFactor(
      factorTarget,
      selected,
      replacement,
      selection.resultLength,
      selection.names,
      context,
    );
  }
  return replaceAtomic(
    target,
    selected,
    replacement,
    selection.resultLength,
    selection.names,
    context,
  );
}

/** Replace one exact `[[` element. */
export function replaceVectorElement(
  target: IndexableValue,
  index: RValue,
  replacement: RValue,
  context: OperatorContext,
): IndexableValue {
  const dataFrameTarget: RList | undefined =
    target.type === "list" && isDataFrame(target) ? target : undefined;
  if (dataFrameTarget !== undefined) {
    return replaceDataFrameColumns(dataFrameTarget, index, replacement, context);
  }
  const selection = resolveElementReplacement(target, index);
  const position = selection.positions[0] ?? 0;
  if (target.type === "list" || target.type === "pairlist") {
    if (replacement.type === "null") {
      if (position >= target.length) return target;
      const values = target.values.filter((_, index_) => index_ !== position);
      const existingNames = selection.names;
      const names =
        existingNames === undefined
          ? undefined
          : existingNames.filter((_, index_) => index_ !== position);
      context.allocate(values.length);
      return cloneListLike(target, values, names);
    }
    const values = Array.from(
      { length: selection.resultLength },
      (_, offset) => target.values[offset] ?? R_NULL,
    );
    values[position] = replacement;
    context.allocate(values.length);
    return cloneListLike(target, values, selection.names);
  }
  if (!isAtomic(replacement) || replacement.length !== 1) {
    throw new RTypeMismatchError("NRT3130", "Atomic [[ replacement requires one atomic value.");
  }
  const factorTarget: RIntegerVector | undefined =
    target.type === "integer" && isFactor(target) ? target : undefined;
  if (factorTarget !== undefined) {
    return replaceFactor(
      factorTarget,
      [position],
      replacement,
      selection.resultLength,
      selection.names,
      context,
    );
  }
  return replaceAtomic(
    target,
    [position],
    replacement,
    selection.resultLength,
    selection.names,
    context,
  );
}

/** Replace or append one exact list member. */
export function replaceListMember(
  target: RValue,
  name: string,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  if (target.type !== "list" && target.type !== "pairlist") {
    throw new RTypeMismatchError("NRT3304", "The $ operator requires a list or pairlist.");
  }
  const existingNames = vectorNames(target) ?? Array.from({ length: target.length }, () => "");
  const names = [...existingNames];
  const values = [...target.values];
  const position = names.indexOf(name);
  if (replacement.type === "null") {
    if (position < 0) return target;
    names.splice(position, 1);
    values.splice(position, 1);
    context.allocate(values.length);
    return cloneListLike(target, values, names);
  }
  const value =
    target.type === "list" && isDataFrame(target)
      ? normalizeDataFrameColumn(target, replacement, context)
      : replacement;
  if (position < 0) {
    names.push(name);
    values.push(value);
  } else {
    values[position] = value;
  }
  context.allocate(values.length);
  return cloneListLike(target, values, names);
}

function resolveSubsetIndices(target: IndexableValue, index: RValue | undefined): SelectedIndex[] {
  if (index === undefined) return Array.from({ length: target.length }, (_, position) => position);
  switch (index.type) {
    case "integer":
    case "double":
      return resolveNumericSubset(index, target.length);
    case "logical":
      return resolveLogicalSubset(index, target.length);
    case "character":
      return resolveCharacterSubset(index, vectorNames(target));
    default:
      throw new RTypeMismatchError(
        "NRT3301",
        "Subscripts must be numeric, logical, or character vectors.",
        { details: { type: index.type } },
      );
  }
}

function resolveReplacementSelection(
  target: IndexableValue,
  index: RValue | undefined,
): ReplacementSelection {
  if (index === undefined) {
    const names = vectorNames(target);
    return {
      positions: Array.from({ length: target.length }, (_, position) => position),
      resultLength: target.length,
      ...(names === undefined ? {} : { names }),
    };
  }
  const existingNames = vectorNames(target);
  if (index.type === "character") {
    const names = [...(existingNames ?? Array.from({ length: target.length }, () => ""))];
    const positions: number[] = [];
    for (let offset = 0; offset < index.length; offset += 1) {
      if (isMissing(index, offset)) {
        throw new RUnsupportedFeatureError(
          "NRU6131",
          "Missing character names in replacement subscripts are not yet supported.",
        );
      }
      const name = index.values[offset] ?? "";
      const existing = name === "" ? -1 : names.indexOf(name);
      if (existing >= 0) positions.push(existing);
      else {
        positions.push(names.length);
        names.push(name);
      }
    }
    if (positions.length === 0) {
      return {
        positions,
        resultLength: target.length,
        ...(existingNames === undefined ? {} : { names: existingNames }),
      };
    }
    return { positions, resultLength: names.length, names };
  }
  if (index.type === "integer" || index.type === "double") {
    const numeric = replacementNumericPositions(index, target.length);
    const resultLength = replacementResultLength(target.length, numeric);
    return {
      positions: numeric,
      resultLength,
      ...extendNames(existingNames, resultLength),
    };
  }
  if (index.type === "logical") {
    if (index.length === 0) {
      return {
        positions: [],
        resultLength: target.length,
        ...(existingNames === undefined ? {} : { names: existingNames }),
      };
    }
    const positions: SelectedIndex[] = [];
    const inspectedLength = Math.max(target.length, index.length);
    for (let position = 0; position < inspectedLength; position += 1) {
      const source = position % index.length;
      if (isMissing(index, source)) positions.push(undefined);
      else if (index.values[source] === 1) positions.push(position);
    }
    const resultLength = replacementResultLength(target.length, positions);
    return {
      positions,
      resultLength,
      ...extendNames(existingNames, resultLength),
    };
  }
  throw new RTypeMismatchError(
    "NRT3301",
    "Subscripts must be numeric, logical, or character vectors.",
    { details: { type: index.type } },
  );
}

function resolveElementReplacement(target: IndexableValue, index: RValue): ReplacementSelection {
  if (index.type === "character") {
    if (index.length !== 1 || isMissing(index, 0) || (index.values[0] ?? "") === "") {
      throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
    }
    return resolveReplacementSelection(target, index);
  }
  if (index.type !== "integer" && index.type !== "double" && index.type !== "logical") {
    throw new RTypeMismatchError(
      "NRT3303",
      "[[ requires a numeric, logical, or character subscript.",
    );
  }
  if (index.length !== 1 || isMissing(index, 0)) {
    throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
  }
  const source = index.values[0] ?? 0;
  if (!Number.isFinite(source) || Math.trunc(source) < 1) {
    throw new REvaluationError("NRE2205", "[[ requires a positive integer subscript.");
  }
  const position = Math.trunc(source) - 1;
  const resultLength = Math.max(target.length, position + 1);
  return {
    positions: [position],
    resultLength,
    ...extendNames(vectorNames(target), resultLength),
  };
}

function replacementNumericPositions(
  index: RIntegerVector | RDoubleVector,
  targetLength: number,
): SelectedIndex[] {
  const values: (number | undefined)[] = [];
  let hasPositive = false;
  let hasNegative = false;
  for (let position = 0; position < index.length; position += 1) {
    if (isMissing(index, position)) {
      values.push(undefined);
      continue;
    }
    const source = index.values[position] ?? 0;
    if (!Number.isFinite(source)) {
      values.push(undefined);
      continue;
    }
    const value = Math.trunc(source);
    if (value > 0) hasPositive = true;
    if (value < 0) hasNegative = true;
    values.push(value);
  }
  if (hasPositive && hasNegative) {
    throw new REvaluationError("NRE2201", "Only zeros may be mixed with negative subscripts.");
  }
  if (hasNegative) {
    if (values.some((value) => value === undefined)) {
      throw new REvaluationError(
        "NRE2203",
        "Missing values cannot be mixed with negative subscripts.",
      );
    }
    const excluded = new Set(
      values
        .filter((value): value is number => value !== undefined && value < 0)
        .map((value) => Math.abs(value)),
    );
    return Array.from({ length: targetLength }, (_, position) => position).filter(
      (position) => !excluded.has(position + 1),
    );
  }
  return values
    .filter((value) => value !== 0)
    .map((value) => (value === undefined ? value : value - 1));
}

function replacementResultLength(
  targetLength: number,
  positions: readonly SelectedIndex[],
): number {
  return positions.reduce<number>(
    (length, position) => (position === undefined ? length : Math.max(length, position + 1)),
    targetLength,
  );
}

function extendNames(
  names: readonly string[] | undefined,
  length: number,
): { readonly names?: readonly string[] } {
  return names === undefined
    ? {}
    : {
        names: Array.from({ length }, (_, position) => names[position] ?? ""),
      };
}

function resolveAxisIndices(
  length: number,
  index: RValue | undefined,
  names: readonly string[] | undefined,
): SelectedIndex[] {
  const axis = integerVector(Array.from({ length }, (_, position) => position + 1));
  return resolveSubsetIndices(names === undefined ? axis : withNames(axis, names), index);
}

function resolveArrayAxisIndices(
  length: number,
  index: RValue | undefined,
  names: readonly string[] | undefined,
  context: OperatorContext,
): SelectedIndex[] {
  if (index === undefined) {
    return Array.from({ length }, (_, position) => position);
  }
  if (index.type === "logical" && index.length > length) {
    throw new REvaluationError("NRE2218", "Logical array subscript is too long.");
  }
  if (index.type === "character") {
    const selected = resolveCharacterSubset(index, names);
    if (selected.some((position) => position === undefined)) {
      throw new REvaluationError("NRE2202", "Array subscript is out of bounds.");
    }
    return selected;
  }
  if (index.type === "integer" || index.type === "double") {
    const values = new Int32Array(index.length);
    const missing = new Uint8Array(index.length);
    let outsideIntegerRange = false;
    for (let position = 0; position < index.length; position += 1) {
      if (isMissing(index, position)) {
        missing[position] = 1;
        continue;
      }
      const source = index.values[position] ?? 0;
      if (
        Number.isNaN(source) ||
        !Number.isFinite(source) ||
        source < -2_147_483_648 ||
        source > 2_147_483_647
      ) {
        missing[position] = 1;
        if (!Number.isNaN(source)) outsideIntegerRange = true;
        continue;
      }
      const value = Math.trunc(source);
      if (value > length) {
        throw new REvaluationError("NRE2202", "Array subscript is out of bounds.");
      }
      values[position] = value;
    }
    if (outsideIntegerRange) {
      context.warn({
        code: "NRW1007",
        message: "NAs introduced by coercion to integer range",
      });
    }
    const axis = integerVector(Array.from({ length }, (_, position) => position + 1));
    const coerced = integerVector(values, compactMask(missing));
    return resolveSubsetIndices(names === undefined ? axis : withNames(axis, names), coerced);
  }
  return resolveAxisIndices(length, index, names);
}

function selectedAxisNames(
  selected: readonly SelectedIndex[],
  names: readonly string[] | undefined,
): readonly string[] | undefined {
  if (names === undefined || selected.length === 0) return undefined;
  return selected.map((position) => (position === undefined ? "" : (names[position] ?? "")));
}

function arrayPositions(
  selectedAxes: readonly (readonly SelectedIndex[])[],
  dimensions: readonly number[],
): SelectedIndex[] {
  let positions: SelectedIndex[] = [0];
  let stride = 1;
  for (const [axis, selected] of selectedAxes.entries()) {
    const expanded: SelectedIndex[] = [];
    for (const axisPosition of selected) {
      for (const existing of positions) {
        expanded.push(
          axisPosition === undefined || existing === undefined
            ? undefined
            : existing + axisPosition * stride,
        );
      }
    }
    positions = expanded;
    stride *= dimensions[axis] ?? 0;
  }
  return positions;
}

function coordinateMatrixSelection(
  target: IndexableValue,
  index: RValue,
  context: OperatorContext,
): CoordinateSelection {
  const dataFrame = isDataFrame(target);
  const dimensions = dataFrame
    ? [dataFrameRowCount(target), target.length]
    : vectorDimensions(target);
  const indexDimensions =
    isVector(index) || index.type === "pairlist" ? vectorDimensions(index) : undefined;
  if (
    dimensions === undefined ||
    indexDimensions?.length !== 2 ||
    indexDimensions[1] !== dimensions.length
  ) {
    throw new RTypeMismatchError(
      "NRT3316",
      "A coordinate matrix must have one column per array dimension.",
    );
  }
  if (index.type !== "integer" && index.type !== "double" && index.type !== "character") {
    throw new RTypeMismatchError("NRT3316", "A coordinate matrix must be numeric or character.");
  }

  const rows = indexDimensions[0] ?? 0;
  const rowNamesValue = dataFrame ? target.attributes.get("row.names") : undefined;
  const dimNames = dataFrame
    ? {
        axes: [
          rowNamesValue?.type === "character" ? rowNamesValue.values : undefined,
          vectorNames(target),
        ],
      }
    : arrayDimensionNames(target, dimensions);
  const positions: SelectedIndex[] = [];
  let outsideIntegerRange = false;
  let hasMissing = false;
  let skippedRows = 0;
  for (let row = 0; row < rows; row += 1) {
    let offset = 0;
    let stride = 1;
    let missing = false;
    let skipped = false;
    for (let axis = 0; axis < dimensions.length; axis += 1) {
      const source = row + axis * rows;
      if (isMissing(index, source)) {
        missing = true;
        hasMissing = true;
        stride *= dimensions[axis] ?? 0;
        continue;
      }
      if (index.type === "character") {
        const names = dimNames?.axes[axis];
        const name = index.values[source] ?? "";
        const coordinate = names?.indexOf(name) ?? -1;
        if (coordinate < 0) {
          throw new REvaluationError("NRE2202", "Coordinate-matrix subscript is out of bounds.");
        }
        offset += coordinate * stride;
        stride *= dimensions[axis] ?? 0;
        continue;
      }

      const value = index.values[source] ?? 0;
      if (
        Number.isNaN(value) ||
        !Number.isFinite(value) ||
        value < -2_147_483_648 ||
        value > 2_147_483_647
      ) {
        missing = true;
        if (!Number.isNaN(value)) outsideIntegerRange = true;
        stride *= dimensions[axis] ?? 0;
        continue;
      }
      const coordinate = Math.trunc(value);
      if (coordinate < 0) {
        throw new REvaluationError(
          "NRE2219",
          "Negative values are not allowed in a coordinate-matrix subscript.",
        );
      }
      if (coordinate === 0) skipped = true;
      else if (coordinate > (dimensions[axis] ?? 0)) {
        throw new REvaluationError("NRE2202", "Coordinate-matrix subscript is out of bounds.");
      } else {
        offset += (coordinate - 1) * stride;
      }
      stride *= dimensions[axis] ?? 0;
    }
    if (skipped) skippedRows += 1;
    else positions.push(missing ? undefined : offset);
    context.checkpoint();
  }
  if (outsideIntegerRange) {
    context.warn({
      code: "NRW1007",
      message: "NAs introduced by coercion to integer range",
    });
  }
  return { positions, hasMissing, skippedRows };
}

function subsetDataFrameCoordinates(
  target: Extract<RVector, { readonly type: "list" }>,
  positions: readonly SelectedIndex[],
  context: OperatorContext,
): AtomicVector {
  const columns = target.values.map((column) => {
    if (!isAtomic(column)) {
      throw new RTypeMismatchError("NRT3313", "The data-frame column is malformed.");
    }
    return column;
  });
  let type: AtomicVector["type"] = columns[0]?.type ?? "logical";
  for (const column of columns) {
    type = commonAtomicTypeName(type, isFactor(column) ? "character" : column.type);
  }
  const rows = dataFrameRowCount(target);
  const cells = positions.map((position) => {
    if (position === undefined) return undefined;
    const column = columns[Math.floor(position / rows)];
    return column === undefined ? undefined : { column, row: position % rows };
  });
  const missing = Uint8Array.from(cells, (cell) =>
    cell === undefined || isMissing(cell.column, cell.row) ? 1 : 0,
  );
  for (let offset = 0; offset < cells.length; offset += 1) context.checkpoint();
  const mask = compactMask(missing);
  switch (type) {
    case "logical":
      return logicalVector(
        cells.map((cell) => (cell === undefined ? 0 : atomicNumber(cell.column, cell.row))),
        mask,
      );
    case "integer":
      return integerVector(
        cells.map((cell) => (cell === undefined ? 0 : atomicNumber(cell.column, cell.row))),
        mask,
      );
    case "double":
      return doubleVector(
        cells.map((cell) => (cell === undefined ? 0 : atomicNumber(cell.column, cell.row))),
        mask,
      );
    case "complex":
      return complexVector(
        cells.map((cell) => (cell === undefined ? 0 : atomicComplex(cell.column, cell.row).real)),
        cells.map((cell) =>
          cell === undefined ? 0 : atomicComplex(cell.column, cell.row).imaginary,
        ),
        mask,
      );
    case "raw":
      return rawVector(
        cells.map((cell) => (cell === undefined ? 0 : atomicNumber(cell.column, cell.row))),
      );
    case "character":
      return characterVector(
        cells.map((cell) => {
          if (cell === undefined) return "";
          if (isFactor(cell.column)) {
            return factorLevels(cell.column)[(cell.column.values[cell.row] ?? 0) - 1] ?? "";
          }
          return atomicString(cell.column, cell.row);
        }),
        mask,
      );
  }
}

function replaceDataFrameCoordinates(
  target: Extract<RVector, { readonly type: "list" }>,
  index: RValue,
  replacement: RValue,
  selection: CoordinateSelection,
  context: OperatorContext,
): RVector {
  if (index.type === "character") {
    throw new RTypeMismatchError(
      "NRT3317",
      "Character coordinate matrices are not supported in data-frame replacement.",
    );
  }
  if (selection.hasMissing || selection.skippedRows > 0) {
    throw new REvaluationError(
      "NRE2220",
      "Missing or zero coordinate rows cannot be used in data-frame replacement.",
    );
  }
  if (!isAtomic(replacement) || replacement.length === 0) {
    throw new RTypeMismatchError(
      "NRT3314",
      "Data-frame coordinate replacement requires a non-empty atomic value.",
    );
  }
  if (selection.positions.length % replacement.length !== 0) recyclingWarning(context);
  const rows = dataFrameRowCount(target);
  const values = [...target.values];
  for (let offset = 0; offset < selection.positions.length; offset += 1) {
    const position = selection.positions[offset] ?? 0;
    const columnPosition = Math.floor(position / rows);
    const column = values[columnPosition];
    if (column === undefined || !isVector(column)) {
      throw new RTypeMismatchError("NRT3313", "The data-frame column is malformed.");
    }
    const item = subsetAtomic(replacement, [offset % replacement.length], undefined, context);
    values[columnPosition] = replaceVectorSubset(
      column,
      integerVector([(position % rows) + 1]),
      item,
      context,
    );
  }
  return cloneList(target, values, vectorNames(target));
}

function arrayDimensionNames(
  target: IndexableValue,
  dimensions: readonly number[],
): ArrayDimensionNames | undefined {
  const attribute = target.attributes.get("dimnames");
  if (attribute === undefined) return undefined;
  if (attribute.type !== "list" || attribute.length !== dimensions.length) {
    throw new RTypeMismatchError("NRT3312", "The array dimnames attribute is malformed.");
  }
  const axes = dimensions.map((length, axis) => dimensionNameAxis(attribute.values[axis], length));
  const labels = vectorNames(attribute);
  return labels === undefined ? { axes } : { axes, labels };
}

function dimensionNameAxis(
  value: RValue | undefined,
  length: number,
): readonly string[] | undefined {
  if (value === undefined || value.type === "null") return undefined;
  if (value.type !== "character" || value.missing !== undefined || value.length !== length) {
    throw new RTypeMismatchError("NRT3312", "The array dimnames attribute is malformed.");
  }
  return value.values;
}

function subsetDataFrame(
  target: Extract<RVector, { readonly type: "list" }>,
  rowIndex: RValue | undefined,
  columnIndex: RValue | undefined,
  drop: boolean,
  context: OperatorContext,
): RVector {
  const rowNamesValue = target.attributes.get("row.names");
  const rowNames = rowNamesValue?.type === "character" ? rowNamesValue.values : undefined;
  const selectedRows = resolveAxisIndices(dataFrameRowCount(target), rowIndex, rowNames);
  const selectedColumns = resolveAxisIndices(target.length, columnIndex, vectorNames(target));
  if (selectedColumns.some((position) => position === undefined)) {
    throw new REvaluationError("NRE2202", "Data-frame column subscript is out of bounds.");
  }
  const columns = selectedColumns.map((position) => {
    const column = target.values[position ?? 0];
    if (column === undefined || !isVector(column)) {
      throw new RTypeMismatchError("NRT3313", "The data-frame column is malformed.");
    }
    return subsetVector(
      column,
      integerVector(
        selectedRows.map((row) => (row === undefined ? Number.NaN : row + 1)),
        Uint8Array.from(selectedRows, (row) => (row === undefined ? 1 : 0)),
      ),
      context,
    );
  });
  const classes = vectorClasses(target);
  if (drop && columns.length === 1 && !classes?.includes("tbl_df")) {
    return columns[0] ?? listValue([]);
  }
  const sourceNames = vectorNames(target) ?? [];
  const columnNames = selectedColumns.map((position) => sourceNames[position ?? 0] ?? "");
  const outputRowNames = selectedRows.map((position, index) =>
    position === undefined ? `NA${index + 1}` : (rowNames?.[position] ?? String(position + 1)),
  );
  const output = dataFrameValue(columns, columnNames, outputRowNames);
  return classes === undefined ? output : withClasses(output, classes);
}

function replaceDataFrameColumns(
  target: Extract<RVector, { readonly type: "list" }>,
  index: RValue | undefined,
  replacement: RValue,
  context: OperatorContext,
): RVector {
  const selection = resolveReplacementSelection(target, index);
  if (selection.positions.some((position) => position === undefined)) {
    throw new REvaluationError("NRE2212", "Missing data-frame columns cannot be replaced.");
  }
  const selected = selection.positions as readonly number[];
  if (selected.length === 0) return target;
  const selectedNew = new Set(selected.filter((position) => position >= target.length));
  for (let position = target.length; position < selection.resultLength; position += 1) {
    if (!selectedNew.has(position)) {
      throw new REvaluationError(
        "NRE2221",
        "New data-frame columns cannot leave holes after existing columns.",
      );
    }
  }
  if (replacement.type === "null") {
    const removed = new Set(selected);
    const values = target.values.filter((_, position) => !removed.has(position));
    const sourceNames = vectorNames(target) ?? [];
    const names = sourceNames.filter((_, position) => !removed.has(position));
    context.allocate(values.length);
    return cloneList(target, values, names);
  }
  const replacementLength = valueReplacementLength(replacement);
  if (replacementLength === 0) {
    throw new REvaluationError("NRE2213", "Replacement has length zero.");
  }
  const names = [
    ...(selection.names ??
      Array.from({ length: selection.resultLength }, (_, position) =>
        position < target.length ? (vectorNames(target)?.[position] ?? "") : `V${position + 1}`,
      )),
  ];
  for (let position = target.length; position < names.length; position += 1) {
    if (names[position] === "") names[position] = `V${position + 1}`;
  }
  const values = Array.from(
    { length: selection.resultLength },
    (_, position) => target.values[position] ?? R_NULL,
  );
  for (let offset = 0; offset < selected.length; offset += 1) {
    const position = selected[offset] ?? 0;
    values[position] = dataFrameColumnReplacement(
      target,
      replacement,
      offset,
      selected.length,
      context,
    );
    context.checkpoint();
  }
  context.allocate(values.length);
  return cloneList(target, values, names);
}

function dataFrameColumnReplacement(
  target: Extract<RVector, { readonly type: "list" }>,
  replacement: RValue,
  columnOffset: number,
  columnCount: number,
  context: OperatorContext,
): RValue {
  if (replacement.type === "list" || replacement.type === "pairlist") {
    if (replacement.length === 0) {
      throw new REvaluationError("NRE2213", "Replacement has length zero.");
    }
    return normalizeDataFrameColumn(
      target,
      replacement.values[columnOffset % replacement.length] ?? R_NULL,
      context,
    );
  }
  if (!isAtomic(replacement) || replacement.length === 0) {
    throw new RTypeMismatchError(
      "NRT3131",
      "Data-frame replacement requires atomic columns or a list of columns.",
    );
  }
  if (columnCount === 1) return normalizeDataFrameColumn(target, replacement, context);
  const rows = dataFrameRowCount(target);
  const cellCount = rows * columnCount;
  if (columnOffset === 0 && cellCount % replacement.length !== 0) recyclingWarning(context);
  const indices = integerVector(
    Array.from(
      { length: rows },
      (_, row) => ((columnOffset * rows + row) % replacement.length) + 1,
    ),
  );
  return normalizeDataFrameColumn(target, subsetVector(replacement, indices, context), context);
}

function replaceDataFrameSubset(
  target: Extract<RVector, { readonly type: "list" }>,
  rowIndex: RValue | undefined,
  columnIndex: RValue | undefined,
  replacement: RValue,
  context: OperatorContext,
): RVector {
  if (
    (!isAtomic(replacement) && replacement.type !== "list" && replacement.type !== "pairlist") ||
    valueReplacementLength(replacement) === 0
  ) {
    throw new RTypeMismatchError(
      "NRT3314",
      "Data-frame rectangular replacement requires a non-empty atomic or list value.",
    );
  }
  const rowNamesValue = target.attributes.get("row.names");
  const existingRowNames =
    rowNamesValue?.type === "character"
      ? rowNamesValue.values
      : Array.from({ length: dataFrameRowCount(target) }, (_, position) => String(position + 1));
  const rowSelection = resolveDataFrameRows(dataFrameRowCount(target), existingRowNames, rowIndex);
  const columnSelection = resolveReplacementSelection(target, columnIndex);
  if (
    rowSelection.positions.some((position) => position === undefined) ||
    columnSelection.positions.some((position) => position === undefined)
  ) {
    throw new REvaluationError("NRE2212", "Missing data-frame subscripts cannot be replaced.");
  }
  const selectedRows = rowSelection.positions as readonly number[];
  const selectedColumns = columnSelection.positions as readonly number[];
  if (columnIndex?.type === "logical" && columnSelection.resultLength > target.length) {
    throw new REvaluationError("NRE2222", "Non-existent data-frame columns are not allowed.");
  }
  const selectedNewColumns = new Set(
    selectedColumns.filter((position) => position >= target.length),
  );
  for (let position = target.length; position < columnSelection.resultLength; position += 1) {
    if (!selectedNewColumns.has(position)) {
      throw new REvaluationError(
        "NRE2221",
        "New data-frame columns cannot leave holes after existing columns.",
      );
    }
  }
  const columnNames = [
    ...(columnSelection.names ??
      Array.from({ length: columnSelection.resultLength }, (_, position) =>
        position < target.length ? (vectorNames(target)?.[position] ?? "") : `V${position + 1}`,
      )),
  ];
  for (let position = target.length; position < columnNames.length; position += 1) {
    if (columnNames[position] === "") columnNames[position] = `V${position + 1}`;
  }
  const values: RValue[] = [];
  for (let position = 0; position < columnSelection.resultLength; position += 1) {
    const existing = target.values[position];
    if (existing === undefined) {
      values.push(R_NULL);
      continue;
    }
    if (!isAtomic(existing)) {
      throw new RTypeMismatchError("NRT3313", "The data-frame column is malformed.");
    }
    values.push(extendDataFrameColumn(existing, rowSelection.resultLength, context));
  }
  const cellCount = selectedRows.length * selectedColumns.length;
  const replacementLength = valueReplacementLength(replacement);
  if (isAtomic(replacement) && cellCount % replacementLength !== 0) recyclingWarning(context);
  if (
    (replacement.type === "list" || replacement.type === "pairlist") &&
    selectedColumns.length % replacement.length !== 0
  ) {
    recyclingWarning(context);
  }
  for (let columnOffset = 0; columnOffset < selectedColumns.length; columnOffset += 1) {
    const columnPosition = selectedColumns[columnOffset] ?? 0;
    const columnReplacement = dataFrameCellReplacement(
      replacement,
      columnOffset,
      selectedColumns.length,
      selectedRows.length,
      context,
    );
    let column = values[columnPosition];
    if (column === undefined || column.type === "null") {
      if (!isAtomic(columnReplacement)) {
        throw new RTypeMismatchError("NRT3313", "A new data-frame column must be atomic.");
      }
      column = subsetVector(columnReplacement, integerVector([]), context);
    }
    if (!isAtomic(column)) {
      throw new RTypeMismatchError("NRT3313", "The data-frame column is malformed.");
    }
    values[columnPosition] = replaceVectorSubset(
      column,
      integerVector(selectedRows.map((row) => row + 1)),
      columnReplacement,
      context,
    );
  }
  const output = cloneList(target, values, columnNames);
  const attributes = new Map(output.attributes);
  attributes.set("row.names", characterVector(rowSelection.names ?? existingRowNames));
  return { ...output, attributes };
}

function resolveDataFrameRows(
  rowCount: number,
  rowNames: readonly string[],
  index: RValue | undefined,
): ReplacementSelection {
  if (index === undefined) {
    return {
      positions: Array.from({ length: rowCount }, (_, position) => position),
      resultLength: rowCount,
      names: rowNames,
    };
  }
  if (index.type === "logical") {
    if (index.length > rowCount) {
      throw new REvaluationError("NRE2222", "Non-existent data-frame rows are not allowed.");
    }
    const positions = resolveLogicalSubset(index, rowCount);
    if (positions.some((position) => position === undefined)) {
      throw new REvaluationError("NRE2212", "Missing data-frame rows cannot be replaced.");
    }
    return { positions, resultLength: rowCount, names: rowNames };
  }
  const axis = withNames(
    integerVector(Array.from({ length: rowCount }, (_, position) => position + 1)),
    rowNames,
  );
  const selection = resolveReplacementSelection(axis, index);
  if (selection.positions.some((position) => position === undefined)) {
    throw new REvaluationError("NRE2212", "Missing data-frame rows cannot be replaced.");
  }
  const names =
    index.type === "character"
      ? selection.names
      : Array.from(
          { length: selection.resultLength },
          (_, position) => rowNames[position] ?? String(position + 1),
        );
  return {
    positions: selection.positions,
    resultLength: selection.resultLength,
    ...(names === undefined ? {} : { names }),
  };
}

function extendDataFrameColumn(
  column: AtomicVector,
  rowCount: number,
  context: OperatorContext,
): AtomicVector {
  if (column.length >= rowCount) return column;
  const filler =
    column.type === "raw"
      ? rawVector([0])
      : missingValue(
          column.type === "complex" || column.type === "character"
            ? column.type
            : column.type === "double"
              ? "double"
              : column.type === "integer"
                ? "integer"
                : "logical",
        );
  const output = replaceVectorSubset(column, integerVector([rowCount]), filler, context);
  if (!isAtomic(output)) {
    throw new RTypeMismatchError("NRT3313", "The data-frame column extension is malformed.");
  }
  return output;
}

function dataFrameCellReplacement(
  replacement: RValue,
  columnOffset: number,
  columnCount: number,
  rowCount: number,
  context: OperatorContext,
): RValue {
  if (replacement.type === "list" || replacement.type === "pairlist") {
    const value = replacement.values[columnOffset % replacement.length] ?? R_NULL;
    if (!isAtomic(value) || value.length === 0) {
      throw new RTypeMismatchError(
        "NRT3314",
        "Data-frame list replacement entries must be non-empty atomic vectors.",
      );
    }
    if (rowCount % value.length !== 0) recyclingWarning(context);
    return value;
  }
  if (!isAtomic(replacement)) {
    throw new RTypeMismatchError("NRT3314", "Data-frame replacement must be atomic or a list.");
  }
  const indices = integerVector(
    Array.from(
      { length: rowCount },
      (_, row) => ((columnOffset * rowCount + row) % replacement.length) + 1,
    ),
  );
  return columnCount === 1 && replacement.length === rowCount
    ? replacement
    : subsetVector(replacement, indices, context);
}

function resolveNumericSubset(
  index: RIntegerVector | RDoubleVector,
  targetLength: number,
): SelectedIndex[] {
  const values: (number | undefined)[] = [];
  let hasPositive = false;
  let hasNegative = false;
  for (let position = 0; position < index.length; position += 1) {
    if (isMissing(index, position)) {
      values.push(undefined);
      continue;
    }
    const source = index.values[position] ?? 0;
    if (!Number.isFinite(source)) {
      values.push(undefined);
      continue;
    }
    const value = Math.trunc(source);
    if (value > 0) hasPositive = true;
    if (value < 0) hasNegative = true;
    values.push(value);
  }
  if (hasPositive && hasNegative) {
    throw new REvaluationError("NRE2201", "Only zeros may be mixed with negative subscripts.");
  }
  if (hasNegative) {
    if (values.some((value) => value === undefined)) {
      throw new REvaluationError(
        "NRE2203",
        "Missing values cannot be mixed with negative subscripts.",
      );
    }
    const excluded = new Set(
      values
        .filter((value): value is number => value !== undefined && value < 0)
        .map((value) => Math.abs(value)),
    );
    return Array.from({ length: targetLength }, (_, position) => position).filter(
      (position) => !excluded.has(position + 1),
    );
  }
  return values
    .filter((value) => value !== 0)
    .map((value) => (value === undefined || value > targetLength ? undefined : value - 1));
}

function resolveLogicalSubset(index: RLogicalVector, targetLength: number): SelectedIndex[] {
  if (index.length === 0) return [];
  const selected: SelectedIndex[] = [];
  const length = Math.max(targetLength, index.length);
  for (let position = 0; position < length; position += 1) {
    const indexPosition = position % index.length;
    if (isMissing(index, indexPosition)) {
      selected.push(undefined);
    } else if (index.values[indexPosition] === 1) {
      selected.push(position < targetLength ? position : undefined);
    }
  }
  return selected;
}

function resolveCharacterSubset(
  index: RCharacterVector,
  names: readonly string[] | undefined,
): SelectedIndex[] {
  return Array.from({ length: index.length }, (_, position) => {
    if (isMissing(index, position) || names === undefined) return undefined;
    const name = index.values[position] ?? "";
    const match = names.indexOf(name);
    return match < 0 ? undefined : match;
  });
}

function resolveExactIndex(
  target: IndexableValue,
  index: RValue,
  exact: boolean | null,
  context: OperatorContext,
): number | undefined {
  if (index.type === "character") {
    if (index.length !== 1 || isMissing(index, 0)) {
      throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
    }
    const names = vectorNames(target);
    if (names === undefined) return undefined;
    const name = index.values[0] ?? "";
    const position = names.indexOf(name);
    if (position >= 0 || exact === true) return position < 0 ? undefined : position;
    const partial = uniquePartialNameIndex(names, name);
    if (partial !== undefined && exact === null) {
      context.warn({
        code: "NRW1008",
        message: `partial match of '${name}' to '${names[partial] ?? ""}'`,
      });
    }
    return partial;
  }
  if (index.type !== "integer" && index.type !== "double" && index.type !== "logical") {
    throw new RTypeMismatchError(
      "NRT3303",
      "[[ requires a numeric, logical, or character subscript.",
    );
  }
  if (index.length !== 1 || isMissing(index, 0)) {
    throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
  }
  const source = index.values[0] ?? 0;
  if (!Number.isFinite(source)) return undefined;
  const value = Math.trunc(source);
  if (value < 1) {
    throw new REvaluationError("NRE2205", "[[ requires a positive integer subscript.");
  }
  return value - 1;
}

function uniquePartialNameIndex(names: readonly string[], prefix: string): number | undefined {
  if (prefix === "") return undefined;
  const matches = names.flatMap((name, index) => (name.startsWith(prefix) ? [index] : []));
  return matches.length === 1 ? matches[0] : undefined;
}

function subsetAtomic(
  target: AtomicVector,
  selected: readonly SelectedIndex[],
  names: readonly string[] | undefined,
  context: OperatorContext,
): AtomicVector {
  const missing = new Uint8Array(selected.length);
  for (let output = 0; output < selected.length; output += 1) {
    const source = selected[output];
    if (source === undefined || isMissing(target, source)) missing[output] = 1;
    context.checkpoint();
  }
  const mask = compactMask(missing);
  let value: AtomicVector;
  switch (target.type) {
    case "logical":
      value = logicalVector(
        selected.map((position) => (position === undefined ? 0 : (target.values[position] ?? 0))),
        mask,
      );
      break;
    case "integer":
      value = integerVector(
        selected.map((position) => (position === undefined ? 0 : (target.values[position] ?? 0))),
        mask,
      );
      break;
    case "double":
      value = doubleVector(
        selected.map((position) => (position === undefined ? 0 : (target.values[position] ?? 0))),
        mask,
      );
      break;
    case "complex":
      value = complexVector(
        selected.map((position) => (position === undefined ? 0 : (target.real[position] ?? 0))),
        selected.map((position) =>
          position === undefined ? 0 : (target.imaginary[position] ?? 0),
        ),
        mask,
      );
      break;
    case "raw":
      value = rawVector(
        selected.map((position) => (position === undefined ? 0 : (target.values[position] ?? 0))),
      );
      break;
    case "character":
      value = characterVector(
        selected.map((position) => (position === undefined ? "" : (target.values[position] ?? ""))),
        mask,
      );
      break;
  }
  return names === undefined ? value : withExactNames(value, names);
}

function replaceAtomic(
  target: AtomicVector,
  selected: readonly number[],
  replacement: AtomicVector,
  resultLength: number,
  names: readonly string[] | undefined,
  context: OperatorContext,
): AtomicVector {
  const type = commonAtomicType(target, replacement);
  const missing = new Uint8Array(resultLength);
  for (let index = 0; index < target.length; index += 1) {
    if (isMissing(target, index)) missing[index] = 1;
  }
  if (resultLength > target.length) missing.fill(1, target.length);
  context.allocate(resultLength);

  let output: AtomicVector;
  if (type === "character") {
    const values = Array.from({ length: resultLength }, (_, index) => atomicString(target, index));
    for (let index = 0; index < selected.length; index += 1) {
      const destination = selected[index] ?? 0;
      const source = index % replacement.length;
      missing[destination] = isMissing(replacement, source) ? 1 : 0;
      values[destination] = atomicString(replacement, source);
      context.checkpoint();
    }
    output = characterVector(values, compactMask(missing));
  } else if (type === "complex") {
    const values = Array.from({ length: resultLength }, (_, index) => atomicComplex(target, index));
    for (let index = 0; index < selected.length; index += 1) {
      const destination = selected[index] ?? 0;
      const source = index % replacement.length;
      missing[destination] = isMissing(replacement, source) ? 1 : 0;
      values[destination] = atomicComplex(replacement, source);
      context.checkpoint();
    }
    output = complexVector(
      values.map((value) => value.real),
      values.map((value) => value.imaginary),
      compactMask(missing),
    );
  } else if (type === "raw") {
    const values = Uint8Array.from({ length: resultLength }, (_, index) =>
      atomicNumber(target, index),
    );
    for (let index = 0; index < selected.length; index += 1) {
      const destination = selected[index] ?? 0;
      const source = index % replacement.length;
      values[destination] = atomicNumber(replacement, source);
      context.checkpoint();
    }
    output = rawVector(values);
  } else if (type === "double") {
    const values = Float64Array.from({ length: resultLength }, (_, index) =>
      atomicNumber(target, index),
    );
    for (let index = 0; index < selected.length; index += 1) {
      const destination = selected[index] ?? 0;
      const source = index % replacement.length;
      missing[destination] = isMissing(replacement, source) ? 1 : 0;
      values[destination] = atomicNumber(replacement, source);
      context.checkpoint();
    }
    output = doubleVector(values, compactMask(missing));
  } else if (type === "integer") {
    const values = Int32Array.from({ length: resultLength }, (_, index) =>
      atomicNumber(target, index),
    );
    for (let index = 0; index < selected.length; index += 1) {
      const destination = selected[index] ?? 0;
      const source = index % replacement.length;
      missing[destination] = isMissing(replacement, source) ? 1 : 0;
      values[destination] = atomicNumber(replacement, source);
      context.checkpoint();
    }
    output = integerVector(values, compactMask(missing));
  } else {
    const values = Uint8Array.from({ length: resultLength }, (_, index) =>
      atomicNumber(target, index) === 0 ? 0 : 1,
    );
    for (let index = 0; index < selected.length; index += 1) {
      const destination = selected[index] ?? 0;
      const source = index % replacement.length;
      missing[destination] = isMissing(replacement, source) ? 1 : 0;
      values[destination] = atomicNumber(replacement, source) === 0 ? 0 : 1;
      context.checkpoint();
    }
    output = logicalVector(values, compactMask(missing));
  }
  return { ...output, attributes: replacementAttributes(target, resultLength, names) };
}

function replaceFactor(
  target: RIntegerVector,
  selected: readonly number[],
  replacement: AtomicVector,
  resultLength: number,
  names: readonly string[] | undefined,
  context: OperatorContext,
): RIntegerVector {
  const levels = factorLevels(target);
  const values = Int32Array.from(
    { length: resultLength },
    (_, position) => target.values[position] ?? 0,
  );
  const missing = new Uint8Array(resultLength);
  for (let position = 0; position < target.length; position += 1) {
    if (isMissing(target, position)) missing[position] = 1;
  }
  if (resultLength > target.length) missing.fill(1, target.length);
  let invalidLevel = false;
  for (let offset = 0; offset < selected.length; offset += 1) {
    const destination = selected[offset] ?? 0;
    const source = offset % replacement.length;
    if (isMissing(replacement, source)) {
      missing[destination] = 1;
      values[destination] = 0;
      context.checkpoint();
      continue;
    }
    const label = isFactor(replacement)
      ? factorLevels(replacement)[(replacement.values[source] ?? 0) - 1]
      : atomicString(replacement, source);
    const level = label === undefined ? -1 : levels.indexOf(label);
    if (level < 0) {
      invalidLevel = true;
      missing[destination] = 1;
      values[destination] = 0;
    } else {
      missing[destination] = 0;
      values[destination] = level + 1;
    }
    context.checkpoint();
  }
  if (invalidLevel) {
    context.warn({
      code: "NRW1009",
      message: "invalid factor level, NA generated",
    });
  }
  context.allocate(resultLength);
  const output = integerVector(values, compactMask(missing));
  return { ...output, attributes: replacementAttributes(target, resultLength, names) };
}

function commonAtomicType(left: AtomicVector, right: AtomicVector): AtomicVector["type"] {
  return commonAtomicTypeName(left.type, right.type);
}

function commonAtomicTypeName(
  left: AtomicVector["type"],
  right: AtomicVector["type"],
): AtomicVector["type"] {
  if (left === "character" || right === "character") return "character";
  if (left === "complex" || right === "complex") return "complex";
  if (left === "double" || right === "double") return "double";
  if (left === "integer" || right === "integer") return "integer";
  if (left === "logical" || right === "logical") return "logical";
  if (left === "raw" || right === "raw") return "raw";
  return "logical";
}

function atomicNumber(value: AtomicVector, index: number): number {
  if (value.type === "complex") {
    throw new RTypeMismatchError(
      "NRT3138",
      "A complex value cannot be coerced to real implicitly.",
    );
  }
  return value.type === "character"
    ? Number(value.values[index] ?? "")
    : (value.values[index] ?? 0);
}

function atomicString(value: AtomicVector, index: number): string {
  if (value.type === "character") return value.values[index] ?? "";
  if (value.type === "logical") return value.values[index] === 1 ? "TRUE" : "FALSE";
  if (value.type === "raw") return (value.values[index] ?? 0).toString(16).padStart(2, "0");
  if (value.type === "complex") {
    const real = value.real[index] ?? 0;
    const imaginary = value.imaginary[index] ?? 0;
    return `${String(real)}${imaginary < 0 ? "" : "+"}${String(imaginary)}i`;
  }
  return String(value.values[index] ?? 0);
}

function atomicComplex(
  value: AtomicVector,
  index: number,
): { readonly real: number; readonly imaginary: number } {
  if (value.type === "complex") {
    return { real: value.real[index] ?? 0, imaginary: value.imaginary[index] ?? 0 };
  }
  return {
    real:
      value.type === "character" ? Number(value.values[index] ?? "") : (value.values[index] ?? 0),
    imaginary: 0,
  };
}

function listReplacementItem(replacement: RValue, index: number, context: OperatorContext): RValue {
  if (replacement.type === "list" || replacement.type === "pairlist") {
    return replacement.values[index] ?? R_NULL;
  }
  if (isAtomic(replacement)) return subsetAtomic(replacement, [index], undefined, context);
  return replacement;
}

function valueReplacementLength(replacement: RValue): number {
  return isVector(replacement) || replacement.type === "pairlist" ? replacement.length : 1;
}

function replacementAttributes(
  target: IndexableValue,
  resultLength: number,
  names: readonly string[] | undefined,
): ReadonlyMap<string, RValue> {
  const attributes = new Map(target.attributes);
  if (resultLength !== target.length) {
    attributes.delete("dim");
    attributes.delete("dimnames");
  }
  if (names === undefined) attributes.delete("names");
  else attributes.set("names", characterVector(names));
  return attributes;
}

function cloneList(
  target: RList,
  values: readonly RValue[],
  names: readonly string[] | undefined,
): RList {
  return cloneListLike(target, values, names);
}

function cloneAsList(
  target: ListLike,
  values: readonly RValue[],
  names: readonly string[] | undefined,
): RList {
  const attributes = new Map(replacementAttributes(target, values.length, names));
  return {
    type: "list",
    values: Object.freeze([...values]),
    length: values.length,
    attributes,
  };
}

function cloneListLike<T extends ListLike>(
  target: T,
  values: readonly RValue[],
  names: readonly string[] | undefined,
): T {
  const attributes = new Map(replacementAttributes(target, values.length, names));
  return {
    ...target,
    values: Object.freeze([...values]),
    length: values.length,
    attributes,
  };
}

function normalizeDataFrameColumn(
  target: Extract<RVector, { readonly type: "list" }>,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  if (!isAtomic(replacement)) {
    throw new RTypeMismatchError("NRT3131", "Data-frame replacement requires an atomic column.");
  }
  const rows = dataFrameRowCount(target);
  if (replacement.length === rows) return replacement;
  if (replacement.length === 1 && rows > 1) {
    const indices = integerVector(Array.from({ length: rows }, () => 1));
    return subsetVector(replacement, indices, context);
  }
  throw new REvaluationError("NRE2116", "Data-frame columns have incompatible row counts.");
}

function recyclingWarning(context: OperatorContext): void {
  context.warn({
    code: "NRW1001",
    message: "Longer object length is not a multiple of shorter object length.",
  });
}

function withExactNames<T extends AtomicVector>(value: T, names: readonly string[]): T {
  const attributes = new Map(value.attributes);
  attributes.set("names", characterVector(names));
  return { ...value, attributes };
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((item) => item === 1) ? mask : undefined;
}
