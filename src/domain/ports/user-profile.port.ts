export interface IUserProfilePort {
  createProfile(accountId: string, email: string, name: string): Promise<{ id: string; name: string }>;
}
