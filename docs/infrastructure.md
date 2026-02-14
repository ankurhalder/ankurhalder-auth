# Infrastructure Setup Guide

This document provides comprehensive infrastructure setup instructions for the authentication service, covering MongoDB Atlas, Upstash Redis, Brevo email provider, JWT key generation, and deployment to Vercel.

## Table of Contents

- [MongoDB Atlas Setup](#mongodb-atlas-setup)
- [Upstash Redis Setup](#upstash-redis-setup)
- [Brevo Email Provider Setup](#brevo-email-provider-setup)
- [JWT Key Generation](#jwt-key-generation)
- [Environment Variables](#environment-variables)
- [Vercel Deployment](#vercel-deployment)
- [Custom Domain Setup](#custom-domain-setup)
- [Production Considerations](#production-considerations)

## MongoDB Atlas Setup

### 1. Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account or log in
3. Create a new organization (if needed)
4. Create a new project (e.g., "Portfolio Auth")

### 2. Create Database Cluster

1. Click "Build a Database"
2. Choose deployment option:
   - **Free tier (M0)**: Good for development/testing
   - **Dedicated**: For production with auto-scaling
3. Select cloud provider: **AWS** (recommended)
4. Select region: Choose closest to your Vercel deployment region
5. Cluster name: `auth-cluster` (or your preference)
6. Click "Create"

### 3. Configure Database Access

1. Go to "Database Access" in sidebar
2. Click "Add New Database User"
3. Authentication Method: **Password**
4. Username: `auth-service`
5. Password: Generate strong password (save securely)
6. Database User Privileges: **Read and write to any database**
7. Click "Add User"

### 4. Configure Network Access

1. Go to "Network Access" in sidebar
2. Click "Add IP Address"
3. For development:
   - Click "Allow Access From Anywhere" (0.0.0.0/0)
4. For production:
   - Whitelist Vercel IPs or use Vercel's connection method
5. Click "Confirm"

### 5. Get Connection String

1. Go to "Database" in sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Driver: **Node.js**
5. Version: **6.0 or later**
6. Copy connection string:
   ```
   mongodb+srv://auth-service:<password>@auth-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<password>` with your database user password

### 6. Create Database

The database will be created automatically when the application starts. Default name: `portfolio`

### 7. Indexes

Indexes are automatically created on application startup via `src/instrumentation.ts`. The following indexes are created:

**Users Collection:**

- `email` (unique)
- `verificationToken.hash`
- `verificationToken.expiresAt` (TTL index, auto-deletes after expiry)
- `resetToken.hash`
- `resetToken.expiresAt` (TTL index)
- `otp.expiresAt` (TTL index)

**Sessions Collection:**

- `sessionId` (unique)
- `userId`
- `refreshTokenHash`
- `jti`
- `expiresAt` (TTL index, auto-deletes expired sessions)

**Auth Events Collection:**

- `userId`
- `eventType`
- `createdAt`
- `createdAt` (TTL index, 90-day retention)

### 8. Verify Setup

Run the health check endpoint to verify MongoDB connection:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "message": "Service healthy",
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

## Upstash Redis Setup

### 1. Create Upstash Account

1. Go to [Upstash](https://upstash.com)
2. Sign up with GitHub or email
3. Verify your email

### 2. Create Redis Database

1. Click "Create Database"
2. Configuration:
   - **Name**: `auth-revocation-store`
   - **Type**: **Regional** (for better latency)
   - **Region**: Choose closest to your Vercel deployment
   - **Primary Region**: Select one
   - **Read Regions**: Add if needed (for global distribution)
   - **TLS**: Enabled (recommended)
   - **Eviction**: **No eviction** (recommended for auth)
3. Click "Create"

### 3. Get Redis Credentials

1. Go to your database dashboard
2. Scroll to "REST API" section
3. Copy credentials:
   - **UPSTASH_REDIS_REST_URL**: `https://your-instance.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: `AXxxxxxxxxxxxxxxxxxxxxxxxx`

### 4. Configure Rate Limiting

Rate limiting is automatically configured in the application using `@upstash/ratelimit`:

- **Signup**: 5 requests per hour per IP
- **Signin**: 10 requests per 15 minutes per IP
- **OTP**: Escalating backoff per user (1min → 5min → 15min → 1hour)
- **Forgot Password**: 3 requests per hour per IP
- **Resend Verification**: 3 requests per hour per IP

### 5. Revocation Store

The revocation store uses three levels:

**Token-level revocation:**

```
Key: revoke:token:${jti}
Value: "1"
TTL: token expiry time
```

**Session-level revocation:**

```
Key: revoke:session:${sessionId}
Value: "1"
TTL: 30 days
```

**User-level revocation (global logout):**

```
Key: revoke:user:${userId}
Value: timestamp
TTL: 30 days
```

### 6. Monitor Usage

1. Go to Upstash dashboard
2. View metrics:
   - Commands per second
   - Storage usage
   - Connection count
   - Bandwidth usage

### 7. Verify Setup

The health check endpoint automatically tests Redis connectivity.

## Brevo Email Provider Setup

### 1. Create Brevo Account

1. Go to [Brevo](https://www.brevo.com) (formerly SendinBlue)
2. Sign up for free account
3. Verify your email

### 2. Verify Sender Email/Domain

**Option A: Verify Single Email**

1. Go to "Senders" → "Senders"
2. Click "Add a Sender"
3. Enter email: `noreply@yourwebsite.com`
4. Click verification link sent to your email
5. Email is now verified

**Option B: Verify Domain (Recommended for Production)**

1. Go to "Senders" → "Domains"
2. Click "Add a Domain"
3. Enter your domain: `ankurhalder.com`
4. Add DNS records provided by Brevo:
   - SPF record (TXT)
   - DKIM record (TXT)
   - DMARC record (TXT) - optional but recommended
5. Click "Verify Domain"
6. Domain verification can take up to 48 hours

### 3. Get API Key

1. Go to "SMTP & API" → "API Keys"
2. Click "Create a New API Key"
3. Name: `auth-service-production`
4. Copy the API key (starts with `xkeysib-`)
5. Store securely - shown only once

### 4. Email Templates

The application uses inline HTML templates in `src/infrastructure/email/brevo.provider.ts`:

**Verification Email:**

- Subject: "Verify Your Email"
- Color: Purple theme
- Link validity: 1 hour
- Call-to-action: "Verify Email" button

**OTP Email:**

- Subject: "Your Sign-In Code"
- Color: Red theme
- 8-digit OTP code
- Validity: 15 minutes
- Warning: "If you didn't request this, ignore it"

**Password Reset Email:**

- Subject: "Reset Your Password"
- Color: Purple theme
- Link validity: 1 hour
- Call-to-action: "Reset Password" button

### 5. Configure Sender Information

Update environment variables:

```bash
FROM_EMAIL=noreply@yourwebsite.com   # Verified sender
ADMIN_EMAIL=admin@yourwebsite.com    # Receives contact form emails
```

### 6. Test Email Delivery

Send a test email using the signup endpoint:

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

Check your inbox for the verification email.

### 7. Monitor Email Sending

1. Go to "Statistics" → "Email"
2. View metrics:
   - Delivered
   - Opened
   - Clicked
   - Bounced
   - Spam reports

### 8. Error Handling

The application uses `p-retry` with exponential backoff:

- **Retries**: 3 attempts
- **Backoff**: Exponential
- **Fire-and-forget**: Email failures don't block user operations

## JWT Key Generation

### 1. Generate RSA Key Pairs

The service uses **RS256 (RSA-SHA256)** with **2048-bit keys**.

**Generate Access Token Keys:**

```bash
# Private key
openssl genrsa -out private_key.pem 2048

# Public key
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

**Generate Refresh Token Keys:**

```bash
# Private key
openssl genrsa -out refresh_private_key.pem 2048

# Public key
openssl rsa -in refresh_private_key.pem -pubout -out refresh_public_key.pem
```

### 2. Verify Keys

**View private key:**

```bash
cat private_key.pem
```

Output should start with:

```
-----BEGIN RSA PRIVATE KEY-----
```

**View public key:**

```bash
cat public_key.pem
```

Output should start with:

```
-----BEGIN PUBLIC KEY-----
```

### 3. Key Format for Environment Variables

Copy the entire key including headers/footers:

```bash
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...multiple lines...
...ending with...
-----END RSA PRIVATE KEY-----"
```

**Note:** Preserve line breaks or use `\n` for newlines.

### 4. Key IDs (KID)

Each key pair needs a unique identifier:

```bash
JWT_KID=k1                    # Access token key ID
JWT_REFRESH_KID=r1            # Refresh token key ID
```

### 5. Key Rotation

For key rotation, keep previous keys for a grace period:

```bash
# After rotating keys, add old keys here
JWT_PREVIOUS_KIDS=k0,k-1       # Comma-separated old KIDs
JWT_PREVIOUS_PUBLIC_KEYS=...   # Comma-separated old public keys
```

Grace period: **30 days** (configurable in `src/infrastructure/crypto/jwt.service.ts`)

### 6. Security Best Practices

- **Never commit keys** to version control (use `.gitignore`)
- **Store in environment variables** or secrets manager
- **Rotate keys** every 90 days (recommended)
- **Use different keys** for access and refresh tokens
- **Keep private keys secure** - never share or expose
- **Use 2048-bit or larger** keys (4096-bit for high security)

### 7. JWKS Endpoint

Public keys are automatically served at:

```
https://auth.ankurhalder.com/.well-known/jwks.json
```

Used by client applications to verify JWT signatures.

## Environment Variables

### Complete Environment Configuration

Create `.env.local` in project root:

```bash
# ============================================
# NODE ENVIRONMENT
# ============================================
NODE_ENV=production

# ============================================
# URLS
# ============================================
NEXT_PUBLIC_SITE_URL=https://www.ankurhalder.com
ALLOWED_ORIGINS=https://www.ankurhalder.com,https://ankurhalder.com

# ============================================
# JWT - ACCESS TOKENS
# ============================================
# RS256 algorithm, 2048-bit keys
# Generate: openssl genrsa -out private_key.pem 2048

JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"

JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"

JWT_KID=k1

# ============================================
# JWT - REFRESH TOKENS
# ============================================
# Separate key pair for refresh tokens

JWT_REFRESH_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"

JWT_REFRESH_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"

JWT_REFRESH_KID=r1

# ============================================
# JWT - KEY ROTATION (OPTIONAL)
# ============================================
# Comma-separated previous key IDs and public keys
# Keep for 30-day grace period after rotation

JWT_PREVIOUS_KIDS=
JWT_PREVIOUS_PUBLIC_KEYS=

# ============================================
# MONGODB ATLAS
# ============================================
# Get from: MongoDB Atlas → Connect → Connection String

MONGODB_URI=mongodb+srv://auth-service:PASSWORD@auth-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=portfolio

# ============================================
# UPSTASH REDIS
# ============================================
# Get from: Upstash Dashboard → Database → REST API

UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# BREVO EMAIL (SENDINBLUE)
# ============================================
# Get from: Brevo → SMTP & API → API Keys

BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_EMAIL=admin@ankurhalder.com
FROM_EMAIL=noreply@ankurhalder.com

# ============================================
# ENCRYPTION
# ============================================
# 32-byte hex key for AES-256-CBC encryption
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ENCRYPTION_KEY=your-64-character-hex-string-here

# ============================================
# INTERNAL SECRETS
# ============================================
# Cron job secret for /api/cron/cleanup
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

CRON_SECRET=your-base64-secret-here
```

### Validation

Environment variables are validated on startup in `src/env.ts` using Zod. Invalid configuration will throw an error.

### Security Notes

- **Never commit `.env.local`** to version control
- Add `.env.local` to `.gitignore`
- Use Vercel environment variables for production
- Rotate secrets regularly
- Use different secrets for development/production

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Link Project

```bash
cd /path/to/auth
vercel link
```

Select or create project: `auth-service`

### 4. Configure Environment Variables

**Option A: Via Vercel Dashboard**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select project: `auth-service`
3. Go to "Settings" → "Environment Variables"
4. Add all variables from `.env.local`
5. Set environment: **Production**

**Option B: Via Vercel CLI**

```bash
vercel env pull .env.local
vercel env add MONGODB_URI production
# Repeat for all environment variables
```

### 5. Deploy to Production

```bash
vercel --prod
```

### 6. Configure Build Settings

In project settings:

- **Framework Preset**: Next.js
- **Build Command**: `pnpm build`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`
- **Node Version**: 22.x

### 7. Configure Functions

Next.js API routes become serverless functions automatically. Ensure:

- **Function Region**: Same as MongoDB/Redis region
- **Function Timeout**: 10s (default)
- **Memory**: 1024 MB (recommended)

### 8. Configure Cron Job

In `vercel.json`, cron jobs are configured (if needed):

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Or use external cron services (cron-job.org, EasyCron, etc.) to hit:

```
POST https://auth.ankurhalder.com/api/cron/cleanup
Authorization: Bearer YOUR_CRON_SECRET
```

### 9. Monitor Deployment

View deployment logs:

```bash
vercel logs
```

Or visit Vercel dashboard → Deployments

## Custom Domain Setup

### 1. Add Domain to Vercel

1. Go to Vercel project settings
2. Click "Domains"
3. Add domain: `auth.ankurhalder.com`
4. Click "Add"

### 2. Configure DNS Records

Add DNS records in your domain registrar:

**Option A: Vercel DNS (Recommended)**

- Vercel provides automatic DNS configuration
- Update nameservers to Vercel's nameservers

**Option B: Custom DNS**
Add these records:

```
Type: A
Name: auth
Value: 76.76.21.21

Type: CNAME
Name: auth
Value: cname.vercel-dns.com
```

### 3. Wait for DNS Propagation

DNS changes can take up to 48 hours to propagate globally. Check status:

```bash
dig auth.ankurhalder.com
```

### 4. SSL/TLS Certificate

Vercel automatically provisions SSL certificates via Let's Encrypt. Once DNS propagates:

- Certificate issued automatically
- HTTPS enforced automatically
- HTTP → HTTPS redirect enabled

### 5. Update Environment Variables

Update `NEXT_PUBLIC_SITE_URL` and `ALLOWED_ORIGINS`:

```bash
NEXT_PUBLIC_SITE_URL=https://www.ankurhalder.com
ALLOWED_ORIGINS=https://www.ankurhalder.com,https://ankurhalder.com
```

### 6. Verify Domain

Visit:

```
https://auth.ankurhalder.com/api/health
```

Should return `200 OK` with SSL.

## Production Considerations

### Performance

1. **Database Indexes**: Automatically created on startup
2. **Redis TTL**: Expired keys automatically deleted
3. **Connection Pooling**: MongoDB uses connection pooling
4. **Caching**: JWKS endpoint cached for 24 hours

### Security

1. **HTTPS**: Enforced by Vercel
2. **Security Headers**: Configured in `vercel.json`
3. **CORS**: Strict origin validation
4. **Rate Limiting**: Implemented via Upstash
5. **Secrets**: Never committed to Git

### Monitoring

1. **Health Check**: `/api/health` for uptime monitoring
2. **Error Tracking**: Consider adding Sentry
3. **Performance**: Vercel Analytics
4. **Audit Logs**: MongoDB auth events collection

### Backups

1. **MongoDB**: Enable continuous backups in Atlas
2. **Redis**: Upstash provides daily backups
3. **Environment Variables**: Keep secure backup of all secrets

### Scaling

1. **MongoDB**: Auto-scaling available in Atlas
2. **Redis**: Upstash auto-scales
3. **Vercel Functions**: Auto-scale by default
4. **Rate Limits**: Adjust based on traffic patterns

### Cost Optimization

1. **MongoDB**: Free M0 tier for development, paid tiers for production
2. **Upstash**: Free tier available, pay-per-request pricing
3. **Brevo**: 300 emails/day free, paid plans for more
4. **Vercel**: Hobby plan free, Pro for production

---

## Summary

Infrastructure setup checklist:

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with strong password
- [ ] Network access configured
- [ ] Connection string obtained
- [ ] Upstash Redis database created
- [ ] Redis credentials obtained
- [ ] Brevo account created
- [ ] Sender email/domain verified
- [ ] Brevo API key obtained
- [ ] JWT key pairs generated (RS256, 2048-bit)
- [ ] All environment variables configured
- [ ] `.env.local` created (never committed)
- [ ] Vercel project linked
- [ ] Environment variables added to Vercel
- [ ] Custom domain configured
- [ ] SSL certificate provisioned
- [ ] Health check verified
- [ ] Cron job scheduled

For troubleshooting, see [README.md](../README.md#troubleshooting).
