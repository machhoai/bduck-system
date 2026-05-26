"use client";

import { useTranslation } from "@/lib/i18n";
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, PenSquare } from "lucide-react";

export function WarehouseAuditCard() {
  const { t } = useTranslation();

  // Mock data for now as per user request
  const mockActivities = [
    {
      id: "1",
      type: "import",
      user: "Nguyễn Văn A",
      time: "10 phút trước",
      desc: "Nhập 500 sản phẩm từ nhà cung cấp XYZ",
      icon: ArrowDownToLine,
      color: "text-green-600 bg-green-50 border-green-100",
    },
    {
      id: "2",
      type: "export",
      user: "Trần Thị B",
      time: "2 giờ trước",
      desc: "Xuất 120 sản phẩm cho Cửa hàng Q1",
      icon: ArrowUpFromLine,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      id: "3",
      type: "transfer",
      user: "Lê Văn C",
      time: "1 ngày trước",
      desc: "Điều chuyển 50 sản phẩm sang Kho phụ",
      icon: ArrowRightLeft,
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
    {
      id: "4",
      type: "update",
      user: "Admin",
      time: "2 ngày trước",
      desc: "Cập nhật sức chứa của vị trí A1-01",
      icon: PenSquare,
      color: "text-orange-600 bg-orange-50 border-orange-100",
    },
  ];

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t.warehouses.recentActivity}
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="relative border-l border-[var(--color-border-subtle)] ml-3 space-y-6 pb-2">
          {mockActivities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="relative pl-6">
                <div className={`absolute -left-[17px] flex h-[34px] w-[34px] items-center justify-center rounded-full border ${activity.color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {activity.user}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {activity.time}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {activity.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
