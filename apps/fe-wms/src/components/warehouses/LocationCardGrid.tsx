"use client";

import { useEffect, useMemo, useState } from "react";
import {
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { gooeyToast } from "goey-toast";
import {
    Boxes,
    ChevronDown,
    ChevronUp,
    Edit3,
    GripVertical,
    Layers,
    MapPin,
    PackageOpen,
    Plus,
    Search,
    Trash2,
} from "lucide-react";
import {
    LocationStatus,
    StockPolicyScope,
    type Inventory,
    type InventoryStockPolicy,
    type Product,
    type WarehouseLocation,
    type WarehouseLocationSlot,
} from "@bduck/shared-types";
import { useLocationSlots } from "@/hooks/useLocationSlots";
import { useStockPolicies } from "@/hooks/useStockPolicies";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import {
    buildSlotInventoryGroups,
    isBelowMin,
    type SlotInventoryGroup,
    type SlotProductInventoryRow,
} from "@/utils/slotInventory";
import { LocationSlotFormModal } from "./LocationSlotFormModal";
import { WarehouseTableSkeleton } from "./WarehouseSkeleton";

interface LocationCardGridProps {
    warehouseId: string;
    locations: WarehouseLocation[];
    inventory: Inventory[];
    products: Product[];
    loading: boolean;
    canWrite: boolean;
    onAdd: () => void;
    onEdit: (location: WarehouseLocation) => void;
    onDelete: (location: WarehouseLocation) => void;
}

const UNASSIGNED_SLOT_ID = "__unassigned__";

export function LocationCardGrid({
    warehouseId,
    locations,
    inventory,
    products,
    loading,
    canWrite,
    onAdd,
    onEdit,
    onDelete,
}: LocationCardGridProps) {
    const { t } = useTranslation();
    const [locationSearch, setLocationSearch] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
        null,
    );
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<WarehouseLocationSlot | null>(
        null,
    );
    const [isMappingMode, setIsMappingMode] = useState(false);
    const [selectedPolicyProductId, setSelectedPolicyProductId] = useState<
        string | null
    >(null);
    const hasPermission = useUserStore((state) => state.hasPermission);
    const canViewPrice = hasPermission("products.price.view", warehouseId);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    const {
        slots,
        mappings,
        loading: slotsLoading,
        createSlot,
        updateSlot,
        deleteSlot,
        deleteMapping,
        upsertMapping,
    } = useLocationSlots(warehouseId);
    const { policies, upsertPolicy } = useStockPolicies({ warehouseId });

    const locationSummaries = useMemo(() => {
        return locations.map((location) => {
            const locationInventory = inventory.filter(
                (item) =>
                    item.warehouse_location_id === location.id &&
                    item.is_deleted !== true,
            );

            return {
                location,
                productCount: new Set(locationInventory.map((item) => item.product_id))
                    .size,
                atp: locationInventory.reduce(
                    (sum, item) => sum + item.atp_quantity,
                    0,
                ),
                total: locationInventory.reduce(
                    (sum, item) => sum + item.total_quantity,
                    0,
                ),
            };
        });
    }, [inventory, locations]);

    const visibleSummaries = useMemo(() => {
        const query = locationSearch.trim().toLowerCase();
        if (!query) return locationSummaries;

        return locationSummaries.filter(({ location }) => {
            return (
                location.name.toLowerCase().includes(query) ||
                location.code.toLowerCase().includes(query)
            );
        });
    }, [locationSearch, locationSummaries]);

    useEffect(() => {
        if (visibleSummaries.length === 0) {
            setSelectedLocationId(null);
            return;
        }

        if (
            !selectedLocationId ||
            !visibleSummaries.some((item) => item.location.id === selectedLocationId)
        ) {
            setSelectedLocationId(visibleSummaries[0].location.id);
        }
    }, [selectedLocationId, visibleSummaries]);

    const selectedSummary =
        visibleSummaries.find((item) => item.location.id === selectedLocationId) ??
        visibleSummaries[0] ??
        null;

    const selectedLocation = selectedSummary?.location ?? null;
    const selectedSlots = useMemo(
        () =>
            selectedLocation
                ? slots.filter(
                    (slot) => slot.warehouse_location_id === selectedLocation.id,
                )
                : [],
        [selectedLocation, slots],
    );

    const slotGroups = useMemo(() => {
        if (!selectedLocation) return [];
        return buildSlotInventoryGroups({
            location: selectedLocation,
            inventory,
            products,
            slots: selectedSlots,
            mappings,
            policies,
        });
    }, [
        inventory,
        mappings,
        policies,
        products,
        selectedLocation,
        selectedSlots,
    ]);

    const filteredSlotGroups = useMemo(() => {
        const query = productSearch.trim().toLowerCase();
        const visibleGroups = isMappingMode
            ? slotGroups
            : slotGroups.filter((group) => group.slot || group.rows.length > 0);
        if (!query) return visibleGroups;

        return visibleGroups.map((group) => ({
            ...group,
            rows: group.rows.filter(({ product }) => {
                return (
                    product.name.toLowerCase().includes(query) ||
                    product.code.toLowerCase().includes(query) ||
                    (product.barcode?.toLowerCase().includes(query) ?? false)
                );
            }),
        }));
    }, [isMappingMode, productSearch, slotGroups]);

    const selectedPolicyRow = useMemo(() => {
        if (!selectedPolicyProductId) return null;
        return (
            slotGroups
                .flatMap((group) => group.rows)
                .find((row) => row.product.id === selectedPolicyProductId) ?? null
        );
    }, [selectedPolicyProductId, slotGroups]);

    useEffect(() => {
        if (
            selectedPolicyProductId &&
            !slotGroups.some((group) =>
                group.rows.some((row) => row.product.id === selectedPolicyProductId),
            )
        ) {
            setSelectedPolicyProductId(null);
        }
    }, [selectedPolicyProductId, slotGroups]);

    const handleCreateSlot = () => {
        if (!selectedLocation) return;
        setEditingSlot(null);
        setIsSlotModalOpen(true);
    };

    const handleEditSlot = (slot: WarehouseLocationSlot) => {
        setEditingSlot(slot);
        setIsSlotModalOpen(true);
    };

    const handleSaveSlot = async (payload: unknown) => {
        if (editingSlot) {
            return updateSlot(editingSlot.id, {
                ...(payload as Record<string, unknown>),
                warehouse_id: editingSlot.warehouse_id,
                warehouse_location_id: editingSlot.warehouse_location_id,
            });
        }
        return createSlot(payload);
    };

    const handleDeleteSlot = async (slot: WarehouseLocationSlot) => {
        if (!confirm(`${t.warehouses.confirmDeleteSlot}\n${slot.name}`)) return;

        const action = async () => {
            await deleteSlot(slot.id);
        };

        try {
            await gooeyToast.promise(action(), {
                loading: t.warehouses.slotDeleting,
                success: t.warehouses.slotDeleteSuccess,
                error: (error: unknown) =>
                    error instanceof Error ? error.message : t.warehouses.slotDeleteError,
                description: {
                    success: t.warehouses.slotDeleteSuccess,
                    error: t.warehouses.slotDeleteError,
                },
                action: {
                    error: {
                        label: t.common.retry,
                        onClick: () => void handleDeleteSlot(slot),
                    },
                },
            });
        } catch (error) {
            console.error("[LocationCardGrid] delete slot error:", error);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!canWrite) return;
        if (!isMappingMode) return;
        if (!selectedLocation || !event.over) return;

        const productId = String(event.active.data.current?.productId ?? "");
        const mappingId = event.active.data.current?.mappingId as string | null;
        const targetSlotId = String(event.over.id);
        if (!productId) return;
        if (targetSlotId === UNASSIGNED_SLOT_ID && !mappingId) return;

        const action =
            targetSlotId === UNASSIGNED_SLOT_ID && mappingId
                ? () => deleteMapping(mappingId)
                : () =>
                    upsertMapping({
                        warehouse_id: selectedLocation.warehouse_id,
                        warehouse_location_id: selectedLocation.id,
                        warehouse_location_slot_id: targetSlotId,
                        product_id: productId,
                        display_order: null,
                        is_active: true,
                    });

        await gooeyToast.promise(action(), {
            loading: t.warehouses.mappingUpdating,
            success: t.warehouses.mappingUpdateSuccess,
            error: t.warehouses.mappingUpdateError,
            description: {
                success: t.warehouses.mappingSuccessDesc,
                error: t.warehouses.mappingErrorDesc,
            },
            action: {
                error: {
                    label: t.common.retry,
                    onClick: () => void handleDragEnd(event),
                },
            },
        });
    };

    if (loading) return <WarehouseTableSkeleton />;

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold leading-tight tracking-normal text-[var(--color-text-primary)]">
                        {t.warehouses.tabLocations}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        {t.warehouses.mappingInstruction}
                    </p>
                </div>
                {canWrite && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
                    >
                        <Plus size={18} />
                        {t.warehouses.addLocation}
                    </button>
                )}
            </div>

            {locations.length === 0 ? (
                <EmptyLocations label={t.warehouses.emptyLocations} />
            ) : (
                <div className="grid min-h-screen grid-cols-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] lg:grid-cols-4">
                    <LocationSidebar
                        summaries={visibleSummaries}
                        selectedLocationId={selectedLocationId}
                        search={locationSearch}
                        onSearch={setLocationSearch}
                        onSelect={(locationId) => {
                            setSelectedLocationId(locationId);
                            setProductSearch("");
                        }}
                    />

                    {selectedLocation ? (
                        <div className="min-w-0 lg:col-span-3">
                            <LocationDetailHeader
                                location={selectedLocation}
                                summary={selectedSummary}
                                productSearch={productSearch}
                                canWrite={canWrite}
                                isMappingMode={isMappingMode}
                                onProductSearch={setProductSearch}
                                onToggleMappingMode={() =>
                                    setIsMappingMode((current) => !current)
                                }
                                onCreateSlot={handleCreateSlot}
                                onEdit={() => onEdit(selectedLocation)}
                                onDelete={() => onDelete(selectedLocation)}
                            />
                            {slotsLoading ? (
                                <WarehouseTableSkeleton />
                            ) : (
                                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                                    <PrizeOverviewPanel groups={slotGroups} />
                                    <div className="grid gap-3 p-3 2xl:grid-cols-3">
                                        <div className="grid gap-3 xl:grid-cols-2 2xl:col-span-2">
                                            {filteredSlotGroups.length === 0 ? (
                                                <MappingHiddenState
                                                    canWrite={canWrite}
                                                    onShowMapping={() => setIsMappingMode(true)}
                                                />
                                            ) : (
                                                filteredSlotGroups.map((group) => (
                                                    <SlotDropColumn
                                                        key={group.slot?.id ?? UNASSIGNED_SLOT_ID}
                                                        group={group}
                                                        canWrite={canWrite}
                                                        canViewPrice={canViewPrice}
                                                        isMappingMode={isMappingMode}
                                                        selectedPolicyProductId={selectedPolicyProductId}
                                                        onEditSlot={handleEditSlot}
                                                        onDeleteSlot={handleDeleteSlot}
                                                        onSelectPolicy={setSelectedPolicyProductId}
                                                    />
                                                ))
                                            )}
                                        </div>
                                        <MinStockPanel
                                            row={selectedPolicyRow}
                                            canWrite={canWrite}
                                            onSavePolicy={upsertPolicy}
                                        />
                                    </div>
                                </DndContext>
                            )}
                        </div>
                    ) : (
                        <div className="flex h-full min-h-64 items-center justify-center text-sm text-[var(--color-text-muted)]">
                            {t.warehouses.noMatchingLocation}
                        </div>
                    )}
                </div>
            )}
            <LocationSlotFormModal
                isOpen={isSlotModalOpen}
                location={selectedLocation}
                slot={editingSlot}
                defaultSortOrder={selectedSlots.length + 1}
                onClose={() => {
                    setIsSlotModalOpen(false);
                    setEditingSlot(null);
                }}
                onSave={handleSaveSlot}
            />
        </section>
    );
}

