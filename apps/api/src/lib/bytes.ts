/** Prisma Bytes fields want a Uint8Array backed by a plain ArrayBuffer. */
export function asBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
