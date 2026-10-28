import { redirect } from 'next/navigation';
import { ShopRole } from '@prisma/client';
import {
  AuthenticationError,
  getActiveShopContextOrThrow,
  ShopContextError
} from '@/lib/auth/get-active-shop';
import type { PermissionKey } from '@/lib/permissions';
import { getServerLocale } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/locales';

async function redirectToLocale(path: string) {
  redirect(localizePath(path, await getServerLocale()));
}

const ROLE_WEIGHT: Record<ShopRole, number> = {
  STOCK_COUNTER: 0,
  CASHIER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export class AuthorizationError extends Error {
  constructor(message = 'Forbidden.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function requireRole(minRole: ShopRole) {
  const context = await getActiveShopContextOrThrow();
  if (ROLE_WEIGHT[context.role] < ROLE_WEIGHT[minRole]) {
    throw new AuthorizationError();
  }

  return context;
}

export async function requirePermission(permission: PermissionKey, minRole: ShopRole = 'CASHIER') {
  const context = await requireRole(minRole);

  if (!context.permissions[permission]) {
    throw new AuthorizationError();
  }

  return context;
}

export async function requirePageRole(minRole: ShopRole) {
  try {
    return await requireRole(minRole);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      await redirectToLocale('/login');
    }

    if (error instanceof ShopContextError) {
      await redirectToLocale(error.code === 'SHOP_ACCESS_LOST' ? '/login?error=shop-access-lost' : '/onboard');
    }

    if (error instanceof AuthorizationError) {
      const context = await getActiveShopContextOrThrow().catch(() => null);
      if (context?.role === 'STOCK_COUNTER') {
        await redirectToLocale('/stock-counts');
      } else {
        await redirectToLocale('/dashboard');
      }
    }

    throw error;
  }
}

export async function requirePagePermission(permission: PermissionKey, minRole: ShopRole = 'CASHIER') {
  try {
    return await requirePermission(permission, minRole);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      await redirectToLocale('/login');
    }

    if (error instanceof ShopContextError) {
      await redirectToLocale(error.code === 'SHOP_ACCESS_LOST' ? '/login?error=shop-access-lost' : '/onboard');
    }

    if (error instanceof AuthorizationError) {
      const context = await getActiveShopContextOrThrow().catch(() => null);
      if (context?.role === 'STOCK_COUNTER') {
        await redirectToLocale('/stock-counts');
      } else {
        await redirectToLocale('/dashboard');
      }
    }

    throw error;
  }
}

export function hasRole(role: ShopRole, minRole: ShopRole) {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minRole];
}

export function hasPermission(
  permissions: Partial<Record<PermissionKey, boolean>> | null | undefined,
  permission: PermissionKey
) {
  return Boolean(permissions?.[permission]);
}

export function isAuthorizationError(error: unknown) {
  return error instanceof AuthorizationError;
}
