import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');

    const members = await prisma.userShop.findMany({
      where: {
        shopId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        user: {
          name: 'asc'
        }
      }
    });

    return NextResponse.json({
      staff: members.map((m) => ({
        id: m.user.id,
        name: m.user.name || m.user.email,
        email: m.user.email,
        role: m.role
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load staff members.');
  }
}

