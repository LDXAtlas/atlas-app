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
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        
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
          className="animate-fade-in text-center text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl"
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          Ministry Made Simple.
          <br />
          <span className="text-mint">All In One Place.</span>
        </h1>

        <p
          className="animate-fade-in-delay-1 mt-5 max-w-lg text-center text-[17px] text-gray-600"
          style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
        >
          The all-in-one platform for church teams to plan, communicate,
          care for people, and grow together — powered by AI.
        </p>

        {/* CTA Container */}
        <div className="animate-fade-in-delay-2 mt-10 flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-full bg-mint px-8 font-semibold text-gray-900 transition-all duration-200 hover:bg-mint/80 hover:shadow-lg hover:shadow-mint/20 active:scale-[0.97]"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            Sign In
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
          <Link
            href="/signup"
            className="flex h-12 w-full items-center justify-center rounded-full border border-gray-200 px-8 font-semibold text-gray-900 transition-all duration-200 hover:border-mint hover:text-mint active:scale-[0.97]"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            Create Account
          </Link>
          
          <p
            className="mt-2 text-center text-[13px] text-gray-400"
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            Free 30-day trial &middot; No credit card required
          </p>
        </div>

      </div>

      {/* Right side — preview carousel (desktop only) */}
      <div className="relative z-10 hidden flex-1 overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gray-50/80" />
        
        {/* NEW: Smooth transition gradient masking the hard line */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-32 bg-gradient-to-r from-white to-transparent" />
        
        <PreviewCarousel />
      </div>
    </main>
  );
}