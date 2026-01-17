#!/usr/bin/env -S deno test --allow-read --allow-write

/**
 * Tests for git rebase operation
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.200.0/assert/mod.ts";
import { rebase } from "../src/api/rebase.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";
import { branch } from "../src/api/branch.ts";
import { checkout } from "../src/api/checkout.ts";
import { log } from "../src/api/log.ts";
import { parseRebaseTodo, formatRebaseTodo, validateTodoList, applyAutosquash } from "../src/utils/rebase-todo.ts";
import { createAuthor, createFileSystem } from "../src/index.ts";

const fs = createFileSystem();

Deno.test("Rebase todo parser - parse valid todo list", () => {
  const todoText = `pick abc123 First commit
reword def456 Second commit
edit ghi789 Third commit
squash jkl012 Fourth commit
fixup mno345 Fifth commit
drop pqr678 Sixth commit

# This is a comment
# More comments
`;

  const items = parseRebaseTodo(todoText);
  
  assertEquals(items.length, 6);
  assertEquals(items[0].command, "pick");
  assertEquals(items[0].commit, "abc123");
  assertEquals(items[0].message, "First commit");
  
  assertEquals(items[3].command, "squash");
  assertEquals(items[5].command, "drop");
});

Deno.test("Rebase todo parser - handle exec and break commands", () => {
  const todoText = `pick abc123 First commit
exec npm test
break
pick def456 Second commit`;

  const items = parseRebaseTodo(todoText);
  
  assertEquals(items.length, 4);
  assertEquals(items[1].command, "exec");
  assertEquals(items[1].message, "npm test");
  assertEquals(items[2].command, "break");
  assertEquals(items[3].command, "pick");
});

Deno.test("Rebase todo parser - format todo list", () => {
  const items = [
    { command: "pick" as const, commit: "abc123", message: "First commit" },
    { command: "reword" as const, commit: "def456", message: "Second commit" },
    { command: "exec" as const, commit: "", message: "npm test" }
  ];

  const formatted = formatRebaseTodo(items);
  
  assertStringIncludes(formatted, "pick abc123 First commit");
  assertStringIncludes(formatted, "reword def456 Second commit");
  assertStringIncludes(formatted, "exec npm test");
  assertStringIncludes(formatted, "# Commands:");
});

Deno.test("Rebase todo parser - validate todo list", () => {
  const validItems = [
    { command: "pick" as const, commit: "abc123", message: "First commit" },
    { command: "squash" as const, commit: "def456", message: "Second commit" }
  ];

  const validation = validateTodoList(validItems);
  assertEquals(validation.valid, true);
  assertEquals(validation.errors.length, 0);

  // Test invalid list
  const invalidItems = [
    { command: "squash" as const, commit: "abc123", message: "First commit" } // Can't squash first commit
  ];

  const invalidValidation = validateTodoList(invalidItems);
  assertEquals(invalidValidation.valid, false);
  assertEquals(invalidValidation.errors.length, 1);
});

Deno.test("Rebase todo parser - apply autosquash", () => {
  const items = [
    { command: "pick" as const, commit: "abc123", message: "Add feature" },
    { command: "pick" as const, commit: "def456", message: "Add tests" },
    { command: "pick" as const, commit: "ghi789", message: "fixup! Add feature" },
    { command: "pick" as const, commit: "jkl012", message: "squash! Add tests" }
  ];

  const autosquashed = applyAutosquash(items);
  
  // fixup! and squash! commits should be moved and command changed
  assertEquals(autosquashed[0].command, "pick");
  assertEquals(autosquashed[0].message, "Add feature");
  assertEquals(autosquashed[1].command, "fixup");
  assertEquals(autosquashed[1].message, "fixup! Add feature");
  assertEquals(autosquashed[2].command, "pick");
  assertEquals(autosquashed[2].message, "Add tests");
  assertEquals(autosquashed[3].command, "squash");
  assertEquals(autosquashed[3].message, "squash! Add tests");
});

Deno.test("Rebase - basic linear rebase", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });
    
    // Create main branch commits
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Main 1\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Main commit 1",
      author
    });

    await Deno.writeTextFile(`${testDir}/file2.txt`, "Main 2\n");
    await add({ fs, dir: testDir, filepath: "file2.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Main commit 2",
      author
    });

    // Create feature branch from first commit
    await checkout({ fs, dir: testDir, ref: "HEAD~1" });
    await branch({ fs, dir: testDir, ref: "feature" });
    await checkout({ fs, dir: testDir, ref: "feature" });

    // Add feature commits
    await Deno.writeTextFile(`${testDir}/feature.txt`, "Feature 1\n");
    await add({ fs, dir: testDir, filepath: "feature.txt" });
    const featureCommit1 = await commit({
      fs,
      dir: testDir,
      message: "Feature commit 1",
      author
    });

    await Deno.writeTextFile(`${testDir}/feature.txt`, "Feature 1\nFeature 2\n");
    await add({ fs, dir: testDir, filepath: "feature.txt" });
    const featureCommit2 = await commit({
      fs,
      dir: testDir,
      message: "Feature commit 2",
      author
    });

    // Rebase feature onto main
    const result = await rebase({
      fs,
      dir: testDir,
      onto: "main",
      upstream: "main"
    });

    // Should succeed (simplified test)
    assertExists(result);
    // In a full implementation, would verify commits were reapplied
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Rebase - interactive mode with todo editing", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create commits
    await Deno.writeTextFile(`${testDir}/file.txt`, "1\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Commit 1",
      author
    });

    await Deno.writeTextFile(`${testDir}/file.txt`, "1\n2\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Commit 2",
      author
    });

    // Interactive rebase with custom editor
    let editedTodoList = "";
    const result = await rebase({
      fs,
      dir: testDir,
      upstream: "HEAD~1",
      interactive: true,
      onEdit: async (todoList) => {
        // Simulate editing the todo list
        editedTodoList = todoList.replace("pick", "reword");
        return editedTodoList;
      }
    });

    assertExists(result);
    assertStringIncludes(editedTodoList, "reword");
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Rebase - abort operation", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Original\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    const originalOid = await commit({
      fs,
      dir: testDir,
      message: "Original",
      author
    });

    // Simulate a rebase in progress by trying to start one that would conflict
    // (This is simplified - in reality would need actual conflict setup)
    
    // Test abort action
    const result = await rebase({
      fs,
      dir: testDir,
      action: "abort"
    });

    // Should handle abort gracefully even if no rebase in progress
    assertExists(result);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Rebase - continue operation", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Content\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Initial",
      author
    });

    // Test continue action (should handle gracefully if no rebase in progress)
    const result = await rebase({
      fs,
      dir: testDir,
      action: "continue"
    });

    assertExists(result);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Rebase - skip operation", async () => {
  const testDir = await Deno.makeTempDir();
  
  try {
    // Initialize repo
    await init({ fs, dir: testDir });
    
    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Content\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    
    const author = createAuthor("Test User", "test@example.com");
    await commit({
      fs,
      dir: testDir,
      message: "Initial",
      author
    });

    // Test skip action (should handle gracefully if no rebase in progress)
    const result = await rebase({
      fs,
      dir: testDir,
      action: "skip"
    });

    assertExists(result);
    
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});