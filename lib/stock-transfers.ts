export const STOCK_TRANSFER_STATUS_OPTIONS = ['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;

export type StockTransferStatusValue = (typeof STOCK_TRANSFER_STATUS_OPTIONS)[number];
export type StockTransferTone = 'stone' | 'emerald' | 'amber' | 'red' | 'blue';

const STOCK_TRANSFER_STATUS_LABELS: Record<StockTransferStatusValue, string> = {
  DRAFT: 'Pending dispatch',
  IN_TRANSIT: 'Sent to destination',
  RECEIVED: 'Received by destination',
  CANCELLED: 'Cancelled'
};

export function getStockTransferStatusLabel(status: StockTransferStatusValue | string) {
  return STOCK_TRANSFER_STATUS_LABELS[status as StockTransferStatusValue] ?? String(status).replaceAll('_', ' ');
}

export function stockTransferStatusTone(status: StockTransferStatusValue | string): StockTransferTone {
  switch (status) {
    case 'RECEIVED':
      return 'emerald';
    case 'IN_TRANSIT':
      return 'blue';
    case 'CANCELLED':
      return 'red';
    default:
      return 'amber';
  }
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeStockTransferItem<
  T extends {
    id: string;
    fromProductId: string;
    toProductId: string;
    productNameSnapshot: string;
    destinationProductNameSnapshot: string;
    qty: number;
    createdAt: Date;
    fromProduct?: {
      id: string;
      name: string;
      stockQty: number;
      sku: string | null;
      barcode: string | null;
    } | null;
    toProduct?: {
      id: string;
      name: string;
      stockQty: number;
      sku: string | null;
      barcode: string | null;
    } | null;
  }
>(item: T) {
  return {
    id: item.id,
    fromProductId: item.fromProductId,
    toProductId: item.toProductId,
    productNameSnapshot: item.productNameSnapshot,
    destinationProductNameSnapshot: item.destinationProductNameSnapshot,
    qty: Number(item.qty),
    createdAt: item.createdAt.toISOString(),
    fromProduct: item.fromProduct
      ? {
          id: item.fromProduct.id,
          name: item.fromProduct.name,
          stockQty: Number(item.fromProduct.stockQty),
          sku: item.fromProduct.sku,
          barcode: item.fromProduct.barcode
        }
      : null,
    toProduct: item.toProduct
      ? {
          id: item.toProduct.id,
          name: item.toProduct.name,
          stockQty: Number(item.toProduct.stockQty),
          sku: item.toProduct.sku,
          barcode: item.toProduct.barcode
        }
      : null
  };
}

export function serializeStockTransfer<
  T extends {
    id: string;
    fromShopId: string;
    toShopId: string;
    transferNumber: string;
    status: string;
    notes: string | null;
    sentAt: Date | null;
    receivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    fromShop?: { id: string; name: string } | null;
    toShop?: { id: string; name: string } | null;
    createdByUser?: { id: string; name: string | null; email: string } | null;
    receivedByUser?: { id: string; name: string | null; email: string } | null;
    items?: Array<{
      id: string;
      fromProductId: string;
      toProductId: string;
      productNameSnapshot: string;
      destinationProductNameSnapshot: string;
      qty: number;
      createdAt: Date;
      fromProduct?: {
        id: string;
        name: string;
        stockQty: number;
        sku: string | null;
        barcode: string | null;
      } | null;
      toProduct?: {
        id: string;
        name: string;
        stockQty: number;
        sku: string | null;
        barcode: string | null;
      } | null;
    }>;
  }
>(stockTransfer: T) {
  return {
    id: stockTransfer.id,
    fromShopId: stockTransfer.fromShopId,
    toShopId: stockTransfer.toShopId,
    transferNumber: stockTransfer.transferNumber,
    status: stockTransfer.status,
    notes: stockTransfer.notes ?? null,
    sentAt: serializeDate(stockTransfer.sentAt),
    receivedAt: serializeDate(stockTransfer.receivedAt),
    createdAt: stockTransfer.createdAt.toISOString(),
    updatedAt: stockTransfer.updatedAt.toISOString(),
    fromShop: stockTransfer.fromShop
      ? {
          id: stockTransfer.fromShop.id,
          name: stockTransfer.fromShop.name
        }
      : null,
    toShop: stockTransfer.toShop
      ? {
          id: stockTransfer.toShop.id,
          name: stockTransfer.toShop.name
        }
      : null,
    createdByUser: stockTransfer.createdByUser
      ? {
          id: stockTransfer.createdByUser.id,
          name: stockTransfer.createdByUser.name,
          email: stockTransfer.createdByUser.email
        }
      : null,
    receivedByUser: stockTransfer.receivedByUser
      ? {
          id: stockTransfer.receivedByUser.id,
          name: stockTransfer.receivedByUser.name,
          email: stockTransfer.receivedByUser.email
        }
      : null,
    items: stockTransfer.items?.map(serializeStockTransferItem) ?? []
  };
}
