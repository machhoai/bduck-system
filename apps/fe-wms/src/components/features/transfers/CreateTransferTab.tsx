"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useInventoryByWarehouse } from "../../../hooks/useInventoryByWarehouse";
import { useProducts } from "../../../hooks/useProducts";
import { createTransferOrder } from "../../../hooks/useTransferOrderApi";
import {
  useWarehouseLocations,
  useWarehouses,
} from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";
import { uploadFile } from "../../../lib/uploadFile";
import { useUserStore } from "../../../stores/useUserStore";
import {
  FileUploadField,
  type SelectedFile,
} from "../../shared/FileUploadField";

type Locale = "vi" | "zh";
type StepId = 0 | 1 | 2 | 3;
type TransferTypeValue = "INTRA_WAREHOUSE" | "INTER_WAREHOUSE";

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

const COPY = {
  vi: {
    info: "Thông tin",
    upload: "Chứng từ",
    products: "Sản phẩm",
    confirm: "Xác nhận",
    intra: "Trong kho",
    inter: "Liên kho",
    intraDesc:
      "Di chuyển hàng giữa các vị trí trong cùng 1 kho",
    interDesc: "Chuyển hàng từ kho này sang kho khác",
    transferType: "Loại điều chuyển",
    executionWarehouse: "Kho thực hiện",
    sourceWarehouse: "Kho nguồn",
    destinationWarehouse: "Kho đích",
    chooseWarehouse: "Chọn kho",
    chooseSource: "Chọn kho nguồn",
    chooseDestination: "Chọn kho đích",
    loading: "Đang tải...",
    sameWarehouse: "Kho nguồn và kho đích không được trùng nhau",
    notes: "Ghi chú",
    notesPlaceholder: "Ghi chú bổ sung...",
    uploadLabel: "Tải chứng từ điều chuyển đính kèm (tuỳ chọn)",
    uploadHint: "PDF, DOCX, XLSX, CSV - tối đa 20MB mỗi tệp - tối đa 5 tệp",
    searchProduct: "Tìm sản phẩm theo tên, SKU hoặc barcode...",
    noProducts: "Không tìm thấy",
    selectedProducts: "Sản phẩm điều chuyển",
    emptyProducts: "Chọn sản phẩm để thêm vào phiếu điều chuyển.",
    delete: "Xóa",
    quantity: "Số lượng",
    sourceLocation: "Vị trí nguồn",
    destinationLocation: "Vị trí đích",
    selectWarehouseFirst: "Chọn kho trước",
    noLocation: "Không có vị trí",
    selectLocation: "Chọn vị trí",
    selectDestinationLocation: "Chọn vị trí đích",
    sameLocation:
      "Vị trí nguồn và đích không được trùng",
    atpWarning:
      "SL chuyển ({quantity}) vượt quá khả dụng ({atp}).",
    confirmTitle: "Xác nhận thông tin điều chuyển",
    attachments: "Tệp đính kèm",
    itemCount: "mặt hàng",
    fileCount: "tệp",
    noteTitle: "Lưu ý",
    intraNotice:
      "Điều chuyển trong kho sẽ được thực hiện ngay sau khi xác nhận. Hàng hóa sẽ được di chuyển mà không cần phê duyệt.",
    confirmIntraTitle: "Xác nhận điều chuyển?",
    confirmInterTitle: "Xác nhận tạo phiếu?",
    confirmIntraDesc:
      "Hàng hóa sẽ được di chuyển ngay lập tức. Hành động này không thể hoàn tác.",
    confirmInterDesc:
      "Phiếu sẽ được gửi vào quy trình duyệt. Bạn có muốn tiếp tục?",
    cancel: "Hủy",
    back: "Quay lại",
    next: "Tiếp theo",
    processing: "Đang xử lý...",
    submitIntra: "Xác nhận điều chuyển",
    submitInter: "Gửi duyệt",
    retry: "Thử lại",
    intraLoading: "Đang điều chuyển trong kho...",
    interLoading: "Đang tạo phiếu điều chuyển...",
    intraSuccess: "Điều chuyển trong kho thành công",
    interSuccess: "Đã tạo phiếu điều chuyển",
    createError: "Lỗi khi tạo phiếu điều chuyển",
    intraSuccessDesc: "Hàng hóa đã được di chuyển ngay lập tức.",
    interSuccessDesc: "Phiếu đã được gửi vào quy trình duyệt.",
    errorDesc: "Vui lòng thử lại hoặc liên hệ quản trị viên.",
  },
  zh: {
    info: "信息",
    upload: "凭证",
    products: "产品",
    confirm: "确认",
    intra: "库内",
    inter: "跨库",
    intraDesc: "在同一仓库内的库位间移动货品",
    interDesc: "将货品从一个仓库调拨到另一个仓库",
    transferType: "调拨类型",
    executionWarehouse: "执行仓库",
    sourceWarehouse: "源仓库",
    destinationWarehouse: "目标仓库",
    chooseWarehouse: "选择仓库",
    chooseSource: "选择源仓库",
    chooseDestination: "选择目标仓库",
    loading: "正在加载...",
    sameWarehouse: "源仓库和目标仓库不能相同",
    notes: "备注",
    notesPlaceholder: "补充备注...",
    uploadLabel: "上传调拨凭证（可选）",
    uploadHint: "PDF, DOCX, XLSX, CSV - 每个文件最多 20MB - 最多 5 个文件",
    searchProduct: "按名称、SKU 或条码搜索产品...",
    noProducts: "未找到",
    selectedProducts: "调拨产品",
    emptyProducts: "选择产品以添加到调拨单。",
    delete: "删除",
    quantity: "数量",
    sourceLocation: "源库位",
    destinationLocation: "目标库位",
    selectWarehouseFirst: "请先选择仓库",
    noLocation: "没有库位",
    selectLocation: "选择库位",
    selectDestinationLocation: "选择目标库位",
    sameLocation: "源库位和目标库位不能相同",
    atpWarning: "调拨数量 ({quantity}) 超过可用数量 ({atp})。",
    confirmTitle: "确认调拨信息",
    attachments: "附件",
    itemCount: "项",
    fileCount: "个文件",
    noteTitle: "注意",
    intraNotice:
      "库内调拨将在确认后立即执行，无需审批。",
    confirmIntraTitle: "确认调拨？",
    confirmInterTitle: "确认创建调拨单？",
    confirmIntraDesc: "货品将立即移动，此操作不可撤销。",
    confirmInterDesc: "调拨单将进入审批流程。是否继续？",
    cancel: "取消",
    back: "返回",
    next: "下一步",
    processing: "正在处理...",
    submitIntra: "确认调拨",
    submitInter: "提交审批",
    retry: "重试",
    intraLoading: "正在执行库内调拨...",
    interLoading: "正在创建调拨单...",
    intraSuccess: "库内调拨成功",
    interSuccess: "已创建调拨单",
    createError: "创建调拨单失败",
    intraSuccessDesc: "货品已立即移动。",
    interSuccessDesc: "调拨单已提交审批流程。",
    errorDesc: "请重试或联系管理员。",
  },
} as const;

