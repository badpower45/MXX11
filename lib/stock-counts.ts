import { DocumentSequenceType, Prisma, type ShopRole } from '@prisma/client';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

type CreateStockCountInput = {
  shopId: string;
  createdByUserId: string;
  title?: string | null;
  notes?: string | null;
  isBlind: boolean;
  countType?: 'ALL' | 'MOTORCYCLES' | 'SPARE_PARTS';
};

type SaveStockCountInput = {
  shopId: string;
  stockCountId: string;
  actorUserId: string;
  actorRole: ShopRole;
  notes?: string | null;
  items: Array<{
    id: string;
    actualQty: number | null;
    note?: string | null;
  }>;
  assigneeUserIds?: string[];
  userEntries?: Array<{
    productId: string;
    assigneeId: string;
    actualQty: number;
  }>;
};

export class StockCountError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StockCountError';
    this.status = status;
  }
}

export const stockCountInclude = Prisma.validator<Prisma.StockCountInclude>()({
  items: {
    orderBy: { productNameSnapshot: 'asc' }
  },
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  approvedByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  assignees: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            select: {
              id: true,
              shopId: true
            }
          }
        }
      },
      guestStaff: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  userEntries: {
    include: {
      assignee: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              memberships: {
                select: {
                  id: true,
                  shopId: true
                }
              }
            }
          },
          guestStaff: {
            select: {
              name: true
            }
          }
        }
      }
    }
  }
});

export type StockCountWithDetail = Prisma.StockCountGetPayload<{
  include: typeof stockCountInclude;
}>;

function canManageApproval(role: ShopRole) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export function shouldRevealBlindQuantities(stockCount: Pick<StockCountWithDetail, 'isBlind' | 'status'>) {
  return !stockCount.isBlind || !['DRAFT', 'IN_PROGRESS'].includes(stockCount.status);
}

export function serializeStockCount(stockCount: StockCountWithDetail) {
  const countedItemCount = stockCount.items.filter((item) => item.actualQty !== null).length;

  return {
    id: stockCount.id,
    shopId: stockCount.shopId,
    createdByUserId: stockCount.createdByUserId,
    approvedByUserId: stockCount.approvedByUserId,
    referenceNumber: stockCount.referenceNumber,
    title: stockCount.title,
    status: stockCount.status,
    isBlind: stockCount.isBlind,
    revealBlindQuantities: shouldRevealBlindQuantities(stockCount),
    notes: stockCount.notes,
    startedAt: stockCount.startedAt?.toISOString() ?? null,
    submittedAt: stockCount.submittedAt?.toISOString() ?? null,
    approvedAt: stockCount.approvedAt?.toISOString() ?? null,
    postedAt: stockCount.postedAt?.toISOString() ?? null,
    createdAt: stockCount.createdAt.toISOString(),
    updatedAt: stockCount.updatedAt.toISOString(),
    createdByUser: {
      id: stockCount.createdByUser.id,
      name: stockCount.createdByUser.name,
      email: stockCount.createdByUser.email
    },
    approvedByUser: stockCount.approvedByUser
      ? {
          id: stockCount.approvedByUser.id,
          name: stockCount.approvedByUser.name,
          email: stockCount.approvedByUser.email
        }
      : null,
    assignees: stockCount.assignees?.map((a) => {
      const shopMembership = a.user?.memberships.find((m) => m.shopId === stockCount.shopId);
      return {
        id: shopMembership?.id ?? a.guestStaffId ?? a.id,
        userId: a.userId,
        guestStaffId: a.guestStaffId,
        name: a.user ? (a.user.name || a.user.email) : (a.guestStaff?.name ?? 'N/A'),
        email: a.user ? a.user.email : 'بدون حساب',
        completedAt: a.completedAt?.toISOString() ?? null
      };
    }) ?? [],
    userEntries: stockCount.userEntries?.map((e) => {
      const name = e.assignee.user
        ? (e.assignee.user.name || e.assignee.user.email)
        : (e.assignee.guestStaff?.name ?? 'N/A');
      return {
        id: e.id,
        productId: e.productId,
        assigneeId: e.assignee.userId
          ? e.assignee.user?.memberships.find((m) => m.shopId === stockCount.shopId)?.id || e.assignee.userId
          : e.assignee.guestStaffId || '',
        assigneeName: name,
        actualQty: e.actualQty
      };
    }) ?? [],
    itemCount: stockCount.items.length,
    countedItemCount,
    items: stockCount.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      varianceQty: item.varianceQty,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }))
  };
}

