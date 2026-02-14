# Features Documentation

Complete feature documentation for the authentication service, including detailed flows, security measures, and implementation details.

## Table of Contents

- [Authentication Flows](#authentication-flows)
- [Token Management](#token-management)
- [Token Revocation](#token-revocation)
- [Session Management](#session-management)
- [OTP System](#otp-system)
- [Email Verification](#email-verification)
- [Password Reset Flow](#password-reset-flow)
- [Rate Limiting Strategy](#rate-limiting-strategy)
- [Audit Logging](#audit-logging)
- [Security Headers](#security-headers)

## Authentication Flows

### User Registration Flow (Standard User)

**Endpoint:** `POST /api/auth/signup`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "Test123!@#"
}
```

**Flow Diagram:**

```
┌─────────┐                                           ┌──────────┐
│  Client │                                           │  Server  │
└────┬────┘                                           └─────┬────┘
     │                                                      │
     │  POST /api/auth/signup                              │
     │  { email, password }                                │
     ├─────────────────────────────────────────────────────>│
     │                                                      │
     │                                (1) Validate password complexity
     │                                      (8+, upper, lower, digit, special)
     │                                                      │
     │                                (2) Check email uniqueness
     │                                      └─> MongoDB query
     │                                                      │
     │                                (3) Hash password
     │                                      └─> bcrypt(password, 12)
     │                                                      │
     │                                (4) Generate verification token
     │                                      └─> 64 hex chars
     │                                                      │
     │                                (5) Hash token
     │                                      └─> SHA256(token)
     │                                                      │
     │                                (6) Encrypt token
     │                                      └─> AES-256-CBC
     │                                                      │
     │                                (7) Store user
     │                                      └─> MongoDB insert
     │                                                      │
     │                                (8) Send email (fire-and-forget)
     │                                      └─> Brevo API
     │                                                      │
     │                                (9) Log event
     │                                      └─> AuthEvents collection
     │                                                      │
     │  201 Created                                         │
     │  { message: "Verification email sent" }             │
     │<─────────────────────────────────────────────────────┤
     │                                                      │
```

**Steps:**

1. **Validate password complexity** (Use Case layer)
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one digit
   - At least one special character

2. **Check email uniqueness** (Repository layer)
   - Query MongoDB for existing email
   - Return 409 Conflict if exists

3. **Hash password** (Infrastructure layer)
   - Use bcrypt with cost factor 12
   - Timing: ~150-300ms (intentionally slow)

4. **Generate verification token**
   - 64 random hex characters
   - Cryptographically secure (crypto.randomBytes)

5. **Hash token** (SHA256)
   - Store hash in database for lookup
   - Original token sent to user email

6. **Encrypt token** (AES-256-CBC)
   - Additional layer of protection
   - If database is compromised, tokens are still encrypted

7. **Store user** (MongoDB)
   - User document with hashed password
   - Verification token hash + encrypted token
   - `isVerified: false`
   - `tokenVersion: 0`

8. **Send verification email** (Fire-and-forget)
   - Async operation using p-retry
   - Link: `https://www.ankurhalder.com/verify-email?token=${token}`
   - Failure doesn't block signup
   - User can request resend

9. **Log audit event**
   - Event type: "signup"
   - IP address, user agent, request ID
   - Stored in AuthEvents collection

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Account created. Please check your email to verify your account."
  }
}
```

**Security Considerations:**

- Password hashed with bcrypt (cost 12)
- Token encrypted in database
- Enumeration protected (same response for all errors)
- Rate limited (5/hour per IP)

### User Sign-In Flow (Standard User)

**Endpoint:** `POST /api/auth/signin`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "Test123!@#",
  "rememberMe": true
}
```

**Flow Diagram:**

```
┌─────────┐                                           ┌──────────┐
│  Client │                                           │  Server  │
└────┬────┘                                           └─────┬────┘
     │                                                      │
     │  POST /api/auth/signin                              │
     │  { email, password, rememberMe }                    │
     ├─────────────────────────────────────────────────────>│
     │                                                      │
     │                                (1) Find user by email
     │                                      └─> MongoDB query
     │                                                      │
     │                                (2) Check if email is verified
     │                                      └─> isVerified === true
     │                                                      │
     │                                (3) Verify password
     │                                      └─> bcrypt.compare()
     │                                                      │
     │                                (4) Check user role
     │                                      └─> role === "user" or "admin"
     │                                                      │
     │                              If admin:              │
     │                                (5a) Generate OTP    │
     │                                (6a) Encrypt OTP     │
     │                                (7a) Apply rate limit│
     │                                (8a) Send OTP email  │
     │                                (9a) Return pending  │
     │                                                      │
     │                              If user:               │
     │                                (5b) Create session  │
     │                                (6b) Generate tokens │
     │                                (7b) Set cookies     │
     │                                (8b) Return tokens   │
     │                                                      │
     │  200 OK (user) or 202 Accepted (admin)              │
     │  Set-Cookie: accessToken, refreshToken              │
     │<─────────────────────────────────────────────────────┤
     │                                                      │
```

**User Path Steps:**

1. **Find user** by email (case-insensitive)
2. **Check verification** - Email must be verified
3. **Verify password** using bcrypt (timing-safe)
4. **Auto-migrate** from PBKDF2 to bcrypt if needed
5. **Create session**:
   - Generate session ID (UUID v4)
   - Generate JTI (UUID v4)
   - Calculate expiry (7 days or 30 days with rememberMe)
   - Hash refresh token (SHA256)
   - Store in sessions collection
6. **Generate JWT tokens**:
   - **Access token**: 15 minutes expiry, signed with RS256
   - **Refresh token**: 7/30 days expiry, signed with RS256
7. **Set HTTP-only cookies**:
   - `accessToken` cookie
   - `refreshToken` cookie
   - Secure, HttpOnly, SameSite=Lax
   - Domain: `.ankurhalder.com`
8. **Log audit event** (signin)
9. **Return response** with user data

**Response (User):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "role": "user",
      "isVerified": true
    },
    "requiresOtp": false
  }
}
```

**Admin Path Steps:**

1-4. Same as user path 5. **Generate OTP**:

- 8 random digits (00000000 - 99999999)
- Cryptographically secure (crypto.randomInt)

6. **Encrypt OTP**:
   - AES-256-CBC encryption
   - Store encrypted OTP in user document
7. **Apply rate limiting**:
   - Escalating backoff per user
   - 1 min → 5 min → 15 min → 1 hour
8. **Send OTP email** (fire-and-forget)
9. **Return pending response**

**Response (Admin):**

```json
{
  "success": true,
  "data": {
    "requiresOtp": true,
    "message": "OTP sent to your email"
  }
}
```

**Security Considerations:**

- Timing-safe password comparison
- Auto-migration for legacy passwords
- OTP for admin users (2FA)
- Rate limiting (10/15min per IP)
- Audit logging for all attempts

### Admin OTP Verification Flow

**Endpoint:** `POST /api/auth/verify-otp`

**Request:**

```json
{
  "email": "admin@example.com",
  "otp": "12345678",
  "rememberMe": true
}
```

**Flow Diagram:**

```
┌─────────┐                                           ┌──────────┐
│  Client │                                           │  Server  │
└────┬────┘                                           └─────┬────┘
     │                                                      │
     │  POST /api/auth/verify-otp                          │
     │  { email, otp, rememberMe }                         │
     ├─────────────────────────────────────────────────────>│
     │                                                      │
     │                                (1) Find admin user  │
     │                                                      │
     │                                (2) Check OTP exists │
     │                                                      │
     │                                (3) Check OTP not expired
     │                                      └─> expiresAt > now
     │                                                      │
     │                                (4) Check attempts < 5
     │                                                      │
     │                                (5) Decrypt OTP      │
     │                                      └─> AES-256-CBC
     │                                                      │
     │                                (6) Verify OTP (timing-safe)
     │                                      └─> constant time compare
     │                                                      │
     │                                (7) Create session   │
     │                                (8) Generate tokens  │
     │                                (9) Clear OTP        │
     │                                (10) Reset rate limit│
     │                                (11) Set cookies     │
     │                                                      │
     │  200 OK                                              │
     │  Set-Cookie: accessToken, refreshToken              │
     │<─────────────────────────────────────────────────────┤
     │                                                      │
```

**Steps:**

1. Find admin user by email
2. Validate OTP exists in user document
3. Check OTP not expired (15 minutes)
4. Check attempts < 5 (increment on failure)
5. Decrypt OTP using AES-256-CBC
6. Verify OTP using timing-safe comparison
7. Create session (same as user signin)
8. Generate JWT tokens
9. Clear OTP from user document
10. Reset rate limit for this admin
11. Set HTTP-only cookies

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "admin@example.com",
      "role": "admin",
      "isVerified": true
    }
  }
}
```

**Error Scenarios:**

1. **Invalid OTP**: Increment attempts, return error
2. **Expired OTP**: Clear OTP, return error
3. **Max attempts**: Clear OTP, return error
4. **Rate limit**: Return 429 Too Many Requests

## Token Management

### Token Structure

**Access Token Payload:**

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user",
  "tokenVersion": 0,
  "type": "access",
  "jti": "uuid-v4",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Refresh Token Payload:**

```json
{
  "sub": "user-id",
  "sessionId": "session-uuid",
  "type": "refresh",
  "jti": "uuid-v4",
  "iat": 1234567890,
  "exp": 1234999999
}
```

### Token Lifetimes

- **Access Token**: 15 minutes
- **Refresh Token**: 7 days (default) or 30 days (rememberMe)

### Token Refresh Flow (Atomic Rotation)

**Endpoint:** `POST /api/auth/refresh`

**Request:**

```
Cookie: refreshToken=eyJhbGc...
```

**Flow Diagram:**

```
┌─────────┐                                           ┌──────────┐
│  Client │                                           │  Server  │
└────┬────┘                                           └─────┬────┘
     │                                                      │
     │  POST /api/auth/refresh                             │
     │  Cookie: refreshToken                               │
     ├─────────────────────────────────────────────────────>│
     │                                                      │
     │                                (1) Verify JWT signature + expiry
     │                                      └─> jose.jwtVerify()
     │                                                      │
     │                                (2) Hash refresh token
     │                                      └─> SHA256(token)
     │                                                      │
     │                                (3) Atomic find-and-delete session
     │                                      └─> findOneAndDelete()
     │                                      (Replay detection!)
     │                                                      │
     │                                (4) Check revocation (3 levels)
     │                                      - Token level (jti)
     │                                      - Session level (sessionId)
     │                                      - User level (userId + tokenVersion)
     │                                                      │
     │                                (5) Verify user exists
     │                                      └─> Find by ID
     │                                                      │
     │                                (6) Verify tokenVersion matches
     │                                                      │
     │                                (7) Create new session
     │                                      └─> New session ID
     │                                      └─> New JTI
     │                                      └─> Preserve TTL
     │                                                      │
     │                                (8) Generate new tokens
     │                                      └─> New access + refresh
     │                                                      │
     │  200 OK                                              │
     │  Set-Cookie: accessToken, refreshToken              │
     │<─────────────────────────────────────────────────────┤
     │                                                      │
```

**8-Step Verification Chain:**

1. **JWT Signature Verification**
   - Verify RS256 signature using public key
   - Check token not expired
   - Validate token structure

2. **Hash Refresh Token**
   - SHA256 hash for database lookup
   - Prevents storing raw tokens

3. **Atomic Find-and-Delete** (CRITICAL)
   - Use `findOneAndDelete()` for atomicity
   - If session not found → Token already used (replay attack)
   - This is the key to preventing replay attacks

4. **Check Revocation Store** (3 levels)
   - Token-level: Check `revoke:token:${jti}`
   - Session-level: Check `revoke:session:${sessionId}`
   - User-level: Check `revoke:user:${userId}` timestamp

5. **Verify User Exists**
   - User may have been deleted
   - Return 401 if not found

6. **Verify Token Version**
   - Check payload `tokenVersion` matches user's `tokenVersion`
   - Protects against global logout

7. **Create New Session**
   - Generate new session ID (rotation)
   - Generate new JTI
   - Preserve TTL from old session (rememberMe state)
   - Store with new refresh token hash

8. **Generate New Tokens**
   - Issue new access token (15 min)
   - Issue new refresh token (same TTL as old)
   - Old refresh token now invalid

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Token refreshed"
  }
}
```

**Security Features:**

- **Atomic rotation**: Old token deleted before new one created
- **Replay detection**: Reused tokens immediately detected
- **Triple revocation check**: 3 layers of protection
- **Token version**: Global logout protection
- **TTL preservation**: Maintains rememberMe preference

## Token Revocation

Three levels of token revocation for maximum security.

### Level 1: Token-Level Revocation

Revoke a specific JWT token.

**Use Case:** Single token compromised

**Implementation:**

```typescript
// Store in Redis
key: `revoke:token:${jti}`;
value: "1";
ttl: token.exp - Date.now();
```

**Check:**

```typescript
const isRevoked = await redis.get(`revoke:token:${jti}`);
if (isRevoked) throw new TokenError("Token revoked");
```

### Level 2: Session-Level Revocation

Revoke all tokens in a session (access + refresh).

**Use Case:** User logs out from one device

**Endpoint:** `POST /api/auth/logout`

**Implementation:**

```typescript
// Store in Redis
key: `revoke:session:${sessionId}`
value: "1"
ttl: 30 days

// Delete session from MongoDB
await sessionRepository.deleteBySessionId(sessionId)
```

**Check:**

```typescript
const isRevoked = await redis.get(`revoke:session:${sessionId}`);
if (isRevoked) throw new TokenError("Session revoked");
```

### Level 3: User-Level Revocation

Revoke ALL tokens for a user (global logout).

**Use Case:** User logs out from all devices, password reset, security breach

**Endpoint:** `POST /api/auth/logout-all`

**Implementation:**

```typescript
// 1. Increment tokenVersion in user document
await userRepository.incrementTokenVersion(userId)

// 2. Store revocation timestamp in Redis
key: `revoke:user:${userId}`
value: Date.now().toString()
ttl: 30 days

// 3. Delete all sessions from MongoDB
await sessionRepository.deleteAllByUserId(userId)
```

**Check:**

```typescript
// Check if token was issued before revocation
const revokedAt = await redis.get(`revoke:user:${userId}`);
if (revokedAt && token.iat * 1000 < parseInt(revokedAt)) {
  throw new TokenError("User revoked");
}

// Check tokenVersion matches
if (token.tokenVersion !== user.tokenVersion) {
  throw new TokenError("Token version mismatch");
}
```

**Revocation Matrix:**

| Action         | Token | Session | User | Method                                    |
| -------------- | ----- | ------- | ---- | ----------------------------------------- |
| Logout         | ✓     | ✓       | -    | Redis + MongoDB delete                    |
| Logout All     | ✓     | ✓       | ✓    | tokenVersion + Redis + MongoDB delete all |
| Password Reset | ✓     | ✓       | ✓    | tokenVersion + Redis + MongoDB delete all |

## Session Management

### Session Document Structure

```typescript
{
  _id: ObjectId("..."),
  sessionId: "uuid-v4",
  userId: ObjectId("..."),
  refreshTokenHash: "sha256-hash",
  jti: "uuid-v4",
  expiresAt: Date("2026-02-21T..."),
  createdAt: Date("2026-02-14T...")
}
```

### Session Operations

**Create Session:**

```typescript
const session = new Session({
  sessionId: SessionId.generate(),
  userId: user.id,
  refreshTokenHash: hashRefreshToken(token),
  jti: Jti.generate(),
  expiresAt: rememberMe ? add30Days() : add7Days(),
});
await sessionRepository.save(session);
```

**Find and Delete (Atomic):**

```typescript
const session = await sessionRepository.findOneAndDelete({
  refreshTokenHash: hash,
});
if (!session) throw new TokenError("Invalid refresh token");
```

**Delete All User Sessions:**

```typescript
await sessionRepository.deleteAllByUserId(userId);
```

### Cleanup Strategy

**TTL Indexes:**

- MongoDB automatically deletes expired sessions via TTL index on `expiresAt`
- TTL monitor runs every 60 seconds

**Cron Job:**

- Manual cleanup via `/api/cron/cleanup`
- Runs daily at midnight
- Cleans up:
  - Expired sessions
  - Expired verification tokens
  - Expired reset tokens
  - Expired OTPs
  - Old audit events (90+ days)

## OTP System

### OTP Generation

```typescript
// Generate 8-digit OTP
const otp = crypto.randomInt(10000000, 99999999).toString();
// Result: "12345678"
```

### OTP Encryption

```typescript
// Encrypt using AES-256-CBC
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
const encrypted = Buffer.concat([cipher.update(otp, "utf8"), cipher.final()]);
const encryptedOtp = iv.toString("hex") + ":" + encrypted.toString("hex");
// Result: "iv:encrypted"
```

### OTP Storage

```typescript
// Store in user document
user.otp = {
  encrypted: encryptedOtp,
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
  attempts: 0,
};
```

### OTP Verification

```typescript
// Timing-safe comparison
function verifyOtp(inputOtp: string, storedEncrypted: string): boolean {
  const decrypted = decrypt(storedEncrypted);
  return timingSafeEqual(Buffer.from(inputOtp), Buffer.from(decrypted));
}
```

### OTP Rate Limiting

Escalating backoff per user:

```typescript
// After first OTP request
rate limit: 1 minute

// After second OTP request
rate limit: 5 minutes

// After third OTP request
rate limit: 15 minutes

// After fourth OTP request
rate limit: 1 hour
```

Implementation uses Upstash Ratelimit with sliding window.

### OTP Security

- **Generation**: Cryptographically secure random
- **Encryption**: AES-256-CBC with random IV
- **Expiry**: 15 minutes
- **Max attempts**: 5 attempts before lockout
- **Rate limiting**: Escalating backoff
- **Timing-safe**: Constant-time comparison
- **Single-use**: Cleared after successful verification

## Email Verification

### Verification Token Generation

```typescript
// Generate 64 hex characters (32 bytes)
const token = crypto.randomBytes(32).toString("hex");
// Result: "a1b2c3d4e5f6...64 chars"
```

### Token Storage

```typescript
// Hash for lookup
const hash = crypto.createHash("sha256").update(token).digest("hex");

// Encrypt for additional protection
const encrypted = encrypt(token); // AES-256-CBC

// Store both
user.verificationToken = {
  hash: hash,
  encryptedToken: encrypted,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
};
```

### Verification Flow

**Endpoint:** `POST /api/auth/verify-email`

**Request:**

```json
{
  "token": "a1b2c3d4e5f6...64 chars"
}
```

**Steps:**

1. Hash incoming token (SHA256)
2. Find user by `verificationToken.hash`
3. Check token not expired
4. Set `isVerified = true`
5. Clear `verificationToken` (one-time use)
6. Save user

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

### Resend Verification

**Endpoint:** `POST /api/auth/resend-verification`

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Security:**

- Enumeration protected (same response for all cases)
- Rate limited (3/hour per IP)
- Generates new token (invalidates old)
- Fire-and-forget email sending

## Password Reset Flow

### Request Password Reset

**Endpoint:** `POST /api/auth/forgot-password`

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Flow:**

1. Find user by email (or fake processing if not found)
2. Generate reset token (64 hex chars)
3. Hash token (SHA256)
4. Encrypt token (AES-256-CBC)
5. Store in user document with 1-hour expiry
6. Send reset email (fire-and-forget)
7. Return success (always, enumeration protection)

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "If that email exists, a reset link has been sent."
  }
}
```

### Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Request:**

```json
{
  "token": "a1b2c3d4e5f6...64 chars",
  "newPassword": "NewPassword123!@#"
}
```

**Flow:**

1. Hash incoming token (SHA256)
2. Find user by `resetToken.hash`
3. Check token not expired
4. Validate new password complexity
5. Hash new password (bcrypt, cost 12)
6. Update user password
7. Increment `tokenVersion` (invalidates all sessions)
8. Store revocation timestamp in Redis
9. Delete all sessions from MongoDB
10. Clear `resetToken` (one-time use)
11. Save user
12. Return success

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Password reset successful. Please sign in with your new password."
  }
}
```

**Security:**

- Forces re-authentication (all sessions invalidated)
- One-time use token
- Time-limited (1 hour)
- New password must meet complexity requirements

## Rate Limiting Strategy

Implemented using Upstash Ratelimit with sliding window algorithm.

### Rate Limits by Endpoint

| Endpoint                        | Limit      | Window      | Key        |
| ------------------------------- | ---------- | ----------- | ---------- |
| `/api/auth/signup`              | 5          | 1 hour      | IP address |
| `/api/auth/signin`              | 10         | 15 minutes  | IP address |
| `/api/auth/forgot-password`     | 3          | 1 hour      | IP address |
| `/api/auth/resend-verification` | 3          | 1 hour      | IP address |
| `/api/auth/verify-otp`          | Escalating | Per attempt | User email |

### OTP Rate Limiting (Escalating)

```typescript
Attempt 1: Wait 0 seconds
Attempt 2: Wait 60 seconds (1 minute)
Attempt 3: Wait 300 seconds (5 minutes)
Attempt 4: Wait 900 seconds (15 minutes)
Attempt 5: Wait 3600 seconds (1 hour)
```

### Implementation

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const signupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
});

// In middleware
const { success, limit, remaining, reset } = await signupLimiter.limit(ip);

if (!success) {
  throw new RateLimitError("Too many requests. Please try again later.");
}
```