const TRANSFER_TYPES = [
  {
    value: "INTRA_WAREHOUSE" as TransferTypeValue,
    labelKey: "intra",
    descKey: "intraDesc",
    icon: ArrowRightLeft,
  },
  {
    value: "INTER_WAREHOUSE" as TransferTypeValue,
    labelKey: "inter",
    descKey: "interDesc",
    icon: ArrowUpRight,
  },
] as const;

const STEPS = [
  { id: 0 as StepId, icon: ClipboardList, labelKey: "info" },
  { id: 1 as StepId, icon: Upload, labelKey: "upload" },
  { id: 2 as StepId, icon: Package, labelKey: "products" },
  { id: 3 as StepId, icon: CheckCircle2, labelKey: "confirm" },
] as const;

export default function CreateTransferTab({
  prefillWarehouseId,
  onCreated,
}: Props) {
  const { lang } = useTranslation();
  const copy = COPY[(lang || "vi") as Locale];
  const user = useUserStore((s) => s.user);
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { products, loading: productsLoading } = useProducts();
  const [step, setStep] = useState<StepId>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [transferType, setTransferType] =
    useState<TransferTypeValue>("INTRA_WAREHOUSE");
  const [sourceWarehouseId, setSourceWarehouseId] = useState(
    prefillWarehouseId || "",
  );
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItemData[]>([]);

  const isIntra = transferType === "INTRA_WAREHOUSE";

  useEffect(() => {
    if (isIntra && sourceWarehouseId) {
      setDestWarehouseId(sourceWarehouseId);
    }
  }, [isIntra, sourceWarehouseId]);

  useEffect(() => {
    if (prefillWarehouseId) setSourceWarehouseId(prefillWarehouseId);
  }, [prefillWarehouseId]);

  useEffect(() => {
    setItems([]);
  }, [sourceWarehouseId]);

  const { locations: srcLocations, loading: srcLocLoading } =
    useWarehouseLocations(sourceWarehouseId || undefined);
  const { getLocationsForProduct, getAtp, loading: invLoading } =
    useInventoryByWarehouse(sourceWarehouseId || undefined);
  const { locations: dstLocations, loading: dstLocLoading } =
    useWarehouseLocations(
      isIntra ? sourceWarehouseId || undefined : destWarehouseId || undefined,
    );

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

  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 0:
        if (!sourceWarehouseId) return false;
        if (isIntra) return true;
        return destWarehouseId !== "" && destWarehouseId !== sourceWarehouseId;
      case 1:
        return true;
      case 2:
        return (
          items.length > 0 &&
          items.length <= 150 &&
          items.every((item) => {
            if (!item.product_id || item.quantity <= 0 || !item.source_location_id) {
              return false;
            }
            if (isIntra && !item.destination_location_id) return false;
            if (
              isIntra &&
              item.source_location_id === item.destination_location_id
            ) {
              return false;
            }
            return true;
          })
        );
      default:
        return true;
    }
  }, [step, sourceWarehouseId, destWarehouseId, isIntra, items]);

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

  const handleSwap = () => {
    if (isIntra) return;
    const temp = sourceWarehouseId;
    setSourceWarehouseId(destWarehouseId);
    setDestWarehouseId(temp);
    setItems([]);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setShowConfirm(false);
    setIsSubmitting(true);

    const submitAction = async () => {
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
        loading: isIntra ? copy.intraLoading : copy.interLoading,
        success: isIntra ? copy.intraSuccess : copy.interSuccess,
        error: copy.createError,
        description: {
          success: isIntra ? copy.intraSuccessDesc : copy.interSuccessDesc,
          error: copy.errorDesc,
        },
        action: {
          error: { label: copy.retry, onClick: () => void handleSubmit() },
        },
      });
      onCreated();
    } catch {
      // Toast handles error.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-1">
              {index > 0 && (
                <div
                  className={`h-px w-6 shrink-0 lg:w-10 ${
                    isCompleted ? "bg-orange-500" : "bg-gray-200"
                  }`}
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
                <span className="hidden sm:inline">{copy[s.labelKey]}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 lg:p-4">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                {copy.transferType} *
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
                          {copy[tt.labelKey]}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {copy[tt.descKey]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {isIntra ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  {copy.executionWarehouse} *
                </label>
                <select
                  value={sourceWarehouseId}
                  onChange={(e) => setSourceWarehouseId(e.target.value)}
                  disabled={warehousesLoading}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                >
                  <option value="">
                    {warehousesLoading ? copy.loading : copy.chooseWarehouse}
                  </option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr,auto,1fr]">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-600">
                      {copy.sourceWarehouse} *
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
                        {warehousesLoading ? copy.loading : copy.chooseSource}
                      </option>
                      {warehouses
                        .filter((wh) => wh.id !== destWarehouseId)
                        .map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwap}
                    disabled={!sourceWarehouseId || !destWarehouseId}
                    className="self-end rounded-lg border border-gray-200 p-2.5 text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-30"
                  >
                    <ArrowRightLeft size={18} />
                  </button>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-600">
                      {copy.destinationWarehouse} *
                    </label>
                    <select
                      value={destWarehouseId}
                      onChange={(e) => setDestWarehouseId(e.target.value)}
                      disabled={warehousesLoading}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                    >
                      <option value="">
                        {warehousesLoading
                          ? copy.loading
                          : copy.chooseDestination}
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
                      <span>{copy.sameWarehouse}</span>
                    </div>
                  )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                {copy.notes}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={copy.notesPlaceholder}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <FileUploadField
            files={files}
            onFilesChange={setFiles}
            disabled={isSubmitting}
            maxFiles={5}
            label={copy.uploadLabel}
            hint={copy.uploadHint}
          />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={copy.searchProduct}
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
              {productsLoading ? (
                <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                  {copy.loading}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                  {copy.noProducts}
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {product.name}
                      </p>
                      <div className="flex gap-2 text-xs text-gray-500">
                        <span>SKU: {product.code}</span>
                        <span>/ {product.unit}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProduct(product.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-all hover:bg-orange-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">
                {copy.selectedProducts}{" "}
                {items.length > 0 && (
                  <span className="text-xs text-gray-400">
                    ({items.length})
                  </span>
                )}
              </p>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
                  {copy.emptyProducts}
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => {
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
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xxs font-semibold text-orange-600">
                              {index + 1}
                            </span>
                            <span className="truncate text-sm font-medium text-gray-900">
                              {item.product_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {product?.code} / {product?.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={12} />
                            {copy.delete}
                          </button>
                        </div>

                        <div
                          className={`grid gap-3 ${
                            isIntra ? "sm:grid-cols-3" : "sm:grid-cols-2"
                          }`}
                        >
                          <label>
                            <span className="mb-0.5 block text-xxs text-gray-400">
                              {copy.quantity} *
                            </span>
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
                          </label>

                          <label>
                            <span className="mb-0.5 block text-xxs text-gray-400">
                              {copy.sourceLocation} *
                            </span>
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
                                  ? copy.selectWarehouseFirst
                                  : isLocLoading
                                    ? copy.loading
                                    : !hasLocations
                                      ? copy.noLocation
                                      : copy.selectLocation}
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
                                    / ATP: {pl.atpQty}
                                  </option>
                                );
                              })}
                            </select>
                          </label>

                          {isIntra && (
                            <label>
                              <span className="mb-0.5 block text-xxs text-gray-400">
                                {copy.destinationLocation} *
                              </span>
                              <select
                                value={item.destination_location_id}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "destination_location_id",
                                    e.target.value,
                                  )
                                }
                                disabled={dstLocLoading || !sourceWarehouseId}
                                className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400 disabled:opacity-50"
                              >
                                <option value="">
                                  {copy.selectDestinationLocation}
                                </option>
                                {dstLocations
                                  .filter(
                                    (l) => l.id !== item.source_location_id,
                                  )
                                  .map((location) => (
                                    <option
                                      key={location.id}
                                      value={location.id}
                                    >
                                      {location.name} ({location.code})
                                    </option>
                                  ))}
                              </select>
                              {item.source_location_id &&
                                item.destination_location_id &&
                                item.source_location_id ===
                                  item.destination_location_id && (
                                  <p className="mt-0.5 text-xxs text-red-500">
                                    {copy.sameLocation}
                                  </p>
                                )}
                            </label>
                          )}
                        </div>

                        {item.source_location_id &&
                          item.quantity > 0 &&
                          (() => {
                            const atp = getAtp(
                              item.product_id,
                              item.source_location_id,
                            );
                            if (item.quantity <= atp) return null;
                            return (
                              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xxs text-amber-700">
                                <AlertTriangle
                                  size={12}
                                  className="shrink-0"
                                />
                                <span>
                                  {copy.atpWarning
                                    .replace(
                                      "{quantity}",
                                      String(item.quantity),
                                    )
                                    .replace("{atp}", String(atp))}
                                </span>
                              </div>
                            );
                          })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {copy.confirmTitle}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">{copy.transferType}</span>
                <span className="font-medium">
                  {isIntra ? copy.intra : copy.inter}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">
                  {isIntra ? copy.executionWarehouse : copy.sourceWarehouse}
                </span>
                <span className="font-medium">
                  {warehouses.find((w) => w.id === sourceWarehouseId)?.name ||
                    "-"}
                </span>
              </div>
              {!isIntra && (
                <div className="flex justify-between border-b border-gray-100 py-2">
                  <span className="text-gray-500">
                    {copy.destinationWarehouse}
                  </span>
                  <span className="font-medium">
                    {warehouses.find((w) => w.id === destWarehouseId)?.name ||
                      "-"}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">{copy.attachments}</span>
                <span className="font-medium">
                  {files.length} {copy.fileCount}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">{copy.products}</span>
                <span className="font-medium">
                  {items.length} {copy.itemCount}
                </span>
              </div>
            </div>

            {items.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        {copy.products}
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        SL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-gray-50">
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
                <span className="font-medium">{copy.notes}:</span> {notes}
              </div>
            )}

            {isIntra && (
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                <span className="font-semibold">{copy.noteTitle}:</span>{" "}
                {copy.intraNotice}
              </div>
            )}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[500px] rounded-2xl bg-white p-4 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">
              {isIntra ? copy.confirmIntraTitle : copy.confirmInterTitle}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {isIntra ? copy.confirmIntraDesc : copy.confirmInterDesc}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
              >
                {copy.cancel}
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
                {isSubmitting ? copy.processing : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 && setStep((step - 1) as StepId)}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          {copy.back}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => canGoNext() && setStep((step + 1) as StepId)}
            disabled={!canGoNext()}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            {copy.next}
            <ChevronRight size={14} />
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
              ? copy.processing
              : isIntra
                ? copy.submitIntra
                : copy.submitInter}
          </button>
        )}
      </div>
    </div>
  );
}
