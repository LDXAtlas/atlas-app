import Link from "next/link";
import { CreditCard, User, Bell } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#2D333A] mb-6" style={{ fontFamily: "var(--font-poppins)" }}>
        Settings
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/settings/subscription"
          className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#5CE1A5] hover:shadow-md transition-all"
        >
          <div className="size-10 rounded-xl bg-[#5CE1A5]/10 flex items-center justify-center shrink-0">
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

        <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E5E7EB] opacity-50">
          <div className="size-10 rounded-xl bg-[#F4F5F7] flex items-center justify-center shrink-0">
            <User className="size-5 text-[#6B7280]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
              Profile
            </h3>
            <p className="text-[13px] text-[#6B7280] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
              Coming soon
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E5E7EB] opacity-50">
          <div className="size-10 rounded-xl bg-[#F4F5F7] flex items-center justify-center shrink-0">
            <Bell className="size-5 text-[#6B7280]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#2D333A]" style={{ fontFamily: "var(--font-poppins)" }}>
              Notifications
            </h3>
            <p className="text-[13px] text-[#6B7280] mt-0.5" style={{ fontFamily: "var(--font-source-sans)" }}>
              Coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
