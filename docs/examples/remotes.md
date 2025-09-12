# Working with Git Remotes

This example demonstrates how to work with remote repositories using @eol/git.

## Setup

```typescript
import * as git from "../../src/index.ts";
import { FileSystem } from "../../src/models/file-system.ts";

const fs = new FileSystem();
```

## 1. Clone a Remote Repository

```typescript
const repoDir = "./cloned-repo";

// Clone a public repository
await git.clone({
  fs,
  dir: repoDir,
  url: "https://eol.sh/~bit/Hello-World.git",
  ref: "primary", // or "main"
  singleBranch: true,
  depth: 1 // Shallow clone for faster download
});

console.log("Repository cloned successfully!");
```

## 2. Clone with Authentication

For private repositories, you can include credentials in the URL or use the `onAuth` callback:

```typescript
// Method 1: Credentials in URL
await git.clone({
  fs,
  dir: "./private-repo",
  url: "https://username:personal_access_token@eol.sh/~user/private-program.git"
});

// Method 2: Using onAuth callback
await git.clone({
  fs,
  dir: "./private-repo",
  url: "https://eol.sh/~user/private-program.git",
  onAuth: () => ({
    username: "your-username",
    password: "your-personal-access-token"
  })
});
```

## 3. List Remote Information

```typescript
// List all remotes
const remotes = await git.listRemotes({
  fs,
  dir: repoDir
});

console.log("Remotes:");
for (const remote of remotes) {
  console.log(`  ${remote.remote}: ${remote.url}`);
}

// Get detailed remote info
const remoteInfo = await git.getRemoteInfo({
  fs,
  dir: repoDir,
  url: "https://eol.sh/~bit/Hello-World.git"
});

console.log("Remote capabilities:", remoteInfo.capabilities);
console.log("Remote refs:", remoteInfo.refs);
```

## 4. Add and Manage Remotes

```typescript
// Add a new remote
await git.addRemote({
  fs,
  dir: repoDir,
  remote: "upstream",
  url: "https://eol.sh/~original/program.git"
});

// List remotes again to see the new one
const updatedRemotes = await git.listRemotes({
  fs,
  dir: repoDir
});

console.log("Updated remotes:", updatedRemotes);

// Remove a remote
await git.deleteRemote({
  fs,
  dir: repoDir,
  remote: "upstream"
});
```

## 5. Fetch Changes from Remote

```typescript
// Fetch all refs from origin
const fetchResult = await git.fetch({
  fs,
  dir: repoDir,
  remote: "origin",
  tags: true // Also fetch tags
});

console.log("Fetch result:", fetchResult);

// Fetch specific branch
await git.fetch({
  fs,
  dir: repoDir,
  remote: "origin",
  ref: "main"
});

console.log("Fetched main branch");
```

## 6. Push Changes to Remote

```typescript
// Make some changes first
await Deno.writeTextFile(`${repoDir}/new-feature.md`, `# New Feature

This is a new feature I'm adding to the project.
`);

// Stage and commit
await git.add({
  fs,
  dir: repoDir,
  filepath: "new-feature.md"
});

await git.commit({
  fs,
  dir: repoDir,
  message: "Add new feature documentation",
  author: {
    name: "Developer",
    email: "dev@example.com"
  }
});

// Push to remote (requires write access)
try {
  await git.push({
    fs,
    dir: repoDir,
    remote: "origin",
    ref: "main",
    onAuth: () => ({
      username: "your-username",
      password: "your-personal-access-token"
    })
  });

  console.log("Changes pushed successfully!");
} catch (error) {
  console.log("Push failed (may need authentication):", error.message);
}
```

## 7. Working with Multiple Remotes

```typescript
// Add multiple remotes for a fork workflow
await git.addRemote({
  fs,
  dir: repoDir,
  remote: "upstream",
  url: "https://eol.sh/~original/program.git"
});

await git.addRemote({
  fs,
  dir: repoDir,
  remote: "fork",
  url: "https://eol.sh/~your-username/program.git"
});

// Fetch from upstream
await git.fetch({
  fs,
  dir: repoDir,
  remote: "upstream"
});

// Push to your fork
await git.push({
  fs,
  dir: repoDir,
  remote: "fork",
  ref: "main"
});
```

## 8. List and Fetch Remote Branches

```typescript
// List remote branches
const remoteBranches = await git.listBranches({
  fs,
  dir: repoDir,
  remote: "origin"
});

console.log("Remote branches:", remoteBranches);

// Checkout a remote branch
await git.checkout({
  fs,
  dir: repoDir,
  ref: "origin/development",
  track: true // Create a local tracking branch
});
```

## 9. Server References and Tags

```typescript
// List server refs without fetching
const serverRefs = await git.listServerRefs({
  fs,
  dir: repoDir,
  url: "https://eol.sh/~bit/Hello-World.git"
});

console.log("Server references:");
for (const ref of serverRefs) {
  console.log(`  ${ref.ref}: ${ref.oid}`);
}

// Fetch tags specifically
await git.fetch({
  fs,
  dir: repoDir,
  remote: "origin",
  tags: true
});

// List local tags
const tags = await git.listTags({
  fs,
  dir: repoDir
});

console.log("Tags:", tags);
```

## 10. Complete Remote Workflow Example

```typescript
#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import * as git from "../../src/index.ts";
import { FileSystem } from "../../src/models/file-system.ts";

async function remoteWorkflow() {
  const fs = new FileSystem();
  const repoDir = "./demo-remote-repo";

  try {
    // Clean up any existing directory
    try {
      await Deno.remove(repoDir, { recursive: true });
    } catch {
      // Directory doesn't exist, which is fine
    }

    console.log("🔄 Cloning repository...");
    await git.clone({
      fs,
      dir: repoDir,
      url: "https://eol.sh/~bit/Hello-World.git",
      depth: 1
    });

    console.log("📋 Listing remotes...");
    const remotes = await git.listRemotes({ fs, dir: repoDir });
    console.log("Remotes:", remotes);

    console.log("🌿 Listing branches...");
    const branches = await git.listBranches({ fs, dir: repoDir });
    console.log("Local branches:", branches);

    const remoteBranches = await git.listBranches({
      fs,
      dir: repoDir,
      remote: "origin"
    });
    console.log("Remote branches:", remoteBranches);

    console.log("📡 Fetching latest changes...");
    await git.fetch({
      fs,
      dir: repoDir,
      remote: "origin"
    });

    console.log("✅ Remote workflow completed successfully!");

  } catch (error) {
    console.error("❌ Error during remote workflow:", error);
  }
}

if (import.meta.main) {
  await remoteWorkflow();
}
```

## Authentication Best Practices

### Personal Access Tokens

For GitHub, create a personal access token instead of using passwords:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with appropriate scopes
3. Use the token as the password in authentication

```typescript
const auth = {
  username: "your-github-username",
  password: "ghp_your_personal_access_token_here"
};
```

### Environment Variables

Store credentials in environment variables:

```typescript
const auth = {
  username: Deno.env.get("GIT_USERNAME")!,
  password: Deno.env.get("GIT_TOKEN")!
};

await git.clone({
  fs,
  dir: "./repo",
  url: "https://eol.sh/~user/program.git",
  onAuth: () => auth
});
```

Run with:

```bash
GIT_USERNAME=your-username GIT_TOKEN=your-token deno run --allow-read --allow-write --allow-net --allow-env script.ts
```
