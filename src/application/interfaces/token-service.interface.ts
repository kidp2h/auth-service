export interface TokenPayload {
  sub: string;
  userId: string; // kept for existing consumers; same value as sub
  email: string;
  jti?: string;
}

export interface ITokenService {
  generateToken(payload: TokenPayload): Promise<string>;
  verifyToken(token: string): Promise<any>;
}
