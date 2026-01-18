#!/bin/bash

# JSDoc Header Automation Script for EOL Git Implementation
# Adds appropriate JSDoc headers to TypeScript files based on their category

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups/jsdoc-$(date +%Y%m%d_%H%M%S)"
SRC_DIR="./src"
DRY_RUN=false
RESTORE=false
VERBOSE=false

# Counters
TOTAL_FILES=0
PROCESSED_FILES=0
SKIPPED_FILES=0

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Add JSDoc headers to TypeScript files in the Git implementation."
    echo ""
    echo "Options:"
    echo "  --dry-run    Preview changes without modifying files"
    echo "  --restore    Restore from backup"
    echo "  --verbose    Show detailed progress"
    echo "  --help       Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                   # Add headers to all files"
    echo "  $0 --dry-run         # Preview what will be changed"
    echo "  $0 --restore         # Restore from latest backup"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --restore)
            RESTORE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Restore function
restore_from_backup() {
    local latest_backup=$(ls -t ./backups/jsdoc-* 2>/dev/null | head -1)

    if [[ -z "$latest_backup" ]]; then
        echo -e "${RED}No backup found${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Restoring from backup: $latest_backup${NC}"

    if [[ ! "$DRY_RUN" == true ]]; then
        cp -r "$latest_backup"/* ./src/
        echo -e "${GREEN}Restored from backup successfully${NC}"
    else
        echo -e "${BLUE}[DRY RUN] Would restore from: $latest_backup${NC}"
    fi

    exit 0
}

# File categorization function
get_file_category() {
    local filepath="$1"
    local filename=$(basename "$filepath")
    local dirname=$(dirname "$filepath")

    case "$dirname" in
        */api*)
            echo "api"
            ;;
        */commands*)
            echo "command"
            ;;
        */models*)
            echo "model"
            ;;
        */managers*)
            echo "manager"
            ;;
        */errors*)
            echo "error"
            ;;
        */utils*)
            echo "util"
            ;;
        */storage*)
            echo "storage"
            ;;
        */wire*)
            echo "wire"
            ;;
        *)
            echo "generic"
            ;;
    esac
}

# JSDoc template generation
generate_jsdoc_header() {
    local filepath="$1"
    local category="$2"
    local filename=$(basename "$filepath" .ts)
    local relative_path=${filepath#./src/}

    case "$category" in
        "api")
            cat << EOF
/**
 * @fileoverview Git $filename API - High-level user interface
 *
 * This module provides the public API for $filename operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

EOF
            ;;
        "command")
            cat << EOF
/**
 * @fileoverview Git $filename command implementation
 *
 * Internal implementation of the $filename Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */

EOF
            ;;
        "model")
            cat << EOF
/**
 * @fileoverview $filename model definition
 *
 * Defines the $filename class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

EOF
            ;;
        "manager")
            cat << EOF
/**
 * @fileoverview $filename manager
 *
 * Manages $filename resources including creation, access, and lifecycle.
 * Provides centralized control and caching for $filename operations.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

EOF
            ;;
        "error")
            cat << EOF
/**
 * @fileoverview $filename error class
 *
 * Defines the $filename error type for specific error conditions
 * in the Git implementation with proper error codes and messages.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

EOF
            ;;
        "util")
            cat << EOF
/**
 * @fileoverview $filename utility functions
 *
 * Utility functions for $filename operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

EOF
            ;;
        "storage")
            cat << EOF
/**
 * @fileoverview $filename storage operations
 *
 * Low-level storage operations for $filename including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */

EOF
            ;;
        "wire")
            cat << EOF
/**
 * @fileoverview $filename wire protocol implementation
 *
 * Handles $filename wire protocol operations for Git network
 * communication including parsing and serialization.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */

EOF
            ;;
        *)
            cat << EOF
/**
 * @fileoverview $filename implementation
 *
 * Implementation of $filename functionality for the Git system.
 *
 * @module $relative_path
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

EOF
            ;;
    esac
}

# Check if file already has JSDoc header
has_jsdoc_header() {
    local filepath="$1"
    head -20 "$filepath" | grep -q "@fileoverview\|@module" 2>/dev/null
}

# Process a single file
process_file() {
    local filepath="$1"
    local category=$(get_file_category "$filepath")
    local filename=$(basename "$filepath")

    # Skip if already has JSDoc
    if has_jsdoc_header "$filepath"; then
        ((SKIPPED_FILES++))
        if [[ "$VERBOSE" == true ]]; then
            echo -e "${YELLOW}SKIP${NC} $filepath (already has JSDoc)"
        fi
        return
    fi

    # Generate header
    local header=$(generate_jsdoc_header "$filepath" "$category")

    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${BLUE}WOULD ADD${NC} $filepath ($category)"
        if [[ "$VERBOSE" == true ]]; then
            echo "Header preview:"
            echo "$header" | head -5
            echo "..."
        fi
    else
        # Create backup directory if it doesn't exist
        mkdir -p "$BACKUP_DIR/$(dirname "${filepath#./src/}")"

        # Backup original file
        cp "$filepath" "$BACKUP_DIR/${filepath#./src/}"

        # Add header to file
        {
            echo -n "$header"
            cat "$filepath"
        } > "${filepath}.tmp" && mv "${filepath}.tmp" "$filepath"

        echo -e "${GREEN}ADDED${NC} $filepath ($category)"
    fi

    ((PROCESSED_FILES++))
}

# Main execution
main() {
    if [[ "$RESTORE" == true ]]; then
        restore_from_backup
    fi

    echo -e "${BLUE}JSDoc Header Automation for EOL Git Implementation${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo ""

    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}DRY RUN MODE - No files will be modified${NC}"
    else
        echo -e "${GREEN}Adding JSDoc headers to TypeScript files...${NC}"
        echo -e "Backup will be created at: ${BACKUP_DIR}"
    fi
    echo ""

    # Find all TypeScript files
    while IFS= read -r -d '' filepath; do
        ((TOTAL_FILES++))
        process_file "$filepath"
    done < <(find "$SRC_DIR" -name "*.ts" -type f -print0)

    echo ""
    echo -e "${BLUE}Summary:${NC}"
    echo -e "Total files: $TOTAL_FILES"
    echo -e "Processed: $PROCESSED_FILES"
    echo -e "Skipped: $SKIPPED_FILES"

    if [[ "$DRY_RUN" != true && "$PROCESSED_FILES" -gt 0 ]]; then
        echo ""
        echo -e "${GREEN}Success! JSDoc headers added to $PROCESSED_FILES files.${NC}"
        echo -e "Backup created at: ${BACKUP_DIR}"
        echo -e "To restore: $0 --restore"
    fi
}

# Check if src directory exists
if [[ ! -d "$SRC_DIR" ]]; then
    echo -e "${RED}Error: Source directory '$SRC_DIR' not found${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

# Run main function
main "$@"
