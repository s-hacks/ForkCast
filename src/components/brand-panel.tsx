/** Decorative brand panel shared by the landing and sign-in pages. Static, no data. */
const LANES = [
  { label: "Prepared food", status: "Partially booked", dot: "bg-yellow-400" },
  { label: "Ingredients", status: "Not needed", dot: "bg-lime" },
  { label: "Serving", status: "Available", dot: "bg-white" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-xl font-bold tracking-tight ${className}`}>
      <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full bg-accent" />
      ForkCast
    </div>
  );
}

export function BrandPanel({ headline }: { headline: string }) {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-brand p-10 text-white">
      <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/90" />
      <div aria-hidden className="absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-lime/80" />
      <Logo className="relative" />
      <div className="relative">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{headline}</h1>
        <ul aria-label="Example meal status" className="mt-8 max-w-sm space-y-2.5">
          {LANES.map((l) => (
            <li key={l.label} className="flex items-center justify-between rounded-xl bg-white/95 px-4 py-3 text-sm text-brand shadow-lg">
              <span className="font-semibold">{l.label}</span>
              <span className="flex items-center gap-2 text-slate-600">
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full border border-slate-300 ${l.dot}`} />
                {l.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-white/70">Firehouse Ministries · Birmingham, AL</p>
    </div>
  );
}
