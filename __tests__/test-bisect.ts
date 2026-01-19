#!/usr/bin/env -S deno test --allow-read --allow-write

/*** NATIVE ------------------------------------------- ***/

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes
} from "https://deno.land/std@0.200.0/assert/mod.ts";

/*** UTILITY ------------------------------------------ ***/

import { bisect } from "../src/api/bisect.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";

import {
  checkBisectComplete,
  addBisectResult,
  validateBisectState,
  createInitialBisectState,
  calculateStepsRemaining
} from "../src/utils/bisect-algorithm.ts";

import { createAuthor, createFileSystem } from "../src/index.ts";

const fs = createFileSystem();

/*** PROGRAM ------------------------------------------ ***/

Deno.test("Bisect algorithm - create initial state", () => {
  const state = createInitialBisectState(
    "bad123",
    ["good456", "good789"],
    "start123"
  );

  assertEquals(state.bad, "bad123");
  assertEquals(state.good, ["good456", "good789"]);
  assertEquals(state.start, "start123");
  assertEquals(state.log.length, 0);
  assertEquals(state.names, {});
});

Deno.test("Bisect algorithm - validate state", () => {
  const validState = createInitialBisectState(
    "bad123",
    ["good456"],
    "start123"
  );

  const validation = validateBisectState(validState);
  assertEquals(validation.valid, true);
  assertEquals(validation.errors.length, 0);

  // Test invalid state - no good commits
  const invalidState = createInitialBisectState(
    "bad123",
    [],
    "start123"
  );

  const invalidValidation = validateBisectState(invalidState);
  assertEquals(invalidValidation.valid, false);
  assertEquals(invalidValidation.errors.length, 1);
  assertStringIncludes(invalidValidation.errors[0], "No good commits");
});

Deno.test("Bisect algorithm - add result", () => {
  const initialState = createInitialBisectState(
    "bad123",
    ["good456"],
    "start123"
  );

  const newState = addBisectResult(initialState, "test789", "good");

  assertEquals(newState.log.length, 1);
  assertEquals(newState.log[0].oid, "test789");
  assertEquals(newState.log[0].result, "good");
  assertEquals(newState.current, "test789");
  assertExists(newState.log[0].timestamp);
});

Deno.test("Bisect algorithm - check complete", () => {
  const state = createInitialBisectState(
    "bad123",
    ["good456"],
    "start123"
  );

  // Add some test results
  const stateWithResults = addBisectResult(
    addBisectResult(state, "commit1", "good"),
    "commit2",
    "bad"
  );

  const completion = checkBisectComplete(stateWithResults);

  // Should be complete with small number of commits
  assertEquals(completion.complete, true);
  assertExists(completion.culprit);
});

Deno.test("Bisect algorithm - calculate steps remaining", () => {
  const state = createInitialBisectState(
    "bad123",
    ["good456"],
    "start123"
  );

  const steps = calculateStepsRemaining(state);

  // Should be a reasonable number
  assertEquals(typeof steps, "number");
  assertEquals(steps >= 0, true);
});

Deno.test("Bisect - start session", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir, defaultBranch: "main" });

    // Create some commits
    const author = createAuthor("Test User", "test@example.com");

    // Create first commit (good)
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Good content\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });
    const goodCommit = await commit({
      fs,
      dir: testDir,
      message: "Good commit",
      author
    });

    // Create second commit (bad)
    await Deno.writeTextFile(`${testDir}/file2.txt`, "Bad content\n");
    await add({ fs, dir: testDir, filepath: "file2.txt" });
    // const badCommit = await commit({
    //   fs,
    //   dir: testDir,
    //   message: "Bad commit",
    //   author
    // });

    // Start bisect
    const result = await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: [goodCommit]
    });

    assertExists(result);
    assertEquals(typeof result.remaining, "number");
    assertEquals(typeof result.steps, "number");
    assertStringIncludes(result.message, "Bisecting");

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - mark good and bad", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    const author = createAuthor("Test User", "test@example.com");

    // Create commits
    await Deno.writeTextFile(`${testDir}/file.txt`, "1\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const commit1 = await commit({
      fs,
      dir: testDir,
      message: "Commit 1",
      author
    });

    await Deno.writeTextFile(`${testDir}/file.txt`, "1\n2\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    // const commit2 = await commit({
    //   fs,
    //   dir: testDir,
    //   message: "Commit 2",
    //   author
    // });

    await Deno.writeTextFile(`${testDir}/file.txt`, "1\n2\n3\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    // const commit3 = await commit({
    //   fs,
    //   dir: testDir,
    //   message: "Commit 3",
    //   author
    // });

    // Start bisect
    await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: [commit1]
    });

    // Mark current as bad
    const badResult = await bisect.bad({
      fs,
      dir: testDir
    });

    assertExists(badResult);
    assertEquals(typeof badResult.remaining, "number");

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - reset session", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    const author = createAuthor("Test User", "test@example.com");

    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Content\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    await commit({
      fs,
      dir: testDir,
      message: "Initial",
      author
    });

    // Start bisect
    await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: []
    });

    // Reset should work without errors
    await bisect.reset({
      fs,
      dir: testDir
    });

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - get log", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    const author = createAuthor("Test User", "test@example.com");

    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Content\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const commit1 = await commit({
      fs,
      dir: testDir,
      message: "Initial",
      author
    });

    // Start bisect
    await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: [commit1]
    });

    // Get log
    const log = await bisect.log({
      fs,
      dir: testDir
    });

    assertExists(log);
    assertEquals(Array.isArray(log), true);

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - skip commit", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    const author = createAuthor("Test User", "test@example.com");

    // Create commits
    await Deno.writeTextFile(`${testDir}/file.txt`, "1\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const commit1 = await commit({
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

    // Start bisect
    await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: [commit1]
    });

    // Skip current commit
    const result = await bisect.skip({
      fs,
      dir: testDir
    });

    assertExists(result);
    assertEquals(typeof result.remaining, "number");

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - error handling", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    // Try to start bisect twice (should fail)
    await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: []
    });

    // Second start should fail
    await assertRejects(
      async () => {
        await bisect.start({
          fs,
          dir: testDir,
          bad: "HEAD",
          good: []
        });
      },
      Error,
      "already in progress"
    );

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - custom terms", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    const author = createAuthor("Test User", "test@example.com");

    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Content\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const commit1 = await commit({
      fs,
      dir: testDir,
      message: "Initial",
      author
    });

    // Start bisect with custom terms
    const result = await bisect.start({
      fs,
      dir: testDir,
      bad: "HEAD",
      good: [commit1],
      terms: { good: "old", bad: "new" }
    });

    assertExists(result);
    assertEquals(typeof result.remaining, "number");

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Bisect - replay from file", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // Initialize repo
    await init({ fs, dir: testDir });

    const author = createAuthor("Test User", "test@example.com");

    // Create a commit
    await Deno.writeTextFile(`${testDir}/file.txt`, "Content\n");
    await add({ fs, dir: testDir, filepath: "file.txt" });
    const commit1 = await commit({
      fs,
      dir: testDir,
      message: "Initial",
      author
    });

    // Create replay file
    const replayContent = `# Bisect replay file
git bisect start
git bisect good ${commit1}
git bisect bad HEAD
`;
    await Deno.writeTextFile(`${testDir}/bisect.log`, replayContent);

    // Replay bisect
    const result = await bisect.replay({
      fs,
      dir: testDir,
      filename: "bisect.log"
    });

    assertExists(result);
    assertEquals(typeof result.remaining, "number");

  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});
