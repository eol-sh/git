


//// export

/**
 * Native Deno implementation of .gitignore pattern matching
 * Replaces the "ignore" npm package with a native implementation
 */

export interface GitIgnoreRule {
  directory: boolean;
  negative: boolean;
  pattern: string;
  regex: RegExp;
}

export class GitIgnore {
  private rules: GitIgnoreRule[] = [];

  constructor(patterns?: string[]) {
    if (patterns)
      this.add(patterns);
  }

  private globToRegex(pattern: string): RegExp {
    let i = 0;
    let regexPattern = "";

    /*** Handle leading slash ***/
    if (pattern.startsWith("/")) {
      regexPattern = "^";
      pattern = pattern.slice(1);
    } else {
      regexPattern = "(^|/)";
    }

    while (i < pattern.length) {
      const char = pattern[i];

      switch(char) {
        case "*": {
          if (pattern[i + 1] === "*") {
            if (pattern[i + 2] === "/") {
              regexPattern += ".*?";
              i += 3;
            } else {
              regexPattern += ".*";
              i += 2;
            }
          } else {
            regexPattern += "[^/]*";
            i++;
          }

          break;
        }

        case "?": {
          regexPattern += "[^/]";
          i++;

          break;
        }

        case "[": {
          const closeIndex = pattern.indexOf("]", i + 1);

          if (closeIndex !== -1) {
            regexPattern += pattern.slice(i, closeIndex + 1);
            i = closeIndex + 1;
          } else {
            regexPattern += "\\[";
            i++;
          }

          break;
        }

        case ".":
        case "(":
        case ")":
        case "+":
        case "^":
        case "$":
        case "|":
        case "\\": {
          regexPattern += "\\" + char;
          i++;

          break;
        }

        default: {
          regexPattern += char;
          i++;

          break;
        }
      }
    }

    /*** Handle directory patterns and end-of-path matching ***/
    if (pattern.endsWith("/"))
      regexPattern += "$";
    else
      regexPattern += "($|/)";

    return new RegExp(regexPattern);
  }

  private normalizePath(path: string): string {
    /*** Remove leading slash and normalize separators ***/
    return path.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  private parsePattern(pattern: string): GitIgnoreRule | null {
    let workingPattern = pattern;

    /*** Check if it’s a negative pattern ***/
    const negative = workingPattern.startsWith("!");

    if (negative)
      workingPattern = workingPattern.slice(1);

    /*** Check if it’s directory-only ***/
    const directory = workingPattern.endsWith("/");

    if (directory)
      workingPattern = workingPattern.slice(0, -1);

    /*** Convert glob pattern to regex ***/
    const regex = this.globToRegex(workingPattern);

    return {
      directory,
      negative,
      pattern: workingPattern, /*** Use the processed pattern ***/
      regex
    };
  }

  /**
   * Add patterns to the ignore list
   */
  add(patterns: string | string[]): this {
    if (!patterns)
      return this;

    const patternList = Array.isArray(patterns) ?
      patterns :
      typeof patterns === "string" ?
        patterns.split(/\r?\n/) :
        [patterns];

    for (const pattern of patternList) {
      const trimmed = pattern.trim();

      /*** Skip empty lines and comments ***/
      if (!trimmed || trimmed.startsWith("#"))
        continue;

      /*** Parse pattern ***/
      const rule = this.parsePattern(trimmed);

      if (rule)
        this.rules.push(rule);
    }

    return this;
  }

  /**
   * Filter array of paths, removing ignored ones
   */
  filter(paths: string[]): string[] {
    return paths.filter((path) => !this.ignores(path));
  }

  /**
   * Check if a path should be ignored
   */
  ignores(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    let ignored = false;

    for (const rule of this.rules) {
      if (rule.regex.test(normalizedPath))
        ignored = !rule.negative;
    }

    return ignored;
  }

  /**
   * Test a path and return detailed result (compatible with npm ignore package)
   */
  test(path: string): { ignored: boolean; unignored: boolean } {
    const normalizedPath = this.normalizePath(path);
    let ignored = false;
    let unignored = false;

    for (const rule of this.rules) {
      const matches = rule.regex.test(normalizedPath) ||
        (rule.directory && rule.regex.test(normalizedPath + "/"));

      if (matches) {
        if (rule.negative) {
          ignored = false;
          unignored = true;
        } else {
          ignored = true;
          unignored = false;
        }
      }
    }

    return { ignored, unignored };
  }
}

/**
 * Create a new GitIgnore instance
 */
export function createGitIgnore(patterns?: string | string[]): GitIgnore {
  return new GitIgnore(
    Array.isArray(patterns) ?
      patterns :
      patterns ?
        [patterns] :
        []
  );
}

/**
 * Parse .gitignore file content
 */
export function parseGitIgnore(content: string): GitIgnore {
  const lines = content.split(/\r?\n/);
  return new GitIgnore(lines);
}
