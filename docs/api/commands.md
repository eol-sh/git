# Core Commands API Reference

This document provides detailed information about the core Git commands available in @eol/git.

## Repository Management

### `init(options)`

Initialize a new Git repository.

```typescript
interface InitOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  bare?: boolean;
  defaultBranch?: string;
}

await git.init({
  fs,
  dir: "./new-repo",
  defaultBranch: "main"
});
```

**Parameters:**
- `fs`: Filesystem interface
- `dir`: Repository directory path
- `gitdir`: Git directory path (defaults to `${dir}/.git`)
- `bare`: Create a bare repository (default: false)
- `defaultBranch`: Initial branch name (default: "master")

### `clone(options)`

Clone a remote repository.

```typescript
interface CloneOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  url: string;
  ref?: string;
  singleBranch?: boolean;
  depth?: number;
  since?: Date;
  exclude?: string[];
  relative?: boolean;
  onAuth?: AuthCallback;
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
}

await git.clone({
  fs,
  dir: "./cloned-repo",
  url: "https://eol.sh/~user/program.git",
  depth: 1
});
```

**Parameters:**
- `url`: Repository URL to clone
- `ref`: Branch/tag/commit to clone (default: remote HEAD)
- `singleBranch`: Clone only specified branch (default: false)
- `depth`: Shallow clone depth
- `since`: Shallow clone since date
- `exclude`: Exclude branches matching patterns
- `onAuth`: Authentication callback
- `onProgress`: Progress callback

## File Operations

### `add(options)`

Stage files for commit.

```typescript
interface AddOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  filepath: string;
  cache?: Map<string, any>;
}

// Stage a single file
await git.add({
  fs,
  dir: "./repo",
  filepath: "src/main.ts"
});

// Stage all files
await git.add({
  fs,
  dir: "./repo",
  filepath: "."
});
```

### `remove(options)`

Remove files from the index and working directory.

```typescript
interface RemoveOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  filepath: string;
  cache?: Map<string, any>;
}

await git.remove({
  fs,
  dir: "./repo",
  filepath: "old-file.txt"
});
```

### `statusMatrix(options)`

Get the status of files in the repository.

```typescript
interface StatusMatrixOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ref?: string;
  filepaths?: string[];
  filter?: (f: string) => boolean;
  cache?: Map<string, any>;
}

const status = await git.statusMatrix({
  fs,
  dir: "./repo"
});

// Returns: Array<[filepath, HEAD, WORKDIR, STAGE]>
// 0 = absent, 1 = present, 2 = modified, 3 = added
```

## Commit Operations

### `commit(options)`

Create a new commit.

```typescript
interface CommitOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  message: string;
  author?: Author;
  committer?: Committer;
  parent?: string[];
  tree?: string;
  ref?: string;
  cache?: Map<string, any>;
}

interface Author {
  name: string;
  email: string;
  timestamp?: number;
  timezoneOffset?: number;
}

await git.commit({
  fs,
  dir: "./repo",
  message: "Add new feature",
  author: {
    name: "John Doe",
    email: "john@example.com"
  }
});
```

### `log(options)`

Read commit history.

```typescript
interface LogOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ref?: string;
  depth?: number;
  since?: Date;
  until?: Date;
  follow?: boolean;
  cache?: Map<string, any>;
}

const commits = await git.log({
  fs,
  dir: "./repo",
  ref: "main",
  depth: 10
});

// Returns: Array<{ oid: string, commit: CommitObject }>
```

## Branch Operations

### `branch(options)`

Create a new branch.

```typescript
interface BranchOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ref: string;
  object?: string;
  checkout?: boolean;
  force?: boolean;
  cache?: Map<string, any>;
}

await git.branch({
  fs,
  dir: "./repo",
  ref: "feature-branch",
  checkout: true
});
```

### `checkout(options)`

Switch branches or restore files.

```typescript
interface CheckoutOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ref: string;
  filepaths?: string[];
  remote?: string;
  track?: boolean;
  force?: boolean;
  cache?: Map<string, any>;
}

await git.checkout({
  fs,
  dir: "./repo",
  ref: "main"
});
```

### `listBranches(options)`

List branches.

```typescript
interface ListBranchesOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  remote?: string;
}

// List local branches
const localBranches = await git.listBranches({
  fs,
  dir: "./repo"
});

// List remote branches
const remoteBranches = await git.listBranches({
  fs,
  dir: "./repo",
  remote: "origin"
});
```

### `deleteBranch(options)`

Delete a branch.

```typescript
interface DeleteBranchOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ref: string;
  remote?: string;
}

await git.deleteBranch({
  fs,
  dir: "./repo",
  ref: "old-feature"
});
```

### `currentBranch(options)`

Get the current branch name.

