import { SetMetadata } from '@nestjs/common';

export type RoleName = 'owner' | 'admin' | 'editor' | 'viewer';
export const REQUIRE_ROLE_KEY = 'requireRole';
export const RequireRole = (role: RoleName) => SetMetadata(REQUIRE_ROLE_KEY, role);
