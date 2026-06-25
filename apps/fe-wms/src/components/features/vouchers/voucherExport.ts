import { collection, getDocs, query, where } from "firebase/firestore";
import type { User } from "@bduck/shared-types";
import type { ExportConfig } from "@/utils/exportExcel";
import { formatExportDate } from "@/utils/exportExcel";
import { db } from "@/lib/firebase";
import type { UnifiedVoucher } from "../../../types/unified-voucher";

export interface VoucherFilters {
  search: string;
  type: string;
  status: string;
  creatorId: string;
  approverId: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  sort: "newest" | "oldest";
}

interface NamedWarehouse {
  id: string;
  name?: string | null;
  code?: string | null;
}

interface ExportBuildContext {
  vouchers: UnifiedVoucher[];
  filters: VoucherFilters;
  users: User[];
  warehouses: NamedWarehouse[];
  entityType: string;
  filename: string;
  statusLabels?: Record<string, string>;
}

type RawRecord = Record<string, any>;

const TYPE_LABELS: Record<string, string> = {
  IMPORT: "Nhập kho",
  EXPORT: "Xuất kho",
  TRANSFER: "Điều chuyển",
};

function parseVoucherDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof timestamp.toDate === "function") {
      try {
        const date = timestamp.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        // Firestore Timestamp methods can depend on their original receiver.
      }
    }

    if (typeof timestamp.toMillis === "function") {
      try {
        const date = new Date(timestamp.toMillis());
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    }

    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
  }

  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getVoucherTimestamp(voucher: UnifiedVoucher): number {
  return parseVoucherDate(voucher.created_at)?.getTime() ?? 0;
}

