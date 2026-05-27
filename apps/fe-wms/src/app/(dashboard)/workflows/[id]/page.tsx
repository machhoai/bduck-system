/**
 * Workflow Builder Page
 *
 * Layout: [Sidebar 260px] | [Toolbar + Canvas (flex-1)] | [ConfigPanel 280px]
 *
 * ═══════════════════════════════════════════════════════════════
 * Two modes:
 * 1. /workflows/new   → Shows a "Create Workflow" form, then redirects
 *    to /workflows/{uuid} once the definition is created.
 * 2. /workflows/{uuid} → Loads the full builder canvas.
 * ═══════════════════════════════════════════════════════════════
 */
"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { gooeyToast } from "goey-toast";

import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import { WorkflowSidebar } from "@/components/workflows/WorkflowSidebar";
import { WorkflowToolbar } from "@/components/workflows/WorkflowToolbar";
import { NodeConfigPanel } from "@/components/workflows/NodeConfigPanel";
import { serializeCanvasToDAG } from "@/utils/workflowSerializer";
import {
    createWorkflowDefinition,
    saveWorkflowVersion,
    publishWorkflowVersion,
} from "@/hooks/useWorkflowApi";
import { showToast } from "@/utils/toast";

// ─────────────────────────────────────────────
// ENTITY TYPE OPTIONS
// ─────────────────────────────────────────────

