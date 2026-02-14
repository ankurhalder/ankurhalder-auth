# Development Guide

Complete guide for developing and contributing to the authentication service.

## Table of Contents

- [Local Setup](#local-setup)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Strategies](#testing-strategies)
- [Debugging Tips](#debugging-tips)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Local Setup

### Prerequisites

Ensure you have installed:

- **Node.js** 22.0.0 or higher
- **pnpm** 9.0.0 or higher
- **Git**
- **VS Code** (recommended) or your preferred IDE

### Clone Repository

```bash
git clone https://github.com/ankurhalder/auth.git
cd auth
```

### Install Dependencies

```bash
pnpm install
```

### Generate JWT Keys

```bash
# Access token key pair
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Refresh token key pair
openssl genrsa -out refresh_private_key.pem 2048
openssl rsa -in refresh_private_key.pem -pubout -out refresh_public_key.pem
```

### Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials. For development, you can use:

**MongoDB**: Use a free MongoDB Atlas M0 cluster
**Redis**: Use a free Upstash Redis instance
**Email**: Use Brevo free tier (300 emails/day)

**Generate encryption key:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate cron secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Database Initialization

Indexes are created automatically on server start via `src/instrumentation.ts`. No manual setup needed.

### Start Development Server

```bash
pnpm dev
```

Server starts at `http://localhost:3001` with Turbopack.

### Verify Setup

Test health endpoint:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "message": "Service healthy"
  }
}
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow the layer architecture:

- **New entity?** → `src/domain/entities/`
- **New use case?** → `src/application/use-cases/`
- **New repository?** → Interface in `src/domain/repositories/`, implementation in `src/infrastructure/database/`
- **New API endpoint?** → `app/api/your-endpoint/route.ts`

### 3. Run Linter

```bash
pnpm lint
```

Fix any linting errors. ESLint will catch architectural violations.

### 4. Run Type Check

```bash
pnpm type-check
```

Fix any TypeScript errors.

### 5. Test Your Changes

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test src/domain/entities/user.entity.test.ts

# Watch mode
pnpm test:watch
```

### 6. Build Project

```bash
pnpm build
```

Ensure build succeeds before committing.

### 7. Commit Changes

```bash
git add .
git commit -m "feat: add your feature"
```

Use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

### 8. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Create pull request on GitHub.

## Code Style Guidelines

### TypeScript

**Use strict typing:**

```typescript
// ✅ Good
function createUser(email: string, password: string): User {
  return new User(email, password);
}

// ❌ Bad
function createUser(email: any, password: any) {
  return new User(email, password);
}
```

**Prefer interfaces for objects:**

```typescript
// ✅ Good
interface SignupInput {
  email: string;
  password: string;
}

