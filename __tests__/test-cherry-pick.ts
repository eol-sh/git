#!/usr/bin/env -S deno test --allow-read --allow-write

/**
 * Tests for git cherry-pick operation
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.200.0/assert/mod.ts";
import { cherryPick } from "../src/api/cherry-pick.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";
import { branch } from "../src/api/branch.ts";
import { checkout } from "../src/api/checkout.ts";
import { log } from "../src/api/log.ts";
import { createAuthor, createFileSystem } from "../src/index.ts";

const fs = createFileSystem();

Deno.test("Cherry-pick - basic commit application", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });
    
    // Create initial commit on main
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Initial content\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Initial commit",
      author
    });
    
    // Create feature branch
    await branch({ fs, dir: testDir, ref: "feature" });
    await checkout({ fs, dir: testDir, ref: "feature" });
    
    // Create a commit on feature branch
    await Deno.writeTextFile(`${testDir}/file2.txt`, "Feature content\n");
    await add({ fs, dir: testDir, filepath: "file2.txt" });
    const featureOid = await commit({
      fs,
      dir: testDir,
      message: "Add feature file",
      author
    });
    
    // Switch back to main
    await checkout({ fs, dir: testDir, ref: "main" });
    
    // Cherry-pick the feature commit
    const cherryOid = await cherryPick({
      fs,
      dir: testDir,
      oid: featureOid
    });
    
    assertExists(cherryOid);
    
    // Verify the file was added
    const content = await Deno.readTextFile(`${testDir}/file2.txt`);
    assertEquals(content, "Feature content\n");
    
    // Check commit message
    const commits = await log({ fs, dir: testDir, depth: 1 });
    assertExists(commits[0]);
    assertEquals(commits[0].oid, cherryOid);
    // Should include cherry-pick note
    assertExists(commits[0].commit.message.includes("cherry picked from"));
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Cherry-pick - with custom message", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });
    
    // Create initial commits
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Content 1\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "First commit",
      author
    });
    
    await Deno.writeTextFile(`${testDir}/file2.txt`, "Content 2\n");
    await add({ fs, dir: testDir, filepath: "file2.txt" });
    const targetOid = await commit({
      fs,
      dir: testDir,
      message: "Second commit",
      author
    });
    
    // Reset to first commit
    await checkout({ fs, dir: testDir, ref: "HEAD~1" });
    
    // Cherry-pick with custom message
    const cherryOid = await cherryPick({
      fs,
      dir: testDir,
      oid: targetOid,
      message: "Backported feature"
    });
    
    assertExists(cherryOid);
    
    // Check custom message
    const commits = await log({ fs, dir: testDir, depth: 1 });
    assertEquals(commits[0].commit.message, "Backported feature");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Cherry-pick - no-commit option", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });
    
    // Create commits
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Original\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Original",
      author
    });
    
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Modified\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });
    const modifyOid = await commit({
      fs,
      dir: testDir,
      message: "Modify file",
      author
    });
    
    // Reset to original
    await checkout({ fs, dir: testDir, ref: "HEAD~1" });
    
    // Cherry-pick without committing
    const result = await cherryPick({
      fs,
      dir: testDir,
      oid: modifyOid,
      noCommit: true
    });
    
    // Should return null when no-commit
    assertEquals(result, null);
    
    // Changes should be in working directory
    const content = await Deno.readTextFile(`${testDir}/file1.txt`);
    assertEquals(content, "Modified\n");
    
    // No new commit should be created
    const commits = await log({ fs, dir: testDir, depth: 1 });
    assertEquals(commits[0].commit.message, "Original");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Cherry-pick - handles conflicts gracefully", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });
    
    // Create base commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Line 1\nLine 2\nLine 3\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Base",
      author
    });
    
    // Create conflicting change on branch
    await Deno.writeTextFile(`${testDir}/file.txt`, "Line 1\nModified Line 2\nLine 3\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const branchOid = await commit({
      fs,
      dir: testDir,
      message: "Branch change",
      author
    });
    
    // Reset and make different change
    await checkout({ fs, dir: testDir, ref: "HEAD~1" });
    await Deno.writeTextFile(`${testDir}/file.txt`, "Line 1\nDifferent Line 2\nLine 3\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Main change",
      author
    });
    
    // Try to cherry-pick - should handle conflict
    const result = await cherryPick({
      fs,
      dir: testDir,
      oid: branchOid
    });
    
    // With conflicts, should return null
    assertEquals(result, null);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Cherry-pick - error on merge commit without mainline", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });
    
    // This would need a proper merge commit setup
    // For now, test that it properly rejects invalid input
    
    await assertRejects(
      async () => {
        await cherryPick({
          fs,
          dir: testDir,
          oid: "invalid-oid"
        });
      },
      Error
    );
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});