import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold">Bazaar</span>
        <span className="text-zinc-500 font-mono text-xs">amp/0.1</span>
      </div>
      <div className="flex gap-5 text-sm">
        <Link href="/" className="text-indigo-400 hover:underline">
          Demo
        </Link>
        <Link href="/market" className="text-indigo-400 hover:underline">
          Marketplace
        </Link>
        <Link href="/dev" className="text-indigo-400 hover:underline">
          Dev Console
        </Link>
      </div>
    </nav>
  );
}
