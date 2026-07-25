export interface ClientResponse {
  clientId: number;
  clientName: string;
  clientAddress?: string | null;
  clientContact?: string | null;
  clientGST?: string | null;
  isActive: boolean;
  createdById?: number | null;
  updatedById?: number | null;
}

export interface ClientListResponse {
  data: ClientResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
