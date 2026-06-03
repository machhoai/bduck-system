import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility gộp và merge Tailwind CSS class names.
 * Sử dụng clsx để xử lý điều kiện + tailwind-merge để loại bỏ conflict.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
