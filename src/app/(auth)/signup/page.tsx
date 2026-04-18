import { SignupFlow } from "./signup-flow";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-white px-4 py-8">
      
      {/* Background Soft Gradients */}
      <div className="fixed -right-[15%] -top-[10%] h-[700px] w-[700px] rounded-full bg-mint/20 blur-[120px] pointer-events-none" />
      <div className="fixed -left-[10%] top-[40%] h-[600px] w-[600px] rounded-full bg-mint/15 blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 flex w-full max-w-[1000px] flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        
        {/* Left Side: Logo, Hero Text, and Bullet Points */}
        <div className="flex w-full flex-col items-center pt-8 lg:max-w-[450px] lg:items-start">

          {/* Hero Text - HIDDEN on mobile, visible on desktop */}
          <div className="hidden text-left lg:mb-8 lg:block">
            <h1 
              className="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl"
              style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
            >
              Ministry management, <br />
              finally <span className="text-mint">simplified.</span>
            </h1>
          </div>

          {/* Bullet Points - HIDDEN on mobile, visible on desktop */}
          <div className="hidden flex-col gap-4 text-[15px] text-gray-700 lg:flex" style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}>
            {[
              "Task Management that keeps everyone on track",
              "Log Care interactions and reports so the right people see it",
              "Volunteer scheduling & group management",
              "AI to help you do tasks even faster"
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-mint text-mint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The Form Container (Right Side) */}
        <div className="w-full max-w-[420px] rounded-2xl bg-white/70 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-8">
          <SignupFlow />
        </div>

      </div>
    </main>
  );
}