function LocationSidebar({
    summaries,
    selectedLocationId,
    search,
    onSearch,
    onSelect,
}: {
    summaries: Array<{
        location: WarehouseLocation;
        productCount: number;
        atp: number;
        total: number;
    }>;
    selectedLocationId: string | null;
    search: string;
    onSearch: (value: string) => void;
    onSelect: (locationId: string) => void;
}) {
    const { t } = useTranslation();

    return (
        <aside className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[var(--color-border-subtle)] p-3">
                <div className="relative">
                    <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => onSearch(event.target.value)}
                        placeholder={t.warehouses.searchLocationPlaceholder}
                        className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    />
                </div>
            </div>

            <div className="max-h-96 overflow-y-auto p-2 lg:max-h-screen">
                {summaries.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)]">
                        {t.warehouses.noLocationsFound}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {summaries.map((summary) => {
                            const isSelected = summary.location.id === selectedLocationId;
                            return (
                                <button
                                    key={summary.location.id}
                                    type="button"
                                    onClick={() => onSelect(summary.location.id)}
                                    className={`w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors ${isSelected
                                        ? "border-[var(--color-brand-primary)] bg-[var(--color-surface-elevated)] shadow-sm"
                                        : "border-transparent hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-elevated)]"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {summary.location.name}
                                                </h3>
                                                <StatusBadge status={summary.location.status} />
                                            </div>
                                            <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                                                {summary.location.code} ·{" "}
                                                {t.warehouses.types[summary.location.type]}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                                {summary.total.toLocaleString()}
                                            </p>
                                            <p className="text-xxs text-[var(--color-text-muted)]">
                                                {t.warehouses.totalLower}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xxs">
                                        <span className="rounded bg-[var(--color-surface-card)] px-2 py-1 text-[var(--color-text-secondary)]">
                                            {summary.productCount} SKU
                                        </span>
                                        <span className="rounded bg-[var(--color-surface-card)] px-2 py-1 text-[var(--color-text-secondary)]">
                                            ATP {summary.atp.toLocaleString()}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}

function LocationDetailHeader({
    location,
    summary,
    productSearch,
    canWrite,
    isMappingMode,
    onProductSearch,
    onToggleMappingMode,
    onCreateSlot,
    onEdit,
    onDelete,
}: {
    location: WarehouseLocation;
    summary: { productCount: number; atp: number; total: number } | null;
    productSearch: string;
    canWrite: boolean;
    isMappingMode: boolean;
    onProductSearch: (value: string) => void;
    onToggleMappingMode: () => void;
    onCreateSlot: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="border-b border-[var(--color-border-subtle)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {location.name}
                        </h3>
                        <StatusBadge status={location.status} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {location.code} · {t.warehouses.types[location.type]}
                    </p>
                </div>
                {canWrite && (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        <button
                            type="button"
                            onClick={onToggleMappingMode}
                            className={`inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors ${isMappingMode
                                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                        >
                            {isMappingMode ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                            {isMappingMode ? t.warehouses.mappingHide : t.warehouses.mappingShow}
                        </button>
                        <button
                            type="button"
                            onClick={onCreateSlot}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 text-sm font-medium text-[var(--color-brand-primary)] transition-colors hover:bg-[var(--color-surface-card)]"
                        >
                            <Plus size={16} />
                            {t.warehouses.addSlot}
                        </button>
                        <IconButton label={t.common.edit} onClick={onEdit}>
                            <Edit3 size={16} />
                        </IconButton>
                        <IconButton label={t.common.delete} onClick={onDelete} danger>
                            <Trash2 size={16} />
                        </IconButton>
                    </div>
                )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
                <MetricTile
                    icon={<Boxes size={16} />}
                    label="SKU"
                    value={summary?.productCount ?? 0}
                />
                <MetricTile
                    icon={<PackageOpen size={16} />}
                    label="ATP"
                    value={summary?.atp ?? 0}
                />
                <MetricTile
                    icon={<Layers size={16} />}
                    label={t.warehouses.inventoryView.total}
                    value={summary?.total ?? 0}
                />
            </div>

            <div className="relative mt-4">
                <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => onProductSearch(event.target.value)}
                    placeholder={t.warehouses.searchProductInLocationPlaceholder}
                    className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                />
            </div>
        </div>
    );
}

function SlotDropColumn({
    group,
    canWrite,
    canViewPrice,
    isMappingMode,
    selectedPolicyProductId,
    onEditSlot,
    onDeleteSlot,
    onSelectPolicy,
}: {
    group: SlotInventoryGroup;
    canWrite: boolean;
    canViewPrice: boolean;
    isMappingMode: boolean;
    selectedPolicyProductId: string | null;
    onEditSlot: (slot: WarehouseLocationSlot) => void;
    onDeleteSlot: (slot: WarehouseLocationSlot) => void;
    onSelectPolicy: (productId: string) => void;
}) {
    const { t } = useTranslation();
    const droppableId = group.slot?.id ?? UNASSIGNED_SLOT_ID;
    const { setNodeRef, isOver } = useDroppable({ id: droppableId });

    return (
        <div
            ref={setNodeRef}
            className={`min-h-40 rounded-[var(--radius-lg)] border bg-[var(--color-surface-pearl)] transition-colors ${isOver
                ? "border-[var(--color-brand-primary)]"
                : "border-[var(--color-border-subtle)]"
                }`}
        >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] p-3">
                <div className="min-w-0">
                    {group.slot && (
                        <h4 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {group.slot.name}
                        </h4>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {group.productCount} SKU / ATP {group.atp.toLocaleString()}
                    </p>
                </div>
                {group.slot ? (
                    <div className="flex shrink-0 items-center gap-1">
                        <span className="rounded bg-[var(--color-surface-card)] px-2 py-1 text-xxs font-semibold text-[var(--color-text-secondary)]">
                            {group.slot.code}
                        </span>
                        {canWrite && (
                            <>
                                <IconButton
                                    label={t.common.edit}
                                    onClick={() => {
                                        if (group.slot) onEditSlot(group.slot);
                                    }}
                                >
                                    <Edit3 size={14} />
                                </IconButton>
                                <IconButton
                                    label={t.common.delete}
                                    onClick={() => {
                                        if (group.slot) void onDeleteSlot(group.slot);
                                    }}
                                    danger
                                >
                                    <Trash2 size={14} />
                                </IconButton>
                            </>
                        )}
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col gap-2 p-2">
                {group.rows.length === 0 ? (
                    <div className="flex min-h-24 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] px-3 text-center text-xs text-[var(--color-text-muted)]">
                        {isMappingMode ? t.warehouses.dragProductHere : t.warehouses.noProductsYet}
                    </div>
                ) : (
                    group.rows.map((row) => (
                        <DraggableProductRow
                            key={row.product.id}
                            row={row}
                            canWrite={canWrite}
                            canViewPrice={canViewPrice}
                            isMappingMode={isMappingMode}
                            isPolicySelected={selectedPolicyProductId === row.product.id}
                            onSelectPolicy={onSelectPolicy}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function DraggableProductRow({
    row,
    canWrite,
    canViewPrice,
    isMappingMode,
    isPolicySelected,
    onSelectPolicy,
}: {
    row: SlotProductInventoryRow;
    canWrite: boolean;
    canViewPrice: boolean;
    isMappingMode: boolean;
    isPolicySelected: boolean;
    onSelectPolicy: (productId: string) => void;
}) {
    const canDrag = canWrite && isMappingMode;
    const imageUrl = row.product.product_image_url?.[0] ?? null;
    const unitPrice = row.product.unit_price ?? null;
    const totalValue = unitPrice == null ? null : unitPrice * row.total;
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: row.product.id,
            data: {
                productId: row.product.id,
                mappingId: row.mapping?.id ?? null,
            },
            disabled: !canDrag,
        });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform) }}
            className={`rounded-[var(--radius-md)] border bg-[var(--color-surface-elevated)] p-2 shadow-sm transition-colors ${isPolicySelected
                ? "border-blue-300 ring-1 ring-blue-100"
                : "border-[var(--color-border-subtle)]"
                } ${isDragging ? "opacity-70" : ""}`}
        >
            <div className="flex items-start gap-3">
                {canDrag && (
                    <button
                        type="button"
                        className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
                        {...listeners}
                        {...attributes}
                    >
                        <GripVertical size={16} />
                    </button>
                )}
                <ProductThumb imageUrl={imageUrl} name={row.product.name} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold text-[var(--color-text-primary)]">
                                {row.product.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                {row.product.code} / {row.product.unit}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onSelectPolicy(row.product.id)}
                            className={`h-7 shrink-0 rounded-[var(--radius-sm)] border px-2 text-xxs font-semibold transition-colors ${isPolicySelected
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
                                }`}
                        >
                            Min stock
                        </button>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                        <QuantityBadge
                            label="ATP"
                            value={row.atp}
                            tone={
                                isBelowMin(row.atp, row.slotPolicy ?? row.locationPolicy)
                                    ? "danger"
                                    : "primary"
                            }
                        />
                        <QuantityBadge label="Hold" value={row.onHold} tone="warning" />
                        <QuantityBadge label="Shipping" value={row.inTransit} tone="info" />
                        <QuantityBadge label="Tổng" value={row.total} tone="neutral" />
                    </div>
                    {canViewPrice && unitPrice != null && totalValue != null && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <PriceBadge label="Đơn giá" value={unitPrice} />
                            <PriceBadge label="Tổng giá trị" value={totalValue} strong />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProductThumb({
    imageUrl,
    name,
}: {
    imageUrl: string | null;
    name: string;
}) {
    return (
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-slate-50">
            {imageUrl ? (
                <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <PackageOpen size={20} />
                </div>
            )}
        </div>
    );
}

function MappingHiddenState({
    canWrite,
    onShowMapping,
}: {
    canWrite: boolean;
    onShowMapping: () => void;
}) {
    return (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-amber-200 bg-amber-50 p-4 xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h4 className="text-sm font-semibold text-amber-900">
                        Chưa có giải đang hiển thị
                    </h4>
                    <p className="mt-1 text-xs text-amber-700">
                        Các sản phẩm chưa map đang được ẩn để màn hình tồn kho gọn hơn.
                    </p>
                </div>
                {canWrite && (
                    <button
                        type="button"
                        onClick={onShowMapping}
                        className="inline-flex h-8 w-fit items-center justify-center gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-white px-3 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
                    >
                        <ChevronDown size={15} />
                        Mapping
                    </button>
                )}
            </div>
        </div>
    );
}

function QuantityBadge({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "primary" | "warning" | "info" | "neutral" | "danger";
}) {
    const toneClass = {
        primary: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        neutral: "border-slate-200 bg-slate-50 text-slate-700",
        danger: "border-red-200 bg-red-50 text-red-700",
    }[tone];

    return (
        <div className={`rounded-[var(--radius-sm)] border px-2 py-1 ${toneClass}`}>
            <p className="text-xs font-bold leading-tight">
                {value.toLocaleString()}
            </p>
            <p className="text-xxs leading-tight opacity-80">{label}</p>
        </div>
    );
}

function PriceBadge({
    label,
    value,
    strong,
}: {
    label: string;
    value: number;
    strong?: boolean;
}) {
    return (
        <div
            className={`rounded-[var(--radius-sm)] border px-2 py-1 ${strong
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : "border-indigo-200 bg-indigo-50 text-indigo-700"
                }`}
        >
            <p className="truncate text-xs font-bold leading-tight">
                {formatMoney(value)}
            </p>
            <p className="text-xxs leading-tight opacity-80">{label}</p>
        </div>
    );
}

function formatMoney(value: number) {
    return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function MinStockPanel({
    row,
    canWrite,
    onSavePolicy,
}: {
    row: SlotProductInventoryRow | null;
    canWrite: boolean;
    onSavePolicy: (payload: unknown) => Promise<unknown>;
}) {
    return (
        <aside className="rounded-[var(--radius-lg)] border border-blue-100 bg-blue-50/60 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold text-blue-900">
                        Cài đặt min stock
                    </h4>
                    <p className="mt-1 text-xs text-blue-700">
                        {row
                            ? row.product.code
                            : "Chọn sản phẩm để cấu hình tồn tối thiểu."}
                    </p>
                </div>
                <span className="rounded bg-white px-2 py-1 text-xxs font-semibold text-blue-700">
                    Policy
                </span>
            </div>
            {row ? (
                <StockPolicyControls
                    row={row}
                    canWrite={canWrite}
                    onSavePolicy={onSavePolicy}
                />
            ) : (
                <div className="rounded-[var(--radius-md)] border border-dashed border-blue-200 bg-white/70 p-3 text-xs text-blue-700">
                    Min stock được tách riêng để thẻ sản phẩm ưu tiên số liệu tồn kho.
                </div>
            )}
        </aside>
    );
}

function PrizeOverviewPanel({ groups }: { groups: SlotInventoryGroup[] }) {
    const assignedGroups = groups.filter((group) => group.slot);
    if (assignedGroups.length === 0) return null;

    return (
        <div className="border-b border-[var(--color-border-subtle)] bg-gradient-to-r from-blue-50 via-emerald-50 to-amber-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Tổng quan quầy theo giải thưởng
                </h4>
                <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    ATP từng sản phẩm
                </span>
            </div>
            <div className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
                {assignedGroups.map((group) => (
                    <div
                        key={group.slot?.id}
                        className="rounded-[var(--radius-md)] border border-white/80 bg-white/80 p-2 shadow-sm"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                    {group.slot?.name}
                                </p>
                                <p className="text-xxs text-[var(--color-text-muted)]">
                                    {group.productCount} SKU
                                </p>
                            </div>
                            <div className="rounded bg-emerald-100 px-2 py-1 text-right text-xxs font-semibold text-emerald-700">
                                ATP {group.atp.toLocaleString()}
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {group.rows.length === 0 ? (
                                <span className="rounded bg-slate-100 px-2 py-1 text-xxs text-slate-600">
                                    Chưa có sản phẩm
                                </span>
                            ) : (
                                group.rows.map((row) => (
                                    <span
                                        key={row.product.id}
                                        className="rounded bg-sky-50 px-2 py-1 text-xxs font-medium text-sky-700"
                                    >
                                        {row.product.code}: {row.atp.toLocaleString()}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/*
 * Product cards intentionally keep stock numbers only. Min-stock inputs live in
 * MinStockPanel so dense location cards stay scan-friendly during operations.
 */
function StockPolicyControls({
    row,
    canWrite,
    onSavePolicy,
}: {
    row: SlotProductInventoryRow;
    canWrite: boolean;
    onSavePolicy: (payload: unknown) => Promise<unknown>;
}) {
    return (
        <div className="mt-3 grid grid-cols-3 gap-2">
            <PolicyInput
                label="Kho"
                policy={row.warehousePolicy}
                value={row.warehousePolicy?.min_stock_quantity ?? null}
                disabled={!canWrite}
                onSave={(min) =>
                    onSavePolicy({
                        scope: StockPolicyScope.WAREHOUSE,
                        warehouse_id: row.warehouseId,
                        warehouse_location_id: null,
                        warehouse_location_slot_id: null,
                        product_id: row.product.id,
                        min_stock_quantity: min,
                        is_active: true,
                    })
                }
            />
            <PolicyInput
                label="Vị trí"
                policy={row.locationPolicy}
                value={row.locationPolicy?.min_stock_quantity ?? null}
                disabled={!canWrite}
                onSave={(min) => {
                    return onSavePolicy({
                        scope: StockPolicyScope.LOCATION,
                        warehouse_id: row.warehouseId,
                        warehouse_location_id: row.locationId,
                        warehouse_location_slot_id: null,
                        product_id: row.product.id,
                        min_stock_quantity: min,
                        is_active: true,
                    });
                }}
            />
            <PolicyInput
                label="Giải"
                policy={row.slotPolicy}
                value={row.slotPolicy?.min_stock_quantity ?? null}
                disabled={!canWrite || !row.slot || !row.mapping}
                onSave={(min) => {
                    if (!row.slot || !row.mapping) return Promise.resolve();
                    return onSavePolicy({
                        scope: StockPolicyScope.SLOT,
                        warehouse_id: row.mapping.warehouse_id,
                        warehouse_location_id: row.mapping.warehouse_location_id,
                        warehouse_location_slot_id: row.slot.id,
                        product_id: row.product.id,
                        min_stock_quantity: min,
                        is_active: true,
                    });
                }}
            />
        </div>
    );
}

function PolicyInput({
    label,
    policy,
    value,
    disabled = false,
    onSave,
}: {
    label: string;
    policy: InventoryStockPolicy | null;
    value: number | null;
    disabled?: boolean;
    onSave: (min: number) => Promise<unknown>;
}) {
    const [draft, setDraft] = useState(value == null ? "" : String(value));

    useEffect(() => {
        setDraft(value == null ? "" : String(value));
    }, [value]);

    const handleSave = async () => {
        const min = Number(draft);
        if (!Number.isFinite(min) || min < 0 || disabled) return;

        await gooeyToast.promise(onSave(min), {
            loading: `Đang lưu min ${label.toLowerCase()}...`,
            success: "Đã lưu tồn tối thiểu",
            error: "Không thể lưu tồn tối thiểu",
            description: {
                success: "Chính sách tồn kho đã được cập nhật.",
                error: "Vui lòng thử lại sau.",
            },
            action: { error: { label: "Thử lại", onClick: handleSave } },
        });
    };

    return (
        <label className="min-w-0">
            <span className="mb-1 block text-xxs font-medium text-[var(--color-text-muted)]">
                Min {label}
            </span>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min={0}
                    disabled={disabled}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        if (draft !== "" && draft !== String(value ?? ""))
                            void handleSave();
                    }}
                    placeholder="-"
                    className={`h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] ${policy ? "bg-white" : "bg-[var(--color-surface-card)]"
                        }`}
                />
            </div>
        </label>
    );
}

function MetricTile({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
}) {
    return (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] text-[var(--color-brand-primary)]">
                {icon}
            </div>
            <p className="text-xxs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                {label}
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                {value.toLocaleString()}
            </p>
        </div>
    );
}

function IconButton({
    label,
    onClick,
    danger,
    children,
}: {
    label: string;
    onClick: () => void;
    danger?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] ${danger
                ? "hover:text-[var(--color-accent-error)]"
                : "hover:text-[var(--color-brand-primary)]"
                }`}
            aria-label={label}
            title={label}
        >
            {children}
        </button>
    );
}

function EmptyLocations({ label }: { label: string }) {
    return (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
            <MapPin size={42} className="mb-3 text-[var(--color-text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {label}
            </h3>
        </div>
    );
}

function StatusBadge({ status }: { status: LocationStatus }) {
    const { t } = useTranslation();
    const classes =
        status === LocationStatus.ACTIVE
            ? "bg-[var(--color-surface-success)] text-[var(--color-text-success)]"
            : status === LocationStatus.QUARANTINE
                ? "bg-[var(--color-surface-warning)] text-[var(--color-accent-warning)]"
                : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]";

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-bold uppercase tracking-wider ${classes}`}
        >
            {t.warehouses.statuses[status]}
        </span>
    );
}
