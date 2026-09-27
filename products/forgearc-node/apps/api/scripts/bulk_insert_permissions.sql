-- Bulk Insert Permissions
-- This script inserts all permissions from PERMISSION_LIST.MD into the permissions table
-- Run this after ensuring the permissions table exists and has the correct schema

INSERT INTO permissions (
  permission_code,
  permission_name,
  description,
  created_by,
  updated_by,
  is_active,
  created_at,
  updated_at
) VALUES
  -- Product Management Permissions
  ('product_create', 'Product Management Create', 'Permission to create products, OEM, Category, Client', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('product_read', 'Product Management Read', 'Permission to Read products, OEM, Category, Client', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('product_update', 'Product Management Update', 'Permission to Update products, OEM, Category, Client', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('product_delete', 'Product Management Delete', 'Permission to Delete products, OEM, Category, Client', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Users Management Permissions
  ('users_create', 'Users management Create', 'Permission to Create users, roles and permissions', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users_read', 'Users management Read', 'Permission to Read users, roles and permissions', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users_update', 'Users management Update', 'Permission to Update users, roles and permissions', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users_delete', 'Users management Delete', 'Permission to Delete users, roles and permissions', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users_view', 'Users management View', 'Permission to View users, roles and permissions', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- PO Management Permissions
  ('po_create', 'PO management Create', 'Permission to Create POs', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('po_read', 'PO management Read', 'Permission to Read POs', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('po_update', 'PO management Update', 'Permission to Update POs', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('po_delete', 'PO management Delete', 'Permission to Delete POs', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Dispatch Management Permissions (Dispatch Details accordion only)
  ('dispatch_create', 'Dispatch management Create', 'Permission to Create Dispatch details', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dispatch_read', 'Dispatch management Read', 'Permission to Read Dispatch details', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dispatch_update', 'Dispatch management Update', 'Permission to Update Dispatch details', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dispatch_delete', 'Dispatch management Delete', 'Permission to Delete Dispatch details', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Dispatch Document Management Permissions
  ('dispatch_document_create', 'Dispatch Document Create', 'Permission to Create Dispatch Documents', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dispatch_document_read', 'Dispatch Document Read', 'Permission to Read Dispatch Documents', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dispatch_document_update', 'Dispatch Document Update', 'Permission to Update Dispatch Documents', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dispatch_document_delete', 'Dispatch Document Delete', 'Permission to Delete Dispatch Documents', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Delivery Management Permissions
  ('delivery_create', 'Delivery management Create', 'Permission to Create Delivery Confirmations', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('delivery_read', 'Delivery management Read', 'Permission to Read Delivery Confirmations', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('delivery_update', 'Delivery management Update', 'Permission to Update Delivery Confirmations', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('delivery_delete', 'Delivery management Delete', 'Permission to Delete Delivery Confirmations', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Pre-Commissioning Management Permissions
  ('pre_commissioning_create', 'Pre-Commissioning Create', 'Permission to Create Pre-Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pre_commissioning_read', 'Pre-Commissioning Read', 'Permission to Read Pre-Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pre_commissioning_update', 'Pre-Commissioning Update', 'Permission to Update Pre-Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pre_commissioning_delete', 'Pre-Commissioning Delete', 'Permission to Delete Pre-Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Commissioning Management Permissions (Final Commissioning accordion only)
  ('commissioning_create', 'Commissioning management Create', 'Permission to Create Final Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('commissioning_read', 'Commissioning management Read', 'Permission to Read Final Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('commissioning_update', 'Commissioning management Update', 'Permission to Update Final Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('commissioning_delete', 'Commissioning management Delete', 'Permission to Delete Final Commissioning records', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Warranty Management Permissions
  ('warranty_create', 'Warranty management Create', 'Permission to Create Warranty Certificates', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('warranty_read', 'Warranty management Read', 'Permission to Read Warranty Certificates', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('warranty_update', 'Warranty management Update', 'Permission to Update Warranty Certificates', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('warranty_delete', 'Warranty management Delete', 'Permission to Delete Warranty Certificates', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  -- Accounting Management Permissions (Accounting accordion)
  ('accounting_create', 'Accounting management Create', 'Permission to Create Accounting entries', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('accounting_read', 'Accounting management Read', 'Permission to Read Accounting entries', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('accounting_update', 'Accounting management Update', 'Permission to Update Accounting entries', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('accounting_delete', 'Accounting management Delete', 'Permission to Delete Accounting entries', 1, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (permission_code) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description,
  updated_by = EXCLUDED.updated_by,
  updated_at = CURRENT_TIMESTAMP;

-- Verify the insert
SELECT 
  permission_id,
  permission_code,
  permission_name,
  description,
  is_active
FROM permissions
ORDER BY permission_id;

