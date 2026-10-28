const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash('guest123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'guest@vertex-demo.local' },
    update: { name: 'Guest Tester', emailVerifiedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null, forcePasswordReset: false },
    create: { email: 'guest@vertex-demo.local', name: 'Guest Tester', passwordHash, emailVerifiedAt: new Date() }
  });

  // Assign to shop if exists
  const shop = await prisma.shop.findFirst();
  if (shop) {
    await prisma.userShop.upsert({ where: { userId_shopId: { userId: user.id, shopId: shop.id } }, update: { role: 'MANAGER', isActive: true, assignedAt: new Date() }, create: { userId: user.id, shopId: shop.id, role: 'MANAGER', isActive: true, assignedAt: new Date() } });
    await prisma.user.update({ where: { id: user.id }, data: { defaultShopId: shop.id } });
  }

  console.log('Guest user created/updated: guest@vertex-demo.local / guest123');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
