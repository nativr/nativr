export class RequiredExampleProfileError extends Error {
  readonly code: string;
  constructor(code: string);
}
export function createRequiredExampleProfileReport(
  input: unknown,
  expected: unknown,
): Readonly<Record<string, unknown>>;
