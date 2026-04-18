import { LoginForm } from "./login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-white px-4">
      
      {/* Background Soft Gradients
        Changed from 'absolute' to 'fixed' to completely prevent the clipping issue you saw!
      */}
      <div className="fixed -right-[15%] -top-[10%] h-[700px] w-[700px] rounded-full bg-mint/20 blur-[120px] pointer-events-none" />
      <div className="fixed -left-[10%] top-[40%] h-[600px] w-[600px] rounded-full bg-mint/15 blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 flex w-full flex-col items-center">
        
        {/* Hero Text */}
        <div className="mb-8 max-w-[500px] text-center">
          <h1 
            className="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            Welcome back. <br className="hidden sm:block" />
            Your ministry <span className="text-mint">is waiting.</span>
          </h1>
        </div>

        {/* The Form Container */}
        <div className="w-full max-w-[380px] rounded-2xl bg-white/70 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-8">
          <LoginForm />
        </div>

      </div>
    </main>
  );
}