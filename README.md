# VoucherPRO — GRC / DRC Edition (Tauri + React + QuickBooks Desktop)

A desktop accounting voucher and cheque printing system built with **Tauri v2**, **React 18**, **TypeScript**, **Tailwind CSS v4**, and **QuickBooks Desktop XML RequestProcessor (`QBXMLRP2`)**.

Recreated specifically for the **Golden Renal Care (GRC) / Dasmarinas Renal Care Center Inc. (DRC)** group of companies, VoucherPRO connects directly to QuickBooks Desktop to fetch live transactions, resolve Chart of Accounts codes and Item Asset/Expense accounts, and print clean, accurately aligned vouchers and bank cheques without requiring MS Access or Crystal Reports runtimes.

---

## Supported Forms (DRC)

1. **Check Voucher (`CV`)**
   - Supports both **Write Checks** (`CheckQueryRq` / `CRCV_DRC`) and **Bill Payment Checks** (`BillPaymentCheckQueryRq` + `BillQueryRq` / `CRCV_DRCBILL`).
   - Resolves Chart of Accounts numbers, maps Item lines to their Asset accounts, consolidates debit/credit distribution rows, and includes the 4-column signatories (`Prepared by:`, `Checked by:`, `Approved by:`, `Released by:`) and `PAYMENT DETAILS` footer (`BANK :`, `CHECK NO.`, `CHECK DATE`, `AMOUNT`, `RECEIVED BY`, `Date Received`).
2. **Check (`Check`)**
   - Philippine bank cheque layout (`8.0" x 3.0"`) with spaced `MM     DD     YYYY` date formatting, Payee override, numerical amount, amount in words, and interactive drag-to-align calibration.
3. **Journal Voucher (`JV`)**
   - Queries General Journal Entries (`JournalEntryQueryRq` / `CRJV_DRC`) with full auto-wrapping `Account` and `Memo` columns, `DEBIT` / `CREDIT` totals, `AMOUNT IN WORDS :`, and 3-column signatories.
4. **Accounts Payable Voucher (`APV`)**
   - Queries Direct Bills (`BillQueryRq` / `CRAPV_DRCBILL`) with `APV NO.`, `TERMS`, `TIN`, `ADDRESS`, `PARTICULARS`, `Account Code | Account Title | DEBIT | CREDIT` distribution, `TOTAL :`, `AMOUNT IN WORDS :`, and 3-column signatories.
5. **Receiving Report (`RR`)**
   - Queries Item Receipts (`ItemReceiptQueryRq` / `CRIR_DRC`) with `VOUCHER NO.`, `REF NO`, `Item Code | Item Account | DEBIT | CREDIT`, `TOTAL :`, and 4-column signatories.

---

## Supported GRC / DRC Companies

Each company maintains its own independent 5-digit series counter per form (`CV-00001`, `JV-00001`, `APV-00001`, `RR-00001`) in SQLite (`voucherpro_drc.db`), with auto-increment on print and manual `-/+` controls:

- **GRC- HSI  Hemocare Sytem Inc.**
- **GRC- St.Augustine Dialysis Inc.**
- **GRC- Dasmarinas Renal Care Center Inc.**
- **GRC - Kairos**
- **Nephro Plus Consultancy Inc.**
- **Golden Renal Care Trading Inc.**
- **Golden Renal Care Holdings Inc.**

---

## Key Features

- **Direct QuickBooks Desktop COM Integration (`QBXMLRP2`)**
  - Uses late-bound COM (`QBXMLRP2.RequestProcessor`) so no separate QBFC16 or MS Access Database Engine installer is required on client machines.
- **Full Form + Data / Data-Only Print Modes**
  - Toggle between printing the complete voucher form wireframe with data or printing data fields only, plus toggling the top DRC logo and company header.
- **Interactive Layout Field Calibration**
  - Click **Move / Adjust Layout Fields** in the top toolbar to drag any field or fine-tune its `X (mm)`, `Y (mm)`, and `Font (pt)` settings.
- **Clean Marginless Printing**
  - Automatically configures WebView2 print preferences to disable browser headers/footers (`localhost`, timestamp, page numbers) and print strictly the voucher layout.
- **Voucher Print History**
  - Automatically saves a snapshot of every printed voucher for viewing, filtering by company, or one-click reprinting with its original series number.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons |
| **Desktop Core** | Tauri v2 (Rust), `rusqlite` (bundled SQLite) |
| **QuickBooks Bridge** | C# (.NET Framework 4.0 x86) (`QBBridge.exe`) |

---

## Project Structure

```text
VoucherPro(GRC)/
├── public/
│   └── logo-drc.png                            # Extracted DRC company logo
├── src/
│   ├── components/
│   │   ├── layouts/
│   │   │   ├── CheckPrintLayout.tsx            # Bank cheque leaf layout & drag alignment
│   │   │   └── DrcVoucherLayout.tsx            # DRC Check Voucher, JV, APV, and RR layouts
│   │   ├── Sidebar.tsx                         # Form selector, series counter, company/currency selector, QB search
│   │   ├── SignatoriesModal.tsx                # Signatories configuration modal
│   │   ├── VoucherCanvas.tsx                   # Top layout calibration toolbar & preview canvas
│   │   └── VoucherHistoryModal.tsx             # Print history viewer & reprint modal
│   ├── types/
│   │   └── voucher.ts                          # TypeScript interfaces & DRC constants
│   ├── App.tsx                                 # Application state & Tauri command bindings
│   ├── index.css                               # Print stylesheet (@media print) & UI styles
│   └── main.tsx                                # React entry point
├── src-tauri/
│   ├── bin/
│   │   ├── QBBridge.cs                         # QuickBooks Desktop QBXML C# bridge source
│   │   └── QBBridge.exe                        # Compiled x86 QuickBooks COM bridge executable
│   ├── src/
│   │   ├── amount_to_words.rs                  # DRC Philippine Peso amount-to-words converter
│   │   ├── db.rs                               # SQLite database initialization & queries
│   │   ├── lib.rs                              # Tauri command handlers & WebView2 print setup
│   │   ├── main.rs                             # Rust binary entry point
│   │   ├── models.rs                           # Serde data models
│   │   └── quickbooks.rs                       # Process bridge to QBBridge.exe
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

---

## Getting Started

### 1. Install Frontend Dependencies
```powershell
npm install
```

### 2. Run in Development Mode
```powershell
npm run tauri dev
```

### 3. Build Production Installer (`.msi` / `.exe`)
```powershell
npm run tauri build
```

### 4. Recompiling the QuickBooks Bridge (`QBBridge.exe`)
If you modify `src-tauri/bin/QBBridge.cs`, recompile it targeting `x86` (required for 32-bit QuickBooks Desktop COM interop):
```powershell
& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /optimize /platform:x86 /out:"src-tauri\bin\QBBridge.exe" "src-tauri\bin\QBBridge.cs"
```
