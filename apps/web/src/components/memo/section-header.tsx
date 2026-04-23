interface Props {
  title: string;
  count: number;
}

export function SectionHeader({ title, count }: Props) {
  return (
    <div className="flex items-baseline justify-between px-1 pt-4 pb-1">
      <h2 className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">{title}</h2>
      <span className="font-mono text-[10px] text-ink-mute">{count}</span>
    </div>
  );
}
