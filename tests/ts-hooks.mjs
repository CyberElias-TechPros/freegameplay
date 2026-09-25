// Custom ESM resolve hooks for running TypeScript sources under `node --test`.
//
// Node's type stripping handles the syntax, but it does NOT provide the
// extensionless-relative-import resolution TypeScript gives you for free
// (`from "./types"` → `./types.ts`). This adds exactly that and nothing else:
// no transpilation, no bundling, no dependency.
//
// Registered by ./ts-resolve.mjs via module.register().

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const isFileUrl = specifier.startsWith("file:");

  if (isRelative || isFileUrl) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== "ERR_MODULE_NOT_FOUND" && err?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw err;

      const base = isFileUrl
        ? fileURLToPath(specifier)
        : new URL(specifier, context.parentURL ?? pathToFileURL(`${process.cwd()}/`).href).pathname;

      for (const ext of TS_EXTENSIONS) {
        if (existsSync(base + ext)) {
          return nextResolve(pathToFileURL(base + ext).href, context);
        }
      }
      throw err;
    }
  }

  return nextResolve(specifier, context);
}
