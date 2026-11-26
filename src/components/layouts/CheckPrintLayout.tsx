import React, { useState, useRef } from "react";
import { Move, RotateCcw } from "lucide-react";
import {
  DrcFieldKey,
  ClientProfile,
  FieldOffset,
  LayoutConfig,
  VoucherData,
} from "../../types/voucher";

export type CheckFieldKey =
  | "check_leaf_date"
  | "check_leaf_payee"
  | "check_leaf_amount"
  | "check_leaf_words";

export interface CheckFieldAnchor {
  key: CheckFieldKey;
  label: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  defaultFontPt: number;
  align?: "left" | "center" | "right";
  fontWeight?: "normal" | "bold";
}

/**
 * Exact coordinates from Layouts_DRC.cs (converted from 1/100 inch @ minusX=30, minusY=50 to mm):
 * - Date: (605 - 30 = 575 -> 146mm, 79 - 50 = 29 -> 7.4mm), 11pt
 * - Payee: (135 - 30 = 105 -> 26.7mm, 110 - 50 = 60 -> 15.2mm), 10pt
 * - Amount: (635 - 30 = 605 -> 153.7mm, 114 - 50 = 64 -> 16.3mm), 11pt
 * - Words: (95 - 30 = 65 -> 16.5mm, 145 - 50 = 95 -> 24.1mm), 10pt
 */
export const CHECK_FIELD_ANCHORS: Record<CheckFieldKey, CheckFieldAnchor> = {
  check_leaf_date: {
    key: "check_leaf_date",
    label: "Check Date (MM   DD   YYYY)",
    xMm: 146,
    yMm: 7.5,
    widthMm: 55,
    defaultFontPt: 11,
    align: "left",
    fontWeight: "normal",
  },
  check_leaf_payee: {
    key: "check_leaf_payee",
    label: "Pay to the Order Of (Payee)",
    xMm: 26.7,
    yMm: 15.2,
    widthMm: 120,
    defaultFontPt: 10,
    align: "left",
    fontWeight: "normal",
  },
  check_leaf_amount: {
    key: "check_leaf_amount",
    label: "Amount in Figures",
    xMm: 153.7,
    yMm: 16.3,
    widthMm: 45,
    defaultFontPt: 11,
    align: "left",
    fontWeight: "normal",
  },
  check_leaf_words: {
    key: "check_leaf_words",
    label: "Amount in Words",
    xMm: 16.5,
    yMm: 24.1,
    widthMm: 175,
    defaultFontPt: 10,
    align: "left",
    fontWeight: "normal",
  },
};

interface Props {
  voucher: VoucherData;
  client: ClientProfile;
  payeeOverride?: string;
  calibrationMode: boolean;
  selectedField: DrcFieldKey | null;
  onSelectField: (field: DrcFieldKey | null) => void;
  onUpdateFieldOffset: (field: DrcFieldKey, next: FieldOffset) => void;
  onChangeLayout?: (newLayout: LayoutConfig) => void;
}

