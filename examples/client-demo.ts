#!/usr/bin/env -S deno run --allow-net

/**
 * EOL Git Server Client Demo
 *
 * This demo shows how to interact with the Git HTTP server from a client application.
 */



//// util

interface GitServerResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  timestamp: string;
}



//// program

class GitServerClient {
  private authToken?: string;
  private baseUrl: string;

  constructor(baseUrl: string, authToken?: string) {
    this.authToken = authToken;
    this.baseUrl = baseUrl.replace(/\/$/, ""); /*** Remove trailing slash ***/
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<GitServerResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {})
    };

    if (this.authToken)
      headers.Authorization = `Bearer ${this.authToken}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const result = await response.json();

      if (!response.ok)
        console.error(`❌ HTTP ${response.status}: ${result.error || "Request failed"}`);

      return result;
    } catch(error) {
      return {
        error: `Network error: ${String(error)}`,
        success: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  async healthCheck() {
    console.log("🏥 Checking server health...");
    const result = await this.request("/health");

    if (result.success)
      console.log("✅ Server is healthy:", result.data);
    else
      console.log("❌ Server health check failed:", result.error);

    return result;
  }

  async listRepositories() {
    console.log("📂 Listing repositories...");
    const result = await this.request("/repos");

    if (result.success)
      console.log("✅ Repositories:", result.data?.repositories || []);
    else
      console.log("❌ Failed to list repositories:", result.error);

    return result;
  }

  async cloneRepository(repoName: string, cloneUrl: string, ref = "primary", depth?: number) {
    console.log(`📥 Cloning repository "${repoName}" from ${cloneUrl}...`);
    const body = { ...(depth && { depth }), ref, url: cloneUrl };

    const result = await this.request(`/repos/${repoName}/clone`, {
      body: JSON.stringify(body),
      method: "POST"
    });

    if (result.success)
      console.log("✅ Repository cloned successfully:", result.data);
    else
      console.log("❌ Failed to clone repository:", result.error);

    return result;
  }

  async initRepository(repoName: string, defaultBranch = "primary") {
    console.log(`🎯 Initializing repository "${repoName}"...`);

    const result = await this.request(`/repos/${repoName}`, {
      body: JSON.stringify({
        defaultBranch,
        operation: "init"
      }),
      method: "POST"
    });

    if (result.success)
      console.log("✅ Repository initialized:", result.data);
    else
      console.log("❌ Failed to initialize repository:", result.error);

    return result;
  }

  async getRepositoryStatus(repoName: string) {
    console.log(`📊 Getting status for repository "${repoName}"...`);
    const result = await this.request(`/repos/${repoName}/status`);

    if (result.success) {
      console.log("✅ Repository status:");
      const files = result.data?.files || [];

      if (files.length === 0) {
        console.log("  (no files)");
      } else {
        files.forEach((file: any) => {
          const { filepath, status } = file;

          console.log(`  ${filepath}:`);
          console.log(`    HEAD: ${status.head}, WORKDIR: ${status.workdir}, STAGE: ${status.stage}`);
        });
      }
    } else {
      console.log("❌ Failed to get repository status:", result.error);
    }

    return result;
  }

  async listBranches(repoName: string) {
    console.log(`🌿 Listing branches for repository "${repoName}"...`);
    const result = await this.request(`/repos/${repoName}/branches`);

    if (result.success)
      console.log("✅ Branches:", result.data?.branches || []);
    else
      console.log("❌ Failed to list branches:", result.error);

    return result;
  }

  async listCommits(repoName: string, limit = 5) {
    console.log(`📝 Listing commits for repository "${repoName}" (limit: ${limit})...`);
    const result = await this.request(`/repos/${repoName}/commits?limit=${limit}`);

    if (result.success) {
      console.log("✅ Recent commits:");
      const commits = result.data?.commits || [];

      if (commits.length === 0) {
        console.log("  (no commits)");
      } else {
        commits.forEach((commit: any, index: number) => {
          console.log(`  ${index + 1}. ${commit.oid.substring(0, 8)} - ${commit.message}`);
          console.log(`     Author: ${commit.author.name} <${commit.author.email}>`);
          console.log(`     Date: ${new Date(commit.author.timestamp * 1000).toISOString()}`);
        });
      }
    } else {
      console.log("❌ Failed to list commits:", result.error);
    }

    return result;
  }

  async performOperation(repoName: string, operation: string, params: Record<string, any> = {}) {
    console.log(`⚡ Performing operation "${operation}" on repository "${repoName}"...`);

    const result = await this.request(`/repos/${repoName}`, {
      body: JSON.stringify({
        operation,
        ...params
      }),
      method: "POST"
    });

    if (result.success)
      console.log("✅ Operation completed:", result.data);
    else
      console.log("❌ Operation failed:", result.error);

    return result;
  }
}



/*** Demo workflow ***/
async function runDemo() {
  console.log("🚀 EOL Git Server Client Demo\n");

  /*** Configuration ***/
  const serverUrl = Deno.env.get("GIT_SERVER_URL") || "http://localhost:8000";
  const authToken = Deno.env.get("AUTH_TOKEN");
  const repoName = "demo-repo";

  console.log(`🔗 Connecting to: ${serverUrl}`);

  if (authToken)
    console.log("🔐 Using authentication token");
  else
    console.log("🔓 No authentication token (server must not require auth)");

  console.log("");
  const client = new GitServerClient(serverUrl, authToken);

  try {
    /*** 1. Health check ***/
    await client.healthCheck();
    console.log("");

    /*** 2. List existing repositories ***/
    await client.listRepositories();
    console.log("");

    /*** 3. Clone a repository (comment out if you don’t want to clone) ***/
    console.log("📥 Cloning demo repository...");

    await client.cloneRepository(
      repoName,
      "https://eol.sh/~bit/Hello-World.git",
      "primary",
      1
    );

    console.log("");

    /*** 4. Get repository status ***/
    await client.getRepositoryStatus(repoName);
    console.log("");

    /*** 5. List branches ***/
    await client.listBranches(repoName);
    console.log("");

    /*** 6. List commits ***/
    await client.listCommits(repoName, 3);
    console.log("");

    /*** 7. List repositories again to see the new one ***/
    await client.listRepositories();
    console.log("");

    console.log("🎉 Demo completed successfully!");
  } catch(error) {
    console.error(`❌ Demo failed: ${error}`);
  }
}



/*** Alternative: Interactive mode ***/
async function interactiveMode() {
  console.log("🎮 Interactive Mode");
  console.log("Available commands:");
  console.log("  health                   - Check server health");
  console.log("  repos                    - List repositories");
  console.log("  clone <name> <url> [ref] - Clone repository");
  console.log("  init <name>              - Initialize repository");
  console.log("  status <name>            - Get repository status");
  console.log("  branches <name>          - List branches");
  console.log("  commits <name> [limit]   - List commits");
  console.log("  exit                     - Exit interactive mode");
  console.log("");

  const serverUrl = Deno.env.get("GIT_SERVER_URL") || "http://localhost:8000";
  const authToken = Deno.env.get("AUTH_TOKEN");
  const client = new GitServerClient(serverUrl, authToken);

  while (true) {
    const input = prompt("git-server> ");

    if (!input || input.trim() === "exit")
      break;

    const [command, ...args] = input.trim().split(" ");

    try {
      switch(command) {
        case "branches": {
          if (args.length < 1)
            console.log("Usage: branches <name>");
          else
            await client.listBranches(args[0]);

          break;
        }

        case "clone": {
          if (args.length < 2)
            console.log("Usage: clone <name> <url> [ref]");
          else
            await client.cloneRepository(args[0], args[1], args[2] || "primary");

          break;
        }

        case "commits": {
          if (args.length < 1)
            console.log("Usage: commits <name> [limit]");
          else
            await client.listCommits(args[0], parseInt(args[1]) || 5);

          break;
        }

        case "health": {
          await client.healthCheck();
          break;
        }

        case "init": {
          if (args.length < 1)
            console.log("Usage: init <name>");
          else
            await client.initRepository(args[0]);

          break;
        }

        case "repos": {
          await client.listRepositories();
          break;
        }

        case "status": {
          if (args.length < 1)
            console.log("Usage: status <name>");
          else
            await client.getRepositoryStatus(args[0]);

          break;
        }

        default: {
          console.log(`Unknown command: ${command}`);
        }
      }
    } catch(error) {
      console.error(`Command failed: ${String(error)}`);
    }

    console.log("");
  }
}



/*** Main execution ***/
if (import.meta.main) {
  const mode = Deno.args[0];

  if (mode === "interactive" || mode === "-i")
    await interactiveMode();
  else
    await runDemo();
}
