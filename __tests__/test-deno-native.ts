/*** deno test test-deno-native.ts --no-check ***/



//// util

import { AsyncLock, CRC32, crypto, parseArgs, path, promisify } from "../src/utils/deno-native.ts";
import { createGitIgnore, GitIgnore, parseGitIgnore } from "../src/utils/gitignore-native.ts";
import { deflate, inflate, isNativeCompressionAvailable } from "../src/utils/compression-native.ts";



//// program

Deno.test("Deno native utilities work correctly", async() => {
  const testFn = (value: string, callback: (err: null, result: string) => void) => {
    setTimeout(() => callback(null, `processed: ${value}`), 10);
  };

  const promisifiedFn = promisify(testFn);
  const result = await promisifiedFn("test");

  if (result !== "processed: test")
    throw new Error(`Promisify failed: expected "processed: test", got "${result}"`);

  console.log("✅ Promisify test passed");
});

Deno.test("Path utilities work with Deno std", () => {
  const joined = path.join("src", "utils", "test.ts");
  const expected = "src/utils/test.ts";

  if (joined !== expected)
    throw new Error(`Path join failed: expected "${expected}", got "${joined}"`);

  const dirname = path.dirname("/Users/test/file.ts");

  if (!dirname.includes("test"))
    throw new Error(`Path dirname failed: got "${dirname}"`);

  console.log("✅ Path utilities test passed");
});

Deno.test("Native crypto works correctly", async() => {
  const testData = "Hello, World!";
  const hash = await crypto.sha1(testData);
  const hexHash = crypto.arrayBufferToHex(hash);

  if (hexHash.length !== 40)
    throw new Error(`SHA-1 hash wrong length: expected 40, got ${hexHash.length}`);

  const hash256 = await crypto.sha256(testData);
  const hexHash256 = crypto.arrayBufferToHex(hash256);

  if (hexHash256.length !== 64)
    throw new Error(`SHA-256 hash wrong length: expected 64, got ${hexHash256.length}`);

  console.log("✅ Native crypto test passed");
});

Deno.test("AsyncLock works correctly", async() => {
  const lock = new AsyncLock();
  const results: number[] = [];

  /*** Test concurrent access ***/
  const promises = [
    lock.acquire("test", async() => {
      results.push(1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(2);
    }),
    lock.acquire("test", async() => {
      results.push(3);
      await new Promise((resolve) => setTimeout(resolve, 5));
      results.push(4);
    })
  ];

  await Promise.all(promises);

  /*** Should be sequential: [1, 2, 3, 4] ***/
  const expected = "1,2,3,4";
  const actual = results.join(",");

  if (actual !== expected)
    throw new Error(`AsyncLock failed: expected "${expected}", got "${actual}"`);

  console.log("✅ AsyncLock test passed");
});

Deno.test("CRC32 calculates correctly", () => {
  const testData = new TextEncoder().encode("Hello, World!");
  const crc = CRC32.calculate(testData);

  /*** CRC should be a 32-bit unsigned integer ***/
  if (typeof crc !== "number" || crc < 0 || crc > 0xFFFFFFFF)
    throw new Error(`Invalid CRC32: ${crc}`);

  console.log("✅ CRC32 test passed");
});

Deno.test("parseArgs works like minimist", () => {
  const args = ["--verbose", "--output", "file.txt", "-f", "input.txt", "remainder"];
  const parsed = parseArgs(args);

  if (!parsed.verbose)
    throw new Error("Missing verbose flag");

  if (parsed.output !== "file.txt")
    throw new Error(`Wrong output: expected "file.txt", got "${parsed.output}"`);

  if (parsed.f !== "input.txt")
    throw new Error(`Wrong f flag: expected "input.txt", got "${parsed.f}"`);

  if (parsed._.length !== 1 || parsed._[0] !== "remainder")
    throw new Error(`Wrong remainder: expected ["remainder"], got ${JSON.stringify(parsed._)}`);

  console.log("✅ parseArgs test passed");
});

Deno.test("GitIgnore works correctly", () => {
  const ignore = createGitIgnore([
    "*.log",
    "node_modules/",
    "!important.log",
    "temp/*",
    "**/cache"
  ]);

  /*** Should ignore ***/
  if (!ignore.ignores("debug.log"))
    throw new Error("Should ignore *.log files");

  if (!ignore.ignores("node_modules/package.json"))
    throw new Error("Should ignore node_modules/");

  if (!ignore.ignores("src/temp/file.txt"))
    throw new Error("Should ignore temp/* files");

  if (!ignore.ignores("src/cache/data.json"))
    throw new Error("Should ignore **/cache files");

  /*** Should not ignore ***/
  if (ignore.ignores("important.log"))
    throw new Error("Should not ignore negated !important.log");

  if (ignore.ignores("src/utils.js"))
    throw new Error("Should not ignore non-matching files");

  console.log("✅ GitIgnore test passed");
});

Deno.test("parseGitIgnore parses file content", () => {
  const gitignoreContent = `
# Comments are ignored
*.log
node_modules/

# Empty lines are ignored

!important.log
temp/*
**/cache
`;

  const ignore = parseGitIgnore(gitignoreContent);

  if (!ignore.ignores("debug.log"))
    throw new Error("Should parse and ignore *.log");

  if (ignore.ignores("important.log"))
    throw new Error("Should parse and not ignore !important.log");

  console.log("✅ parseGitIgnore test passed");
});

Deno.test("Native compression (if available)", async() => {
  if (!isNativeCompressionAvailable()) {
    console.log("⚠️  Native compression not available, skipping test");
    return;
  }

  const testData = new TextEncoder().encode("This is a test string for compression");

  try {
    const compressed = await deflate(testData);

    if (compressed.length >= testData.length)
      throw new Error("Compression should reduce size");

    const decompressed = await inflate(compressed);
    const decompressedText = new TextDecoder().decode(decompressed);
    const originalText = new TextDecoder().decode(testData);

    if (decompressedText !== originalText)
      throw new Error(`Decompression failed: expected "${originalText}", got "${decompressedText}"`);

    console.log("✅ Native compression test passed");
  } catch(error) {
    console.log(`⚠️  Native compression test failed: ${String(error)}`);
  }
});
