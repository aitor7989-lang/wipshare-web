import Link from 'next/link';

export default function ClipNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-6 gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Clip not found</h1>
      <p className="text-sm text-muted max-w-md">
        This clip may not be ready yet, or it doesn&apos;t exist. If you just
        uploaded it, give it a moment and refresh.
      </p>
      <Link href="/" className="text-accent text-sm hover:underline mt-2">
        ← Back to home
      </Link>
    </main>
  );
}
