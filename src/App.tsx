import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ClientProfile,
  CurrencyChoice,
  DRC_COMPANIES,
  DrcFieldKey,
  FieldOffset,
  FormType,
  LayoutConfig,
  SeriesConfig,
  SignatoriesConfig,
  VoucherData,
  VoucherHistoryEntry,
} from "./types/voucher";
import { Sidebar } from "./components/Sidebar";
import { VoucherCanvas } from "./components/VoucherCanvas";
import { SignatoriesModal } from "./components/SignatoriesModal";
import { VoucherHistoryModal } from "./components/VoucherHistoryModal";

const DEFAULT_CLIENT_PROFILE: ClientProfile = {
  id: "drc",
  code: "DRC",
  name: DRC_COMPANIES[0],
  address: "",
  contact_number: "",
  website: "",
  tin: "",
  sub_companies: DRC_COMPANIES,
  enabled_forms: ["CV", "Check", "JV", "APV", "RR"],
  logo_url: "/logo-drc.png",
  layout_config: {
    page_size: "Letter",
    margin_top_mm: 0,
    margin_bottom_mm: 0,
    margin_left_mm: 0,
    margin_right_mm: 0,
    header_font_size: 16,
    body_font_size: 9,
    table_font_size: 9,
    show_company_header: true,
    show_class_column: false,
    show_customer_job_column: false,
    show_tin: true,
    signatory_columns: 4,
    check_x_offset_mm: 0,
    check_y_offset_mm: 0,
    check_date_spacing: 3,
    check_rotate_90: false,
    custom_title: "CHECK VOUCHER",
    preprinted_x_offset_mm: 0,
    preprinted_y_offset_mm: 0,
    show_amount_in_words_receipt: true,
    show_distribution_totals: true,
    field_offsets: {},
  },
};

const formatDrcSeries = (form: FormType, num: number): string => {
  const prefix = form === "Check" ? "CV" : form;
  return `${prefix}-${String(Math.max(1, num)).padStart(5, "0")}`;
};

const parseDrcSeriesNumber = (text: string, form: FormType): number | null => {
  const prefix = form === "Check" ? "CV" : form;
  const cleaned = text
    .replace(new RegExp(`^${prefix}`, "i"), "")
    .replace(/-/g, "")
    .trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : Math.max(1, parsed);
};

