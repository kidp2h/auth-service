export interface ILoginAttemptPort {
  /** Seconds until the caller may retry, or 0 when not locked. */
  lockedFor(email: string, ip: string): Promise<number>;
  recordFailure(email: string, ip: string): Promise<void>;
  reset(email: string): Promise<void>;
}
