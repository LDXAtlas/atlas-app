import Image from "next/image";
import Link from "next/link";
import { PreviewCarousel } from "./preview-carousel";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Left side — branding + CTA */}
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 lg:items-start lg:pl-20 lg:pr-12 xl:pl-28">
        <div className="animate-fade-in">
          <Image
            src="/atlas-logo.png"
            alt="Atlas Church Solutions"
            width={280}
            height={70}
            priority
          />
        </div>

        <p
          className="animate-fade-in-delay-1 text-lg text-[#5CE1A5]"
          style={{
            fontFamily: "var(--font-source-sans), system-ui, sans-serif",
          }}
        >
          One platform. Every tool your church needs to
          <br />
          run, grow, and care for people.
        </p>

        <div className="flex w-full max-w-xs animate-fade-in-delay-2 flex-col gap-4">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#5CE1A5] px-8 font-semibold text-[#060C09] transition-all duration-200 hover:bg-[#A0F1C8] hover:shadow-lg hover:shadow-[#5CE1A5]/20 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex h-12 w-full items-center justify-center rounded-full border border-[#5CE1A5]/30 px-8 font-semibold text-[#5CE1A5] transition-all duration-200 hover:border-[#5CE1A5] hover:bg-[#5CE1A5]/10 hover:shadow-lg hover:shadow-[#5CE1A5]/10 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Create Account
          </Link>
        </div>
      </main>

      {/* Right side — full-height vertical scroll carousel */}
      <div className="relative hidden flex-1 overflow-hidden bg-gray-50/60 lg:block">
        <PreviewCarousel />
      </div>
    </div>
  );
}
