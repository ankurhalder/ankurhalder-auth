export type { UserEntity, UserRole, UserTier } from "./entities/user.entity";
export { UserMethods } from "./entities/user.entity";
export type { SessionEntity } from "./entities/session.entity";
export { SessionMethods } from "./entities/session.entity";
export type {
  AuthEventEntity,
  AuthEventType,
} from "./entities/auth-event.entity";

export { Email } from "./value-objects/email.vo";
export { HashedPassword } from "./value-objects/hashed-password.vo";
export { TokenVersion } from "./value-objects/token-version.vo";
export { SessionId } from "./value-objects/session-id.vo";
export { JTI } from "./value-objects/jti.vo";

export { DomainError } from "./errors/base.error";
export { AuthenticationError } from "./errors/authentication.error";
export { AuthorizationError } from "./errors/authorization.error";
export { ValidationError } from "./errors/validation.error";
export { ConflictError } from "./errors/conflict.error";
export { NotFoundError } from "./errors/not-found.error";
export { RateLimitError } from "./errors/rate-limit.error";
export { TokenError } from "./errors/token.error";
export type { TokenErrorReason } from "./errors/token.error";

export type { IUserRepository } from "./repositories/user.repository";
export type { ISessionRepository } from "./repositories/session.repository";
export type { IAuthEventRepository } from "./repositories/auth-event.repository";
