# EOL Git Server Examples

This directory contains examples of using @eol/git in different scenarios.

## Git HTTP Server

The `git-server.ts` file demonstrates how to wrap @eol/git with a Deno HTTP server to provide Git operations via REST API.

### Features

- **RESTful API** for Git operations
- **Authentication** support via Bearer tokens
- **CORS** support for web applications
- **Error handling** with structured responses
- **Multiple repositories** management
- **Real-time status** and branch information

### Quick Start

1. **Basic server** (no authentication):
```bash
deno run --allow-read --allow-write --allow-net examples/git-server.ts
```

2. **With authentication**:
```bash
AUTH_TOKEN=your-secret-token deno run --allow-read --allow-write --allow-net examples/git-server.ts
```

3. **Custom configuration**:
```bash
PORT=3000 GIT_BASE_DIR=./my-repos AUTH_TOKEN=secret deno run --allow-read --allow-write --allow-net examples/git-server.ts
```

### Environment Variables

| Variable          | Description                     | Default           |
|-------------------|---------------------------------|-------------------|
| `PORT`            | Server port                     | `8000`            |
| `GIT_BASE_DIR`    | Base directory for repositories | `./repositories`  |
| `AUTH_TOKEN`      | Bearer token for authentication | none (no auth)    |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins    | `*` (all origins) |

### API Endpoints

#### Health Check
```http
GET /health
```

Response:
```json
{
  "data": {
    "status": "healthy",
    "version": "1.0.0"
  },
  "success": true,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### List Repositories
```http
GET /repos
```

Response:
```json
{
  "data": {
    "repositories": ["project1", "project2", "my-app"]
  },
  "success": true,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Clone Repository
```http
POST /repos/my-project/clone
Content-Type: application/json

{
  "depth": 1,
  "ref": "primary",
  "url": "https://eol.sh/~user/project.git"
}
```

#### Repository Operations
```http
POST /repos/my-project
Content-Type: application/json

{
  "defaultBranch": "primary",
  "operation": "init"
}
```

Available operations:
- `init` - Initialize repository
- `add` - Stage file (`filepath` required)
- `commit` - Create commit (`message` and `author` required)
- `checkout` - Switch branch (`ref` required)
- `fetch` - Fetch from remote
- `push` - Push to remote

#### Get Repository Status
```http
GET /repos/my-project/status
```

Response:
```json
{
  "data": {
    "files": [
      {
        "filepath": "README.md",
        "status": {
          "head": "present",
          "stage": "present",
          "workdir": "modified"
        }
      }
    ]
  },
  "success": true,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### List Branches
```http
GET /repos/my-project/branches
```

#### List Commits
```http
GET /repos/my-project/commits?limit=10
```

### Usage Examples

#### JavaScript Client Example

```javascript
class GitClient {
  constructor(baseUrl, authToken = null) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async cloneRepo(repoName, cloneUrl, ref = "primary") {
    return await this.request(`/repos/${repoName}/clone`, {
      body: JSON.stringify({ ref, url: cloneUrl }),
      method: "POST"
    });
  }

  async commitChanges(repoName, message, author) {
    return await this.request(`/repos/${repoName}`, {
      body: JSON.stringify({
        author,
        message,
        operation: "commit"
      }),
      method: "POST"
    });
  }

  async getStatus(repoName) {
    return await this.request(`/repos/${repoName}/status`);
  }

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    };

    if (this.authToken)
      headers.Authorization = `Bearer ${this.authToken}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    return await response.json();
  }
}

/*** Usage ***/
const client = new GitClient("http://localhost:8000", "your-token");

/*** Clone a repository ***/
const result = await client.cloneRepo(
  "my-project",
  "https://eol.sh/~user/project.git"
);

/*** Check status ***/
const status = await client.getStatus("my-project");
console.log(status);
```

#### cURL Examples

```bash
# Health check
curl http://localhost:8000/health

# Clone repository
curl -X POST http://localhost:8000/repos/test-repo/clone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"url": "https://eol.sh/~bit/Hello-World.git"}'

# Initialize repository
curl -X POST http://localhost:8000/repos/new-repo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"defaultBranch": "primary", "operation": "init"}'

# Get repository status
curl http://localhost:8000/repos/test-repo/status \
  -H "Authorization: Bearer your-token"

# List repositories
curl http://localhost:8000/repos \
  -H "Authorization: Bearer your-token"
```

### Security Considerations

1. **Authentication**: Always use authentication tokens in production
2. **CORS**: Configure `ALLOWED_ORIGINS` for your specific domains
3. **File paths**: Repository names are sanitized to prevent directory traversal
4. **Network access**: The server needs network permissions for Git operations
5. **File system**: Ensure proper permissions for the base directory

### Error Handling

All responses follow this format:

```json
{
  "data": any,
  "error": string | null,
  "success": boolean,
  "timestamp": string
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not found (invalid endpoint)
- `500` - Server error

### Extending the Server

You can extend the server by:

1. **Adding new endpoints** in the `handleRequest` method
2. **Custom authentication** by modifying `validateAuth`
3. **Additional Git operations** by adding methods
4. **Webhooks** for Git events
5. **File upload/download** for repository files
6. **WebSocket support** for real-time updates

### Docker Example

```dockerfile
FROM denoland/deno:1.45.5

WORKDIR /app
COPY . .

RUN deno cache examples/git-server.ts

EXPOSE 8000

CMD ["run", "--allow-read", "--allow-write", "--allow-net", "examples/git-server.ts"]
```

```bash
# Build and run
docker build -t @eol/git-server .
docker run -p 8000:8000 -e AUTH_TOKEN=secret @eol/git-server
```

This server provides a complete Git service that can be integrated into web applications, CI/CD pipelines, or used as a Git backend for custom tools.
