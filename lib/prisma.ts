import { PrismaClient } from '@prisma/client';
import { localizeDatabaseText } from './i18n/translate-db';

const globalForPrisma = globalThis as {
  prisma?: any;
};

const dbUrl = process.env.DATABASE_URL;
const formattedDbUrl = dbUrl
  ? dbUrl.includes('connection_limit=')
    ? dbUrl
    : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connection_limit=3`
  : undefined;

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: formattedDbUrl
      ? {
          db: {
            url: formattedDbUrl
          }
        }
      : undefined
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

export const prisma = (basePrisma.$extends({
  result: {
    product: {
      name: {
        needs: { name: true },
        compute(data: any) {
          return localizeDatabaseText(data.name);
        }
      },
      description: {
        needs: { description: true },
        compute(data: any) {
          return localizeDatabaseText(data.description);
        }
      }
    },
    category: {
      name: {
        needs: { name: true },
        compute(data: any) {
          return localizeDatabaseText(data.name);
        }
      }
    },
    shop: {
      name: {
        needs: { name: true },
        compute(data: any) {
          return localizeDatabaseText(data.name);
        }
      },
      legalBusinessName: {
        needs: { legalBusinessName: true },
        compute(data: any) {
          return localizeDatabaseText(data.legalBusinessName);
        }
      }
    },
    supplier: {
      name: {
        needs: { name: true },
        compute(data: any) {
          return localizeDatabaseText(data.name);
        }
      },
      contactName: {
        needs: { contactName: true },
        compute(data: any) {
          return localizeDatabaseText(data.contactName);
        }
      }
    },
    customer: {
      firstName: {
        needs: { firstName: true },
        compute(data: any) {
          return localizeDatabaseText(data.firstName);
        }
      },
      lastName: {
        needs: { lastName: true },
        compute(data: any) {
          return localizeDatabaseText(data.lastName);
        }
      },
      businessName: {
        needs: { businessName: true },
        compute(data: any) {
          return localizeDatabaseText(data.businessName);
        }
      }
    },
    notification: {
      title: {
        needs: { title: true },
        compute(data: any) {
          return localizeDatabaseText(data.title);
        }
      },
      message: {
        needs: { message: true },
        compute(data: any) {
          return localizeDatabaseText(data.message);
        }
      }
    },
    activityLog: {
      description: {
        needs: { description: true },
        compute(data: any) {
          return localizeDatabaseText(data.description);
        }
      }
    },
    sale: {
      paymentMethod: {
        needs: { paymentMethod: true },
        compute(data: any) {
          return localizeDatabaseText(data.paymentMethod);
        }
      },
      customerName: {
        needs: { customerName: true },
        compute(data: any) {
          return localizeDatabaseText(data.customerName);
        }
      },
      cashierName: {
        needs: { cashierName: true },
        compute(data: any) {
          return localizeDatabaseText(data.cashierName);
        }
      }
    },
    saleItem: {
      productName: {
        needs: { productName: true },
        compute(data: any) {
          return localizeDatabaseText(data.productName);
        }
      }
    },
    purchaseOrder: {
      notes: {
        needs: { notes: true },
        compute(data: any) {
          return localizeDatabaseText(data.notes);
        }
      }
    },
    purchaseItem: {
      productName: {
        needs: { productName: true },
        compute(data: any) {
          return localizeDatabaseText(data.productName);
        }
      }
    },
    stockCount: {
      title: {
        needs: { title: true },
        compute(data: any) {
          return localizeDatabaseText(data.title);
        }
      },
      notes: {
        needs: { notes: true },
        compute(data: any) {
          return localizeDatabaseText(data.notes);
        }
      }
    },
    stockCountItem: {
      productNameSnapshot: {
        needs: { productNameSnapshot: true },
        compute(data: any) {
          return localizeDatabaseText(data.productNameSnapshot);
        }
      },
      note: {
        needs: { note: true },
        compute(data: any) {
          return localizeDatabaseText(data.note);
        }
      }
    },
    cashSession: {
      notes: {
        needs: { notes: true },
        compute(data: any) {
          return localizeDatabaseText(data.notes);
        }
      }
    },
    cashMovement: {
      note: {
        needs: { note: true },
        compute(data: any) {
          return localizeDatabaseText(data.note);
        }
      }
    },
    parkedSale: {
      customerName: {
        needs: { customerName: true },
        compute(data: any) {
          return localizeDatabaseText(data.customerName);
        }
      },
      notes: {
        needs: { notes: true },
        compute(data: any) {
          return localizeDatabaseText(data.notes);
        }
      }
    },
    parkedSaleItem: {
      productName: {
        needs: { productName: true },
        compute(data: any) {
          return localizeDatabaseText(data.productName);
        }
      }
    },
    stockTransfer: {
      notes: {
        needs: { notes: true },
        compute(data: any) {
          return localizeDatabaseText(data.notes);
        }
      }
    },
    stockTransferItem: {
      productNameSnapshot: {
        needs: { productNameSnapshot: true },
        compute(data: any) {
          return localizeDatabaseText(data.productNameSnapshot);
        }
      },
      destinationProductNameSnapshot: {
        needs: { destinationProductNameSnapshot: true },
        compute(data: any) {
          return localizeDatabaseText(data.destinationProductNameSnapshot);
        }
      }
    },
    supplierReturn: {
      reasonSummary: {
        needs: { reasonSummary: true },
        compute(data: any) {
          return localizeDatabaseText(data.reasonSummary);
        }
      },
      notes: {
        needs: { notes: true },
        compute(data: any) {
          return localizeDatabaseText(data.notes);
        }
      }
    },
    supplierReturnItem: {
      productNameSnapshot: {
        needs: { productNameSnapshot: true },
        compute(data: any) {
          return localizeDatabaseText(data.productNameSnapshot);
        }
      }
    },
    user: {
      name: {
        needs: { name: true },
        compute(data: any) {
          return localizeDatabaseText(data.name);
        }
      }
    }
  }
})) as unknown as PrismaClient;