async function getStockCountForAction(tx: Prisma.TransactionClient, shopId: string, stockCountId: string) {
  const stockCount = await tx.stockCount.findFirst({
    where: { id: stockCountId, shopId },
    include: stockCountInclude
  });

  if (!stockCount) {
    throw new StockCountError('Stock count not found.', 404);
  }

  return stockCount;
}

export async function createStockCount(input: CreateStockCountInput): Promise<StockCountWithDetail> {
  return prisma.$transaction(async (tx) => {
    const productWhere: Prisma.ProductWhereInput = {
      shopId: input.shopId,
      isActive: true
    };

    if (input.countType === 'MOTORCYCLES') {
      productWhere.productType = 'MOTORCYCLE';
    } else if (input.countType === 'SPARE_PARTS') {
      productWhere.productType = 'SPARE_PART';
    }

    const [products, referenceNumber] = await Promise.all([
      tx.product.findMany({
        where: productWhere,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true
        }
      }),
      getNextDocumentNumber(tx, {
        shopId: input.shopId,
        type: DocumentSequenceType.STOCK_COUNT,
        prefix: 'CNT'
      })
    ]);

    if (!products.length) {
      throw new StockCountError('Add at least one active product before starting a stock count.');
    }

    const stockCount = await tx.stockCount.create({
      data: {
        shopId: input.shopId,
        createdByUserId: input.createdByUserId,
        referenceNumber,
        title: normalizeText(input.title),
        status: 'DRAFT',
        isBlind: input.isBlind,
        notes: normalizeText(input.notes),
        items: {
          create: products.map((product) => ({
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            expectedQty: product.stockQty,
            actualQty: null,
            varianceQty: 0,
            note: null
          }))
        }
      },
      include: stockCountInclude
    });

    await logActivity({
      tx,
      shopId: input.shopId,
      userId: input.createdByUserId,
      action: 'STOCK_COUNT_CREATED',
      entityType: 'StockCount',
      entityId: stockCount.id,
      description: `Created stock count ${stockCount.referenceNumber}.`,
      metadata: {
        title: stockCount.title,
        isBlind: stockCount.isBlind,
        itemCount: stockCount.items.length
      }
    });

    return stockCount;
  });
}

