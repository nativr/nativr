export type GraphicsRgba = readonly [number, number, number, number];

export function parseGraphicsColour(source: string): GraphicsRgba {
  const match = /^#([0-9a-f]{8})$/iu.exec(source);
  if (match === null) return [0, 0, 0, 255];
  const value = match[1] ?? "000000FF";
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    Number.parseInt(value.slice(6, 8), 16),
  ];
}

export function fixedGraphicsNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function hexBytes(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0").toUpperCase();
  return output;
}

export function asciiBytes(value: string): Uint8Array {
  const output = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    output[index] = value.charCodeAt(index) & 0x7f;
  }
  return output;
}

export function postscriptString(value: string): string {
  let output = "(";
  for (const character of value) {
    const point = character.codePointAt(0) ?? 63;
    if (character === "(" || character === ")" || character === "\\") output += `\\${character}`;
    else if (point >= 32 && point <= 126) output += character;
    else if (point <= 255) output += `\\${point.toString(8).padStart(3, "0")}`;
    else output += "?";
  }
  return `${output})`;
}

export function polygonHatchSegments(
  points: readonly (readonly [number, number])[],
  density: number,
  angle: number,
  unitsPerInch: number,
): readonly (readonly [readonly [number, number], readonly [number, number]])[] {
  if (points.length < 3 || !(density > 0)) return [];
  const radians = (angle * Math.PI) / 180;
  const tangent = [Math.cos(radians), Math.sin(radians)] as const;
  const normal = [-tangent[1], tangent[0]] as const;
  const tangentProjections = points.map(([x, y]) => x * tangent[0] + y * tangent[1]);
  const normalProjections = points.map(([x, y]) => x * normal[0] + y * normal[1]);
  const minimumTangent = Math.min(...tangentProjections) - 2;
  const maximumTangent = Math.max(...tangentProjections) + 2;
  const minimumNormal = Math.min(...normalProjections);
  const maximumNormal = Math.max(...normalProjections);
  const spacing = Math.max(0.25, unitsPerInch / density);
  const first = Math.ceil(minimumNormal / spacing) * spacing;
  const segments: (readonly [readonly [number, number], readonly [number, number]])[] = [];
  for (let offset = first; offset <= maximumNormal + spacing * 1e-9; offset += spacing) {
    segments.push([
      [
        tangent[0] * minimumTangent + normal[0] * offset,
        tangent[1] * minimumTangent + normal[1] * offset,
      ],
      [
        tangent[0] * maximumTangent + normal[0] * offset,
        tangent[1] * maximumTangent + normal[1] * offset,
      ],
    ]);
  }
  return segments;
}

export function pointVertices(
  symbol: number,
  x: number,
  y: number,
  radius: number,
  verticalDirection = 1,
): readonly (readonly [number, number])[] {
  if ([2, 17, 24].includes(symbol))
    return [
      [x, y + verticalDirection * radius],
      [x + radius, y - verticalDirection * radius],
      [x - radius, y - verticalDirection * radius],
    ];
  if ([6, 25].includes(symbol))
    return [
      [x, y - verticalDirection * radius],
      [x + radius, y + verticalDirection * radius],
      [x - radius, y + verticalDirection * radius],
    ];
  if ([5, 9, 18, 23].includes(symbol))
    return [
      [x, y + verticalDirection * radius],
      [x + radius, y],
      [x, y - verticalDirection * radius],
      [x - radius, y],
    ];
  return [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x + radius, y + radius],
    [x - radius, y + radius],
  ];
}
