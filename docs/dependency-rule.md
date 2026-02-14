# Dependency Rules

This document defines the strict layer dependency rules enforced in the authentication service's Domain-Driven Design (DDD) architecture.

## Overview

The authentication service uses a 4-layer DDD architecture with **unidirectional dependencies**:

```
Domain ← Application ← Infrastructure ← Presentation
```

Arrows indicate dependency direction: outer layers depend on inner layers, never the reverse.

## The Dependency Rule

> **Source code dependencies must point only inwards, toward higher-level policies.**

This is the **Dependency Inversion Principle** (DIP) from SOLID principles.

### What This Means

- **Inner layers** define interfaces (abstractions)
- **Outer layers** implement those interfaces (concretions)
- **Dependencies flow inward** (outer depends on inner)
- **Data flow can be bidirectional** (via interfaces)

## Layer-by-Layer Rules

### Domain Layer (Core)

**Location:** `src/domain/`

**Can import from:**

- ✅ **Nothing** - Domain layer has zero dependencies

**Cannot import from:**

- ❌ Application layer (`src/application/`)
- ❌ Infrastructure layer (`src/infrastructure/`)
- ❌ Presentation layer (`src/presentation/`)
- ❌ External frameworks (Next.js, MongoDB, Redis, etc.)
- ❌ Node.js-specific modules (except pure TypeScript types)

**Examples:**

```typescript
// ✅ GOOD - Pure domain entity
export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly password: HashedPassword
  ) {}
}

// ✅ GOOD - Domain repository interface
export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}

// ❌ BAD - Importing from outer layer
import { SignupUseCase } from "@app/use-cases/signup.use-case"; // NO!

// ❌ BAD - Importing framework
import { NextRequest } from "next/server"; // NO!

// ❌ BAD - Importing infrastructure
import { MongoClient } from "mongodb"; // NO!
```

**Why?**

- Domain contains pure business logic
- Must be framework-agnostic
- Easily testable without infrastructure
- Portable across different applications

### Application Layer

**Location:** `src/application/`

**Can import from:**

- ✅ Domain layer (`@domain/*`)
  - Entities
  - Value objects
  - Repository interfaces
  - Domain errors

**Cannot import from:**

- ❌ Infrastructure layer (`src/infrastructure/`)
- ❌ Presentation layer (`src/presentation/`)
- ❌ External frameworks (Next.js, MongoDB, etc.)
- Can define port interfaces for infrastructure

**Examples:**

```typescript
// ✅ GOOD - Use case importing domain
import { User } from "@domain/entities/user.entity";
import { IUserRepository } from "@domain/repositories/user.repository";
import { ValidationError } from "@domain/errors/validation.error";

export class SignupUseCase {
  constructor(
    private readonly userRepository: IUserRepository // Domain interface
  ) {}
}

// ✅ GOOD - Defining port interface
export interface IEmailProvider {
  sendVerificationEmail(to: string, token: string): Promise<void>;
}

// ❌ BAD - Importing infrastructure
import { UserRepositoryImpl } from "@infra/database/user.repository.impl"; // NO!

// ❌ BAD - Importing presentation
import { successResponse } from "@presentation/helpers/response"; // NO!

// ❌ BAD - Importing framework
import { MongoClient } from "mongodb"; // NO!
```

**Why?**

- Application orchestrates domain logic
- Defines contracts (interfaces) for infrastructure
- Still framework-agnostic
- Testable with mocks

### Infrastructure Layer

**Location:** `src/infrastructure/`

**Can import from:**

- ✅ Domain layer (`@domain/*`)
- ✅ Application layer (`@app/*`)
  - Port interfaces to implement
- ✅ External libraries (MongoDB, Redis, jose, bcrypt, etc.)
- ✅ Node.js modules (crypto, fs, etc.)

**Cannot import from:**

- ❌ Presentation layer (`src/presentation/`)

**Examples:**

```typescript
// ✅ GOOD - Implementing domain interface
import { IUserRepository } from "@domain/repositories/user.repository";
import { User } from "@domain/entities/user.entity";
import { Db } from "mongodb";

export class UserRepositoryImpl implements IUserRepository {
  constructor(private readonly db: Db) {}

  async save(user: User): Promise<void> {
    // Implementation using MongoDB
  }
}

// ✅ GOOD - Implementing application interface
import { IEmailProvider } from "@app/interfaces/email.provider";
import * as brevo from "@getbrevo/brevo";

export class BrevoEmailProvider implements IEmailProvider {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    // Implementation using Brevo
  }
}

// ❌ BAD - Importing presentation
import { buildRequestContext } from "@presentation/helpers/request-context"; // NO!
```

