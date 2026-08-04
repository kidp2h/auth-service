export interface ITokenService {
  generateToken(payload: { userId: string; email: string; jti?: string }): Promise<string>;
  verifyToken(token: string): Promise<any>;
}
