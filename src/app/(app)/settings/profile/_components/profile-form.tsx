"use client";

import { useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Check, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  removeMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
  type MyProfile,
} from "@/app/actions/profiles";
import { getRoleStyle, getRoleLabel, getRoleIcon } from "@/lib/roles";

interface ProfileFormProps {
  initial: MyProfile;
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [profile, setProfile] = useState<MyProfile>(initial);
  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    fullName.trim() !== (profile.full_name ?? "") ||
    (phone.trim() || "") !== (profile.phone ?? "");

  function handleSave() {
    setError(null);
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    startTransition(async () => {
      const res = await updateMyProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.data) {
        setProfile(res.data);
        setFullName(res.data.full_name);
        setPhone(res.data.phone ?? "");
      }
      setToast("Profile saved");
      setTimeout(() => setToast(null), 2500);
    });
  }

  function handleCancel() {
    setFullName(profile.full_name);
    setPhone(profile.phone ?? "");
    setError(null);
  }

  const RoleIcon = getRoleIcon(profile.role);
  const roleStyle = getRoleStyle(profile.role);
  const roleLabel = getRoleLabel(profile.role);

  // Avatar upload state. The hidden <input type="file"> is driven by a
  // ref so the visible "Change photo" button can trigger the picker.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, startAvatarUpload] = useTransition();

  function handlePickPhoto() {
    fileInputRef.current?.click();
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startAvatarUpload(async () => {
      const res = await uploadMyAvatar(fd);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.data) {
        const next = { ...profile, avatar_url: res.data.avatar_url };
        setProfile(next);
      }
      setToast("Photo updated");
      setTimeout(() => setToast(null), 2500);
    });
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  }

  function handleRemovePhoto() {
    setError(null);
    startAvatarUpload(async () => {
      const res = await removeMyAvatar();
      if (!res.success) {
        setError(res.error);
        return;
      }
      setProfile({ ...profile, avatar_url: null });
      setToast("Photo removed");
      setTimeout(() => setToast(null), 2500);
    });
  }

  return (
    <div className="space-y-5">
      {/* Avatar card */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 flex items-center gap-4 flex-wrap">
        <Avatar
          id={profile.id}
          avatarUrl={profile.avatar_url}
          fullName={profile.full_name}
          email={profile.email}
          size={80}
          ring={false}
        />
        <div className="flex-1 min-w-0">
          <h3
            className="text-[14px] text-[#0F172A]"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
          >
            Profile photo
          </h3>
          <p
            className="text-[12.5px] text-[#6B7280] mt-1"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Upload a photo to personalize your profile. Until then a
            color is generated from your account id so you stay easy to
            recognize.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChosen}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePickPhoto}
            disabled={uploadingAvatar || pending}
            className="h-9 px-3.5 rounded-xl border border-[#E5E7EB] text-[#2D333A] text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F4F5F7] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {uploadingAvatar ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Camera className="size-3.5" />
                {profile.avatar_url ? "Change photo" : "Upload photo"}
              </>
            )}
          </button>
          {profile.avatar_url && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={uploadingAvatar || pending}
              className="h-9 px-3 rounded-xl text-[12.5px] text-[#6B7280] hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
              aria-label="Remove photo"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          )}
        </div>
      </section>

      {/* Form card */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h3
          className="text-[14px] text-[#0F172A] mb-4"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          Personal information
        </h3>

        <div className="space-y-4">
          <Field label="Full name" required>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={120}
              disabled={pending}
              className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[14px] outline-none focus:border-[#5CE1A5] disabled:bg-[#F4F5F7]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </Field>

          <Field
            label="Phone"
            hint="Optional. Used by your team for follow-ups."
          >
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              maxLength={32}
              disabled={pending}
              className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] text-[14px] outline-none focus:border-[#5CE1A5] disabled:bg-[#F4F5F7]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            />
          </Field>

          <Field
            label="Email"
            hint="Contact an admin to change your email."
          >
            <div className="h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-[14px] text-[#2D333A] flex items-center"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {profile.email || "—"}
            </div>
          </Field>

          <Field
            label="Role"
            hint="Roles are managed by an admin in Directory → Staff Management."
          >
            <div
              className="h-10 px-3 rounded-xl border inline-flex items-center gap-1.5 self-start"
              style={{
                backgroundColor: roleStyle.bg,
                color: roleStyle.text,
                borderColor: roleStyle.border,
              }}
            >
              <RoleIcon className="size-3.5" />
              <span
                className="text-[12.5px] uppercase tracking-wider"
                style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
              >
                {roleLabel}
              </span>
            </div>
          </Field>

          <Field label="Organization">
            <div
              className="h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-[14px] text-[#2D333A] flex items-center"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {profile.organization_name || "—"}
            </div>
          </Field>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-4"
            >
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
                <p
                  className="text-[12.5px] text-red-700"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {error}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-5 pt-4 border-t border-[#F1F5F9] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!dirty || pending}
            className="h-9 px-3 rounded-xl text-[13px] text-[#6B7280] hover:bg-[#F4F5F7] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || pending}
            className="h-9 px-4 rounded-xl bg-[#5CE1A5] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#4DD395] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Save changes
              </>
            )}
          </button>
        </footer>
      </section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#0F172A] text-white text-[13px] shadow-2xl inline-flex items-center gap-2"
            style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
            role="status"
          >
            <Check className="size-3.5" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[11px] uppercase tracking-wider text-[#9CA3AF] block mb-1.5"
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 600 }}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p
          className="text-[11.5px] text-[#9CA3AF] mt-1"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
