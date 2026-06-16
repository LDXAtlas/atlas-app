"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { OrgLogo } from "@/components/org-logo";
import {
  removeOrgLogo,
  uploadOrgLogo,
} from "@/app/actions/organizations";

interface OrgLogoCardProps {
  orgName: string;
  initialLogoUrl: string | null;
  /** Server-side admin gate is enforced inside the actions; we still
   *  hide controls for non-admins so they don't see broken-looking
   *  buttons. Reads display only when isAdmin=false. */
  isAdmin: boolean;
}

export function OrgLogoCard({
  orgName,
  initialLogoUrl,
  isAdmin,
}: OrgLogoCardProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handlePick() {
    fileInputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadOrgLogo(fd);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.data) setLogoUrl(res.data.logo_url);
    });
    e.target.value = "";
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await removeOrgLogo();
      if (!res.success) {
        setError(res.error);
        return;
      }
      setLogoUrl(null);
    });
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 mb-6 flex items-center gap-4 flex-wrap">
      <OrgLogo name={orgName} logoUrl={logoUrl} size={64} />
      <div className="flex-1 min-w-0">
        <h3
          className="text-[14px] text-[#0F172A]"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Church logo
        </h3>
        <p
          className="text-[12.5px] text-[#6B7280] mt-1"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {isAdmin
            ? "PNG, JPG, WebP, or SVG. Max 5 MB. We resize to fit 256×256."
            : "Only an admin can change the church logo."}
        </p>
        {error && (
          <p
            className="text-[12px] text-red-600 mt-2"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {error}
          </p>
        )}
      </div>
      {isAdmin && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFile}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePick}
              disabled={pending}
              className="h-9 px-3.5 rounded-xl border border-[#E5E7EB] text-[#2D333A] text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F4F5F7] disabled:opacity-50"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Camera className="size-3.5" />
                  {logoUrl ? "Replace logo" : "Upload logo"}
                </>
              )}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={pending}
                className="h-9 px-3 rounded-xl text-[12.5px] text-[#6B7280] hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
                aria-label="Remove logo"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