export function App() {
  const [activeForm, setActiveForm] = useState<FormType>("CV");
  const [selectedClient, setSelectedClient] = useState<ClientProfile>(
    DEFAULT_CLIENT_PROFILE
  );
  const [selectedCompany, setSelectedCompany] = useState<string>(
    DRC_COMPANIES[0]
  );
  const [currency, setCurrency] = useState<CurrencyChoice>("Peso (₱)");
  const [seriesNumber, setSeriesNumber] = useState<number>(1);
  const [seriesText, setSeriesText] = useState<string>("CV-00001");
  const [refNumber, setRefNumber] = useState<string>("");
  const [signatories, setSignatories] = useState<SignatoriesConfig | null>(
    null
  );
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payeeOverride, setPayeeOverride] = useState<string>("");
  const [isSignatoriesOpen, setIsSignatoriesOpen] = useState<boolean>(false);

  // Print History State
  const [voucherHistory, setVoucherHistory] = useState<VoucherHistoryEntry[]>(
    []
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const isLoadedFromHistoryRef = useRef<boolean>(false);

  // Interactive Field Movement / Calibration & Full Form Template
  const [calibrationMode, setCalibrationMode] = useState<boolean>(false);
  const [showWireframeGuide, setShowWireframeGuide] = useState<boolean>(true);
  const [selectedField, setSelectedField] = useState<DrcFieldKey | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const hist = await invoke<VoucherHistoryEntry[]>("get_voucher_history", {
        companyName: null,
      });
      setVoucherHistory(hist || []);
    } catch (err) {
      console.warn("History fetch warning:", err);
    }
  }, []);

  // Load Client Profile, Signatories & History from SQLite
  useEffect(() => {
    async function init() {
      try {
        const list = await invoke<ClientProfile[]>("get_clients");
        if (list && list.length > 0) {
          const drc = list.find((c) => c.code === "DRC") || list[0];
          setSelectedClient({
            ...drc,
            sub_companies: DRC_COMPANIES,
          });
        }
      } catch (err) {
        console.warn("Running outside Tauri or DB init warning:", err);
      }

      try {
        const sig = await invoke<SignatoriesConfig>("get_signatories", {
          clientCode: "DRC",
        });
        setSignatories(sig);
      } catch (err) {
        console.warn("Signatories fetch fallback:", err);
      }

      loadHistory();
    }
    init();
  }, [loadHistory]);

  // Load per-company & per-form series number whenever company or activeForm changes
  useEffect(() => {
    if (activeForm === "Check") return;
    async function fetchSeries() {
      try {
        const ser = await invoke<SeriesConfig>("get_series", {
          clientCode: selectedCompany,
          formType: activeForm,
        });
        const num = ser?.current_number || 1;
        const formatted = formatDrcSeries(activeForm, num);
        setSeriesNumber(num);
        setSeriesText(formatted);
        setVoucherData((prev) => {
          if (!prev) return null;
          if (
            isLoadedFromHistoryRef.current &&
            prev.company_name === selectedCompany
          ) {
            return prev;
          }
          return {
            ...prev,
            company_name: selectedCompany,
            series_number: formatted,
          };
        });
      } catch (err) {
        const fallback = formatDrcSeries(activeForm, 1);
        setSeriesNumber(1);
        setSeriesText(fallback);
      }
    }
    fetchSeries();
  }, [selectedCompany, activeForm]);

  const persistSeries = useCallback(
    async (num: number, form: FormType, company: string) => {
      if (form === "Check") return;
      try {
        await invoke("update_series", {
          config: {
            client_code: company,
            form_type: form,
            current_number: num,
            prefix: `${form}-`,
            digit_count: 5,
          },
        });
      } catch (err) {
        console.warn("Failed to save series:", err);
      }
    },
    []
  );

  const handleSeriesTextChange = (val: string) => {
    setSeriesText(val);
    isLoadedFromHistoryRef.current = false;
    setVoucherData((prev) =>
      prev
        ? {
            ...prev,
            series_number: val,
          }
        : null
    );
    const parsed = parseDrcSeriesNumber(val, activeForm);
    if (parsed !== null) {
      setSeriesNumber(parsed);
      persistSeries(parsed, activeForm, selectedCompany);
    }
  };

  const handleAdjustSeries = (delta: number) => {
    const nextNum = Math.max(1, seriesNumber + delta);
    const formatted = formatDrcSeries(activeForm, nextNum);
    setSeriesNumber(nextNum);
    setSeriesText(formatted);
    isLoadedFromHistoryRef.current = false;
    setVoucherData((prev) =>
      prev
        ? {
            ...prev,
            series_number: formatted,
          }
        : null
    );
    persistSeries(nextNum, activeForm, selectedCompany);
  };

  const handleSelectForm = (form: FormType) => {
    setActiveForm(form);
    setSelectedField(null);
    setVoucherData(null);
    setErrorMsg(null);
    isLoadedFromHistoryRef.current = false;
  };

  const handleSelectCompany = (company: string) => {
    setSelectedCompany(company);
    isLoadedFromHistoryRef.current = false;
    setVoucherData((prev) =>
      prev
        ? {
            ...prev,
            company_name: company,
          }
        : null
    );
  };

  const fetchVoucher = useCallback(async () => {
    if (!refNumber.trim()) {
      setErrorMsg("Please enter a reference number.");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    isLoadedFromHistoryRef.current = false;
    try {
      const data = await invoke<VoucherData>("query_quickbooks_voucher", {
        formType: activeForm,
        clientCode: "DRC",
        companyName: selectedCompany,
        refNumber: refNumber.trim(),
      });
      setVoucherData({
        ...data,
        form_type: activeForm,
        company_name: selectedCompany,
        series_number: seriesText,
      });
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeForm, selectedCompany, refNumber, seriesText]);

  const handleSaveClientProfile = async (updated: ClientProfile) => {
    setSelectedClient(updated);
    try {
      await invoke("save_client_profile", { profile: updated });
    } catch (err: any) {
      setErrorMsg(String(err));
    }
  };

  const handleUpdateLayoutConfig = (next: LayoutConfig) => {
    handleSaveClientProfile({
      ...selectedClient,
      layout_config: next,
    });
  };

  const handleUpdateFieldOffset = (field: DrcFieldKey, next: FieldOffset) => {
    const cfg = selectedClient.layout_config;
    const updated: ClientProfile = {
      ...selectedClient,
      layout_config: {
        ...cfg,
        field_offsets: {
          ...(cfg.field_offsets ?? {}),
          [field]: next,
        },
      },
    };
    handleSaveClientProfile(updated);
  };

  const handleResetAllOffsets = () => {
    const cfg = selectedClient.layout_config;
    const updated: ClientProfile = {
      ...selectedClient,
      layout_config: {
        ...cfg,
        preprinted_x_offset_mm: 0,
        preprinted_y_offset_mm: 0,
        check_x_offset_mm: 0,
        check_y_offset_mm: 0,
        field_offsets: {},
      },
    };
    handleSaveClientProfile(updated);
  };

  const handleSaveSignatories = async (sig: SignatoriesConfig) => {
    setSignatories(sig);
    await invoke("save_signatories", { config: sig });
    if (voucherData) {
      setVoucherData({
        ...voucherData,
        signatories: sig,
      });
    }
  };

  const handleLoadHistoryEntry = (entry: VoucherHistoryEntry) => {
    isLoadedFromHistoryRef.current = true;
    const entryForm = (entry.voucher_data.form_type as FormType) || "CV";
    setActiveForm(entryForm);
    setSelectedCompany(entry.company_name);
    setRefNumber(entry.ref_number);
    setSeriesText(entry.cv_number);
    setPayeeOverride("");
    setVoucherData({
      ...entry.voucher_data,
      company_name: entry.company_name,
      series_number: entry.cv_number,
      payee_name: entry.payee_name,
    });
    setIsHistoryOpen(false);
  };

  const handleReprintHistoryEntry = (entry: VoucherHistoryEntry) => {
    handleLoadHistoryEntry(entry);
    setTimeout(() => {
      document.title = " ";
      const scroller = document.querySelector(".print-area");
      if (scroller) {
        scroller.scrollTop = 0;
        scroller.scrollLeft = 0;
      }
      window.scrollTo(0, 0);
      window.print();
    }, 150);
  };

  const handleDeleteHistoryEntry = async (id: number) => {
    try {
      await invoke("delete_voucher_history", { id });
      setVoucherHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setErrorMsg(String(err));
    }
  };

  const handlePrint = async () => {
    document.title = " ";
    const scroller = document.querySelector(".print-area");
    if (scroller) {
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    }
    window.scrollTo(0, 0);

    window.print();

    if (voucherData && activeForm !== "Check") {
      const effectivePayee = payeeOverride.trim() || voucherData.payee_name;
      const snapshotToSave: VoucherData = {
        ...voucherData,
        form_type: activeForm,
        company_name: selectedCompany,
        series_number: seriesText,
        payee_name: effectivePayee,
      };

      try {
        await invoke("save_voucher_history", {
          companyName: selectedCompany,
          cvNumber: seriesText,
          refNumber: voucherData.ref_number,
          payeeName: effectivePayee,
          voucherDate: voucherData.date,
          totalAmount: voucherData.total_amount,
          voucherData: snapshotToSave,
        });
        loadHistory();
      } catch (err) {
        console.error("Failed to save voucher print history:", err);
      }

      // Auto-increment series number on print (matching Dashboard_DRC ReportViewer Print click)
      if (!isLoadedFromHistoryRef.current) {
        const nextNum = seriesNumber + 1;
        const formatted = formatDrcSeries(activeForm, nextNum);
        setSeriesNumber(nextNum);
        setSeriesText(formatted);
        await persistSeries(nextNum, activeForm, selectedCompany);
        setVoucherData((prev) =>
          prev
            ? {
                ...prev,
                series_number: formatted,
              }
            : null
        );
      }
    }
  };

  return (
    <div
      className={`app-shell flex h-screen w-screen overflow-hidden bg-slate-950 ${
        activeForm === "Check" ? "mode-check" : "mode-cv"
      }`}
    >
      <Sidebar
        activeForm={activeForm}
        onSelectForm={handleSelectForm}
        companies={DRC_COMPANIES}
        selectedCompany={selectedCompany}
        onSelectCompany={handleSelectCompany}
        currency={currency}
        onSelectCurrency={setCurrency}
        seriesText={seriesText}
        onSeriesTextChange={handleSeriesTextChange}
        onAdjustSeries={handleAdjustSeries}
        refNumber={refNumber}
        onRefNumberChange={setRefNumber}
        onSearchVoucher={fetchVoucher}
        isLoading={isLoading}
        payeeOverride={payeeOverride}
        onPayeeOverrideChange={setPayeeOverride}
        onOpenSignatoriesModal={() => setIsSignatoriesOpen(true)}
        historyCount={voucherHistory.length}
        onOpenHistoryModal={() => setIsHistoryOpen(true)}
        onPrint={handlePrint}
      />

      <VoucherCanvas
        activeForm={activeForm}
        voucherData={voucherData}
        client={selectedClient}
        onUpdateLayoutConfig={handleUpdateLayoutConfig}
        payeeOverride={payeeOverride}
        currency={currency}
        errorMsg={errorMsg}
        showWireframeGuide={showWireframeGuide}
        onToggleWireframeGuide={setShowWireframeGuide}
        calibrationMode={calibrationMode}
        onToggleCalibrationMode={setCalibrationMode}
        selectedField={selectedField}
        onSelectField={setSelectedField}
        onUpdateFieldOffset={handleUpdateFieldOffset}
        onResetAllOffsets={handleResetAllOffsets}
      />

      {signatories && (
        <SignatoriesModal
          isOpen={isSignatoriesOpen}
          onClose={() => setIsSignatoriesOpen(false)}
          client={selectedClient}
          signatories={signatories}
          onSaveSignatories={handleSaveSignatories}
        />
      )}

      <VoucherHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        entries={voucherHistory}
        companies={DRC_COMPANIES}
        selectedCompany={selectedCompany}
        onLoadEntry={handleLoadHistoryEntry}
        onReprintEntry={handleReprintHistoryEntry}
        onDeleteEntry={handleDeleteHistoryEntry}
      />
    </div>
  );
}

export default App;
