declare module "bz2" {
  interface Bz2Module {
    decompress(data: Uint8Array, checkCrc?: boolean): Uint8Array;
  }

  const bz2: Bz2Module;
  export default bz2;
}
