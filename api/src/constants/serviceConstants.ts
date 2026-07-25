/**
 * Service Constants
 *
 * Status options for Service lifecycle management (Pre-Commissioning, Commissioning, Warranty Certificate)
 */

/**
 * PPM Confirmation Status Options
 */
export const PPM_CONFIRMATION_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type PpmConfirmationStatus =
  (typeof PPM_CONFIRMATION_STATUS)[keyof typeof PPM_CONFIRMATION_STATUS];

export const PPM_CONFIRMATION_STATUS_OPTIONS = [
  { value: PPM_CONFIRMATION_STATUS.DONE, label: 'Done' },
  { value: PPM_CONFIRMATION_STATUS.PENDING, label: 'Pending' },
  { value: PPM_CONFIRMATION_STATUS.HOLD, label: 'Hold' },
  { value: PPM_CONFIRMATION_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * Pre-Commissioning Status Options
 */
export const PRE_COMMISSIONING_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type PreCommissioningStatus =
  (typeof PRE_COMMISSIONING_STATUS)[keyof typeof PRE_COMMISSIONING_STATUS];

export const PRE_COMMISSIONING_STATUS_OPTIONS = [
  { value: PRE_COMMISSIONING_STATUS.DONE, label: 'Done' },
  { value: PRE_COMMISSIONING_STATUS.PENDING, label: 'Pending' },
  { value: PRE_COMMISSIONING_STATUS.HOLD, label: 'Hold' },
  { value: PRE_COMMISSIONING_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * Commissioning Status Options
 */
export const COMMISSIONING_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type CommissioningStatus = (typeof COMMISSIONING_STATUS)[keyof typeof COMMISSIONING_STATUS];

export const COMMISSIONING_STATUS_OPTIONS = [
  { value: COMMISSIONING_STATUS.DONE, label: 'Done' },
  { value: COMMISSIONING_STATUS.PENDING, label: 'Pending' },
  { value: COMMISSIONING_STATUS.HOLD, label: 'Hold' },
  { value: COMMISSIONING_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * Warranty Status Options
 */
export const WARRANTY_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type WarrantyStatus = (typeof WARRANTY_STATUS)[keyof typeof WARRANTY_STATUS];

export const WARRANTY_STATUS_OPTIONS = [
  { value: WARRANTY_STATUS.DONE, label: 'Done' },
  { value: WARRANTY_STATUS.PENDING, label: 'Pending' },
  { value: WARRANTY_STATUS.HOLD, label: 'Hold' },
  { value: WARRANTY_STATUS.CANCELLED, label: 'Cancelled' },
];
