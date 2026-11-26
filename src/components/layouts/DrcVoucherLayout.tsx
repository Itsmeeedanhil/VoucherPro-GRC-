import React, { useRef, useState } from "react";
import {
  ClientProfile,
  CurrencyChoice,
  DrcFieldKey,
  FieldOffset,
  FormType,
  VoucherData,
  VoucherLineItem,
} from "../../types/voucher";

interface Props {
  activeForm: FormType;
  data: VoucherData;
  client: ClientProfile;
  payeeOverride: string;
  currency: CurrencyChoice;
  showWireframeGuide: boolean;
  showCompanyHeader?: boolean;
  calibrationMode: boolean;
  selectedField: DrcFieldKey | null;
  onSelectField: (field: DrcFieldKey | null) => void;
  onUpdateFieldOffset: (field: DrcFieldKey, next: FieldOffset) => void;
}

export interface DrcFieldAnchor {
  key: DrcFieldKey;
  label: string;
  defaultFontPt: number;
}

export const DRC_FIELD_ANCHORS: Record<string, DrcFieldAnchor> = {
  company_logo: {
    key: "company_logo",
    label: "Company Logo (Top Center)",
    defaultFontPt: 10,
  },
  company_header: {
    key: "company_header",
    label: "Company Name Header",
    defaultFontPt: 16,
  },
  voucher_title: {
    key: "voucher_title",
    label: "Voucher Title (CHECK VOUCHER / JV / APV / RR)",
    defaultFontPt: 12,
  },
  series_number: {
    key: "series_number",
    label: "Series Number (CV / JV / APV / RR No.)",
    defaultFontPt: 9,
  },
  date: {
    key: "date",
    label: "Voucher Date",
    defaultFontPt: 9,
  },
  transact_date: {
    key: "transact_date",
    label: "Transaction Date (JV)",
    defaultFontPt: 10,
  },
  payee_name: {
    key: "payee_name",
    label: "Payee Name",
    defaultFontPt: 9,
  },
  tin: {
    key: "tin",
    label: "TIN",
    defaultFontPt: 9,
  },
  terms: {
    key: "terms",
    label: "Terms (APV) / Ref No (RR)",
    defaultFontPt: 9,
  },
  payee_address: {
    key: "payee_address",
    label: "Payee Address",
    defaultFontPt: 9,
  },
  amount_in_words: {
    key: "amount_in_words",
    label: "Amount in Words",
    defaultFontPt: 9,
  },
  particulars: {
    key: "particulars",
    label: "PARTICULARS (Remarks / Memo)",
    defaultFontPt: 9,
  },
  distribution_table: {
    key: "distribution_table",
    label: "Account Distribution Table",
    defaultFontPt: 9,
  },
  total_debit: {
    key: "total_debit",
    label: "Total Debit Amount",
    defaultFontPt: 8.5,
  },
  total_credit: {
    key: "total_credit",
    label: "Total Credit Amount",
    defaultFontPt: 8.5,
  },
  prepared_by: {
    key: "prepared_by",
    label: "Prepared By (Name & Position)",
    defaultFontPt: 10,
  },
  checked_by: {
    key: "checked_by",
    label: "Checked By (Name & Position)",
    defaultFontPt: 10,
  },
  approved_by: {
    key: "approved_by",
    label: "Approved By (Name & Position)",
    defaultFontPt: 10,
  },
  received_by: {
    key: "received_by",
    label: "Released By (Name & Position)",
    defaultFontPt: 10,
  },
  bank_name: {
    key: "bank_name",
    label: "Payment Details: Bank",
    defaultFontPt: 9,
  },
  check_no: {
    key: "check_no",
    label: "Payment Details: Check No.",
    defaultFontPt: 8.5,
  },
  check_date: {
    key: "check_date",
    label: "Payment Details: Check Date",
    defaultFontPt: 9,
  },
  top_amount: {
    key: "top_amount",
    label: "Payment Details: Amount",
    defaultFontPt: 9,
  },
};

const FULL_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Formats date as "MMMM dd, yyyy" (e.g. "November 26, 2026") matching Dashboard_DRC.cs
 */
export const formatDrcLongDate = (rawDate?: string | null): string => {
  if (!rawDate) return "";
  const trimmed = rawDate.trim();
  if (/^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      const y = parts[2];
      if (m >= 1 && m <= 12 && !isNaN(d)) {
        return `${FULL_MONTH_NAMES[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
      }
    }
  }
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (m >= 1 && m <= 12 && !isNaN(d)) {
        return `${FULL_MONTH_NAMES[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
      }
    }
  }
  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) {
    const m = FULL_MONTH_NAMES[dt.getMonth()];
    const d = String(dt.getDate()).padStart(2, "0");
    const y = dt.getFullYear();
    return `${m} ${d}, ${y}`;
  }
  return trimmed;
};

