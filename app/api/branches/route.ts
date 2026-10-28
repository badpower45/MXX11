import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { ShopType } from '@prisma/client';
import { hashPassword } from '@/lib/auth/password';

async function uniqueShopSlug(name: string) {
  const base = slugify(name) || 'shop';
  let attempt = base;
  let suffix = 2;

  while (
    await prisma.shop.findFirst({
      where: { slug: attempt },
      select: { id: true }
    })
  ) {
    attempt = `${base}-${suffix++}`;
  }

  return attempt;
}

const DEFAULT_UNITS_OF_MEASURE = [
  { code: 'PIECE', name: 'Piece', isBase: true },
  { code: 'BOX', name: 'Box', isBase: false },
  { code: 'CARTON', name: 'Carton', isBase: false },
  { code: 'PACK', name: 'Pack', isBase: false }
] as const;

const INVENTORY_REASON_PRESETS = [
  { code: 'DAMAGED', label: 'Damaged' },
  { code: 'EXPIRED', label: 'Expired' },
  { code: 'LOST', label: 'Lost' },
  { code: 'SHRINKAGE', label: 'Shrinkage' },
  { code: 'OPENING_BALANCE_CORRECTION', label: 'Opening balance correction' },
  { code: 'SUPPLIER_RETURN', label: 'Supplier return' },
  { code: 'INTERNAL_USE', label: 'Internal use' }
] as const;