const ENTITY_TYPES = [
    { value: "IMPORT_VOUCHER", label: "Nhập kho" },
    { value: "EXPORT_VOUCHER", label: "Xuất kho" },
    { value: "TRANSFER_VOUCHER", label: "Điều chuyển" },
    { value: "STOCK_COUNT", label: "Kiểm kê" },
] as const;

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default function WorkflowBuilderPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const rawId = params.id;
    const isNewMode = rawId === "new";

    // ─── State ───
    const [isSaving, setIsSaving] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // ─── New Workflow Form ───
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newEntityType, setNewEntityType] = useState<string>("IMPORT_VOUCHER");

    // ─── Create Definition (new mode) ───
    const handleCreate = useCallback(async () => {
        if (isCreating || !newName.trim()) return;
        setIsCreating(true);

        const createAction = async () => {
            const result = (await createWorkflowDefinition({
                name: newName.trim(),
                description: newDesc.trim() || null,
                entity_type: newEntityType,
            })) as { id: string };
            return result;
        };

        const retryAction = () => handleCreate();

        gooeyToast.promise(createAction(), {
            loading: t.workflows.toast?.saving ?? "Đang tạo quy trình...",
            success: t.workflows.toast?.saveSuccess ?? "Tạo quy trình thành công",
            error: t.workflows.toast?.saveError ?? "Lỗi khi tạo quy trình",
            description: {
                success:
                    t.workflows.toast?.saveSuccessDesc ??
                    "Chuyển đến canvas thiết kế...",
                error:
                    t.workflows.toast?.saveErrorDesc ??
                    "Vui lòng thử lại hoặc liên hệ quản trị viên.",
            },
            action: {
                error: {
                    label: (t as any).common?.retry ?? "Thử lại",
                    onClick: retryAction,
                },
            },
        });

        try {
            const result = await createAction();
            // Redirect to /workflows/{real-uuid}
            router.replace(`/workflows/${result.id}`);
        } catch (error) {
            console.error("[WorkflowBuilder] Create failed:", error);
        } finally {
            setIsCreating(false);
        }
    }, [isCreating, newName, newDesc, newEntityType, t, router]);

    // ─── Save Draft (builder mode) ───
    const handleSave = useCallback(async () => {
        if (isSaving || isNewMode) return;
        setIsSaving(true);

        const { nodes, edges } = useWorkflowCanvasStore.getState();
        const dag = serializeCanvasToDAG(nodes, edges);

        const saveAction = async () => {
            const version = await saveWorkflowVersion(rawId, dag);
            return version;
        };

        try {
            await showToast.promise(saveAction(), {
                loading: t.workflows.toast.saving,
                success: t.workflows.toast.saveSuccess,
                error: t.workflows.toast.saveError,
                successDescription: t.workflows.toast.saveSuccessDesc,
                errorDescription: (err) =>
                    err instanceof Error
                        ? err.message
                        : t.workflows.toast.saveErrorDesc,
            });
        } catch (error) {
            console.error("[WorkflowBuilder] Save failed:", error);
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, isNewMode, rawId, t]);

    // ─── Publish (builder mode) ───
    const handlePublish = useCallback(async () => {
        if (isSaving || isNewMode) return;
        setIsSaving(true);

        const { nodes, edges } = useWorkflowCanvasStore.getState();
        const dag = serializeCanvasToDAG(nodes, edges);

        const publishAction = async () => {
            const version = (await saveWorkflowVersion(rawId, dag)) as {
                id: string;
            };
            await publishWorkflowVersion(rawId, version.id);
            return version;
        };

        try {
            await showToast.promise(publishAction(), {
                loading: t.workflows.toast.publishing,
                success: t.workflows.toast.publishSuccess,
                error: t.workflows.toast.publishError,
                successDescription: t.workflows.toast.publishSuccessDesc,
                errorDescription: (err) =>
                    err instanceof Error
                        ? err.message
                        : t.workflows.toast.publishErrorDesc,
            });
        } catch (error) {
            console.error("[WorkflowBuilder] Publish failed:", error);
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, isNewMode, rawId, t]);

    const handleUndo = useCallback(() => {
        // TODO: Implement undo stack
    }, []);

    const handleRedo = useCallback(() => {
        // TODO: Implement redo stack
    }, []);

    return (
        <div className="flex h-full w-full flex-col">
            {/* Breadcrumb */}
            <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-2">
                <Link
                    href="/workflows"
                    className="inline-flex items-center gap-2 text-sm text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-hover)]"
                >
                    <ArrowLeft size={16} />
                    {t.workflows.title}
                </Link>
            </div>

            {/* ─── Mode: Create New ─── */}
            {isNewMode && (
                <div className="mx-auto flex w-full flex-col gap-5 p-6 lg:p-10">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t.workflows.addNew ?? "Tạo quy trình mới"}
                        </h2>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Điền thông tin cơ bản, sau đó thiết kế DAG trên canvas.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                                {t.workflows.name ?? "Tên quy trình"} *
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="VD: Duyệt phiếu nhập kho"
                                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                                {t.workflows.entityType ?? "Loại chứng từ"} *
                            </label>
                            <select
                                value={newEntityType}
                                onChange={(e) => setNewEntityType(e.target.value)}
                                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
                            >
                                {ENTITY_TYPES.map((et) => (
                                    <option key={et.value} value={et.value}>
                                        {et.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                                {t.workflows.description ?? "Mô tả"}
                            </label>
                            <textarea
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                                rows={3}
                                placeholder="Mô tả quy trình..."
                                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={isCreating || !newName.trim()}
                        className="mt-2 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] disabled:opacity-50"
                    >
                        {isCreating && <Loader2 size={16} className="animate-spin" />}
                        {isCreating ? "Đang tạo..." : "Tạo và thiết kế DAG"}
                    </button>
                </div>
            )}

            {/* ─── Mode: Builder Canvas ─── */}
            {!isNewMode && (
                <ReactFlowProvider>
                    {/* Toolbar */}
                    <WorkflowToolbar
                        onSave={handleSave}
                        onPublish={handlePublish}
                        isSaving={isSaving}
                        canUndo={false}
                        canRedo={false}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                    />

                    {/* Main 3-panel layout */}
                    <div className="flex flex-1 overflow-hidden">
                        <WorkflowSidebar />
                        <WorkflowCanvas />
                        <NodeConfigPanel />
                    </div>
                </ReactFlowProvider>
            )}
        </div>
    );
}
