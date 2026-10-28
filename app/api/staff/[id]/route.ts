import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { staffUpdateSchema } from '@/lib/auth/validation';
import { normalizePermissionOverride } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { serializeStaffListItem } from '@/lib/serializers/staff';
import {
  assertManagedShopAccess,
  countActiveAdmins,
  syncUserDefaultShopId
} from '@/lib/staff';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, shopId: activeShopId } = await requirePermission('MANAGE_STAFF');
    const body = await request.json();
    const parsed = staffUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid staff update.' },
        { status: 400 }
      );
    }

    const existing = await prisma.userShop.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!existing) {
      const guest = await prisma.guestStaff.findUnique({
        where: { id },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!guest) {
        return NextResponse.json({ error: 'Staff assignment not found.' }, { status: 404 });
      }

      const hasShopAccess = await assertManagedShopAccess(userId, guest.shopId);
      if (!hasShopAccess) {
        return NextResponse.json({ error: 'You do not have access to that staff record.' }, { status: 403 });
      }

      const updatedGuest = await prisma.$transaction(async (tx) => {
        const nextGuest = await tx.guestStaff.update({
          where: { id },
          data: {
            name: body.name !== undefined ? body.name.trim() : guest.name,
            isActive: parsed.data.isActive !== undefined ? parsed.data.isActive : guest.isActive,
            shopId: parsed.data.shopId !== undefined ? parsed.data.shopId : guest.shopId
          },
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        });

        await logActivity({
          tx,
          shopId: nextGuest.shopId,
          userId,
          action: 'STAFF_UPDATED',
          entityType: 'GuestStaff',
          entityId: nextGuest.id,
          description: `Updated guest staff ${nextGuest.name}.`,
          metadata: {
            isActive: nextGuest.isActive,
            shopId: nextGuest.shopId
          }
        });

        return nextGuest;
      });

      const serializedGuest = {
        id: updatedGuest.id,
        userId: '',
        name: updatedGuest.name,
        email: 'بدون حساب',
        role: 'STOCK_COUNTER' as const,
        shopId: updatedGuest.shopId,
        shopName: updatedGuest.shop.name,
        shopSlug: updatedGuest.shop.slug,
        isActive: updatedGuest.isActive,
        assignedAt: updatedGuest.createdAt.toISOString(),
        disabledAt: null,
        lastLogin: null,
        customPermissions: [],
        baseSalary: null,
        commissionRate: null
      };

      return NextResponse.json({ item: serializedGuest });
    }

    const [hasCurrentShopAccess, hasTargetShopAccess] = await Promise.all([
      assertManagedShopAccess(userId, existing.shopId),
      assertManagedShopAccess(userId, parsed.data.shopId)
    ]);

    if (!hasCurrentShopAccess || !hasTargetShopAccess) {
      return NextResponse.json({ error: 'You do not have access to that staff record.' }, { status: 403 });
    }

    const selfManagingActiveMembership =
      existing.userId === userId && existing.shopId === activeShopId;
    const changingOwnLiveAccess =
      selfManagingActiveMembership &&
      (!parsed.data.isActive || parsed.data.role !== 'ADMIN' || parsed.data.shopId !== existing.shopId);

    if (changingOwnLiveAccess) {
      return NextResponse.json(
        { error: 'Use another active admin account before changing your own live admin access.' },
        { status: 400 }
      );
    }

    if (parsed.data.shopId !== existing.shopId) {
      const duplicateMembership = await prisma.userShop.findUnique({
        where: {
          userId_shopId: {
            userId: existing.userId,
            shopId: parsed.data.shopId
          }
        },
        select: { id: true }
      });

      if (duplicateMembership) {
        return NextResponse.json(
          { error: 'This user is already assigned to the selected shop.' },
          { status: 409 }
        );
      }
    }

    const nextCustomPermissions = normalizePermissionOverride(
      parsed.data.role,
      parsed.data.customPermissions ?? []
    );

    const removesLastActiveAdmin =
      existing.role === 'ADMIN' &&
      existing.isActive &&
      (parsed.data.role !== 'ADMIN' || !parsed.data.isActive || parsed.data.shopId !== existing.shopId);

    if (removesLastActiveAdmin) {
      const otherActiveAdmins = await prisma.$transaction((tx) =>
        countActiveAdmins(tx, existing.shopId, existing.id)
      );

      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: 'Each shop must keep at least one active admin.' },
          { status: 400 }
        );
      }
    }

    const updatedMembership = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const membership = await tx.userShop.update({
        where: { id },
        data: {
          role: parsed.data.role,
          shopId: parsed.data.shopId,
          isActive: parsed.data.isActive,
          baseSalary: parsed.data.baseSalary !== undefined ? parsed.data.baseSalary : existing.baseSalary,
          commissionRate: parsed.data.commissionRate !== undefined ? parsed.data.commissionRate : existing.commissionRate,
          customPermissions:
            nextCustomPermissions === null ? Prisma.DbNull : nextCustomPermissions,
          assignedAt: parsed.data.shopId !== existing.shopId ? now : existing.assignedAt,
          disabledAt: parsed.data.isActive ? null : now,
          ...(parsed.data.role !== 'CASHIER'
            ? {
                staffPinHash: null,
                pinSetAt: null
              }
            : {})
        },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              authAuditLogs: {
                where: { action: 'LOGIN_SUCCESS' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  action: true,
                  createdAt: true,
                  ipAddress: true,
                  userAgent: true
                }
              }
            }
          }
        }
      });

      await syncUserDefaultShopId(
        tx,
        existing.userId,
        membership.isActive ? membership.shopId : null
      );

      if (parsed.data.shopId !== existing.shopId) {
        await logActivity({
          tx,
          shopId: parsed.data.shopId,
          userId,
          action: 'STAFF_SHOP_REASSIGNED',
          entityType: 'UserShop',
          entityId: membership.id,
          description: `Assigned ${membership.user.name ?? membership.user.email} to ${membership.shop.name}.`,
          metadata: {
            previousShopId: existing.shopId,
            nextShopId: membership.shopId
          }
        });
      }

      if (parsed.data.role !== existing.role) {
        await logActivity({
          tx,
          shopId: membership.shopId,
          userId,
          action: 'STAFF_ROLE_CHANGED',
          entityType: 'UserShop',
          entityId: membership.id,
          description: `Changed ${membership.user.name ?? membership.user.email} role to ${membership.role}.`,
          metadata: {
            previousRole: existing.role,
            nextRole: membership.role
          }
        });
      }

      if (parsed.data.isActive !== existing.isActive) {
        await logActivity({
          tx,
          shopId: membership.shopId,
          userId,
          action: membership.isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
          entityType: 'UserShop',
          entityId: membership.id,
          description: `${membership.isActive ? 'Activated' : 'Deactivated'} ${membership.user.name ?? membership.user.email}.`
        });
      }

      const previousPermissions = Array.isArray(existing.customPermissions)
        ? existing.customPermissions
        : [];
      const permissionsChanged =
        JSON.stringify(previousPermissions) !== JSON.stringify(nextCustomPermissions ?? []);

      if (permissionsChanged) {
        await logActivity({
          tx,
          shopId: membership.shopId,
          userId,
          action: 'STAFF_PERMISSIONS_CHANGED',
          entityType: 'UserShop',
          entityId: membership.id,
          description: `Updated permissions for ${membership.user.name ?? membership.user.email}.`,
          metadata: {
            previousPermissions,
            nextPermissions: nextCustomPermissions ?? []
          }
        });
      }

      const salaryChanged =
        parsed.data.baseSalary !== undefined &&
        parsed.data.baseSalary !== (existing.baseSalary ? Number(existing.baseSalary) : null);

      if (salaryChanged) {
        await logActivity({
          tx,
          shopId: membership.shopId,
          userId,
          action: 'STAFF_SALARY_CHANGED',
          entityType: 'UserShop',
          entityId: membership.id,
          description: `Changed base salary for ${membership.user.name ?? membership.user.email} to ${membership.baseSalary ? membership.baseSalary.toString() : 'none'}.`,
          metadata: {
            previousSalary: existing.baseSalary ? existing.baseSalary.toString() : null,
            nextSalary: membership.baseSalary ? membership.baseSalary.toString() : null
          }
        });
      }

      if (
        parsed.data.shopId === existing.shopId &&
        parsed.data.role === existing.role &&
        parsed.data.isActive === existing.isActive &&
        !permissionsChanged &&
        !salaryChanged
      ) {
        await logActivity({
          tx,
          shopId: membership.shopId,
          userId,
          action: 'STAFF_UPDATED',
          entityType: 'UserShop',
          entityId: membership.id,
          description: `Reviewed staff assignment for ${membership.user.name ?? membership.user.email}.`
        });
      }

      return membership;
    });

    return NextResponse.json({ item: serializeStaffListItem(updatedMembership) });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update staff assignment.');
  }
}
