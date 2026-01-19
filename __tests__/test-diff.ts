#!/usr/bin/env -S deno test --allow-read --allow-write

/*** NATIVE ------------------------------------------- ***/

import { assertEquals, assertExists } from "https://deno.land/std@0.200.0/assert/mod.ts";

/*** UTILITY ------------------------------------------ ***/

import { myersDiff, splitLines, createUnifiedDiff } from "../src/utils/diff-algorithm.ts";
import { diff } from "../src/api/diff.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";
import { FileSystem } from "../src/models/file-system.ts";

const fs = new FileSystem({
  promises: {
    readFile: (path: string) => Deno.readFile(path),
    writeFile: (path: string, data: Uint8Array) => Deno.writeFile(path, data),
    unlink: (path: string) => Deno.remove(path),
    readdir: (path: string) => Deno.readDir(path),
    mkdir: (path: string) => Deno.mkdir(path, { recursive: true }),
    rmdir: (path: string) => Deno.remove(path, { recursive: true }),
    stat: (path: string) => Deno.stat(path),
    lstat: (path: string) => Deno.lstat(path),
    readlink: (path: string) => Deno.readLink(path),
    symlink: (target: string, path: string) => Deno.symlink(target, path),
    chmod: (path: string, mode: number) => Deno.chmod(path, mode),
  }
});

/*** PROGRAM ------------------------------------------ ***/

Deno.test("Myers diff algorithm - basic test", () => {
  const old = ["a", "b", "c"];
  const new_ = ["a", "c", "d"];
  const edits = myersDiff(old, new_);

  assertEquals(edits.length, 3);
  assertEquals(edits[0].type, "equal");
  assertEquals(edits[1].type, "delete");
  assertEquals(edits[2].type, "insert");
});

Deno.test("Myers diff algorithm - identical sequences", () => {
  const old = ["line1", "line2", "line3"];
  const new_ = ["line1", "line2", "line3"];
  const edits = myersDiff(old, new_);

  assertEquals(edits.length, 1);
  assertEquals(edits[0].type, "equal");
});

Deno.test("Myers diff algorithm - complete replacement", () => {
  const old = ["a", "b", "c"];
  const new_ = ["x", "y", "z"];
  const edits = myersDiff(old, new_);
  const deletes = edits.filter(e => e.type === "delete");
  const inserts = edits.filter(e => e.type === "insert");

  assertEquals(deletes.length, 1);
  assertEquals(inserts.length, 1);
});

Deno.test("Split lines - handles various line endings", () => {
  const text1 = "line1\nline2\nline3";
  const lines1 = splitLines(text1);
  assertEquals(lines1, ["line1", "line2", "line3"]);

  const text2 = "line1\r\nline2\r\nline3\r\n";
  const lines2 = splitLines(text2);
  assertEquals(lines2, ["line1", "line2", "line3", ""]);

  const text3 = "";
  const lines3 = splitLines(text3);
  assertEquals(lines3, []);
});

Deno.test("Create unified diff", () => {
  const oldLines = ["line1", "line2", "line3", "line4", "line5"];
  const newLines = ["line1", "line2-modified", "line3", "line4", "line5", "line6"];
  const edits = myersDiff(oldLines, newLines);
  const unified = createUnifiedDiff(oldLines, newLines, edits, 2);

  assertExists(unified);
  // Should have hunk header
  assertEquals(unified[0].startsWith("@@"), true);
});

Deno.test("Diff API - basic file diff", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create and commit first file
    const file1 = `${testDir}/test.txt`;
    await Deno.writeTextFile(file1, "Hello\nWorld\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Initial commit",
      author: { name: "Test", email: "test@example.com" }
    });

    // Modify file
    await Deno.writeTextFile(file1, "Hello\nBeautiful\nWorld\n");

    // Get diff
    const result = await diff({
      fs,
      dir: testDir,
      ref1: "HEAD",
      filepath: "test.txt"
    });

    assertExists(result);
    assertEquals(result.files.length, 1);
    assertEquals(result.files[0].status, "modified");
    assertEquals(result.stats.filesChanged, 1);
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Diff API - new file detection", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create and commit first file
    const file1 = `${testDir}/test1.txt`;
    await Deno.writeTextFile(file1, "First file\n");
    await add({ fs, dir: testDir, filepath: "test1.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Initial commit",
      author: { name: "Test", email: "test@example.com" }
    });

    // Add new file
    const file2 = `${testDir}/test2.txt`;
    await Deno.writeTextFile(file2, "Second file\n");

    // Get diff
    const result = await diff({
      fs,
      dir: testDir,
      ref1: "HEAD"
    });

    assertExists(result);
    const newFile = result.files.find(f => f.newPath === "test2.txt");
    assertExists(newFile);
    assertEquals(newFile.status, "added");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Diff API - name only option", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create files
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Content 1");
    await Deno.writeTextFile(`${testDir}/file2.txt`, "Content 2");
    await add({ fs, dir: testDir, filepath: ["file1.txt", "file2.txt"] });
    await commit({
      fs,
      dir: testDir,
      message: "Initial commit",
      author: { name: "Test", email: "test@example.com" }
    });

    // Modify files
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Modified 1");
    await Deno.writeTextFile(`${testDir}/file2.txt`, "Modified 2");

    // Get diff with nameOnly
    const result = await diff({
      fs,
      dir: testDir,
      nameOnly: true
    });

    assertExists(result);
    assertEquals(result.files.length, 2);
    // With nameOnly, hunks should be empty
    assertEquals(result.files[0].hunks.length, 0);
    assertEquals(result.files[1].hunks.length, 0);
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});
