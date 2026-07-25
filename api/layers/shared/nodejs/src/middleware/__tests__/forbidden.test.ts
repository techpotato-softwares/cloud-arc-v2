import { ForbiddenError } from '../errorHandler';

describe('ForbiddenError', () => {
  it('uses 403 and FORBIDDEN code', () => {
    const err = new ForbiddenError('nope');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('nope');
  });
});
