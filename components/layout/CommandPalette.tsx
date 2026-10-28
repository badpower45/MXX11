'use client';

import { ShopRole } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type QuickAction = {
  id: string;
  label: string;
  description: string;
  minRole: ShopRole;
  href?: string;
  action?: () => void;
};

const ROLE_WEIGHT: Record<ShopRole, number> = {
  CASHIER: 1,
  STOCK_COUNTER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export default function CommandPalette({ role }: { role: ShopRole }) {
  const router = useRouter();
  const t = useTranslations('commandPalette');
  const localizedPath = useLocalizedPath();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'new-sale',
        label: t('actions.newSale.label'),
        description: t('actions.newSale.description'),
        minRole: 'CASHIER',
        href: '/checkout'
      },
      {
        id: 'shipments',
        label: 'شحنات وتموين السفن',
        description: 'تتبع طلبات تموين السفن ومراحل التوريد والتسليم',
        minRole: 'CASHIER',
        href: '/shipments'
      },
      {
        id: 'open-register',
        label: t('actions.openRegister.label'),
        description: t('actions.openRegister.description'),
        minRole: 'CASHIER',
        href: '/register/open'
      },
      {
        id: 'close-register',
        label: t('actions.closeRegister.label'),
        description: t('actions.closeRegister.description'),
        minRole: 'CASHIER',
        href: '/register/close'
      },
      {
        id: 'register-history',
        label: t('actions.registerHistory.label'),
        description: t('actions.registerHistory.description'),
        minRole: 'CASHIER',
        href: '/register/daily'
      },
      {
        id: 'add-product',
        label: t('actions.addProduct.label'),
        description: t('actions.addProduct.description'),
        minRole: 'MANAGER',
        href: '/products#new-product'
      },
      {
        id: 'add-supplier',
        label: t('actions.addSupplier.label'),
        description: t('actions.addSupplier.description'),
        minRole: 'MANAGER',
        href: '/suppliers#new-supplier'
      },
      {
        id: 'record-purchase',
        label: t('actions.recordPurchase.label'),
        description: t('actions.recordPurchase.description'),
        minRole: 'MANAGER',
        href: '/purchases#record-purchase'
      },
      {
        id: 'branch-transfer',
        label: t('actions.branchTransfer.label'),
        description: t('actions.branchTransfer.description'),
        minRole: 'MANAGER',
        href: '/transfers'
      },
      {
        id: 'inventory-adjustment',
        label: t('actions.inventoryAdjustment.label'),
        description: t('actions.inventoryAdjustment.description'),
        minRole: 'MANAGER',
        href: '/inventory#adjust-stock'
      },
      {
        id: 'activity-log',
        label: t('actions.activityLog.label'),
        description: t('actions.activityLog.description'),
        minRole: 'MANAGER',
        href: '/activity'
      },
      {
        id: 'staff',
        label: t('actions.staff.label'),
        description: t('actions.staff.description'),
        minRole: 'ADMIN',
        href: '/staff'
      },
      {
        id: 'export-inventory',
        label: t('actions.exportInventory.label'),
        description: t('actions.exportInventory.description'),
        minRole: 'MANAGER',
        action: () => {
          window.location.assign('/api/inventory/export');
        }
      }
    ],
    [t]
  );

  const roleLabels: Record<ShopRole, string> = useMemo(
    () => ({
      ADMIN: t('roles.ADMIN'),
      MANAGER: t('roles.MANAGER'),
      CASHIER: t('roles.CASHIER'),
      STOCK_COUNTER: t('roles.STOCK_COUNTER') || 'Stock Counter'
    }),
    [t]
  );

  const visibleActions = actions.filter((item) => ROLE_WEIGHT[role] >= ROLE_WEIGHT[item.minRole]);
  const filteredActions = visibleActions.filter((item) =>
    [item.label, item.description].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runAction(action: QuickAction) {
    setOpen(false);
    setQuery('');

    if (action.action) {
      action.action();
      return;
    }

    if (action.href) {
      router.push(action.href);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/82 px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-stone-950"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M10 6H6a2 2 0 0 0-2 2v10h10a2 2 0 0 0 2-2v-4" />
              <path d="M14 4h6v6" />
              <path d="m20 4-9 9" />
            </svg>
          </span>
          <span>{t('trigger')}</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Ctrl K
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-stone-950/45 px-4 py-12"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto max-w-2xl rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_40px_120px_-48px_rgba(28,25,23,0.55)] backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{t('launcher')}</div>
                <h2 className="mt-2 text-2xl font-black text-stone-950">{t('title')}</h2>
                <p className="mt-1 text-sm text-stone-500">{t('description')}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-500 hover:text-stone-900"
              >
                Esc
              </button>
            </div>

            <Input
              autoFocus
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="mt-4 space-y-2 max-h-[min(60vh,26rem)] overflow-y-auto pe-1">
              {filteredActions.length ? (
                filteredActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => runAction(item)}
                    className="flex w-full items-start justify-between gap-4 rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(245,245,244,0.88))] px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))]"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{item.label}</div>
                      <div className="mt-1 text-sm text-stone-500">{item.description}</div>
                    </div>
                    <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {roleLabels[item.minRole] ?? item.minRole}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                  {t('empty')}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
