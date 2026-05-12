import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Bell } from "lucide-react";
import {
  getNotificationPreferences,
  type NotificationPreferenceWithDefaults,
} from "@/app/actions/notifications";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications-config";
import { NotificationPreferences } from "./_components/notification-preferences";

export default async function NotificationSettingsPage() {
  await connection();
  const { data } = await getNotificationPreferences();

  // Build a quick lookup so the client gets a stable, complete map.
  const prefsByType = new Map<string, NotificationPreferenceWithDefaults>();
  data.forEach((p) => prefsByType.set(p.type, p));

  return (
    <div className="max-w-3xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#5CE1A5] transition-colors mb-4"
        style={{ fontFamily: "var(--font-source-sans)" }}
      >
        <ArrowLeft className="size-4" />
        Settings
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <div
          className="size-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(92, 225, 165, 0.10)" }}
        >
          <Bell className="size-5 text-[#5CE1A5]" />
        </div>
        <div>
          <h1
            className="text-[24px] text-[#2D333A] leading-tight"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Notifications
          </h1>
          <p
            className="text-[14px] text-[#6B7280] mt-1 max-w-xl"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Choose what you get notified about and how.
          </p>
        </div>
      </div>

      <NotificationPreferences
        categories={NOTIFICATION_CATEGORIES}
        initialPrefs={data}
      />
    </div>
  );
}
