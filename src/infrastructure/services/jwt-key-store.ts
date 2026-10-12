import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPrivateKey, createPublicKey } from 'crypto';

export type JwtMode = 'rs256' | 'hs256';

interface PublicKeyEntry {
  kid: string;
  pem: string;
  jwk: Record<string, unknown>;
}

/**
 * Holds the signing key and the public keys that may verify tokens.
 *
 * RS256 (JWT_PRIVATE_KEY): other services verify tokens locally using the
 * public keys served at /auth/.well-known/jwks.json, so auth is not on their
 * request path. Rotation: deploy the new JWT_PRIVATE_KEY and keep the old
 * public key in JWT_PREVIOUS_PUBLIC_KEY until the old tokens expire.
 *
 * HS256 (JWT_SECRET) is the deprecated fallback kept so this release can be
 * deployed before the new secret is sealed. It cannot be published via JWKS.
 */
@Injectable()
export class JwtKeyStore {
  private readonly logger = new Logger(JwtKeyStore.name);
  readonly mode: JwtMode;
  readonly signingKey: string;
  readonly signingKid?: string;
  private readonly publicKeys = new Map<string, PublicKeyEntry>();

  constructor(config: ConfigService) {
    const privatePem = this.pem(config.get<string>('JWT_PRIVATE_KEY'));
    if (privatePem) {
      this.mode = 'rs256';
      this.signingKey = privatePem;
      const publicKey = createPublicKey(createPrivateKey(privatePem));
      const current = this.entry(publicKey);
      this.signingKid = config.get<string>('JWT_KEY_ID') || current.kid;
      this.publicKeys.set(this.signingKid, {
        ...current,
        kid: this.signingKid,
      });

      const previous = this.pem(config.get<string>('JWT_PREVIOUS_PUBLIC_KEY'));
      if (previous) {
        const entry = this.entry(createPublicKey(previous));
        this.publicKeys.set(entry.kid, entry);
      }
    } else {
      this.mode = 'hs256';
      this.signingKey = config.get<string>('JWT_SECRET')!;
      this.logger.warn(
        'JWT_PRIVATE_KEY is not set: signing with the deprecated shared secret (HS256). Other services cannot verify tokens locally.',
      );
    }
  }

  publicKeyFor(kid?: string): string | undefined {
    if (this.mode === 'hs256') {
      return this.signingKey;
    }
    return kid ? this.publicKeys.get(kid)?.pem : undefined;
  }

  jwks(): { keys: Record<string, unknown>[] } {
    return {
      keys: [...this.publicKeys.values()].map((k) => ({
        ...k.jwk,
        kid: k.kid,
        use: 'sig',
        alg: 'RS256',
      })),
    };
  }

  private entry(publicKey: ReturnType<typeof createPublicKey>): PublicKeyEntry {
    const der = publicKey.export({ type: 'spki', format: 'der' });
    return {
      kid: createHash('sha256').update(der).digest('hex').slice(0, 16),
      pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      jwk: publicKey.export({ format: 'jwk' }),
    };
  }

  // PEMs often arrive through env vars or sealed secrets with escaped newlines.
  private pem(value?: string): string | undefined {
    return value ? value.replace(/\\n/g, '\n').trim() : undefined;
  }
}
