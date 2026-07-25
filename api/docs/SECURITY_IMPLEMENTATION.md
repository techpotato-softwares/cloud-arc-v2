# Security Implementation Guide

## JWT Authentication with HttpOnly Cookies

> **For:** Junior Developers  
> **Last Updated:** December 2024  
> **Status:** Implementation Guide

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Security Concepts & Theory](#2-security-concepts--theory)
3. [Architecture Overview](#3-architecture-overview)
4. [Authentication Flows](#4-authentication-flows)
5. [Implementation Guide](#5-implementation-guide)
6. [Frontend Protection](#6-frontend-protection)
7. [Security Best Practices](#7-security-best-practices)
8. [Troubleshooting](#8-troubleshooting)
9. [Security Checklist](#9-security-checklist)

---

## 1. Introduction

### 1.1 What We're Building

We are implementing a **production-grade authentication system** that:

- Authenticates users with username/password
- Issues **JWT tokens** stored in **HttpOnly cookies**
- Protects API endpoints using an **`@Authenticated` decorator**
- Supports **token refresh** for seamless user experience
- Enables **secure logout** by blacklisting tokens

### 1.2 Why This Approach?

| Approach | Security Level | Why We Chose/Rejected |
|----------|---------------|----------------------|
| **JWT in HttpOnly Cookie** ✅ | High | Tokens cannot be accessed by JavaScript (prevents XSS attacks) |
| JWT in localStorage | Low | Vulnerable to XSS - any script can steal the token |
| JWT in sessionStorage | Low | Same XSS vulnerability as localStorage |
| Session-based auth | Medium | Requires server-side session storage, harder to scale |
| AWS Cognito | High | More complex, vendor lock-in, but great for enterprise |

### 1.3 Prerequisites

Before implementing, ensure you understand:

- **TypeScript decorators** (we use them extensively)
- **How cookies work** (browser automatically sends them)
- **HTTP headers** (CORS, Set-Cookie, Authorization)
- **Async/await** in Node.js

---

## 2. Security Concepts & Theory

### 2.1 What is JWT (JSON Web Token)?

JWT is a compact, URL-safe token format for securely transmitting information between parties.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**A JWT has 3 parts separated by dots (.):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              JWT Structure                               │
├─────────────────┬─────────────────────────┬─────────────────────────────┤
│     HEADER      │        PAYLOAD          │         SIGNATURE           │
│   (Algorithm)   │    (User Data)          │    (Verification)           │
├─────────────────┼─────────────────────────┼─────────────────────────────┤
│ {               │ {                       │ HMACSHA256(                 │
│   "alg": "HS256"│   "userId": "123",      │   base64(header) + "." +    │
│   "typ": "JWT"  │   "name": "John",       │   base64(payload),          │
│ }               │   "exp": 1699999999     │   secret                    │
│                 │ }                       │ )                           │
└─────────────────┴─────────────────────────┴─────────────────────────────┘
        │                   │                          │
        ▼                   ▼                          ▼
   Base64 Encoded     Base64 Encoded            Base64 Encoded
```

**Key Points:**
- **Header**: Specifies the algorithm (HS256, RS256, etc.)
- **Payload**: Contains claims (userId, expiry, roles, etc.) - NOT encrypted, just encoded!
- **Signature**: Proves the token wasn't tampered with

> ⚠️ **Important**: JWT payload is NOT encrypted! Anyone can decode it. Never put sensitive data (passwords, credit cards) in the payload.

### 2.2 Access Tokens vs Refresh Tokens

We use a **dual-token strategy** for better security:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Dual Token Strategy                                 │
├────────────────────────────────┬───────────────────────────────────────┤
│         ACCESS TOKEN           │          REFRESH TOKEN                │
├────────────────────────────────┼───────────────────────────────────────┤
│ • Short-lived (15-30 minutes)  │ • Long-lived (7 days)                 │
│ • Used for API requests        │ • Used ONLY to get new access tokens  │
│ • Sent with every request      │ • Stored more securely                │
│ • If stolen, limited damage    │ • If stolen, can be revoked           │
│ • Contains user claims         │ • Contains minimal data (userId only) │
└────────────────────────────────┴───────────────────────────────────────┘
```

**Why two tokens?**

1. **Short access token** = Less time for attackers if stolen
2. **Long refresh token** = Users don't have to log in constantly
3. **Separation** = If access token leaks, refresh token is safe

### 2.3 What are HttpOnly Cookies?

Cookies are small pieces of data stored in the browser and automatically sent with every request to the same domain.

**HttpOnly flag** prevents JavaScript from accessing the cookie:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Cookie Security Flags                                 │
├─────────────────┬───────────────────────────────────────────────────────┤
│    HttpOnly     │ JavaScript cannot read this cookie (prevents XSS)     │
├─────────────────┼───────────────────────────────────────────────────────┤
│    Secure       │ Cookie only sent over HTTPS (prevents MITM)           │
├─────────────────┼───────────────────────────────────────────────────────┤
│  SameSite=Strict│ Cookie not sent with cross-site requests (CSRF)       │
├─────────────────┼───────────────────────────────────────────────────────┤
│    Domain       │ Which domain(s) can receive this cookie               │
├─────────────────┼───────────────────────────────────────────────────────┤
│    Path         │ Which paths can receive this cookie                   │
├─────────────────┼───────────────────────────────────────────────────────┤
│    Max-Age      │ How long until the cookie expires                     │
└─────────────────┴───────────────────────────────────────────────────────┘
```

**Example Set-Cookie Header:**
```
Set-Cookie: accessToken=eyJhbG...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800
```

### 2.4 Common Attack Vectors & Mitigations

| Attack | Description | Our Mitigation |
|--------|-------------|----------------|
| **XSS** (Cross-Site Scripting) | Attacker injects script that steals tokens | HttpOnly cookies - JS can't access |
| **CSRF** (Cross-Site Request Forgery) | Attacker tricks user into making requests | SameSite=Strict cookie flag |
| **Token Theft** | Stolen token used to impersonate user | Short expiry + refresh tokens |
| **Brute Force** | Attacker guesses passwords | Rate limiting (future enhancement) |
| **Man-in-the-Middle** | Attacker intercepts network traffic | HTTPS + Secure cookie flag |

### 2.5 Token Blacklisting (For Logout)

JWTs are **stateless** - the server doesn't store them. So how do we "invalidate" a token on logout?

**Solution: Token Blacklist**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Token Blacklist Flow                                 │
│                                                                          │
│   User clicks Logout                                                     │
│          │                                                               │
│          ▼                                                               │
│   ┌─────────────────┐                                                    │
│   │  Add token to   │──────▶  Database Table: TokenBlacklist            │
│   │  blacklist      │         ┌────────────────────────────────┐        │
│   └─────────────────┘         │ id | token | userId | expiresAt│        │
│          │                    │ 1  | eyJ.. | user1  | 2024-12-20│        │
│          ▼                    └────────────────────────────────┘        │
│   ┌─────────────────┐                                                    │
│   │  Clear cookies  │                                                    │
│   │  from browser   │                                                    │
│   └─────────────────┘                                                    │
│                                                                          │
│   On every protected request:                                            │
│          │                                                               │
│          ▼                                                               │
│   ┌─────────────────┐     ┌─────────────────┐                           │
│   │ Is token in     │─Yes─▶│ Return 401      │                           │
│   │ blacklist?      │      │ Unauthorized    │                           │
│   └────────┬────────┘      └─────────────────┘                           │
│            │No                                                           │
│            ▼                                                             │
│   ┌─────────────────┐                                                    │
│   │ Process request │                                                    │
│   │ normally        │                                                    │
│   └─────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

> **Note:** We also need a cleanup job to delete expired tokens from the blacklist to prevent table bloat.

---

## 3. Architecture Overview

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION ARCHITECTURE                          │
│                                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────────────────┐   │
│  │              │      │              │      │     AWS Lambda           │   │
│  │  React UI    │◀────▶│ API Gateway  │◀────▶│                          │   │
│  │              │      │              │      │  ┌───────────────────┐   │   │
│  │  - Login     │      │  - HTTPS     │      │  │    Router         │   │   │
│  │  - Protected │      │  - CORS      │      │  │                   │   │   │
│  │    Routes    │      │  - Routes    │      │  │  ┌─────────────┐  │   │   │
│  │              │      │              │      │  │  │@Authenticated│  │   │   │
│  └──────────────┘      └──────────────┘      │  │  │  Decorator  │  │   │   │
│                                              │  │  └──────┬──────┘  │   │   │
│                                              │  │         │         │   │   │
│                                              │  │  ┌──────▼──────┐  │   │   │
│                                              │  │  │ Controllers │  │   │   │
│                                              │  │  └─────────────┘  │   │   │
│                                              │  └───────────────────┘   │   │
│                                              │           │              │   │
│                                              │  ┌────────▼────────┐     │   │
│                                              │  │   JWT Utils     │     │   │
│                                              │  │  - Generate     │     │   │
│                                              │  │  - Verify       │     │   │
│                                              │  │  - Blacklist    │     │   │
│                                              │  └────────┬────────┘     │   │
│                                              └───────────│──────────────┘   │
│                                                          │                  │
│                                              ┌───────────▼──────────────┐   │
│                                              │     PostgreSQL           │   │
│                                              │  - Users table           │   │
│                                              │  - TokenBlacklist table  │   │
│                                              └──────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 File Structure (New & Modified Files)

```
api/
├── layers/
│   └── shared/
│       └── nodejs/
│           ├── package.json                    # ADD: jsonwebtoken dependency
│           ├── prisma/
│           │   └── schema.prisma               # ADD: TokenBlacklist model
│           └── src/
│               ├── decorators/
│               │   ├── auth.decorator.ts       # NEW: @Authenticated, @CurrentUser
│               │   ├── metadata.ts             # MODIFY: Add AUTH metadata key
│               │   └── index.ts                # MODIFY: Export auth decorators
│               ├── middleware/
│               │   └── errorHandler.ts         # MODIFY: Add cookie helpers
│               ├── core/
│               │   └── router.ts               # MODIFY: Check @Authenticated
│               └── utils/
│                   └── jwt.ts                  # NEW: JWT utilities
├── src/
│   ├── controllers/
│   │   └── AuthController.ts                   # MODIFY: Add refresh, logout, me
│   ├── services/
│   │   └── AuthService.ts                      # MODIFY: Add JWT generation
│   └── repositories/
│       └── AuthRepository.ts                   # MODIFY: Add blacklist methods

ui/
├── src/
│   ├── components/
│   │   └── ProtectedRoute.tsx                  # NEW: Route protection wrapper
│   ├── store/
│   │   └── api/
│   │       └── baseApi.ts                      # MODIFY: Add credentials
│   └── pages/
│       └── Login.tsx                           # MODIFY: Remove token handling
```

---

## 4. Authentication Flows

### 4.1 Login Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOGIN FLOW                                      │
│                                                                              │
│  REACT UI                    API GATEWAY              LAMBDA                 │
│     │                            │                      │                    │
│     │  1. User enters           │                      │                    │
│     │     username/password     │                      │                    │
│     │         │                 │                      │                    │
│     │         ▼                 │                      │                    │
│     │  ┌─────────────┐          │                      │                    │
│     │  │ POST /login │          │                      │                    │
│     │  │ {username,  │─────────▶│                      │                    │
│     │  │  password}  │          │                      │                    │
│     │  └─────────────┘          │                      │                    │
│     │                           │  2. Forward request  │                    │
│     │                           │─────────────────────▶│                    │
│     │                           │                      │                    │
│     │                           │                      │  3. AuthController │
│     │                           │                      │     .login()       │
│     │                           │                      │         │          │
│     │                           │                      │         ▼          │
│     │                           │                      │  ┌─────────────┐   │
│     │                           │                      │  │ Find user   │   │
│     │                           │                      │  │ by username │   │
│     │                           │                      │  └──────┬──────┘   │
│     │                           │                      │         │          │
│     │                           │                      │         ▼          │
│     │                           │                      │  ┌─────────────┐   │
│     │                           │                      │  │ bcrypt      │   │
│     │                           │                      │  │ compare     │   │
│     │                           │                      │  │ password    │   │
│     │                           │                      │  └──────┬──────┘   │
│     │                           │                      │         │          │
│     │                           │                      │         ▼          │
│     │                           │                      │  ┌─────────────┐   │
│     │                           │                      │  │ Generate    │   │
│     │                           │                      │  │ Access +    │   │
│     │                           │                      │  │ Refresh     │   │
│     │                           │                      │  │ Tokens      │   │
│     │                           │                      │  └──────┬──────┘   │
│     │                           │                      │         │          │
│     │                           │  4. Response with    │◀────────┘          │
│     │                           │     Set-Cookie       │                    │
│     │                           │     headers          │                    │
│     │                           │                      │                    │
│     │  5. Browser stores       │                      │                    │
│     │     cookies automatically│                      │                    │
│     │◀──────────────────────────│                      │                    │
│     │                           │                      │                    │
│     │  6. Redirect to          │                      │                    │
│     │     /dashboard            │                      │                    │
│     │                           │                      │                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Response Headers Example:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: accessToken=eyJhbGc...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800
Set-Cookie: refreshToken=eyJhbGc...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "123",
    "username": "john.doe",
    "email": "john@example.com"
  }
}
```

### 4.2 Protected Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROTECTED REQUEST FLOW                               │
│                                                                              │
│  REACT UI                    LAMBDA                   DATABASE               │
│     │                          │                         │                   │
│     │  1. GET /api/users       │                         │                   │
│     │  Cookie: accessToken=... │                         │                   │
│     │─────────────────────────▶│                         │                   │
│     │                          │                         │                   │
│     │                          │  2. Router intercepts   │                   │
│     │                          │         │               │                   │
│     │                          │         ▼               │                   │
│     │                          │  ┌──────────────────┐   │                   │
│     │                          │  │ Check if method  │   │                   │
│     │                          │  │ has @Authenticated│   │                   │
│     │                          │  └────────┬─────────┘   │                   │
│     │                          │           │Yes          │                   │
│     │                          │           ▼             │                   │
│     │                          │  ┌──────────────────┐   │                   │
│     │                          │  │ Extract token    │   │                   │
│     │                          │  │ from cookie      │   │                   │
│     │                          │  └────────┬─────────┘   │                   │
│     │                          │           │             │                   │
│     │                          │           ▼             │                   │
│     │                          │  ┌──────────────────┐   │                   │
│     │                          │  │ jwt.verify()     │   │                   │
│     │                          │  │ Check signature  │   │                   │
│     │                          │  │ Check expiry     │   │                   │
│     │                          │  └────────┬─────────┘   │                   │
│     │                          │           │             │                   │
│     │                          │           ▼             │                   │
│     │                          │  ┌──────────────────┐   │                   │
│     │                          │  │ Is token in      │──▶│ SELECT * FROM    │
│     │                          │  │ blacklist?       │   │ TokenBlacklist   │
│     │                          │  └────────┬─────────┘◀──│ WHERE token=...  │
│     │                          │           │             │                   │
│     │                          │           │No           │                   │
│     │                          │           ▼             │                   │
│     │                          │  ┌──────────────────┐   │                   │
│     │                          │  │ Attach user to   │   │                   │
│     │                          │  │ request context  │   │                   │
│     │                          │  └────────┬─────────┘   │                   │
│     │                          │           │             │                   │
│     │                          │           ▼             │                   │
│     │                          │  ┌──────────────────┐   │                   │
│     │                          │  │ Call controller  │   │                   │
│     │                          │  │ method           │   │                   │
│     │                          │  └────────┬─────────┘   │                   │
│     │                          │           │             │                   │
│     │  3. Return protected data│◀──────────┘             │                   │
│     │◀─────────────────────────│                         │                   │
│     │                          │                         │                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**What happens if validation fails at any step:**

| Step | Failure | Response |
|------|---------|----------|
| No cookie present | Missing token | 401 `{"error": "Authentication required"}` |
| jwt.verify() fails | Invalid/expired | 401 `{"error": "Invalid or expired token"}` |
| Token in blacklist | User logged out | 401 `{"error": "Token has been revoked"}` |

### 4.3 Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TOKEN REFRESH FLOW                                 │
│                                                                              │
│  This happens automatically when access token expires                        │
│                                                                              │
│  REACT UI                      LAMBDA                                        │
│     │                            │                                           │
│     │  1. Any API request        │                                           │
│     │─────────────────────────▶  │                                           │
│     │                            │                                           │
│     │  2. 401 Unauthorized       │  (Access token expired)                   │
│     │     (token expired)        │                                           │
│     │◀─────────────────────────  │                                           │
│     │                            │                                           │
│     │  3. RTK Query interceptor  │                                           │
│     │     detects 401            │                                           │
│     │         │                  │                                           │
│     │         ▼                  │                                           │
│     │  ┌─────────────────┐       │                                           │
│     │  │ POST /api/auth/ │       │                                           │
│     │  │ refresh         │──────▶│  4. Verify refresh token                  │
│     │  │ Cookie:         │       │     from cookie                           │
│     │  │ refreshToken=...│       │         │                                 │
│     │  └─────────────────┘       │         ▼                                 │
│     │                            │  ┌──────────────────┐                     │
│     │                            │  │ Generate new     │                     │
│     │                            │  │ access token     │                     │
│     │                            │  └────────┬─────────┘                     │
│     │                            │           │                               │
│     │  5. New access token       │◀──────────┘                               │
│     │     in Set-Cookie          │                                           │
│     │◀───────────────────────────│                                           │
│     │                            │                                           │
│     │  6. Retry original request │                                           │
│     │     with new token         │                                           │
│     │─────────────────────────▶  │                                           │
│     │                            │                                           │
│     │  7. Success!               │                                           │
│     │◀───────────────────────────│                                           │
│     │                            │                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Logout Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOGOUT FLOW                                     │
│                                                                              │
│  REACT UI                      LAMBDA                   DATABASE             │
│     │                            │                         │                 │
│     │  1. User clicks Logout     │                         │                 │
│     │         │                  │                         │                 │
│     │         ▼                  │                         │                 │
│     │  ┌─────────────────┐       │                         │                 │
│     │  │ POST /api/auth/ │       │                         │                 │
│     │  │ logout          │──────▶│                         │                 │
│     │  └─────────────────┘       │                         │                 │
│     │                            │  2. Extract both tokens │                 │
│     │                            │     from cookies        │                 │
│     │                            │         │               │                 │
│     │                            │         ▼               │                 │
│     │                            │  ┌──────────────────┐   │                 │
│     │                            │  │ Add both tokens  │──▶│ INSERT INTO    │
│     │                            │  │ to blacklist     │   │ TokenBlacklist │
│     │                            │  └────────┬─────────┘   │                 │
│     │                            │           │             │                 │
│     │                            │           ▼             │                 │
│     │                            │  ┌──────────────────┐   │                 │
│     │                            │  │ Create response  │   │                 │
│     │                            │  │ with expired     │   │                 │
│     │                            │  │ Set-Cookie       │   │                 │
│     │                            │  └────────┬─────────┘   │                 │
│     │                            │           │             │                 │
│     │  3. Set-Cookie with        │◀──────────┘             │                 │
│     │     Max-Age=0 clears       │                         │                 │
│     │     cookies                │                         │                 │
│     │◀───────────────────────────│                         │                 │
│     │                            │                         │                 │
│     │  4. Clear Redux state      │                         │                 │
│     │     Redirect to /login     │                         │                 │
│     │                            │                         │                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Clear Cookie Header Example:**
```http
Set-Cookie: accessToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0
```

---

## 5. Implementation Guide

### 5.1 Step 1: Add Dependencies

**File:** `api/layers/shared/nodejs/package.json`

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "@types/jsonwebtoken": "^9.0.5"  // Add to devDependencies
  }
}
```

**What is jsonwebtoken?**
- Official JWT library for Node.js
- Handles signing, verifying, and decoding tokens
- Supports various algorithms (HS256, RS256, etc.)

**Run:**
```bash
cd api/layers/shared/nodejs
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

### 5.2 Step 2: Add TokenBlacklist Model

**File:** `api/layers/shared/nodejs/prisma/schema.prisma`

```prisma
/// Stores invalidated tokens to prevent reuse after logout
/// Tokens are automatically cleaned up after expiry via scheduled job
model TokenBlacklist {
  id        String   @id @default(uuid())
  
  /// The JWT token string (hashed for security)
  tokenHash String   @unique
  
  /// User who owned this token (for audit trail)
  userId    String
  
  /// When the original token expires (for cleanup)
  expiresAt DateTime
  
  /// When the token was blacklisted
  createdAt DateTime @default(now())
  
  /// Index for fast lookup during token validation
  @@index([tokenHash])
  
  /// Index for cleanup job to find expired entries
  @@index([expiresAt])
}
```

**Why `tokenHash` instead of `token`?**
- JWTs can be long (1000+ characters)
- Hashing makes lookups faster
- Adds extra security layer

**Run migration:**
```bash
cd api/layers/shared/nodejs
npx prisma migrate dev --name add_token_blacklist
```

### 5.3 Step 3: Create JWT Utility Module

**File:** `api/layers/shared/nodejs/src/utils/jwt.ts`

```typescript
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Payload stored in the access token
 * Keep this minimal - it's sent with every request
 */
export interface AccessTokenPayload {
  userId: string;
  username: string;
  email: string;
  // Add roles here when RBAC is implemented
  // roles: string[];
}

/**
 * Payload stored in the refresh token
 * Even more minimal - only used for generating new access tokens
 */
export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;  // Increment to invalidate all refresh tokens
}

/**
 * Result of token verification
 */
export interface TokenVerificationResult {
  valid: boolean;
  payload?: AccessTokenPayload | RefreshTokenPayload;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get JWT configuration from environment variables
 * 
 * IMPORTANT: In production, JWT_SECRET should be stored in AWS Secrets Manager
 * and retrieved at Lambda cold start
 */
function getJwtConfig() {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  return {
    secret,
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  };
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate an access token for authenticated requests
 * 
 * @param payload - User data to include in the token
 * @returns Signed JWT string
 * 
 * @example
 * const token = generateAccessToken({
 *   userId: user.id,
 *   username: user.username,
 *   email: user.email
 * });
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  const config = getJwtConfig();
  
  const options: SignOptions = {
    expiresIn: config.accessTokenExpiry,
    algorithm: 'HS256',
    issuer: 'arcforge-api',
    audience: 'arcforge-client',
  };
  
  return jwt.sign(payload, config.secret, options);
}

/**
 * Generate a refresh token for obtaining new access tokens
 * 
 * @param userId - The user's ID
 * @param tokenVersion - Version number (increment to invalidate all tokens)
 * @returns Signed JWT string
 */
export function generateRefreshToken(userId: string, tokenVersion: number = 1): string {
  const config = getJwtConfig();
  
  const payload: RefreshTokenPayload = {
    userId,
    tokenVersion,
  };
  
  const options: SignOptions = {
    expiresIn: config.refreshTokenExpiry,
    algorithm: 'HS256',
    issuer: 'arcforge-api',
    audience: 'arcforge-refresh',
  };
  
  return jwt.sign(payload, config.secret, options);
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

/**
 * Verify and decode an access token
 * 
 * @param token - The JWT string to verify
 * @returns Verification result with payload or error
 * 
 * @example
 * const result = verifyAccessToken(token);
 * if (result.valid) {
 *   console.log('User ID:', result.payload.userId);
 * } else {
 *   console.log('Error:', result.error);
 * }
 */
export function verifyAccessToken(token: string): TokenVerificationResult {
  const config = getJwtConfig();
  
  try {
    const decoded = jwt.verify(token, config.secret, {
      algorithms: ['HS256'],
      issuer: 'arcforge-api',
      audience: 'arcforge-client',
    }) as AccessTokenPayload & JwtPayload;
    
    return {
      valid: true,
      payload: {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: getTokenErrorMessage(error),
    };
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): TokenVerificationResult {
  const config = getJwtConfig();
  
  try {
    const decoded = jwt.verify(token, config.secret, {
      algorithms: ['HS256'],
      issuer: 'arcforge-api',
      audience: 'arcforge-refresh',
    }) as RefreshTokenPayload & JwtPayload;
    
    return {
      valid: true,
      payload: {
        userId: decoded.userId,
        tokenVersion: decoded.tokenVersion,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: getTokenErrorMessage(error),
    };
  }
}

/**
 * Convert JWT library errors to user-friendly messages
 */
function getTokenErrorMessage(error: unknown): string {
  if (error instanceof jwt.TokenExpiredError) {
    return 'Token has expired';
  }
  if (error instanceof jwt.JsonWebTokenError) {
    return 'Invalid token';
  }
  if (error instanceof jwt.NotBeforeError) {
    return 'Token not yet valid';
  }
  return 'Token verification failed';
}

// ============================================================================
// COOKIE HANDLING
// ============================================================================

/**
 * Parse cookies from API Gateway event
 * 
 * Cookies come in the format: "name1=value1; name2=value2"
 * 
 * @param event - API Gateway event
 * @returns Object with cookie names as keys
 */
export function parseCookies(event: APIGatewayProxyEvent): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  // Cookies can be in headers.Cookie or headers.cookie (case-insensitive)
  const cookieHeader = event.headers?.Cookie || event.headers?.cookie;
  
  if (!cookieHeader) {
    return cookies;
  }
  
  // Parse "name1=value1; name2=value2" format
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name) {
      cookies[name] = valueParts.join('=');  // Handle values containing '='
    }
  });
  
  return cookies;
}

/**
 * Extract access token from request cookies
 */
export function extractAccessToken(event: APIGatewayProxyEvent): string | null {
  const cookies = parseCookies(event);
  return cookies['accessToken'] || null;
}

/**
 * Extract refresh token from request cookies
 */
export function extractRefreshToken(event: APIGatewayProxyEvent): string | null {
  const cookies = parseCookies(event);
  return cookies['refreshToken'] || null;
}

// ============================================================================
// COOKIE GENERATION (for responses)
// ============================================================================

/**
 * Cookie configuration options
 */
interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  path: string;
  maxAge: number;  // in seconds
  domain?: string;
}

/**
 * Generate Set-Cookie header value
 * 
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Formatted Set-Cookie string
 */
export function generateCookieHeader(
  name: string,
  value: string,
  options: CookieOptions
): string {
  const parts = [`${name}=${value}`];
  
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite}`);
  parts.push(`Path=${options.path}`);
  parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  
  return parts.join('; ');
}

/**
 * Generate Set-Cookie headers for login response
 * 
 * @param accessToken - The access token
 * @param refreshToken - The refresh token
 * @returns Array of Set-Cookie header values
 */
export function generateAuthCookies(
  accessToken: string,
  refreshToken: string
): string[] {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN;
  
  // Access token cookie
  const accessCookie = generateCookieHeader('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,  // Only HTTPS in production
    sameSite: 'Strict',
    path: '/',  // Available to all routes
    maxAge: 15 * 60,  // 15 minutes
    domain,
  });
  
  // Refresh token cookie - more restrictive path
  const refreshCookie = generateCookieHeader('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/api/auth',  // Only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60,  // 7 days
    domain,
  });
  
  return [accessCookie, refreshCookie];
}

/**
 * Generate Set-Cookie headers to clear auth cookies (for logout)
 */
export function generateClearAuthCookies(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN;
  
  // Setting Max-Age=0 tells browser to delete the cookie
  const clearAccess = generateCookieHeader('accessToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
    domain,
  });
  
  const clearRefresh = generateCookieHeader('refreshToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/api/auth',
    maxAge: 0,
    domain,
  });
  
  return [clearAccess, clearRefresh];
}

