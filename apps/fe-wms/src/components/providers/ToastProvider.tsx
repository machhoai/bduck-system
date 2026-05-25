"use client";

import { GooeyToaster } from "goey-toast";
import "goey-toast/styles.css";

export default function ToastProvider() {
  return <GooeyToaster position="top-right" />;
}
