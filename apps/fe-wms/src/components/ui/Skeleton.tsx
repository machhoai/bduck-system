/**
 * Skeleton — Reusable skeleton loading component
 *
 * ► Mô phỏng cấu trúc UI sắp hiển thị bằng shimmer animation
 * ► LUẬT THÉP: Dùng skeleton thay vì spinner/blank screen
 * ► Hỗ trợ: text lines, rectangles, circles, custom shapes
 */

interface SkeletonProps {
  /** Width — Tailwind class hoặc inline */
  className?: string;
  /** Variant kiểu skeleton */
  variant?: "text" | "rect" | "circle";
  /** Số lượng dòng (chỉ dùng với variant='text') */
  lines?: number;
}

/** Single skeleton block */
export function Skeleton({ className = "", variant = "rect" }: SkeletonProps) {
  const baseClass = "skeleton-pulse rounded";

  const variantClass = {
    text: "h-4 rounded-md",
    rect: "rounded-lg",
    circle: "rounded-full",
  }[variant];

  return <div className={`${baseClass} ${variantClass} ${className}`} />;
}

/** Multiple text lines skeleton */
export function SkeletonLines({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? "w-3/5" : "w-full"}
        />
      ))}
    </div>
  );
}

export default Skeleton;