**Why?**

- Infrastructure implements technical details
- Adapters for external services
- Still isolated from presentation concerns
- Can be swapped without changing domain/application

### Presentation Layer

**Location:** `src/presentation/` and `app/api/`

**Can import from:**

- ✅ Domain layer (`@domain/*`)
- ✅ Application layer (`@app/*`)
- ✅ Infrastructure layer (`@infra/*`)
- ✅ Frameworks (Next.js)
- ✅ Everything

**Cannot import from:**

- Nothing - Presentation is the outermost layer

**Examples:**

```typescript
// ✅ GOOD - Importing from all layers
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
import { BrevoEmailProvider } from "@infra/email/brevo.provider";
import { ValidationError } from "@domain/errors/validation.error";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Wire dependencies
  const db = await getDatabase();
  const userRepo = new UserRepositoryImpl(db);
  const emailProvider = new BrevoEmailProvider(apiKey);

  // Create and execute use case
  const useCase = new SignupUseCase(userRepo, emailProvider);
  const result = await useCase.execute(input);

  return NextResponse.json(result);
}
```

**Why?**

- Presentation coordinates everything
- Wires dependencies together (DI)
- Framework-specific (Next.js)
- User-facing layer

## Enforcement Mechanisms

### 1. ESLint Rules

Configured in `eslint.config.mjs`:

```javascript
// Domain layer restrictions
{
  files: ["src/domain/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@app/*", "@infra/*", "@presentation/*"],
            message: "Domain layer must not import from Application, Infrastructure, or Presentation."
          },
          {
            group: ["next/*", "mongodb", "@upstash/*", "@getbrevo/*"],
            message: "Domain layer must not depend on framework or infrastructure packages."
          }
        ]
      }
    ]
  }
}

// Application layer restrictions
{
  files: ["src/application/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@infra/*", "@presentation/*"],
            message: "Application layer must not import from Infrastructure or Presentation."
          },
          {
            group: ["next/*", "mongodb", "@upstash/*"],
            message: "Application layer must not depend on framework or infrastructure packages directly."
          }
        ]
      }
    ]
  }
}

// Infrastructure layer restrictions
{
  files: ["src/infrastructure/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@presentation/*"],
            message: "Infrastructure layer must not import from Presentation."
          }
        ]
      }
    ]
  }
}
```

**How It Works:**

- ESLint scans all files during `pnpm lint`
- Import patterns are matched against restrictions
- Build fails if violations detected
- Clear error messages guide developers

### 2. TypeScript Path Aliases

Configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@app/*": ["src/application/*"],
      "@infra/*": ["src/infrastructure/*"],
      "@presentation/*": ["src/presentation/*"]
    }
  }
}
```

**Benefits:**

- Clear layer identification in imports
- Easy to spot violations
- Refactoring-friendly
- Self-documenting code

### 3. Pre-commit Hooks

The pre-commit script validates architectural boundaries:

```javascript
// scripts/pre-commit.js
async function validateArchitecturalBoundaries() {
  const violations = [];

  // Check domain files
  const domainFiles = glob.sync("src/domain/**/*.ts");
  for (const file of domainFiles) {
    const content = fs.readFileSync(file, "utf8");

    // Domain cannot import from outer layers
    if (/@app\/|@infra\/|@presentation\//.test(content)) {
      violations.push({
        file,
        message: "Domain imports from outer layer",
      });
    }
  }

  // ... similar checks for other layers

  if (violations.length > 0) {
    throw new Error("Architectural boundary violations detected");
  }
}
```

## Common Violations and Solutions

### Violation 1: Domain Importing from Application

```typescript
// ❌ WRONG
// src/domain/entities/user.entity.ts
import { SignupInput } from '@app/dtos/auth.dto';

// ✅ SOLUTION
// Move shared types to domain layer or use primitive types
constructor(email: string, password: string) {}
```

### Violation 2: Application Importing from Infrastructure

```typescript
// ❌ WRONG
// src/application/use-cases/signup.use-case.ts
import { UserRepositoryImpl } from '@infra/database/user.repository.impl';

