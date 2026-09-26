import Link from "next/link";

export default function HomePage() {
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{boothName}</h1>
      <Link href="/login" className="text-sm underline">
        Staff login
      </Link>
    </main>
  );
}
