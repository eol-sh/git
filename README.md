# Git for Deno

`@eol/git` is a pure Deno/TypeScript fork of [`isomorphic-git`](https://github.com/isomorphic-git/isomorphic-git), itself a JavaScript reimplementation of git. This codebase has zero npm dependencies, no JavaScript files, and is fully typed.

## Features

- 🦕 **Native Deno Support** - Built specifically for Deno with modern TypeScript
- 🔒 **Type Safe** - Fully typed with strict TypeScript for better developer experience
- 📦 **Zero Dependencies** - Pure TypeScript implementation with no external Git binaries required
- 🌐 **HTTP/HTTPS Support** - Clone, fetch, and push over HTTP(S) protocols
- 📁 **Complete Git Operations** - Full support for commits, branches, merging, staging, and more
- 🚀 **Async/Await** - Modern Promise-based API throughout

## Quick Start

### Installation

```typescript
/*** Import directly from your local path or a Git repository ***/
import * as git from "./src/index.ts";
```

### Basic Usage

```typescript
import * as git from "./src/index.ts";
import { FileSystem } from "./src/models/file-system.ts";

/*** Initialize a filesystem interface ***/
const fs = new FileSystem();

/*** Clone a repository ***/
await git.clone({
  dir: "./my-repo",
  fs,
  url: "https://eol.sh/~user/program.git"
});

/*** Add and commit files ***/
await git.add({
  dir: "./my-repo",
  filepath: "README.md",
  fs
});

await git.commit({
  author: {
    email: "you@example.com",
    name: "Your Name"
  },
  dir: "./my-repo",
  fs,
  message: "Initial commit"
});

/*** Push changes ***/
await git.push({
  dir: "./my-repo",
  fs,
  ref: "primary",
  remote: "origin"
});
```

## Core Concepts

### FileSystem Interface

All Git operations require a filesystem interface that handles file I/O operations:

```typescript
import { FileSystem } from "./src/models/file-system.ts";

const fs = new FileSystem();
```

### Repository Operations

#### Initialize a Repository

```typescript
await git.init({
  defaultBranch: "primary",
  dir: "./new-repo",
  fs
});
```

#### Clone a Repository

```typescript
await git.clone({
  depth: 1, /*** Optional: shallow clone ***/
  dir: "./cloned-repo",
  fs,
  ref: "primary", /*** Optional: specific branch ***/
  singleBranch: true, /*** Optional: clone only one branch ***/
  url: "https://eol.sh/~user/program.git"
});
```

### Working with Files

#### Staging Files

```typescript
/*** Stage a single file ***/
await git.add({
  dir: "./repo",
  filepath: "src/main.ts",
  fs
});

/*** Stage all files ***/
await git.add({
  dir: "./repo",
  filepath: ".",
  fs
});
```

#### Checking Status

```typescript
const status = await git.statusMatrix({
  dir: "./repo",
  fs
});

/*** Status matrix format: [filepath, HEAD, WORKDIR, STAGE]
     0 = absent, 1 = present, 2 = modified, 3 = added ***/
for (const [filepath, head, workdir, stage] of status) {
  console.log(`${filepath}: HEAD=${head}, WORKDIR=${workdir}, STAGE=${stage}`);
}
```

### Commits and History

#### Creating Commits

```typescript
await git.commit({
  author: {
    email: "dev@example.com",
    name: "Developer Name",
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: new Date().getTimezoneOffset()
  },
  dir: "./repo",
  fs,
  message: "Add new feature"
});
```

#### Reading Commit History

```typescript
const commits = await git.log({
  depth: 10, /*** Optional: limit number of commits ***/
  dir: "./repo",
  fs,
  ref: "primary"
});

for (const commit of commits) {
  console.log(`${commit.oid}: ${commit.commit.message}`);
  console.log(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
}
```

### Branches

#### Creating and Switching Branches

```typescript
/*** Create a new branch/
await git.branch({
checkout: true, /*** Optional: checkout immediately ***/
  dir: "./repo",
  fs,
  ref: "feature-branch"
});

/*** Switch to existing branch ***/
await git.checkout({
  dir: "./repo",
  fs,
  ref: "primary"
});

/*** List branches ***/
const branches = await git.listBranches({
  dir: "./repo",
  fs
});

console.log("Local branches:", branches);
```

### Remote Operations

#### Adding Remotes

```typescript
await git.addRemote({
  dir: "./repo",
  fs,
  remote: "origin",
  url: "https://eol.sh/~user/program.git"
});
```

#### Fetching Changes

```typescript
await git.fetch({
  dir: "./repo",
  fs,
  ref: "primary",
  remote: "origin"
});
```

#### Pushing Changes

```typescript
await git.push({
  force: false, /*** Optional: force push ***/
  dir: "./repo",
  fs,
  ref: "primary",
  remote: "origin"
});
```

### Advanced Operations

#### Merging

```typescript
await git.merge({
  author: {
    email: "you@example.com",
    name: "Your Name"
  },
  dir: "./repo",
  fs,
  ours: "main",
  theirs: "feature-branch"
});
```

#### Resolving References

```typescript
/*** Get the SHA of a reference ***/
const sha = await git.resolveRef({
  dir: "./repo",
  fs,
  ref: "HEAD"
});

console.log(`HEAD points to: ${sha}`);
```

#### Reading Objects

```typescript
/*** Read a commit object ***/
const { object, type } = await git.readObject({
  dir: "./repo",
  fs,
  oid: "abc123..." /*** commit SHA ***/
});

if (type === "commit") {
  const commit = git.GitCommit.from(object);
  console.log(commit.message);
}
```

## Configuration

### Git Config

```typescript
/*** Set user configuration ***/
await git.setConfig({
  dir: "./repo",
  fs,
  path: "user.name",
  value: "Your Name"
});

await git.setConfig({
  dir: "./repo",
  fs,
  path: "user.email",
  value: "you@example.com"
});

/*** Read configuration ***/
const name = await git.getConfig({
  dir: "./repo",
  fs,
  path: "user.name"
});
```

### Authentication

For HTTPS repositories requiring authentication:

```typescript
await git.clone({
  dir: "./private-repo",
  fs,
  url: "https://username:token@eol.sh/~user/private-program.git"
});
```

Or use the `onAuth` callback for dynamic authentication:

```typescript
await git.clone({
  dir: "./private-repo",
  fs,
  onAuth: () => ({
    password: "your-token",
    username: "your-username"
  }),
  url: "https://eol.sh/~user/private-program.git"
});
```

## Error Handling

The library throws specific error types for different scenarios:

```typescript
import {
  InvalidRefNameError,
  MergeConflictError,
  NotFoundError
} from "./src/errors/index.ts";

try {
  await git.checkout({
    dir: "./repo",
    fs,
    ref: "nonexistent-branch"
  });
} catch(error) {
  if (error instanceof NotFoundError)
    console.log("Branch not found");
  else if (error instanceof InvalidRefNameError)
    console.log("Invalid branch name");
  else
    throw error;
}
```

## Performance Tips

1. **Use shallow clones** for large repositories when you don’t need full history:
    ```typescript
    await git.clone({
      depth: 1,
      dir: "./repo",
      fs,
      url: "https://eol.sh/~user/large-program.git"
    });
    ```

2. **Single branch clones** to reduce bandwidth:
    ```typescript
    await git.clone({
      dir: "./repo",
      fs,
      ref: "primary",
      singleBranch: true,
      url: "https://eol.sh/~user/program.git"
    });
    ```

3. **Batch operations** when possible instead of multiple individual calls.

## Examples

See the [examples](./docs/examples/) directory for complete working examples:

- [Basic Git Workflow](./docs/examples/basic-workflow.md)
- [Working with Remotes](./docs/examples/remotes.md)
- [Branch Management](./docs/examples/branches.md)
- [Merge and Conflict Resolution](./docs/examples/merging.md)

## API Reference

For complete API documentation, see:

- [Core Commands](./docs/api/commands.md)
- [Utility Functions](./docs/api/utilities.md)
- [Error Types](./docs/api/errors.md)
- [Type Definitions](./docs/api/types.md)

## Compatibility

- **Deno Version**: 1.0+
- **TypeScript**: 4.0+
- **Git Compatibility**: Supports Git wire protocol v1 and v2

## Contributing

1. Ensure you have Deno installed
2. Run type checking: `deno task check`
3. Run tests: `deno task test` (when test suite is implemented)
4. Submit patches with clear descriptions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Based on the original [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) project, adapted and optimized for EOL with full TypeScript support.
