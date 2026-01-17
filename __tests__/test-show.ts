#!/usr/bin/env -S deno test --allow-read --allow-write

/**
 * Tests for git show operation
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.200.0/assert/mod.ts";
import { show } from "../src/api/show.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";
import { tag } from "../src/api/tag.ts";
import { createAuthor, createFileSystem } from "../src/index.ts";

const fs = createFileSystem();

Deno.test("Show - display current commit", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Test content\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    const oid = await commit({
      fs,
      dir: testDir,
      message: "Test commit message",
      author
    });
    
    // Show current commit
    const output = await show({ fs, dir: testDir });
    
    assertExists(output);
    assertStringIncludes(output, `commit ${oid}`);
    assertStringIncludes(output, "Test User");
    assertStringIncludes(output, "test@example.com");
    assertStringIncludes(output, "Test commit message");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Show - oneline format", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Test content\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    const oid = await commit({
      fs,
      dir: testDir,
      message: "Test commit message\nWith multiple lines",
      author
    });
    
    // Show in oneline format
    const output = await show({ fs, dir: testDir, format: "oneline" });
    
    assertExists(output);
    // Should be a single line with abbreviated OID and first line of message
    assertEquals(output.split("\n").length, 1);
    assertStringIncludes(output, oid.slice(0, 7));
    assertStringIncludes(output, "Test commit message");
    // Should not include second line
    assertEquals(output.includes("With multiple lines"), false);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Show - short format", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Test content\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    const oid = await commit({
      fs,
      dir: testDir,
      message: "Test commit",
      author
    });
    
    // Show in short format
    const output = await show({ fs, dir: testDir, format: "short" });
    
    assertExists(output);
    assertStringIncludes(output, `commit ${oid.slice(0, 7)}`);
    assertStringIncludes(output, "Author: Test User");
    assertStringIncludes(output, "Test commit");
    // Should not include date in short format
    assertEquals(output.includes("Date:"), false);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Show - raw format", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Test content\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Test commit",
      author
    });
    
    // Show in raw format
    const output = await show({ fs, dir: testDir, format: "raw" });
    
    assertExists(output);
    // Raw format should show git internal format
    assertStringIncludes(output, "tree ");
    assertStringIncludes(output, "author Test User");
    assertStringIncludes(output, "committer Test User");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Show - specific commit by ref", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create first commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "First\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "First commit",
      author
    });
    
    // Create second commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Second\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Second commit",
      author
    });
    
    // Show first commit (HEAD~1)
    const output = await show({ fs, dir: testDir, ref: "HEAD~1" });
    
    assertExists(output);
    assertStringIncludes(output, "First commit");
    assertEquals(output.includes("Second commit"), false);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Show - display tag", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Test content\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Test commit",
      author
    });
    
    // Create an annotated tag
    await tag({
      fs,
      dir: testDir,
      ref: "v1.0.0",
      message: "Version 1.0.0 release",
      tagger: author
    });
    
    // Show the tag
    const output = await show({ fs, dir: testDir, ref: "v1.0.0" });
    
    assertExists(output);
    // Should show tag information
    assertStringIncludes(output, "Tag:");
    assertStringIncludes(output, "Tagger:");
    assertStringIncludes(output, "Version 1.0.0 release");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Show - fuller format shows all details", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/test.txt`, "Test content\n");
    await add({ fs, dir: testDir, filepath: "test.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    const oid = await commit({
      fs,
      dir: testDir,
      message: "Test commit",
      author
    });
    
    // Show in fuller format
    const output = await show({ fs, dir: testDir, format: "fuller" });
    
    assertExists(output);
    assertStringIncludes(output, `commit ${oid}`);
    assertStringIncludes(output, "Author:");
    assertStringIncludes(output, "AuthorDate:");
    assertStringIncludes(output, "Commit:");
    assertStringIncludes(output, "CommitDate:");
    assertStringIncludes(output, "Test commit");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});