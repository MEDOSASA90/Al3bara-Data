import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildAlerts, type AlertsInput, type AppAlert } from '../../domain/notifications';
import {
  notificationPermission,
  requestNotificationPermission,
  showLocalNotification,
} from '../../utils/notifications';
import { enableFcmPush } from '../../utils/fcm';

const KIND_STYLE: Record<AppAlert['kind'], string> = {
  payment_overdue: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
  payment_due: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
  lot_reappeared: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
  brochure_new: 'border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40',
  auction_soon: 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40',
};

export interface NotificationBellProps {
  alertsInput: AlertsInput;
  /** Alert ids already seen (owned by App, persisted in localStorage). */
  seen: string[];
  onMarkSeen: (ids: string[]) => void;
  onNavigate: (view: 'dashboard' | 'entities') => void;
  /** FCM token registration target (current user id). */
  userId?: string;
}

export function NotificationBell({ alertsInput, seen, onMarkSeen, onNavigate, userId }: NotificationBellProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(notificationPermission());

  const alerts = useMemo(() => buildAlerts(alertsInput), [alertsInput]);
  const unseenCount = alerts.filter((a) => !seen.includes(a.id)).length;

  /* Push unseen alerts as phone notifications whenever they change. */
  useEffect(() => {
    if (permission !== 'granted' || alerts.length === 0) return;
    for (const alert of alerts) {
      if (seen.includes(alert.id)) continue;
      showLocalNotification(alert.title, { body: alert.body, tag: alert.id });
    }
    // `seen` intentionally omitted: re-fire only when the alert set itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, permission]);

  function markAllSeen(): void {
    onMarkSeen(alerts.map((a) => a.id));
  }

  async function handleEnable(): Promise<void> {
    const next = await requestNotificationPermission();
    setPermission(next);
    if (next === 'granted') {
      /* Register FCM token for real background push (app closed). */
      if (userId) void enableFcmPush(userId);
      showLocalNotification('تم تفعيل إشعارات العبارة ✅', {
        body: 'هبعتلك إشعارات المواعيد والكراسات الجديدة واللوطات المرفوضة هنا',
        tag: 'al3bara-enabled',
      });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) markAllSeen();
          setOpen((v) => !v);
        }}
        aria-label="الإشعارات"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        🔔
        {unseenCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {unseenCount > 9 ? '٩+' : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-11 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">🔔 الإشعارات</h3>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {alerts.length} إشعار
              </span>
            </div>

            {permission === 'default' ? (
              <button
                type="button"
                onClick={() => void handleEnable()}
                className="w-full cursor-pointer border-b border-indigo-200 bg-indigo-50 px-4 py-3 text-right dark:border-indigo-800 dark:bg-indigo-950/40"
              >
                <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                  📱 فعّل إشعارات التليفون
                </p>
                <p className="mt-0.5 text-[11px] text-indigo-600 dark:text-indigo-400">
                  هتوصلك المواعيد والكراسات الجديدة واللوطات المرفوضة حتى والتطبيق مقفول
                </p>
              </button>
            ) : null}

            <div className="max-h-[60vh] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-slate-400">
                  مفيش إشعارات حاليًا — كل حاجة تمام ✅
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.map((alert) => (
                    <li key={alert.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(alert.navigateTo);
                          setOpen(false);
                        }}
                        className={`w-full cursor-pointer px-4 py-3 text-right transition hover:brightness-[0.98] ${KIND_STYLE[alert.kind]}`}
                      >
                        <p className="text-xs font-black break-words text-slate-900 dark:text-white">
                          {alert.title}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold break-words text-slate-600 dark:text-slate-300">
                          {alert.body}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