// ============================================================================
// TOKEN BLACKLIST HELPERS
// ============================================================================

/**
 * Hash a token for storage in the blacklist
 * 
 * We hash tokens before storing them because:
 * 1. Tokens can be very long
 * 2. Hashing is faster for lookups
 * 3. Adds security layer (even if DB is compromised)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get token expiration time from JWT
 * Used when adding to blacklist to know when to clean up
 */
export function getTokenExpiry(token: string): Date | null {
  try {
    // Decode without verification (we just need the exp claim)
    const decoded = jwt.decode(token) as JwtPayload;
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);  // exp is in seconds
    }
    return null;
  } catch {
    return null;
  }
}
```

### 5.4 Step 4: Create Auth Decorators

**File:** `api/layers/shared/nodejs/src/decorators/auth.decorator.ts`

```typescript
import 'reflect-metadata';
import { ParamType, addToMetadataArray, METADATA_KEYS } from './metadata';

// ============================================================================
// METADATA KEY
// ============================================================================

/**
 * Add this to your metadata.ts file:
 * 
 * export const METADATA_KEYS = {
 *   ...existing keys...
 *   AUTHENTICATED: 'custom:authenticated',
 * };
 */

// ============================================================================
// @Authenticated DECORATOR
// ============================================================================

/**
 * Method decorator that marks an endpoint as requiring authentication
 * 
 * When applied, the router will:
 * 1. Check for accessToken cookie
 * 2. Verify the JWT
 * 3. Check token is not blacklisted
 * 4. Attach user to request context
 * 5. Return 401 if any step fails
 * 
 * @example
 * ```typescript
 * @Controller({ path: '/api/users', lambdaName: 'user' })
 * export class UserController {
 * 
 *   @Get('/')
 *   @Authenticated  // <-- This endpoint requires login
 *   async getAll(@CurrentUser() user: AuthenticatedUser) {
 *     // Only authenticated users reach here
 *     return this.userService.getAllUsers();
 *   }
 * 
 *   @Post('/public-endpoint')
 *   async publicMethod() {
 *     // No @Authenticated = anyone can access
 *   }
 * }
 * ```
 */
