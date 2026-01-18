/*** Core type definitions for @eol/git ***/



//// export

export interface Author {
  email: string;
  name: string;
  timestamp: number;
  timezoneOffset: number;
}

export interface Committer extends Author {}

export interface Tagger extends Author {}

export interface CommitObject {
  author: Author;
  committer: Committer;
  gpgsig?: string;
  message: string;
  parent: string[];
  tree: string;
}

export interface TreeEntry {
  mode: string;
  oid: string;
  path: string;
  type: "blob" | "commit" | "tree";
}

export type TreeObject = TreeEntry[];

export interface TagObject {
  gpgsig?: string;
  message: string;
  object: string;
  tag: string;
  tagger: Tagger;
  type: "blob" | "commit" | "tag" | "tree";
}

export interface GitRef {
  oid: string;
  ref: string;
}

export interface RemoteRef extends GitRef {
  peeled?: string;
  target?: string;
}

export interface GitHttpRequest {
  agent?: any;
  body?: any;
  headers?: Record<string, string>;
  method?: string;
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  url: string;
}

export interface GitHttpResponse {
  body: AsyncIterable<Uint8Array>;
  headers: Record<string, string>;
  method: string;
  statusCode: number;
  statusMessage: string;
  url: string;
}

export interface HttpClient {
  request: (options: GitHttpRequest) => Promise<GitHttpResponse>;
}

