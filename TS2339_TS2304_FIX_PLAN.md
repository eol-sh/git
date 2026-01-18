# TypeScript Errors Fix Plan - TS2339 & TS2304

## Summary
Analysis identified **58 TS2339 errors** and **5 TS2304 errors** across the codebase.

## Error Categories and Fixes

### 1. FileSystem.promises (11 occurrences)
**Error**: `Property 'promises' does not exist on type 'FileSystem'`
**Files**: Primarily in `src/commands/bisect.ts`
**Root Cause**: The custom FileSystem type doesn't have a `promises` property
**Fix**: Either add `promises` property to FileSystem type or use fs directly without `.promises`

### 2. GitCommit Properties (17 occurrences total)
**Errors**: 
- `Property 'tree' does not exist on type 'GitCommit'` (6)
- `Property 'author' does not exist on type 'GitCommit'` (4)
- `Property 'committer' does not exist on type 'GitCommit'` (4)
- `Property 'parent' does not exist on type 'GitCommit'` (3)

**Files**: Various command files
**Root Cause**: GitCommit type definition is missing these required properties
**Fix**: Update GitCommit type interface to include these properties

### 3. String/Uint8Array Union Type (7 occurrences)
**Errors**:
- `Property 'trim' does not exist on type 'string | Uint8Array'` (6)
- `Property 'split' does not exist on type 'string | Uint8Array'` (1)

**Files**: `src/commands/bisect.ts` and others
**Root Cause**: Type union where string methods are called without type narrowing
**Fix**: Add type guards or explicit type casting

### 4. Bisect Completion Check Properties (6 occurrences)
**Errors**:
- `Property 'result' does not exist` (4)
- `Property 'message' does not exist` (2)

**Files**: Bisect-related files
**Root Cause**: Type definition doesn't match actual object structure
**Fix**: Update type definition for bisect completion check

### 5. FsInterface Properties (3 occurrences)
**Errors**:
- `Property 'rm' does not exist on type 'FsInterface'` (2)
- `Property 'read' does not exist on type 'FsInterface'` (1)

**Root Cause**: FsInterface missing required methods
**Fix**: Add missing method signatures to FsInterface

### 6. Type 'never' Issues (4 occurrences)
**Errors**:
- `Property 'path' does not exist on type 'never'` (3)
- `Property 'oid' does not exist on type 'never'` (1)

**Root Cause**: Arrays or variables incorrectly typed as 'never'
**Fix**: Properly type arrays and variables

### 7. Undefined Variables (5 occurrences)
**TS2304 Errors**:
- `Cannot find name 'conflicts'` (4)
- `Cannot find name 'state'` (1)

**Root Cause**: Variables used without declaration
**Fix**: Declare variables or fix typos

### 8. Miscellaneous (6 occurrences)
- `Property 'method' does not exist on type 'Response'` (1)
- `Property 'writeTree' does not exist on type 'GitIndex'` (1)
- `Property 'success' does not exist` (1)
- `Property 'isSymbolic' does not exist` (1)
- `Property 'entries' does not exist on type 'ReadTreeResult'` (1)
- `Property 'chmod' does not exist on type 'FileSystem'` (1)

## Implementation Priority

### Phase 1: Type Definition Updates
1. Update `GitCommit` interface to include tree, author, committer, parent
2. Update `FsInterface` to include read, rm methods
3. Update `FileSystem` type to include promises property or adjust usage
4. Fix bisect completion check type definition

### Phase 2: Type Narrowing and Guards
1. Add type guards for string | Uint8Array unions
2. Fix 'never' type issues by properly typing arrays
3. Declare missing variables (conflicts, state)

### Phase 3: Individual Fixes
1. Fix Response.method issue in http/web/index.ts
2. Add missing methods to GitIndex, GitRefManager
3. Fix ReadTreeResult.entries
4. Add chmod to FileSystem or adjust usage

## Files to Modify (Estimated)
- `src/types/` - Type definitions
- `src/commands/bisect.ts` - Multiple fixes needed
- `src/commands/rebase.ts` - GitCommit properties
- `src/commands/cherry-pick.ts` - GitCommit properties
- `src/commands/revert.ts` - GitCommit properties
- `src/commands/fetch.ts` - FsInterface issues
- `src/http/web/index.ts` - Response.method issue
- Various other command files for smaller fixes

## Verification Steps
1. Run `deno task check` after each phase
2. Ensure no new errors are introduced
3. Run existing tests to verify functionality
4. Document any breaking changes