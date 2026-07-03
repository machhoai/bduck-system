"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Check,
    FileText,
    FileUp,
    Search,
    Send,
    Text,
    UserRound,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { useLanFileTransfer } from "@/hooks/useLanFileTransfer";
import { useTranslation } from "@/lib/i18n";
import type { LanPresence } from "@/types/lanFileTransfer";
import {
    selectedToFiles,
    type SelectedLanFile,
} from "@/utils/lanFileSelection";
import LanFileDropZone from "./LanFileDropZone";

type LanTransferApi = ReturnType<typeof useLanFileTransfer>;

export default function LanSendPanel({ transfer }: { transfer: LanTransferApi }) {
    const { t } = useTranslation();
    const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);
    const [sendMode, setSendMode] = useState<"text" | "file">("text");
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<SelectedLanFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const files = useMemo(() => selectedToFiles(selectedFiles), [selectedFiles]);

    useEffect(() => {
        if (transfer.peers.length === 0) {
            setSelectedPeerIds([]);
            return;
        }
        setSelectedPeerIds((current) => {
            const visibleIds = new Set(transfer.peers.map((peer) => peer.id));
            const next = current.filter((id) => visibleIds.has(id));
            return next.length > 0 ? next : [transfer.peers[0].id];
        });
    }, [transfer.peers]);

    const selectedPeers = useMemo(
        () => transfer.peers.filter((peer) => selectedPeerIds.includes(peer.id)),
        [selectedPeerIds, transfer.peers],
    );
    const filteredPeers = useMemo(
        () =>
            transfer.peers.filter((peer) =>
                peer.display_name.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
        [searchQuery, transfer.peers],
    );
    const hasPayload =
        sendMode === "text" ? message.trim().length > 0 : selectedFiles.length > 0;

    const togglePeer = (peer: LanPresence) => {
        setSelectedPeerIds((current) =>
            current.includes(peer.id)
                ? current.filter((id) => id !== peer.id)
                : [...current, peer.id],
        );
    };

    const send = async () => {
        if (selectedPeers.length === 0 || !hasPayload) {
            gooeyToast.error(t.lanTransfer.missingInfo, {
                description: t.lanTransfer.missingInfoDesc,
                preset: "snappy",
            });
            return;
        }

        const action = async () => {
            setIsSubmitting(true);
            await transfer.sendRequest({
                recipients: selectedPeers,
                files: sendMode === "file" ? files : [],
                message: sendMode === "text" ? message : "",
            });
            if (sendMode === "file") setSelectedFiles([]);
            if (sendMode === "text") setMessage("");
        };

        try {
            await gooeyToast.promise(action(), {
                loading: t.lanTransfer.sendingRequest,
                success: t.lanTransfer.requestSent,
                error: t.lanTransfer.requestError,
                description: {
                    success: t.lanTransfer.requestSentDesc,
                    error: t.lanTransfer.requestErrorDesc,
                },
                action: { error: { label: t.lanTransfer.retry, onClick: () => void send() } },
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="flex h-full min-h-0 w-full flex-col gap-3">
            {sendMode === "text" && (
                <label className="grid min-h-44 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                    <span className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                        <FileText size={16} className="text-[var(--color-brand-primary)]" />
                        {t.lanTransfer.messageLabel}
                    </span>
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={t.lanTransfer.messagePlaceholder}
                        rows={3}
                        className="min-h-24 resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)]"
                    />
                </label>
            )}

            {sendMode === "file" && (
                <LanFileDropZone files={selectedFiles} onChange={setSelectedFiles} />
            )}

            <div className="flex justify-between gap-2">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setSendMode("text")}
                        className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-sm font-semibold transition ${sendMode === "text"
                            ? "bg-[var(--color-brand-primary)] text-white"
                            : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                        title={t.lanTransfer.modeText}
                        aria-label={t.lanTransfer.modeText}
                    >
                        <Text size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setSendMode("file")}
                        className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-sm font-semibold transition ${sendMode === "file"
                            ? "bg-[var(--color-brand-primary)] text-white"
                            : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                        title={t.lanTransfer.modeFile}
                        aria-label={t.lanTransfer.modeFile}
                    >
                        <FileUp size={16} />
                    </button>
                </div>
                <button
                    type="button"
                    disabled={isSubmitting || selectedPeers.length === 0 || !hasPayload}
                    onClick={() => void send()}
                    className="flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Send size={16} />
                    {t.lanTransfer.send}
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                <div className="flex items-center gap-2">
                    <UserRound size={16} className="text-[var(--color-brand-primary)]" />
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                        {t.lanTransfer.onlineUsers}
                    </h3>
                    {selectedPeers.length > 0 && (
                        <span className="rounded-[var(--radius-sm)] bg-[var(--color-brand-primary-muted)] px-2 py-0.5 text-xxs font-bold text-[var(--color-brand-primary)]">
                            {t.lanTransfer.selectedRecipients.replace(
                                "{{count}}",
                                String(selectedPeers.length),
                            )}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-[28px_1fr] items-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-transparent px-2 transition focus-within:border-[var(--color-brand-primary)]">
                    <Search
                        className="text-[var(--color-text-muted)]"
                        size={14}
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t.lanTransfer.searchPlaceholder}
                        className="h-8 w-full bg-transparent text-xs text-[var(--color-text-primary)] outline-none"
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {transfer.peers.length === 0 || filteredPeers.length === 0 ? (
                        <div className="grid min-h-16 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] p-3 text-center">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {transfer.peers.length === 0
                                    ? t.lanTransfer.noOnlineUsers
                                    : t.lanTransfer.noUsersFound}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {filteredPeers.map((peer) => {
                                const selected = selectedPeerIds.includes(peer.id);
                                return (
                                    <button
                                        key={peer.id}
                                        type="button"
                                        onClick={() => togglePeer(peer)}
                                        className={`grid grid-cols-[1fr_auto] items-start gap-2 rounded-[var(--radius-sm)] border p-3 text-left transition ${selected
                                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                                            : "border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-subtle)]"
                                            }`}
                                    >
                                        <span className="grid min-w-0 gap-1">
                                            <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                                {peer.display_name}
                                            </span>
                                            <span className="truncate text-xs text-[var(--color-text-muted)]">
                                                {peer.is_mock ? t.lanTransfer.demoUser : t.lanTransfer.lanReady}
                                            </span>
                                        </span>
                                        <span
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected
                                                ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                                                : "border-[var(--color-border-subtle)] text-transparent"
                                                }`}
                                        >
                                            <Check size={12} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
