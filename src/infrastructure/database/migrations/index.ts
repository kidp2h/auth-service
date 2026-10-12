import { BaselineAccounts1760000000000 } from './1760000000000-baseline-accounts';
import { AccountEmailUniqueLower1760000000001 } from './1760000000001-account-email-unique-lower';
import { Outbox1760000000002 } from './1760000000002-outbox';
import { RefreshTokens1760000000003 } from './1760000000003-refresh-tokens';

// Expand -> migrate -> contract: never edit a released migration. The legacy
// accounts.user_id column is dropped by a later "contract" migration, once no
// running pod reads or writes it.
export const MIGRATIONS = [
  BaselineAccounts1760000000000,
  AccountEmailUniqueLower1760000000001,
  Outbox1760000000002,
  RefreshTokens1760000000003,
];