### Rate Limit Headers

Response includes:

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1708012800
```

## Audit Logging

All authentication events are logged to MongoDB for security auditing.

### Event Types

- `signup`: User registration
- `signin`: Successful sign-in
- `signin_failed`: Failed sign-in attempt
- `otp_sent`: OTP sent to admin
- `otp_verified`: OTP successfully verified
- `email_verified`: Email verification completed
- `password_reset_requested`: Password reset requested
- `password_reset_completed`: Password reset completed
- `token_refreshed`: Access token refreshed
- `logout`: User logged out
- `logout_all`: User logged out from all devices

### Event Document Structure

```typescript
{
  _id: ObjectId("..."),
  eventType: "signin",
  userId: ObjectId("..."),       // Optional (not present for failed signin)
  email: "user@example.com",
  ip: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  requestId: "uuid-v4",
  metadata: {                    // Optional additional data
    success: true,
    reason: "..."
  },
  createdAt: Date("2026-02-14T...")
}
```

### Retention Policy

- Events older than **90 days** are automatically deleted via TTL index
- Can be extended for compliance requirements

### Querying Audit Logs

```javascript
// Recent events for a user
db.authEvents
  .find({ userId: ObjectId("...") })
  .sort({ createdAt: -1 })
  .limit(10);

// Failed signin attempts
db.authEvents.find({
  eventType: "signin_failed",
  createdAt: { $gte: new Date("2026-02-13") },
});

