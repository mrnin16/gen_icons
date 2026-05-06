export function SkeletonGrid({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-md skeleton border border-[var(--border)]"
        />
      ))}
    </div>
  );
}