// ✅ SOLUTION
// Use domain interface, inject implementation from presentation
import { IUserRepository } from '@domain/repositories/user.repository';

constructor(private readonly userRepository: IUserRepository) {}
```

### Violation 3: Domain Using Framework

```typescript
// ❌ WRONG
// src/domain/entities/user.entity.ts
import { ObjectId } from 'mongodb';

// ✅ SOLUTION
// Use primitive string type, convert in infrastructure layer
constructor(public readonly id: string) {}
```

### Violation 4: Application Using Concrete Infrastructure

```typescript
// ❌ WRONG
// src/application/use-cases/signup.use-case.ts
import { BrevoEmailProvider } from '@infra/email/brevo.provider';

// ✅ SOLUTION
// Define interface in application, inject implementation
// src/application/interfaces/email.provider.ts
export interface IEmailProvider {
  sendEmail(to: string, subject: string): Promise<void>;
}

// Use interface in use case
constructor(private readonly emailProvider: IEmailProvider) {}
```

## Dependency Inversion in Practice

### Problem: How does Application call Infrastructure?

Application layer needs email service, but can't import from Infrastructure layer.

**Solution: Port and Adapter Pattern (Hexagonal Architecture)**

**Step 1: Application defines interface (Port)**

```typescript
// src/application/interfaces/email.provider.ts
export interface IEmailProvider {
  sendVerificationEmail(to: string, token: string): Promise<void>;
}
```

**Step 2: Infrastructure implements interface (Adapter)**

```typescript
// src/infrastructure/email/brevo.provider.ts
import { IEmailProvider } from "@app/interfaces/email.provider";

export class BrevoEmailProvider implements IEmailProvider {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    // Brevo implementation
  }
}
```

**Step 3: Application uses interface**

```typescript
// src/application/use-cases/signup.use-case.ts
import { IEmailProvider } from "@app/interfaces/email.provider";

export class SignupUseCase {
  constructor(private readonly emailProvider: IEmailProvider) {}

  async execute(input: SignupInput) {
    await this.emailProvider.sendVerificationEmail(user.email, token);
  }
}
```

**Step 4: Presentation wires concrete implementation**

```typescript
// app/api/auth/signup/route.ts
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { BrevoEmailProvider } from "@infra/email/brevo.provider";

const emailProvider = new BrevoEmailProvider(apiKey);
const useCase = new SignupUseCase(userRepo, emailProvider);
```

**Result:**

- Application depends on interface (abstraction)
- Infrastructure depends on interface (implements it)
- Presentation wires everything together
- **Dependencies point inward** ✓

## Benefits of Strict Dependency Rules

### 1. Testability

```typescript
// Easy to test with mocks
const mockEmailProvider: IEmailProvider = {
  sendVerificationEmail: jest.fn(),
};

const useCase = new SignupUseCase(mockUserRepo, mockEmailProvider);
```

### 2. Flexibility

```typescript
// Easy to swap implementations
const emailProvider =
  process.env.EMAIL_PROVIDER === "sendgrid"
    ? new SendGridEmailProvider()
    : new BrevoEmailProvider();
```

### 3. Portability

```typescript
// Domain and application layers can be reused in:
// - Different frameworks (Express, Fastify, etc.)
// - CLI tools
// - Background workers
// - Microservices
```

### 4. Maintainability

- Clear boundaries prevent "big ball of mud"
- Easy to locate where logic belongs
- Changes in outer layers don't affect inner layers
- Violations caught early (build time, not runtime)

## Summary

**Dependency Rules:**

- ✅ Domain: No dependencies
- ✅ Application: Depends on Domain only
- ✅ Infrastructure: Depends on Domain + Application
- ✅ Presentation: Depends on all layers

**Enforcement:**

- ESLint rules (automatic checking)
- TypeScript path aliases (clear imports)
- Pre-commit hooks (prevent violations)
- Code reviews (team awareness)

**Key Principle:**

> Dependencies point inward. Data flows in both directions (via interfaces).

For implementation details, see:

- [Architecture](architecture.md)
- [Enforcement](enforcement.md)
- [Development Guide](development.md)
