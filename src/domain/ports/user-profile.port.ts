export interface IUserProfilePort {
  /** Idempotent on the profile side (keyed by accountId), so it is safe to retry. */
  createProfile(accountId: string, email: string, name: string): Promise<void>;
}
