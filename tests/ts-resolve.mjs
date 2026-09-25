// Registers the TypeScript resolve hooks (see ./ts-hooks.mjs) so that
// `node --test` can execute the repo's .ts sources directly.
//
//   node --experimental-strip-types --import ./tests/ts-resolve.mjs --test tests/*.test.ts

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-hooks.mjs", pathToFileURL(import.meta.dirname + "/"));
