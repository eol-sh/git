# Basic Git Workflow

This example demonstrates a complete Git workflow using @eol/git.

## Setup

```typescript
import * as git from "../../src/index.ts";
import { FileSystem } from "../../src/models/file-system.ts";

const fs = new FileSystem();
const programDir = "./my-project";
```

## 1. Initialize a New Repository

```typescript
// Create a new Git repository
await git.init({
  defaultBranch: "primary",
  dir: programDir,
  fs
});

console.log("Repository initialized!");
```

## 2. Configure User Information

```typescript
// Set up user configuration
await git.setConfig({
  dir: programDir,
  fs,
  path: "user.name",
  value: "Ada Developer"
});

await git.setConfig({
  dir: programDir,
  fs,
  path: "user.email",
  value: "ada@example.com"
});

console.log("User configuration set!");
```

## 3. Create and Add Files

```typescript
// Write some content to files (using Deno's built-in functions)
await Deno.writeTextFile(`${programDir}/README.md`, `# My Project

This is my awesome project built with Deno!

## Features

- Pure TypeScript
- Git integration
- Cross-platform
`);

await Deno.writeTextFile(`${programDir}/main.ts`, `// Main application file
console.log("Hello from Deno!");

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`);

// Stage the files
await git.add({
  dir: programDir,
  filepath: "README.md",
  fs
});

await git.add({
  dir: programDir,
  filepath: "main.ts",
  fs
});

console.log("Files staged!");
```

## 4. Check Repository Status

```typescript
// Check the status of files
const status = await git.statusMatrix({
  dir: programDir,
  fs
});

console.log("Repository status:");

for (const [filepath, head, workdir, stage] of status) {
  let statusText = "";

  if (head === 0 && workdir === 1 && stage === 1)
    statusText = "new file (staged)";
  else if (head === 1 && workdir === 2 && stage === 1)
    statusText = "modified (unstaged)";
  else if (head === 1 && workdir === 2 && stage === 2)
    statusText = "modified (staged)";
  else if (head === 1 && workdir === 0 && stage === 0)
    statusText = "deleted";

  console.log(`  ${filepath}: ${statusText}`);
}
```

## 5. Make Initial Commit

```typescript
// Create the initial commit
const commitSha = await git.commit({
  author: {
    email: "ada@example.com",
    name: "Ada Developer",
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: new Date().getTimezoneOffset()
  },
  dir: programDir,
  fs,
  message: "Initial commit: Add README and main application file"
});

console.log(`Initial commit created: ${commitSha}`);
```

## 6. View Commit History

```typescript
// Read the commit history
const commits = await git.log({
  depth: 5
  dir: programDir,
  fs,
  ref: "primary"
});

console.log("Commit history:");

for (const commit of commits) {
  const date = new Date(commit.commit.author.timestamp * 1000);

  console.group();
  console.log(`  ${commit.oid.substring(0, 7)} - ${commit.commit.message}`);
  console.log(`    Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
  console.log(`    Date: ${date.toISOString()}`);
  console.groupEnd();
}
```

## 7. Create and Switch to a Feature Branch

```typescript
// Create a new branch
await git.branch({
  checkout: true,
  dir: programDir,
  fs,
  ref: "feature/add-config"
});

console.log("Created and switched to feature branch");

// Verify current branch
const currentBranch = await git.currentBranch({
  dir: programDir,
  fs
});

console.log(`Current branch: ${currentBranch}`);
```

## 8. Make Changes on Feature Branch

```typescript
// Add a configuration file
await Deno.writeTextFile(`${programDir}/config.json`, JSON.stringify({
  appName: "My Deno App",
  environment: "development",
  features: {
    debugging: true,
    logging: true
  },
  version: "1.0.0"
}, null, 2));

// Stage and commit the new file
await git.add({
  dir: programDir,
  filepath: "config.json",
  fs
});

await git.commit({
  author: {
    email: "ada@example.com",
    name: "Ada Developer"
  },
  dir: programDir,
  fs,
  message: "Add application configuration file",
});

console.log("Added configuration file on feature branch");
```

## 9. Switch Back to Main and Merge

```typescript
// Switch back to primary branch
await git.checkout({
  dir: programDir,
  fs,
  ref: "primary"
});

// Merge the feature branch
await git.merge({
  author: {
    email: "ada@example.com",
    name: "Ada Developer"
  },
  dir: programDir,
  fs,
  ours: "primary",
  theirs: "feature/add-config"
});

console.log("Merged feature branch into primary");
```

## 10. View Final Repository State

```typescript
// List all branches
const branches = await git.listBranches({
  dir: programDir,
  fs
});

console.log("Branches:", branches);

// View final commit history
const finalCommits = await git.log({
  dir: programDir,
  fs,
  ref: "primary"
});

console.log("Final commit history:");

for (const commit of finalCommits) {
  console.log(`  ${commit.oid.substring(0, 7)} - ${commit.commit.message}`);
}
```

## Complete Example Script

```typescript
#!/usr/bin/env -S deno run --allow-read --allow-write

import * as git from "../../src/index.ts";
import { FileSystem } from "../../src/models/file-system.ts";

async function basicWorkflow() {
  const fs = new FileSystem();
  const programDir = "./my-project";

  try {
    // Clean up any existing directory
    try {
      await Deno.remove(programDir, { recursive: true });
    } catch {
      // Directory doesn’t exist, which is fine
    }

    // Initialize repository
    await git.init({ defaultBranch: "primary", dir: programDir, fs });

    // Configure user
    await git.setConfig({ dir: programDir, fs, path: "user.name", value: "Ada Developer" });
    await git.setConfig({ dir: programDir, fs, path: "user.email", value: "ada@example.com" });

    // Create files and make initial commit
    await Deno.writeTextFile(`${programDir}/README.md`, "# My Project\\n\\nAwesome Deno project!");
    await git.add({ dir: programDir, filepath: "README.md", fs });

    await git.commit({
      author: { email: "ada@example.com", name: "Ada Developer" },
      dir: programDir,
      fs,
      message: "Initial commit"
    });

    console.log("✅ Basic Git workflow completed successfully!");
  } catch(error) {
    console.error(`❌ Error during workflow: $error}`);
  }
}

if (import.meta.main)
  await basicWorkflow();
```

Run this example with:

```bash
deno run --allow-read --allow-write docs/examples/basic-workflow.md
```
