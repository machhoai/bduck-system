"use client";

import { useDroppable } from "@dnd-kit/core";
import type { CategoryDropPosition } from "../../utils/categoryDnd";

interface CategoryDropIndicatorProps {
  id: string;
  position: CategoryDropPosition;
  isActive: boolean;
  isInvalid: boolean;
  children?: React.ReactNode;
}

export default function CategoryDropIndicator({
  id,
  position,
  isActive,
  isInvalid,
  children,
}: CategoryDropIndicatorProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const showState = isActive || isOver;

  if (position === "into" || position === "root") {
    return (
      <div
        ref={setNodeRef}
        className={`
          rounded-lg transition-colors duration-150
          ${
            showState
              ? isInvalid
                ? "bg-[var(--color-accent-error)]/10"
                : "bg-[var(--color-brand-primary)]/10"
              : ""
          }
        `}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className="h-2 px-3">
      <div
        className={`
          h-0.5 rounded-full transition-all duration-150
          ${
            showState
              ? isInvalid
                ? "bg-[var(--color-accent-error)]"
                : "bg-[var(--color-brand-primary)]"
              : "bg-transparent"
          }
        `}
      />
    </div>
  );
}