// ❌ Bad (for DTOs)
type SignupInput = {
  email: string;
  password: string;
};
```

**Use readonly for immutability:**

```typescript
// ✅ Good
class User {
  constructor(
    public readonly id: string,
    public readonly email: Email
  ) {}
}
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `user.entity.ts`)
- **Classes**: `PascalCase` (e.g., `SignupUseCase`)
- **Interfaces**: `IPascalCase` (e.g., `IUserRepository`)
- **Functions**: `camelCase` (e.g., `buildRequestContext`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_ATTEMPTS`)

### File Organization

```
feature-name/
├── feature-name.entity.ts      # Domain entity
├── feature-name.repository.ts  # Repository interface
├── feature-name.use-case.ts    # Use case
├── feature-name.dto.ts         # DTOs
└── feature-name.test.ts        # Tests
```

### Import Order

```typescript
// 1. External imports
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// 2. Internal imports (by layer)
import { User } from "@domain/entities/user.entity";
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
import { successResponse } from "@presentation/helpers/response";

// 3. Relative imports
import { getDatabase } from "./database";
```

### Comments

**Use JSDoc for public APIs:**

```typescript
/**
 * Signs up a new user with email verification
 *
 * @param input - Signup input data
 * @returns Signup output with verification message
 * @throws ValidationError if input is invalid
 * @throws ConflictError if email already exists
 */
async execute(input: SignupInput): Promise<SignupOutput>
```

**Avoid obvious comments:**

```typescript
// ❌ Bad
// Increment counter
counter++;

// ✅ Good (when explaining why)
// Increment attempts to prevent brute force attacks
user.otp.attempts++;
```

### Error Handling

**Use domain errors:**

```typescript
// ✅ Good
throw new ValidationError("Invalid email format");

// ❌ Bad
throw new Error("Invalid email");
```

**Catch and rethrow with context:**

```typescript
try {
  await repository.save(user);
} catch (error) {
  throw new InfrastructureError("Failed to save user", { cause: error });
}
```

## Testing Strategies

### Unit Tests (Domain Layer)

Test pure business logic without dependencies:

```typescript
// user.entity.test.ts
import { User } from '@domain/entities/user.entity';
import { Email } from '@domain/value-objects/email.vo';

describe('User', () => {
  it('should increment token version', () => {
    const user = new User('id', new Email('test@example.com'), ...);
    const updated = user.incrementTokenVersion();

    expect(updated.tokenVersion.value).toBe(1);
  });
});
```

### Unit Tests (Application Layer)

Test use cases with mocked dependencies:

```typescript
// signup.use-case.test.ts
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { mock } from "jest-mock-extended";

describe("SignupUseCase", () => {
  it("should create user and send email", async () => {
    const mockUserRepo = mock<IUserRepository>();
    const mockEmailProvider = mock<IEmailProvider>();

    const useCase = new SignupUseCase(mockUserRepo, mockEmailProvider);
    await useCase.execute({
      email: "test@example.com",
      password: "Test123!@#",
    });

    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(mockEmailProvider.sendVerificationEmail).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test with real infrastructure (MongoDB, Redis):

```typescript
// signup.integration.test.ts
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
import { getTestDatabase } from "./test-helpers";

describe("SignupUseCase Integration", () => {
  let db: Db;

  beforeAll(async () => {
    db = await getTestDatabase();
  });

  afterAll(async () => {
    await db.dropDatabase();
  });

  it("should save user to database", async () => {
    const userRepo = new UserRepositoryImpl(db);
    const useCase = new SignupUseCase(userRepo, mockEmailProvider);

    await useCase.execute({
      email: "test@example.com",
      password: "Test123!@#",
    });

    const user = await userRepo.findByEmail(new Email("test@example.com"));
    expect(user).toBeDefined();
  });
});
```

### E2E Tests

Test complete API flows:

```typescript
// signup.e2e.test.ts
import { POST } from "@/app/api/auth/signup/route";

describe("POST /api/auth/signup", () => {
  it("should create user and return success", async () => {
    const request = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Test123!@#",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });
});
```

## Debugging Tips

### Enable Debug Logging

Add console.log statements in development:

```typescript
if (process.env.NODE_ENV === "development") {
  console.log("Token payload:", payload);
  console.log("Session:", session);
}
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    }
  ]
}
```

Set breakpoints and press F5 to debug.

### Inspect Database

Use MongoDB Compass or mongosh:

```bash
mongosh "mongodb+srv://..."

use portfolio
db.users.find({ email: "test@example.com" })
db.sessions.find({ userId: ObjectId("...") })
```

### Inspect Redis

Use Upstash dashboard or Redis CLI:

```bash
redis-cli -h your-instance.upstash.io -p 6379 -a your-token

# View all keys
KEYS *

# Get specific key
GET "revoke:user:123"
```

### Test Email Delivery

Check Brevo dashboard → Statistics → Email to view sent emails.

### Network Debugging

Use curl to test endpoints:

```bash
# Signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# Signin
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

## Common Tasks

### Add New Use Case

1. Define DTOs in `src/application/dtos/`
2. Create use case in `src/application/use-cases/`
3. Add validation schema in `src/presentation/validation/schemas.ts`
4. Create API route in `app/api/your-endpoint/route.ts`
5. Wire dependencies in route handler

### Add New Entity

1. Create entity in `src/domain/entities/`
2. Define repository interface in `src/domain/repositories/`
3. Create schema in `src/infrastructure/database/schemas/`
4. Implement repository in `src/infrastructure/database/`
5. Add indexes in `src/infrastructure/database/indexes.ts`

### Add New Middleware

1. Create middleware in `src/presentation/middleware/`
2. Apply in route handlers
3. Add to middleware chain in order: CORS → Rate Limit → CSRF → Auth

### Update Environment Variables

1. Add to `.env.example` with description
2. Add to `src/env.ts` for validation
3. Update documentation in `docs/infrastructure.md`

## Troubleshooting

### Build Errors

**"Module not found"**

- Check TypeScript path aliases in `tsconfig.json`
- Restart dev server
- Clear `.next` folder: `rm -rf .next`

**"Type error"**

- Run `pnpm type-check` to see all errors
- Check for missing type definitions
- Ensure strict mode compliance

### Runtime Errors

**"Invalid JWT signature"**

- Verify JWT keys match (private/public pair)
- Check key format (PEM with headers)
- Ensure no extra whitespace in env vars

**"CORS error"**

- Check `ALLOWED_ORIGINS` env var
- Verify origin in request headers
- Test with curl first (bypasses browser CORS)

**"Rate limit exceeded"**

- Clear Redis keys:check your rate limiting logic

### Performance Issues

**Slow response times**

- Check MongoDB indexes are created
- Review database query performance
- Enable connection pooling
- Consider Redis caching for frequent queries

**Memory leaks**

- Check for event listener leaks
- Review connection management
- Use Node.js memory profiling tools

---

## Summary

Development workflow:

1. Set up local environment
2. Create feature branch
3. Follow layer architecture
4. Write tests
5. Lint and type-check
6. Build successfully
7. Commit with conventional commits
8. Create pull request

Follow:

- [Architecture](architecture.md) for layer rules
- [Dependency Rules](dependency-rule.md) for import restrictions
- [Enforcement](enforcement.md) for validation details

Happy coding!
