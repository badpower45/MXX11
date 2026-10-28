'use client';

import Link from 'next/link';
import { useMemo, useState, useRef, useEffect } from 'react';
import { dateTime } from '@/lib/format';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

function getNotificationHref(type: string, localize: (path: string) => string) {
  switch (type) {
    case 'LOW_STOCK':
      return localize('/inventory');
    case 'DAILY_SUMMARY':
      return localize('/dashboard');
    case 'SHIPMENT_ASSIGNED':
    case 'SHIPMENT_STAGE_CHANGED':
      return localize('/shipments');
    default:
      return localize('/activity');
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'SHIPMENT_ASSIGNED':
    case 'SHIPMENT_STAGE_CHANGED':
      return { icon: '🚢', bg: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'LOW_STOCK':
      return { icon: '⚠️', bg: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'DAILY_SUMMARY':
      return { icon: '📊', bg: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    default:
      return { icon: '🔔', bg: 'bg-sky-100 text-sky-700 border-sky-200' };
  }
}

export default function NotificationsBell({
  initialNotifications
}: {
  initialNotifications: NotificationItem[];
}) {
  const t = useTranslations('notifications');
  const localizedPath = useLocalizedPath();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function markAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification
      )
    );

    await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH'
    }).catch(() => undefined);
  }

  async function markAllAsRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));

    await fetch('/api/notifications', {
      method: 'PATCH'
    }).catch(() => undefined);
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-10 items-center justify-center gap-2.5 rounded-xl border px-3 text-xs font-bold transition-all shadow-xs ${
          open
            ? 'border-blue-400 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20'
            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
        }`}
        aria-label={t('openLabel')}
        aria-expanded={open}
      >
        <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700 text-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M6 9a6 6 0 1 1 12 0v4l1.5 2.5H4.5L6 13z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -end-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </span>
        <span className="hidden sm:inline font-semibold">{t('trigger')}</span>
        {unreadCount > 0 && (
          <span className="rounded-md bg-red-50 text-red-700 px-1.5 py-0.5 text-[10px] font-bold border border-red-200">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown with Perfect Sizing */}
      {open ? (
        <div className="absolute end-0 top-full mt-2 z-50 w-[min(calc(100vw-2rem),24rem)] rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl shadow-stone-900/15 max-h-[min(82vh,34rem)] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                {t('alerts')}
              </div>
              <h2 className="text-base font-black text-stone-900 mt-0.5">{t('title')}</h2>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                {t('markAllRead')}
              </button>
            ) : null}
          </div>

          {/* Scrollable Notifications List */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pe-1 max-h-[min(58vh,22rem)] overscroll-contain">
            {notifications.length ? (
              notifications.map((notification) => {
                const iconMeta = getNotificationIcon(notification.type);
                return (
                  <Link
                    key={notification.id}
                    href={getNotificationHref(notification.type, localizedPath)}
                    onClick={() => {
                      void markAsRead(notification.id);
                      setOpen(false);
                    }}
                    className={`group flex items-start gap-3 rounded-xl border p-3 transition-all ${
                      notification.isRead
                        ? 'border-stone-100 bg-stone-50/50 text-stone-600 hover:border-stone-200 hover:bg-stone-50'
                        : 'border-blue-100 bg-blue-50/60 text-stone-800 hover:border-blue-200 hover:bg-blue-50 shadow-xs'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold shadow-xs ${iconMeta.bg}`}
                    >
                      {iconMeta.icon}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`truncate text-xs font-bold ${
                            notification.isRead ? 'text-stone-700' : 'text-stone-950 font-black'
                          }`}
                        >
                          {notification.title}
                        </span>
                        {!notification.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                        )}
                      </div>

                      <p className="mt-1 text-xs text-stone-500 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>

                      <div className="mt-1.5 text-[10px] text-stone-400 font-medium">
                        {dateTime(notification.createdAt)}
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 p-8 text-center text-xs text-stone-500">
                <span className="text-2xl block mb-2">⚓</span>
                {t('empty')}
              </div>
            )}
          </div>

          {/* Footer Link */}
          <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
            <span>{t('unread', { count: unreadCount })}</span>
            <Link
              href={localizedPath('/activity')}
              onClick={() => setOpen(false)}
              className="font-bold text-blue-700 hover:text-blue-800 hover:underline"
            >
              عرض سجل العمليات الكامل ←
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
