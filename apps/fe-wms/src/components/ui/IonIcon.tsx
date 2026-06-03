"use client";

/**
 * IonIcon — React wrapper for Ionicons SVG icons
 *
 * Usage:
 *   import { IonIcon } from "@/components/ui/IonIcon";
 *   import { homeOutline, settingsSharp, cartOutline } from "ionicons/icons";
 *
 *   <IonIcon icon={homeOutline} size={20} className="text-orange-500" />
 *   <IonIcon icon={settingsSharp} size={16} color="#3b82f6" />
 */

import { useMemo } from "react";

interface IonIconProps {
  /** SVG string from ionicons/icons (e.g. homeOutline, cartSharp) */
  icon: string;
  /** Icon size in px (default: 20) */
  size?: number;
  /** Explicit color override (CSS color value). If omitted, inherits from `currentColor` / Tailwind text-* */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  "aria-label"?: string;
}

/**
 * Extracts the inner content of an SVG string from ionicons/icons.
 * ionicons/icons exports full `<svg>...</svg>` strings — we strip the
 * outer `<svg>` wrapper so we can render our own with controlled props.
 */
function extractSvgContent(svgString: string): string {
  // Remove the outer <svg ...> and </svg> tags, keep inner paths/shapes
  return svgString
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
}

export function IonIcon({
  icon,
  size = 20,
  color,
  className = "",
  "aria-label": ariaLabel,
}: IonIconProps) {
  const innerHtml = useMemo(() => extractSvgContent(icon), [icon]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill={color || "currentColor"}
      className={`shrink-0 ${className}`}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : "presentation"}
      dangerouslySetInnerHTML={{ __html: innerHtml }}
    />
  );
}

export default IonIcon;
