# Architecture Documentation

## Overview

This authentication service is built using **Domain-Driven Design (DDD)** with a clean 4-layer architecture. The architecture enforces strict separation of concerns, dependency rules, and layer boundaries through ESLint and TypeScript.

## Why Domain-Driven Design?

DDD was chosen for this authentication service because:

1. **Complexity Management**: Authentication systems have complex business rules (token rotation, revocation strategies, OTP verification, etc.). DDD helps manage this complexity through clear domain models.

2. **Security Requirements**: Authentication is security-critical. DDD's clear boundaries and dependency rules ensure security logic stays isolated and testable.

3. **Maintainability**: Clean architecture with explicit boundaries makes the codebase easier to understand, test, and modify over time.

4. **Testability**: Dependency injection and port/adapter pattern enable comprehensive unit testing with mocks.

5. **Technology Independence**: Domain and application layers are independent of frameworks, databases, and external services, making them portable and framework-agnostic.

6. **Team Collaboration**: Clear layer boundaries enable multiple developers to work on different layers without conflicts.

## 4-Layer Architecture

The service is organized into 4 distinct layers, each with specific responsibilities and strict dependency rules.

### Layer 1: Domain Layer (Core)

**Location:** `src/domain/`

**Purpose:** Pure business logic with zero external dependencies

**Responsibilities:**

- Define business entities with behavior
- Define value objects for domain concepts
- Define repository interfaces (ports)
- Define domain errors and business rules
- Enforce invariants and validation

**Key Characteristics:**

- **Pure TypeScript** - No framework dependencies
- **No external imports** - Cannot import from outer layers
- **No infrastructure** - No database, HTTP, or external service code
- **Testable** - Easy to unit test in isolation

**Directory Structure:**

```
src/domain/
├── entities/               # Business entities
│   ├── user.entity.ts      # User entity with business methods
│   ├── session.entity.ts   # Session entity
│   └── auth-event.entity.ts # Audit log entity
├── value-objects/          # Domain value objects
│   ├── email.vo.ts         # Email value object with validation
│   ├── hashed-password.vo.ts
│   ├── jti.vo.ts           # JWT ID value object
│   ├── session-id.vo.ts
│   └── token-version.vo.ts
├── repositories/           # Repository interfaces (ports)
│   ├── user.repository.ts
│   ├── session.repository.ts
│   └── auth-event.repository.ts
├── errors/                 # Domain-specific errors
│   ├── base.error.ts       # Base domain error
│   ├── authentication.error.ts
│   ├── authorization.error.ts
│   ├── validation.error.ts
│   ├── not-found.error.ts
│   ├── conflict.error.ts
│   ├── token.error.ts
│   └── rate-limit.error.ts
└── index.ts                # Public exports
```

**Example: User Entity**

```typescript
// Domain entity with business logic
export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly password: HashedPassword,
    public readonly role: "user" | "admin",
    public readonly isVerified: boolean,
    public readonly tokenVersion: TokenVersion
  ) {}

  // Business method
  incrementTokenVersion(): User {
    return new User(
      this.id,
      this.email,
      this.password,
      this.role,
      this.isVerified,
      this.tokenVersion.increment()
    );
  }
}
```

### Layer 2: Application Layer (Use Cases)

**Location:** `src/application/`

**Purpose:** Orchestrate business logic and coordinate domain operations

**Responsibilities:**

- Define use cases (application services)
- Define DTOs (Data Transfer Objects) for input/output
- Define port interfaces for external dependencies
- Coordinate domain entities and repositories
- Handle application-level errors

**Key Characteristics:**

- **Can import from Domain layer only**
- **Defines interfaces** - Port interfaces for infrastructure
- **No framework code** - Framework-agnostic
- **Testable** - Easy to unit test with mocks

**Directory Structure:**

