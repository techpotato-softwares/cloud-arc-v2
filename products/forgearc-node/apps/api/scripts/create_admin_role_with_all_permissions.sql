-- SQL Script to Create Admin Role and Assign All Permissions
-- This script:
-- 1. Creates a role with name "admin", description, and isActive=true
-- 2. Assigns all permissions from the permissions table to this role
-- 3. Sets created_by and updated_by to NULL (system user)
--
-- Usage:
--   psql $DATABASE_URL -f create_admin_role_with_all_permissions.sql
--   OR
--   Execute this script in your PostgreSQL client

-- Step 1: Create the admin role (if it doesn't exist)
-- Note: Since role_name doesn't have a unique constraint, we check first
DO $$
DECLARE
  admin_role_id INT;
BEGIN
  -- Check if admin role exists, if not create it
  SELECT role_id INTO admin_role_id
  FROM roles
  WHERE role_name = 'admin'
  LIMIT 1;

  IF admin_role_id IS NULL THEN
    INSERT INTO roles (
      role_name,
      description,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      'admin',
      'Admin user will have all access to platform',
      true,
      NULL, -- System user
      NULL, -- System user
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING role_id INTO admin_role_id;
    
    RAISE NOTICE 'Admin role created with role_id: %', admin_role_id;
  ELSE
    RAISE NOTICE 'Admin role already exists with role_id: %', admin_role_id;
  END IF;

  -- Step 2: Assign all permissions to the admin role
  -- Insert all permissions that don't already exist for this role
  INSERT INTO role_permissions (
    role_id,
    permission_id,
    is_active,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  SELECT 
    admin_role_id,
    p.permission_id,
    true,
    NULL, -- System user
    NULL, -- System user
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM permissions p
  WHERE NOT EXISTS (
    SELECT 1 
    FROM role_permissions rp 
    WHERE rp.role_id = admin_role_id 
    AND rp.permission_id = p.permission_id
  )
  ON CONFLICT (role_id, permission_id) DO UPDATE
  SET 
    is_active = true,
    updated_by = NULL,
    updated_at = CURRENT_TIMESTAMP;

  RAISE NOTICE 'All permissions assigned to admin role';
END $$;

-- Verification query: Check the admin role and permission count
SELECT 
  r.role_id,
  r.role_name,
  r.description,
  r.is_active,
  COUNT(rp.permission_id) as permission_count,
  STRING_AGG(p.permission_code, ', ' ORDER BY p.permission_code) as permission_codes
FROM roles r
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id AND rp.is_active = true
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
WHERE r.role_name = 'admin'
GROUP BY r.role_id, r.role_name, r.description, r.is_active;

