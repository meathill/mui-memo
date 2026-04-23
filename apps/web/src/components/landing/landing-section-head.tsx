type SectionHeadProps = {
  number: string;
  label: string;
  title: string;
};

export function SectionHead({ number, label, title }: SectionHeadProps) {
  return (
    <header className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-8">
      <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:pt-2 sm:text-[0.82rem]">
        {number} · {label}
      </p>
      <h2 className="font-serif text-[clamp(2.1rem,3.7vw,3.25rem)] leading-tight text-ink">{title}</h2>
    </header>
  );
}

export function CenteredSectionHead({ number, label, title }: SectionHeadProps) {
  return (
    <header className="mx-auto max-w-[52rem] text-center">
      <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.82rem]">
        {number} · {label}
      </p>
      <h2 className="mt-3 font-serif text-[clamp(2.1rem,3.7vw,3.25rem)] leading-tight text-ink">{title}</h2>
    </header>
  );
}
