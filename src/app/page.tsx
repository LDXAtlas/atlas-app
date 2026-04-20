import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PreviewCarousel } from "./preview-carousel";

export default function Home() {
  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-white">
      {/* Background Soft Gradients */}
      <div className="fixed -right-[15%] -top-[10%] h-[700px] w-[700px] rounded-full bg-mint/20 blur-[120px] pointer-events-none" />
      <div className="fixed -left-[10%] top-[60%] h-[500px] w-[500px] rounded-full bg-mint/10 blur-[100px] pointer-events-none" />

      {/* Left side — branding + CTA */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 lg:items-start lg:pl-16 xl:pl-24">
        {/* Logo */}
        <div className="animate-fade-in mb-10">
          <Image
            src="/atlas-logo.png"
            alt="Atlas Church Solutions"
            width={220}
            height={55}
            priority
          />
        </div>

        {/* Heading */}
        <h1
          className="animate-fade-in text-center text-4xl font-bold leading-tight tracking-tight text-[#2D333A] lg:text-left lg:text-5xl"
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          Ministry Made Simple.
          <br />
          <span className="text-[#5CE1A5]">All In One Place.</span>
        </h1>

        <p
          className="animate-fade-in-delay-1 mt-5 text-center text-[17px] text-[#6B7280] max-w-lg lg:text-left"
          style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
        >
          The all-in-one platform for church teams to plan, communicate,
          care for people, and grow together — powered by AI.
        </p>

        {/* CTA Card */}
        <div className="animate-fade-in-delay-2 mt-10 w-full max-w-sm rounded-2xl bg-white/70 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md">
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-full bg-[#5CE1A5] px-8 font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-[#5CE1A5]/20 active:scale-[0.97]"
              style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
            >
              Sign In
              <ChevronRight className="size-4 ml-1" />
            </Link>
            <Link
              href="/signup"
              className="flex h-12 w-full items-center justify-center rounded-full border border-[#E5E7EB] px-8 font-semibold text-[#2D333A] transition-all duration-200 hover:border-[#5CE1A5] hover:text-[#5CE1A5] active:scale-[0.97]"
              style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
            >
              Create Account
            </Link>
          </div>

          <p
            className="mt-4 text-center text-[13px] text-[#9CA3AF]"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Free 30-day trial &middot; No credit card required
          </p>
        </div>

        {/* Feature pills */}
        <div className="animate-fade-in-delay-2 flex flex-wrap items-center gap-2 mt-8 justify-center lg:justify-start">
          {["Tasks & Projects", "Volunteer Scheduling", "Care Tracking", "AI Copilot", "Messaging"].map((feature) => (
            <span
              key={feature}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium text-[#6B7280] bg-white/60 border border-[#E5E7EB] backdrop-blur-sm"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* Right side — preview carousel (desktop only) */}
      <div className="relative z-10 hidden flex-1 overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[#F4F5F7]/80" />
        <PreviewCarousel />
      </div>
    </main>
  );
}
