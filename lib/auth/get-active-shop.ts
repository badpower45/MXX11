import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/auth';
import { getEffectivePermissionState } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getServerLocale } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/locales';
import { ShopType, ShopRole } from '@prisma/client';

type GuardMode = 'redirect' | 'throw';

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ShopContextError extends Error {
  code: 'SHOP_REQUIRED' | 'SHOP_ACCESS_LOST';

  constructor(code: 'SHOP_REQUIRED' | 'SHOP_ACCESS_LOST', message: string) {
    super(message);
    this.name = 'ShopContextError';
    this.code = code;
  }
}

const resolveActiveShopContext = cache(async (mode: GuardMode) => {
  const session = await auth();

  if (!session?.user?.id) {
    if (mode === 'redirect') {
      redirect(localizePath('/login', await getServerLocale()));
    }

    throw new AuthenticationError();
  }

  const devBypassEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_ADMIN_BYPASS === 'true';

  let userId = session.user.id;

  if (devBypassEnabled) {
    const devEmail = session.user.email ?? 'dev-admin@local';
    const existingDevUser = await prisma.user.findUnique({
      where: { email: devEmail }
    });
    if (existingDevUser) {
      userId = existingDevUser.id;
    } else {
      const now = new Date();
      const newUser = await prisma.user.create({
        data: {
          id: session.user.id,
          email: devEmail,
          name: session.user.name ?? 'Dev Admin',
          passwordHash: '$2a$12$dummyPasswordHashForDevBypassOnly',
          emailVerifiedAt: now
        }
      });
      userId = newUser.id;
    }
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultShopId: true }
  });
  const preferredShopId = currentUser?.defaultShopId ?? session.user.defaultShopId ?? null;

  const preferredMembership = preferredShopId
    ? await prisma.userShop.findFirst({
        where: {
          userId: userId,
          shopId: preferredShopId,
          isActive: true
        },
        include: { shop: true }
      })
    : null;

  const membership =
    preferredMembership ??
    (await prisma.userShop.findFirst({
      where: {
        userId: userId,
        isActive: true
      },
      include: { shop: true },
      orderBy: { assignedAt: 'asc' }
    }));

  if (!membership) {
    if (devBypassEnabled) {
      const now = new Date();
      const slug = `dev-shop-${userId}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const devShop = await prisma.shop.create({
        data: {
          name: 'Dev Shop',
          slug,
          posType: ShopType.RETAIL,
          ownerId: userId
        }
      });

      await prisma.userShop.create({
        data: {
          userId: userId,
          shopId: devShop.id,
          role: 'ADMIN',
          isActive: true,
          assignedAt: now
        }
      });

      await prisma.user.update({
        where: { id: userId },
        data: { defaultShopId: devShop.id }
      });

      const newMembership = await prisma.userShop.findFirstOrThrow({
        where: { userId: userId, isActive: true },
        include: { shop: true }
      });

      return {
        session,
        membershipId: newMembership.id,
        shopId: newMembership.shopId,
        shop: newMembership.shop,
        role: newMembership.role,
        customPermissions: null,
        permissions: getEffectivePermissionState(newMembership.role, null),
        userId: userId
      };
    }

    if (mode === 'redirect') {
      redirect(localizePath('/onboard', await getServerLocale()));
    }

    throw new ShopContextError(
      'SHOP_REQUIRED',
      'No active shop found for this user.'
    );
  }

  if (preferredShopId !== membership.shopId) {
    await prisma.user.update({
      where: { id: userId },
      data: { defaultShopId: membership.shopId }
    });
  }

  return {
    session,
    membershipId: membership.id,
    shopId: membership.shopId,
    shop: membership.shop,
    role: membership.role,
    customPermissions: membership.customPermissions,
    permissions: getEffectivePermissionState(membership.role, membership.customPermissions),
    userId: userId
  };
});

export async function getActiveShopContext() {
  return resolveActiveShopContext('redirect');
}

export async function getActiveShopContextOrThrow() {
  return resolveActiveShopContext('throw');
}