```
src/application/
├── use-cases/              # Use case implementations
│   ├── signup.use-case.ts
│   ├── signin.use-case.ts
│   ├── verify-otp.use-case.ts
│   ├── refresh-token.use-case.ts
│   ├── logout.use-case.ts
│   ├── global-logout.use-case.ts
│   ├── verify-email.use-case.ts
│   ├── forgot-password.use-case.ts
│   ├── reset-password.use-case.ts
│   ├── resend-verification.use-case.ts
│   └── get-current-user.use-case.ts
├── dtos/                   # Data transfer objects
│   ├── auth.dto.ts         # Auth-related DTOs
│   └── user.dto.ts         # User-related DTOs
└── interfaces/             # Port interfaces (Hexagonal Architecture)
    ├── email.provider.ts   # Email service interface
    ├── token.service.ts    # Token service interface
    └── revocation.store.ts # Revocation store interface
```

**Example: Use Case**

```typescript
// Application use case with dependency injection
export class SignupUseCase {
  constructor(
    private readonly userRepository: IUserRepository, // Domain port
    private readonly passwordService: IPasswordService, // App port
    private readonly emailProvider: IEmailProvider, // App port
    private readonly authEventRepository: IAuthEventRepository // Domain port
  ) {}

  async execute(input: SignupInput): Promise<SignupOutput> {
    // Orchestrate domain logic
    // 1. Validate
    // 2. Check uniqueness
    // 3. Create domain entity
    // 4. Save via repository
    // 5. Send email via provider
    // 6. Log event
  }
}
```

**Example: Port Interface**

```typescript
// Application-level interface (port)
export interface IEmailProvider {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendOTPEmail(to: string, otp: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}
```

### Layer 3: Infrastructure Layer (Adapters)

**Location:** `src/infrastructure/`

**Purpose:** Implement technical details and external integrations

**Responsibilities:**

- Implement repository interfaces from domain
- Implement port interfaces from application
- Integrate with databases, external APIs, file systems
- Handle encryption, hashing, JWT operations
- Provide concrete implementations of all interfaces

**Key Characteristics:**

- **Can import from Domain and Application layers**
- **Implements interfaces** - Adapter pattern
- **Framework/library dependent** - Uses MongoDB, Redis, jose, etc.
- **Testable** - Integration tests with real infrastructure

**Directory Structure:**

```
src/infrastructure/
├── database/               # MongoDB implementations
│   ├── connection.ts       # Database connection
│   ├── indexes.ts          # Index creation
│   ├── schemas/            # MongoDB schemas
│   │   ├── user.schema.ts
│   │   ├── session.schema.ts
│   │   └── auth-event.schema.ts
│   ├── user.repository.impl.ts      # IUserRepository implementation
│   ├── session.repository.impl.ts   # ISessionRepository implementation
│   └── auth-event.repository.impl.ts
├── redis/                  # Redis implementations
│   ├── client.ts           # Redis connection
│   ├── revocation.store.impl.ts  # IRevocationStore implementation
│   ├── otp-rate-limiter.ts
│   └── simple-lru.ts       # In-memory LRU cache
├── email/                  # Email provider implementations
│   └── brevo.provider.ts   # IEmailProvider implementation (Brevo)
└── crypto/                 # Cryptographic services
    ├── hash.ts             # SHA256 hashing
    ├── password.service.ts # IPasswordService implementation
    ├── otp.service.ts      # OTP generation/encryption
    └── jwt.service.ts      # ITokenService implementation
```

**Example: Repository Implementation**

```typescript
// Infrastructure adapter implementing domain port
export class UserRepositoryImpl implements IUserRepository {
  constructor(private readonly db: Db) {}

  async save(user: User): Promise<void> {
    const userSchema = this.toSchema(user);
    await this.db.collection("users").insertOne(userSchema);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const schema = await this.db
      .collection("users")
      .findOne({ email: email.value });
    return schema ? this.toDomain(schema) : null;
  }

  // Map between domain entity and database schema
  private toSchema(user: User): UserSchema {
    /* ... */
  }
  private toDomain(schema: UserSchema): User {
    /* ... */
  }
}
```

**Example: Service Implementation**

```typescript
// Infrastructure adapter implementing application port
export class BrevoEmailProvider implements IEmailProvider {
  constructor(private readonly apiKey: string) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    // Implement using Brevo SDK
    const brevo = new TransactionalEmailsApi();
    await brevo.sendTransacEmail({
      to: [{ email: to }],
      subject: "Verify your email",
      htmlContent: this.generateVerificationHtml(token),
    });
  }
}
```

