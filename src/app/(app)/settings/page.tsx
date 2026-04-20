import Link from "next/link";
import { CreditCard, User, Bell, Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <Settings className="size-5 text-[#5CE1A5]" />
          </div>
          <h2 className="text-2xl font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
            Settings
          </h2>
        </div>
        <p className="text-[#6B7280] text-[15px] mt-2 ml-[52px]" style={{ fontFamily: "var(--font-source-sans)" }}>
          Manage your account, subscription, and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/settings/subscription"
          className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#5CE1A5] hover:shadow-md transition-all"
        >
          <div className="size-10 rounded-xl bg-[#5CE1A5]/10 flex items-center justify-center shrink-0 group-hover:bg-[#5CE1A5]/15 transition-colors">
            <CreditCard className="size-5 text-[#5CE1A5]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
              Subscription
            </h3>
            <p className="text-[13px] text-[#6B7280] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
              Manage your plan, billing, and seats
            </p>
          </div>
        </Link>

        <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E5E7EB]">
          <div className="size-10 rounded-xl bg-[#F4F5F7] flex items-center justify-center shrink-0">
            <User className="size-5 text-[#6B7280]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
              Profile
            </h3>
            <p className="text-[13px] text-[#6B7280] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
              Update your name, photo, and personal details
            </p>
            <span
              className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium text-[#5CE1A5] bg-[#5CE1A5]/8"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Coming Soon
            </span>
          </div>
        </div>

        <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E5E7EB]">
          <div className="size-10 rounded-xl bg-[#F4F5F7] flex items-center justify-center shrink-0">
            <Bell className="size-5 text-[#6B7280]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
              Notifications
            </h3>
            <p className="text-[13px] text-[#6B7280] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
              Control email, push, and in-app notification preferences
            </p>
            <span
              className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium text-[#5CE1A5] bg-[#5CE1A5]/8"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
