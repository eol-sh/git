/**
 * @fileoverview git-config model definition
 *
 * Defines the git-config class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-config.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

interface ConfigSchema {
  [section: string]: {
    [key: string]: (val: any) => any;
  };
}

interface NormalizedPath {
  isSection: boolean;
  name: string;
  path: string;
  section: string;
  sectionPath: string;
  subsection?: string | undefined;
}

interface ParsedConfigLine {
  isSection?: boolean;
  line: string;
  modified?: boolean;
  name: string | null;
  path: string;
  section: string | null;
  subsection: string | null | undefined;
  value: string | null;
}

/*** This is straight from parse_unit_factor in config.c of canonical git ***/
const num = (val: string | number): number => {
  if (typeof val === "number")
    return val;

  val = val.toLowerCase();
  let n = parseInt(val);

  if (val.endsWith("k"))
    n *= 1024;

  if (val.endsWith("m"))
    n *= 1024 * 1024;

  if (val.endsWith("g"))
    n *= 1024 * 1024 * 1024;

  return n;
};

/*** This is straight from git_parse_maybe_bool_text in config.c of canonical git ***/
const bool = (val: string | boolean): boolean => {
  if (typeof val === "boolean")
    return val;

  val = val.trim().toLowerCase();

  if (val === "true" || val === "yes" || val === "on")
    return true;

  if (val === "false" || val === "no" || val === "off")
    return false;

  throw Error(`Expected "true", "false", "yes", "no", "on", or "off", but got ${val}`);
};

const schema: ConfigSchema = {
  core: {
    bare: bool,
    bigFileThreshold: num,
    filemode: bool,
    ignorecase: bool,
    logallrefupdates: bool,
    symlinks: bool
  }
};

// https://git-scm.com/docs/git-config#_syntax

