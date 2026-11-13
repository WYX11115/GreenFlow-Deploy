import { FlaskConical } from 'lucide-react';

export function DemoBanner() {
  return (
    <div className="bg-sun px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-ink sm:text-xs">
      <span className="inline-flex items-center gap-2">
        <FlaskConical aria-hidden="true" size={15} strokeWidth={2.5} />
        Demo · local blockchain · mock USD · simulated identities &amp; verification
      </span>
    </div>
  );
}

