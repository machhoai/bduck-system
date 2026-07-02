"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Send, Trash2, UserRound } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { useLanFileTransfer } from "@/hooks/useLanFileTransfer";
import { useTranslation } from "@/lib/i18n";
import type { LanPresence } from "@/types/lanFileTransfer";
import { formatLanFileSize } from "@/utils/lanFileTransfer";

type LanTransferApi = ReturnType<typeof useLanFileTransfer>;

export default function LanSendPanel({
  transfer,
}: {
  transfer: LanTransferApi;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedPeer, setSelectedPeer] = useState<LanPresence | null>(
    transfer.peers[0] || null,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles((current) => [...current, ...Array.from(fileList)]);
  };

  const send = async () => {
    if (!selectedPeer || files.length === 0) {
      gooeyToast.error(t.lanTransfer.missingInfo, {
        description: t.lanTransfer.missingInfoDesc,
        preset: "snappy",
      });
      return;
    }

    const action = async () => {
      setIsSubmitting(true);
      await transfer.sendRequest(selectedPeer, files);
      setFiles([]);
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
        action: {
          error: { label: t.lanTransfer.retry, onClick: () => void send() },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="grid min-h-0 gap-3">
      <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
        <div className="flex items-center gap-2">
          <UserRound size={16} className="text-[var(--color-brand-primary)]" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {t.lanTransfer.onlineUsers}
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {transfer.peers.map((peer) => (
            <button
              key={peer.id}
              type="button"
              onClick={() => setSelectedPeer(peer)}
              className={`grid gap-1 rounded-[var(--radius-sm)] border p-3 text-left transition ${
                selectedPeer?.id === peer.id
                  ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                  : "border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-subtle)]"
              }`}
            >
              <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                {peer.display_name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {t.lanTransfer.lanReady}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`grid min-h-44 place-items-center rounded-[var(--radius-md)] border border-dashed p-4 text-center transition ${
          isDragging
            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
            : "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        >
          <FileUp size={28} className="mx-auto text-[var(--color-brand-primary)]" />
          {t.lanTransfer.dropHint}
        </button>
      </div>

      {files.length > 0 && (
        <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {files.length} {t.lanTransfer.files} - {formatLanFileSize(totalSize)}
            </p>
            <button
              type="button"
              onClick={() => setFiles([])}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
              title={t.lanTransfer.clearFiles}
              aria-label={t.lanTransfer.clearFiles}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid gap-1">
            {files.map((file) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2 py-1 text-xs"
              >
                <span className="truncate text-[var(--color-text-secondary)]">
                  {file.name}
                </span>
                <span className="shrink-0 text-[var(--color-text-muted)]">
                  {formatLanFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={isSubmitting || !selectedPeer || files.length === 0}
        onClick={() => void send()}
        className="flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send size={16} />
        {t.lanTransfer.send}
      </button>
    </section>
  );
}