```typescript
interface CurrentBranchOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  fullname?: boolean;
}

const branch = await git.currentBranch({
  fs,
  dir: "./repo"
});
```

## Remote Operations

### `addRemote(options)`

Add a remote repository.

```typescript
interface AddRemoteOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  remote: string;
  url: string;
  force?: boolean;
}

await git.addRemote({
  fs,
  dir: "./repo",
  remote: "origin",
  url: "https://eol.sh/~user/program.git"
});
```

### `deleteRemote(options)`

Remove a remote repository.

```typescript
interface DeleteRemoteOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  remote: string;
}

await git.deleteRemote({
  fs,
  dir: "./repo",
  remote: "old-origin"
});
```

### `listRemotes(options)`

List remote repositories.

```typescript
interface ListRemotesOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
}

const remotes = await git.listRemotes({
  fs,
  dir: "./repo"
});

// Returns: Array<{ remote: string, url: string }>
```

### `fetch(options)`

Fetch changes from remote repository.

```typescript
interface FetchOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  url?: string;
  remote?: string;
  ref?: string;
  refs?: string[];
  tags?: boolean;
  depth?: number;
  since?: Date;
  exclude?: string[];
  relative?: boolean;
  onAuth?: AuthCallback;
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
  cache?: Map<string, any>;
}

await git.fetch({
  fs,
  dir: "./repo",
  remote: "origin",
  ref: "main"
});
```

### `push(options)`

Push changes to remote repository.

```typescript
interface PushOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  url?: string;
  remote?: string;
  ref?: string;
  refs?: string[];
  force?: boolean;
  delete?: boolean;
  onAuth?: AuthCallback;
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
  cache?: Map<string, any>;
}

await git.push({
  fs,
  dir: "./repo",
  remote: "origin",
  ref: "main"
});
```

## Merge and Rebase

### `merge(options)`

Merge branches.

```typescript
interface MergeOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ours?: string;
  theirs: string;
  author?: Author;
  committer?: Committer;
  message?: string;
  abortOnConflict?: boolean;
  cache?: Map<string, any>;
}

await git.merge({
  fs,
  dir: "./repo",
  ours: "main",
  theirs: "feature-branch",
  author: {
    name: "John Doe",
    email: "john@example.com"
  }
});
```

## Reference Operations

### `resolveRef(options)`

Resolve a reference to a commit SHA.

```typescript
interface ResolveRefOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  ref: string;
  depth?: number;
}

const sha = await git.resolveRef({
  fs,
  dir: "./repo",
  ref: "HEAD"
});
```

### `listRefs(options)`

List all references.

```typescript
interface ListRefsOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
}

const refs = await git.listRefs({
  fs,
  dir: "./repo"
});
```

## Configuration

### `getConfig(options)`

Get configuration value.

```typescript
interface GetConfigOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  path: string;
}

const userName = await git.getConfig({
  fs,
  dir: "./repo",
  path: "user.name"
});
```

### `setConfig(options)`

Set configuration value.

```typescript
interface SetConfigOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  path: string;
  value: string;
  append?: boolean;
}

await git.setConfig({
  fs,
  dir: "./repo",
  path: "user.name",
  value: "John Doe"
});
```

## Object Operations

### `readObject(options)`

Read a Git object.

```typescript
interface ReadObjectOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  oid: string;
  format?: "parsed" | "content" | "wrapped";
  filepath?: string;
  encoding?: string;
  cache?: Map<string, any>;
}

const { object, type } = await git.readObject({
  fs,
  dir: "./repo",
  oid: "abc123...",
  format: "parsed"
});
```

### `writeObject(options)`

Write a Git object.

```typescript
interface WriteObjectOptions {
  fs: FsInterface;
  dir: string;
  gitdir?: string;
  type: string;
  object: Uint8Array;
  format?: "parsed" | "content" | "wrapped";
  oid?: string;
  encoding?: string;
  cache?: Map<string, any>;
}

const oid = await git.writeObject({
  fs,
  dir: "./repo",
  type: "blob",
  object: new TextEncoder().encode("file content")
});
```

## Error Handling

All commands may throw specific error types:

- `NotFoundError`: Resource not found
- `InvalidRefNameError`: Invalid reference name
- `MergeConflictError`: Merge conflict occurred
- `CheckoutConflictError`: Checkout conflict
- `PushRejectedError`: Push was rejected
- `AuthError`: Authentication failed
- `HttpError`: HTTP request failed

```typescript
import {
  NotFoundError,
  MergeConflictError,
  PushRejectedError
} from "../src/errors/index.ts";

try {
  await git.checkout({ fs, dir: "./repo", ref: "nonexistent" });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log("Branch not found");
  } else {
    throw error;
  }
}
```
