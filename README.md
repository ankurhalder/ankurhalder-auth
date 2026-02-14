# Authentication Service

Enterprise-grade authentication service for [auth.ankurhalder.com](https://auth.ankurhalder.com), built with Domain-Driven Design (DDD) architecture and production-ready security features.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
- [Authentication Flows](#authentication-flows)
- [Security Features](#security-features)
- [Database Schema](#database-schema)
- [Development](#development)
- [Testing](#testing)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

## Overview

This authentication service provides secure user authentication and authorization with JWT tokens (RS256), session management, OTP verification for admin users, email verification, and password reset functionality. Built on Next.js 16 with a clean 4-layer DDD architecture.

**Live Service:** [auth.ankurhalder.com](https://auth.ankurhalder.com)

### Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Runtime:** Node.js 22+
- **Package Manager:** pnpm 9+
- **Database:** MongoDB Atlas
- **Cache/Session Store:** Upstash Redis
- **Email Provider:** Brevo (SendinBlue)
- **JWT Library:** jose (RS256 signing)
- **Validation:** Zod
- **Encryption:** Node.js crypto (AES-256-CBC)
- **Hashing:** bcrypt (cost 12)

## Key Features

### Core Authentication

- **User Registration** with email verification
- **User Sign-in** with password authentication
- **Admin Sign-in** with OTP verification (2FA for admins)
- **JWT Token Management** (Access + Refresh tokens, RS256)
- **Token Rotation** with atomic refresh and replay detection
- **Session Management** with Redis-backed revocation store
- **Email Verification** with time-limited tokens
- **Password Reset** with secure one-time tokens
- **Remember Me** functionality (7 vs 30 days)

### Security Features

- **RS256 JWT Signing** with separate key pairs for access/refresh tokens
- **Key Rotation Support** with 30-day grace period
- **8-Step Token Verification** chain with multiple security checks
- **Triple-Layer Token Revocation** (token, session, user levels)
- **OTP Security** with AES-256-CBC encryption and rate limiting
- **Password Security** with bcrypt (cost 12) and complexity validation
- **Token Storage** with SHA256 hashing in database
- **Rate Limiting** with Upstash Ratelimit (sliding window)
- **CSRF Protection** with double-submit cookie pattern
- **CORS Configuration** with allowed origins
- **Security Headers** (CSP, HSTS, X-Frame-Options, etc.)
- **Audit Logging** for all authentication events

### Developer Experience

- **DDD Architecture** with enforced layer boundaries
- **ESLint Rules** preventing architectural violations
- **TypeScript Strict Mode** with comprehensive type safety
- **Path Aliases** for clean imports (@domain, @app, @infra, @presentation)
- **Fire-and-Forget Pattern** for emails and audit logs
- **Dependency Injection** for testability
- **Zero External Dependencies** in domain layer

## Architecture

This service follows a **4-layer Domain-Driven Design (DDD)** architecture with strict layer boundaries enforced by ESLint and TypeScript path aliases.

```
┌──────────────────────────────────────────────────┐
│           Presentation Layer                     │
│  (API Routes, Middleware, Validation, Helpers)   │
│              ↓ Uses All Layers                   │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│         Infrastructure Layer                     │
│   (Database, Redis, Email, Crypto, External)     │
│        ↓ Implements Domain Interfaces            │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│          Application Layer                       │
│    (Use Cases, DTOs, Port Interfaces)            │
│         ↓ Orchestrates Domain Logic              │
└──────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│            Domain Layer                          │
│  (Entities, Value Objects, Repository Ports)     │
│         ↓ Pure Business Logic (No Deps)          │
└──────────────────────────────────────────────────┘
```

### Dependency Rules

- **Domain Layer:** No dependencies on outer layers (pure business logic)
- **Application Layer:** Can import from Domain only
- **Infrastructure Layer:** Can import from Domain and Application
- **Presentation Layer:** Can import from all layers

**See:** [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Quick Start

### Prerequisites

- Node.js 22.0.0 or higher
- pnpm 9.0.0 or higher
- MongoDB Atlas account
- Upstash Redis account
- Brevo API key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ankurhalder/auth.git
   cd auth
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Generate JWT keys** (RS256, 2048-bit)

   ```bash
   # Generate access token key pair
   openssl genrsa -out private_key.pem 2048
   openssl rsa -in private_key.pem -pubout -out public_key.pem

   # Generate refresh token key pair
   openssl genrsa -out refresh_private_key.pem 2048
   openssl rsa -in refresh_private_key.pem -pubout -out refresh_public_key.pem
   ```

4. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

5. **Run development server**

   ```bash
   pnpm dev
   ```

   Server starts at `http://localhost:3001`

### Environment Variables

See [.env.example](.env.example) for all required environment variables. Key variables:

```bash
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=https://www.ankurhalder.com
ALLOWED_ORIGINS=https://www.ankurhalder.com,http://localhost:3000

# JWT Keys (paste contents from .pem files)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
JWT_KID=k1

JWT_REFRESH_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
JWT_REFRESH_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
JWT_REFRESH_KID=r1

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
DB_NAME=portfolio

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Brevo Email
BREVO_API_KEY=xkeysib-your-api-key
ADMIN_EMAIL=admin@yourwebsite.com
FROM_EMAIL=noreply@yourwebsite.com

# Encryption (32-byte hex)
ENCRYPTION_KEY=your-64-character-hex-key

# Cron Secret
CRON_SECRET=your-cron-secret
```

**See:** [docs/infrastructure.md](docs/infrastructure.md) for detailed setup instructions.

## API Endpoints

All endpoints use JSON for request/response bodies and return standard formats.

### Public Endpoints

| Method | Endpoint                        | Description               |
| ------ | ------------------------------- | ------------------------- |
| POST   | `/api/auth/signup`              | Register new user         |
| POST   | `/api/auth/signin`              | Sign in user/admin        |
| POST   | `/api/auth/verify-otp`          | Verify admin OTP          |
| POST   | `/api/auth/verify-email`        | Verify email with token   |
| POST   | `/api/auth/forgot-password`     | Request password reset    |
| POST   | `/api/auth/reset-password`      | Reset password with token |
| POST   | `/api/auth/resend-verification` | Resend verification email |
| GET    | `/.well-known/jwks.json`        | Get public JWKS           |
| GET    | `/api/health`                   | Health check              |

### Protected Endpoints (Require Access Token)

| Method | Endpoint               | Description             |
| ------ | ---------------------- | ----------------------- |
| GET    | `/api/auth/me`         | Get current user        |
| POST   | `/api/auth/refresh`    | Refresh access token    |
| POST   | `/api/auth/logout`     | Logout (revoke session) |
| POST   | `/api/auth/logout-all` | Logout all sessions     |

### Cron Endpoints (Require Cron Secret)

| Method | Endpoint            | Description                     |
| ------ | ------------------- | ------------------------------- |
| POST   | `/api/cron/cleanup` | Cleanup expired sessions/tokens |

### Request/Response Format

**Success Response:**

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "..." },
    "message": "Operation successful"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid credentials"
  }
}
```

## Authentication Flows

### User Registration Flow

```
1. User submits email + password
2. System validates password complexity
3. System checks email uniqueness
4. System hashes password (bcrypt, cost 12)
5. System generates verification token
6. System stores user with hashed token
7. System sends verification email
8. User clicks email link
9. System verifies token and activates account
```

### User Sign-In Flow

```
1. User submits email + password
2. System verifies email is verified
3. System validates password (bcrypt compare)
4. System creates session record
5. System generates JWT access + refresh tokens
6. System sets HttpOnly cookies
7. User receives tokens and can access protected resources
```

### Admin Sign-In Flow (2FA with OTP)

```
1. Admin submits email + password
2. System validates credentials
3. System generates 8-digit OTP
4. System encrypts OTP (AES-256-CBC)
5. System applies rate limiting
6. System sends OTP via email
7. Admin submits OTP
8. System verifies OTP (timing-safe)
9. System creates session and issues tokens
```

### Token Refresh Flow (Atomic Rotation)

```
1. Client sends refresh token
2. System atomically finds and deletes session (findOneAndDelete)
3. System verifies JWT signature + expiry
4. System checks revocation store (3 levels)
5. System validates user exists + tokenVersion
6. System creates new session with new ID
7. System issues new access + refresh tokens
8. Old refresh token is now invalid (replay detection)
```

### Password Reset Flow

```
1. User requests password reset
2. System generates reset token (64 hex chars)
3. System hashes + encrypts token
4. System sends reset email
5. User clicks email link
6. User submits new password
7. System verifies token + expiry
8. System hashes new password
9. System increments tokenVersion (invalidates all sessions)
10. User must sign in again
```

**See:** [docs/features.md](docs/features.md) for detailed feature documentation.

## Security Features

### JWT (JSON Web Tokens)

- **Algorithm:** RS256 (RSA-SHA256)
- **Key Size:** 2048-bit RSA
- **Access Token:** 15 minutes expiry
- **Refresh Token:** 7 days (30 with rememberMe)
- **Separate Key Pairs:** Access and refresh tokens use different keys
- **Key Rotation:** Supports previous keys with 30-day grace period
- **8-Step Verification:** Comprehensive validation chain
- **JWKS Endpoint:** Public keys served at `/.well-known/jwks.json`

### Password Security

- **Hashing:** bcrypt with cost factor 12
- **Legacy Support:** PBKDF2-SHA512 with auto-migration
- **Complexity:** 8+ chars, upper, lower, digit, special
- **Timing Safety:** Constant-time comparison to prevent timing attacks

### OTP Security

- **Generation:** crypto.randomInt (8 digits)
- **Encryption:** AES-256-CBC with 32-byte key
- **Expiry:** 15 minutes
- **Max Attempts:** 5 attempts before lockout
- **Rate Limiting:** Escalating backoff (1min → 5min → 15min → 1hour)
- **Timing Safety:** Constant-time comparison

### Token Storage

- **Refresh Tokens:** SHA256 hashed in MongoDB
- **Verification Tokens:** SHA256 hashed + AES-256-CBC encrypted
- **Reset Tokens:** SHA256 hashed + AES-256-CBC encrypted
- **OTP:** AES-256-CBC encrypted with attempt counter

### Session Management

- **Revocation Store:** Redis with 3 revocation levels
  - **Token Level:** Individual token revocation
  - **Session Level:** All tokens in a session
  - **User Level:** All user sessions (global logout)
- **Atomic Rotation:** findOneAndDelete for replay detection
- **TTL Preservation:** Maintains rememberMe preference across refreshes

### Rate Limiting

Implemented with Upstash Ratelimit (sliding window):

- **Signup:** 5 requests per hour per IP
- **Signin:** 10 requests per 15 minutes per IP
- **OTP:** Escalating backoff per user
- **Forgot Password:** 3 requests per hour per IP
- **Resend Verification:** 3 requests per hour per IP

### Security Headers

Configured in `vercel.json`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### CORS & CSRF

- **CORS:** Strict origin validation from `ALLOWED_ORIGINS`
- **CSRF:** Double-submit cookie pattern with origin validation

### Audit Logging

All authentication events are logged to MongoDB with:

- Event type (signup, signin, logout, etc.)
- User ID
- IP address
- User agent
- Request ID
- Timestamp

**See:** [docs/request-flow.md](docs/request-flow.md) for complete request flow documentation.

## Database Schema

### Users Collection

```typescript
{
  _id: ObjectId,
  email: string (unique, lowercase),
  password: string (bcrypt hash),
  role: "user" | "admin",
  isVerified: boolean,
  tokenVersion: number,
  verificationToken?: {
    hash: string (SHA256),
    encryptedToken: string (AES-256-CBC),
    expiresAt: Date
  },
  resetToken?: {
    hash: string (SHA256),
    encryptedToken: string (AES-256-CBC),
    expiresAt: Date
  },
  otp?: {
    encrypted: string (AES-256-CBC),
    expiresAt: Date,
    attempts: number
  },
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- email (unique)
- verificationToken.hash
- verificationToken.expiresAt (TTL)
- resetToken.hash
- resetToken.expiresAt (TTL)
- otp.expiresAt (TTL)
```

### Sessions Collection

```typescript
{
  _id: ObjectId,
  sessionId: string (UUID v4, unique),
  userId: ObjectId,
  refreshTokenHash: string (SHA256),
  jti: string,
  expiresAt: Date,
  createdAt: Date
}

Indexes:
- sessionId (unique)
- userId
- refreshTokenHash
- jti
- expiresAt (TTL)
```

### Auth Events Collection (Audit Log)

```typescript
{
  _id: ObjectId,
  eventType: string,
  userId?: ObjectId,
  email?: string,
  ip: string,
  userAgent: string,
  requestId: string,
  metadata?: object,
  createdAt: Date
}

Indexes:
- userId
- eventType
- createdAt
- createdAt (TTL, 90 days)
```

### Redis Revocation Store

```typescript
// Token-level revocation
key: `revoke:token:${jti}`
value: "1"
ttl: token expiry

// Session-level revocation
key: `revoke:session:${sessionId}`
value: "1"
ttl: 30 days

// User-level revocation
key: `revoke:user:${userId}`
value: timestamp
ttl: 30 days
```

## Development

### Project Structure

```
auth/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── .well-known/
│   │   │   └── jwks.json/        # JWKS endpoint
│   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── signup/
│   │   │   ├── signin/
│   │   │   ├── refresh/
│   │   │   ├── logout/
│   │   │   └── ...
│   │   ├── cron/                 # Cron jobs
│   │   └── health/               # Health check
│   ├── layout.tsx
│   └── page.tsx
├── src/                          # DDD layers
│   ├── domain/                   # Domain layer (pure)
│   │   ├── entities/             # Business entities
│   │   ├── value-objects/        # Value objects
│   │   ├── repositories/         # Repository interfaces
│   │   └── errors/               # Domain errors
│   ├── application/              # Application layer
│   │   ├── use-cases/            # Use case implementations
│   │   ├── dtos/                 # Data transfer objects
│   │   └── interfaces/           # Port interfaces
│   ├── infrastructure/           # Infrastructure layer
│   │   ├── database/             # MongoDB implementations
│   │   ├── redis/                # Redis implementations
│   │   ├── email/                # Email provider
│   │   └── crypto/               # Crypto services
│   ├── presentation/             # Presentation layer
│   │   ├── middleware/           # Express-style middleware
│   │   ├── helpers/              # Request/response helpers
│   │   └── validation/           # Zod schemas
│   ├── env.ts                    # Environment validation
│   └── instrumentation.ts        # Server initialization
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
├── public/                       # Static assets
├── .env.example                  # Environment template
├── eslint.config.mjs             # ESLint configuration
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
├── vercel.json                   # Vercel deployment config
└── package.json                  # Dependencies and scripts
```

### Available Scripts

```bash
# Development
pnpm dev                 # Start dev server with Turbopack on port 3001
pnpm build               # Build for production
pnpm start               # Start production server

# Code Quality
pnpm lint                # Run ESLint
pnpm type-check          # Run TypeScript type checking

# Testing
pnpm test                # Run tests
pnpm test:watch          # Run tests in watch mode
pnpm test:coverage       # Run tests with coverage
```

### Path Aliases

```typescript
import { User } from "@domain/entities/user.entity";
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { JWTService } from "@infra/crypto/jwt.service";
import { withAuth } from "@presentation/middleware/auth";
```

### Layer Boundary Rules

ESLint will error if you violate these rules:

- Domain cannot import from Application, Infrastructure, or Presentation
- Application cannot import from Infrastructure or Presentation
- Infrastructure cannot import from Presentation
- Presentation can import from all layers

**See:** [docs/dependency-rule.md](docs/dependency-rule.md) for detailed dependency rules.

## Testing

### Unit Tests

Test use cases and services in isolation:

```bash
pnpm test
```

### Integration Tests

Test API routes with real infrastructure:

```bash
pnpm test:integration
```

### E2E Tests

Test complete authentication flows:

```bash
pnpm test:e2e
```

### Test Coverage

```bash
pnpm test:coverage
```

Coverage reports generated in `coverage/` directory.

## Production Checklist

Before deploying to production:

### Environment

- [ ] Set `NODE_ENV=production`
- [ ] Configure production URLs in `NEXT_PUBLIC_SITE_URL` and `ALLOWED_ORIGINS`
- [ ] Generate production JWT keys (RS256, 2048-bit)
- [ ] Set strong `ENCRYPTION_KEY` (32-byte hex)
- [ ] Set strong `CRON_SECRET` (32-byte base64)
- [ ] Use production MongoDB cluster
- [ ] Use production Upstash Redis instance
- [ ] Configure Brevo API key with production sender

### Infrastructure

- [ ] MongoDB Atlas production cluster with replicas
- [ ] MongoDB indexes created (runs automatically via instrumentation.ts)
- [ ] Upstash Redis with high availability
- [ ] Vercel deployment configured
- [ ] Custom domain configured (auth.ankurhalder.com)
- [ ] SSL/TLS certificates active
- [ ] Cron job scheduled for `/api/cron/cleanup`

### Security

- [ ] JWT keys stored securely (never committed)
- [ ] Environment variables in Vercel dashboard (not .env files)
- [ ] Security headers configured in vercel.json
- [ ] CORS origins whitelisted correctly
- [ ] Rate limiting tested and tuned
- [ ] CSRF protection enabled
- [ ] Content Security Policy tested

### Monitoring

- [ ] Health check endpoint monitored (`/api/health`)
- [ ] Error tracking configured (e.g., Sentry)
- [ ] Performance monitoring enabled
- [ ] Audit logs reviewed regularly
- [ ] Database backups scheduled

### Testing

- [ ] All tests passing (`pnpm test`)
- [ ] Type checking clean (`pnpm type-check`)
- [ ] Linting clean (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Manual testing of all flows
- [ ] Load testing completed

## Troubleshooting

### Common Issues

#### Build Errors

**Problem:** TypeScript errors during build

```bash
pnpm type-check
```

Fix type errors and rebuild.

**Problem:** ESLint errors during build

```bash
pnpm lint
```

Fix linting errors. Check for layer boundary violations.

#### Runtime Errors

**Problem:** "Invalid JWT signature"

- Verify `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` match
- Ensure keys are in PEM format with headers/footers
- Check key rotation configuration

**Problem:** "Failed to connect to MongoDB"

- Verify `MONGODB_URI` is correct
- Check IP whitelist in MongoDB Atlas
- Ensure network connectivity

**Problem:** "Redis connection failed"

- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Upstash Redis instance is active

**Problem:** "Email not sending"

- Verify `BREVO_API_KEY` is valid
- Check Brevo sender is verified
- Review Brevo dashboard for errors

#### Authentication Issues

**Problem:** "Email verification not working"

- Check email delivery in Brevo dashboard
- Verify link format and token expiry
- Check `NEXT_PUBLIC_SITE_URL` is correct

**Problem:** "OTP not received"

- Check admin user role in database
- Verify Brevo email delivery
- Check OTP rate limiting

**Problem:** "Token refresh failing"

- Verify refresh token cookie is sent
- Check session exists in database
- Review revocation store in Redis

### Debug Mode

Enable debug logging (in development):

```typescript
// src/presentation/middleware/auth.ts
console.log('Token verification:', { jti, userId, ... })
```

### Health Check

Monitor service health:

```bash
curl https://auth.ankurhalder.com/api/health
```

Response should return `200 OK` with:

```json
{ "success": true, "data": { "message": "Service healthy" } }
```

### Database Queries

Useful MongoDB queries for debugging:

```javascript
// Find user by email
db.users.findOne({ email: "user@example.com" });

// Check sessions for user
db.sessions.find({ userId: ObjectId("...") });

// Review recent auth events
db.authEvents.find().sort({ createdAt: -1 }).limit(10);

// Check expired sessions (should be cleaned by cron)
db.sessions.find({ expiresAt: { $lt: new Date() } });
```

## Documentation

Comprehensive documentation is available in the [docs/](docs/) directory:

- [**Architecture**](docs/architecture.md) - DDD architecture, layers, dependency rules
- [**Infrastructure**](docs/infrastructure.md) - Setup guides for MongoDB, Redis, Brevo, Vercel
- [**Features**](docs/features.md) - Detailed feature documentation, flows, diagrams
- [**Dependency Rules**](docs/dependency-rule.md) - Layer boundary rules and enforcement
- [**Development**](docs/development.md) - Development workflow, setup, guidelines
- [**Enforcement**](docs/enforcement.md) - ESLint rules, TypeScript strict mode
- [**Request Flow**](docs/request-flow.md) - Complete request lifecycle documentation

---

## License

MIT License

## Contact

For questions or support:

- **Email:** admin@ankurhalder.com
- **Website:** [ankurhalder.com](https://ankurhalder.com)

---

**Built with clean architecture principles and production-grade security.**