function toDateInput(value: unknown) {
  const date = parseVoucherDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getRawSearchValues(voucher: UnifiedVoucher) {
  const raw = voucher.raw as RawRecord;
  return [
    voucher.id,
    voucher.voucher_number,
    voucher.status,
    voucher.type,
    voucher.notes,
    voucher.creator_id,
    voucher.approver_id,
    voucher.warehouse_id,
    voucher.destination_warehouse_id,
    raw.supplier_name,
    raw.purchase_order_id,
    raw.export_type,
    raw.reference_id,
    raw.reference_type,
    raw.recipient_name,
    raw.recipient_department,
    raw.transfer_type,
    raw.source_warehouse_id,
    raw.destination_warehouse_id,
    raw.export_voucher_id,
    raw.received_by,
    raw.reauth_confirmed_by,
  ];
}

function getVoucherDateKey(voucher: UnifiedVoucher) {
  const raw = voucher.raw as RawRecord;
  return toDateInput(voucher.created_at || raw.created_at || raw.action_time);
}

function getVoucherWarehouseIds(voucher: UnifiedVoucher) {
  const raw = voucher.raw as RawRecord;
  return [
    voucher.warehouse_id,
    voucher.destination_warehouse_id,
    raw.warehouse_id,
    raw.source_warehouse_id,
    raw.destination_warehouse_id,
  ].filter(Boolean);
}

export function filterUnifiedVouchers(
  vouchers: UnifiedVoucher[],
  filters: VoucherFilters,
) {
  const search = normalize(filters.search);
  let list = vouchers.filter((voucher) => {
    const voucherDate = getVoucherDateKey(voucher);
    return (
      (!search ||
        getRawSearchValues(voucher).some((value) =>
          normalize(value).includes(search),
        )) &&
      (!filters.type || voucher.type === filters.type) &&
      (!filters.status || voucher.status === filters.status) &&
      (!filters.creatorId || voucher.creator_id === filters.creatorId) &&
      (!filters.approverId || voucher.approver_id === filters.approverId) &&
      (!filters.warehouseId ||
        getVoucherWarehouseIds(voucher).includes(filters.warehouseId)) &&
      (!filters.dateFrom || (voucherDate && voucherDate >= filters.dateFrom)) &&
      (!filters.dateTo || (voucherDate && voucherDate <= filters.dateTo))
    );
  });

  list = [...list].sort((a, b) => {
    const diff = getVoucherTimestamp(b) - getVoucherTimestamp(a);
    return filters.sort === "newest" ? diff : -diff;
  });

  return list;
}

export function hasActiveVoucherFilters(filters: VoucherFilters) {
  return Boolean(
    filters.search.trim() ||
    filters.type ||
    filters.status ||
    filters.creatorId ||
    filters.approverId ||
    filters.warehouseId ||
    filters.dateFrom ||
    filters.dateTo,
  );
}

export function getDefaultVoucherFilters(
  initialTypeFilter?: string,
): VoucherFilters {
  return {
    search: "",
    type: initialTypeFilter ?? "",
    status: "",
    creatorId: "",
    approverId: "",
    warehouseId: "",
    dateFrom: "",
    dateTo: "",
    sort: "newest",
  };
}

export function uniqueVoucherStatuses(vouchers: UnifiedVoucher[]) {
  return Array.from(new Set(vouchers.map((voucher) => String(voucher.status))))
    .filter(Boolean)
    .sort();
}

function getVoucherCollection(type: string) {
  if (type === "IMPORT") return "import_vouchers";
  if (type === "EXPORT") return "export_vouchers";
  return "transfer_orders";
}

function getUserDisplay(
  userId: string | null | undefined,
  userById: Map<string, User>,
) {
  if (!userId) return "";
  const user = userById.get(userId);
  return user?.full_name || user?.email || userId;
}

function getWarehouseDisplay(
  warehouseId: string | null | undefined,
  warehouseById: Map<string, NamedWarehouse>,
) {
  if (!warehouseId) return "";
  const warehouse = warehouseById.get(warehouseId);
  return warehouse?.name || warehouse?.code || warehouseId;
}

function safeJson(value: unknown) {
  if (value == null) return "";
  try {
    return JSON.stringify(value, (_key, current) => {
      if (current instanceof Date) return current.toISOString();
      if (current && typeof current === "object") {
        if (typeof current.toDate === "function") {
          try {
            return current.toDate().toISOString();
          } catch {
            return current;
          }
        }
        if (typeof current.seconds === "number") {
          return new Date(current.seconds * 1000).toISOString();
        }
        if (typeof current._seconds === "number") {
          return new Date(current._seconds * 1000).toISOString();
        }
      }
      return current;
    });
  } catch {
    return String(value);
  }
}

async function fetchVoucherItems(voucher: UnifiedVoucher) {
  const collectionName = getVoucherCollection(voucher.type);
  const snap = await getDocs(
    collection(db, collectionName, voucher.id, "items"),
  );
  const subcollectionItems = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  if (subcollectionItems.length > 0) {
    return subcollectionItems.filter(
      (item: RawRecord) => item.is_deleted !== true,
    );
  }

  const rawItems = (voucher.raw as RawRecord).items;
  return Array.isArray(rawItems)
    ? rawItems.filter((item: RawRecord) => item?.is_deleted !== true)
    : [];
}

async function fetchVoucherApprovals(voucherId: string) {
  const snap = await getDocs(
    query(
      collection(db, "pending_approvals"),
      where("entity_id", "==", voucherId),
    ),
  );
  return snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort(
      (a: RawRecord, b: RawRecord) =>
        Number(a.level || 0) - Number(b.level || 0),
    );
}

function getApprovalSummary(
  approvals: RawRecord[],
  userById: Map<string, User>,
) {
  if (!approvals.length) return "";
  return approvals
    .map((approval) => {
      const level = Number(approval.level ?? 0) + 1;
      const approver =
        getUserDisplay(approval.approver_id, userById) || "Chưa duyệt";
      const time = formatExportDate(approval.approved_at);
      const suffix = time ? ` lúc ${time}` : "";
      return `Cấp ${level}: ${approval.status} - ${approver}${suffix}`;
    })
    .join("; ");
}

function getApprovalLevelValue(
  approvals: RawRecord[],
  level: number,
  userById: Map<string, User>,
) {
  const records = approvals.filter(
    (approval) => Number(approval.level || 0) === level,
  );
  if (!records.length) return "";
  return records
    .map((approval) => {
      const approver =
        getUserDisplay(approval.approver_id, userById) || "Chưa duyệt";
      const time = formatExportDate(approval.approved_at);
      return [
        approval.status,
        approver,
        time,
        approval.comments,
        approval.rejected_reason,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("; ");
}

function getItemQuantity(item: RawRecord) {
  return (
    item.expected_quantity ??
    item.quantity ??
    item.actual_quantity ??
    item.picked_quantity ??
    item.received_quantity ??
    ""
  );
}

function getLineTotal(item: RawRecord) {
  const quantity = Number(
    item.quantity ?? item.expected_quantity ?? item.actual_quantity ?? 0,
  );
  const price = Number(item.unit_price ?? 0);
  return quantity && price ? quantity * price : "";
}

async function buildVoucherExportRows(context: ExportBuildContext) {
  const userById = new Map(context.users.map((user) => [user.id, user]));
  const warehouseById = new Map(
    context.warehouses.map((warehouse) => [warehouse.id, warehouse]),
  );

  const rowGroups = await Promise.all(
    context.vouchers.map(async (voucher) => {
      const raw = voucher.raw as RawRecord;
      const [items, approvals] = await Promise.all([
        fetchVoucherItems(voucher),
        fetchVoucherApprovals(voucher.id),
      ]);
      const rowItems = items.length > 0 ? items : [null];
      const sourceWarehouseId = raw.source_warehouse_id || voucher.warehouse_id;
      const destinationWarehouseId =
        raw.destination_warehouse_id || voucher.destination_warehouse_id;

      return rowItems.map((item: RawRecord | null, index: number) => ({
        voucher_id: voucher.id,
        voucher_type: TYPE_LABELS[voucher.type] || voucher.type,
        voucher_number: voucher.voucher_number,
        status:
          context.statusLabels?.[String(voucher.status)] ||
          String(voucher.status),
        warehouse_id: voucher.warehouse_id,
        warehouse_name: getWarehouseDisplay(
          voucher.warehouse_id,
          warehouseById,
        ),
        source_warehouse_id: sourceWarehouseId || "",
        source_warehouse_name: getWarehouseDisplay(
          sourceWarehouseId,
          warehouseById,
        ),
        destination_warehouse_id: destinationWarehouseId || "",
        destination_warehouse_name: getWarehouseDisplay(
          destinationWarehouseId,
          warehouseById,
        ),
        creator_id: voucher.creator_id,
        creator_name: getUserDisplay(voucher.creator_id, userById),
        approver_id: voucher.approver_id || "",
        approver_name: getUserDisplay(voucher.approver_id, userById),
        approved_at: raw.approved_at,
        action_time: raw.action_time || voucher.action_time,
        sync_time: raw.sync_time,
        created_at: raw.created_at || voucher.created_at,
        updated_at: raw.updated_at,
        notes: voucher.notes || raw.notes || "",
        supplier_name: raw.supplier_name || "",
        purchase_order_id: raw.purchase_order_id || "",
        export_type: raw.export_type || "",
        reference_type: raw.reference_type || "",
        reference_id: raw.reference_id || "",
        recipient_name: raw.recipient_name || "",
        recipient_department: raw.recipient_department || "",
        transfer_type: raw.transfer_type || "",
        export_voucher_id: raw.export_voucher_id || "",
        received_by: raw.received_by || "",
        received_by_name: getUserDisplay(raw.received_by, userById),
        received_at: raw.received_at || "",
        dispatched_at: raw.dispatched_at || "",
        requires_reauth: raw.requires_reauth ?? "",
        reauth_confirmed_by: raw.reauth_confirmed_by || "",
        reauth_confirmed_by_name: getUserDisplay(
          raw.reauth_confirmed_by,
          userById,
        ),
        reauth_confirmed_at: raw.reauth_confirmed_at || "",
        atp_deducted: raw.atp_deducted ?? "",
        attachments: Array.isArray(raw.attachment_urls)
          ? raw.attachment_urls.join("\n")
          : "",
        approval_summary: getApprovalSummary(approvals, userById),
        approval_level_1: getApprovalLevelValue(approvals, 0, userById),
        approval_level_2: getApprovalLevelValue(approvals, 1, userById),
        approval_level_3: getApprovalLevelValue(approvals, 2, userById),
        approvals_json: safeJson(approvals),
        item_index: item ? index + 1 : "",
        item_id: item?.id || "",
        product_id: item?.product_id || "",
        product_name: item?.product_name || "",
        product_code: item?.product_code || item?.product_sku || "",
        barcode: item?.barcode || "",
        unit: item?.unit || "",
        warehouse_location_id: item?.warehouse_location_id || "",
        source_location_id: item?.source_location_id || "",
        destination_location_id: item?.destination_location_id || "",
        expected_quantity: item?.expected_quantity ?? "",
        quantity: getItemQuantity(item || {}),
        actual_quantity: item?.actual_quantity ?? "",
        picked_quantity: item?.picked_quantity ?? "",
        received_quantity: item?.received_quantity ?? "",
        unit_price: item?.unit_price ?? "",
        line_total: item ? getLineTotal(item) : "",
        condition: item?.condition || "",
        item_status: item?.status || "",
        item_notes: item?.notes || "",
        config_snapshot_json: safeJson(raw.config_snapshot),
        item_json: safeJson(item),
        raw_json: safeJson(raw),
      }));
    }),
  );

  return rowGroups.flat();
}

export function buildVoucherExportConfig(
  context: ExportBuildContext,
): ExportConfig | null {
  if (!context.vouchers.length) return null;

  return {
    filename: context.filename,
    entityType: context.entityType,
    filters: context.filters,
    data: context.vouchers,
    columns: [
      { header: "ID phiếu", key: "voucher_id", width: 32 },
      { header: "Loại phiếu", key: "voucher_type", width: 16 },
      { header: "Số phiếu", key: "voucher_number", width: 24 },
      { header: "Trạng thái", key: "status", width: 20 },
      { header: "ID kho", key: "warehouse_id", width: 28 },
      { header: "Kho", key: "warehouse_name", width: 24 },
      { header: "ID kho nguồn", key: "source_warehouse_id", width: 28 },
      { header: "Kho nguồn", key: "source_warehouse_name", width: 24 },
      { header: "ID kho đích", key: "destination_warehouse_id", width: 28 },
      { header: "Kho đích", key: "destination_warehouse_name", width: 24 },
      { header: "ID người tạo", key: "creator_id", width: 28 },
      { header: "Người tạo", key: "creator_name", width: 24 },
      { header: "ID người duyệt cuối", key: "approver_id", width: 28 },
      { header: "Người duyệt cuối", key: "approver_name", width: 24 },
      {
        header: "Thời gian duyệt cuối",
        key: "approved_at",
        width: 22,
        format: formatExportDate,
      },
      {
        header: "Thời gian thao tác",
        key: "action_time",
        width: 22,
        format: formatExportDate,
      },
      {
        header: "Thời gian sync",
        key: "sync_time",
        width: 22,
        format: formatExportDate,
      },
      {
        header: "Ngày tạo",
        key: "created_at",
        width: 22,
        format: formatExportDate,
      },
      {
        header: "Ngày cập nhật",
        key: "updated_at",
        width: 22,
        format: formatExportDate,
      },
      { header: "Ghi chú", key: "notes", width: 32 },
      { header: "Nhà cung cấp", key: "supplier_name", width: 24 },
      { header: "PO ID", key: "purchase_order_id", width: 28 },
      { header: "Loại xuất", key: "export_type", width: 18 },
      { header: "Loại tham chiếu", key: "reference_type", width: 18 },
      { header: "ID tham chiếu", key: "reference_id", width: 28 },
      { header: "Người nhận", key: "recipient_name", width: 24 },
      { header: "Bộ phận nhận", key: "recipient_department", width: 24 },
      { header: "Loại điều chuyển", key: "transfer_type", width: 20 },
      { header: "Phiếu xuất liên kết", key: "export_voucher_id", width: 28 },
      { header: "ID người nhận hàng", key: "received_by", width: 28 },
      { header: "Người nhận hàng", key: "received_by_name", width: 24 },
      {
        header: "Thời gian nhận",
        key: "received_at",
        width: 22,
        format: formatExportDate,
      },
      {
        header: "Thời gian xuất kho",
        key: "dispatched_at",
        width: 22,
        format: formatExportDate,
      },
      { header: "Yêu cầu xác thực lại", key: "requires_reauth", width: 18 },
      {
        header: "ID người xác thực lại",
        key: "reauth_confirmed_by",
        width: 28,
      },
      {
        header: "Người xác thực lại",
        key: "reauth_confirmed_by_name",
        width: 24,
      },
      {
        header: "Thời gian xác thực lại",
        key: "reauth_confirmed_at",
        width: 22,
        format: formatExportDate,
      },
      { header: "Đã trừ ATP", key: "atp_deducted", width: 14 },
      { header: "Tệp đính kèm", key: "attachments", width: 42 },
      { header: "Tóm tắt duyệt", key: "approval_summary", width: 52 },
      { header: "Duyệt cấp 1", key: "approval_level_1", width: 38 },
      { header: "Duyệt cấp 2", key: "approval_level_2", width: 38 },
      { header: "Duyệt cấp 3", key: "approval_level_3", width: 38 },
      { header: "Approval JSON", key: "approvals_json", width: 60 },
      { header: "STT dòng", key: "item_index", width: 10 },
      { header: "Item ID", key: "item_id", width: 28 },
      { header: "Product ID", key: "product_id", width: 28 },
      { header: "Tên sản phẩm", key: "product_name", width: 30 },
      { header: "Mã sản phẩm", key: "product_code", width: 18 },
      { header: "Barcode", key: "barcode", width: 18 },
      { header: "Đơn vị", key: "unit", width: 12 },
      { header: "ID vị trí", key: "warehouse_location_id", width: 28 },
      { header: "ID vị trí nguồn", key: "source_location_id", width: 28 },
      { header: "ID vị trí đích", key: "destination_location_id", width: 28 },
      { header: "SL dự kiến", key: "expected_quantity", width: 14 },
      { header: "SL", key: "quantity", width: 12 },
      { header: "SL thực nhận", key: "actual_quantity", width: 14 },
      { header: "SL pick", key: "picked_quantity", width: 14 },
      { header: "SL đã nhận", key: "received_quantity", width: 14 },
      { header: "Đơn giá", key: "unit_price", width: 14 },
      { header: "Thành tiền", key: "line_total", width: 16 },
      { header: "Tình trạng", key: "condition", width: 16 },
      { header: "Trạng thái dòng", key: "item_status", width: 18 },
      { header: "Ghi chú dòng", key: "item_notes", width: 32 },
      {
        header: "Config snapshot JSON",
        key: "config_snapshot_json",
        width: 48,
      },
      { header: "Item JSON", key: "item_json", width: 60 },
      { header: "Raw voucher JSON", key: "raw_json", width: 80 },
    ],
    prepare: async () => ({
      ...buildVoucherExportConfig(context)!,
      prepare: undefined,
      data: await buildVoucherExportRows(context),
    }),
  };
}