export function Authenticated(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // Store metadata that this method requires authentication
    Reflect.defineMetadata(
      METADATA_KEYS.AUTHENTICATED,
      true,
      target,
      propertyKey
    );
    
    return descriptor;
  };
}

/**
 * Check if a method has @Authenticated decorator
 * Used by the router before invoking the method
 */
export function isAuthenticated(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(METADATA_KEYS.AUTHENTICATED, target, propertyKey) === true;
}

// ============================================================================
// @CurrentUser DECORATOR
// ============================================================================

/**
 * Parameter decorator that injects the authenticated user
 * 
 * Only works on methods decorated with @Authenticated
 * The user object is extracted from the verified JWT
 * 
 * @example
 * ```typescript
 * @Get('/me')
 * @Authenticated
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   // user contains: { userId, username, email }
 *   return this.userService.getById(user.userId);
 * }
 * 
 * // You can also extract specific properties
 * @Get('/my-orders')
 * @Authenticated
 * async getMyOrders(@CurrentUser('userId') userId: string) {
 *   return this.orderService.getByUserId(userId);
 * }
 * ```
 */
export function CurrentUser(property?: string): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    if (propertyKey === undefined) return;
    
    const paramMetadata = {
      type: ParamType.CURRENT_USER,  // Add this to ParamType enum
      name: property,
      index: parameterIndex,
      propertyKey,
    };
    
    addToMetadataArray(METADATA_KEYS.PARAMS, target, paramMetadata);
  };
}
```

**Update metadata.ts to add new types:**

```typescript
// Add to ParamType enum:
export enum ParamType {
  PARAM = 'param',
  QUERY = 'query',
  BODY = 'body',
  EVENT = 'event',
  CONTEXT = 'context',
  HEADERS = 'headers',
  CURRENT_USER = 'currentUser',  // NEW
}

