# Quick Usage Guide

This is a concise guide for using @eol/git.

## Installation & Import

```typescript
import * as git from "./src/index.ts";
import { FileSystem } from "./src/models/file-system.ts";
```

## Basic Setup

```typescript
const fs = new FileSystem();
const dir = "./my-repo";
```

## Essential Operations

### Initialize Repository
```typescript
await git.init({ defaultBranch: "primary", dir, fs });
```

### Clone Repository
```typescript
await git.clone({
  dir: "./cloned-repo",
  fs,
  url: "https://eol.sh/~user/program.git"
});
```

### Stage and Commit
```typescript
// Stage files
await git.add({ dir, filepath: "file.ts", fs });

// Commit changes
await git.commit({
  author: { email: "you@example.com", name: "You" },
  dir,
  fs,
  message: "Add new feature"
});
```

### Work with Branches
```typescript
// Create branch
await git.branch({ dir, fs, ref: "feature-branch" });

// Switch branch
await git.checkout({ dir, fs, ref: "feature-branch" });

// List branches
const branches = await git.listBranches({ dir, fs });
```

### Remote Operations
```typescript
// Add remote
await git.addRemote({
  dir,
  fs,
  remote: "origin",
  url: "https://eol.sh/~user/program.git"
});

// Fetch changes
await git.fetch({ dir, fs, remote: "origin" });

// Push changes
await git.push({ dir, fs, ref: "primary", remote: "origin" });
```

### Check Status
```typescript
const status = await git.statusMatrix({ dir, fs });
// Returns: [filepath, HEAD, WORKDIR, STAGE]
// 0=absent, 1=present, 2=modified, 3=added
```

## Running Scripts

Save your script and run with appropriate permissions:

```bash
deno run --allow-read --allow-write --allow-net script.ts
```

## Authentication

For private repositories:

```typescript
await git.clone({
  dir: "./private-repo",
  fs,
  onAuth: () => ({
    password: "your-token",
    username: "your-username"
  }),
  url: "https://eol.sh/~user/private.git"
});
```

That's it! You now have a complete Git client running in Deno. Check the full [README.md](./README.md) for comprehensive documentation.
