"use client";

/**
 * CreateTransferTab — 4-step stepper for creating transfer orders
 *
 * Steps:
 * 0. Thông tin (Transfer type, Source/Dest warehouse, Notes)
 * 1. Upload chứng từ (FileUploadField - optional)
 * 2. Sản phẩm (Product picker + locations + quantities)
 * 3. Xác nhận & Gửi
 *
 * LUẬT THÉP: gooeyToast.promise, disable khi gửi, i18n, confirmation dialog.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Upload,
  ClipboardList,
  Package,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useUserStore } from "../../../stores/useUserStore";
import { createTransferOrder } from "../../../hooks/useTransferOrderApi";
import { useWarehouses, useWarehouseLocations } from "../../../hooks/useWarehouses";
import { useProducts } from "../../../hooks/useProducts";
import { uploadFile } from "../../../lib/uploadFile";
import { FileUploadField, type SelectedFile } from "../../shared/FileUploadField";
import { useInventoryByWarehouse } from "../../../hooks/useInventoryByWarehouse";

// ─── TYPES ───
interface Props {
  prefillWarehouseId?: string;
  onCreated: () => void;
}

interface TransferItemData {
  id: string;
  product_id: string;
  product_name: string;
  source_location_id: string;
  destination_location_id: string;
  quantity: number;
}

type TransferTypeValue = "INTRA_WAREHOUSE" | "INTER_WAREHOUSE";

const TRANSFER_TYPES = [
  {
    value: "INTRA_WAREHOUSE" as TransferTypeValue,
    vi: "Trong kho",
    zh: "库内调拨",
    icon: ArrowRightLeft,
    desc: "Di chuyển hàng giữa các vị trí trong cùng 1 kho",
  },
  {
    value: "INTER_WAREHOUSE" as TransferTypeValue,
    vi: "Liên kho",
    zh: "跨库调拨",
    icon: ArrowUpRight,
    desc: "Chuyển hàng từ kho này sang kho khác",
  },
];

const STEPS = [
  { id: 0, icon: ClipboardList, label: "Thông tin" },
  { id: 1, icon: Upload, label: "Chứng từ" },
  { id: 2, icon: Package, label: "Sản phẩm" },
  { id: 3, icon: CheckCircle2, label: "Xác nhận" },
];

// ─── COMPONENT ───
export default function CreateTransferTab({ prefillWarehouseId, onCreated }: Props) {
  const user = useUserStore((s) => s.user);
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { products, loading: productsLoading } = useProducts();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // File upload state
  const [files, setFiles] = useState<SelectedFile[]>([]);

  // Form state
  const [transferType, setTransferType] =
    useState<TransferTypeValue>("INTRA_WAREHOUSE");
  const [sourceWarehouseId, setSourceWarehouseId] = useState(
    prefillWarehouseId || "",
  );
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItemData[]>([]);

  const isIntra = transferType === "INTRA_WAREHOUSE";

  // Auto-set dest warehouse = source for INTRA
  useEffect(() => {
    if (isIntra && sourceWarehouseId) {
      setDestWarehouseId(sourceWarehouseId);
    }
  }, [isIntra, sourceWarehouseId]);

  // Auto-prefill from URL
  useEffect(() => {
    if (prefillWarehouseId) setSourceWarehouseId(prefillWarehouseId);
  }, [prefillWarehouseId]);

  // Reset items when warehouse changes
  useEffect(() => {
    setItems([]);
  }, [sourceWarehouseId]);

  // Hooks for locations & inventory (source warehouse)
  const { locations: srcLocations, loading: srcLocLoading } =
    useWarehouseLocations(sourceWarehouseId || undefined);
  const { getLocationsForProduct, getAtp, loading: invLoading } =
    useInventoryByWarehouse(sourceWarehouseId || undefined);

  // Hooks for dest locations (only for INTRA — same warehouse, different locations)
  const { locations: dstLocations, loading: dstLocLoading } =
    useWarehouseLocations(
      isIntra ? sourceWarehouseId || undefined : destWarehouseId || undefined,
    );

  // Product search filter
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)),
    );
  }, [products, productSearch]);

  const addedProductIds = useMemo(
    () => new Set(items.map((i) => `${i.product_id}-${i.source_location_id}`)),
    [items],
  );

  // ─── Navigation validation ───
  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 0: {
        if (!sourceWarehouseId) return false;
        if (isIntra) return true;
        // INTER: dest must be different
        return destWarehouseId !== "" && destWarehouseId !== sourceWarehouseId;
      }
      case 1:
        return true; // Upload is optional
      case 2:
        return (
          items.length > 0 &&
          items.length <= 150 &&
          items.every((item) => {
            if (!item.product_id || item.quantity <= 0 || !item.source_location_id)
              return false;
            if (isIntra && !item.destination_location_id) return false;
            if (
              isIntra &&
              item.source_location_id === item.destination_location_id
            )
              return false;
            return true;
          })
        );
      default:
        return true;
    }
  }, [step, sourceWarehouseId, destWarehouseId, isIntra, items]);

  // ─── Item management ───
  const addProduct = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          product_id: product.id,
          product_name: product.name,
          source_location_id: "",
          destination_location_id: "",
          quantity: 1,
        },
      ]);
    },
    [products],
  );

  const updateItem = (
    id: string,
    field: keyof TransferItemData,
    value: unknown,
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ─── Swap (only for INTER) ───
  const handleSwap = () => {
    if (isIntra) return;
    const temp = sourceWarehouseId;
    setSourceWarehouseId(destWarehouseId);
    setDestWarehouseId(temp);
    setItems([]); // Reset items when swapping
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setShowConfirm(false);
    setIsSubmitting(true);

    const submitAction = async () => {
      // 1. Upload files
      const uploadedUrls: string[] = [];
      for (const f of files) {
        if (f.url) {
          uploadedUrls.push(f.url);
          continue;
        }
        const url = await uploadFile(
          f.file,
          `temp-uploads/${user?.id || "unknown"}`,
          (percent) => {
            setFiles((prev) =>
              prev.map((pf) =>
                pf.id === f.id ? { ...pf, progress: percent } : pf,
              ),
            );
          },
        );
        uploadedUrls.push(url);
      }

      // 2. Create transfer order
      await createTransferOrder({
        transfer_type: transferType,
        source_warehouse_id: sourceWarehouseId,
        destination_warehouse_id: isIntra
          ? sourceWarehouseId
          : destWarehouseId,
        notes: notes || undefined,
        attachment_urls: uploadedUrls,
        items: items.map((item) => ({
          product_id: item.product_id,
          source_location_id: item.source_location_id,
          destination_location_id: isIntra
            ? item.destination_location_id
            : undefined,
          quantity: item.quantity,
        })),
        action_time: new Date().toISOString(),
      });
    };

    try {
      await gooeyToast.promise(submitAction(), {
        loading: isIntra
          ? "Đang điều chuyển trong kho..."
          : "Đang tạo phiếu điều chuyển...",
        success: isIntra
          ? "Điều chuyển trong kho thành công"
          : "Đã tạo phiếu điều chuyển",
        error: "Lỗi khi tạo phiếu điều chuyển",
        description: {
          success: isIntra
            ? "Hàng hóa đã được di chuyển ngay lập tức."
            : "Phiếu đã được gửi vào quy trình duyệt.",
          error: "Vui lòng thử lại hoặc liên hệ quản trị viên.",
        },
        action: {
          error: { label: "Thử lại", onClick: () => handleSubmit() },
        },
      });
      onCreated();
    } catch {
      // Toast handles error
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── RENDER ───
  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={`h-px w-6 shrink-0 lg:w-10 ${isCompleted ? "bg-orange-500" : "bg-gray-200"}`}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (isCompleted || isActive) setStep(s.id);
                }}
                disabled={!isCompleted && !isActive}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-orange-500 text-white shadow-sm"
                    : isCompleted
                      ? "bg-orange-100 text-orange-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 lg:p-6">
        {/* ──────── Step 0: Thông tin ──────── */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Transfer type selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                Loại điều chuyển *
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRANSFER_TYPES.map((tt) => {
                  const TIcon = tt.icon;
                  return (
                    <button
                      key={tt.value}
                      type="button"
                      onClick={() => {
                        setTransferType(tt.value);
                        setDestWarehouseId("");
                        setItems([]);
                      }}
                      className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                        transferType === tt.value
                          ? "border-orange-500 bg-orange-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          transferType === tt.value
                            ? "bg-orange-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <TIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            transferType === tt.value
                              ? "text-orange-700"
                              : "text-gray-700"
                          }`}
                        >
                          {tt.vi}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {tt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Warehouse selectors */}
            {isIntra ? (
              /* INTRA: single warehouse */
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Kho thực hiện *
                </label>
                <select
                  value={sourceWarehouseId}
                  onChange={(e) => setSourceWarehouseId(e.target.value)}
                  disabled={warehousesLoading}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                >
                  <option value="">
                    {warehousesLoading ? "Đang tải..." : "— Chọn kho —"}
                  </option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* INTER: source + dest with swap button */
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr,auto,1fr]">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-600">
                      Kho nguồn *
                    </label>
                    <select
                      value={sourceWarehouseId}
                      onChange={(e) => {
                        setSourceWarehouseId(e.target.value);
                        setItems([]);
                      }}
                      disabled={warehousesLoading}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                    >
                      <option value="">
                        {warehousesLoading
                          ? "Đang tải..."
                          : "— Chọn kho nguồn —"}
                      </option>
                      {warehouses.map((wh) => (
                        <option
                          key={wh.id}
                          value={wh.id}
                          disabled={wh.id === destWarehouseId}
                        >
                          {wh.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Swap button */}
                  <div className="flex items-end justify-center pb-1">
                    <button
                      type="button"
                      onClick={handleSwap}
                      disabled={!sourceWarehouseId || !destWarehouseId}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-all hover:border-orange-400 hover:text-orange-500 disabled:opacity-30"
                      title="Đổi kho nguồn ↔ kho đích"
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-600">
                      Kho đích *
                    </label>
                    <select
                      value={destWarehouseId}
                      onChange={(e) => setDestWarehouseId(e.target.value)}
                      disabled={warehousesLoading}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                    >
                      <option value="">
                        {warehousesLoading
                          ? "Đang tải..."
                          : "— Chọn kho đích —"}
                      </option>
                      {warehouses
                        .filter((wh) => wh.id !== sourceWarehouseId)
                        .map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {sourceWarehouseId &&
                  destWarehouseId &&
                  sourceWarehouseId === destWarehouseId && (
                    <div className="flex items-center gap-1.5 text-xs text-red-500">
                      <AlertTriangle size={14} />
                      <span>
                        Kho nguồn và kho đích không được trùng nhau
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Ghi chú
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ghi chú bổ sung..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
        )}

        {/* ──────── Step 1: Upload chứng từ ──────── */}
        {step === 1 && (
          <FileUploadField
            files={files}
            onFilesChange={setFiles}
            disabled={isSubmitting}
            maxFiles={5}
            label="Tải chứng từ điều chuyển đính kèm (tuỳ chọn)"
            hint="PDF, DOCX, XLSX, CSV · tối đa 20MB mỗi tệp · tối đa 5 tệp"
          />
        )}

        {/* ──────── Step 2: Products ──────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Tìm sản phẩm theo tên, SKU hoặc barcode..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* Product picker */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
              {productsLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-gray-400">
                  Đang tải...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-xs text-gray-400">
                  Không tìm thấy
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {p.name}
                      </p>
                      <div className="flex gap-2 text-xs text-gray-500">
                        <span>SKU: {p.code}</span>
                        <span>· {p.unit}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProduct(p.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-all hover:bg-orange-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Max items warning */}
            {items.length >= 150 && (
              <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                <AlertTriangle size={12} className="shrink-0" />
                <span>
                  Giới hạn 150 mặt hàng mỗi phiếu điều chuyển.
                </span>
              </div>
            )}

            {/* Selected items */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">
                Sản phẩm điều chuyển{" "}
                {items.length > 0 && (
                  <span className="text-xs text-gray-400">
                    ({items.length})
                  </span>
                )}
              </p>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                  Chọn sản phẩm để thêm vào phiếu điều chuyển.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const product = products.find(
                      (p) => p.id === item.product_id,
                    );
                    const productLocations = getLocationsForProduct(
                      item.product_id,
                    );
                    const hasLocations = productLocations.length > 0;
                    const isLocLoading = srcLocLoading || invLoading;

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        {/* Item header */}
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-semibold text-orange-600">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {item.product_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {product?.code} · {product?.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={12} /> Xóa
                          </button>
                        </div>

                        {/* Item fields */}
                        <div
                          className={`grid gap-3 ${isIntra ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
                        >
                          {/* Quantity */}
                          <div>
                            <label className="mb-0.5 block text-[11px] text-gray-400">
                              Số lượng *
                            </label>
                            <input
                              type="number"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "quantity",
                                  Number(e.target.value),
                                )
                              }
                              min={1}
                              className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400"
                            />
                          </div>

                          {/* Source location */}
                          <div>
                            <label className="mb-0.5 block text-[11px] text-gray-400">
                              Vị trí nguồn *
                            </label>
                            <select
                              value={item.source_location_id}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "source_location_id",
                                  e.target.value,
                                )
                              }
                              disabled={
                                isLocLoading ||
                                !sourceWarehouseId ||
                                !hasLocations
                              }
                              className={`w-full rounded border bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400 disabled:opacity-50 ${
                                !hasLocations &&
                                !isLocLoading &&
                                sourceWarehouseId
                                  ? "border-amber-300"
                                  : "border-gray-200"
                              }`}
                            >
                              <option value="">
                                {!sourceWarehouseId
                                  ? "Chọn kho trước"
                                  : isLocLoading
                                    ? "Đang tải..."
                                    : !hasLocations
                                      ? "⚠ Không có vị trí"
                                      : "— Chọn vị trí —"}
                              </option>
                              {productLocations.map((pl) => {
                                const loc = srcLocations.find(
                                  (l) => l.id === pl.locationId,
                                );
                                return (
                                  <option
                                    key={pl.locationId}
                                    value={pl.locationId}
                                  >
                                    {loc
                                      ? `${loc.name} (${loc.code})`
                                      : pl.locationId}{" "}
                                    · ATP: {pl.atpQty}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Dest location (INTRA only) */}
                          {isIntra && (
                            <div>
                              <label className="mb-0.5 block text-[11px] text-gray-400">
                                Vị trí đích *
                              </label>
                              <select
                                value={item.destination_location_id}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "destination_location_id",
                                    e.target.value,
                                  )
                                }
                                disabled={
                                  dstLocLoading || !sourceWarehouseId
                                }
                                className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400 disabled:opacity-50"
                              >
                                <option value="">— Chọn vị trí đích —</option>
                                {dstLocations
                                  .filter(
                                    (l) => l.id !== item.source_location_id,
                                  )
                                  .map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name} ({l.code})
                                    </option>
                                  ))}
                              </select>
                              {item.source_location_id &&
                                item.destination_location_id &&
                                item.source_location_id ===
                                  item.destination_location_id && (
                                  <p className="mt-0.5 text-[10px] text-red-500">
                                    Vị trí nguồn và đích không được trùng
                                  </p>
                                )}
                            </div>
                          )}
                        </div>

                        {/* ATP warning */}
                        {item.source_location_id &&
                          item.quantity > 0 &&
                          (() => {
                            const atp = getAtp(
                              item.product_id,
                              item.source_location_id,
                            );
                            if (item.quantity > atp) {
                              return (
                                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                                  <AlertTriangle
                                    size={12}
                                    className="shrink-0"
                                  />
                                  <span>
                                    SL chuyển ({item.quantity}) vượt quá khả
                                    dụng ({atp}).
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────── Step 3: Confirm ──────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Xác nhận thông tin điều chuyển
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Loại điều chuyển</span>
                <span className="font-medium">
                  {isIntra ? "Trong kho" : "Liên kho"}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">
                  {isIntra ? "Kho thực hiện" : "Kho nguồn"}
                </span>
                <span className="font-medium">
                  {warehouses.find((w) => w.id === sourceWarehouseId)?.name ||
                    "—"}
                </span>
              </div>
              {!isIntra && (
                <div className="flex justify-between border-b border-gray-100 py-2">
                  <span className="text-gray-500">Kho đích</span>
                  <span className="font-medium">
                    {warehouses.find((w) => w.id === destWarehouseId)?.name ||
                      "—"}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Tệp đính kèm</span>
                <span className="font-medium">{files.length} tệp</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Sản phẩm</span>
                <span className="font-medium">
                  {items.length} mặt hàng
                </span>
              </div>
            </div>

            {/* Items summary table */}
            {items.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Sản phẩm
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        SL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-gray-50"
                      >
                        <td className="px-3 py-1.5 text-gray-700">
                          {item.product_name}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-gray-900">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {notes && (
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <span className="font-medium">Ghi chú:</span> {notes}
              </div>
            )}

            {isIntra && (
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                <span className="font-semibold">Lưu ý:</span> Điều chuyển
                trong kho sẽ được thực hiện ngay lập tức sau khi xác nhận.
                Hàng hóa sẽ được di chuyển mà không cần phê duyệt.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation dialog overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">
              {isIntra
                ? "Xác nhận điều chuyển?"
                : "Xác nhận tạo phiếu?"}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {isIntra
                ? "Hàng hóa sẽ được di chuyển ngay lập tức. Hành động này không thể hoàn tác."
                : "Phiếu sẽ được gửi vào quy trình duyệt. Bạn có muốn tiếp tục?"}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                  isIntra
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {isSubmitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Quay lại
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => canGoNext() && setStep(step + 1)}
            disabled={!canGoNext()}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            Tiếp theo <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 ${
              isIntra
                ? "bg-emerald-500 hover:bg-emerald-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {isSubmitting
              ? "Đang xử lý..."
              : isIntra
                ? "Xác nhận điều chuyển"
                : "Gửi duyệt"}
          </button>
        )}
      </div>
    </div>
  );
}