### Layer 4: Presentation Layer (API/UI)

**Location:** `src/presentation/` and `app/api/`

**Purpose:** Handle HTTP requests, responses, and user interactions

**Responsibilities:**

- Define API routes and endpoints
- Validate HTTP requests
- Call use cases with validated input
- Format HTTP responses
- Apply middleware (CORS, rate limiting, auth, CSRF)
- Set/clear cookies
- Handle HTTP-level errors

**Key Characteristics:**

- **Can import from all layers**
- **Framework-specific** - Uses Next.js App Router
- **HTTP-focused** - Request/response handling
- **Wires dependencies** - Dependency injection setup

**Directory Structure:**

```
src/presentation/
├── middleware/             # Next.js middleware
│   ├── cors.ts             # CORS validation
│   ├── csrf.ts             # CSRF protection
│   ├── rate-limit.ts       # Rate limiting
│   └── auth.ts             # JWT authentication
├── helpers/                # Request/response helpers
│   ├── request-context.ts  # Extract IP, user agent, etc.
│   ├── cookies.ts          # Set/clear auth cookies
│   └── response.ts         # Standard response formats
└── validation/
    └── schemas.ts          # Zod validation schemas

app/api/                    # Next.js API routes
├── .well-known/
│   └── jwks.json/
│       └── route.ts        # Public JWKS endpoint
├── auth/
│   ├── signup/
│   │   └── route.ts        # POST /api/auth/signup
│   ├── signin/
│   │   └── route.ts        # POST /api/auth/signin
│   ├── verify-otp/
│   │   └── route.ts        # POST /api/auth/verify-otp
│   ├── refresh/
│   │   └── route.ts        # POST /api/auth/refresh
│   ├── logout/
│   │   └── route.ts        # POST /api/auth/logout
│   ├── logout-all/
│   │   └── route.ts        # POST /api/auth/logout-all
│   ├── me/
│   │   └── route.ts        # GET /api/auth/me
│   ├── verify-email/
│   │   └── route.ts        # POST /api/auth/verify-email
│   ├── forgot-password/
│   │   └── route.ts        # POST /api/auth/forgot-password
│   ├── reset-password/
│   │   └── route.ts        # POST /api/auth/reset-password
│   └── resend-verification/
│       └── route.ts        # POST /api/auth/resend-verification
├── cron/
│   └── cleanup/
│       └── route.ts        # POST /api/cron/cleanup
└── health/
    └── route.ts            # GET /api/health
```

**Example: API Route**

```typescript
// Presentation layer - API route
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Apply middleware
    const corsResult = await corsMiddleware(request);
    if (corsResult) return corsResult;

    const rateLimitResult = await rateLimitMiddleware(request);
    if (rateLimitResult) return rateLimitResult;

    // 2. Validate request
    const body = await request.json();
    const input = SignupSchema.parse(body);

    // 3. Build request context
    const context = buildRequestContext(request);

    // 4. Wire dependencies (DI)
    const db = await getDatabase();
    const userRepo = new UserRepositoryImpl(db);
    const passwordService = new PasswordService();
    const emailProvider = new BrevoEmailProvider(env.BREVO_API_KEY);
    const authEventRepo = new AuthEventRepositoryImpl(db);

    // 5. Create and execute use case
    const useCase = new SignupUseCase(
      userRepo,
      passwordService,
      emailProvider,
      authEventRepo
    );

    const output = await useCase.execute({ ...input, context });

    // 6. Return formatted response
    return successResponse(output, 201);
  } catch (error) {
    return handleDomainError(error);
  }
}
```

## Dependency Flow

The dependency flow follows the **Dependency Inversion Principle** (DIP):

