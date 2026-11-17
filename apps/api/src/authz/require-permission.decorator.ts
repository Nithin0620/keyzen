import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@aegis/shared';

export const AUTHENTICATED = 'authenticated' as const;
export const PERMISSION_METADATA = 'aegis:permission';

export type PermissionRequirement = Permission | typeof AUTHENTICATED;

export function RequirePermission(permission: PermissionRequirement) {
  return SetMetadata(PERMISSION_METADATA, permission);
}
