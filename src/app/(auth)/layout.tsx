import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <Image
        src="/atlas-logo.png"
        alt="Atlas Church Solutions"
        width={240}
        height={60}
        priority
        className="mb-10"
      />
      {children}
    </div>
  );
}
