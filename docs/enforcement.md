# Enforcement Documentation

This document explains how architectural boundaries and code quality standards are enforced in the authentication service.

## Overview

The authentication service uses multiple enforcement mechanisms to maintain code quality, architectural integrity, and prevent violations:

1. **ESLint** - Layer boundary enforcement
2. **TypeScript Strict Mode** - Type safety
3. **Import Restrictions** - Prevent circular dependencies
4. **Pre-commit Hooks** - Automatic validation before commits

## ESLint Layer Boundary Rules

### Configuration

Located in `eslint.config.mjs`:

```javascript
import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Layer boundary enforcement
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@app/*", "@infra/*", "@presentation/*"],
              message:
                "Domain layer must not import from Application, Infrastructure, or Presentation.",
            },
            {
              group: ["next/*", "mongodb", "@upstash/*", "@getbrevo/*"],
              message:
                "Domain layer must not depend on framework or infrastructure packages.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@infra/*", "@presentation/*"],
              message:
                "Application layer must not import from Infrastructure or Presentation.",
            },
            {
              group: ["next/*", "mongodb", "@upstash/*"],
              message:
                "Application layer must not depend on framework or infrastructure packages directly.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@presentation/*"],
              message:
                "Infrastructure layer must not import from Presentation.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
```

### How It Works

1. **File Pattern Matching**
   - ESLint scans files matching patterns (e.g., `src/domain/**/*.ts`)
   - Applies specific rules to each layer

2. **Import Pattern Detection**
   - Checks all import statements against restricted patterns
   - Matches against both path aliases (`@app/*`) and package names (`mongodb`)

3. **Error Reporting**
   - Violations reported with clear error messages
   - Build fails if violations detected
   - Provides actionable guidance

### Example Violations

**Domain Layer Violation:**

```typescript
// src/domain/entities/user.entity.ts
import { SignupUseCase } from "@app/use-cases/signup.use-case";
//     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// Error: Domain layer must not import from Application, Infrastructure, or Presentation.
```

**Application Layer Violation:**

```typescript
// src/application/use-cases/signup.use-case.ts
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
//       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// Error: Application layer must not import from Infrastructure or Presentation.
```

**Infrastructure Layer Violation:**

```typescript
// src/infrastructure/database/user.repository.impl.ts
import { successResponse } from "@presentation/helpers/response";
//       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// Error: Infrastructure layer must not import from Presentation.
```

### Running ESLint

**Check for violations:**

```bash
pnpm lint
```

**Auto-fix violations:**

```bash
pnpm lint --fix
```

Note: Layer violations cannot be auto-fixed.

**Check specific file:**

```bash
pnpm lint src/domain/entities/user.entity.ts
```

## TypeScript Strict Mode

### Configuration

Located in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": false
  }
}
```

### Strict Mode Features

**1. No Implicit Any**

```typescript
// ❌ Error: Parameter 'user' implicitly has an 'any' type
function processUser(user) {
  return user.email;
}

// ✅ Fixed
function processUser(user: User) {
  return user.email;
}
```

**2. Strict Null Checks**

```typescript
// ❌ Error: Object is possibly 'null'
const user = await userRepository.findById(id);
console.log(user.email);

// ✅ Fixed
const user = await userRepository.findById(id);
if (user) {
  console.log(user.email);
}
```

**3. No Unchecked Indexed Access**

```typescript
// ❌ Error: Element implicitly has an 'any' type
const users: User[] = [];
const firstUser = users[0];
firstUser.email; // Might be undefined!

// ✅ Fixed
const firstUser = users[0];
if (firstUser) {
  console.log(firstUser.email);
}
```

**4. No Implicit Returns**

```typescript
// ❌ Error: Not all code paths return a value
function getUserRole(user: User): string {
  if (user.role === "admin") {
    return "Administrator";
  }
  // Missing return!
}

// ✅ Fixed
function getUserRole(user: User): string {
  if (user.role === "admin") {
    return "Administrator";
  }
  return "User";
}
```

**5. Force Consistent Casing**

```typescript
// ❌ Error on Windows/Mac: Import casing mismatch
import { User } from "./User.entity"; // File: user.entity.ts

