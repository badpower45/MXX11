import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const requirePermission = vi.fn();
const apiErrorResponse = vi.fn();
const logActivity = vi.fn();

const categoryFindMany = vi.fn();
const categoryFindFirst = vi.fn();
const categoryCreate = vi.fn();

const productFindMany = vi.fn();
const productFindFirst = vi.fn();
const productCreate = vi.fn();

const customerFindMany = vi.fn();
const customerFindFirst = vi.fn();
const customerCreate = vi.fn();

const supplierFindMany = vi.fn();
const supplierFindFirst = vi.fn();
const supplierCreate = vi.fn();

const branchExpenseFindMany = vi.fn();
const branchExpenseCreate = vi.fn();

const userShopFindMany = vi.fn();
const userShopCreate = vi.fn();

const dealerDebtFindMany = vi.fn();
const installmentCompanyDueFindMany = vi.fn();
const reservationFindMany = vi.fn();
const trafficInvoiceFindMany = vi.fn();
const shopFindUnique = vi.fn();

const transaction = vi.fn();

// Mock dependencies
vi.mock('@/lib/authz', () => ({
  requireRole,
  requirePermission
}));

vi.mock('@/lib/api', () => ({
  apiErrorResponse
}));

vi.mock('@/lib/activity', () => ({
  logActivity
}));

vi.mock('@/lib/uom', () => ({
  ensureUnitsOfMeasure: vi.fn()
}));

vi.mock('@/lib/staff', () => ({
  getManagedShops: vi.fn().mockResolvedValue([{ id: 'shop-1', name: 'Shop One', slug: 'shop-1' }]),
  assertManagedShopAccess: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany: categoryFindMany,
      findFirst: categoryFindFirst,
      create: categoryCreate
    },
    product: {
      findMany: productFindMany,
      findFirst: productFindFirst,
      create: productCreate
    },
    customer: {
      findMany: customerFindMany,
      findFirst: customerFindFirst,
      create: customerCreate
    },
    supplier: {
      findMany: supplierFindMany,
      findFirst: supplierFindFirst,
      create: supplierCreate
    },
    branchExpense: {
      findMany: branchExpenseFindMany,
      create: branchExpenseCreate
    },
    userShop: {
      findMany: userShopFindMany,
      create: userShopCreate
    },
    dealerDebt: {
      findMany: dealerDebtFindMany
    },
    installmentCompanyDue: {
      findMany: installmentCompanyDueFindMany
    },
    reservation: {
      findMany: reservationFindMany
    },
    trafficInvoice: {
      findMany: trafficInvoiceFindMany
    },
    shop: {
      findUnique: shopFindUnique
    },
    $transaction: transaction
  }
}));

describe('API Route Health Tests', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    shopFindUnique.mockResolvedValue({ id: 'shop-1', posType: 'MOTORCYCLE_AND_SPARE_PARTS', linkedShopId: null });

    // Default mock auth context
    requireRole.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      session: { user: { name: 'Manager User', email: 'manager@example.com' } }
    });

    requirePermission.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      session: { user: { name: 'Manager User', email: 'manager@example.com' } }
    });

    apiErrorResponse.mockImplementation((_error: unknown, message: string) =>
      Response.json({ error: message }, { status: 500 })
    );

    logActivity.mockResolvedValue(undefined);

    // Mock transaction to run the callback synchronously passing mocked transaction client
    transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        category: { create: categoryCreate },
        product: { create: productCreate },
        customer: { create: customerCreate },
        supplier: { create: supplierCreate },
        branchExpense: { create: branchExpenseCreate },
        userShop: { create: userShopCreate },
        cashMovement: { create: vi.fn() }
      })
    );
  });

  describe('Categories API (/api/categories)', () => {
    it('GET should load categories list successfully', async () => {
      categoryFindMany.mockResolvedValue([{ id: 'cat-1', name: 'General', slug: 'general' }]);

      const { GET } = await import('@/app/api/categories/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.categories).toHaveLength(1);
      expect(data.categories[0].name).toBe('General');
    });

    it('POST should create a new category when validation passes', async () => {
      categoryFindFirst.mockResolvedValue(null);
      categoryCreate.mockResolvedValue({ id: 'cat-2', name: 'Spare Parts', slug: 'spare-parts' });

      const { POST } = await import('@/app/api/categories/route');
      const response = await POST(
        new Request('http://localhost/api/categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Spare Parts' })
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.category.name).toBe('Spare Parts');
    });
  });

  describe('Products API (/api/products)', () => {
    it('GET should load products successfully', async () => {
      productFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/products/route');
      const response = await GET(new Request('http://localhost/api/products'));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.products).toBeDefined();
    });
  });

  describe('Customers API (/api/customers)', () => {
    it('GET should load customers successfully', async () => {
      customerFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/customers/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.customers).toBeDefined();
    });

    it('POST should create a customer when validation passes', async () => {
      customerFindFirst.mockResolvedValue(null);
      customerCreate.mockResolvedValue({
        id: 'cust-1',
        type: 'INDIVIDUAL',
        firstName: 'Ali',
        lastName: 'Ahmed',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const { POST } = await import('@/app/api/customers/route');
      const response = await POST(
        new Request('http://localhost/api/customers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'INDIVIDUAL', firstName: 'Ali', lastName: 'Ahmed', phone: '01012345678' })
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.customer.firstName).toBe('Ali');
    });
  });

  describe('Suppliers API (/api/suppliers)', () => {
    it('GET should load suppliers successfully', async () => {
      supplierFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/suppliers/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.suppliers).toBeDefined();
    });

    it('POST should create a supplier when validation passes', async () => {
      supplierFindFirst.mockResolvedValue(null);
      supplierCreate.mockResolvedValue({ id: 'supp-1', name: 'Dealer One' });

      const { POST } = await import('@/app/api/suppliers/route');
      const response = await POST(
        new Request('http://localhost/api/suppliers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Dealer One', phone: '01234567890' })
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.supplier.name).toBe('Dealer One');
    });
  });

  describe('Expenses API (/api/expenses)', () => {
    it('GET should load expenses successfully', async () => {
      branchExpenseFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/expenses/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.expenses).toBeDefined();
    });
  });

  describe('Staff API (/api/staff)', () => {
    it('GET should load staff list successfully', async () => {
      userShopFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/staff/route');
      const response = await GET(new Request('http://localhost/api/staff'));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toBeDefined();
    });
  });

  describe('Debts API (/api/debts)', () => {
    it('GET should load debts successfully', async () => {
      dealerDebtFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/debts/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.debts).toBeDefined();
    });
  });

  describe('Dues API (/api/dues)', () => {
    it('GET should load dues successfully', async () => {
      installmentCompanyDueFindMany.mockResolvedValue([]);
      reservationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/dues/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.installmentDues).toBeDefined();
      expect(data.reservations).toBeDefined();
    });
  });

  describe('Traffic API (/api/traffic)', () => {
    it('GET should load traffic invoices successfully', async () => {
      trafficInvoiceFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/traffic/route');
      const response = await GET(new Request('http://localhost/api/traffic'));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invoices).toBeDefined();
    });
  });
});
