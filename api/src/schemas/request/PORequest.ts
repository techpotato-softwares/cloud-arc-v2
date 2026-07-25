export interface POItemRequest {
  categoryId: number;
  oemId: number;
  productId: number;
  quantity: number;
  spareQuantity: number;
  totalQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  gstPercent: number;
  finalPrice: number;
  warranty: string;
}

export interface CreatePORequest {
  clientId: number;
  osgPiNo: string; // Alphanumeric
  osgPiDate: string;
  clientPoNo: string; // Alphanumeric
  clientPoDate: string;
  poStatus: string;
  noOfDispatch: string;
  assignDispatchTo?: number; // Optional - userId from users table
  assignServiceTo?: number; // Optional - userId from users table
  clientAddress: string;
  clientContact: string;
  poItems: POItemRequest[];
  dispatchPlanDate: string;
  siteLocation: string;
  oscSupport: string;
  confirmDateOfDispatch?: string; // Optional - defaults to clientPoDate if not provided
  paymentStatus: string;
  remarks?: string;
  createdById?: number;
  updatedById?: number;
  fiscalYear?: string;
}

export interface UpdatePORequest extends Partial<CreatePORequest> {
  poId: string;
  updatedById?: number;
}

export interface GetPOByIdRequest {
  poId: string;
}

export interface DeletePORequest {
  poId: string;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListPORequest extends BaseListRequest {
  clientId?: number | string;
  poStatus?: string;
  assignedTo?: number | string;
}
