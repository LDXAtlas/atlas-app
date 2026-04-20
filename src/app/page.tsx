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
          className="animate-fade-in-delay-1 text-lg text-muted"
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
            className="flex h-12 w-full items-center justify-center rounded-full bg-mint px-8 font-semibold text-white transition-all duration-200 hover:bg-mint-light hover:shadow-lg hover:shadow-mint/20 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex h-12 w-full items-center justify-center rounded-full border border-border px-8 font-semibold text-foreground transition-all duration-200 hover:border-mint hover:text-mint hover:shadow-lg hover:shadow-mint/10 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Create Account
          </Link>
        </div>
      </main>

      {/* Right side — full-height vertical scroll carousel */}
      <div className="relative hidden flex-1 overflow-hidden bg-surface lg:block">
        <PreviewCarousel />
      </div>
    </div>
  );
}
