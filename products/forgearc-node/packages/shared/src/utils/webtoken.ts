import jwt, { SignOptions } from 'jsonwebtoken';
import { getJwtSecrets, initializeJwtSecrets as initSecrets } from './jwt-secrets';

export interface JWTPayload {
  userId: number;
  username: string;
  email?: string;
  role?: string;
  tenantId?: number;
  permissions?: string[];
  modulesEnabled?: string[];
  [key: string]: unknown;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * Initialize JWT secrets cache.
 * Call this during Lambda cold start to pre-warm the cache.
 * This ensures secrets are loaded before processing requests.
 */
export const initializeJwtSecrets = initSecrets;

/**
 * Get access token expiry from environment variable.
 * Defaults to 45m if not set.
 */
const getAccessTokenExpiry = (): string => {
  return process.env.JWT_EXPIRES_IN || '45m';
};

/**
 * Get refresh token expiry from environment variable.
 * Defaults to 7d if not set.
 */
const getRefreshTokenExpiry = (): string => {
  return process.env.JWT_REFRESH_EXPIRES_IN || '7d';
};

/**
 * Parse expiry string to seconds.
 * Supports formats: "15m", "1h", "7d", or raw seconds "900"
 */
const parseExpiryToSeconds = (expiry: string): number => {
  const numValue = parseInt(expiry, 10);
  if (!isNaN(numValue) && expiry === numValue.toString()) {
    return numValue;
  }

  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 900; // Default to 15 minutes
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 900;
  }
};

/**
 * Generate an access token for the given payload.
 * Fetches JWT secret from Secrets Manager (with caching).
 */
export const generateAccessToken = async (payload: JWTPayload): Promise<string> => {
  const secrets = await getJwtSecrets();
  const expiresIn = getAccessTokenExpiry();

  const options: SignOptions = {
    expiresIn: expiresIn as any,
    issuer: 'forgearc-api',
    audience: 'forgearc-client',
  };
  const token = jwt.sign(payload, secrets.JWT_SECRET, options);

  return token;
};

/**
 * Verify and decode an access token.
 * Fetches JWT secret from Secrets Manager (with caching).
 */
export const verifyAccessToken = async (token: string): Promise<JWTPayload> => {
  const secrets = await getJwtSecrets();

  try {
    const decoded = jwt.verify(token, secrets.JWT_SECRET, {
      issuer: 'forgearc-api',
      audience: 'forgearc-client',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
};

/**
 * Generate a refresh token for the given payload.
 * Fetches JWT refresh secret from Secrets Manager (with caching).
 */
export const generateRefreshToken = async (payload: JWTPayload): Promise<string> => {
  const secrets = await getJwtSecrets();
  const expiresIn = getRefreshTokenExpiry();

  const options: SignOptions = {
    expiresIn: expiresIn as any,
    issuer: 'forgearc-api',
    audience: 'forgearc-client',
  };

  const token = jwt.sign(payload as object, secrets.JWT_REFRESH_SECRET, options);

  return token;
};

/**
 * Verify and decode a refresh token.
 * Fetches JWT refresh secret from Secrets Manager (with caching).
 */
export const verifyRefreshToken = async (token: string): Promise<JWTPayload> => {
  const secrets = await getJwtSecrets();

  try {
    const decoded = jwt.verify(token, secrets.JWT_REFRESH_SECRET, {
      issuer: 'forgearc-api',
      audience: 'forgearc-client',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
};

/**
 * Generate both access and refresh tokens for the given payload.
 * Fetches JWT secrets from Secrets Manager (with caching).
 */
export const generateTokens = async (payload: JWTPayload): Promise<TokenResult> => {
  const accessToken = await generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(payload);

  const accessExpiresIn = parseExpiryToSeconds(getAccessTokenExpiry());
  const refreshExpiresIn = parseExpiryToSeconds(getRefreshTokenExpiry());

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiresIn,
    refreshExpiresIn: refreshExpiresIn,
  };
};