// All events by IP
db.authEvents.find({ ip: "192.168.1.1" }).sort({ createdAt: -1 });
```

## Security Headers

Configured in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### Header Explanations

**X-Frame-Options: DENY**

- Prevents clickjacking attacks
- Page cannot be embedded in iframes

**X-Content-Type-Options: nosniff**

- Prevents MIME type sniffing
- Forces browser to respect Content-Type header

**X-XSS-Protection: 1; mode=block**

- Enables browser XSS filter
- Blocks page if XSS attack detected

**Referrer-Policy: strict-origin-when-cross-origin**

- Sends full URL for same-origin requests
- Sends only origin for cross-origin requests
- No referrer for downgrades (HTTPS → HTTP)

**Content-Security-Policy**

- Restricts resource loading
- Only allows scripts/styles from same origin
- Mitigates XSS and data injection attacks

**Strict-Transport-Security**

- Forces HTTPS connections
- Valid for 1 year
- Includes subdomains

---

## Summary

This authentication service implements:

- **Comprehensive authentication flows** for users and admins
- **Atomic token rotation** with replay detection
- **Triple-layer revocation** (token, session, user levels)
- **Secure session management** with TTL cleanup
- **OTP system** with encryption and rate limiting
- **Email verification** with time-limited tokens
- **Password reset** with forced re-authentication
- **Robust rate limiting** with escalating backoff
- **Comprehensive audit logging** with 90-day retention
- **Security headers** for defense in depth

All features are designed with security-first principles and production-grade implementation.
