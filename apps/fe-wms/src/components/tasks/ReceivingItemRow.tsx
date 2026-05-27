"use client";

/**
 * ReceivingItemRow — Single item row in the Receiving Session
 *
 * Features:
 * - Inline actual_quantity input (number)
 * - Visual comparison with expected_quantity
 * - Discrepancy highlight (red/green)
 * - Notes field (expandable)
 */

import { useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ReceivingItem } from "@/stores/useReceivingStore";

interface ReceivingItemRowProps {
  item: ReceivingItem;
  isHighlighted: boolean;
  onQuantityChange: (id: string, qty: number) => void;
  onNotesChange: (id: string, notes: string) => void;
}

export default function ReceivingItemRow({
  item,
  isHighlighted,
  onQuantityChange,
  onNotesChange,
}: ReceivingItemRowProps) {
  const [showNotes, setShowNotes] = useState(false);

  const discrepancy = item.actual_quantity - item.expected_quantity;
  const hasDiscrepancy = discrepancy !== 0 && item.actual_quantity > 0;
  const isComplete = item.actual_quantity === item.expected_quantity && item.actual_quantity > 0;

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      onQuantityChange(item.id, isNaN(val) ? 0 : val);
    },
    [item.id, onQuantityChange],
  );

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-300
        ${isHighlighted ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200" : ""}
        ${hasDiscrepancy ? "border-amber-200 bg-amber-50/50" : ""}
        ${isComplete ? "border-emerald-200 bg-emerald-50/30" : ""}
        ${!isHighlighted && !hasDiscrepancy && !isComplete ? "border-gray-100 bg-white" : ""}
      `}
    >
      {/* Product info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {item.product_name}
          </p>
          <p className="text-xs text-gray-500 font-mono">{item.product_sku}</p>
          <p className="mt-0.5 text-xs text-gray-400">{item.location_name}</p>
        </div>

        {/* Status indicator */}
        {isComplete && (
          <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
        )}
        {hasDiscrepancy && (
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
        )}
      </div>

      {/* Quantity row */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Dự kiến</label>
          <div className="mt-0.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 text-center">
            {item.expected_quantity}
          </div>
        </div>

        <div className="flex-1">
          <label className="text-xs text-gray-500">Thực nhận</label>
          <input
            type="number"
            min={0}
            defaultValue={item.actual_quantity}
            onBlur={handleBlur}
            className={`mt-0.5 w-full rounded-lg border px-3 py-2 text-sm font-semibold text-center outline-none
              transition-colors focus:ring-2
              ${
                hasDiscrepancy
                  ? "border-amber-300 text-amber-700 focus:ring-amber-200"
                  : "border-gray-200 text-gray-900 focus:border-blue-400 focus:ring-blue-100"
              }`}
          />
        </div>

        {item.actual_quantity > 0 && (
          <div className="flex-shrink-0 w-14 text-center">
            <label className="text-xs text-gray-500">Lệch</label>
            <div
              className={`mt-0.5 rounded-lg px-2 py-2 text-sm font-bold
                ${
                  discrepancy === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : discrepancy > 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                }`}
            >
              {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
            </div>
          </div>
        )}
      </div>

      {/* Notes toggle */}
      <button
        type="button"
        onClick={() => setShowNotes(!showNotes)}
        className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {showNotes ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Ghi chú
      </button>

      {showNotes && (
        <textarea
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          placeholder="Nhập ghi chú cho sản phẩm này..."
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 
            text-xs text-gray-700 outline-none placeholder:text-gray-400 
            focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      )}
    </div>
  );
}
