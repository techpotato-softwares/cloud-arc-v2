/**
 * Dispatch Constants
 *
 * Status options for dispatch workflow management.
 */

/**
 * Dispatch Status Options
 */
export const DISPATCH_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type DispatchStatus = (typeof DISPATCH_STATUS)[keyof typeof DISPATCH_STATUS];

export const DISPATCH_STATUS_OPTIONS = [
  { value: DISPATCH_STATUS.DONE, label: 'Done' },
  { value: DISPATCH_STATUS.PENDING, label: 'Pending' },
  { value: DISPATCH_STATUS.HOLD, label: 'Hold' },
  { value: DISPATCH_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * Delivery Status Options
 */
export const DELIVERY_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const DELIVERY_STATUS_OPTIONS = [
  { value: DELIVERY_STATUS.DONE, label: 'Done' },
  { value: DELIVERY_STATUS.PENDING, label: 'Pending' },
  { value: DELIVERY_STATUS.HOLD, label: 'Hold' },
  { value: DELIVERY_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * No Dues Clearance Options
 */
export const NO_DUES_CLEARANCE = {
  PENDING: 'pending',
  CLEARED: 'cleared',
  NOT_REQUIRED: 'not_required',
} as const;

export type NoDuesClearance = (typeof NO_DUES_CLEARANCE)[keyof typeof NO_DUES_CLEARANCE];

export const NO_DUES_CLEARANCE_OPTIONS = [
  { value: NO_DUES_CLEARANCE.PENDING, label: 'Pending' },
  { value: NO_DUES_CLEARANCE.CLEARED, label: 'Cleared' },
  { value: NO_DUES_CLEARANCE.NOT_REQUIRED, label: 'Not Required' },
];
