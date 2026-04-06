import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-white">
      <main className="flex flex-col items-center justify-center gap-10 px-6">
        {/* Atlas Logo */}
        <Image
          src="/atlas-logo.png"
          alt="Atlas Church Solutions"
          width={320}
          height={80}
          priority
        />

        {/* Message */}
        <p
          className="text-lg text-[#5CE1A5]"
          style={{
            fontFamily: "var(--font-source-sans), system-ui, sans-serif",
          }}
        >
          Your ministry is waiting.
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#5CE1A5] px-8 text-[#060C09] font-semibold transition-colors hover:bg-[#A0F1C8]"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex h-12 w-full items-center justify-center rounded-full border border-[#5CE1A5]/30 px-8 text-[#5CE1A5] font-semibold transition-colors hover:border-[#5CE1A5] hover:bg-[#5CE1A5]/10"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            Create Account
          </Link>
        </div>
      </main>
    </div>
  );
}