// Add to METADATA_KEYS:
export const METADATA_KEYS = {
  CONTROLLER: 'custom:controller',
  ROUTES: 'custom:routes',
  PARAMS: 'custom:params',
  CONTROLLER_NAME: 'custom:controller_name',
  LAMBDA_NAME: 'custom:lambda_name',
  AUTHENTICATED: 'custom:authenticated',  // NEW
} as const;
```

### 5.5 Step 5: Update Router for Authentication

**File:** `api/layers/shared/nodejs/src/core/router.ts`

Add authentication check in the `handleRequest` method:

```typescript
import { isAuthenticated } from '../decorators/auth.decorator';
import { 
  extractAccessToken, 
  verifyAccessToken, 
  AccessTokenPayload 
} from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

// Add to RequestContext interface:
export interface RequestContext {
  event: APIGatewayProxyEvent;
  context: LambdaContext;
  pathParams: Record<string, string>;
  currentUser?: AccessTokenPayload;  // NEW: Authenticated user
}

// In handleRequest method, after matching the route:
async handleRequest(
  event: APIGatewayProxyEvent,
  context: LambdaContext
): Promise<APIGatewayProxyResult> {
  // ... existing code to match route ...
  
  const match = this.matchRoute(method, path);
  
  if (!match) {
    // ... existing 404 handling ...
  }
  
  // Get controller instance
  const controllerInstance = this.container.get(match.controller) as object;
  
  // ===== NEW: Authentication Check =====
  const requiresAuth = isAuthenticated(
    controllerInstance,
    match.route.propertyKey
  );
  
  let currentUser: AccessTokenPayload | undefined;
  
  if (requiresAuth) {
    // Extract token from cookie
    const token = extractAccessToken(event);
    
    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    // Verify token
    const result = verifyAccessToken(token);
    
    if (!result.valid) {
      throw new AppError(
        result.error || 'Invalid token',
        401,
        'UNAUTHORIZED'
      );
    }
    
    // TODO: Check token blacklist here
    // const isBlacklisted = await checkBlacklist(token);
    // if (isBlacklisted) {
    //   throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    // }
    
    currentUser = result.payload as AccessTokenPayload;
  }
  // ===== END: Authentication Check =====
  
  // Build request context with user
  const requestContext: RequestContext = {
    event,
    context,
    pathParams: match.pathParams,
    currentUser,  // Will be undefined for non-authenticated routes
  };
  
  // ... rest of existing code ...
}
```

### 5.6 Step 6: Update Parameter Resolver

**File:** `api/layers/shared/nodejs/src/core/parameter-resolver.ts`

Add handling for `@CurrentUser()` decorator:

```typescript
// In resolveParameter method, add case for CURRENT_USER:
case ParamType.CURRENT_USER:
  if (!context.currentUser) {
    throw new AppError(
      '@CurrentUser can only be used with @Authenticated',
      500,
      'INTERNAL_ERROR'
    );
  }
  
  // If a specific property was requested (e.g., @CurrentUser('userId'))
  if (param.name && context.currentUser) {
    return context.currentUser[param.name as keyof AccessTokenPayload];
  }
  
  // Return full user object
  return context.currentUser;