export async function GET() {
  try {
    const { userId } = await requireRole('CASHIER');

    // Get all shops where the user has an active membership
    const memberships = await prisma.userShop.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        shop: {
          include: {
            settings: true
          }
        }
      },
      orderBy: { assignedAt: 'asc' }
    });

    return NextResponse.json({
      branches: memberships.map((m) => ({
        id: m.shop.id,
        name: m.shop.name,
        slug: m.shop.slug,
        posType: m.shop.posType,
        phone: m.shop.phone,
        email: m.shop.email,
        address: m.shop.address,
        role: m.role,
        settings: m.shop.settings
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load branches.');
  }
}

export async function POST(request: Request) {
  try {
    const { userId, shopId: currentShopId } = await requireRole('MANAGER');
    const body = await request.json();
    const {
      name,
      legalBusinessName,
      posType,
      phone,
      email,
      address,
      timezone,
      currencyCode,
      currencySymbol,
      adminName,
      adminEmail,
      adminPassword,
      adminPin,
      createLinkedSpareParts,
      linkedShopId
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Branch name is required.' }, { status: 400 });
    }

    const shopTypeVal = posType || ShopType.MOTORCYCLE_AND_SPARE_PARTS;
    if (!Object.values(ShopType).includes(shopTypeVal)) {
      return NextResponse.json({ error: 'Invalid branch type.' }, { status: 400 });
    }

    const slug = await uniqueShopSlug(name.trim());

    // Check if email conflicts
    if (adminEmail?.trim()) {
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail.trim().toLowerCase() }
      });
      if (existingUser) {
        return NextResponse.json(
          { error: 'An admin account with this email already exists.' },
          { status: 409 }
        );
      }
    }

    const newShop = await prisma.$transaction(async (tx) => {
      // 1. Create the main Shop
      const shop = await tx.shop.create({
        data: {
          name: name.trim(),
          legalBusinessName: legalBusinessName?.trim() || null,
          slug,
          posType: shopTypeVal as ShopType,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
          ownerId: userId
        }
      });

      const initializeShop = async (targetShopId: string, shopName: string) => {
        // Create default Shop Settings
        await tx.shopSetting.create({
          data: {
            shopId: targetShopId,
            currencyCode: currencyCode?.trim() || 'EGP',
            currencySymbol: currencySymbol?.trim() || 'ج.م ',
            timezone: timezone?.trim() || 'Africa/Cairo',
            taxMode: 'EXCLUSIVE',
            taxRate: 14,
            defaultPaymentMethods: ['كاش', 'فيزا', 'مايلو', 'فاليو', 'امان', 'محفظه الكترونيه', 'انستا باي'],
            receiptHeader: shopName,
            receiptFooter: 'شكراً لتعاملكم معنا.',
            receiptWidth: '80mm',
            lowStockThreshold: 5,
            openingFloatRequired: true,
            openingFloatAmount: 1000,
            batchTrackingEnabled: true,
            expiryTrackingEnabled: true,
            fefoEnabled: true,
            expiryAlertDays: 30,
            salePrefix: 'SAL',
            receiptPrefix: 'RCP',
            purchasePrefix: 'PO'
          }
        });

        // Create default Units of Measure
        for (const unit of DEFAULT_UNITS_OF_MEASURE) {
          await tx.unitOfMeasure.create({
            data: {
              shopId: targetShopId,
              code: unit.code,
              name: unit.name,
              isBase: unit.isBase,
              isActive: true
            }
          });
        }

        // Create default Inventory Reasons
        for (const reason of INVENTORY_REASON_PRESETS) {
          await tx.inventoryReason.create({
            data: {
              shopId: targetShopId,
              code: reason.code,
              label: reason.label,
              isActive: true
            }
          });
        }
      };

      await initializeShop(shop.id, shop.name);

      // Create UserShop membership for creator as ADMIN on main shop
      await tx.userShop.create({
        data: {
          userId,
          shopId: shop.id,
          role: 'ADMIN',
          isActive: true,
          assignedAt: new Date()
        }
      });

      // Handle Admin Account Creation for this branch if requested
      let createdUser = null;
      if (adminEmail?.trim() && adminPassword?.trim() && adminName?.trim()) {
        const hashedPassword = await hashPassword(adminPassword);
        createdUser = await tx.user.create({
          data: {
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            passwordHash: hashedPassword,
            emailVerifiedAt: new Date()
          }
        });

        const pinHash = adminPin ? await hashPassword(adminPin) : null;
        await tx.userShop.create({
          data: {
            userId: createdUser.id,
            shopId: shop.id,
            role: 'ADMIN',
            isActive: true,
            staffPinHash: pinHash,
            pinSetAt: adminPin ? new Date() : null,
            assignedAt: new Date()
          }
        });
      }

      // Handle linked Spare Parts shop link or creation if requested
      if (shopTypeVal === ShopType.MOTORCYCLE_AND_SPARE_PARTS) {
        if (linkedShopId) {
          const existingLinked = await tx.shop.findFirst({
            where: { id: linkedShopId, posType: ShopType.SPARE_PARTS_ONLY }
          });
          if (!existingLinked) {
            throw new Error('Selected Spare Parts branch is invalid or not found.');
          }

          // If the branch admin account is created, make sure they also get access to the linked spare parts shop
          if (createdUser) {
            const existingMembership = await tx.userShop.findUnique({
              where: {
                userId_shopId: {
                  userId: createdUser.id,
                  shopId: existingLinked.id
                }
              }
            });
            if (!existingMembership) {
              const pinHash = adminPin ? await hashPassword(adminPin) : null;
              await tx.userShop.create({
                data: {
                  userId: createdUser.id,
                  shopId: existingLinked.id,
                  role: 'ADMIN',
                  isActive: true,
                  staffPinHash: pinHash,
                  pinSetAt: adminPin ? new Date() : null,
                  assignedAt: new Date()
                }
              });
            }
          }

          // Link the main shop to this existing spare parts shop
          await tx.shop.update({
            where: { id: shop.id },
            data: {
              linkedShopId: existingLinked.id
            }
          });
        } else if (createLinkedSpareParts) {
          const sparePartsName = `${name.trim()} - قطع غيار`;
          const sparePartsSlug = await uniqueShopSlug(sparePartsName);

          const sparePartsShop = await tx.shop.create({
            data: {
              name: sparePartsName,
              legalBusinessName: legalBusinessName?.trim() || null,
              slug: sparePartsSlug,
              posType: ShopType.SPARE_PARTS_ONLY,
              phone: phone?.trim() || null,
              email: email?.trim() || null,
              address: address?.trim() || null,
              ownerId: userId
            }
          });

          await initializeShop(sparePartsShop.id, sparePartsShop.name);

          // Add creator membership on the spare parts shop
          await tx.userShop.create({
            data: {
              userId,
              shopId: sparePartsShop.id,
              role: 'ADMIN',
              isActive: true,
              assignedAt: new Date()
            }
          });

          // Add admin account membership on the spare parts shop as well if created
          if (createdUser) {
            const pinHash = adminPin ? await hashPassword(adminPin) : null;
            await tx.userShop.create({
              data: {
                userId: createdUser.id,
                shopId: sparePartsShop.id,
                role: 'ADMIN',
                isActive: true,
                staffPinHash: pinHash,
                pinSetAt: adminPin ? new Date() : null,
                assignedAt: new Date()
              }
            });
          }

          // Link the main shop to the spare parts shop
          await tx.shop.update({
            where: { id: shop.id },
            data: {
              linkedShopId: sparePartsShop.id
            }
          });
        }
      }

      // Log Activity
      await logActivity({
        tx,
        shopId: currentShopId,
        userId,
        action: 'BRANCH_CREATED',
        entityType: 'Shop',
        entityId: shop.id,
        description: `Created branch ${shop.name} (${shopTypeVal}).`
      });

      return shop;
    });

    return NextResponse.json({ success: true, branch: newShop }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create branch.');
  }
}