export interface FsInterface {
  lstat: (path: string) => Promise<Deno.FileInfo>;
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  read: (path: string) => Promise<Uint8Array>;
  readdir: (path: string) => AsyncIterable<Deno.DirEntry> | Promise<string[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  rm: (path: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
  rmdir: (path: string) => Promise<void>;
  stat: (path: string) => Promise<Deno.FileInfo>;
  unlink: (path: string) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
}

export interface BaseOptions {
  cache?: Map<string, any>;
  dir: string;
  fs: FsInterface;
  gitdir?: string;
}

export interface CloneOptions extends BaseOptions {
  depth?: number;
  exclude?: string[];
  http: HttpClient;
  include?: string[];
  noCheckout?: boolean;
  noTags?: boolean;
  onAuth?: (url: string, auth: AuthOptions) => AuthResult | Promise<AuthResult>;
  onAuthFailure?: (url: string, auth: AuthOptions) => void | Promise<void>;
  onAuthSuccess?: (url: string, auth: AuthOptions) => void | Promise<void>;
  onMessage?: (message: string) => void | Promise<void>;
  onProgress?: (progress: ProgressEvent) => void | Promise<void>;
  ref?: string;
  since?: Date;
  singleBranch?: boolean;
  url: string;
}

export interface CommitOptions extends BaseOptions {
  author?: Author;
  committer?: Committer;
  message: string;
  onSign?: (payload: string) => Promise<string>;
  parent?: string[];
  tree?: string;
}

export interface AuthOptions {
  headers?: Record<string, string>;
  oauth2format?: "bitbucket" | "github" | "gitlab";
  password?: string;
  token?: string;
  useHttpPath?: boolean;
  username?: string;
}

export interface AuthResult extends AuthOptions {
  cancel?: boolean;
}

export type FileStatus =
  | "*absent"
  | "*added"
  | "*deleted"
  | "*modified"
  | "*unmodified"
  | "absent"
  | "added"
  | "deleted"
  | "ignored"
  | "modified"
  | "unmodified";

export type StatusRow = [string, number, number, number];

export interface WalkerEntry {
  content(): Promise<Uint8Array | void>;
  mode(): Promise<number>;
  oid(): Promise<string>;
  stat(): Promise<Deno.FileInfo>;
  type(): Promise<"blob" | "commit" | "special" | "tree">;
}

export interface Walker {
  [Symbol.asyncIterator](): AsyncIterator<WalkerEntry>;
}

export interface GitError extends Error {
  caller?: string;
  code: string;
  data?: any;
  name: string;
}

export interface ProgressEvent {
  lengthComputable: boolean;
  loaded: number;
  phase: string;
  total: number;
}

export interface PackageInfo {
  agent: string;
  name: string;
  version: string;
}

export interface ReadBlobResult {
  blob: Uint8Array;
  oid: string;
}

export interface ReadCommitResult {
  commit: CommitObject;
  oid: string;
  payload: string;
}

export interface ReadTreeResult {
  oid: string;
  tree: TreeObject;
}

export type OnAuthCallback = (url: string, auth: AuthOptions) => AuthResult | Promise<AuthResult>;
export type OnMessageCallback = (message: string) => void | Promise<void>;
export type OnProgressCallback = (event: ProgressEvent) => void | Promise<void>;
export type OnSignCallback = (payload: string) => Promise<string>;

export interface PostCheckoutParams {
  newHead: string;
  previousHead: string;
  type: "branch" | "file";
}

export type PostCheckoutCallback = (args: PostCheckoutParams) => void | Promise<void>;

/*** Aliases for legacy callback types ***/
export type AuthCallback = OnAuthCallback;
export type AuthFailureCallback = OnAuthCallback;
export type AuthSuccessCallback = (url: string, auth: AuthOptions) => void | Promise<void>;
export type MessageCallback = OnMessageCallback;
export type PrePushCallback = (url: string, refs: string[]) => void | Promise<void>;
export type ProgressCallback = OnProgressCallback;
export type SignCallback = OnSignCallback;

/*** Legacy type aliases for compatibility ***/
export type Cache = Map<string, unknown>;
export type FsClient = FsInterface;

export interface FetchResult {
  defaultBranch: string | null;
  fetchHead: string | null;
  fetchHeadDescription: string | null;
  headers?: Record<string, string>;
  pruned?: string[];
}

export interface PushResult {
  error?: string;
  headers?: Record<string, string>;
  ok: boolean;
  refs: Record<string, RefUpdateStatus>;
}

export interface RefUpdateStatus {
  error: string;
  ok: boolean;
}

export interface MergeResult {
  alreadyMerged?: boolean;
  fastForward?: boolean;
  mergeCommit?: boolean;
  oid?: string;
  tree?: string;
}

export interface MergeDriverParams {
  branches: string[];
  contents: string[];
  path: string;
}

export type MergeDriverCallback = (args: MergeDriverParams) =>
  | { cleanMerge: boolean; mergedText: string }
  | Promise<{ cleanMerge: boolean; mergedText: string }>;

export interface ReadTagResult {
  oid: string;
  payload: string;
  tag: TagObject;
}

export interface DeflatedObject {
  format: "deflated";
  object: Uint8Array;
  oid: string;
  source?: string;
  type: "deflated";
}

export interface WrappedObject {
  format: "wrapped";
  object: Uint8Array;
  oid: string;
  source?: string;
  type: "wrapped";
}

export interface RawObject {
  format: "content";
  object: Uint8Array;
  oid: string;
  source?: string;
  type: "blob" | "commit" | "tag" | "tree";
}

export interface ParsedBlobObject {
  format: "parsed";
  object: string;
  oid: string;
  source?: string;
  type: "blob";
}

export interface ParsedCommitObject {
  format: "parsed";
  object: CommitObject;
  oid: string;
  source?: string;
  type: "commit";
}

export interface ParsedTreeObject {
  format: "parsed";
  object: TreeObject;
  oid: string;
  source?: string;
  type: "tree";
}

export interface ParsedTagObject {
  format: "parsed";
  object: TagObject;
  oid: string;
  source?: string;
  type: "tag";
}

export type ParsedObject =
  | ParsedBlobObject
  | ParsedCommitObject
  | ParsedTagObject
  | ParsedTreeObject;

export type ReadObjectResult =
  | DeflatedObject
  | ParsedObject
  | RawObject
  | WrappedObject;

export interface PackObjectsResult {
  filename: string;
  packfile?: Uint8Array;
}

/*** Stash operation types ***/
export type StashOp = "apply" | "clear" | "drop" | "list" | "pop" | "push";