const formatNum = (val: number): string => {
  if (!val || Math.abs(val) < 0.001) return "";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatNumAlways = (val: number): string => {
  return (val || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const DrcVoucherLayout: React.FC<Props> = ({
  activeForm,
  data,
  client,
  payeeOverride,
  currency,
  showWireframeGuide,
  showCompanyHeader = true,
  calibrationMode,
  selectedField,
  onSelectField,
  onUpdateFieldOffset,
}) => {
  const cfg = client.layout_config;
  const globalXmm = cfg.preprinted_x_offset_mm ?? 0;
  const globalYmm = cfg.preprinted_y_offset_mm ?? 0;
  const fieldOffsets = cfg.field_offsets ?? {};

  const dragRef = useRef<{
    key: DrcFieldKey;
    startClientX: number;
    startClientY: number;
    initialXmm: number;
    initialYmm: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getFieldOffset = (key: DrcFieldKey): FieldOffset => {
    return fieldOffsets[key] ?? { x_mm: 0, y_mm: 0, font_size_pt: null };
  };

  const getOffsetStyle = (
    key: DrcFieldKey,
    baseXIn: number,
    baseYIn: number,
    widthIn: number,
    defaultFontPt: number,
    align: "left" | "center" | "right" = "left",
    fontWeight: "normal" | "bold" = "normal",
    heightIn?: number
  ): React.CSSProperties => {
    const fOff = getFieldOffset(key);
    const totalXmm = globalXmm + (fOff.x_mm || 0);
    const totalYmm = globalYmm + (fOff.y_mm || 0);
    const fontPt = fOff.font_size_pt ?? defaultFontPt;

    return {
      position: "absolute",
      left: `calc(${baseXIn}in + ${totalXmm}mm)`,
      top: `calc(${baseYIn}in + ${totalYmm}mm)`,
      width: `${widthIn}in`,
      ...(heightIn ? { height: `${heightIn}in` } : {}),
      fontSize: `${fontPt}pt`,
      fontWeight,
      textAlign: align,
      lineHeight: 1.2,
      color: "#000000",
      fontFamily: "Arial, Helvetica, sans-serif",
      zIndex: selectedField === key ? 30 : 20,
      userSelect: calibrationMode ? "none" : "auto",
      cursor: calibrationMode ? "move" : "default",
    };
  };

  const handleMouseDownField = (e: React.MouseEvent, key: DrcFieldKey) => {
    if (!calibrationMode) return;
    e.stopPropagation();
    onSelectField(key);
    const current = getFieldOffset(key);
    dragRef.current = {
      key,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialXmm: current.x_mm || 0,
      initialYmm: current.y_mm || 0,
    };
    setIsDragging(true);
  };

  const handleMouseMovePage = (e: React.MouseEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dxMm = ((e.clientX - dragRef.current.startClientX) * 25.4) / 96.0;
    const dyMm = ((e.clientY - dragRef.current.startClientY) * 25.4) / 96.0;
    const nextX = Math.round((dragRef.current.initialXmm + dxMm) * 2) / 2;
    const nextY = Math.round((dragRef.current.initialYmm + dyMm) * 2) / 2;
    const current = getFieldOffset(dragRef.current.key);
    onUpdateFieldOffset(dragRef.current.key, {
      ...current,
      x_mm: nextX,
      y_mm: nextY,
    });
  };

  const handleMouseUpPage = () => {
    if (isDragging) {
      setIsDragging(false);
      dragRef.current = null;
    }
  };

  const fieldCalibrationClass = (key: DrcFieldKey) => {
    if (!calibrationMode) return "data-field-node";
    const isSel = selectedField === key;
    return `data-field-node rounded-xs transition-shadow ${
      isSel
        ? "outline-2 outline-blue-600 bg-blue-500/15 shadow-xs"
        : "outline-1 outline-dashed outline-amber-500/80 hover:bg-amber-500/10"
    }`;
  };

  const currencyPrefix = currency === "Dollar ($)" ? "USD" : "PHP";
  const displayAmountInWords =
    currency === "Dollar ($)"
      ? (data.amount_in_words || "")
          .replace(/Pesos/g, "Dollars")
          .replace(/Centavos/g, "Cents")
      : data.amount_in_words || "";

  const displayPayee = payeeOverride.trim() || data.payee_name;
  const displayCompany =
    data.company_name || "DASMARINAS RENAL CARE CENTER INC.";
  const displayVoucherDate = formatDrcLongDate(data.date);
  const displayCheckOrTxnDate = formatDrcLongDate(data.due_date || data.date);

  // Separate distribution rows from the SUBREPORT_FOOTER line
  const allItems = data.line_items || [];
  let distributionLines: VoucherLineItem[] = [];
  let subreportFooterLine: VoucherLineItem | null = null;

  for (const li of allItems) {
    if (li.item_name === "SUBREPORT_FOOTER") {
      subreportFooterLine = li;
    } else {
      distributionLines.push(li);
    }
  }

  // Compute totals matching Dashboard_DRC.cs for each form type
  let totalDebit = 0;
  let totalCredit = 0;

  if (activeForm === "CV") {
    if (data.sub_type === "BILL_PAYMENT") {
      totalDebit = data.total_amount;
      totalCredit = data.total_amount;
    } else {
      let drSum = 0;
      let crSum = 0;
      for (const li of distributionLines) {
        drSum += li.debit || 0;
        crSum += li.credit || 0;
      }
      totalDebit = drSum > 0 ? drSum : data.total_amount;
      totalCredit = crSum + data.total_amount;
    }
  } else if (activeForm === "APV") {
    let drSum = 0;
    let crSum = 0;
    for (const li of distributionLines) {
      drSum += li.debit || 0;
      crSum += li.credit || 0;
    }
    totalDebit = drSum;
    totalCredit = crSum + data.total_amount;
  } else if (activeForm === "RR") {
    let drSum = 0;
    for (const li of distributionLines) {
      drSum += li.debit || 0;
    }
    totalDebit = drSum > 0 ? drSum : data.total_amount;
    totalCredit = totalDebit;
  } else if (activeForm === "JV") {
    for (const li of distributionLines) {
      totalDebit += li.debit || 0;
      totalCredit += li.credit || 0;
    }
  }

  // Signatories (Prepared By, Checked By, Approved By, Released By)
  const sig = data.signatories;
  const preparedByName = sig.prepared_by_name;
  const preparedByPos = sig.prepared_by_pos;
  const checkedByName = sig.checked_by_name || sig.reviewed_by_name;
  const checkedByPos = sig.checked_by_pos || sig.reviewed_by_pos;
  const approvedByName = sig.approved_by_name;
  const approvedByPos = sig.approved_by_pos;
  const receivedByName = sig.received_by_name;
  const receivedByPos = sig.received_by_pos;

  // Pagination: fit all rows on a single page up to 16 rows (matching Crystal Reports single-page vouchers)
  const MAX_ROWS_PER_PAGE = 16;
  const pageChunks: VoucherLineItem[][] = [];
  if (distributionLines.length <= MAX_ROWS_PER_PAGE) {
    pageChunks.push(distributionLines);
  } else {
    for (let i = 0; i < distributionLines.length; i += MAX_ROWS_PER_PAGE) {
      pageChunks.push(distributionLines.slice(i, i + MAX_ROWS_PER_PAGE));
    }
  }
  const totalPages = pageChunks.length;

  // =========================================================================
  // LAYOUT A: JOURNAL VOUCHER (CRJV_DRC.rpt)
  // =========================================================================
  if (activeForm === "JV") {
    const leftXIn = 0.333; // 360 margin + 120 offset = 480 twips = 0.333in
    const totalWidthIn = 7.781; // 11205 twips = 7.781in
    const col1WIn = 2.95; // Account
    const col2WIn = 2.331; // Memo (wider for long journal memos)
    const col3WIn = 1.25; // DEBIT (wide enough for PHP 12,851,726.79 on one line)
    const col4WIn = 1.25; // CREDIT

    const col2XIn = col1WIn;
    const col3XIn = col1WIn + col2WIn;
    const col4XIn = col1WIn + col2WIn + col3WIn;

    const tableHeaderTopIn = 2.32;
    const tableHeaderHIn = 0.335; // 483 twips
    const minBodyHIn = 1.2;

    const distOff = getFieldOffset("distribution_table");
    const distXmm = globalXmm + (distOff.x_mm || 0);
    const distYmm = globalYmm + (distOff.y_mm || 0);
    const distFontPt = distOff.font_size_pt ?? 9.5;

    return (
      <div className="voucher-pages-container flex flex-col items-center gap-8">
        {pageChunks.map((pageLines, pageIdx) => {
          const totalRowHIn = 0.28;
          const wordsRowHIn = 0.38;
          const totalBoxHIn = totalRowHIn + wordsRowHIn;
          const signBoxHIn = 0.812; // 1170 twips

          return (
            <div
              key={pageIdx}
              className="voucher-page relative bg-white text-black shadow-2xl mx-auto select-text"
              style={{
                width: "8.5in",
                minWidth: "8.5in",
                maxWidth: "8.5in",
                height: "11in",
                minHeight: "11in",
                maxHeight: "11in",
                position: "relative",
                overflow: "hidden",
                backgroundColor: "#ffffff",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
              onMouseMove={handleMouseMovePage}
              onMouseUp={handleMouseUpPage}
              onMouseLeave={handleMouseUpPage}
              onClick={() => {
                if (calibrationMode) onSelectField(null);
              }}
            >
              {/* Logo */}
              {showCompanyHeader && (
                <div
                  className={fieldCalibrationClass("company_logo")}
                  style={getOffsetStyle(
                    "company_logo",
                    3.583,
                    0.25,
                    1.271,
                    10,
                    "center"
                  )}
                  onMouseDown={(e) => handleMouseDownField(e, "company_logo")}
                >
                  <img
                    src="/logo-drc.png"
                    alt="DRC Logo"
                    style={{
                      width: "1.271in",
                      height: "0.895in",
                      objectFit: "contain",
                      margin: "0 auto",
                    }}
                  />
                </div>
              )}

              {/* Company Name */}
              {showCompanyHeader && (
                <div
                  className={fieldCalibrationClass("company_header")}
                  style={getOffsetStyle(
                    "company_header",
                    0.667,
                    1.167,
                    7.333,
                    14,
                    "center",
                    "bold"
                  )}
                  onMouseDown={(e) => handleMouseDownField(e, "company_header")}
                >
                  {displayCompany}
                </div>
              )}

              {/* Title: JOURNAL VOUCHER */}
              {showWireframeGuide && (
                <div
                  className={fieldCalibrationClass("voucher_title")}
                  style={getOffsetStyle(
                    "voucher_title",
                    3.083,
                    1.5,
                    2.0,
                    12,
                    "center",
                    "bold"
                  )}
                  onMouseDown={(e) => handleMouseDownField(e, "voucher_title")}
                >
                  JOURNAL VOUCHER
                </div>
              )}

              {/* Header labels & fields (Aligned on same horizontal baselines) */}
              {showWireframeGuide && (
                <div
                  style={{
                    position: "absolute",
                    left: "6.45in",
                    top: "1.75in",
                    height: "0.24in",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "11pt",
                    fontWeight: 700,
                  }}
                >
                  No.:
                </div>
              )}
              <div
                className={fieldCalibrationClass("series_number")}
                style={{
                  ...getOffsetStyle(
                    "series_number",
                    6.92,
                    1.75,
                    1.2,
                    11,
                    "left",
                    "bold",
                    0.24
                  ),
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseDown={(e) => handleMouseDownField(e, "series_number")}
              >
                {data.series_number}
              </div>

              {showWireframeGuide && (
                <div
                  style={{
                    position: "absolute",
                    left: "0.35in",
                    top: "2.02in",
                    height: "0.24in",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "10pt",
                  }}
                >
                  Transaction Date:
                </div>
              )}
              <div
                className={fieldCalibrationClass("transact_date")}
                style={{
                  ...getOffsetStyle(
                    "transact_date",
                    1.50,
                    2.02,
                    2.0,
                    10,
                    "left",
                    "normal",
                    0.24
                  ),
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseDown={(e) => handleMouseDownField(e, "transact_date")}
              >
                {displayCheckOrTxnDate}
              </div>

              <div
                className={fieldCalibrationClass("date")}
                style={{
                  ...getOffsetStyle(
                    "date",
                    6.45,
                    2.02,
                    1.65,
                    9.5,
                    "left",
                    "normal",
                    0.24
                  ),
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseDown={(e) => handleMouseDownField(e, "date")}
              >
                {displayVoucherDate}
              </div>

              {/* JV Table Header + Body + Totals + Signatories */}
              <div
                className={fieldCalibrationClass("distribution_table")}
                style={{
                  position: "absolute",
                  left: `calc(${leftXIn}in + ${distXmm}mm)`,
                  top: `calc(${tableHeaderTopIn}in + ${distYmm}mm)`,
                  width: `${totalWidthIn}in`,
                  fontSize: `${distFontPt}pt`,
                  zIndex: selectedField === "distribution_table" ? 30 : 20,
                  cursor: calibrationMode ? "move" : "default",
                }}
                onMouseDown={(e) =>
                  handleMouseDownField(e, "distribution_table")
                }
              >
                {/* Header Bar: Account | Memo | DEBIT | CREDIT */}
                <div
                  style={{
                    position: "relative",
                    width: `${totalWidthIn}in`,
                    height: `${tableHeaderHIn}in`,
                    border: showWireframeGuide
                      ? "1px solid #000000"
                      : "1px solid transparent",
                    fontWeight: 700,
                    fontSize: "10pt",
                  }}
                >
                  {showWireframeGuide && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${col1WIn}in`,
                          borderRight: "1px solid #000000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        Account
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: `${col2XIn}in`,
                          top: 0,
                          bottom: 0,
                          width: `${col2WIn}in`,
                          borderRight: "1px solid #000000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        Memo
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: `${col3XIn}in`,
                          top: 0,
                          bottom: 0,
                          width: `${col3WIn}in`,
                          borderRight: "1px solid #000000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        DEBIT
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: `${col4XIn}in`,
                          top: 0,
                          bottom: 0,
                          width: `${col4WIn}in`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        CREDIT
                      </div>
                    </>
                  )}
                </div>

                {/* Body Rows (Auto-wrapping Memo & Account so full text is always visible) */}
                <div
                  style={{
                    position: "relative",
                    width: `${totalWidthIn}in`,
                    minHeight: `${minBodyHIn}in`,
                    paddingTop: "0.04in",
                    paddingBottom: "0.08in",
                    borderLeft: showWireframeGuide
                      ? "1px solid #000000"
                      : "none",
                    borderRight: showWireframeGuide
                      ? "1px solid #000000"
                      : "none",
                  }}
                >
                  {showWireframeGuide && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: `${col2XIn}in`,
                          top: 0,
                          bottom: 0,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${col3XIn}in`,
                          top: 0,
                          bottom: 0,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${col4XIn}in`,
                          top: 0,
                          bottom: 0,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                    </>
                  )}

                  {pageLines.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        width: `${totalWidthIn}in`,
                        minHeight: "0.24in",
                        paddingTop: "0.03in",
                        paddingBottom: "0.03in",
                        lineHeight: 1.25,
                      }}
                    >
                      <div
                        style={{
                          width: `${col1WIn}in`,
                          paddingLeft: "0.08in",
                          paddingRight: "0.06in",
                          wordBreak: "break-word",
                          whiteSpace: "normal",
                        }}
                      >
                        {line.account_name}
                      </div>
                      <div
                        style={{
                          width: `${col2WIn}in`,
                          paddingLeft: "0.06in",
                          paddingRight: "0.06in",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          whiteSpace: "normal",
                        }}
                      >
                        {line.memo}
                      </div>
                      <div
                        style={{
                          width: `${col3WIn}in`,
                          paddingRight: "0.06in",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatNum(line.debit)}
                      </div>
                      <div
                        style={{
                          width: `${col4WIn}in`,
                          paddingRight: "0.06in",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatNum(line.credit)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section 4: Total & Amount in Words Box */}
                <div
                  style={{
                    position: "relative",
                    width: `${totalWidthIn}in`,
                    height: `${totalBoxHIn}in`,
                    border: showWireframeGuide
                      ? "1px solid #000000"
                      : "1px solid transparent",
                  }}
                >
                  {showWireframeGuide && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${totalRowHIn}in`,
                          borderBottom: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${col3XIn}in`,
                          top: 0,
                          height: `${totalRowHIn}in`,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${col4XIn}in`,
                          top: 0,
                          height: `${totalRowHIn}in`,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${col3XIn - 0.72}in`,
                          top: 0,
                          height: `${totalRowHIn}in`,
                          width: "0.68in",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "10pt",
                        }}
                      >
                        Total :
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "0.06in",
                          top: `${totalRowHIn}in`,
                          height: `${wordsRowHIn}in`,
                          width: "1.55in",
                          display: "flex",
                          alignItems: "center",
                          fontWeight: 700,
                          fontSize: "9.5pt",
                        }}
                      >
                        AMOUNT IN WORDS :
                      </div>
                    </>
                  )}

                  {/* Total Debit & Credit (Single Line, Vertically Centered) */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${col3XIn}in`,
                      top: 0,
                      height: `${totalRowHIn}in`,
                      width: `${col3WIn - 0.06}in`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      whiteSpace: "nowrap",
                      fontSize: "8.5pt",
                    }}
                  >
                    {`${currencyPrefix} ${formatNumAlways(totalDebit)}`}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: `${col4XIn}in`,
                      top: 0,
                      height: `${totalRowHIn}in`,
                      width: `${col4WIn - 0.06}in`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      whiteSpace: "nowrap",
                      fontSize: "8.5pt",
                    }}
                  >
                    {`${currencyPrefix} ${formatNumAlways(totalCredit)}`}
                  </div>

                  {/* Amount in Words (Vertically Centered inside its box) */}
                  <div
                    style={{
                      position: "absolute",
                      left: "1.62in",
                      top: `${totalRowHIn}in`,
                      height: `${wordsRowHIn}in`,
                      width: "6.08in",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "8.5pt",
                      lineHeight: 1.15,
                      overflow: "hidden",
                    }}
                  >
                    {displayAmountInWords}
                  </div>
                </div>

                {/* ReportFooterSection2: 3-Column Signatories (Prepared by | Checked by | Approved by) */}
                <div
                  style={{
                    position: "relative",
                    width: `${totalWidthIn}in`,
                    height: `${signBoxHIn}in`,
                    border: showWireframeGuide
                      ? "1px solid #000000"
                      : "1px solid transparent",
                    borderTop: "none",
                  }}
                >
                  {showWireframeGuide && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "0.336in",
                          borderBottom: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: "2.646in",
                          top: 0,
                          bottom: 0,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: "5.448in",
                          top: 0,
                          bottom: 0,
                          borderLeft: "1px solid #000000",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: "0.08in",
                          top: "0.05in",
                          fontWeight: 700,
                          fontSize: "10pt",
                        }}
                      >
                        Prepared by:
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "2.72in",
                          top: "0.05in",
                          fontWeight: 700,
                          fontSize: "10pt",
                        }}
                      >
                        Checked by :
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "5.52in",
                          top: "0.05in",
                          fontWeight: 700,
                          fontSize: "10pt",
                        }}
                      >
                        Approved by :
                      </div>
                    </>
                  )}

                  {/* Prepared By Name & Position */}
                  <div
                    style={{
                      position: "absolute",
                      left: "0.08in",
                      top: "0.41in",
                      width: "2.5in",
                      textAlign: "center",
                      fontSize: "10pt",
                    }}
                  >
                    <div>{preparedByName}</div>
                    <div style={{ fontSize: "9pt" }}>{preparedByPos}</div>
                  </div>

                  {/* Checked By Name & Position */}
                  <div
                    style={{
                      position: "absolute",
                      left: "2.70in",
                      top: "0.41in",
                      width: "2.70in",
                      textAlign: "center",
                      fontSize: "10pt",
                    }}
                  >
                    <div>{checkedByName}</div>
                    <div style={{ fontSize: "9pt" }}>{checkedByPos}</div>
                  </div>

                  {/* Approved By Name & Position */}
                  <div
                    style={{
                      position: "absolute",
                      left: "5.50in",
                      top: "0.41in",
                      width: "2.22in",
                      textAlign: "center",
                      fontSize: "10pt",
                    }}
                  >
                    <div>{approvedByName}</div>
                    <div style={{ fontSize: "9pt" }}>{approvedByPos}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // =========================================================================
  // LAYOUT B: CHECK VOUCHER (CV), ACCOUNTS PAYABLE VOUCHER (APV), RECEIVING REPORT (RR)
  // Exact dimensions from CRCV_DRC.rpt, CRCV_DRCBILL.rpt, CRAPV_DRCBILL.rpt, CRIR_DRC.rpt
  // =========================================================================
  const leftXIn = 0.385; // 360 margin + 195 offset = 555 twips = 0.3854in
  const totalWidthIn = 7.625; // 10980 twips = 7.625in
  const splitColXIn = 4.927; // 7290 - 195 = 7095 twips = 4.927in from box left

  // Subreport Table Column Widths (10980 twips = 7.625in):
  // Col 1 (Account Code / Item Code): 1860 twips = 1.292in
  // Col 2 (Account Title / Item Account): 6400 twips = 4.444in
  // Col 3 (DEBIT): 1410 twips = 0.979in
  // Col 4 (CREDIT): 1310 twips = 0.910in
  const col1WIn = 1.292;
  const col2WIn = 4.444;
  const col3WIn = 0.979;
  const col4WIn = 0.91;

  const col2XIn = col1WIn;
  const col3XIn = col1WIn + col2WIn;
  const col4XIn = col1WIn + col2WIn + col3WIn;

  const isDirectCheckCv =
    activeForm === "CV" && data.sub_type !== "BILL_PAYMENT";
  const isBillPayCv = activeForm === "CV" && data.sub_type === "BILL_PAYMENT";

  // Top Header Box geometry
  const topBoxTopIn = 2.0; // 360 + 2520 = 2880 twips = 2.00in
  const row1HIn = 0.27;
  const row2HIn = 0.25;
  const row3HIn = 0.27;
  const row4HIn = isDirectCheckCv ? 0.30 : 0; // AMOUNT IN WORDS row inside Box 1 for CRCV_DRC
  const topBoxHIn = row1HIn + row2HIn + row3HIn + row4HIn;

  // Subreport starts immediately below Top Header Box (no double border seam)
  const subreportTopIn = topBoxTopIn + topBoxHIn;

  const particularsBoxHIn = 0.75; // 1080 twips
  const particularsHeaderHIn = 0.229; // 330 twips
  const tableHeaderTopIn = subreportTopIn + particularsBoxHIn;
  const tableHeaderHIn = 0.336; // 484 twips
  const tableBodyTopIn = tableHeaderTopIn + tableHeaderHIn;

  const perRowHIn = 0.25;
  const subFooterRowHIn = 0.25;
  const minBodyHIn = 0.6;

  const voucherTitleText =
    activeForm === "CV"
      ? "CHECK VOUCHER"
      : activeForm === "APV"
      ? "ACCOUNTS PAYABLE VOUCHER"
      : "RECEIVING REPORT";

  const seriesLabelText =
    activeForm === "CV"
      ? "CV NO.             :"
      : activeForm === "APV"
      ? "APV NO.          :"
      : "VOUCHER NO. :";

  const secondRightLabelText =
    activeForm === "RR" ? "REF NO           :" : "TERMS             :";

  const secondRightValueText =
    activeForm === "RR" ? data.ref_number : data.terms || "";

  const col1HeaderText = activeForm === "RR" ? "Item Code" : "Account Code";
  const col2HeaderText = activeForm === "RR" ? "Item Account" : "Account Title";

  const showAmountInWordsInTotalBox = isBillPayCv || activeForm === "APV";
  const totalRowHIn = 0.32;
  const wordsFooterRowHIn = showAmountInWordsInTotalBox ? 0.34 : 0;
  const totalBoxHIn = totalRowHIn + wordsFooterRowHIn;

  const signCols = activeForm === "APV" ? 3 : 4;
  const signRowHIn = 1.0; // 1440 twips
  const signHeaderHIn = 0.219; // 315 twips
  const paymentDetailsHIn = activeForm === "CV" ? 0.917 : 0; // 1320 twips for CV Payment Details

  const distOff = getFieldOffset("distribution_table");
  const distXmm = globalXmm + (distOff.x_mm || 0);
  const distYmm = globalYmm + (distOff.y_mm || 0);
  const distFontPt = distOff.font_size_pt ?? 9;

  return (
    <div className="voucher-pages-container flex flex-col items-center gap-8">
      {pageChunks.map((pageLines, pageIdx) => {
        const isLastPage = pageIdx === totalPages - 1;
        const bodyHIn = Math.max(
          minBodyHIn,
          pageLines.length * perRowHIn + subFooterRowHIn + 0.12
        );

        return (
          <div
            key={pageIdx}
            className="voucher-page relative bg-white text-black shadow-2xl mx-auto select-text"
            style={{
              width: "8.5in",
              minWidth: "8.5in",
              maxWidth: "8.5in",
              height: "11in",
              minHeight: "11in",
              maxHeight: "11in",
              position: "relative",
              overflow: "hidden",
              backgroundColor: "#ffffff",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
            onMouseMove={handleMouseMovePage}
            onMouseUp={handleMouseUpPage}
            onMouseLeave={handleMouseUpPage}
            onClick={() => {
              if (calibrationMode) onSelectField(null);
            }}
          >
            {/* Multi-page indicator (screen only) */}
            {totalPages > 1 && (
              <div
                className="no-print"
                style={{
                  position: "absolute",
                  left: "6.40in",
                  top: "0.35in",
                  width: "1.60in",
                  textAlign: "right",
                  fontSize: "8.5pt",
                  color: "#000000",
                  zIndex: 25,
                }}
              >
                Page {pageIdx + 1} of {totalPages}
              </div>
            )}

            {/* 1. Top Center DRC Logo (Picture2 @ 4680..4800, 120, 1830x1289 twips) */}
            {showCompanyHeader && (
              <div
                className={fieldCalibrationClass("company_logo")}
                style={getOffsetStyle(
                  "company_logo",
                  3.583,
                  0.333,
                  1.271,
                  10,
                  "center"
                )}
                onMouseDown={(e) => handleMouseDownField(e, "company_logo")}
              >
                <img
                  src="/logo-drc.png"
                  alt="DRC Logo"
                  style={{
                    width: "1.271in",
                    height: "0.895in",
                    objectFit: "contain",
                    margin: "0 auto",
                  }}
                />
              </div>
            )}

            {/* 2. Company Name (TextCompanyName @ 240, 1440, 10920x330 twips, Arial 16 Bold) */}
            {showCompanyHeader && (
              <div
                className={fieldCalibrationClass("company_header")}
                style={getOffsetStyle(
                  "company_header",
                  0.417,
                  1.25,
                  7.583,
                  16,
                  "center",
                  "bold"
                )}
                onMouseDown={(e) => handleMouseDownField(e, "company_header")}
              >
                {displayCompany}
              </div>
            )}

            {/* 3. Voucher Title (CHECK VOUCHER / ACCOUNTS PAYABLE VOUCHER / RECEIVING REPORT @ y=1.583in, Arial 12 Bold) */}
            {showWireframeGuide && (
              <div
                className={fieldCalibrationClass("voucher_title")}
                style={getOffsetStyle(
                  "voucher_title",
                  2.833,
                  1.583,
                  2.8,
                  12,
                  "center",
                  "bold"
                )}
                onMouseDown={(e) => handleMouseDownField(e, "voucher_title")}
              >
                {voucherTitleText}
              </div>
            )}

            {/* 4. Top Header Box (Box1 @ left=0.385in, top=2.00in, width=7.625in) */}
            {showWireframeGuide && (
              <div
                className="pointer-events-none select-none"
                style={{
                  position: "absolute",
                  left: `${leftXIn}in`,
                  top: `${topBoxTopIn}in`,
                  width: `${totalWidthIn}in`,
                  height: `${topBoxHIn}in`,
                  border: "1px solid #000000",
                  zIndex: 5,
                }}
              >
                {/* Vertical Split at x=4.927in (from top down through Row 1..Row 3) */}
                <div
                  style={{
                    position: "absolute",
                    left: `${splitColXIn}in`,
                    top: 0,
                    height: `${row1HIn + row2HIn + row3HIn}in`,
                    borderLeft: "1px solid #000000",
                  }}
                />

                {/* Horizontal divider after Row 1 */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${row1HIn}in`,
                    borderBottom: "1px solid #000000",
                  }}
                />

                {/* Horizontal divider after Row 2 */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${row1HIn + row2HIn}in`,
                    borderBottom: "1px solid #000000",
                  }}
                />

                {/* Horizontal divider after Row 3 (if Direct Check CV has Row 4 AMOUNT IN WORDS) */}
                {isDirectCheckCv && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${row1HIn + row2HIn + row3HIn}in`,
                      borderBottom: "1px solid #000000",
                    }}
                  />
                )}

                {/* Row 1 Labels: PAYEE : | CV/APV/VOUCHER NO. : */}
                <div
                  style={{
                    position: "absolute",
                    left: "0.05in",
                    top: 0,
                    height: `${row1HIn}in`,
                    display: "flex",
                    alignItems: "center",
                    fontSize: "9pt",
                    fontWeight: 700,
                    whiteSpace: "pre",
                  }}
                >
                  {"PAYEE       :"}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: `${splitColXIn + 0.05}in`,
                    top: 0,
                    height: `${row1HIn}in`,
                    display: "flex",
                    alignItems: "center",
                    fontSize: "9pt",
                    fontWeight: 700,
                    whiteSpace: "pre",
                  }}
                >
                  {seriesLabelText}
                </div>

                {/* Row 2 Labels: TIN : | TERMS : / REF NO : */}
                <div
                  style={{
                    position: "absolute",
                    left: "0.05in",
                    top: `${row1HIn}in`,
                    height: `${row2HIn}in`,
                    display: "flex",
                    alignItems: "center",
                    fontSize: "9pt",
                    fontWeight: 700,
                    whiteSpace: "pre",
                  }}
                >
                  {"TIN             :"}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: `${splitColXIn + 0.05}in`,
                    top: `${row1HIn}in`,
                    height: `${row2HIn}in`,
                    display: "flex",
                    alignItems: "center",
                    fontSize: "9pt",
                    fontWeight: 700,
                    whiteSpace: "pre",
                  }}
                >
                  {secondRightLabelText}
                </div>

                {/* Row 3 Labels: ADDRESS : | DATE : */}
                <div
                  style={{
                    position: "absolute",
                    left: "0.05in",
                    top: `${row1HIn + row2HIn}in`,
                    height: `${row3HIn}in`,
                    display: "flex",
                    alignItems: "center",
                    fontSize: "9pt",
                    fontWeight: 700,
                    whiteSpace: "pre",
                  }}
                >
                  {"ADDRESS :"}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: `${splitColXIn + 0.05}in`,
                    top: `${row1HIn + row2HIn}in`,
                    height: `${row3HIn}in`,
                    display: "flex",
                    alignItems: "center",
                    fontSize: "9pt",
                    fontWeight: 700,
                    whiteSpace: "pre",
                  }}
                >
                  {"DATE                :"}
                </div>

                {/* Row 4 Label: AMOUNT IN WORDS : (for CRCV_DRC) */}
                {isDirectCheckCv && (
                  <div
                    style={{
                      position: "absolute",
                      left: "0.05in",
                      top: `${row1HIn + row2HIn + row3HIn}in`,
                      height: `${row4HIn}in`,
                      display: "flex",
                      alignItems: "center",
                      fontSize: "9pt",
                      fontWeight: 700,
                      whiteSpace: "pre",
                    }}
                  >
                    {"AMOUNT IN WORDS :"}
                  </div>
                )}
              </div>
            )}

            {/* Top Box Data Fields (Vertically Centered to match their labels) */}
            {/* Payee */}
            <div
              className={fieldCalibrationClass("payee_name")}
              style={{
                ...getOffsetStyle(
                  "payee_name",
                  1.18,
                  topBoxTopIn,
                  4.08,
                  9,
                  "left",
                  "normal",
                  row1HIn
                ),
                display: "flex",
                alignItems: "center",
              }}
              onMouseDown={(e) => handleMouseDownField(e, "payee_name")}
            >
              <span className="truncate">{displayPayee}</span>
            </div>

            {/* Series Number */}
            <div
              className={fieldCalibrationClass("series_number")}
              style={{
                ...getOffsetStyle(
                  "series_number",
                  6.333,
                  topBoxTopIn,
                  1.667,
                  9,
                  "center",
                  "normal",
                  row1HIn
                ),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseDown={(e) => handleMouseDownField(e, "series_number")}
            >
              {data.series_number}
            </div>

            {/* TIN */}
            <div
              className={fieldCalibrationClass("tin")}
              style={{
                ...getOffsetStyle(
                  "tin",
                  1.18,
                  topBoxTopIn + row1HIn,
                  4.08,
                  9,
                  "left",
                  "normal",
                  row2HIn
                ),
                display: "flex",
                alignItems: "center",
              }}
              onMouseDown={(e) => handleMouseDownField(e, "tin")}
            >
              {data.tin}
            </div>

            {/* Terms (APV) or RefNumber (RR) */}
            <div
              className={fieldCalibrationClass("terms")}
              style={{
                ...getOffsetStyle(
                  "terms",
                  6.333,
                  topBoxTopIn + row1HIn,
                  1.667,
                  9,
                  "center",
                  "normal",
                  row2HIn
                ),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseDown={(e) => handleMouseDownField(e, "terms")}
            >
              {secondRightValueText}
            </div>

            {/* Address */}
            <div
              className={fieldCalibrationClass("payee_address")}
              style={{
                ...getOffsetStyle(
                  "payee_address",
                  1.18,
                  topBoxTopIn + row1HIn + row2HIn,
                  4.1,
                  9,
                  "left",
                  "normal",
                  row3HIn
                ),
                display: "flex",
                alignItems: "center",
              }}
              onMouseDown={(e) => handleMouseDownField(e, "payee_address")}
            >
              <span className="truncate">
                {(data.payee_address || "").replace(/\r?\n/g, ", ")}
              </span>
            </div>

            {/* Date */}
            <div
              className={fieldCalibrationClass("date")}
              style={{
                ...getOffsetStyle(
                  "date",
                  6.333,
                  topBoxTopIn + row1HIn + row2HIn,
                  1.667,
                  9,
                  "center",
                  "normal",
                  row3HIn
                ),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseDown={(e) => handleMouseDownField(e, "date")}
            >
              {activeForm === "RR" ? displayCheckOrTxnDate : displayVoucherDate}
            </div>

            {/* Amount in Words inside Top Box (CRCV_DRC Direct Check CV) */}
            {isDirectCheckCv && (
              <div
                className={fieldCalibrationClass("amount_in_words")}
                style={{
                  ...getOffsetStyle(
                    "amount_in_words",
                    1.75,
                    topBoxTopIn + row1HIn + row2HIn + row3HIn,
                    6.2,
                    9,
                    "left",
                    "normal",
                    row4HIn
                  ),
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseDown={(e) => handleMouseDownField(e, "amount_in_words")}
              >
                <span className="truncate">{displayAmountInWords}</span>
              </div>
            )}

            {/* 5. PARTICULARS Box + Distribution Table + Totals + Signatories + Payment Details */}
            <div
              className={fieldCalibrationClass("distribution_table")}
              style={{
                position: "absolute",
                left: `calc(${leftXIn}in + ${distXmm}mm)`,
                top: `calc(${subreportTopIn}in + ${distYmm}mm)`,
                width: `${totalWidthIn}in`,
                fontSize: `${distFontPt}pt`,
                zIndex: selectedField === "distribution_table" ? 30 : 20,
                cursor: calibrationMode ? "move" : "default",
              }}
              onMouseDown={(e) =>
                handleMouseDownField(e, "distribution_table")
              }
            >
              {/* Subreport ReportHeaderSection1: PARTICULARS Box (1080 twips = 0.75in) */}
              <div
                style={{
                  position: "relative",
                  width: `${totalWidthIn}in`,
                  height: `${particularsBoxHIn}in`,
                  border: showWireframeGuide
                    ? "1px solid #000000"
                    : "1px solid transparent",
                  borderTop: "none",
                  borderBottom: "none",
                }}
              >
                {showWireframeGuide && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      height: `${particularsHeaderHIn}in`,
                      borderBottom: "1px solid #000000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9pt",
                      fontWeight: 700,
                    }}
                  >
                    PARTICULARS
                  </div>
                )}
                <div
                  className={fieldCalibrationClass("particulars")}
                  style={{
                    position: "absolute",
                    left: "0.08in",
                    right: "0.08in",
                    top: `${particularsHeaderHIn + 0.03}in`,
                    height: `${particularsBoxHIn - particularsHeaderHIn - 0.06}in`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: "9pt",
                    overflow: "hidden",
                  }}
                >
                  {data.memo}
                </div>
              </div>

              {/* Subreport ReportHeaderSection2: Account Code | Account Title | DEBIT | CREDIT */}
              <div
                style={{
                  position: "relative",
                  width: `${totalWidthIn}in`,
                  height: `${tableHeaderHIn}in`,
                  border: showWireframeGuide
                    ? "1px solid #000000"
                    : "1px solid transparent",
                  fontSize: "10pt",
                  fontWeight: 700,
                }}
              >
                {showWireframeGuide && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${col1WIn}in`,
                        borderRight: "1px solid #000000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {col1HeaderText}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col2XIn}in`,
                        top: 0,
                        bottom: 0,
                        width: `${col2WIn}in`,
                        borderRight: "1px solid #000000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {col2HeaderText}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col3XIn}in`,
                        top: 0,
                        bottom: 0,
                        width: `${col3WIn}in`,
                        borderRight: "1px solid #000000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      DEBIT
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col4XIn}in`,
                        top: 0,
                        bottom: 0,
                        width: `${col4WIn}in`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      CREDIT
                    </div>
                  </>
                )}
              </div>

              {/* Subreport DetailSection1 + ReportFooterSection1 (SubAccountCode | SubAccountPayable | SubAmountPayable) */}
              <div
                style={{
                  position: "relative",
                  width: `${totalWidthIn}in`,
                  height: `${bodyHIn}in`,
                  borderLeft: showWireframeGuide ? "1px solid #000000" : "none",
                  borderRight: showWireframeGuide
                    ? "1px solid #000000"
                    : "none",
                }}
              >
                {showWireframeGuide && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col2XIn}in`,
                        top: 0,
                        bottom: 0,
                        borderLeft: "1px solid #000000",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${col3XIn}in`,
                        top: 0,
                        bottom: 0,
                        borderLeft: "1px solid #000000",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${col4XIn}in`,
                        top: 0,
                        bottom: 0,
                        borderLeft: "1px solid #000000",
                      }}
                    />
                  </>
                )}

                {pageLines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${0.04 + idx * perRowHIn}in`,
                      height: `${perRowHIn}in`,
                      display: "flex",
                      alignItems: "center",
                      fontSize: `${distFontPt}pt`,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "0.03in",
                        width: `${col1WIn - 0.06}in`,
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.account_number}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col2XIn + 0.05}in`,
                        width: `${col2WIn - 0.1}in`,
                        textAlign: "left",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.account_name}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col3XIn}in`,
                        width: `${col3WIn - 0.05}in`,
                        textAlign: "right",
                      }}
                    >
                      {formatNum(line.debit)}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col4XIn}in`,
                        width: `${col4WIn - 0.05}in`,
                        textAlign: "right",
                      }}
                    >
                      {formatNum(line.credit)}
                    </div>
                  </div>
                ))}

                {/* Subreport Footer Credit Row (Bank Account or Accounts Payable) */}
                {isLastPage && subreportFooterLine && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${0.04 + pageLines.length * perRowHIn}in`,
                      height: `${subFooterRowHIn}in`,
                      display: "flex",
                      alignItems: "center",
                      fontSize: `${distFontPt}pt`,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "0.03in",
                        width: `${col1WIn - 0.06}in`,
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {subreportFooterLine.account_number}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col2XIn + 0.05}in`,
                        width: `${col2WIn - 0.1}in`,
                        textAlign: "left",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {subreportFooterLine.account_name}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col4XIn}in`,
                        width: `${col4WIn - 0.05}in`,
                        textAlign: "right",
                      }}
                    >
                      {formatNumAlways(subreportFooterLine.credit)}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: TOTAL Box (+ AMOUNT IN WORDS row for CRCV_DRCBILL and CRAPV_DRCBILL) */}
              <div
                style={{
                  position: "relative",
                  width: `${totalWidthIn}in`,
                  height: `${totalBoxHIn}in`,
                  border: showWireframeGuide
                    ? "1px solid #000000"
                    : "1px solid transparent",
                }}
              >
                {showWireframeGuide && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: `${col3XIn}in`,
                        top: 0,
                        height: `${totalRowHIn}in`,
                        borderLeft: "1px solid #000000",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${col4XIn}in`,
                        top: 0,
                        height: `${totalRowHIn}in`,
                        borderLeft: "1px solid #000000",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${col3XIn - 0.72}in`,
                        top: 0,
                        height: `${totalRowHIn}in`,
                        width: "0.68in",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10pt",
                        fontWeight: 700,
                      }}
                    >
                      TOTAL :
                    </div>
                    {showAmountInWordsInTotalBox && (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: `${totalRowHIn}in`,
                            borderBottom: "1px solid #000000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "0.05in",
                            top: `${totalRowHIn}in`,
                            height: `${wordsFooterRowHIn}in`,
                            display: "flex",
                            alignItems: "center",
                            fontSize: "9pt",
                            fontWeight: 700,
                          }}
                        >
                          AMOUNT IN WORDS :
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Total Debit */}
                <div
                  style={{
                    position: "absolute",
                    left: `${col3XIn}in`,
                    top: 0,
                    height: `${totalRowHIn}in`,
                    width: `${col3WIn - 0.05}in`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    fontSize: "8.5pt",
                  }}
                >
                  {`${currencyPrefix} ${formatNumAlways(totalDebit)}`}
                </div>

                {/* Total Credit */}
                <div
                  style={{
                    position: "absolute",
                    left: `${col4XIn}in`,
                    top: 0,
                    height: `${totalRowHIn}in`,
                    width: `${col4WIn - 0.05}in`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    fontSize: "8.5pt",
                  }}
                >
                  {`${currencyPrefix} ${formatNumAlways(totalCredit)}`}
                </div>

                {/* Amount in Words inside Section 4 (for Bill Payment CV and APV) */}
                {showAmountInWordsInTotalBox && (
                  <div
                    style={{
                      position: "absolute",
                      left: "1.45in",
                      top: `${totalRowHIn}in`,
                      height: `${wordsFooterRowHIn}in`,
                      width: "6.10in",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "9pt",
                    }}
                  >
                    <span className="truncate">{displayAmountInWords}</span>
                  </div>
                )}
              </div>

              {/* ReportFooterSection2: Signatories Box (+ PAYMENT DETAILS for Check Voucher) */}
              <div
                style={{
                  position: "relative",
                  width: `${totalWidthIn}in`,
                  height: `${signRowHIn + paymentDetailsHIn}in`,
                  border: showWireframeGuide
                    ? "1px solid #000000"
                    : "1px solid transparent",
                  borderTop: "none",
                }}
              >
                {/* Signatories Section (1.0in tall) */}
                <div
                  style={{
                    position: "relative",
                    width: `${totalWidthIn}in`,
                    height: `${signRowHIn}in`,
                  }}
                >
                  {showWireframeGuide && (
                    <>
                      {/* Horizontal line under Signatory labels (315 twips = 0.219in) */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${signHeaderHIn}in`,
                          borderBottom: "1px solid #000000",
                        }}
                      />
                      {signCols === 3 ? (
                        <>
                          {/* 3-Column Signatories for APV: 2.198in | 2.833in | 2.594in */}
                          <div
                            style={{
                              position: "absolute",
                              left: "2.198in",
                              top: 0,
                              bottom: 0,
                              borderLeft: "1px solid #000000",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: "5.031in",
                              top: 0,
                              bottom: 0,
                              borderLeft: "1px solid #000000",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: "0.04in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Prepared by:
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "2.24in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Checked by:
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "5.08in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Approved by:
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 4-Column Signatories for CV & RR: 1.837in | 1.844in | 1.865in | 2.079in */}
                          <div
                            style={{
                              position: "absolute",
                              left: "1.837in",
                              top: 0,
                              bottom: 0,
                              borderLeft: "1px solid #000000",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: "3.681in",
                              top: 0,
                              bottom: 0,
                              borderLeft: "1px solid #000000",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: "5.545in",
                              top: 0,
                              bottom: 0,
                              borderLeft: "1px solid #000000",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: "0.04in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Prepared by:
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "1.88in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Checked by:
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "3.72in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Approved by:
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "5.59in",
                              top: "0.02in",
                              fontSize: "9pt",
                            }}
                          >
                            Released by:
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Signatory Names & Positions */}
                  {signCols === 3 ? (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: "0.03in",
                          top: "0.56in",
                          width: "2.14in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{preparedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{preparedByPos}</div>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "2.22in",
                          top: "0.56in",
                          width: "2.78in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{checkedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{checkedByPos}</div>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "5.06in",
                          top: "0.56in",
                          width: "2.52in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{approvedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{approvedByPos}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: "0.03in",
                          top: "0.56in",
                          width: "1.78in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{preparedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{preparedByPos}</div>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "1.86in",
                          top: "0.56in",
                          width: "1.79in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{checkedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{checkedByPos}</div>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "3.70in",
                          top: "0.56in",
                          width: "1.81in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{approvedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{approvedByPos}</div>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: "5.57in",
                          top: "0.56in",
                          width: "2.02in",
                          textAlign: "center",
                          fontSize: "10pt",
                        }}
                      >
                        <div>{receivedByName}</div>
                        <div style={{ fontSize: "9pt" }}>{receivedByPos}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* PAYMENT DETAILS Table (Only for Check Voucher CV, matching CRCV_DRC & CRCV_DRCBILL) */}
                {activeForm === "CV" && (
                  <div
                    style={{
                      position: "relative",
                      width: `${totalWidthIn}in`,
                      height: `${paymentDetailsHIn}in`,
                      borderTop: showWireframeGuide
                        ? "1px solid #000000"
                        : "none",
                    }}
                  >
                    {showWireframeGuide && (
                      <>
                        {/* PAYMENT DETAILS Title Bar (0.302in tall) */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            height: "0.302in",
                            borderBottom: "1px solid #000000",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10pt",
                            fontWeight: 700,
                          }}
                        >
                          PAYMENT DETAILS
                        </div>

                        {/* Column Header Bar (0.198in tall, from 0.302in to 0.50in) */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "0.302in",
                            height: "0.198in",
                            borderBottom: "1px solid #000000",
                            fontSize: "9pt",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              width: "1.50in",
                              top: "0.02in",
                              textAlign: "center",
                            }}
                          >
                            BANK :
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "1.50in",
                              width: "0.865in",
                              top: "0.02in",
                              textAlign: "center",
                            }}
                          >
                            CHECK NO.
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "2.365in",
                              width: "1.312in",
                              top: "0.02in",
                              textAlign: "center",
                            }}
                          >
                            CHECK DATE
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "3.677in",
                              width: "1.135in",
                              top: "0.02in",
                              textAlign: "center",
                            }}
                          >
                            AMOUNT
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "4.812in",
                              width: "1.708in",
                              top: "0.02in",
                              textAlign: "center",
                            }}
                          >
                            RECEIVED BY
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              left: "6.521in",
                              width: "1.104in",
                              top: "0.02in",
                              textAlign: "center",
                            }}
                          >
                            Date Received
                          </div>
                        </div>

                        {/* Vertical dividers for Payment Details */}
                        <div
                          style={{
                            position: "absolute",
                            left: "1.50in",
                            top: "0.302in",
                            bottom: 0,
                            borderLeft: "1px solid #000000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "2.365in",
                            top: "0.302in",
                            bottom: 0,
                            borderLeft: "1px solid #000000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "3.677in",
                            top: "0.302in",
                            bottom: 0,
                            borderLeft: "1px solid #000000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "4.812in",
                            top: "0.302in",
                            bottom: 0,
                            borderLeft: "1px solid #000000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "6.521in",
                            top: "0.302in",
                            bottom: 0,
                            borderLeft: "1px solid #000000",
                          }}
                        />

                        {/* Signature Line & "Name & Signature" under RECEIVED BY */}
                        <div
                          style={{
                            position: "absolute",
                            left: "4.812in",
                            width: "1.708in",
                            top: "0.688in",
                            borderBottom: "1px solid #000000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "4.812in",
                            width: "1.708in",
                            top: "0.72in",
                            textAlign: "center",
                            fontSize: "8.5pt",
                          }}
                        >
                          Name &amp; Signature
                        </div>
                      </>
                    )}

                    {/* Payment Details Values */}
                    <div
                      style={{
                        position: "absolute",
                        left: "0.03in",
                        top: "0.55in",
                        width: "1.44in",
                        textAlign: "center",
                        fontSize: "9pt",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {data.bank_account}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: "1.52in",
                        top: "0.55in",
                        width: "0.82in",
                        textAlign: "center",
                        fontSize: "8.5pt",
                      }}
                    >
                      {data.ref_number}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: "2.38in",
                        top: "0.55in",
                        width: "1.28in",
                        textAlign: "center",
                        fontSize: "9pt",
                      }}
                    >
                      {displayCheckOrTxnDate}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: "3.70in",
                        top: "0.55in",
                        width: "1.09in",
                        textAlign: "center",
                        fontSize: "9pt",
                      }}
                    >
                      {formatNumAlways(data.total_amount)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
