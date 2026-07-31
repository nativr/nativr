import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Serve built Wasm assets over loopback so the browser bundle follows its production fetch path. */
export async function serveWasmAssets(assetRoot) {
  const assets = new Map(
    await Promise.all(
      ["web-tree-sitter.wasm", "tree-sitter-r.wasm"].map(async (name) => [
        `/${name}`,
        await readFile(path.join(assetRoot, name)),
      ]),
    ),
  );
  const server = createServer((request, response) => {
    const contents = assets.get(request.url ?? "");
    if (contents === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/wasm",
      "Content-Length": contents.byteLength,
      "Cache-Control": "no-store",
    });
    response.end(contents);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Unable to resolve the loopback Wasm asset server address.");
  }
  const base = `http://127.0.0.1:${address.port}`;
  return {
    assets: {
      treeSitterRuntimeWasm: `${base}/web-tree-sitter.wasm`,
      rGrammarWasm: `${base}/tree-sitter-r.wasm`,
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
}
