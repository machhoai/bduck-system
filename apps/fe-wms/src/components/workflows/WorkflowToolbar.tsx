"use client";

import { useTranslation } from "@/lib/i18n";
import {
  Save,
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";

interface WorkflowToolbarProps {
  onSave: () => void;
  onPublish: () => void;
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function WorkflowToolbar({
  onSave,
  onPublish,
  isSaving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: WorkflowToolbarProps) {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-2">
      {/* Left: Undo/Redo */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={Undo2}
          label={t.workflows.toolbar.undo}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon={Redo2}
          label={t.workflows.toolbar.redo}
          onClick={onRedo}
          disabled={!canRedo}
        />
        <div className="mx-2 h-5 w-px bg-[var(--color-border-subtle)]" />
        <ToolbarButton
          icon={ZoomIn}
          label={t.workflows.toolbar.zoomIn}
          onClick={() => zoomIn()}
        />
        <ToolbarButton
          icon={ZoomOut}
          label={t.workflows.toolbar.zoomOut}
          onClick={() => zoomOut()}
        />
        <ToolbarButton
          icon={Maximize2}
          label={t.workflows.toolbar.fitView}
          onClick={() => fitView({ padding: 0.2 })}
        />
      </div>

      {/* Right: Save & Publish */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-surface-pearl)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} />
          {isSaving ? t.workflows.toolbar.saving : t.workflows.toolbar.save}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload size={16} />
          {t.workflows.toolbar.publish}
        </button>
      </div>
    </div>
  );
}

/** Small icon-only toolbar button */
function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-pearl)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon size={16} />
    </button>
  );
}
