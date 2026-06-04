"use client";

/**
 * NotificationBell — Header notification bell icon with dropdown
 *
 * Features:
 * - Realtime unread count badge (LUẬT THÉP: onSnapshot driven)
 * - Dropdown panel with notification list
 * - Click notification → mark as read
 * - "Mark all as read" action
 * - Skeleton loading state
 * - Light Theme only
 */

import { useState, useRef, useEffect } from "react";
import { Bell, BellDot, CheckCheck, Clock, ExternalLink } from "lucide-react";
import {
    useNotifications,
    resolveTemplate,
} from "@/hooks/useNotifications";
import type { InAppNotification } from "@/hooks/useNotifications";

export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
        useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const handleNotificationClick = async (notif: InAppNotification) => {
        if (!notif.is_read) {
            await markAsRead(notif.id);
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Vừa xong";
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        if (days < 7) return `${days} ngày trước`;
        return date.toLocaleDateString("vi-VN");
    };

    return (
        <div className="relative h-full bg-white rounded-full aspect-square cursor-pointer shadow-sm" ref={dropdownRef}>
            {/* Bell button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex h-full aspect-square items-center justify-center rounded-full 
          text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Thông báo"
            >
                {unreadCount > 0 ? (
                    <BellDot className="h-5 w-5" />
                ) : (
                    <Bell className="h-5 w-5" />
                )}

                {/* Unread count badge */}
                {unreadCount > 0 && (
                    <span
                        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center 
              justify-center rounded-full bg-[var(--color-accent-error)] px-1 text-xxs font-bold text-white
              animate-in fade-in zoom-in duration-200"
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div
                    className="absolute right-0 top-full z-10000 mt-2 w-80 overflow-hidden rounded-xl 
            border border-gray-200 bg-white shadow-xl shadow-gray-200/50
            animate-in fade-in slide-in-from-top-2 duration-200 sm:w-96"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <h3 className="text-sm font-bold text-gray-900">Thông báo</h3>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllAsRead}
                                className="flex items-center gap-1 text-xs font-medium text-[var(--color-brand-primary)] 
                  transition-colors hover:text-[var(--color-brand-primary-hover)]"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Đánh dấu tất cả đã đọc
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="space-y-0">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse border-b border-gray-50 px-4 py-3"
                                    >
                                        <div className="h-3 w-3/4 rounded bg-gray-200" />
                                        <div className="mt-1.5 h-2.5 w-1/2 rounded bg-gray-100" />
                                    </div>
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10">
                                <Bell className="h-8 w-8 text-gray-300" />
                                <p className="text-xs text-gray-400">
                                    Chưa có thông báo nào
                                </p>
                            </div>
                        ) : (
                            notifications.slice(0, 20).map((notif) => (
                                <button
                                    key={notif.id}
                                    type="button"
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 
                    text-left transition-colors hover:bg-gray-50
                    ${!notif.is_read ? "bg-[var(--color-brand-primary-muted)]" : ""}`}
                                >
                                    {/* Unread dot */}
                                    <div className="mt-1.5 flex-shrink-0">
                                        {!notif.is_read ? (
                                            <div className="h-2 w-2 rounded-full bg-[var(--color-brand-primary)]" />
                                        ) : (
                                            <div className="h-2 w-2" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`text-sm leading-snug ${!notif.is_read
                                                ? "font-semibold text-gray-900"
                                                : "text-gray-600"
                                                }`}
                                        >
                                            {resolveTemplate(notif.template_key)}
                                        </p>
                                        <div className="mt-1 flex items-center gap-2 text-xxs text-gray-400">
                                            <Clock className="h-3 w-3" />
                                            <span>{formatTime(notif.created_at)}</span>
                                            {notif.source_entity_id && (
                                                <ExternalLink className="h-3 w-3" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="border-t border-gray-100 px-4 py-2.5">
                            <p className="text-center text-xxs text-gray-400">
                                {notifications.length} thông báo
                                {unreadCount > 0 && ` · ${unreadCount} chưa đọc`}
                            </p>
                        </div>
                    )}
                    <div className="px-4 py-1 text-center text-xs text-[var(--color-text-muted)]">
                        v{process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev"}
                    </div>
                </div>
            )}
        </div>
    );
}