// section starts with [ and ends with ]
// section is alphanumeric (ASCII) with - and .
// section is case insensitive
// subsection is optional
// subsection is specified after section and one or more spaces
// subsection is specified between double quotes
const SECTION_LINE_REGEX = /^\[([A-Za-z0-9-.]+)(?: "(.*)")?\]$/;
const SECTION_REGEX = /^[A-Za-z0-9-.]+$/;
/*** Comments start with either # or ; and extend to the end of line ***/
const VARIABLE_VALUE_COMMENT_REGEX = /^(.*?)( *[#;].*)$/;
// variable lines contain a name, and equal sign and then a value
// variable lines can also only contain a name (the implicit value is a boolean true)
// variable name is alphanumeric (ASCII) with -
// variable name starts with an alphabetic character
// variable name is case insensitive
const VARIABLE_LINE_REGEX = /^([A-Za-z][A-Za-z-]*)(?: *= *(.*))?$/;
const VARIABLE_NAME_REGEX = /^[A-Za-z][A-Za-z-]*$/;

const extractSectionLine = (line: string): [string, string] | null => {
  const matches = SECTION_LINE_REGEX.exec(line);

  if (matches !== null) {
    const [section, subsection] = matches.slice(1);
    return [section, subsection];
  }

  return null;
};

const extractVariableLine = (line: string): [string, string] | null => {
  const matches = VARIABLE_LINE_REGEX.exec(line);

  if (matches !== null) {
    const [name, rawValue = "true"] = matches.slice(1);
    const valueWithoutComments = removeComments(rawValue);
    const valueWithoutQuotes = removeQuotes(valueWithoutComments);

    return [name, valueWithoutQuotes];
  }

  return null;
};

const findLastIndex = <T>(array: T[], callback: (item: T) => boolean): number => {
  return array.reduce((lastIndex, item, index) => {
    return callback(item) ?
      index :
      lastIndex;
  }, -1);
};

const hasOddNumberOfQuotes = (text: string): boolean => {
  const numberOfQuotes = (text.match(/(?:^|[^\\])"/g) || []).length;
  return numberOfQuotes % 2 !== 0;
};

const lower = (text: string | null): string | null => {
  return text !== null ?
    text.toLowerCase() :
    null;
};

const removeComments = (rawValue: string): string => {
  const commentMatches = VARIABLE_VALUE_COMMENT_REGEX.exec(rawValue);

  if (commentMatches === null)
    return rawValue;

  const [valueWithoutComment, comment] = commentMatches.slice(1);

  /*** if odd number of quotes before and after comment => comment is escaped ***/
  if (
    hasOddNumberOfQuotes(valueWithoutComment) &&
    hasOddNumberOfQuotes(comment)
  ) return `${valueWithoutComment}${comment}`;

  return valueWithoutComment;
};

const removeQuotes = (text: string): string => {
  return text.split("").reduce((newText, c, idx, text) => {
    const isQuote = c === `"` && text[idx - 1] !== "\\";
    const isEscapeForQuote = c === "\\" && text[idx + 1] === `"`;

    if (isQuote || isEscapeForQuote)
      return newText;

    return newText + c;
  }, "");
};



const getPath = (section: string | null, subsection: string | null | undefined, name: string | null): string => {
  return [lower(section), subsection, lower(name)]
    .filter((a) => a !== null)
    .join(".");
};

const normalizePath = (path: string): NormalizedPath => {
  const pathSegments = path.split(".");
  const section = pathSegments.shift()!;
  const name = pathSegments.pop()!;
  const subsection = pathSegments.length ?
    pathSegments.join(".") :
    undefined;

  return {
    isSection: !!section,
    name,
    path: getPath(section, subsection, name),
    section,
    sectionPath: getPath(section, subsection, null),
    subsection
  };
};



//// export

/*** Note: there are a LOT of edge cases that aren’t covered (e.g. keys in sections that also
have subsections, [include] directives, etc. ***/
export class GitConfig {
  public parsedConfig: ParsedConfigLine[];

  constructor(text?: string) {
    let section: string | null = null;
    let subsection: string | null = null;

    this.parsedConfig = text ?
      text.split("\n").map((line) => {
        let name: string | null = null;
        let value: string | null = null;

        const trimmedLine = line.trim();
        const extractedSection = extractSectionLine(trimmedLine);
        const isSection = extractedSection !== null;

        if (isSection) {
          [section, subsection] = extractedSection;
        } else {
          const extractedVariable = extractVariableLine(trimmedLine);
          const isVariable = extractedVariable !== null;

          if (isVariable)
            [name, value] = extractedVariable;
        }

        const path = getPath(section, subsection, name);

        return {
          isSection,
          line,
          name,
          path,
          section,
          subsection,
          value
        };
      }) :
      [];
  }

  static from(text: string): GitConfig {
    return new GitConfig(text);
  }



  append(path: string, value: unknown): Promise<void> {
    return this.set(path, value, true);
  }

  deleteSection(section: string, subsection?: string): Promise<void> {
    this.parsedConfig = this.parsedConfig.filter(
      (config) => !(config.section === section && config.subsection === subsection)
    );

    return Promise.resolve();
  }

  get(path: string, getall: boolean = false): Promise<unknown> {
    const normalizedPath = normalizePath(path).path;

    const allValues = this.parsedConfig
      .filter((config) => config.path === normalizedPath)
      .map(({ section, name, value }) => {
        const fn = schema[section!] && schema[section!][name!];
        return fn ? fn(value!) : value;
      });

    return Promise.resolve(getall ?
      allValues :
      allValues.pop());
  }

  getall(path: string): Promise<unknown[]> {
    return this.get(path, true) as Promise<unknown[]>;
  }

  getSubsections(section: string): Promise<(string | null | undefined)[]> {
    return Promise.resolve(this.parsedConfig
      .filter((config) => config.isSection && config.section === section)
      .map((config) => config.subsection));
  }

  set(path: string, value: unknown, append: boolean = false): Promise<void> {
    const {
      isSection,
      name,
      path: normalizedPath,
      section,
      sectionPath,
      subsection
    } = normalizePath(path);

    const configIndex = findLastIndex(
      this.parsedConfig,
      (config) => config.path === normalizedPath
    );

    if (value === null) {
      if (configIndex !== -1)
        this.parsedConfig.splice(configIndex, 1);
    } else {
      if (configIndex !== -1) {
        const config = this.parsedConfig[configIndex];
        /*** Name should be overwritten in case the casing changed ***/
        const modifiedConfig: ParsedConfigLine = Object.assign({}, config, {
          modified: true,
          name,
          value
        });

        if (append)
          this.parsedConfig.splice(configIndex + 1, 0, modifiedConfig);
        else
          this.parsedConfig[configIndex] = modifiedConfig;
      } else {
        const sectionIndex = this.parsedConfig.findIndex(
          (config) => config.path === sectionPath
        );

        const newConfig: ParsedConfigLine = {
          line: "",
          modified: true,
          name,
          path: normalizedPath,
          section,
          subsection,
          value: value as string | null
        };

        if (SECTION_REGEX.test(section) && VARIABLE_NAME_REGEX.test(name)) {
          if (sectionIndex >= 0) {
            /*** Reuse existing section ***/
            this.parsedConfig.splice(sectionIndex + 1, 0, newConfig);
          } else {
            /*** Add a new section ***/
            const newSection: ParsedConfigLine = {
              isSection,
              line: "",
              modified: true,
              name: null,
              path: sectionPath,
              section,
              subsection,
              value: null
            };

            this.parsedConfig.push(newSection, newConfig);
          }
        }
      }
    }

    return Promise.resolve();
  }

  toString(): string {
    return this.parsedConfig
      .map(({ line, modified = false, name, section, subsection, value }) => {
        if (!modified)
          return line;

        if (name !== null && value !== null) {
          if (typeof value === "string" && /[#;]/.test(value)) {
            /*** A `#` or `;` symbol denotes a comment, so we have to wrap it in double quotes ***/
            return `\t${name} = "${value}"`;
          }

          return `\t${name} = ${value}`;
        }

        if (subsection !== null)
          return `[${section} "${subsection}"]`;

        return `[${section}]`;
      })
      .join("\n");
  }
}