```
┌─────────────────────────────────────────────────────┐
│                 Presentation Layer                  │
│                                                     │
│  • Depends on Application (use cases)              │
│  • Depends on Infrastructure (implementations)     │
│  • Wires everything together                       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              Infrastructure Layer                   │
│                                                     │
│  • Implements Application interfaces (ports)       │
│  • Implements Domain interfaces (repositories)     │
│  • Depends on external libraries                   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                Application Layer                    │
│                                                     │
│  • Depends on Domain (entities, repos, errors)     │
│  • Defines port interfaces for Infrastructure      │
│  • Orchestrates domain logic                       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                  Domain Layer                       │
│                                                     │
│  • No dependencies on outer layers                 │
│  • Pure business logic                             │
│  • Defines repository interfaces                   │
└─────────────────────────────────────────────────────┘
```

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐          │
│  │ API Routes │  │ Middleware │  │   Helpers    │          │
│  │            │  │            │  │              │          │
│  │ - signup   │  │ - CORS     │  │ - cookies    │          │
│  │ - signin   │  │ - CSRF     │  │ - response   │          │
│  │ - refresh  │  │ - rateLimit│  │ - context    │          │
│  │ - logout   │  │ - auth     │  │ - validation │          │
│  └────────────┘  └────────────┘  └──────────────┘          │
│                                                              │
└────────────────────────┬─────────────────────────────────────┘
                         │ uses
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Database  │  │   Redis    │  │   Email    │            │
│  │            │  │            │  │            │            │
│  │ - UserRepo │  │ - Revoke   │  │ - Brevo    │            │
│  │ - SessionR │  │ - RateLimit│  │            │            │
│  │ - EventRepo│  │ - LRU      │  │            │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌────────────┐                                             │
│  │   Crypto   │                                             │
│  │            │                                             │
│  │ - JWT      │                                             │
│  │ - Password │                                             │
│  │ - OTP      │                                             │
│  │ - Hash     │                                             │
│  └────────────┘                                             │
│                                                              │
└────────────────────────┬─────────────────────────────────────┘
                         │ implements
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│                                                              │
│  ┌────────────────────────────────────────────┐             │
│  │             Use Cases                      │             │
│  │                                            │             │
│  │  - SignupUseCase                          │             │
│  │  - SigninUseCase                          │             │
│  │  - VerifyOtpUseCase                       │             │
│  │  - RefreshTokenUseCase                    │             │
│  │  - LogoutUseCase                          │             │
│  │  - GlobalLogoutUseCase                    │             │
│  │  - VerifyEmailUseCase                     │             │
│  │  - ForgotPasswordUseCase                  │             │
│  │  - ResetPasswordUseCase                   │             │
│  │  - GetCurrentUserUseCase                  │             │
│  │  - ResendVerificationUseCase              │             │
│  └────────────────────────────────────────────┘             │
│                                                              │
│  ┌──────────────┐     ┌──────────────────┐                 │
│  │     DTOs     │     │  Port Interfaces │                 │
│  │              │     │                  │                 │
│  │ - SignupI/O  │     │ - IEmailProvider │                 │
│  │ - SigninI/O  │     │ - ITokenService  │                 │
│  │ - RefreshI/O │     │ - IRevocationStore│                │
│  └──────────────┘     └──────────────────┘                 │
│                                                              │
└────────────────────────┬─────────────────────────────────────┘
                         │ orchestrates
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Entities  │  │Value Objects│ │ Repositories│            │
│  │            │  │            │  │  (Interfaces)│            │
│  │ - User     │  │ - Email    │  │              │            │
│  │ - Session  │  │ - Password │  │ - IUserRepo  │            │
│  │ - AuthEvent│  │ - Jti      │  │ - ISessionR  │            │
│  │            │  │ - SessionId│  │ - IAuthEventR│            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌────────────────────────────────────────────┐             │
│  │              Domain Errors                 │             │
│  │                                            │             │
│  │  - AuthenticationError                    │             │
│  │  - AuthorizationError                     │             │
│  │  - ValidationError                        │             │
│  │  - NotFoundError                          │             │
│  │  - ConflictError                          │             │
│  │  - TokenError                             │             │
│  │  - RateLimitError                         │             │
│  └────────────────────────────────────────────┘             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Benefits of This Architecture

### 1. Testability

Each layer can be tested in isolation:

