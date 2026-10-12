export const ACCOUNT_PORT = 'ACCOUNT_PORT';
export const SESSION_PORT = 'SESSION_PORT';
export const HASH_SERVICE = 'HASH_SERVICE';
export const TOKEN_SERVICE = 'TOKEN_SERVICE';
export const USER_PROFILE_PORT = 'USER_PROFILE_PORT';
export const REFRESH_TOKEN_PORT = 'REFRESH_TOKEN_PORT';
export const LOGIN_ATTEMPT_PORT = 'LOGIN_ATTEMPT_PORT';
export const AUTH_CONFIG = 'AUTH_CONFIG';

export interface AuthConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  /** grpc: call profile synchronously. event: publish account.created via outbox. */
  profileSyncMode: 'grpc' | 'event';
  maxFailuresPerEmail: number;
  maxFailuresPerIp: number;
  lockSeconds: number;
}
