import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | typeof prisma;

type ActivityInput = {
  tx?: DbClient;
  shopId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue | null;
};

export async function logActivity({
  tx,
  shopId,
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata
}: ActivityInput) {
  const client = tx ?? prisma;
  return client.activityLog.create({
    data: {
      shopId,
      userId: userId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      description,
      metadata: metadata ?? undefined
    }
  });
}