// ✅ Fixed
import { User } from "./user.entity";
```

### Running Type Check

**Check all files:**

```bash
pnpm type-check
```

**Watch mode:**

```bash
pnpm type-check --watch
```

**Build (includes type checking):**

```bash
pnpm build
```

## Import Restrictions per Layer

### Domain Layer Restrictions

**Allowed Imports:**

- ✅ Pure TypeScript types
- ✅ Other domain files
- ✅ Standard library (minimal)

**Blocked Imports:**

- ❌ `@app/*` (Application layer)
- ❌ `@infra/*` (Infrastructure layer)
- ❌ `@presentation/*` (Presentation layer)
- ❌ `next/*` (Next.js framework)
- ❌ `mongodb` (Database driver)
- ❌ `@upstash/*` (Redis client)
- ❌ `@getbrevo/*` (Email service)
- ❌ `bcrypt` (Crypto library)
- ❌ `jose` (JWT library)

**Example:**

```typescript
// src/domain/entities/user.entity.ts

// ✅ Allowed
import { Email } from "@domain/value-objects/email.vo";
import { HashedPassword } from "@domain/value-objects/hashed-password.vo";

// ❌ Blocked
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { MongoClient } from "mongodb";
import { NextRequest } from "next/server";
```

### Application Layer Restrictions

**Allowed Imports:**

- ✅ `@domain/*` (Domain layer)
- ✅ Pure TypeScript types
- ✅ Zod (for DTOs)

**Blocked Imports:**

- ❌ `@infra/*` (Infrastructure layer)
- ❌ `@presentation/*` (Presentation layer)
- ❌ `next/*` (Framework)
- ❌ `mongodb` (Database)
- ❌ `@upstash/*` (Redis)

**Example:**

```typescript
// src/application/use-cases/signup.use-case.ts

// ✅ Allowed
import { User } from "@domain/entities/user.entity";
import { IUserRepository } from "@domain/repositories/user.repository";
import { ValidationError } from "@domain/errors/validation.error";

// ❌ Blocked
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
import { successResponse } from "@presentation/helpers/response";
import { NextRequest } from "next/server";
```

### Infrastructure Layer Restrictions

**Allowed Imports:**

- ✅ `@domain/*` (Domain layer)
- ✅ `@app/*` (Application layer)
- ✅ External libraries (mongodb, redis, etc.)
- ✅ Node.js modules

**Blocked Imports:**

- ❌ `@presentation/*` (Presentation layer)

**Example:**

```typescript
// src/infrastructure/database/user.repository.impl.ts

// ✅ Allowed
import { User } from "@domain/entities/user.entity";
import { IUserRepository } from "@domain/repositories/user.repository";
import { Db, Collection } from "mongodb";
import * as crypto from "node:crypto";

// ❌ Blocked
import { buildRequestContext } from "@presentation/helpers/request-context";
```

### Presentation Layer Restrictions

**Allowed Imports:**

- ✅ All layers (`@domain/*`, `@app/*`, `@infra/*`)
- ✅ Next.js framework
- ✅ Libraries

**Blocked Imports:**

- None (outermost layer)

**Example:**

```typescript
// app/api/auth/signup/route.ts

// ✅ All allowed
import { SignupUseCase } from "@app/use-cases/signup.use-case";
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
import { ValidationError } from "@domain/errors/validation.error";
import { NextRequest, NextResponse } from "next/server";
```

## Pre-commit Validation

### Validation Steps

The pre-commit hook runs these checks:

```javascript
// scripts/pre-commit.js

async function preCommit() {
  console.log("🔍 Pre-commit validation started...\n");

  // 1. Remove comments
  await removeComments();

  // 2. Format code
  await formatCode();

  // 3. Lint code
  await lintCode();

  // 4. Type check
  await typeCheck();

  // 5. Build project
  await buildProject();

  // 6. Validate architectural boundaries
  await validateArchitecturalBoundaries();

  console.log("\n✅ Pre-commit validation passed!");
}
```

### Architectural Boundary Validation

```javascript
async function validateArchitecturalBoundaries() {
  console.log("🏗️  Validating architectural boundaries...");

  const violations = [];

  // Check Domain layer
  const domainFiles = glob.sync("src/domain/**/*.ts");
  for (const file of domainFiles) {
    const content = fs.readFileSync(file, "utf8");

    // Domain cannot import from outer layers
    const outerLayerImports = content.match(/@app\/|@infra\/|@presentation\//g);
    if (outerLayerImports) {
      violations.push({
        file,
        type: "domain-import-violation",
        message: `Domain layer imports from outer layer: ${outerLayerImports.join(", ")}`,
      });
    }

    // Domain cannot import frameworks
    const frameworkImports = content.match(
      /from ['"](?:next\/|mongodb|@upstash\/|@getbrevo\/)/g
    );
    if (frameworkImports) {
      violations.push({
        file,
        type: "domain-framework-violation",
        message: `Domain layer imports framework: ${frameworkImports.join(", ")}`,
      });
    }
  }

  // Check Application layer
  const appFiles = glob.sync("src/application/**/*.ts");
  for (const file of appFiles) {
    const content = fs.readFileSync(file, "utf8");

    // Application cannot import from Infrastructure or Presentation
    const restrictedImports = content.match(/@infra\/|@presentation\//g);
    if (restrictedImports) {
      violations.push({
        file,
        type: "application-import-violation",
        message: `Application layer imports from restricted layer: ${restrictedImports.join(", ")}`,
      });
    }
  }

  // Check Infrastructure layer
  const infraFiles = glob.sync("src/infrastructure/**/*.ts");
  for (const file of infraFiles) {
    const content = fs.readFileSync(file, "utf8");

    // Infrastructure cannot import from Presentation
    const presentationImports = content.match(/@presentation\//g);
    if (presentationImports) {
      violations.push({
        file,
        type: "infrastructure-import-violation",
        message: "Infrastructure layer imports from Presentation layer",
      });
    }
  }

  if (violations.length > 0) {
    console.error("\n❌ Architectural boundary violations detected:\n");
    violations.forEach((v) => {
      console.error(`  ${v.file}`);
      console.error(`    ${v.message}\n`);
    });
    throw new Error(`Found ${violations.length} architectural violations`);
  }

  console.log("   ✓ No architectural boundary violations");
}
```

### Setup Pre-commit Hook

**Install husky:**

```bash
pnpm add -D husky
npx husky install
```

**Add pre-commit hook:**

```bash
npx husky add .husky/pre-commit "node scripts/pre-commit.js"
```

**Test pre-commit:**

```bash
git add .
git commit -m "test: verify pre-commit hook"
```

## Common Violations and How to Avoid Them

### Violation 1: Importing Use Case in Domain

```typescript
// ❌ WRONG
// src/domain/entities/user.entity.ts
import { SignupUseCase } from "@app/use-cases/signup.use-case";
```

**Fix:**

- Remove the import
- Domain entities should not know about use cases
- Move shared logic to domain services if needed

### Violation 2: Importing Repository Implementation in Application

```typescript
// ❌ WRONG
// src/application/use-cases/signup.use-case.ts
import { UserRepositoryImpl } from "@infra/database/user.repository.impl";
```

**Fix:**

- Import interface instead: `import { IUserRepository } from '@domain/repositories/user.repository';`
- Inject implementation from presentation layer
- Use dependency injection pattern

### Violation 3: Using MongoDB Types in Domain

```typescript
// ❌ WRONG
// src/domain/entities/user.entity.ts
import { ObjectId } from "mongodb";

export class User {
  constructor(public readonly _id: ObjectId) {}
}
```

**Fix:**

- Use primitive types in domain: `constructor(public readonly id: string) {}`
- Convert in infrastructure layer mapper
- Keep domain pure and framework-agnostic

### Violation 4: Direct Framework Usage in Application

```typescript
// ❌ WRONG
// src/application/use-cases/signup.use-case.ts
import { NextRequest } from "next/server";

class SignupUseCase {
  async execute(request: NextRequest) {}
}
```

**Fix:**

- Define DTOs in application layer
- Extract data in presentation layer
- Pass plain objects to use cases

## Summary

The authentication service enforces:

1. **ESLint Rules**: Prevent layer violations at lint time
2. **TypeScript Strict Mode**: Ensure type safety
3. **Import Restrictions**: Block framework dependencies in core layers
4. **Pre-commit Hooks**: Validate before every commit

**Benefits:**

- Catches violations early (development time)
- Prevents architectural drift
- Ensures maintainable codebase
- Enables confident refactoring

**Commands:**

```bash
pnpm lint              # Check ESLint rules
pnpm type-check        # Check TypeScript types
pnpm build             # Full build with all checks
git commit             # Triggers pre-commit validation
```

For more details, see:

- [Architecture](architecture.md)
- [Dependency Rules](dependency-rule.md)
- [Development Guide](development.md)
