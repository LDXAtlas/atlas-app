import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, User } from "lucide-react";
import { getMyProfile } from "@/app/actions/profiles";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfileSettingsPage() {
  await connection();
  const res = await getMyProfile();

  if (!res.success || !res.data) {
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
        <p
          className="text-[14px] text-[#6B7280]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {res.success ? "Profile not found." : res.error}
        </p>
      </div>
    );
  }

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
          <User className="size-5 text-[#5CE1A5]" />
        </div>
        <div>
          <h1
            className="text-[24px] text-[#2D333A] leading-tight"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            My Profile
          </h1>
          <p
            className="text-[14px] text-[#6B7280] mt-1 max-w-xl"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Manage your personal information. Email and role are
            managed by your organization administrator.
          </p>
        </div>
      </div>

      <ProfileForm initial={res.data} />
    </div>
  );
}