```

### 5.7 Step 7: Update Auth Controller

**File:** `api/src/controllers/AuthController.ts`

```typescript
import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Post,
  Get,
  Body,
  Event,
  createSuccessResponse,
  createErrorResponse,
  Authenticated,
  CurrentUser,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IAuthService } from '../services/AuthService';
import { LoginRequest } from '../schemas';

export interface IAuthController {
  login(data: LoginRequest, event: any): Promise<APIGatewayProxyResult>;
  refresh(event: any): Promise<APIGatewayProxyResult>;
  logout(event: any): Promise<APIGatewayProxyResult>;
  me(user: any): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api', lambdaName: 'auth' })
@injectable()
export class AuthController implements IAuthController {
  constructor(@inject(TYPES.AuthService) private authService: IAuthService) {}

  /**
   * Login endpoint - authenticates user and sets cookies
   * 
   * POST /api/login
   * Body: { username: string, password: string }
   * Response: Sets accessToken and refreshToken cookies
   */
  @Post('/login')
  async login(
    @Body() data: LoginRequest,
    @Event() event: any
  ): Promise<APIGatewayProxyResult> {
    try {
      const result = await this.authService.login(data);
      
      // Response includes Set-Cookie headers
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        multiValueHeaders: {
          'Set-Cookie': result.cookies,  // Array of cookie strings
        },
        body: JSON.stringify({
          success: true,
          message: 'Login successful',
          user: result.user,
        }),
      };
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }

  /**
   * Refresh endpoint - issues new access token using refresh token
   * 
   * POST /api/auth/refresh
   * Cookies: refreshToken (sent automatically)
   * Response: Sets new accessToken cookie
   */
  @Post('/auth/refresh')
  async refresh(@Event() event: any): Promise<APIGatewayProxyResult> {
    try {
      const result = await this.authService.refreshToken(event);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        multiValueHeaders: {
          'Set-Cookie': [result.accessCookie],
        },
        body: JSON.stringify({
          success: true,
          message: 'Token refreshed',
        }),
      };
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }

  /**
   * Logout endpoint - blacklists tokens and clears cookies
   * 
   * POST /api/auth/logout
   * Response: Clears accessToken and refreshToken cookies
   */
  @Post('/auth/logout')
  @Authenticated()
  async logout(@Event() event: any): Promise<APIGatewayProxyResult> {
    try {
      const result = await this.authService.logout(event);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        multiValueHeaders: {
          'Set-Cookie': result.clearCookies,
        },
        body: JSON.stringify({
          success: true,
          message: 'Logged out successfully',
        }),
      };
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }

