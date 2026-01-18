# JSDoc Documentation Workflow

Comprehensive guide for documenting the 325-file TypeScript Git implementation.

## Quick Start

### 1. Automated Header Addition (30 minutes)

```bash
# Preview what will be added
./scripts/add-jsdoc-headers.sh --dry-run

# Add basic headers to all files (creates backup)
./scripts/add-jsdoc-headers.sh

# Check results
git status
```

### 2. Priority-Based Enhancement 

Start with Tier 1 files for maximum impact:

```bash
# API files (highest priority)
ls src/api/*.ts | wc -l  # 77 files
```

## Documentation Tiers

### Tier 1: Critical API Files (77 files) ⚡ **START HERE**
**Estimated time: 20-30 hours**

**High Priority:**
- `src/api/clone.ts` - Repository cloning
- `src/api/push.ts` - Remote pushing  
- `src/api/pull.ts` - Remote pulling
- `src/api/fetch.ts` - Remote fetching
- `src/api/merge.ts` - Branch merging
- `src/api/checkout.ts` - Branch switching
- `src/api/branch.ts` - Branch management
- `src/api/status.ts` - Repository status

**Medium Priority:**
- All remaining API files in `src/api/`

**Documentation standard:** Use `src/api/commit.ts`, `src/api/init.ts`, `src/api/add.ts` as templates

### Tier 2: Core Models (25 files) 
**Estimated time: 8-12 hours**

```bash
# Model classes
ls src/models/*.ts
```

**Priority order:**
1. `src/models/git-commit.ts`
2. `src/models/git-tree.ts` 
3. `src/models/git-object.ts`
4. `src/models/git-index.ts`
5. All remaining models

### Tier 3: Error Classes (20 files) ⚡ **QUICK WINS**
**Estimated time: 3-4 hours**

```bash
ls src/errors/*.ts
```

**High impact, low effort** - Document all error classes quickly:
- Clear error conditions  
- When they're thrown
- How to handle them

### Tier 4: Managers (15 files)
**Estimated time: 5-8 hours**

```bash
ls src/managers/*.ts
```

### Tier 5: Commands (59 files)
**Estimated time: 15-20 hours**

```bash
ls src/commands/*.ts
```

### Tier 6: Utilities & Storage (60+ files)  
**Estimated time: 12-18 hours**

```bash
ls src/utils/*.ts
ls src/storage/*.ts
```

## Documentation Standards

### File Header Template

```typescript
/**
 * @fileoverview [Brief description of the module's purpose]
 * 
 * [Detailed explanation of what this module does, how it fits
 * into the larger system, any important implementation notes]
 * 
 * @module [relative path from src/]
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */
```

### Interface Documentation

```typescript
/**
 * [Description of what this interface represents]
 * 
 * @interface [InterfaceName]
 */
interface ExampleOptions {
  /** [Description of what this property does] */
  property: string;
  /** [Description with default value noted] */
  optional?: boolean; // defaults to false
}
```

### Function Documentation

```typescript
/**
 * [Brief description of what the function does]
 * 
 * [Longer description explaining the behavior, algorithm,
 * important side effects, or usage patterns]
 *
 * @param {Object} options - [Description of options parameter]
 * @param {string} options.required - [Description of required param]  
 * @param {boolean} [options.optional=false] - [Description with default]
 * @param {string[]} [options.array] - [Description of array param]
 * 
 * @returns {Promise<ResultType>} [Description of what is returned]
 * 
 * @throws {ErrorType} [When this error is thrown]
 * @throws {AnotherError} [When this other error is thrown]
 * 
 * @example
 * ```typescript
 * // [Brief example description]
 * const result = await functionName({
 *   required: 'value',
 *   optional: true
 * })
 * 
 * // [Another example]
 * const advanced = await functionName({
 *   required: 'value',
 *   array: ['item1', 'item2']
 * })
 * ```
 * 
 * @see {@link https://relevant-docs.com} [Description of related docs]
 * @since 1.0.0
 */
```

### Class Documentation

```typescript
/**
 * [Description of what this class represents]
 * 
 * [Longer description of the class purpose, main responsibilities,
 * and how it should be used]
 * 
 * @class ClassName
 * @example
 * ```typescript
 * const instance = new ClassName(options)
 * const result = instance.method()
 * ```
 */
class ExampleClass {
  /**
   * [Description of the constructor]
   * 
   * @param {ConstructorOptions} options - Configuration options
   */
  constructor(options: ConstructorOptions) {
    // implementation
  }

  /**
   * [Method description]
   * 
   * @param {string} param - Parameter description
   * @returns {Promise<string>} Return value description
   */
  async method(param: string): Promise<string> {
    // implementation
  }
}
```

