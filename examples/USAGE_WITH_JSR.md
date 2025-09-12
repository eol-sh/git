# Using @eol/git from JSR

Now that @eol/git is published on JSR, you can use it directly without cloning the repository!

## Quick Start with JSR

### 1. Basic Git Operations
```typescript
import * as git from "jsr:@eol/git";
import { FileSystem } from "jsr:@eol/git";

const fs = new FileSystem({
  lstat: Deno.lstat,
  mkdir: Deno.mkdir,
  readdir: Deno.readDir,
  readFile: Deno.readFile,
  readlink: Deno.readLink,
  rmdir: (path: string) => Deno.remove(path, { recursive: false }),
  stat: Deno.stat,
  symlink: Deno.symlink,
  unlink: Deno.remove,
  writeFile: Deno.writeFile
});

// Clone a repository
await git.clone({
  dir: "./my-repo",
  fs,
  url: "https://eol.sh/~user/project.git"
});

// Check status
const status = await git.statusMatrix({ dir: "./my-repo", fs });
console.log(status);
```

### 2. Run the Git Server directly from JSR
```bash
# Basic server
deno run --allow-env --allow-net --allow-read --allow-write \
  jsr:@eol/git/examples/git-server-jsr

# With environment variables
PORT=3000 AUTH_TOKEN=secret deno run \
  --allow-env --allow-net --allow-read --allow-write \
  jsr:@eol/git/examples/git-server-jsr
```

### 3. Use in your own projects

**deno.json:**
```json
{
  "imports": {
    "@eol/git": "jsr:@eol/git@^1.0.0"
  }
}
```

**your-script.ts:**
```typescript
import * as git from "@eol/git";
import { FileSystem } from "@eol/git";

// Your code here...
```

## Example Server Endpoints

Once the server is running, you can test it:

```bash
# Health check
curl http://localhost:8000/health

# Clone a repository
curl -X POST http://localhost:8000/repos/test-repo/clone \
  -H "Content-Type: application/json" \
  -d '{"url": "https://eol.sh/~bit/Hello-World.git"}'

# List repositories
curl http://localhost:8000/repos

# Get repository status
curl http://localhost:8000/repos/test-repo/status
```

## Key Benefits

1. **No local setup** - Run directly from JSR
2. **Always up-to-date** - Use the latest published version
3. **Zero configuration** - Just import and use
4. **Full Git functionality** - All operations available via HTTP API

The JSR version (`git-server-jsr.ts`) is identical to the local version but imports from the published package instead of local files.

## Building Your GitHub Clone

With @eol/git now properly exported from JSR, you have everything needed to build your own GitHub-like platform:

1. **Git Core**: ✅ Available via `jsr:@eol/git`
2. **HTTP API**: ✅ Use `git-server-jsr.ts` as your base
3. **FileSystem**: ✅ Now properly exported
4. **Multi-repo support**: ✅ Built into the server

You can extend the server with:
- User management and authentication
- Web interface for repository browsing
- Issue tracking system
- Pull request functionality
- Organization features

The foundation is solid! 🚀