  /**
   * Get current user - returns authenticated user's profile
   * 
   * GET /api/auth/me
   * Requires: Authentication (accessToken cookie)
   */
  @Get('/auth/me')
  @Authenticated()
  async me(@CurrentUser() user: any): Promise<APIGatewayProxyResult> {
    try {
      // user is automatically injected from verified JWT
      const userDetails = await this.authService.getUserProfile(user.userId);
      return createSuccessResponse(userDetails);
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }
}
```

### 5.8 Step 8: Update Auth Service

**File:** `api/src/services/AuthService.ts`

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IAuthRepository } from '../repositories/AuthRepository';
import { LoginRequest } from '../schemas';
import { ValidationError, AppError } from '@arcforge/shared';
import {
  generateAccessToken,
  generateRefreshToken,
  generateAuthCookies,
  generateClearAuthCookies,
  extractRefreshToken,
  verifyRefreshToken,
  extractAccessToken,
  hashToken,
  getTokenExpiry,
} from '@arcforge/shared';

export interface LoginResult {
  user: {
    id: string;
    username: string;
    email: string;
  };
  cookies: string[];
}

export interface RefreshResult {
  accessCookie: string;
}

export interface LogoutResult {
  clearCookies: string[];
}

export interface IAuthService {
  login(data: LoginRequest): Promise<LoginResult>;
  refreshToken(event: any): Promise<RefreshResult>;
  logout(event: any): Promise<LogoutResult>;
  getUserProfile(userId: string): Promise<any>;
}

@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject(TYPES.AuthRepository) private authRepository: IAuthRepository
  ) {}

  /**
   * Authenticate user and generate tokens
   */
  async login(data: LoginRequest): Promise<LoginResult> {
    // Validate input
    if (!data.username || !data.password) {
      throw new ValidationError('Username and password are required');
    }

    // Find user
    const user = await this.authRepository.findByUsernameOrEmail(data.username);
    if (!user) {
      throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');
    }

    // Verify password
    const isPasswordValid = await this.authRepository.validatePassword(
      user,
      data.password
    );
    if (!isPasswordValid) {
      throw new AppError('Invalid username or password', 401, 'UNAUTHORIZED');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = generateRefreshToken(user.id, user.tokenVersion || 1);

    // Generate cookie headers
    const cookies = generateAuthCookies(accessToken, refreshToken);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      cookies,
    };
  }

  /**
   * Issue new access token using refresh token
   */
  async refreshToken(event: any): Promise<RefreshResult> {
    // Extract refresh token from cookie
    const refreshToken = extractRefreshToken(event);
    
    if (!refreshToken) {
      throw new AppError('Refresh token required', 401, 'UNAUTHORIZED');
    }

    // Verify refresh token
    const result = verifyRefreshToken(refreshToken);
    
    if (!result.valid || !result.payload) {
      throw new AppError(
        result.error || 'Invalid refresh token',
        401,
        'UNAUTHORIZED'
      );
    }

    const payload = result.payload as { userId: string; tokenVersion: number };

    // Get user to verify they still exist and check token version
    const user = await this.authRepository.findById(payload.userId);
    
    if (!user) {
      throw new AppError('User not found', 401, 'UNAUTHORIZED');
    }

    // Check token version (if user logged out everywhere, version is incremented)
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    // Generate cookie header
    const isProduction = process.env.NODE_ENV === 'production';
    const accessCookie = `accessToken=${newAccessToken}; HttpOnly; ${
      isProduction ? 'Secure; ' : ''
    }SameSite=Strict; Path=/; Max-Age=900`;

    return { accessCookie };
  }

  /**
   * Logout user - blacklist tokens and clear cookies
   */
  async logout(event: any): Promise<LogoutResult> {
    // Extract tokens
    const accessToken = extractAccessToken(event);
    const refreshToken = extractRefreshToken(event);

    // Add tokens to blacklist
    if (accessToken) {
      const expiry = getTokenExpiry(accessToken);
      if (expiry) {
        await this.authRepository.blacklistToken(
          hashToken(accessToken),
          expiry
        );
      }
    }

    if (refreshToken) {
      const expiry = getTokenExpiry(refreshToken);
      if (expiry) {
        await this.authRepository.blacklistToken(
          hashToken(refreshToken),
          expiry
        );
      }
    }

    // Return clear cookie headers
    return {
      clearCookies: generateClearAuthCookies(),
    };
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<any> {
    const user = await this.authRepository.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Return user without sensitive fields
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
```

### 5.9 Step 9: Protect Other Controllers

Add `@Authenticated()` to controllers that require login:

**Example:** `api/src/controllers/UserController.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  createSuccessResponse,
  Authenticated,      // Import
  CurrentUser,        // Import
} from '@arcforge/shared';

@Controller({ path: '/api/user', lambdaName: 'user' })
@injectable()
export class UserController implements IUserController {
  
  @Post('/')
  @Authenticated()  // <-- Add this
  async create(@Body() data: CreateUserRequest): Promise<APIGatewayProxyResult> {
    // Only authenticated users can create users
    const user = await this.userService.createUser(data);
    return createSuccessResponse(user, 201);
  }

  @Get('/')
  @Authenticated()  // <-- Add this
  async getAll(): Promise<APIGatewayProxyResult> {
    const users = await this.userService.getAllUsers();
    return createSuccessResponse(users);
  }

  @Get('/{id}')
  @Authenticated()  // <-- Add this
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const user = await this.userService.getUserById(id);
    return createSuccessResponse(user);
  }

  // ... add to all methods that need protection
}
```

---

## 6. Frontend Protection

### 6.1 Update Base API for Cookies

**File:** `ui/src/store/api/baseApi.ts`

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export const baseApi = createApi({
  reducerPath: 'api',
  
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    
    // IMPORTANT: This tells fetch to include cookies with requests
    credentials: 'include',
    
    prepareHeaders: (headers) => {
      // Remove manual token handling - cookies are automatic
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  
  tagTypes: ['PO', 'User', 'Role', 'Permission', 'Category', 'OEM', 'Product'],
  endpoints: () => ({}),
});
```

### 6.2 Add Token Refresh Interceptor

**File:** `ui/src/store/api/baseApi.ts` (enhanced version)

```typescript
import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Base query with credentials
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',  // Include cookies
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

/**
 * Enhanced base query that handles token refresh automatically
 * 
 * Flow:
 * 1. Make original request
 * 2. If 401 response, try to refresh token
 * 3. If refresh succeeds, retry original request
 * 4. If refresh fails, redirect to login
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Make the original request
  let result = await baseQuery(args, api, extraOptions);

  // If we get 401, try to refresh
  if (result.error && result.error.status === 401) {
    console.log('Access token expired, attempting refresh...');
    
    // Try to refresh the token
    const refreshResult = await baseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      console.log('Token refreshed successfully');
      
      // Retry the original request with new token
      result = await baseQuery(args, api, extraOptions);
    } else {
      console.log('Refresh failed, redirecting to login');
      
      // Refresh failed - clear state and redirect
      // Dispatch logout action to clear Redux state
      api.dispatch({ type: 'auth/logout' });
      
      // Redirect to login page
      window.location.href = '/';
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,  // Use enhanced query
  tagTypes: ['PO', 'User', 'Role', 'Permission', 'Category', 'OEM', 'Product'],
  endpoints: () => ({}),
});
```

### 6.3 Route Protection - Approach A: ProtectedRoute Component

**File:** `ui/src/components/ProtectedRoute.tsx`

```tsx
import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../store/authSlice';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wrapper component that protects routes from unauthenticated access
 * 
 * How it works:
 * 1. Checks if user is logged in (from Redux state)
 * 2. If not logged in, redirects to login page
 * 3. Saves the attempted URL so user can be redirected back after login
 * 
 * @example
 * // In App.tsx:
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 * } />
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const location = useLocation();

  if (!isLoggedIn) {
    // Redirect to login, saving the attempted URL
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

**Usage in App.tsx:**

```tsx
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <LayoutPage />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
        </Route>

        {/* ... other routes wrapped similarly */}
      </Routes>
    </BrowserRouter>
  );
};
```

### 6.4 Route Protection - Approach B: LayoutPage Integration

**File:** `ui/src/pages/LayoutPage.tsx`

```tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../store/authSlice';
import SidebarMenu from '../Components/SidebarMenu';

/**
 * Layout component with built-in authentication check
 * 
 * Since all protected routes use LayoutPage, adding the check here
 * automatically protects all routes without changing App.tsx
 */
const LayoutPage: React.FC = () => {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const location = useLocation();

  // If not logged in, redirect to login
  if (!isLoggedIn) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Render the layout with nested route content
  return (
    <div className="layout">
      <SidebarMenu />
      <main className="content">
        <Outlet />  {/* Renders nested route */}
      </main>
    </div>
  );
};

