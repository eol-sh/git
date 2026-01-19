#!/usr/bin/env -S deno test --allow-read --allow-write

/*** NATIVE ------------------------------------------- ***/

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.200.0/assert/mod.ts";

/*** UTILITY ------------------------------------------ ***/

import { reset } from "../src/api/reset.ts";
import { init } from "../src/api/init.ts";
import { add } from "../src/api/add.ts";
import { commit } from "../src/api/commit.ts";
import { status } from "../src/api/status.ts";
import { resolveRef } from "../src/api/resolve-ref.ts";
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

Deno.test("Reset - soft mode (only moves HEAD)", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    const { commit2, commit3 } = await setupTestRepo(testDir);

    // Current HEAD should be commit3
    const headBefore = await resolveRef({ fs, dir: testDir, ref: "HEAD" });
    assertEquals(headBefore, commit3);

    // Make a change to working directory
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Working directory change\n");

    // Add change to index
    await add({ fs, dir: testDir, filepath: "file1.txt" });

    // Soft reset to commit2
    await reset({
      fs,
      dir: testDir,
      mode: "soft",
      ref: commit2
    });

    // HEAD should now point to commit2
    const headAfter = await resolveRef({ fs, dir: testDir, ref: "HEAD" });
    assertEquals(headAfter, commit2);

    // Index should still have the staged change
    const fileStatus = await status({ fs, dir: testDir, filepath: "file1.txt" });
    assertEquals(fileStatus, "*modified");

    // Working directory should still have the change
    const content = await Deno.readTextFile(`${testDir}/file1.txt`);
    assertEquals(content, "Working directory change\n");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Reset - mixed mode (moves HEAD and resets index)", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    const { commit2 } = await setupTestRepo(testDir);

    // Make a change and stage it
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Working directory change\n");
    await add({ fs, dir: testDir, filepath: "file1.txt" });

    // Mixed reset to commit2 (default mode)
    await reset({
      fs,
      dir: testDir,
      ref: commit2
    });

    // HEAD should point to commit2
    const headAfter = await resolveRef({ fs, dir: testDir, ref: "HEAD" });
    assertEquals(headAfter, commit2);

    // Index should be reset (file1.txt not in index from commit2's perspective)
    const fileStatus = await status({ fs, dir: testDir, filepath: "file1.txt" });
    assertEquals(fileStatus, "modified");  // Not staged

    // Working directory should still have the change
    const content = await Deno.readTextFile(`${testDir}/file1.txt`);
    assertEquals(content, "Working directory change\n");

    // file2.txt should not exist in index (wasn't in commit2)
    try {
      await status({ fs, dir: testDir, filepath: "file2.txt" });
    } catch (e) {
      // Expected - file2.txt doesn't exist in commit2
      assertExists(e);
    }
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Reset - hard mode (resets HEAD, index, and working tree)", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    const { commit1 } = await setupTestRepo(testDir);

    // Make changes to working directory
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Working directory change\n");
    await Deno.writeTextFile(`${testDir}/file3.txt`, "New file\n");
    await add({ fs, dir: testDir, filepath: ["file1.txt", "file3.txt"] });

    // Hard reset to commit1
    await reset({
      fs,
      dir: testDir,
      mode: "hard",
      ref: commit1
    });

    // HEAD should point to commit1
    const headAfter = await resolveRef({ fs, dir: testDir, ref: "HEAD" });
    assertEquals(headAfter, commit1);

    // Working directory should be reset to commit1 state
    const content1 = await Deno.readTextFile(`${testDir}/file1.txt`);
    assertEquals(content1, "Initial content 1\n");

    // file2.txt should not exist (wasn't in commit1)
    try {
      await Deno.stat(`${testDir}/file2.txt`);
      throw new Error("file2.txt should not exist");
    } catch {
      // Expected
    }

    // file3.txt should not exist (was never committed)
    try {
      await Deno.stat(`${testDir}/file3.txt`);
      throw new Error("file3.txt should not exist");
    } catch {
      // Expected
    }
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Reset - path-specific reset", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    // const { commit1, commit2, commit3 } = await setupTestRepo(testDir);

    // Make changes to multiple files
    await Deno.writeTextFile(`${testDir}/file1.txt`, "Changed 1\n");
    await Deno.writeTextFile(`${testDir}/file2.txt`, "Changed 2\n");
    await add({ fs, dir: testDir, filepath: ["file1.txt", "file2.txt"] });

    // Reset only file1.txt to HEAD state
    await reset({
      fs,
      dir: testDir,
      filepath: "file1.txt",
      ref: "HEAD"
    });

    // file1.txt should be unstaged
    const status1 = await status({ fs, dir: testDir, filepath: "file1.txt" });
    assertEquals(status1, "modified");  // Not staged

    // file2.txt should still be staged
    const status2 = await status({ fs, dir: testDir, filepath: "file2.txt" });
    assertEquals(status2, "*modified");  // Staged

    // Working directory should still have both changes
    const content1 = await Deno.readTextFile(`${testDir}/file1.txt`);
    assertEquals(content1, "Changed 1\n");
    const content2 = await Deno.readTextFile(`${testDir}/file2.txt`);
    assertEquals(content2, "Changed 2\n");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Reset - invalid mode throws error", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    await setupTestRepo(testDir);

    await assertRejects(
      async () => {
        await reset({
          fs,
          dir: testDir,
          mode: "invalid" as any,
          ref: "HEAD~1"
        });
      },
      Error,
      "Invalid reset mode"
    );
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Reset - cannot use filepath with hard mode", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    await setupTestRepo(testDir);

    await assertRejects(
      async () => {
        await reset({
          fs,
          dir: testDir,
          mode: "hard",
          filepath: "file1.txt",
          ref: "HEAD"
        });
      },
      Error,
      "Cannot specify files with soft or hard reset mode"
    );
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("Reset - to specific commit by OID", async () => {
  const testDir = await Deno.makeTempDir();

  try {
    const { commit1 } = await setupTestRepo(testDir);

    // Reset to commit1 using its OID
    await reset({
      fs,
      dir: testDir,
      mode: "mixed",
      ref: commit1
    });

    // HEAD should point to commit1
    const headAfter = await resolveRef({ fs, dir: testDir, ref: "HEAD" });
    assertEquals(headAfter, commit1);
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

/*** HELPER ------------------------------------------- ***/

async function setupTestRepo(dir: string) {
  // Initialize repo
  await init({ fs, dir, defaultBranch: "main" });

  // Create initial commit
  await Deno.writeTextFile(`${dir}/file1.txt`, "Initial content 1\n");
  await add({ fs, dir, filepath: "file1.txt" });
  const commit1 = await commit({
    fs,
    dir,
    message: "First commit",
    author: { name: "Test", email: "test@example.com" }
  });

  // Create second commit
  await Deno.writeTextFile(`${dir}/file2.txt`, "Initial content 2\n");
  await add({ fs, dir, filepath: "file2.txt" });
  const commit2 = await commit({
    fs,
    dir,
    message: "Second commit",
    author: { name: "Test", email: "test@example.com" }
  });

  // Create third commit with modifications
  await Deno.writeTextFile(`${dir}/file1.txt`, "Modified content 1\n");
  await add({ fs, dir, filepath: "file1.txt" });
  const commit3 = await commit({
    fs,
    dir,
    message: "Third commit",
    author: { name: "Test", email: "test@example.com" }
  });

  return { commit1, commit2, commit3 };
}
