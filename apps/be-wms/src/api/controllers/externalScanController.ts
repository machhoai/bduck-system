import { Request, Response } from "express";
import * as externalScanService from "../../services/externalScanService.js";
import { locationRepository } from "../../repositories/locationRepository.js";
import { productRepository } from "../../repositories/productRepository.js";
import { z } from "zod";

const getLocations = async (req: Request, res: Response) => {
  try {
    const client = (req as any).integrationClient!;
    const warehouseId = req.query.warehouse_id as string;

    if (!warehouseId || !client.allowed_warehouse_ids.includes(warehouseId)) {
      return res.status(403).json({
        success: false,
        data: null,
        messages: {
          vi: "Kho không hợp lệ hoặc bạn không có quyền truy cập.",
          zh: "无效的仓库或您无权访问。",
        },
      });
    }

    const locations = await locationRepository.findByWarehouseId(warehouseId);
    
    // Chỉ trả về ACTIVE
    const activeLocations = locations.filter(
      l => l.status === "ACTIVE" && !l.is_deleted
    );

    return res.status(200).json({
      success: true,
      data: activeLocations.map(l => ({
        id: l.id,
        warehouse_id: l.warehouse_id,
        name: l.name,
        code: l.code,
        type: l.type,
        status: l.status,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, data: null, messages: { vi: "Lỗi server", zh: "服务器错误" } });
  }
};

const getProducts = async (req: Request, res: Response) => {
  try {
    const client = (req as any).integrationClient!;
    const warehouseId = req.query.warehouse_id as string;
    const search = req.query.search as string;

    if (!warehouseId || !client.allowed_warehouse_ids.includes(warehouseId)) {
      return res.status(403).json({ success: false, data: null, messages: { vi: "Kho không hợp lệ", zh: "无效的仓库" } });
    }

    const products = await productRepository.findAll();
    
    const activeProducts = products.filter(p => {
      if (!search) return true;
      const lower = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(lower) ||
        p.code.toLowerCase().includes(lower) ||
        (p.barcode && p.barcode.toLowerCase().includes(lower))
      );
    });

    return res.status(200).json({
      success: true,
      data: activeProducts.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        barcode: p.barcode,
        unit: p.unit,
        product_type: p.product_type,
        unit_price: p.unit_price,
        image_url: p.product_image_url && p.product_image_url.length > 0 ? p.product_image_url[0] : null,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, data: null, messages: { vi: "Lỗi server", zh: "服务器错误" } });
  }
};

const scanSchema = z.object({
  barcode: z.string().nullable(),
  product_id: z.string().nullable(),
  warehouse_location_id: z.string(),
  warehouse_id: z.string(),
  quantity: z.number().min(1),
  operator_name: z.string(),
  operator_id_external: z.string().nullable(),
  device_id: z.string().nullable(),
  scan_time: z.string(),
});

const scan = async (req: Request, res: Response) => {
  try {
    const client = (req as any).integrationClient!;
    const parsed = scanSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || "";

    const record = await externalScanService.scanProduct(client, parsed.warehouse_id, parsed, clientIp);

    return res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error: any) {
    console.error("[scan]", error);
    let viMessage = "Đã xảy ra lỗi khi quét mã.";
    let zhMessage = "扫描条形码时出错。";

    if (error.message === "PRODUCT_NOT_FOUND") {
      viMessage = "Sản phẩm không tồn tại.";
      zhMessage = "产品不存在。";
    } else if (error.message === "INSUFFICIENT_ATP") {
      viMessage = "Tồn kho khả dụng (ATP) không đủ.";
      zhMessage = "可用库存 (ATP) 不足。";
      return res.status(400).json({ success: false, data: null, messages: { vi: viMessage, zh: zhMessage } });
    } else if (error.message === "UNAUTHORIZED_WAREHOUSE") {
      return res.status(403).json({ success: false, data: null, messages: { vi: "Sai kho.", zh: "错误" } });
    }

    return res.status(400).json({
      success: false,
      data: null,
      messages: { vi: viMessage, zh: zhMessage },
    });
  }
};

const cancelScan = async (req: Request, res: Response) => {
  try {
    const client = (req as any).integrationClient!;
    const scanId = req.params.scanId as string;

    await externalScanService.cancelScan(scanId, client.id);

    return res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error: any) {
    console.error("[cancelScan]", error);
    return res.status(400).json({
      success: false,
      data: null,
      messages: { vi: "Không thể hủy quét.", zh: "无法取消扫描。" },
    });
  }
};

const submitBatchSchema = z.object({
  warehouse_id: z.string(),
  warehouse_location_id: z.string(),
  shift_date: z.string(),
  operator_name: z.string(),
  operator_id_external: z.string().nullable(),
  notes: z.string().nullable(),
});

const submitBatch = async (req: Request, res: Response) => {
  try {
    const client = (req as any).integrationClient!;
    const parsed = submitBatchSchema.parse(req.body);

    const result = await externalScanService.submitBatch(client, parsed);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[submitBatch]", error);
    return res.status(400).json({
      success: false,
      data: null,
      messages: { vi: "Không thể gửi batch.", zh: "无法提交批次。" },
    });
  }
};

export default {
  getLocations,
  getProducts,
  scan,
  cancelScan,
  submitBatch,
};
