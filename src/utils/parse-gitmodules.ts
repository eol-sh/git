/**
 * @fileoverview parse-gitmodules utility functions
 *
 * Utility functions for parse-gitmodules operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/parse-gitmodules.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

/**
 * Parse .gitmodules file content
 */

export interface SubmoduleConfig {
  branch?: string;
  name: string;
  path: string;
  update?: string;
  url: string;
}

/**
 * Parse .gitmodules configuration format
 *
 * Example:
 * [submodule "example"]
 *   branch = main
 *   path = lib/example
 *   url = https://eol.sh/~example/example.git
 */
export function parseGitmodules(content: string): Map<string, SubmoduleConfig> {
  const lines = content.split("\n").map(line => line.trim()).filter(Boolean);
  const modules = new Map<string, SubmoduleConfig>();
  let currentModule: Partial<SubmoduleConfig> | null = null;
  let currentName: string | null = null;

  for (const line of lines) {
    /*** Section header: [submodule "name"] ***/
    const sectionMatch = line.match(/^\[submodule\s+"([^"]+)"\]$/);

    if (sectionMatch) {
      /*** Save previous module if complete ***/
      if (currentModule && currentName && currentModule.path && currentModule.url) {
        modules.set(currentModule.path, {
          branch: currentModule.branch,
          name: currentName,
          path: currentModule.path,
          update: currentModule.update,
          url: currentModule.url
        });
      }

      /*** Start new module ***/
      currentName = sectionMatch[1];
      currentModule = { name: currentName };

      continue;
    }

    /*** Skip if not in a submodule section ***/
    if (!currentModule)
      continue;

    /*** Property lines: key = value ***/
    const propMatch = line.match(/^\s*(\w+)\s*=\s*(.+)$/);

    if (propMatch) {
      const [, key, value] = propMatch;

      switch(key) {
        case "path": {
          currentModule.path = value;
          break;
        }

        case "url": {
          currentModule.url = value;
          break;
        }

        case "branch": {
          currentModule.branch = value;
          break;
        }

        case "update": {
          currentModule.update = value;
          break;
        }
      }
    }
  }

  /*** Save final module if complete ***/
  if (currentModule && currentName && currentModule.path && currentModule.url) {
    modules.set(currentModule.path, {
      branch: currentModule.branch,
      name: currentName,
      path: currentModule.path,
      update: currentModule.update,
      url: currentModule.url
    });
  }

  return modules;
}

/**
 * Generate .gitmodules file content from submodule configurations
 */
export function stringifyGitmodules(modules: Map<string, SubmoduleConfig>): string {
  const sections: string[] = [];

  for (const [, module] of modules) {
    const lines = [`[submodule "${module.name}"]`];
    lines.push(`\tpath = ${module.path}`);
    lines.push(`\turl = ${module.url}`);

    if (module.branch)
      lines.push(`\tbranch = ${module.branch}`);

    if (module.update)
      lines.push(`\tupdate = ${module.update}`);

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n") + "\n";
}
