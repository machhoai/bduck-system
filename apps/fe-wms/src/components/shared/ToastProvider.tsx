'use client';

/**
 * ToastProvider — Global Provider cho hệ thống thông báo goey-toast.
 *
 * Được mount 1 lần duy nhất tại root layout.
 * Component này là 'use client' để không phá vỡ SSR của layout.tsx.
 */
import { GoeyToaster } from 'goey-toast';
import 'goey-toast/styles.css';

export default function ToastProvider() {
    return <GoeyToaster position="top-right" />;
}