export default LayoutPage;
```

**This approach requires no changes to App.tsx** - the protection is built into the layout.

### 6.5 Comparison of Approaches

| Aspect | Approach A (ProtectedRoute) | Approach B (LayoutPage) |
|--------|---------------------------|------------------------|
| **Code changes** | Wrap each route in App.tsx | One change in LayoutPage |
| **Flexibility** | Can protect any route individually | Protects all routes using LayoutPage |
| **Explicitness** | Very clear which routes are protected | Implicit - must know LayoutPage checks auth |
| **Reusability** | Can be used with different layouts | Tied to LayoutPage |
| **Best for** | Apps with mixed public/private layouts | Apps where layout = authentication |

**Recommendation:** For your current setup, **Approach B** is simpler since all protected routes already use `LayoutPage`.

### 6.6 Update Login Page

**File:** `ui/src/pages/Login.tsx`

```tsx
import React from "react";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useLoginMutation } from "../store/api/authApi";
import { addAuth, setIsLoggedIn } from "store/authSlice";
import { useDispatch } from "react-redux";

const { Title } = Typography;

interface LoginData {
  username: string;
  password: string;
}

interface LocationState {
  from?: { pathname: string };
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [login, { isLoading }] = useLoginMutation();

  // Get the page user was trying to access before login
  const from = (location.state as LocationState)?.from?.pathname || "/dashboard";

  const onFinish = async (values: LoginData) => {
    try {
      // Call login API - cookies are set automatically by the server
      const response = await login({
        username: values.username,
        password: values.password,
      }).unwrap();

      // Update Redux state
      dispatch(addAuth({ 
        username: response.user.username,
        userId: response.user.id,
        email: response.user.email,
      }));
      dispatch(setIsLoggedIn(true));

      message.success("Login Successful!");
      
      // Redirect to the page they were trying to access
      navigate(from, { replace: true });
    } catch (error: any) {
      const errorMessage =
        error?.data?.error?.message ||
        error?.data?.message ||
        error?.message ||
        "Invalid credentials. Please try again.";
      message.error(errorMessage);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f2f5",
      }}
    >
      <Card style={{ width: 350 }}>
        <Title level={3}>Login</Title>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Enter Username" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Enter Password" }]}
          >
            <Input.Password />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={isLoading}>
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
```

### 6.7 Add Logout Functionality

**File:** `ui/src/store/api/authApi.ts`

```typescript
import { baseApi } from "./baseApi";
import { LoginRequest, LoginResponse, UserProfile } from "../../types/orianaTypes";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/login",
        method: "POST",
        body: credentials,
      }),
    }),
    
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
    
    getMe: builder.query<UserProfile, void>({
      query: () => "/auth/me",
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
```

**Logout button component:**

```tsx
import { useLogoutMutation } from '../store/api/authApi';
import { logout as logoutAction } from '../store/authSlice';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const LogoutButton: React.FC = () => {
  const [logout, { isLoading }] = useLogoutMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch (error) {
      // Even if API fails, clear local state
      console.error('Logout API failed:', error);
    }
    
    // Clear Redux state
    dispatch(logoutAction());
    
    // Redirect to login
    navigate('/');
  };

  return (
    <Button onClick={handleLogout} loading={isLoading}>
      Logout
    </Button>
  );
};
```

---

## 7. Security Best Practices

### 7.1 Password Handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PASSWORD SECURITY CHECKLIST                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✅ ALWAYS hash passwords with bcrypt (cost factor ≥ 10)                    │
│  ✅ NEVER store plain text passwords                                         │
│  ✅ NEVER log passwords (even in error messages)                             │
│  ✅ NEVER return password field in API responses                             │
│  ✅ Use HTTPS to encrypt passwords in transit                                │
│  ✅ Compare passwords using timing-safe comparison (bcrypt.compare)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Current Implementation (correct):**
```typescript
// In AuthRepository.ts
import bcrypt from 'bcryptjs';

async validatePassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);  // Timing-safe
}
```

### 7.2 JWT Best Practices

| Practice | Why | Implementation |
|----------|-----|----------------|
| **Short access token expiry** | Limits damage if stolen | 15-30 minutes |
| **Long refresh token expiry** | User convenience | 7 days |
| **Store refresh token securely** | Prevent theft | HttpOnly cookie with restricted path |
| **Include minimal data in JWT** | Reduce payload size | userId, username, email only |
| **Verify audience and issuer** | Prevent token misuse | Set in jwt.sign() and jwt.verify() |
| **Use strong secret** | Prevent forgery | ≥256 bits, stored in Secrets Manager |

### 7.3 Cookie Security

```typescript
// SECURE cookie configuration
const cookieOptions = {
  httpOnly: true,      // JavaScript cannot access (prevents XSS)
  secure: true,        // Only sent over HTTPS (prevents MITM)
  sameSite: 'Strict',  // Not sent with cross-site requests (prevents CSRF)
  path: '/',           // Available to all paths
  maxAge: 900,         // 15 minutes for access token
};
```

### 7.4 CORS Configuration for Cookies

When using credentials (cookies), CORS must be configured specifically:

```typescript
// In errorHandler.ts or API Gateway
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  
  // IMPORTANT: Cannot use '*' with credentials!
  // Must specify exact origin
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  
  // Required for cookies
  'Access-Control-Allow-Credentials': 'true',
  
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};
```

### 7.5 About "Hiding" Credentials in Network Tab

**Question:** "I can see username and password in the Network tab. Is this a security issue?"

**Answer:** **No, this is normal and expected.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NETWORK TAB VISIBILITY                               │
│                                                                              │
│  What you see:                                                               │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │  Request Payload:                                           │            │
│  │  {                                                          │            │
│  │    "username": "john@example.com",                          │            │
│  │    "password": "mypassword123"   ← YOU see this             │            │
│  │  }                                                          │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  What an attacker sees (over HTTPS):                                         │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │  TLS Encrypted Data:                                        │            │
│  │  a7f8b2c4e9d1f3a6b8c0e2d4f6a8b0c2...                        │            │
│  │  (Completely unreadable)                                    │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  The Network tab shows YOUR OWN request after the browser                    │
│  has decrypted it. This is for debugging YOUR code.                          │
│  Attackers cannot see this.                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**What you SHOULD do:**
- ✅ Use HTTPS in production (API Gateway provides this)
- ✅ Never log request bodies containing passwords
- ❌ Don't try to "encrypt" passwords in JavaScript before sending (adds no security)

### 7.6 Environment Variables

**Configuration by Environment:**

| Variable | Local Dev | QA/Prod | Description |
|----------|-----------|---------|-------------|
| `JWT_SECRET` | `env.local.json` | AWS Secrets Manager | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | `env.local.json` | AWS Secrets Manager | Secret for signing refresh tokens |
| `JWT_EXPIRES_IN` | `env.local.json` | Lambda env vars (CDK) | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `env.local.json` | Lambda env vars (CDK) | Refresh token lifetime |
| `COOKIE_DOMAIN` | - | Lambda env vars | Domain for cookies |
| `ALLOWED_ORIGIN` | - | Lambda env vars | CORS allowed origin |

**JWT Secrets in AWS Secrets Manager (Auto-Generated):**

JWT secrets are **automatically generated by CDK** during deployment. No manual secret creation is required!

```
/arcforge/dev/jwt   → { "JWT_SECRET": "<auto>", "JWT_REFRESH_SECRET": "<auto>" }
/arcforge/qa/jwt    → { "JWT_SECRET": "<auto>", "JWT_REFRESH_SECRET": "<auto>" }
/arcforge/prod/jwt  → { "JWT_SECRET": "<auto>", "JWT_REFRESH_SECRET": "<auto>" }
```

**How CDK manages secrets:**
1. `JwtSecretsConstruct` creates secrets during `cdk deploy`
2. Secrets are cryptographically secure (128 characters)
3. Each environment gets unique secrets
4. Production secrets use `RemovalPolicy.RETAIN` (won't be deleted accidentally)

**How secrets are loaded at runtime:**
1. On Lambda cold start, `getJwtSecrets()` is called
2. For local dev (`IS_LOCAL=true`), reads from environment variables
3. For deployed environments, fetches from Secrets Manager
4. Secrets are cached for 5 minutes to minimize API calls
5. Production enforces that secrets must exist (throws error if missing)

**View deployed secrets (for debugging only):**
```bash
aws secretsmanager get-secret-value --secret-id /arcforge/prod/jwt --query SecretString --output text
```

---

## 8. Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Cookie not being sent" | Missing `credentials: 'include'` | Add to fetchBaseQuery config |
| "CORS error with credentials" | Using `*` for origin | Specify exact origin |
| "Token expired immediately" | Clock skew | Use `clockTolerance` option in jwt.verify |
| "Refresh not working" | Wrong cookie path | Ensure refresh endpoint matches cookie path |
| "401 after successful login" | Cookie domain mismatch | Check COOKIE_DOMAIN matches |

### 8.2 Debugging Cookies

**Check cookies in browser DevTools:**
1. Open DevTools (F12)
2. Go to Application → Cookies
3. Look for `accessToken` and `refreshToken`
4. Verify flags: HttpOnly, Secure, SameSite

**Check cookies in API request:**
1. Go to Network tab
2. Click on any API request
3. Check Request Headers → Cookie

### 8.3 Debugging JWT

**Decode JWT without verifying (for debugging):**
```typescript
import jwt from 'jsonwebtoken';