export const CheckPrintLayout: React.FC<Props> = ({
  voucher,
  client,
  payeeOverride,
  calibrationMode,
  selectedField,
  onSelectField,
  onUpdateFieldOffset,
  onChangeLayout,
}) => {
  const layout = client.layout_config;
  const fieldOffsets = layout.field_offsets ?? {};

  const payee = payeeOverride?.trim() || voucher.payee_name;
  const amount = voucher.total_amount || 0;
  const amountInWords = voucher.amount_in_words || "";

  // Parse MM/DD/YYYY or YYYY-MM-DD into spaced digits matching Layouts_DRC.cs:
  // string.Join("   ", month.ToCharArray()) + "     " + day + "     " + year
  let month = "01";
  let day = "01";
  let year = "2026";
  const rawDate = (voucher.due_date || voucher.date || "").trim();
  if (rawDate.includes("/")) {
    const parts = rawDate.split("/");
    if (parts.length === 3) {
      month = parts[0].padStart(2, "0");
      day = parts[1].padStart(2, "0");
      year = parts[2];
    }
  } else if (rawDate.includes("-")) {
    const parts = rawDate.split("-");
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1].padStart(2, "0");
      day = parts[2].padStart(2, "0");
    }
  } else {
    const d = new Date(rawDate || Date.now());
    if (!isNaN(d.getTime())) {
      month = String(d.getMonth() + 1).padStart(2, "0");
      day = String(d.getDate()).padStart(2, "0");
      year = String(d.getFullYear());
    }
  }

  const gap = " ".repeat(layout.check_date_spacing ?? 3);
  const formattedMonth = month.split("").join(gap);
  const formattedDay = day.split("").join(gap);
  const formattedYear = year.split("").join(gap);
  const formattedDate = `${formattedMonth}     ${formattedDay}     ${formattedYear}`;

  const xOffset = layout.check_x_offset_mm || 0;
  const yOffset = layout.check_y_offset_mm || 0;

  const [isDraggingLeaf, setIsDraggingLeaf] = useState(false);
  const leafDragStart = useRef<{
    x: number;
    y: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const [isDraggingField, setIsDraggingField] = useState(false);
  const fieldDragRef = useRef<{
    key: CheckFieldKey;
    startClientX: number;
    startClientY: number;
    initialXmm: number;
    initialYmm: number;
  } | null>(null);

  const getFieldOffset = (key: CheckFieldKey): FieldOffset => {
    return fieldOffsets[key] ?? { x_mm: 0, y_mm: 0, font_size_pt: null };
  };

  const getFieldStyle = (key: CheckFieldKey): React.CSSProperties => {
    const anchor = CHECK_FIELD_ANCHORS[key];
    const fOff = getFieldOffset(key);
    const leftMm = anchor.xMm + (fOff.x_mm || 0);
    const topMm = anchor.yMm + (fOff.y_mm || 0);
    const fontPt = fOff.font_size_pt ?? anchor.defaultFontPt;

    return {
      position: "absolute",
      left: `${leftMm}mm`,
      top: `${topMm}mm`,
      width: `${anchor.widthMm}mm`,
      fontSize: `${fontPt}pt`,
      fontWeight: anchor.fontWeight ?? "normal",
      textAlign: anchor.align ?? "left",
      color: "#000000",
      fontFamily: "'Microsoft Sans Serif', Arial, sans-serif",
      lineHeight: 1.2,
      whiteSpace: "pre",
      zIndex: selectedField === key ? 30 : 20,
      userSelect: "none",
      cursor: calibrationMode ? "move" : "grab",
    };
  };

  const handleMouseDownField = (e: React.MouseEvent, key: CheckFieldKey) => {
    if (!calibrationMode) return;
    e.stopPropagation();
    onSelectField(key);
    const current = getFieldOffset(key);
    fieldDragRef.current = {
      key,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialXmm: current.x_mm || 0,
      initialYmm: current.y_mm || 0,
    };
    setIsDraggingField(true);
  };

  const handleMouseDownLeaf = (e: React.MouseEvent) => {
    if (calibrationMode || !onChangeLayout) return;
    setIsDraggingLeaf(true);
    leafDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: xOffset,
      initialY: yOffset,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (calibrationMode && isDraggingField && fieldDragRef.current) {
      const dxMm =
        ((e.clientX - fieldDragRef.current.startClientX) * 25.4) / 96.0;
      const dyMm =
        ((e.clientY - fieldDragRef.current.startClientY) * 25.4) / 96.0;
      const nextX =
        Math.round((fieldDragRef.current.initialXmm + dxMm) * 2) / 2;
      const nextY =
        Math.round((fieldDragRef.current.initialYmm + dyMm) * 2) / 2;
      const current = getFieldOffset(fieldDragRef.current.key);
      onUpdateFieldOffset(fieldDragRef.current.key, {
        ...current,
        x_mm: nextX,
        y_mm: nextY,
      });
      return;
    }

    if (isDraggingLeaf && leafDragStart.current && onChangeLayout) {
      const deltaX = (e.clientX - leafDragStart.current.x) * 0.264583;
      const deltaY = (e.clientY - leafDragStart.current.y) * 0.264583;

      const newX =
        Math.round((leafDragStart.current.initialX + deltaX) * 10) / 10;
      const newY =
        Math.round((leafDragStart.current.initialY + deltaY) * 10) / 10;

      onChangeLayout({
        ...layout,
        check_x_offset_mm: newX,
        check_y_offset_mm: newY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingLeaf(false);
    leafDragStart.current = null;
    setIsDraggingField(false);
    fieldDragRef.current = null;
  };

  const fieldCalibrationClass = (key: CheckFieldKey) => {
    if (!calibrationMode) return "data-field-node";
    const isSel = selectedField === key;
    return `data-field-node rounded-xs transition-shadow ${
      isSel
        ? "outline-2 outline-blue-600 bg-blue-500/15 shadow-xs"
        : "outline-1 outline-dashed outline-amber-500/80 hover:bg-amber-500/10"
    }`;
  };

  return (
    <div
      className="flex flex-col items-center w-full"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Visual Guideline Banner with Quick Controls */}
      <div className="no-print bg-slate-900 border border-slate-800 text-slate-200 px-5 py-2.5 rounded-xl mb-6 text-xs w-full max-w-3xl flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
            <Move className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white block">
              {calibrationMode
                ? "Individual Check Field Alignment Active"
                : "Drag-to-Align Bank Check Printout"}
            </span>
            <span className="text-[11px] text-slate-400">
              {calibrationMode
                ? "Click & drag Date, Payee, Amount, or Amount in Words individually."
                : "Click & drag anywhere on the check leaf to shift the whole check, or click 'Move / Adjust Layout Fields' above."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-700 text-cyan-300 font-bold">
            X: {xOffset}mm
          </span>
          <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-700 text-cyan-300 font-bold">
            Y: {yOffset}mm
          </span>
          {onChangeLayout && (
            <button
              type="button"
              onClick={() =>
                onChangeLayout({
                  ...layout,
                  check_x_offset_mm: 0,
                  check_y_offset_mm: 0,
                })
              }
              title="Reset whole check offset to 0"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Standard 8.0" x 3.0" (203.2mm x 76.2mm) Philippine Bank Cheque Surface */}
      <div
        onMouseDown={handleMouseDownLeaf}
        onClick={() => {
          if (calibrationMode) onSelectField(null);
        }}
        className={`check-leaf-page bg-white text-black relative border-2 ${
          isDraggingLeaf
            ? "border-blue-500 shadow-2xl cursor-grabbing"
            : calibrationMode
            ? "border-amber-400 shadow-xl"
            : "border-dashed border-slate-400 cursor-grab hover:border-blue-400 shadow-xl"
        } print:border-none print:shadow-none print:m-0 print:p-0 transition-all ${
          layout.check_rotate_90
            ? "rotate-90 print:rotate-90 origin-top-left"
            : ""
        }`}
        style={{
          width: "203.2mm",
          minWidth: "203.2mm",
          maxWidth: "203.2mm",
          height: "76.2mm",
          minHeight: "76.2mm",
          maxHeight: "76.2mm",
          boxSizing: "border-box",
          overflow: "hidden",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Non-printing Philippine PCHC Cheque Guide Overlay on Screen */}
        <div className="no-print absolute inset-0 pointer-events-none select-none text-slate-400/70">
          <div className="absolute top-[2.5mm] left-[10mm] text-[7.5pt] font-semibold uppercase tracking-wider text-slate-400/60">
            {voucher.bank_account || "DRC CHECK PREVIEW"}
            {voucher.ref_number ? ` — Check #${voucher.ref_number}` : ""}
          </div>
          <div className="absolute top-[8mm] left-[132mm] text-[7.5pt] font-bold">
            DATE:
          </div>
          <div className="absolute top-[14.5mm] left-[8mm] text-[6.5pt] font-bold leading-tight w-[17mm]">
            PAY TO THE
            <br />
            ORDER OF
          </div>
          <div className="absolute top-[20mm] left-[25mm] w-[118mm] border-b border-dashed border-slate-300" />
          <div className="absolute top-[16mm] left-[148mm] text-[9pt] font-bold">
            ₱
          </div>
          <div className="absolute top-[15mm] left-[152mm] w-[46mm] h-[6.5mm] border border-dashed border-slate-300" />
          <div className="absolute top-[24.5mm] left-[8mm] text-[6.5pt] font-bold">
            PESOS
          </div>
          <div className="absolute top-[29.5mm] left-[16mm] w-[180mm] border-b border-dashed border-slate-300" />
        </div>

        {/* Printable Check Elements (Exact Layouts_DRC.cs format without extra asterisks) */}
        <div
          className="absolute inset-0 select-none"
          style={{
            transform: `translate(${xOffset}mm, ${yOffset}mm)`,
          }}
        >
          {/* Date */}
          <div
            className={fieldCalibrationClass("check_leaf_date")}
            style={getFieldStyle("check_leaf_date")}
            onMouseDown={(e) => handleMouseDownField(e, "check_leaf_date")}
            title="Drag to adjust Check Date position"
          >
            {formattedDate}
          </div>

          {/* Payee Name */}
          <div
            className={`${fieldCalibrationClass("check_leaf_payee")} truncate`}
            style={getFieldStyle("check_leaf_payee")}
            onMouseDown={(e) => handleMouseDownField(e, "check_leaf_payee")}
            title="Drag to adjust Payee position"
          >
            {payee}
          </div>

          {/* Amount (Numerical) */}
          <div
            className={fieldCalibrationClass("check_leaf_amount")}
            style={getFieldStyle("check_leaf_amount")}
            onMouseDown={(e) => handleMouseDownField(e, "check_leaf_amount")}
            title="Drag to adjust Numerical Amount position"
          >
            {amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>

          {/* Amount in Words */}
          <div
            className={fieldCalibrationClass("check_leaf_words")}
            style={getFieldStyle("check_leaf_words")}
            onMouseDown={(e) => handleMouseDownField(e, "check_leaf_words")}
            title="Drag to adjust Amount in Words position"
          >
            {amountInWords}
          </div>
        </div>
      </div>
    </div>
  );
};
