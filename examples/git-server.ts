#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-write examples/git-server.ts

/**
 * EOL Git HTTP Server
 *
 * A Deno HTTP server that wraps @eol/git to provide Git operations via REST API.
 * This server allows you to perform Git operations through HTTP requests.
 */



//// util

import * as git from "../src/index.ts";
import { FileSystem } from "../src/models/file-system.ts";

interface GitServerConfig {
  allowedOrigins?: string[];
  authToken?: string;
  baseDir: string;
  port: number;
}

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  timestamp: string;
}



//// program

class GitServer {
  private config: GitServerConfig;
  private fs: FileSystem;

  constructor(config: GitServerConfig) {
    this.config = config;

    this.fs = new FileSystem({
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
  }

  private createResponse<T>(success: boolean, data?: T, error?: string): ApiResponse<T> {
    return {
      data,
      error,
      success,
      timestamp: new Date().toISOString()
    };
  }

  private getRepoPath(repo: string): string {
    /*** Sanitize repository name to prevent directory traversal ***/
    const sanitized = repo.replace(/[^a-zA-Z0-9-_.]/g, "");
    return `${this.config.baseDir}/${sanitized}`;
  }

  private setCorsHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    if (this.config.allowedOrigins)
      headers.set("Access-Control-Allow-Origin", this.config.allowedOrigins.join(", "));
    else
      headers.set("Access-Control-Allow-Origin", "*");

    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText
    });
  }

  private validateAuth(request: Request): boolean {
    if (!this.config.authToken)
      return true;

    const authHeader = request.headers.get("Authorization");
    return authHeader === `Bearer ${this.config.authToken}`;
  }



  async cloneRepository(repo: string, body: any): Promise<ApiResponse> {
    const { url: cloneUrl, ref = "primary", depth } = body;

    if (!cloneUrl)
      return this.createResponse(false, null, "URL is required");

    try {
      const dir = this.getRepoPath(repo);

      await git.clone({
        depth,
        dir,
        fs: this.fs,
        ref,
        singleBranch: true,
        url: cloneUrl
      });

      return this.createResponse(true, {
        message: `Repository cloned successfully`,
        ref,
        repository: repo,
        url: cloneUrl
      });
    } catch(error) {
      return this.createResponse(false, null, `Failed to clone repository: ${String(error)}`);
    }
  }

  async getRepositoryStatus(repo: string): Promise<ApiResponse> {
    try {
      const dir = this.getRepoPath(repo);
      const status = await git.statusMatrix({ dir, fs: this.fs });

      const files = status.map(([filepath, head, workdir, stage]) => ({
        filepath,
        status: {
          head: head === 0 ?
            "absent" :
            head === 1 ?
              "present" :
              "modified",
          stage: stage === 0 ?
            "absent" :
            stage === 1 ?
              "present" :
              stage === 2 ?
                "modified" :
                "added",
          workdir: workdir === 0 ?
            "absent" :
            workdir === 1 ?
              "present" :
              workdir === 2 ?
                "modified" :
                "added"
        }
      }));

      return this.createResponse(true, { files });
    } catch(error) {
      return this.createResponse(false, null, `Failed to get status: ${String(error)}`);
    }
  }

  async handleRepoOperation(repo: string, body: any): Promise<ApiResponse> {
    const { operation, ...params } = body;
    const dir = this.getRepoPath(repo);

    try {
      switch(operation) {
        case "add": {
          if (!params.filepath)
            return this.createResponse(false, null, "filepath is required for add operation");

          await git.add({
            dir,
            filepath: params.filepath,
            fs: this.fs
          });

          return this.createResponse(true, { message: "File added to staging area" });
        }

        case "checkout": {
          if (!params.ref)
            return this.createResponse(false, null, "ref is required for checkout operation");

          await git.checkout({
            dir,
            fs: this.fs,
            ref: params.ref
          });

          return this.createResponse(true, { message: `Checked out to ${params.ref}` });
        }

        case "commit": {
          if (!params.message || !params.author)
            return this.createResponse(false, null, "message and author are required for commit operation");

          const oid = await git.commit({
            author: params.author,
            dir,
            fs: this.fs,
            message: params.message
          });

          return this.createResponse(true, { message: "Commit created", oid });
        }

        case "fetch": {
          await git.fetch({
            dir,
            fs: this.fs,
            ref: params.ref,
            remote: params.remote || "origin"
          });

          return this.createResponse(true, { message: "Fetch completed" });
        }

        case "init": {
          await git.init({
            defaultBranch: params.defaultBranch || "primary",
            dir,
            fs: this.fs
          });

          return this.createResponse(true, { message: "Repository initialized" });
        }

        case "push": {
          await git.push({
            dir,
            fs: this.fs,
            ref: params.ref || "primary",
            remote: params.remote || "origin"
          });

          return this.createResponse(true, { message: "Push completed" });
        }

        default: {
          return this.createResponse(false, null, `Unknown operation: ${operation}`);
        }
      }
    } catch(error) {
      return this.createResponse(false, null, `Operation failed: ${String(error)}`);
    }
  }

  async handleRequest(request: Request): Promise<Response> {
    const method = request.method;
    const url = new URL(request.url);

    /*** Handle CORS preflight ***/
    if (method === "OPTIONS")
      return this.setCorsHeaders(new Response(null, { status: 204 }));

    /*** Validate authentication ***/
    if (!this.validateAuth(request)) {
      const response = new Response(
        JSON.stringify(this.createResponse(false, null, "Unauthorized")),
        {
          headers: { "Content-Type": "application/json" },
          status: 401
        }
      );

      return this.setCorsHeaders(response);
    }

    try {
      let result: ApiResponse;

      /*** Route handling ***/
      if (url.pathname === "/health") {
        result = this.createResponse(true, { status: "healthy", version: "1.0.0" });
      } else if (url.pathname === "/repos" && method === "GET") {
        result = await this.listRepositories();
      } else if (url.pathname.startsWith("/repos/") && method === "POST") {
        const repo = url.pathname.split("/")[2];
        const body = await request.json();
        result = await this.handleRepoOperation(repo, body);
      } else if (url.pathname.startsWith("/repos/") && url.pathname.endsWith("/clone") && method === "POST") {
        const repo = url.pathname.split("/")[2];
        const body = await request.json();
        result = await this.cloneRepository(repo, body);
      } else if (url.pathname.startsWith("/repos/") && url.pathname.endsWith("/status") && method === "GET") {
        const repo = url.pathname.split("/")[2];
        result = await this.getRepositoryStatus(repo);
      } else if (url.pathname.startsWith("/repos/") && url.pathname.endsWith("/branches") && method === "GET") {
        const repo = url.pathname.split("/")[2];
        result = await this.listBranches(repo);
      } else if (url.pathname.startsWith("/repos/") && url.pathname.endsWith("/commits") && method === "GET") {
        const repo = url.pathname.split("/")[2];
        const limit = url.searchParams.get("limit");
        result = await this.listCommits(repo, limit ? parseInt(limit) : 10);
      } else {
        result = this.createResponse(false, null, "Not found");

        const response = new Response(
          JSON.stringify(result),
          {
            headers: { "Content-Type": "application/json" },
            status: 404
          }
        );

        return this.setCorsHeaders(response);
      }

      const response = new Response(
        JSON.stringify(result),
        {
          headers: { "Content-Type": "application/json" },
          status: result.success ? 200 : 400
        }
      );

      return this.setCorsHeaders(response);

    } catch(error) {
      console.error("Server error:", error);
      const result = this.createResponse(false, null, error.message || "Internal server error");

      const response = new Response(
        JSON.stringify(result),
        {
          headers: { "Content-Type": "application/json" },
          status: 500
        }
      );

      return this.setCorsHeaders(response);
    }
  }

  async listBranches(repo: string): Promise<ApiResponse> {
    try {
      const dir = this.getRepoPath(repo);
      const branches = await git.listBranches({ dir, fs: this.fs });

      return this.createResponse(true, { branches });
    } catch(error) {
      return this.createResponse(false, null, `Failed to list branches: ${String(error)}`);
    }
  }

  async listCommits(repo: string, limit: number): Promise<ApiResponse> {
    try {
      const dir = this.getRepoPath(repo);
      const commits = await git.log({ depth: limit, dir, fs: this.fs });

      const formattedCommits = commits.map(commit => ({
        author: commit.commit.author,
        committer: commit.commit.committer,
        message: commit.commit.message,
        oid: commit.oid
      }));

      return this.createResponse(true, { commits: formattedCommits });
    } catch(error) {
      return this.createResponse(false, null, `Failed to list commits: ${String(error)}`);
    }
  }

  async listRepositories(): Promise<ApiResponse> {
    try {
      const repos = [];

      for await (const entry of Deno.readDir(this.config.baseDir)) {
        if (entry.isDirectory) {
          const gitDir = `${this.config.baseDir}/${entry.name}/.git`;

          try {
            await Deno.stat(gitDir);
            repos.push(entry.name);
          } catch {
            /*** Not a git repository ***/
          }
        }
      }
      return this.createResponse(true, { repositories: repos });
    } catch(error) {
      return this.createResponse(false, null, `Failed to list repositories: ${String(error)}`);
    }
  }

  async start(): Promise<void> {
    /*** Ensure base directory exists ***/
    try {
      await Deno.mkdir(this.config.baseDir, { recursive: true });
    } catch(error) {
      if (!(error instanceof Deno.errors.AlreadyExists))
        throw error;
    }

    const server = Deno.serve({
      handler: (request) => this.handleRequest(request),
      port: this.config.port
    });

    console.log(`🚀 EOL Git Server running on http://localhost:${this.config.port}`);
    console.log(`📁 Base directory: ${this.config.baseDir}`);
    console.log(`🔐 Authentication: ${this.config.authToken ? "Enabled" : "Disabled"}`);
    console.log("\n📊 Available endpoints:");
    console.log("  GET  /health                - Server health check");
    console.log("  GET  /repos                 - List repositories");
    console.log("  POST /repos/{repo}          - Repository operations");
    console.log("  POST /repos/{repo}/clone    - Clone repository");
    console.log("  GET  /repos/{repo}/status   - Get repository status");
    console.log("  GET  /repos/{repo}/branches - List branches");
    console.log("  GET  /repos/{repo}/commits  - List commits");

    await server.finished;
  }
}



/*** Main execution ***/
if (import.meta.main) {
  const config: GitServerConfig = {
    allowedOrigins: Deno.env.get("ALLOWED_ORIGINS")?.split(","),
    authToken: Deno.env.get("AUTH_TOKEN"),
    baseDir: Deno.env.get("GIT_BASE_DIR") || "./repositories",
    port: parseInt(Deno.env.get("PORT") || "8000")
  };

  const server = new GitServer(config);

  try {
    await server.start();
  } catch(error) {
    console.error(`❌ Failed to start server: ${String(error)}`);
    Deno.exit(1);
  }
}
