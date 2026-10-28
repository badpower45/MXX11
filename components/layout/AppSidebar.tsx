'use client';

import { ShopRole } from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useMemo, useState } from 'react';
import type { PermissionKey, PermissionState } from '@/lib/permissions';
import { useLocalizedPath, useTranslations, useLocale } from '@/lib/i18n/client';
import { stripLocalePrefix } from '@/lib/i18n/locales';

type SidebarProps = {
  shopName: string;
  shopType: string;
  role: ShopRole;
  permissions: PermissionState;
  activeShopId: string;
  availableShops: Array<{
    id: string;
    name: string;
    posType: string;
    role: ShopRole;
  }>;
};

type IconName =
  | 'dashboard'
  | 'checkout'
  | 'register'
  | 'sales'
  | 'returns'
  | 'stock-counts'
  | 'products'
  | 'categories'
  | 'customers'
  | 'inventory'
  | 'transfers'
  | 'suppliers'
  | 'purchases'
  | 'reports'
  | 'branches'
  | 'settings'
  | 'activity'
  | 'staff'
  | 'dues'
  | 'traffic'
  | 'expenses'
  | 'debts'
  | 'shipments';

type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  minRole: ShopRole;
  requiredPermission?: PermissionKey;
  badge?: string;
};

const ROLE_WEIGHT: Record<ShopRole, number> = {
  STOCK_COUNTER: 0,
  CASHIER: 1,
  MANAGER: 2,
  ADMIN: 3
};

