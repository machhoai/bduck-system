export function AdminOverviewSkeleton({
  leaveFeatureEnabled,
}: {
  leaveFeatureEnabled: boolean;
}) {
  return (
    <div
      className={
        leaveFeatureEnabled
          ? "grid gap-3 lg:grid-cols-[1.15fr_0.85fr]"
          : "grid gap-3"
      }
    >
      <div className="h-52 animate-pulse rounded-[28px] bg-white" />
      {leaveFeatureEnabled && (
        <div className="h-52 animate-pulse rounded-[28px] bg-white" />
      )}
    </div>
  );
}
