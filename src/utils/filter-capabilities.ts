/**
 * @fileoverview filter-capabilities utility functions
 *
 * Utility functions for filter-capabilities operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/filter-capabilities.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function filterCapabilities(server: string[], client: string[]): string[] {
  const serverNames = server.map((cap) => cap.split("=", 1)[0]);

  return client.filter((cap) => {
    const name = cap.split("=", 1)[0];
    return serverNames.includes(name);
  });
}