export async function saveStockCountSheet(input: SaveStockCountInput): Promise<StockCountWithDetail> {
  return prisma.$transaction(async (tx) => {
    const stockCount = await getStockCountForAction(tx, input.shopId, input.stockCountId);

    if (!['DRAFT', 'IN_PROGRESS'].includes(stockCount.status)) {
      throw new StockCountError('Only draft or in-progress counts can be edited.');
    }

    const isAssignee = await tx.stockCountAssignee.findFirst({
      where: {
        stockCountId: stockCount.id,
        userId: input.actorUserId
      }
    });

    if (
      stockCount.createdByUserId !== input.actorUserId &&
      !canManageApproval(input.actorRole) &&
      !isAssignee
    ) {
      throw new StockCountError('You do not have access to edit this stock count.', 403);
    }

    if (input.assigneeUserIds !== undefined) {
      await tx.stockCountAssignee.deleteMany({
        where: { stockCountId: stockCount.id }
      });
      if (input.assigneeUserIds.length > 0) {
        const userShops = await tx.userShop.findMany({
          where: { id: { in: input.assigneeUserIds } }
        });
        const guestStaffs = await tx.guestStaff.findMany({
          where: { id: { in: input.assigneeUserIds } }
        });

        const userShopMap = new Map(userShops.map((u) => [u.id, u.userId]));
        const guestMap = new Set(guestStaffs.map((g) => g.id));

        const assigneeData = input.assigneeUserIds.map((id) => {
          if (userShopMap.has(id)) {
            return {
              stockCountId: stockCount.id,
              userId: userShopMap.get(id)!,
              guestStaffId: null
            };
          } else if (guestMap.has(id)) {
            return {
              stockCountId: stockCount.id,
              userId: null,
              guestStaffId: id
            };
          }
          return null;
        }).filter(Boolean) as Array<{ stockCountId: string; userId: string | null; guestStaffId: string | null }>;

        if (assigneeData.length > 0) {
          await tx.stockCountAssignee.createMany({
            data: assigneeData
          });
        }
      }
    }

    if (input.userEntries && input.userEntries.length > 0) {
      const uniqueAssigneeIds = [...new Set(input.userEntries.map((e) => e.assigneeId))];

      const userShops = await tx.userShop.findMany({
        where: { id: { in: uniqueAssigneeIds } }
      });
      const userShopMap = new Map(userShops.map((u) => [u.id, u.userId]));

      const assignees = await tx.stockCountAssignee.findMany({
        where: { stockCountId: stockCount.id }
      });

      for (const entry of input.userEntries) {
        const resolvedUserId = userShopMap.get(entry.assigneeId) || null;
        const assignee = assignees.find((a) => {
          if (resolvedUserId) {
            return a.userId === resolvedUserId;
          } else {
            return a.guestStaffId === entry.assigneeId;
          }
        });

        if (assignee) {
          await tx.stockCountUserEntry.upsert({
            where: {
              stockCountAssigneeId_productId: {
                stockCountAssigneeId: assignee.id,
                productId: entry.productId
              }
            },
            update: {
              actualQty: entry.actualQty
            },
            create: {
              stockCountId: stockCount.id,
              productId: entry.productId,
              stockCountAssigneeId: assignee.id,
              actualQty: entry.actualQty
            }
          });
        }
      }
    }

    const allUserEntries = await tx.stockCountUserEntry.findMany({
      where: { stockCountId: stockCount.id }
    });

    const productSums = new Map<string, number>();
    for (const entry of allUserEntries) {
      const current = productSums.get(entry.productId) || 0;
      productSums.set(entry.productId, current + entry.actualQty);
    }

    const itemMap = new Map(stockCount.items.map((item) => [item.id, item]));

    for (const item of input.items) {
      const existing = itemMap.get(item.id);
      if (!existing) {
        throw new StockCountError('One or more stock count lines were not found.');
      }

      await tx.stockCountItem.update({
        where: { id: item.id },
        data: {
          actualQty: item.actualQty,
          varianceQty: item.actualQty === null ? 0 : item.actualQty - existing.expectedQty,
          note: normalizeText(item.note)
        }
      });
    }

    // Update stock count items based on entries sum
    for (const item of stockCount.items) {
      const counted = allUserEntries.some((e) => e.productId === item.productId);
      if (counted) {
        const actualQty = productSums.get(item.productId) || 0;
        await tx.stockCountItem.update({
          where: { id: item.id },
          data: {
            actualQty,
            varianceQty: actualQty - item.expectedQty
          }
        });
      }
    }

    const pendingItems = new Map(input.items.map((item) => [item.id, item]));

    const nextCountedLines = stockCount.items.reduce((count, item) => {
      const pending = pendingItems.get(item.id);
      const actualQty = pending ? pending.actualQty : item.actualQty;
      return count + (actualQty !== null ? 1 : 0);
    }, 0);

    const updated = await tx.stockCount.update({
      where: { id: stockCount.id },
      data: {
        status: nextCountedLines > 0 && stockCount.status === 'DRAFT' ? 'IN_PROGRESS' : stockCount.status,
        startedAt: nextCountedLines > 0 && !stockCount.startedAt ? new Date() : stockCount.startedAt,
        notes: input.notes !== undefined ? normalizeText(input.notes) : stockCount.notes
      },
      include: stockCountInclude
    });

    await logActivity({
      tx,
      shopId: input.shopId,
      userId: input.actorUserId,
      action: 'STOCK_COUNT_SAVED',
      entityType: 'StockCount',
      entityId: stockCount.id,
      description: `Saved count sheet for ${stockCount.referenceNumber}.`,
      metadata: {
        countedLines: nextCountedLines
      }
    });

    return updated;
  });
}