function formatShopType(shopType: string) {
  return shopType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SidebarIcon({ name, active = false }: { name: IconName; active?: boolean }) {
  const common = 'h-4 w-4 shrink-0 transition-colors';
  const color = active ? 'text-white' : 'text-stone-500 group-hover:text-stone-800';

  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M4 13h7V4H4z" />
          <path d="M13 20h7v-9h-7z" />
          <path d="M13 11h7V4h-7z" />
          <path d="M4 20h7v-5H4z" />
        </svg>
      );
    case 'checkout':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M6 4h12l1 5H5z" />
          <path d="M7 9v10h10V9" />
          <path d="M10 13h4" />
        </svg>
      );
    case 'register':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5z" />
          <path d="M5 10h14" />
          <path d="M9 14h6" />
        </svg>
      );
    case 'sales':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <path d="M10 16h2" />
        </svg>
      );
    case 'returns':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M9 7H5v4" />
          <path d="M5 11a7 7 0 1 0 2-4.9" />
          <path d="M15 9h3" />
        </svg>
      );
    case 'stock-counts':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M7 4h10" />
          <path d="M6 6.5A2.5 2.5 0 0 1 8.5 4h7A2.5 2.5 0 0 1 18 6.5v11A2.5 2.5 0 0 1 15.5 20h-7A2.5 2.5 0 0 1 6 17.5z" />
          <path d="m9 11 1.8 1.8L15 8.5" />
        </svg>
      );
    case 'products':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
      );
    case 'categories':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M4 4h6v6H4z" />
          <path d="M14 4h6v6h-6z" />
          <path d="M4 14h6v6H4z" />
          <path d="M14 14h6v6h-6z" />
        </svg>
      );
    case 'customers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'inventory':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 12v10" />
        </svg>
      );
    case 'transfers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M7 7h10" />
          <path d="m13 4 4 3-4 3" />
          <path d="M17 17H7" />
          <path d="m11 14-4 3 4 3" />
        </svg>
      );
    case 'suppliers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M4 18v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5" />
          <circle cx="12" cy="6" r="3" />
        </svg>
      );
    case 'purchases':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M7 7h10" />
          <path d="M7 12h10" />
          <path d="M7 17h6" />
          <path d="M5 4h14v16H5z" />
        </svg>
      );
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M5 19V5" />
          <path d="M19 19H5" />
          <path d="m8 15 3-4 3 2 3-5" />
        </svg>
      );
    case 'branches':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="m3 9 9-5 9 5" />
          <path d="M4 9h16v10H4z" />
          <path d="M9 19v-6h6v6" />
        </svg>
      );
    case 'activity':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M4 12h4l2-4 4 8 2-4h4" />
          <path d="M4 5h16v14H4z" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.4 1.9" />
        </svg>
      );
    case 'staff':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M7 19v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1" />
          <circle cx="12" cy="7" r="3" />
          <path d="M4 19v-.5A3.5 3.5 0 0 1 7.5 15" />
          <path d="M20 19v-.5A3.5 3.5 0 0 0 16.5 15" />
        </svg>
      );
    case 'dues':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <path d="M6 14h2" />
          <path d="M11 14h3" />
        </svg>
      );
    case 'expenses':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          <path d="M17 19l4-4-4-4" />
        </svg>
      );
    case 'debts':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="16" x2="13" y2="16" />
        </svg>
      );
    case 'shipments':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <path d="M2 20a4 4 0 0 0 4 0 4 4 0 0 1 4 0 4 4 0 0 0 4 0 4 4 0 0 1 4 0 4 4 0 0 0 4 0" />
          <path d="m4 17 1.5-6h13l1.5 6" />
          <path d="M9 11V6h6v5" />
          <path d="M12 2v4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} ${color}`}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export default function AppSidebar({
  shopName,
  shopType,
  role,
  permissions,
  activeShopId,
  availableShops
}: SidebarProps) {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname);
  const localizedPath = useLocalizedPath();
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const router = useRouter();
  const tNav = useTranslations('nav');
  const tSidebar = useTranslations('layout.sidebar');
  const tRoles = useTranslations('roles');
  const tShopTypes = useTranslations('shopTypes');
  const tCommon = useTranslations('common');

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [switchingShop, setSwitchingShop] = useState(false);
  const [switchError, setSwitchError] = useState('');

  const shopTypeLabelRaw = tShopTypes(shopType);
  const shopTypeLabel = shopTypeLabelRaw.startsWith('shopTypes.') ? formatShopType(shopType) : shopTypeLabelRaw;
  const roleLabelRaw = tRoles(role);
  const roleLabel = roleLabelRaw.startsWith('roles.') ? role : roleLabelRaw;

  // Streamlined, High-Performance Section Grouping
  const sections = useMemo<Array<{ title: string; links: NavLink[] }>>(
    () => [
      {
        title: isAr ? 'العمليات الملاحية والتموين' : 'Marine Operations',
        links: [
          {
            href: '/dashboard',
            label: isAr ? 'لوحة التحكم' : 'Dashboard',
            icon: 'dashboard',
            minRole: 'CASHIER'
          },
          {
            href: '/shipments',
            label: isAr ? 'شحنات وتموين السفن' : 'Shipments & Supply',
            icon: 'shipments',
            minRole: 'CASHIER'
          },
          {
            href: '/checkout',
            label: isAr ? 'تموين وشحن السفن (POS)' : 'POS Checkout',
            icon: 'checkout',
            minRole: 'CASHIER'
          },
          {
            href: '/sales',
            label: isAr ? 'الفواتير البحرية (D/As)' : 'Marine Invoices',
            icon: 'sales',
            minRole: 'CASHIER'
          },
          {
            href: '/parked-sales',
            label: isAr ? 'عروض أسعار (Proforma)' : 'Proforma Quotes',
            icon: 'sales',
            minRole: 'CASHIER'
          },
          {
            href: '/dues',
            label: isAr ? 'مستحقات نداءات السفن' : 'Dues & Bookings',
            icon: 'dues',
            minRole: 'CASHIER'
          },
          {
            href: '/returns',
            label: isAr ? 'المرتجعات والتسويات' : 'Returns & Credits',
            icon: 'returns',
            minRole: 'CASHIER'
          }
        ]
      },
      {
        title: isAr ? 'المخازن واللوجستيات' : 'Stores & Logistics',
        links: [
          {
            href: '/products',
            label: isAr ? 'مخزون المؤن والقطع' : 'Provisions & Stores',
            icon: 'products',
            minRole: 'MANAGER'
          },
          {
            href: '/inventory',
            label: isAr ? 'تسويات وتعديل المخزون' : 'Inventory Moves',
            icon: 'inventory',
            minRole: 'MANAGER',
            requiredPermission: 'ADJUST_INVENTORY'
          },
          {
            href: '/transfers',
            label: isAr ? 'تحويلات بين الموانئ' : 'Port Transfers',
            icon: 'transfers',
            minRole: 'MANAGER'
          },
          {
            href: '/stock-counts',
            label: isAr ? 'جرد مخازن الموانئ' : 'Stock Counts',
            icon: 'stock-counts',
            minRole: 'STOCK_COUNTER'
          },
          {
            href: '/suppliers',
            label: isAr ? 'الموردين والتجار' : 'Suppliers',
            icon: 'suppliers',
            minRole: 'MANAGER'
          },
          {
            href: '/purchases',
            label: isAr ? 'أوامر التوريد والاستلام' : 'Purchase Orders',
            icon: 'purchases',
            minRole: 'MANAGER'
          },
          {
            href: '/debts',
            label: isAr ? 'مديونيات الموردين' : 'Supplier Debts',
            icon: 'debts',
            minRole: 'MANAGER'
          }
        ]
      },
      {
        title: isAr ? 'الخزينة ومصروفات الميناء' : 'Treasury & Finance',
        links: [
          {
            href: '/register/daily',
            label: isAr ? 'خزينة وتحصيل اليومية' : 'Daily Cash & Drawers',
            icon: 'register',
            minRole: 'CASHIER'
          },
          {
            href: '/expenses',
            label: isAr ? 'مصاريف وتشغيل الميناء' : 'Port Expenses',
            icon: 'expenses',
            minRole: 'CASHIER'
          }
        ]
      },
      {
        title: isAr ? 'الإدارة والرقابة' : 'Administration & Control',
        links: [
          {
            href: '/reports',
            label: isAr ? 'التقارير الملاحية والمالية' : 'Reports & Analytics',
            icon: 'reports',
            minRole: 'ADMIN',
            requiredPermission: 'VIEW_REPORTS'
          },
          {
            href: '/staff',
            label: isAr ? 'طاقم العمل والصلاحيات' : 'Marine Staff & RBAC',
            icon: 'staff',
            minRole: 'ADMIN',
            requiredPermission: 'MANAGE_STAFF'
          },
          {
            href: '/customers',
            label: isAr ? 'التوكيلات والعملاء' : 'Shipping Agents',
            icon: 'customers',
            minRole: 'MANAGER'
          },
          {
            href: '/branches',
            label: isAr ? 'الفروع والموانئ' : 'Ports & Branches',
            icon: 'branches',
            minRole: 'CASHIER'
          },
          {
            href: '/activity',
            label: isAr ? 'سجل العمليات والرقابة' : 'Audit Log',
            icon: 'activity',
            minRole: 'MANAGER'
          },
          {
            href: '/settings',
            label: isAr ? 'إعدادات النظام' : 'System Settings',
            icon: 'settings',
            minRole: 'MANAGER'
          }
        ]
      }
    ],
    [isAr]
  );

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          links: section.links.filter(
            (link) =>
              ROLE_WEIGHT[role] >= ROLE_WEIGHT[link.minRole] &&
              (!link.requiredPermission || permissions[link.requiredPermission])
          )
        }))
        .filter((section) => section.links.length > 0),
    [permissions, role, sections]
  );

  async function switchShop(nextShopId: string) {
    if (!nextShopId || nextShopId === activeShopId) {
      return;
    }

    setSwitchError('');
    setSwitchingShop(true);

    const response = await fetch('/api/user-shops/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: nextShopId })
    });

    const data = await response.json().catch(() => ({ error: tSidebar('switchError') }));

    if (!response.ok) {
      setSwitchError(data.error ?? tSidebar('switchError'));
      setSwitchingShop(false);
      return;
    }

    router.refresh();
    setSwitchingShop(false);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-3 select-none">
      {/* Top Header Card */}
      <div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-lg shadow-sm shadow-blue-500/25">
                ⚓
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 leading-none">
                    Seaways Ops
                  </div>
                  <div className="mt-1 truncate text-sm font-black text-stone-900 tracking-tight leading-none">
                    {shopName}
                  </div>
                </div>
              )}
            </div>

            {/* Collapse toggle button on desktop */}
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-900 lg:flex transition-colors"
              title={isCollapsed ? (isAr ? 'توسيع القائمة' : 'Expand') : (isAr ? 'طي القائمة' : 'Collapse')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                {isCollapsed ? (
                  <path d="m9 18 6-6-6-6" />
                ) : (
                  <path d="m15 18-6-6 6-6" />
                )}
              </svg>
            </button>
          </div>

          {!isCollapsed && (
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-stone-600 truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>{shopTypeLabel}</span>
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 font-bold text-blue-700 border border-blue-100/60">
                {roleLabel}
              </span>
            </div>
          )}

          {!isCollapsed && availableShops.length > 1 && (
            <div className="mt-2 pt-2 border-t border-stone-100">
              <select
                className="h-8 w-full rounded-lg border border-stone-200 bg-stone-50/60 px-2 text-xs font-semibold text-stone-800 outline-none hover:bg-stone-100 focus:border-blue-500 transition-colors"
                value={activeShopId}
                onChange={(e) => void switchShop(e.target.value)}
                disabled={switchingShop}
              >
                {availableShops.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links Scrollable Area */}
      <nav className="my-3 min-h-0 flex-1 space-y-4 overflow-y-auto pe-1 overscroll-contain">
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-stone-400">
                {section.title}
              </div>
            )}

            <div className="space-y-1">
              {section.links.map((link) => {
                const active =
                  normalizedPathname === link.href ||
                  (link.href !== '/dashboard' && normalizedPathname.startsWith(`${link.href}/`));

                return (
                  <Link
                    key={link.href}
                    href={localizedPath(link.href)}
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed ? link.label : undefined}
                    className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    } ${isCollapsed ? 'justify-center px-1' : ''}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-100 text-stone-500 group-hover:bg-white group-hover:text-stone-800'
                      }`}
                    >
                      <SidebarIcon name={link.icon} active={active} />
                    </div>

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-[13px]">{link.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Sign-out Button */}
      <div className="pt-2 border-t border-stone-200/80">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: localizedPath('/login') })}
          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-stone-600 hover:bg-red-50 hover:text-red-700 transition-colors ${
            isCollapsed ? 'justify-center px-1' : ''
          }`}
          title={isAr ? 'تسجيل الخروج' : 'Sign Out'}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 group-hover:bg-red-100 group-hover:text-red-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M15 3h4v18h-4" />
              <path d="m10 17 5-5-5-5" />
              <path d="M15 12H5" />
            </svg>
          </div>
          {!isCollapsed && <span>{tCommon('signOut')}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar with Hamburger */}
      <div className="border-b border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur-md lg:hidden sticky top-0 z-40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚓</span>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">Seaways Ops</div>
              <div className="truncate text-sm font-black text-stone-900">{shopName}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setIsMobileOpen(true);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 shadow-xs"
            aria-label={tSidebar('openSidebar')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
          >
            <motion.aside
              className="h-full w-[82vw] max-w-xs border-e border-stone-200 bg-white shadow-2xl"
              initial={{ x: isAr ? 100 : -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isAr ? 100 : -100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarContent}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden border-e border-stone-200/90 bg-stone-50/70 backdrop-blur-md lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:transition-[width] lg:duration-200 ${
          isCollapsed ? 'lg:w-[76px]' : 'lg:w-[268px]'
        }`}
      >
        <div className="flex h-full w-full flex-col">{sidebarContent}</div>
      </aside>
    </>
  );
}
