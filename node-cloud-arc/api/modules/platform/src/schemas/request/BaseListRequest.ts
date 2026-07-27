/**
 * Base interface for all list/pagination requests
 * Contains common fields used across all getAll APIs
 */
export interface BaseListRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  searchKey?: string;
  searchTerm?: string;
}
