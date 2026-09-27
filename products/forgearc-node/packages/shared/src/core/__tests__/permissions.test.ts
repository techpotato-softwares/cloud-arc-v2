/**
 * Unit tests for permission any-of logic (mirrors Router.assertPermissions).
 */
function hasPermission(owned: string[] | undefined, required?: string[]): boolean {
  if (!required || required.length === 0) return true;
  const set = new Set(owned || []);
  return required.some((code) => set.has(code));
}

describe('permission check', () => {
  it('allows when no permissions required', () => {
    expect(hasPermission([], undefined)).toBe(true);
  });

  it('allows when user has one of required', () => {
    expect(hasPermission(['demo:read', 'user:write'], ['demo:write', 'admin'])).toBe(false);
    expect(hasPermission(['demo:write'], ['demo:write', 'admin'])).toBe(true);
    expect(hasPermission(['admin'], ['demo:write', 'admin'])).toBe(true);
  });
});
