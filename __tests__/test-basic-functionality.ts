/*** deno test --allow-env __tests__/test-basic-functionality.ts --no-check ***/



//// util

import { Errors, version } from "../src/index.ts";
import type { PackageInfo } from "../src/types.ts";



//// program

Deno.test("basic module import", () => {
  if (typeof version !== "function")
    throw new Error("version function not imported correctly");

  if (!Errors || typeof Errors !== "object")
    throw new Error("Errors module not imported correctly");

  console.log("✅ Basic module import test passed");
});

Deno.test("errors module exists", () => {
  if (!Errors)
    throw new Error("Errors module is not defined");

  if (!Errors.BaseError)
    throw new Error("BaseError is not available in Errors module");

  console.log("✅ Errors module test passed");
});
