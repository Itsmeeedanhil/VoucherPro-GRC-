import React from "react";
import {
  Search,
  Printer,
  Users,
  Hash,
  UserPen,
  Building2,
  FileSpreadsheet,
  History,
  Coins,
} from "lucide-react";
import {
  CurrencyChoice,
  FORM_LABELS,
  FormType,
} from "../types/voucher";

interface SidebarProps {
  activeForm: FormType;
  onSelectForm: (form: FormType) => void;
  companies: string[];
  selectedCompany: string;
  onSelectCompany: (company: string) => void;
  currency: CurrencyChoice;
  onSelectCurrency: (currency: CurrencyChoice) => void;
  seriesText: string;
  onSeriesTextChange: (val: string) => void;
  onAdjustSeries: (delta: number) => void;
  refNumber: string;
  onRefNumberChange: (val: string) => void;
  onSearchVoucher: () => void;
  isLoading: boolean;
  payeeOverride: string;
  onPayeeOverrideChange: (val: string) => void;
  onOpenSignatoriesModal: () => void;
  historyCount: number;
  onOpenHistoryModal: () => void;
  onPrint: () => void;
}

const DRC_FORMS: FormType[] = ["CV", "Check", "JV", "APV", "RR"];

export const Sidebar: React.FC<SidebarProps> = ({
  activeForm,
  onSelectForm,
  companies,
  selectedCompany,
  onSelectCompany,
  currency,
  onSelectCurrency,
  seriesText,
  onSeriesTextChange,
  onAdjustSeries,
  refNumber,
  onRefNumberChange,
  onSearchVoucher,
  isLoading,
  payeeOverride,
  onPayeeOverrideChange,
  onOpenSignatoriesModal,
  historyCount,
  onOpenHistoryModal,
  onPrint,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      onSearchVoucher();
    }
  };

  const isVoucherForm = activeForm !== "Check";
  const showCurrencySelector =
    activeForm === "CV" || activeForm === "APV" || activeForm === "RR";

  return (
    <aside className="no-print w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen text-slate-100 select-none shrink-0">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60">
        <h1 className="font-bold text-base tracking-wide text-white">
          VoucherPRO
        </h1>
        <p className="text-xs text-slate-400 truncate">{selectedCompany}</p>
      </div>

      {/* Sidebar Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scroller">
        {/* 1. SELECT FORM (Matches Dashboard_DRC comboBox_Forms) */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <label
            htmlFor="sidebar-form-select"
            className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
            Select Form:
          </label>
          <select
            id="sidebar-form-select"
            name="form_type"
            value={activeForm}
            onChange={(e) => onSelectForm(e.target.value as FormType)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            {DRC_FORMS.map((f) => (
              <option key={f} value={f}>
                {FORM_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        {/* 2. CURRENT SERIES NUMBER (Visible on CV, JV, APV, RR) */}
        {isVoucherForm && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="sidebar-series-input"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
              >
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                Current Series Number: {activeForm}
              </label>
            </div>
            <div className="flex gap-1.5">
              <input
                id="sidebar-series-input"
                name="series_number"
                type="text"
                value={seriesText}
                onChange={(e) => onSeriesTextChange(e.target.value)}
                placeholder={`${activeForm}-00001`}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => onAdjustSeries(-1)}
                className="w-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-bold text-slate-200 cursor-pointer"
                title="Decrement Series Number"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onAdjustSeries(1)}
                className="w-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-bold text-slate-200 cursor-pointer"
                title="Increment Series Number"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* 3. SELECT COMPANY & CURRENCY (Matches Dashboard_DRC Panel_SBCompany) */}
        {isVoucherForm && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="sidebar-company-select"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Select Company:
              </label>
              <select
                id="sidebar-company-select"
                name="company"
                value={selectedCompany}
                onChange={(e) => onSelectCompany(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {showCurrencySelector && (
              <div className="space-y-1.5">
                <label
                  htmlFor="sidebar-currency-select"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5 text-blue-400" />
                  Select Currency:
                </label>
                <select
                  id="sidebar-currency-select"
                  name="currency"
                  value={currency}
                  onChange={(e) =>
                    onSelectCurrency(e.target.value as CurrencyChoice)
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Peso (₱)">Peso (₱)</option>
                  <option value="Dollar ($)">Dollar ($)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* 4. PAYEE OVERRIDE (Shown on Check and Voucher forms) */}
        {activeForm !== "JV" && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <label
              htmlFor="sidebar-payee-override"
              className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
            >
              <UserPen className="w-3.5 h-3.5 text-blue-400" />
              Payee :
            </label>
            <input
              id="sidebar-payee-override"
              name="payee_override"
              type="text"
              value={payeeOverride}
              onChange={(e) => onPayeeOverrideChange(e.target.value)}
              placeholder="Optional Payee Override"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* 5. ENTER REFERENCE NUMBER */}
        <search>
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <label
              htmlFor="sidebar-ref-number"
              className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              Enter Reference Number:
            </label>
            <input
              id="sidebar-ref-number"
              name="ref_number"
              type="search"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={refNumber}
              onChange={(e) => onRefNumberChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeForm === "JV"
                  ? "Enter Journal Ref #"
                  : activeForm === "APV"
                  ? "Enter Bill Ref #"
                  : activeForm === "RR"
                  ? "Enter Item Receipt Ref #"
                  : "Enter Check Ref #"
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              type="button"
              onClick={onSearchVoucher}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              {isLoading ? "Searching QuickBooks..." : "Search"}
            </button>
          </div>
        </search>

        {/* 6. SIGNATORY & PRINT HISTORY */}
        <div className="grid grid-cols-2 gap-2">
          {isVoucherForm && (
            <button
              type="button"
              onClick={onOpenSignatoriesModal}
              className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2.5 px-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">Signatory</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenHistoryModal}
            className={`${
              isVoucherForm ? "" : "col-span-2"
            } flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2.5 px-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer`}
            title="View & reprint previously printed Vouchers"
          >
            <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                {historyCount}
              </span>
            )}
          </button>
        </div>

        {/* 7. PRINT */}
        <button
          type="button"
          onClick={onPrint}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print {FORM_LABELS[activeForm]}
        </button>
      </div>
    </aside>
  );
};
