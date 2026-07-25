/**
 * Search Helper Utility
 *
 * Provides reusable functions for implementing dynamic search functionality
 * across all repositories with proper security validation.
 */

/**
 * Validates if a search field is allowed and builds Prisma search condition
 *
 * @param searchKey - The field name to search in
 * @param searchTerm - The value to search for
 * @param allowedFields - Array of allowed searchable field names
 * @returns Prisma search condition object or undefined
 * @throws Error if searchKey is not in allowedFields
 *
 * @example
 * ```typescript
 * const ALLOWED_FIELDS = ['username', 'email'] as const;
 *
 * const searchCondition = SearchHelper.buildSearchCondition(
 *   'username',
 *   'john',
 *   ALLOWED_FIELDS
 * );
 * // Returns: { username: { contains: 'john', mode: 'insensitive' } }
 * ```
 */
export class SearchHelper {
  static buildSearchCondition<T extends string>(
    searchKey: string | undefined,
    searchTerm: string | undefined,
    allowedFields: readonly T[]
  ): Record<string, { contains: string; mode: 'insensitive' }> | undefined {
    // If either parameter is missing, return undefined (no search)
    if (!searchKey || !searchTerm) {
      return undefined;
    }

    // Validate that searchKey is in the allowed fields list
    if (!allowedFields.includes(searchKey as T)) {
      throw new Error(
        `Invalid search field: "${searchKey}". Allowed fields: ${allowedFields.join(', ')}`
      );
    }

    // Build and return Prisma search condition
    return {
      [searchKey]: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    };
  }

  /**
   * Validates if a search field is allowed (without building condition)
   *
   * @param searchKey - The field name to validate
   * @param allowedFields - Array of allowed searchable field names
   * @returns true if searchKey is allowed, false otherwise
   *
   * @example
   * ```typescript
   * const ALLOWED_FIELDS = ['username', 'email'] as const;
   *
   * if (SearchHelper.isValidSearchField('username', ALLOWED_FIELDS)) {
   *   // Field is valid
   * }
   * ```
   */
  static isValidSearchField<T extends string>(
    searchKey: string,
    allowedFields: readonly T[]
  ): searchKey is T {
    return allowedFields.includes(searchKey as T);
  }

  /**
   * Gets a user-friendly error message for invalid search fields
   *
   * @param searchKey - The invalid field name
   * @param allowedFields - Array of allowed searchable field names
   * @returns Error message string
   */
  static getInvalidFieldErrorMessage<T extends string>(
    searchKey: string,
    allowedFields: readonly T[]
  ): string {
    return `Invalid search field: "${searchKey}". Allowed fields: ${allowedFields.join(', ')}`;
  }
}