export async function transitionStockCount({
  shopId,
  stockCountId,
  actorUserId,
  actorRole,
  action
}: {
  shopId: string;
  stockCountId: string;
  actorUserId: string;
  actorRole: ShopRole;
  action: 'SUBMIT' | 'APPROVE' | 'POST' | 'CANCEL';
}): Promise<StockCountWithDetail> {
  return prisma.$transaction(async (tx) => {
    const stockCount = await getStockCountForAction(tx, shopId, stockCountId);

    if (action === 'SUBMIT') {
      if (!['DRAFT', 'IN_PROGRESS'].includes(stockCount.status)) {
        throw new StockCountError('Only draft or in-progress counts can be submitted.');
      }

      const isAssignee = await tx.stockCountAssignee.findFirst({
        where: {
          stockCountId: stockCount.id,
          userId: actorUserId
        }
      });

      if (
        stockCount.createdByUserId !== actorUserId &&
        !canManageApproval(actorRole) &&
        !isAssignee
      ) {
        throw new StockCountError('You do not have access to submit this stock count.', 403);
      }

      if (stockCount.items.some((item) => item.actualQty === null)) {
        throw new StockCountError('Every line must have an actual count before submission.');
      }

      const updated = await tx.stockCount.update({
        where: { id: stockCount.id },
        data: {
          status: 'SUBMITTED',
          startedAt: stockCount.startedAt ?? new Date(),
          submittedAt: new Date()
        },
        include: stockCountInclude
      });

      await logActivity({
        tx,
        shopId,
        userId: actorUserId,
        action: 'STOCK_COUNT_SUBMITTED',
        entityType: 'StockCount',
        entityId: stockCount.id,
        description: `Submitted stock count ${stockCount.referenceNumber} for approval.`
      });

      return updated;
    }

    if (action === 'APPROVE') {
      if (!canManageApproval(actorRole)) {
        throw new StockCountError('Manager or admin approval is required.', 403);
      }

      if (stockCount.status !== 'SUBMITTED') {
        throw new StockCountError('Only submitted stock counts can be approved.');
      }

      const updated = await tx.stockCount.update({
        where: { id: stockCount.id },
        data: {
          status: 'APPROVED',
          approvedByUserId: actorUserId,
          approvedAt: new Date()
        },
        include: stockCountInclude
      });

      await logActivity({
        tx,
        shopId,
        userId: actorUserId,
        action: 'STOCK_COUNT_APPROVED',
        entityType: 'StockCount',
        entityId: stockCount.id,
        description: `Approved stock count ${stockCount.referenceNumber}.`
      });

      return updated;
    }

    if (action === 'POST') {
      if (!canManageApproval(actorRole)) {
        throw new StockCountError('Only managers or admins can post variances.', 403);
      }

      if (stockCount.status !== 'APPROVED' || stockCount.postedAt) {
        throw new StockCountError('Only approved, unposted stock counts can be posted.');
      }

      const productMap = new Map(
        (
          await tx.product.findMany({
            where: {
              shopId,
              id: { in: stockCount.items.map((item) => item.productId) }
            }
          })
        ).map((product) => [product.id, product])
      );

      for (const item of stockCount.items) {
        if (item.actualQty === null) {
          throw new StockCountError('Cannot post a stock count with missing actual quantities.');
        }

        const product = productMap.get(item.productId);
        if (!product) {
          throw new StockCountError(`Product ${item.productNameSnapshot} is missing.`);
        }

        const qtyChange = item.actualQty - product.stockQty;
        if (qtyChange !== 0) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQty: item.actualQty
            }
          });

          await tx.inventoryMovement.create({
            data: {
              shopId,
              productId: product.id,
              type: 'STOCK_COUNT_POSTED',
              qtyChange,
              referenceId: stockCount.id,
              userId: actorUserId,
              notes: `Stock count ${stockCount.referenceNumber}`
            }
          });
        }
      }

      const updated = await tx.stockCount.update({
        where: { id: stockCount.id },
        data: {
          status: 'POSTED',
          postedAt: new Date()
        },
        include: stockCountInclude
      });

      await logActivity({
        tx,
        shopId,
        userId: actorUserId,
        action: 'STOCK_COUNT_POSTED',
        entityType: 'StockCount',
        entityId: stockCount.id,
        description: `Posted stock count ${stockCount.referenceNumber} variances.`,
        metadata: {
          varianceLines: stockCount.items.filter((item) => item.varianceQty !== 0).length
        }
      });

      return updated;
    }

    if (stockCount.status === 'POSTED' || stockCount.status === 'CANCELLED') {
      throw new StockCountError('This stock count can no longer be cancelled.');
    }

    if (!canManageApproval(actorRole) && stockCount.createdByUserId !== actorUserId) {
      throw new StockCountError('You do not have access to cancel this stock count.', 403);
    }

    const updated = await tx.stockCount.update({
      where: { id: stockCount.id },
      data: {
        status: 'CANCELLED'
      },
      include: stockCountInclude
    });

    await logActivity({
      tx,
      shopId,
      userId: actorUserId,
      action: 'STOCK_COUNT_CANCELLED',
      entityType: 'StockCount',
      entityId: stockCount.id,
      description: `Cancelled stock count ${stockCount.referenceNumber}.`
    });

    return updated;
  });
}
