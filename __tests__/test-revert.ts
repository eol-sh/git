#!/usr/bin/env -S deno test --allow-read --allow-write

/*** NATIVE ------------------------------------------- ***/

import { assertEquals, assertExists } from "https://deno.land/std@0.200.0/assert/mod.ts";

/*** UTILITY ------------------------------------------ ***/

import { revert } from "../src/api/revert.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";
import { log } from "../src/api/log.ts";
import { createAuthor, createFileSystem } from "../src/index.ts";

const fs = createFileSystem();

/*** PROGRAM ------------------------------------------ ***/

Deno.test("Revert - basic commit reversion", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create initial commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Line 1\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });

    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Initial commit",
      author
    });

    // Add a line
    await Deno.writeTextFile(`${testDir}/file.txt`, "Line 1\nLine 2\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const addOid = await commit({
      fs,
      dir: testDir,
      message: "Add Line 2",
      author
    });

    // Revert the addition
    const revertOid = await revert({
      fs,
      dir: testDir,
      oid: addOid
    });

    assertExists(revertOid);

    // Check file content is reverted
    const content = await Deno.readTextFile(`${testDir}/file.txt`);
    assertEquals(content, "Line 1\n");

    // Check revert commit message
    const commits = await log({ fs, dir: testDir, depth: 1 });
    assertExists(commits[0]);
    assertEquals(commits[0].oid, revertOid);
    assertExists(commits[0].commit.message.includes("Revert"));
    assertExists(commits[0].commit.message.includes(addOid));
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Revert - with custom message", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create commits
    await Deno.writeTextFile(`${testDir}/file.txt`, "Original\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });

    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Original",
      author
    });

    await Deno.writeTextFile(`${testDir}/file.txt`, "Modified\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const modifyOid = await commit({
      fs,
      dir: testDir,
      message: "Breaking change",
      author
    });

    // Revert with custom message
    const revertOid = await revert({
      fs,
      dir: testDir,
      oid: modifyOid,
      message: "Emergency rollback of breaking change"
    });

    assertExists(revertOid);

    // Check custom message
    const commits = await log({ fs, dir: testDir, depth: 1 });
    assertEquals(commits[0].commit.message, "Emergency rollback of breaking change");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Revert - no-commit option", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create commits
    await Deno.writeTextFile(`${testDir}/file.txt`, "Version 1\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });

    // const author = createAuthor("Test User", "test@example.com");

    // const v1Oid = await commit({
    //   fs,
    //   dir: testDir,
    //   message: "Version 1",
    //   author
    // });

    await Deno.writeTextFile(`${testDir}/file.txt`, "Version 2\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const v2Oid = await commit({
      fs,
      dir: testDir,
      message: "Version 2",
      author
    });

    // Revert without committing
    const result = await revert({
      fs,
      dir: testDir,
      oid: v2Oid,
      noCommit: true
    });

    // Should return null when no-commit
    assertEquals(result, null);

    // File should be reverted in working directory
    const content = await Deno.readTextFile(`${testDir}/file.txt`);
    assertEquals(content, "Version 1\n");

    // No new commit should be created
    const commits = await log({ fs, dir: testDir, depth: 1 });
    assertEquals(commits[0].oid, v2Oid);
    assertEquals(commits[0].commit.message, "Version 2");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Revert - multiple file changes", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create initial state
    await Deno.writeTextFile(`${testDir}/file1.txt`, "File 1 original\n");
    await Deno.writeTextFile(`${testDir}/file2.txt`, "File 2 original\n");
    await add({ fs, dir: testDir, filepath: ["file1.txt", "file2.txt"] });

    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Initial state",
      author
    });

    // Make changes to both files
    await Deno.writeTextFile(`${testDir}/file1.txt`, "File 1 modified\n");
    await Deno.writeTextFile(`${testDir}/file2.txt`, "File 2 modified\n");
    await add({ fs, dir: testDir, filepath: ["file1.txt", "file2.txt"] });
    const changeOid = await commit({
      fs,
      dir: testDir,
      message: "Modify both files",
      author
    });

    // Revert the changes
    const revertOid = await revert({
      fs,
      dir: testDir,
      oid: changeOid
    });

    assertExists(revertOid);

    // Both files should be reverted
    const content1 = await Deno.readTextFile(`${testDir}/file1.txt`);
    const content2 = await Deno.readTextFile(`${testDir}/file2.txt`);
    assertEquals(content1, "File 1 original\n");
    assertEquals(content2, "File 2 original\n");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Revert - file deletion reversion", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Create a file
    await Deno.writeTextFile(`${testDir}/important.txt`, "Important data\n");
    await add({ fs, dir: testDir, filepath: "important.txt" });

    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Add important file",
      author
    });

    // Delete the file
    await Deno.remove(`${testDir}/important.txt`);
    await add({ fs, dir: testDir, filepath: "important.txt" });
    const deleteOid = await commit({
      fs,
      dir: testDir,
      message: "Delete important file",
      author
    });

    // Revert the deletion
    const revertOid = await revert({
      fs,
      dir: testDir,
      oid: deleteOid
    });

    assertExists(revertOid);

    // File should be restored
    const exists = await Deno.stat(`${testDir}/important.txt`).then(() => true).catch(() => false);
    assertEquals(exists, true);

    const content = await Deno.readTextFile(`${testDir}/important.txt`);
    assertEquals(content, "Important data\n");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});