const decoded = jwt.decode(token);
console.log(decoded);
// { userId: '123', username: 'john', iat: 1699999999, exp: 1700000899 }
```

**Check token expiry:**
```typescript
const decoded = jwt.decode(token) as { exp: number };
const expiresAt = new Date(decoded.exp * 1000);
console.log('Token expires at:', expiresAt);
console.log('Is expired:', Date.now() > decoded.exp * 1000);
```

---

## 9. Security Checklist

### 9.1 Before Deploying to Production

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRE-DEPLOYMENT CHECKLIST                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend Security                                                            │
│  ─────────────────                                                           │
│  ✅ JWT secrets are auto-generated by CDK (JwtSecretsConstruct)              │
│  ✅ JWT secrets stored in Secrets Manager: /arcforge/{env}/jwt                 │
│  ✅ JWT secrets are 128 characters of random data                            │
│  □ All protected endpoints have @Authenticated decorator                     │
│  □ Passwords are hashed with bcrypt (cost factor ≥ 10)                       │
│  □ No sensitive data logged (passwords, tokens)                              │
│  □ CORS origin is set to specific domain (not '*')                           │
│  □ API Gateway enforces HTTPS                                                │
│                                                                              │
│  Cookie Security                                                             │
│  ───────────────                                                             │
│  □ HttpOnly flag is set on all auth cookies                                  │
│  □ Secure flag is set (cookies only sent over HTTPS)                         │
│  □ SameSite=Strict is set (prevents CSRF)                                    │
│  □ Refresh token has restricted path (/api/auth)                             │
│                                                                              │
│  Token Security                                                              │
│  ──────────────                                                              │
│  □ Access token expiry is ≤ 30 minutes                                       │
│  □ Refresh token expiry is reasonable (7-14 days)                            │
│  □ Token blacklist is implemented for logout                                 │
│  □ Token blacklist cleanup job is scheduled                                  │
│                                                                              │
│  Frontend Security                                                           │
│  ─────────────────                                                           │
│  □ credentials: 'include' is set in fetch config                             │
│  □ No tokens stored in localStorage/sessionStorage                           │
│  □ Protected routes have guard (ProtectedRoute or LayoutPage)                │
│  □ 401 errors trigger automatic refresh or logout                            │
│                                                                              │
│  Testing                                                                     │
│  ───────                                                                     │
│  □ Login/logout flow works correctly                                         │
│  □ Token refresh works when access token expires                             │
│  □ Protected endpoints return 401 without valid token                        │
│  □ Logout invalidates tokens (can't use old token)                           │
│  □ Cookies are cleared on logout                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Security Audit Checklist

Run through this periodically:

1. **Check for exposed secrets**
   - Search codebase for hardcoded credentials
   - Verify database secrets are in Secrets Manager (`/arcforge/{env}/db`)
   - JWT secrets are auto-generated by CDK (`/arcforge/{env}/jwt`) - verify they exist
   - Confirm `env.local.json` is in `.gitignore`

2. **Verify authentication coverage**
   - List all API endpoints
   - Verify each has appropriate authentication

3. **Test token flows**
   - Test expired token handling
   - Test logout token invalidation
   - Test refresh token rotation

4. **Review logs**
   - Ensure no sensitive data is logged
   - Check for suspicious patterns

---

## 10. Summary

### What We Implemented

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION SYSTEM SUMMARY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  JWT Tokens                                                                  │
│  ──────────                                                                  │
│  • Access Token:  15-30 min expiry, contains user claims                     │
│  • Refresh Token: 7 day expiry, used to get new access tokens                │
│                                                                              │
│  Storage                                                                     │
│  ───────                                                                     │
│  • HttpOnly cookies (not accessible by JavaScript)                           │
│  • Secure flag (HTTPS only)                                                  │
│  • SameSite=Strict (CSRF protection)                                         │
│                                                                              │
│  Endpoints                                                                   │
│  ─────────                                                                   │
│  • POST /api/login     - Authenticate and set cookies                        │
│  • POST /api/auth/refresh - Get new access token                             │
│  • POST /api/auth/logout  - Blacklist tokens, clear cookies                  │
│  • GET  /api/auth/me      - Get current user profile                         │
│                                                                              │
│  Decorators                                                                  │
│  ──────────                                                                  │
│  • @Authenticated      - Protect endpoints                                   │
│  • @CurrentUser()      - Inject authenticated user                           │
│                                                                              │
│  Frontend                                                                    │
│  ────────                                                                    │
│  • credentials: 'include' for cookie support                                 │
│  • Automatic token refresh on 401                                            │
│  • Route protection (ProtectedRoute or LayoutPage)                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/layers/shared/nodejs/package.json` | Modify | Add jsonwebtoken |
| `api/layers/shared/nodejs/prisma/schema.prisma` | Modify | Add TokenBlacklist |
| `api/layers/shared/nodejs/src/utils/jwt.ts` | Create | JWT utilities |
| `api/layers/shared/nodejs/src/decorators/auth.decorator.ts` | Create | Auth decorators |
| `api/layers/shared/nodejs/src/decorators/metadata.ts` | Modify | Add metadata keys |
| `api/layers/shared/nodejs/src/decorators/index.ts` | Modify | Export decorators |
| `api/layers/shared/nodejs/src/core/router.ts` | Modify | Auth check |
| `api/layers/shared/nodejs/src/core/parameter-resolver.ts` | Modify | CurrentUser param |
| `api/src/controllers/AuthController.ts` | Modify | Add endpoints |
| `api/src/services/AuthService.ts` | Modify | Token logic |
| `api/src/repositories/AuthRepository.ts` | Modify | Blacklist methods |
| `ui/src/store/api/baseApi.ts` | Modify | Credentials + refresh |
| `ui/src/components/ProtectedRoute.tsx` | Create | Route protection |
| `ui/src/pages/Login.tsx` | Modify | Cookie-based auth |

---

**Questions?** Reach out to the senior developers or refer to:
- [JWT.io](https://jwt.io) - JWT debugger and documentation
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [MDN: HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