```typescript
// Test domain entity (no mocks needed)
describe('User', () => {
  it('should increment token version', () => {
    const user = new User(...);
    const updated = user.incrementTokenVersion();
    expect(updated.tokenVersion.value).toBe(1);
  });
});

// Test use case (mock repositories)
describe('SignupUseCase', () => {
  it('should create user and send email', async () => {
    const mockUserRepo = createMock<IUserRepository>();
    const mockEmailProvider = createMock<IEmailProvider>();

    const useCase = new SignupUseCase(mockUserRepo, mockEmailProvider);
    await useCase.execute(input);

    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(mockEmailProvider.sendVerificationEmail).toHaveBeenCalled();
  });
});
```

### 2. Maintainability

Clear boundaries make it easy to:

- Understand where code belongs
- Find specific functionality
- Modify without breaking other layers
- Onboard new developers

### 3. Technology Independence

Easily swap implementations:

```typescript
// Switch from Brevo to SendGrid
class SendGridEmailProvider implements IEmailProvider {
  // Same interface, different implementation
}

// Switch from MongoDB to PostgreSQL
class PostgresUserRepository implements IUserRepository {
  // Same interface, different database
}
```

### 4. Security Isolation

Security-critical code is isolated in domain/application layers and thoroughly tested without infrastructure dependencies.

### 5. Framework Agnosticism

Domain and application layers don't depend on Next.js, making them reusable in other contexts (CLI tools, background workers, different frameworks).

## Best Practices

### 1. Keep Domain Pure

```typescript
// ✅ Good - Pure domain entity
export class User {
  incrementTokenVersion(): User {
    return new User(/* ... */);
  }
}

// ❌ Bad - Domain depends on infrastructure
import { MongoDB } from "mongodb";
export class User {
  async save() {
    await MongoDB.save(this); // NO!
  }
}
```

### 2. Use Dependency Injection

```typescript
// ✅ Good - Dependencies injected
class SignupUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailProvider: IEmailProvider
  ) {}
}

// ❌ Bad - Hard-coded dependencies
class SignupUseCase {
  execute() {
    const repo = new UserRepositoryImpl(); // NO!
  }
}
```

### 3. Define Interfaces in Inner Layers

```typescript
// ✅ Good - Interface in application layer
// src/application/interfaces/email.provider.ts
export interface IEmailProvider {
  sendVerificationEmail(to: string, token: string): Promise<void>;
}

// Implementation in infrastructure layer
// src/infrastructure/email/brevo.provider.ts
export class BrevoEmailProvider implements IEmailProvider {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    // Implementation
  }
}
```

### 4. DTOs for Layer Communication

```typescript
// ✅ Good - Use DTOs
interface SignupInput {
  email: string;
  password: string;
}

// ❌ Bad - Expose domain entities
function signup(user: User) {
  // NO!
  // Domain entity should not cross layer boundaries
}
```

### 5. Map Between Layers

```typescript
// ✅ Good - Map between domain and persistence
class UserRepositoryImpl {
  async save(user: User): Promise<void> {
    const schema = this.toSchema(user); // Map to DB schema
    await this.db.collection("users").insertOne(schema);
  }

  private toSchema(user: User): UserSchema {
    return {
      _id: new ObjectId(user.id),
      email: user.email.value,
      // ... map all fields
    };
  }
}
```

## Summary

This authentication service uses a clean 4-layer DDD architecture:

1. **Domain Layer**: Pure business logic, zero dependencies
2. **Application Layer**: Use cases, DTOs, port interfaces
3. **Infrastructure Layer**: Database, Redis, email, crypto implementations
4. **Presentation Layer**: API routes, middleware, HTTP handling

The architecture enforces:

- **Strict dependency rules** (enforced by ESLint)
- **Dependency inversion** (outer layers depend on inner interfaces)
- **Testability** (each layer testable in isolation)
- **Maintainability** (clear boundaries and responsibilities)
- **Technology independence** (core logic framework-agnostic)

For more details, see:

- [Dependency Rules](dependency-rule.md)
- [Enforcement](enforcement.md)
- [Development Guide](development.md)