## Quality Checklist

### For Each File:
- [ ] Has `@fileoverview` with clear purpose
- [ ] Has `@module` with correct path
- [ ] All interfaces documented with `@interface`
- [ ] All public functions have complete JSDoc
- [ ] Parameters documented with types and descriptions
- [ ] Return values documented
- [ ] Errors/exceptions documented with `@throws`
- [ ] At least one `@example` for public functions
- [ ] Links to relevant Git docs with `@see`

### For API Files (Extra Requirements):
- [ ] Multiple realistic examples showing different use cases
- [ ] Clear parameter validation notes
- [ ] Error handling examples
- [ ] Integration with other API functions shown

### For Internal Files:
- [ ] Marked with `@internal` if not public API
- [ ] Clear notes about when/how to use
- [ ] References to public API alternatives

## Progress Tracking

### Daily Goals:
- **Week 1:** Complete Tier 1 API files (10-15 files/day)
- **Week 2:** Complete Tier 2 Models + Tier 3 Errors
- **Week 3:** Complete Tier 4 Managers + start Tier 5 Commands
- **Week 4:** Complete remaining tiers

### Commands to Track Progress:

```bash
# Count files with JSDoc headers
find src -name "*.ts" -exec grep -l "@fileoverview" {} \; | wc -l

# Count files without JSDoc headers  
find src -name "*.ts" | while read file; do
  if ! grep -q "@fileoverview" "$file"; then
    echo "$file"
  fi
done | wc -l

# List files by category without documentation
find src/api -name "*.ts" | while read file; do
  if ! grep -q "@fileoverview" "$file"; then
    echo "API: $file"
  fi
done

# Check documentation quality (functions with @param)
find src/api -name "*.ts" -exec grep -l "@param" {} \; | wc -l
```

## Validation

### TypeScript Integration:
```bash
# Check that JSDoc doesn't break TypeScript compilation
deno check src/index.ts

# Verify JSDoc parsing
npx tsc --noEmit --checkJs src/**/*.ts 2>&1 | grep -i jsdoc
```

### Documentation Generation:
```bash
# Generate docs to verify JSDoc syntax (optional)
npx typedoc --out docs src/index.ts
```

## Backup and Recovery

The automation script creates backups automatically:

```bash
# List available backups
ls -la backups/

# Restore from backup if needed
./scripts/add-jsdoc-headers.sh --restore

# Manual restore from specific backup
cp -r backups/jsdoc-20240116_143022/* src/
```

## Best Practices

### Content Guidelines:
1. **Be specific** - "Commits staged files" vs "Handles Git operations"
2. **Include context** - Explain how this fits into Git workflow
3. **Show realistic examples** - Use actual file paths and realistic data
4. **Document edge cases** - What happens with empty repos, merge conflicts, etc.
5. **Link to Git docs** - Help users understand Git concepts

### Technical Guidelines:
1. **Use TypeScript types** - `@param {string[]} files` not just `@param files`
2. **Document promises** - `@returns {Promise<string>}` with description
3. **Be consistent** - Follow the templates exactly
4. **Test examples** - Make sure code examples actually work
5. **Update incrementally** - Don't try to perfect everything at once

## Time Estimates

| Tier | Files | Hours | Priority |
|------|-------|-------|----------|
| 1 - API | 77 | 20-30 | Critical |
| 2 - Models | 25 | 8-12 | High |
| 3 - Errors | 20 | 3-4 | Quick Win |
| 4 - Managers | 15 | 5-8 | Medium |
| 5 - Commands | 59 | 15-20 | Medium |
| 6 - Utils/Storage | 60+ | 12-18 | Low |
| **Total** | **325** | **68-99** | - |

## Success Metrics

- **Day 1:** All files have basic JSDoc headers (automation)
- **Week 1:** All Tier 1 API files have comprehensive documentation
- **Week 2:** Tiers 1-3 complete (critical user-facing functionality)
- **Month 1:** Full codebase documentation complete

**Target:** Professional-grade documentation that serves both developers and TypeScript tooling, with the most important user-facing APIs documented first.