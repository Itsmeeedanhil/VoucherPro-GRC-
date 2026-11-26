using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Xml;

[assembly: AssemblyTitle("VoucherPRO QuickBooks Bridge (DRC)")]
[assembly: AssemblyDescription("QuickBooks Desktop Connector for VoucherPRO DRC")]
[assembly: AssemblyCompany("VoucherPRO")]
[assembly: AssemblyProduct("VoucherPRO")]
[assembly: AssemblyCopyright("Copyright (c) 2026 VoucherPRO")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]
[assembly: ComVisible(false)]

namespace QBBridge
{
    public class LineItemDto
    {
        public string account_number = "";
        public string account_name = "";
        public string class_name = "";
        public string customer_job = "";
        public string memo = "";
        public double debit = 0.0;
        public double credit = 0.0;
        public double quantity = 0.0;
        public double unit_cost = 0.0;
        public string item_name = "";
    }

    public class BillCreditDto
    {
        public string credit_ref_number = "";
        public double applied_amount = 0.0;
        public string account_name = "";
        public string class_name = "";
        public string memo = "";
    }

    public class BridgeResponse
    {
        public bool success = false;
        public string error = "";
        public string ref_number = "";
        public string date = "";
        public string due_date = "";
        public string payee_name = "";
        public string payee_address = "";
        public string bank_account = "";
        public string ap_account = "";
        public string tin = "";
        public string terms = "";
        public string sub_type = ""; // "DIRECT_CHECK", "BILL_PAYMENT", "JOURNAL", "BILL", "ITEM_RECEIPT"
        public string payee_zip = "";
        public string payor_name = "";
        public string payor_address = "";
        public string payor_tin = "";
        public string payor_zip = "";
        public string po_number = "";
        public string memo = "";
        public double total_amount = 0.0;
        public List<LineItemDto> line_items = new List<LineItemDto>();
        public List<BillCreditDto> bill_credits = new List<BillCreditDto>();
    }

    public class ItemAccountInfo
    {
        public string AccountFullName = "";
        public string AccountLeafName = "";
        public string AccountNumber = "";
    }

    /// <summary>
    /// Connects directly to QuickBooks Desktop's built-in QBXMLRP2.RequestProcessor COM server
    /// via late-binding so no separate QBFC16 installer is required on client machines.
    /// </summary>
    public class QbXmlSession : IDisposable
    {
        private object _rp = null;
        private Type _rpType = null;
        private string _ticket = null;
        private bool _connOpen = false;

        public void Open(string appName)
        {
            string[] progIds = new string[]
            {
                "QBXMLRP2.RequestProcessor.2",
                "QBXMLRP2.RequestProcessor.1",
                "QBXMLRP2.RequestProcessor"
            };

            foreach (string progId in progIds)
            {
                _rpType = Type.GetTypeFromProgID(progId, false);
                if (_rpType != null)
                {
                    try
                    {
                        _rp = Activator.CreateInstance(_rpType);
                        if (_rp != null) break;
                    }
                    catch { _rp = null; }
                }
            }

            if (_rp == null)
            {
                throw new Exception("QuickBooks Desktop RequestProcessor (QBXMLRP2) is not registered on this PC. Make sure QuickBooks Desktop is installed.");
            }

            // localQBD = 1
            _rpType.InvokeMember(
                "OpenConnection2",
                BindingFlags.InvokeMethod,
                null,
                _rp,
                new object[] { "", appName, 1 }
            );
            _connOpen = true;

            // qbFileOpenDoNotCare = 2
            object ticketObj = _rpType.InvokeMember(
                "BeginSession",
                BindingFlags.InvokeMethod,
                null,
                _rp,
                new object[] { "", 2 }
            );
            _ticket = ticketObj != null ? ticketObj.ToString() : "";
        }

        public XmlDocument ProcessRequest(string innerRequestsXml)
        {
            string fullXml =
                "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
                "<?qbxml version=\"13.0\"?>" +
                "<QBXML><QBXMLMsgsRq onError=\"continueOnError\">" +
                innerRequestsXml +
                "</QBXMLMsgsRq></QBXML>";

            object respObj = _rpType.InvokeMember(
                "ProcessRequest",
                BindingFlags.InvokeMethod,
                null,
                _rp,
                new object[] { _ticket, fullXml }
            );

            string respXml = respObj != null ? respObj.ToString() : "";
            XmlDocument doc = new XmlDocument();
            if (!string.IsNullOrEmpty(respXml))
            {
                doc.LoadXml(respXml);
            }
            return doc;
        }

        public void Dispose()
        {
            try
            {
                if (_rp != null && _rpType != null)
                {
                    if (!string.IsNullOrEmpty(_ticket))
                    {
                        _rpType.InvokeMember("EndSession", BindingFlags.InvokeMethod, null, _rp, new object[] { _ticket });
                        _ticket = null;
                    }
                    if (_connOpen)
                    {
                        _rpType.InvokeMember("CloseConnection", BindingFlags.InvokeMethod, null, _rp, new object[] { });
                        _connOpen = false;
                    }
                }
            }
            catch { }
        }
    }

    class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            if (args.Length < 2)
            {
                PrintJson(new BridgeResponse { success = false, error = "Usage: QBBridge.exe <FormType> <RefNumber>" });
                return 1;
            }

            string formType = args[0].Trim().ToUpperInvariant();
            string refNumber = args[1].Trim();

            try
            {
                using (QbXmlSession session = new QbXmlSession())
                {
                    session.Open("VoucherPro Check Data");

                    Dictionary<string, string> acctNumById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    Dictionary<string, string> acctNumByName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    string detectedApName = "";
                    string detectedApCode = "";

                    BridgeResponse resp;
                    if (formType == "CHECK")
                    {
                        resp = QueryCheckLeafDRC(session, refNumber);
                    }
                    else if (formType == "JV")
                    {
                        resp = QueryJournalVoucherDRC(session, refNumber, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);
                    }
                    else if (formType == "APV")
                    {
                        resp = QueryDirectBillAPV_DRC(session, refNumber, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);
                    }
                    else if (formType == "RR")
                    {
                        resp = QueryItemReceiptRR_DRC(session, refNumber, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);
                    }
                    else
                    {
                        // Default CV: Check Voucher (Write Checks first, then Bill Payment Check fallback)
                        resp = QueryCheckVoucherDRC(session, refNumber, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);
                    }

                    PrintJson(resp);
                    return resp.success ? 0 : 2;
                }
            }
            catch (TargetInvocationException tex)
            {
                string msg = tex.InnerException != null ? tex.InnerException.Message : tex.Message;
                PrintJson(new BridgeResponse
                {
                    success = false,
                    error = "QuickBooks SDK Error: " + msg
                });
                return 1;
            }
            catch (Exception ex)
            {
                PrintJson(new BridgeResponse
                {
                    success = false,
                    error = "QuickBooks SDK Error: " + ex.Message
                });
                return 1;
            }
        }

        static string GetNodeText(XmlNode parent, string xpath)
        {
            if (parent == null) return "";
            XmlNode n = parent.SelectSingleNode(xpath);
            return n != null && n.InnerText != null ? n.InnerText.Trim() : "";
        }

        static double GetNodeDouble(XmlNode parent, string xpath)
        {
            string s = GetNodeText(parent, xpath);
            if (string.IsNullOrEmpty(s)) return 0.0;
            double v;
            if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out v))
                return v;
            return 0.0;
        }

        static string FormatQbDate(string rawDate)
        {
            if (string.IsNullOrEmpty(rawDate)) return "";
            DateTime dt;
            if (DateTime.TryParse(rawDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt))
            {
                return dt.ToString("MM/dd/yyyy");
            }
            return rawDate;
        }

        static string EscapeXml(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("&", "&amp;")
                    .Replace("<", "&lt;")
                    .Replace(">", "&gt;")
                    .Replace("\"", "&quot;")
                    .Replace("'", "&apos;");
        }

        static string GetLeafAccountName(string fullName)
        {
            if (string.IsNullOrEmpty(fullName)) return "";
            int idx = fullName.LastIndexOf(':');
            return idx >= 0 ? fullName.Substring(idx + 1).Trim() : fullName.Trim();
        }

        static string LookupAccountNumber(
            string listId,
            string fullName,
            Dictionary<string, string> acctNumById,
            Dictionary<string, string> acctNumByName)
        {
            if (!string.IsNullOrEmpty(listId) && acctNumById.ContainsKey(listId))
                return acctNumById[listId];
            if (!string.IsNullOrEmpty(fullName))
            {
                if (acctNumByName.ContainsKey(fullName))
                    return acctNumByName[fullName];
                string leaf = GetLeafAccountName(fullName);
                if (acctNumByName.ContainsKey(leaf))
                    return acctNumByName[leaf];
            }
            return "";
        }

        static void LoadChartOfAccounts(
            QbXmlSession session,
            Dictionary<string, string> byId,
            Dictionary<string, string> byName,
            ref string detectedApName,
            ref string detectedApCode)
        {
            if (byId.Count > 0 || byName.Count > 0) return;
            try
            {
                XmlDocument doc = session.ProcessRequest(
                    "<AccountQueryRq>" +
                    "<ActiveStatus>All</ActiveStatus>" +
                    "<IncludeRetElement>ListID</IncludeRetElement>" +
                    "<IncludeRetElement>Name</IncludeRetElement>" +
                    "<IncludeRetElement>FullName</IncludeRetElement>" +
                    "<IncludeRetElement>AccountNumber</IncludeRetElement>" +
                    "<IncludeRetElement>AccountType</IncludeRetElement>" +
                    "</AccountQueryRq>"
                );
                XmlNodeList list = doc.SelectNodes("//AccountRet");
                if (list == null) return;

                foreach (XmlNode a in list)
                {
                    string num = GetNodeText(a, "AccountNumber");
                    string id = GetNodeText(a, "ListID");
                    string name = GetNodeText(a, "Name");
                    string fullName = GetNodeText(a, "FullName");
                    string accType = GetNodeText(a, "AccountType");
                    string leaf = GetLeafAccountName(fullName);

                    if (!string.IsNullOrEmpty(num))
                    {
                        if (!string.IsNullOrEmpty(id) && !byId.ContainsKey(id))
                            byId[id] = num;
                        if (!string.IsNullOrEmpty(fullName) && !byName.ContainsKey(fullName))
                            byName[fullName] = num;
                        if (!string.IsNullOrEmpty(name) && !byName.ContainsKey(name))
                            byName[name] = num;
                        if (!string.IsNullOrEmpty(leaf) && !byName.ContainsKey(leaf))
                            byName[leaf] = num;
                    }

                    // Dynamically detect Accounts Payable (priority to CAPEX, matching AccessQueries_DRC.GetAccountNumbersFromQB2)
                    if (string.Equals(accType, "AccountsPayable", StringComparison.OrdinalIgnoreCase) ||
                        fullName.IndexOf("Payable", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        if (fullName.IndexOf("CAPEX", StringComparison.OrdinalIgnoreCase) >= 0 || string.IsNullOrEmpty(detectedApName))
                        {
                            detectedApName = fullName;
                            detectedApCode = num;
                        }
                    }
                }
            }
            catch { }
        }

        static Dictionary<string, ItemAccountInfo> LoadItemsAccountMap(
            QbXmlSession session,
            Dictionary<string, string> acctNumById,
            Dictionary<string, string> acctNumByName,
            bool onlyAssetAccounts)
        {
            var itemAcctMap = new Dictionary<string, ItemAccountInfo>(StringComparer.OrdinalIgnoreCase);
            try
            {
                XmlDocument doc = session.ProcessRequest(
                    "<ItemQueryRq>" +
                    "<ActiveStatus>All</ActiveStatus>" +
                    "</ItemQueryRq>"
                );
                XmlNode respNode = doc.SelectSingleNode("//ItemQueryRs");
                if (respNode == null) return itemAcctMap;

                foreach (XmlNode it in respNode.ChildNodes)
                {
                    if (!it.Name.EndsWith("Ret")) continue;

                    string itemId = GetNodeText(it, "ListID");
                    string itemFullName = GetNodeText(it, "FullName");
                    string acctId = "";
                    string acctFullName = "";

                    XmlNode assetRef = it.SelectSingleNode("AssetAccountRef");
                    XmlNode cogsRef = it.SelectSingleNode("COGSAccountRef");
                    XmlNode sapExpRef = it.SelectSingleNode("SalesAndPurchase/ExpenseAccountRef");
                    XmlNode spAcctRef = it.SelectSingleNode("SalesOrPurchase/AccountRef");

                    XmlNode chosen = null;
                    if (onlyAssetAccounts)
                    {
                        chosen = assetRef;
                    }
                    else
                    {
                        chosen = assetRef ?? cogsRef ?? sapExpRef ?? spAcctRef;
                    }

                    if (chosen != null)
                    {
                        acctId = GetNodeText(chosen, "ListID");
                        acctFullName = GetNodeText(chosen, "FullName");
                    }

                    if (!string.IsNullOrEmpty(acctFullName))
                    {
                        var info = new ItemAccountInfo
                        {
                            AccountFullName = acctFullName,
                            AccountLeafName = GetLeafAccountName(acctFullName),
                            AccountNumber = LookupAccountNumber(acctId, acctFullName, acctNumById, acctNumByName)
                        };
                        if (!string.IsNullOrEmpty(itemId) && !itemAcctMap.ContainsKey(itemId))
                            itemAcctMap[itemId] = info;
                        if (!string.IsNullOrEmpty(itemFullName) && !itemAcctMap.ContainsKey(itemFullName))
                            itemAcctMap[itemFullName] = info;
                        string itemLeaf = GetLeafAccountName(itemFullName);
                        if (!string.IsNullOrEmpty(itemLeaf) && !itemAcctMap.ContainsKey(itemLeaf))
                            itemAcctMap[itemLeaf] = info;
                    }
                }
            }
            catch { }
            return itemAcctMap;
        }

        static string FormatDrcAddressBlock(XmlNode addrNode)
        {
            if (addrNode == null) return "";
            string a1 = GetNodeText(addrNode, "Addr1");
            string a2 = GetNodeText(addrNode, "Addr2");
            string a3 = GetNodeText(addrNode, "Addr3");
            string a4 = GetNodeText(addrNode, "Addr4");
            string city = GetNodeText(addrNode, "City");

            List<string> streetParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(a1)) streetParts.Add(a1.Trim());
            if (!string.IsNullOrWhiteSpace(a2)) streetParts.Add(a2.Trim());
            if (!string.IsNullOrWhiteSpace(a3)) streetParts.Add(a3.Trim());
            if (!string.IsNullOrWhiteSpace(a4)) streetParts.Add(a4.Trim());

            string streetLine = string.Join(", ", streetParts.ToArray());
            string cityLine = !string.IsNullOrWhiteSpace(city) ? city.Trim() : "";

            List<string> fullLines = new List<string>();
            if (!string.IsNullOrWhiteSpace(streetLine)) fullLines.Add(streetLine);
            if (!string.IsNullOrWhiteSpace(cityLine)) fullLines.Add(cityLine);

            return string.Join("\n", fullLines.ToArray());
        }

        static void QueryVendorAddressAndTin(QbXmlSession session, string vendorListId, ref string tinOut, ref string addressOut)
        {
            if (string.IsNullOrEmpty(vendorListId)) return;
            try
            {
                XmlDocument doc = session.ProcessRequest(
                    "<VendorQueryRq>" +
                    "<ListID>" + EscapeXml(vendorListId) + "</ListID>" +
                    "<OwnerID>0</OwnerID>" +
                    "</VendorQueryRq>"
                );
                XmlNode v = doc.SelectSingleNode("//VendorRet");
                if (v != null)
                {
                    string taxIdent = GetNodeText(v, "VendorTaxIdent");
                    if (string.IsNullOrEmpty(taxIdent))
                    {
                        XmlNodeList dataExts = v.SelectNodes("DataExtRet");
                        if (dataExts != null)
                        {
                            foreach (XmlNode de in dataExts)
                            {
                                string deName = GetNodeText(de, "DataExtName");
                                if (deName.IndexOf("TIN", StringComparison.OrdinalIgnoreCase) >= 0)
                                {
                                    taxIdent = GetNodeText(de, "DataExtValue");
                                    break;
                                }
                            }
                        }
                    }
                    if (!string.IsNullOrEmpty(taxIdent))
                    {
                        tinOut = taxIdent;
                    }

                    if (string.IsNullOrEmpty(addressOut))
                    {
                        XmlNode vAddr = v.SelectSingleNode("VendorAddress");
                        if (vAddr != null)
                        {
                            addressOut = FormatDrcAddressBlock(vAddr);
                        }
                    }
                }
            }
            catch { }
        }

        // =========================================================================
        // 1. CHECK LEAF (Form Index 2: Check)
        // Mirrors AccessQueries_DRC.GetCheckDataDRC
        // =========================================================================
        static BridgeResponse QueryCheckLeafDRC(QbXmlSession session, string refNumber)
        {
            string reqXml =
                "<CheckQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(refNumber) + "</RefNumber></RefNumberFilter>" +
                "</CheckQueryRq>" +
                "<BillPaymentCheckQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(refNumber) + "</RefNumber></RefNumberFilter>" +
                "</BillPaymentCheckQueryRq>";

            XmlDocument doc = session.ProcessRequest(reqXml);

            XmlNodeList chkList = doc.SelectNodes("//CheckRet");
            if (chkList != null)
            {
                foreach (XmlNode chk in chkList)
                {
                    string docNum = GetNodeText(chk, "RefNumber");
                    if (docNum != refNumber) continue;

                    string payee = GetNodeText(chk, "PayeeEntityRef/FullName");
                    return new BridgeResponse
                    {
                        success = true,
                        sub_type = "CHECK",
                        ref_number = docNum,
                        date = FormatQbDate(GetNodeText(chk, "TxnDate")),
                        due_date = FormatQbDate(GetNodeText(chk, "TxnDate")),
                        payee_name = !string.IsNullOrEmpty(payee) ? payee : "No Payee",
                        bank_account = GetLeafAccountName(GetNodeText(chk, "AccountRef/FullName")),
                        total_amount = GetNodeDouble(chk, "Amount")
                    };
                }
            }

            XmlNodeList bpList = doc.SelectNodes("//BillPaymentCheckRet");
            if (bpList != null)
            {
                foreach (XmlNode bp in bpList)
                {
                    string docNum = GetNodeText(bp, "RefNumber");
                    if (docNum != refNumber) continue;

                    string payee = GetNodeText(bp, "PayeeEntityRef/FullName");
                    return new BridgeResponse
                    {
                        success = true,
                        sub_type = "CHECK",
                        ref_number = docNum,
                        date = FormatQbDate(GetNodeText(bp, "TxnDate")),
                        due_date = FormatQbDate(GetNodeText(bp, "TxnDate")),
                        payee_name = !string.IsNullOrEmpty(payee) ? payee : "No Payee",
                        bank_account = GetLeafAccountName(GetNodeText(bp, "BankAccountRef/FullName")),
                        total_amount = GetNodeDouble(bp, "Amount")
                    };
                }
            }

            return new BridgeResponse
            {
                success = false,
                error = "No data found for the provided reference number: " + refNumber
            };
        }

        // =========================================================================
        // 2. CHECK VOUCHER (Form Index 1: Check Voucher)
        // First tries GetCheckExpensesAndItemsData_DRC (Write Checks -> CRCV_DRC),
        // then falls back to GetBillData_DRC (BillPaymentCheck -> CRCV_DRCBILL).
        // =========================================================================
        static BridgeResponse QueryCheckVoucherDRC(
            QbXmlSession session,
            string refNumber,
            Dictionary<string, string> acctNumById,
            Dictionary<string, string> acctNumByName,
            ref string detectedApName,
            ref string detectedApCode)
        {
            // A. Try Direct Check (Write Checks)
            XmlDocument chkDoc = session.ProcessRequest(
                "<CheckQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(refNumber) + "</RefNumber></RefNumberFilter>" +
                "<IncludeLineItems>true</IncludeLineItems>" +
                "</CheckQueryRq>"
            );

            XmlNodeList chkList = chkDoc.SelectNodes("//CheckRet");
            if (chkList != null && chkList.Count > 0)
            {
                LoadChartOfAccounts(session, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);
                var itemAssetDict = LoadItemsAccountMap(session, acctNumById, acctNumByName, true);

                // Extract raw entries across matched checks (matching GetCheckExpensesAndItemsData_DRC)
                XmlNode firstChk = chkList[0];
                string txnDate = FormatQbDate(GetNodeText(firstChk, "TxnDate"));
                string rawBank = GetNodeText(firstChk, "AccountRef/FullName");
                string bankListId = GetNodeText(firstChk, "AccountRef/ListID");
                string bankName = GetLeafAccountName(rawBank);
                string bankCode = LookupAccountNumber(bankListId, rawBank, acctNumById, acctNumByName);
                string payee = GetNodeText(firstChk, "PayeeEntityRef/FullName");
                string payeeListId = GetNodeText(firstChk, "PayeeEntityRef/ListID");
                string memo = GetNodeText(firstChk, "Memo");
                double checkAmount = GetNodeDouble(firstChk, "Amount");
                string fullAddress = FormatDrcAddressBlock(firstChk.SelectSingleNode("Address"));
                string tin = "";
                QueryVendorAddressAndTin(session, payeeListId, ref tin, ref fullAddress);

                var rawEntries = new List<Tuple<string, string, string, double, string, string>>();
                var descOnlyEntries = new List<LineItemDto>();

                foreach (XmlNode check in chkList)
                {
                    XmlNodeList expLines = check.SelectNodes("ExpenseLineRet");
                    if (expLines != null)
                    {
                        foreach (XmlNode exp in expLines)
                        {
                            string expAccount = GetNodeText(exp, "AccountRef/FullName");
                            string expListId = GetNodeText(exp, "AccountRef/ListID");
                            double expAmount = GetNodeDouble(exp, "Amount");
                            string accNumber = LookupAccountNumber(expListId, expAccount, acctNumById, acctNumByName);
                            string expClass = GetNodeText(exp, "ClassRef/FullName");
                            string expMemo = GetNodeText(exp, "Memo");
                            string expCust = GetNodeText(exp, "CustomerRef/FullName");

                            if (!string.IsNullOrEmpty(expAccount))
                            {
                                rawEntries.Add(Tuple.Create(
                                    accNumber ?? "",
                                    expAccount,
                                    expClass ?? "",
                                    expAmount,
                                    expMemo ?? "",
                                    expCust ?? ""
                                ));
                            }
                        }
                    }

                    XmlNodeList itemLines = check.SelectNodes("ItemLineRet");
                    if (itemLines != null)
                    {
                        foreach (XmlNode item in itemLines)
                        {
                            string itemRefListId = GetNodeText(item, "ItemRef/ListID");
                            string itemName = GetNodeText(item, "ItemRef/FullName");
                            string itemDesc = GetNodeText(item, "Desc");
                            string itemClass = GetNodeText(item, "ClassRef/FullName");
                            double itemAmount = GetNodeDouble(item, "Amount");

                            string assetAccountName = itemName;
                            string assetAccountNumber = "";

                            ItemAccountInfo info;
                            if ((!string.IsNullOrEmpty(itemRefListId) && itemAssetDict.TryGetValue(itemRefListId, out info)) ||
                                (!string.IsNullOrEmpty(itemName) && itemAssetDict.TryGetValue(itemName, out info)))
                            {
                                if (!string.IsNullOrEmpty(info.AccountFullName))
                                    assetAccountName = info.AccountFullName;
                                assetAccountNumber = info.AccountNumber;
                            }

                            if (!string.IsNullOrEmpty(assetAccountName))
                            {
                                rawEntries.Add(Tuple.Create(
                                    assetAccountNumber ?? "",
                                    assetAccountName,
                                    itemClass ?? "",
                                    itemAmount,
                                    "",
                                    ""
                                ));
                            }
                            else if (!string.IsNullOrEmpty(itemDesc))
                            {
                                descOnlyEntries.Add(new LineItemDto
                                {
                                    account_number = "",
                                    account_name = itemDesc,
                                    class_name = "",
                                    debit = 0.0,
                                    credit = 0.0
                                });
                            }
                        }
                    }
                }

                // Group by (AccountNumber.Trim(), Particulars.Trim(), Class.Trim()) as in InsertDataToCheckVoucherCompiledDRC
                var consolidated = rawEntries
                    .GroupBy(x => new
                    {
                        Acc = (x.Item1 ?? "").Trim(),
                        Part = (x.Item2 ?? "").Trim(),
                        Cls = (x.Item3 ?? "").Trim()
                    })
                    .Select(g => new
                    {
                        g.Key.Acc,
                        g.Key.Part,
                        g.Key.Cls,
                        TotalNet = g.Sum(x => x.Item4),
                        Memo = g.Select(x => x.Item5).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)) ?? "",
                        Cust = g.Select(x => x.Item6).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)) ?? ""
                    })
                    .Where(x => Math.Abs(x.TotalNet) > 0.0001)
                    .ToList();

                List<LineItemDto> debitEntries = new List<LineItemDto>();
                List<LineItemDto> creditEntries = new List<LineItemDto>();

                foreach (var item in consolidated)
                {
                    var dto = new LineItemDto
                    {
                        account_number = item.Acc,
                        account_name = item.Part,
                        class_name = item.Cls,
                        memo = item.Memo,
                        customer_job = item.Cust,
                        debit = item.TotalNet > 0 ? item.TotalNet : 0.0,
                        credit = item.TotalNet < 0 ? Math.Abs(item.TotalNet) : 0.0
                    };
                    if (item.TotalNet > 0) debitEntries.Add(dto);
                    else creditEntries.Add(dto);
                }

                List<LineItemDto> finalLines = new List<LineItemDto>();
                finalLines.AddRange(debitEntries);
                finalLines.AddRange(creditEntries);
                finalLines.AddRange(descOnlyEntries);

                // Trailing Subreport Footer line: Bank Account Credit row
                finalLines.Add(new LineItemDto
                {
                    account_number = bankCode,
                    account_name = bankName,
                    memo = memo,
                    debit = 0.0,
                    credit = checkAmount,
                    item_name = "SUBREPORT_FOOTER"
                });

                return new BridgeResponse
                {
                    success = true,
                    sub_type = "DIRECT_CHECK",
                    ref_number = refNumber,
                    date = DateTime.Now.ToString("MM/dd/yyyy"),
                    due_date = txnDate,
                    payee_name = payee,
                    payee_address = fullAddress,
                    bank_account = bankName,
                    ap_account = bankCode,
                    tin = tin,
                    memo = memo,
                    total_amount = checkAmount,
                    line_items = finalLines
                };
            }

            // B. Fallback: Bill Payment Check (GenerateBillPaymentReport_DRC -> CRCV_DRCBILL)
            XmlDocument bpDoc = session.ProcessRequest(
                "<BillPaymentCheckQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(refNumber) + "</RefNumber></RefNumberFilter>" +
                "<IncludeLineItems>true</IncludeLineItems>" +
                "</BillPaymentCheckQueryRq>"
            );

            XmlNodeList bpList = bpDoc.SelectNodes("//BillPaymentCheckRet");
            if (bpList == null || bpList.Count == 0)
            {
                return new BridgeResponse
                {
                    success = false,
                    error = "Bill Payment Check or Check not found: " + refNumber
                };
            }

            LoadChartOfAccounts(session, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);

            XmlNode bp = bpList[0];
            string payDate = FormatQbDate(GetNodeText(bp, "TxnDate"));
            string bpPayee = GetNodeText(bp, "PayeeEntityRef/FullName");
            string bpPayeeListId = GetNodeText(bp, "PayeeEntityRef/ListID");
            string bpBankFull = GetNodeText(bp, "BankAccountRef/FullName");
            string bpBankListId = GetNodeText(bp, "BankAccountRef/ListID");
            string bpMemo = GetNodeText(bp, "Memo");
            double amountPaid = GetNodeDouble(bp, "Amount");

            string bpBankName = GetLeafAccountName(bpBankFull);
            string bpBankCode = LookupAccountNumber(bpBankListId, bpBankFull, acctNumById, acctNumByName);
            if (string.IsNullOrWhiteSpace(bpBankCode) && bpBankName.Contains("·"))
            {
                string[] parts = bpBankName.Split('·');
                bpBankCode = parts[0].Trim();
                bpBankName = parts.Length > 1 ? parts[1].Trim() : bpBankName;
            }

            XmlNodeList appliedNodes = bp.SelectNodes("AppliedToTxnRet");
            if (appliedNodes == null || appliedNodes.Count == 0)
            {
                return new BridgeResponse
                {
                    success = false,
                    error = "No Applied Bill found from Bill Payment Check: " + refNumber
                };
            }

            StringBuilder billReq = new StringBuilder("<BillQueryRq>");
            foreach (XmlNode app in appliedNodes)
            {
                string tId = GetNodeText(app, "TxnID");
                if (!string.IsNullOrEmpty(tId))
                {
                    billReq.Append("<TxnID>").Append(EscapeXml(tId)).Append("</TxnID>");
                }
            }
            billReq.Append("<IncludeLineItems>true</IncludeLineItems></BillQueryRq>");

            XmlDocument billDoc = session.ProcessRequest(billReq.ToString());
            XmlNodeList billList = billDoc.SelectNodes("//BillRet");
            if (billList == null || billList.Count == 0)
            {
                return new BridgeResponse
                {
                    success = false,
                    error = "Bills not found for the applied transactions on Check " + refNumber
                };
            }

            XmlNode primaryBill = billList[0];
            double sumAmountDue = 0.0;
            foreach (XmlNode b in billList)
            {
                sumAmountDue += GetNodeDouble(b, "AmountDue");
            }

            double totalCheckAmount = amountPaid > 0 ? amountPaid : sumAmountDue;
            string billMemo = GetNodeText(primaryBill, "Memo");
            string billApFull = GetNodeText(primaryBill, "APAccountRef/FullName");
            string billApListId = GetNodeText(primaryBill, "APAccountRef/ListID");
            string apCode = LookupAccountNumber(billApListId, billApFull, acctNumById, acctNumByName);
            string apName = !string.IsNullOrEmpty(billApFull) ? GetLeafAccountName(billApFull) : "Accounts Payable";

            XmlNode billAddrNode = primaryBill.SelectSingleNode("VendorAddress") ?? bp.SelectSingleNode("Address");
            string billAddress = FormatDrcAddressBlock(billAddrNode);
            string billTin = "";
            QueryVendorAddressAndTin(session, bpPayeeListId, ref billTin, ref billAddress);

            // In GenerateBillPaymentReport_DRC:
            // 1. InsertDataToBillCompiled stages a single DEBIT line for Accounts Payable
            // 2. Subreport footer places Bank Account in the CREDIT position
            List<LineItemDto> bpLines = new List<LineItemDto>();
            bpLines.Add(new LineItemDto
            {
                account_number = apCode,
                account_name = apName,
                memo = billMemo,
                debit = totalCheckAmount,
                credit = 0.0
            });
            bpLines.Add(new LineItemDto
            {
                account_number = bpBankCode,
                account_name = bpBankName,
                memo = billMemo,
                debit = 0.0,
                credit = totalCheckAmount,
                item_name = "SUBREPORT_FOOTER"
            });

            return new BridgeResponse
            {
                success = true,
                sub_type = "BILL_PAYMENT",
                ref_number = refNumber,
                date = DateTime.Now.ToString("MM/dd/yyyy"),
                due_date = payDate,
                payee_name = bpPayee,
                payee_address = billAddress,
                bank_account = bpBankName,
                ap_account = bpBankCode,
                tin = billTin,
                memo = billMemo,
                total_amount = totalCheckAmount,
                line_items = bpLines
            };
        }

        // =========================================================================
        // 3. JOURNAL VOUCHER (Form Index 3: Journal Voucher -> CRJV_DRC)
        // Mirrors AccessQueries_DRC.GetJournalEntryForGrid + InsertDataToJournalCompiled
        // =========================================================================
        static BridgeResponse QueryJournalVoucherDRC(
            QbXmlSession session,
            string refNumber,
            Dictionary<string, string> acctNumById,
            Dictionary<string, string> acctNumByName,
            ref string detectedApName,
            ref string detectedApCode)
        {
            XmlDocument doc = session.ProcessRequest(
                "<JournalEntryQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(refNumber) + "</RefNumber></RefNumberFilter>" +
                "<IncludeLineItems>true</IncludeLineItems>" +
                "</JournalEntryQueryRq>"
            );

            XmlNodeList list = doc.SelectNodes("//JournalEntryRet");
            if (list != null)
            {
                foreach (XmlNode je in list)
                {
                    string docNum = GetNodeText(je, "RefNumber");
                    if (docNum != refNumber) continue;

                    string txnDate = FormatQbDate(GetNodeText(je, "TxnDate"));
                    List<LineItemDto> rawLines = new List<LineItemDto>();
                    double debitTotal = 0.0;
                    string firstAccountName = "";

                    foreach (XmlNode child in je.ChildNodes)
                    {
                        bool isDebit = string.Equals(child.Name, "JournalDebitLine", StringComparison.OrdinalIgnoreCase);
                        bool isCredit = string.Equals(child.Name, "JournalCreditLine", StringComparison.OrdinalIgnoreCase);
                        if (!isDebit && !isCredit) continue;

                        string accFull = GetNodeText(child, "AccountRef/FullName");
                        string entName = GetNodeText(child, "EntityRef/FullName");
                        string lineMemo = GetNodeText(child, "Memo");
                        if (lineMemo.Length > 500) lineMemo = lineMemo.Substring(0, 500);
                        string clsName = GetNodeText(child, "ClassRef/FullName");
                        double amt = GetNodeDouble(child, "Amount");

                        if (string.IsNullOrEmpty(firstAccountName) && !string.IsNullOrEmpty(accFull))
                        {
                            firstAccountName = accFull;
                        }

                        if (isDebit) debitTotal += amt;

                        rawLines.Add(new LineItemDto
                        {
                            account_number = "",
                            account_name = accFull,
                            class_name = clsName,
                            customer_job = entName,
                            memo = lineMemo,
                            debit = isDebit ? amt : 0.0,
                            credit = isCredit ? amt : 0.0
                        });
                    }

                    // Sort lines: Debits first (Debit != 0), Credits second (matching InsertDataToJournalCompiled)
                    var sortedLines = rawLines
                        .OrderByDescending(x => x.debit != 0)
                        .ToList();

                    // Subreport footer in CRJV_DRC displays journal[0].AccountName and debitTotalAmount
                    sortedLines.Add(new LineItemDto
                    {
                        account_number = "",
                        account_name = firstAccountName,
                        memo = "",
                        debit = 0.0,
                        credit = debitTotal,
                        item_name = "SUBREPORT_FOOTER"
                    });

                    return new BridgeResponse
                    {
                        success = true,
                        sub_type = "JOURNAL",
                        ref_number = docNum,
                        date = DateTime.Now.ToString("MM/dd/yyyy"),
                        due_date = txnDate,
                        payee_name = firstAccountName,
                        total_amount = debitTotal,
                        line_items = sortedLines
                    };
                }
            }

            return new BridgeResponse
            {
                success = false,
                error = "Journal Entry with Reference Number '" + refNumber + "' not found in QuickBooks."
            };
        }

        // =========================================================================
        // 4. ACCOUNTS PAYABLE VOUCHER (Form Index 4: APV -> CRAPV_DRCBILL)
        // Mirrors AccessQueries_DRC.GetBillData_DRC_DirectBill + InsertDataToBillAPVCompiled
        // =========================================================================
        static BridgeResponse QueryDirectBillAPV_DRC(
            QbXmlSession session,
            string billRefNumber,
            Dictionary<string, string> acctNumById,
            Dictionary<string, string> acctNumByName,
            ref string detectedApName,
            ref string detectedApCode)
        {
            XmlDocument doc = session.ProcessRequest(
                "<BillQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(billRefNumber) + "</RefNumber></RefNumberFilter>" +
                "<IncludeLineItems>true</IncludeLineItems>" +
                "</BillQueryRq>"
            );

            XmlNodeList billList = doc.SelectNodes("//BillRet");
            if (billList == null || billList.Count == 0)
            {
                return new BridgeResponse
                {
                    success = false,
                    error = "Bill RefNumber not found: " + billRefNumber
                };
            }

            LoadChartOfAccounts(session, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);
            var itemAccountsDict = LoadItemsAccountMap(session, acctNumById, acctNumByName, false);

            XmlNode firstBill = billList[0];
            string payee = GetNodeText(firstBill, "VendorRef/FullName");
            string vendorListId = GetNodeText(firstBill, "VendorRef/ListID");
            string terms = GetNodeText(firstBill, "TermsRef/FullName");
            string apAccountName = GetNodeText(firstBill, "APAccountRef/FullName");
            string apListId = GetNodeText(firstBill, "APAccountRef/ListID");
            string billAccNum = LookupAccountNumber(apListId, apAccountName, acctNumById, acctNumByName);
            string memo = GetNodeText(firstBill, "Memo");
            if (memo.Length > 500) memo = memo.Substring(0, 500);

            string fullAddress = FormatDrcAddressBlock(firstBill.SelectSingleNode("VendorAddress"));
            string vendorTin = "";
            QueryVendorAddressAndTin(session, vendorListId, ref vendorTin, ref fullAddress);

            double totalAmountDue = 0.0;
            var allLines = new List<Tuple<string, string, string, string, string, double>>();

            foreach (XmlNode bill in billList)
            {
                totalAmountDue += GetNodeDouble(bill, "AmountDue");

                // Expense Lines
                XmlNodeList expLines = bill.SelectNodes("ExpenseLineRet");
                if (expLines != null)
                {
                    foreach (XmlNode exp in expLines)
                    {
                        string expAccountName = GetNodeText(exp, "AccountRef/FullName");
                        string expListId = GetNodeText(exp, "AccountRef/ListID");
                        string expAccNumber = LookupAccountNumber(expListId, expAccountName, acctNumById, acctNumByName);
                        if (string.IsNullOrEmpty(expAccNumber)) expAccNumber = billAccNum;
                        double expAmt = GetNodeDouble(exp, "Amount");
                        string expClass = GetNodeText(exp, "ClassRef/FullName");
                        string expCust = GetNodeText(exp, "CustomerRef/FullName");
                        string expMemo = GetNodeText(exp, "Memo");
                        if (expMemo.Length > 500) expMemo = expMemo.Substring(0, 500);

                        if (!string.IsNullOrEmpty(expAccountName))
                        {
                            string particulars = GetLeafAccountName(expAccountName);
                            allLines.Add(Tuple.Create(
                                (expAccNumber ?? "").Trim(),
                                particulars.Trim(),
                                (expClass ?? "").Trim(),
                                expMemo,
                                expCust,
                                expAmt
                            ));
                        }
                    }
                }

                // Item Lines
                XmlNodeList itemLines = bill.SelectNodes("ItemLineRet");
                if (itemLines != null)
                {
                    foreach (XmlNode item in itemLines)
                    {
                        string itemRefId = GetNodeText(item, "ItemRef/ListID");
                        string itemRefName = GetNodeText(item, "ItemRef/FullName");
                        double itemAmt = GetNodeDouble(item, "Amount");
                        string itemClass = GetNodeText(item, "ClassRef/FullName");
                        string itemCust = GetNodeText(item, "CustomerRef/FullName");
                        string itemDesc = GetNodeText(item, "Desc");

                        if (!string.IsNullOrEmpty(itemRefName))
                        {
                            string resolvedAssetAccount = itemRefName;
                            string resolvedAccountNumber = "";

                            ItemAccountInfo accInfo;
                            if ((!string.IsNullOrEmpty(itemRefId) && itemAccountsDict.TryGetValue(itemRefId, out accInfo)) ||
                                (!string.IsNullOrEmpty(itemRefName) && itemAccountsDict.TryGetValue(itemRefName, out accInfo)))
                            {
                                if (!string.IsNullOrEmpty(accInfo.AccountFullName))
                                    resolvedAssetAccount = accInfo.AccountFullName;
                                resolvedAccountNumber = accInfo.AccountNumber;
                            }

                            string particulars = GetLeafAccountName(resolvedAssetAccount);
                            allLines.Add(Tuple.Create(
                                (resolvedAccountNumber ?? "").Trim(),
                                particulars.Trim(),
                                (itemClass ?? "").Trim(),
                                itemDesc,
                                itemCust,
                                itemAmt
                            ));
                        }
                    }
                }
            }

            // Consolidate lines as in InsertDataToBillAPVCompiled
            var consolidatedLines = allLines
                .Where(x => !string.IsNullOrEmpty(x.Item2))
                .GroupBy(x => new { Particulars = x.Item2, AccountNumber = x.Item1, Class = x.Item3 })
                .Select(g => new
                {
                    Particulars = g.Key.Particulars,
                    AccountNumber = g.Key.AccountNumber,
                    Class = g.Key.Class,
                    Memo = g.Select(m => m.Item4).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)) ?? "",
                    CustomerJob = g.Select(c => c.Item5).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)) ?? "",
                    TotalAmount = g.Sum(x => x.Item6)
                })
                .Where(x => Math.Abs(x.TotalAmount) > 0.0001)
                .OrderByDescending(x => x.TotalAmount > 0)
                .ThenBy(x => x.AccountNumber)
                .ToList();

            List<LineItemDto> finalLines = new List<LineItemDto>();
            foreach (var item in consolidatedLines)
            {
                finalLines.Add(new LineItemDto
                {
                    account_number = item.AccountNumber,
                    account_name = item.Particulars,
                    class_name = item.Class,
                    memo = item.Memo,
                    customer_job = item.CustomerJob,
                    debit = item.TotalAmount > 0 ? item.TotalAmount : 0.0,
                    credit = item.TotalAmount < 0 ? Math.Abs(item.TotalAmount) : 0.0
                });
            }

            // Subreport footer in CRAPV_DRCBILL shows APAccountRefFullName, AccountNumber, and totalAmountDue
            finalLines.Add(new LineItemDto
            {
                account_number = billAccNum ?? "",
                account_name = apAccountName ?? "",
                memo = memo ?? "",
                debit = 0.0,
                credit = totalAmountDue,
                item_name = "SUBREPORT_FOOTER"
            });

            return new BridgeResponse
            {
                success = true,
                sub_type = "BILL",
                ref_number = billRefNumber,
                date = DateTime.Now.ToString("MM/dd/yyyy"),
                due_date = FormatQbDate(GetNodeText(firstBill, "TxnDate")),
                payee_name = payee,
                payee_address = fullAddress,
                ap_account = apAccountName ?? "",
                bank_account = billAccNum ?? "",
                tin = vendorTin,
                terms = terms,
                memo = memo,
                total_amount = totalAmountDue,
                line_items = finalLines
            };
        }

        // =========================================================================
        // 5. RECEIVING REPORT (Form Index 5: Receiving Report -> CRIR_DRC)
        // Mirrors AccessQueries_DRC.GetItemReceiptData_DRC + InsertDataToItemReceiptCompiled
        // =========================================================================
        static BridgeResponse QueryItemReceiptRR_DRC(
            QbXmlSession session,
            string refNumber,
            Dictionary<string, string> acctNumById,
            Dictionary<string, string> acctNumByName,
            ref string detectedApName,
            ref string detectedApCode)
        {
            LoadChartOfAccounts(session, acctNumById, acctNumByName, ref detectedApName, ref detectedApCode);

            XmlDocument doc = session.ProcessRequest(
                "<ItemReceiptQueryRq>" +
                "<RefNumberFilter><MatchCriterion>StartsWith</MatchCriterion><RefNumber>" + EscapeXml(refNumber) + "</RefNumber></RefNumberFilter>" +
                "<IncludeLineItems>true</IncludeLineItems>" +
                "</ItemReceiptQueryRq>"
            );

            XmlNodeList irList = doc.SelectNodes("//ItemReceiptRet");
            if (irList == null || irList.Count == 0)
            {
                return new BridgeResponse
                {
                    success = false,
                    error = "Item Receipt with RefNumber '" + refNumber + "' was not found."
                };
            }

            XmlNode firstIr = irList[0];
            string txnDate = FormatQbDate(GetNodeText(firstIr, "TxnDate"));
            string vendorName = GetNodeText(firstIr, "VendorRef/FullName");
            string vendorListId = GetNodeText(firstIr, "VendorRef/ListID");
            string currentRef = GetNodeText(firstIr, "RefNumber");
            string memo = GetNodeText(firstIr, "Memo");
            double totalAmount = GetNodeDouble(firstIr, "TotalAmount");

            string apAccount = GetNodeText(firstIr, "APAccountRef/FullName");
            string apListId = GetNodeText(firstIr, "APAccountRef/ListID");
            string apAccountCode = LookupAccountNumber(apListId, apAccount, acctNumById, acctNumByName);

            if (string.IsNullOrWhiteSpace(apAccount))
            {
                apAccount = detectedApName;
                apAccountCode = detectedApCode;
            }
            if (string.IsNullOrWhiteSpace(apAccountCode) && !string.IsNullOrEmpty(apAccount))
            {
                apAccountCode = LookupAccountNumber("", apAccount, acctNumById, acctNumByName);
            }

            string fullAddress = "";
            string vendorTin = "";
            QueryVendorAddressAndTin(session, vendorListId, ref vendorTin, ref fullAddress);

            var rawReceipts = new List<Tuple<bool, string, string, string, double, double, double>>();

            foreach (XmlNode ir in irList)
            {
                // 1. Item Lines
                XmlNodeList itemLines = ir.SelectNodes("ItemLineRet");
                if (itemLines != null)
                {
                    foreach (XmlNode item in itemLines)
                    {
                        string itemName = GetNodeText(item, "ItemRef/FullName");
                        string itemDesc = GetNodeText(item, "Desc");
                        double qty = GetNodeDouble(item, "Quantity");
                        double cost = GetNodeDouble(item, "Cost");
                        double amt = GetNodeDouble(item, "Amount");

                        rawReceipts.Add(Tuple.Create(
                            true, // isReceiptItem
                            "",   // item lines have empty AccountNumber in InsertDataToItemReceiptCompiled
                            itemName,
                            itemDesc,
                            qty,
                            cost,
                            amt
                        ));
                    }
                }

                // 2. Expense Lines
                XmlNodeList expLines = ir.SelectNodes("ExpenseLineRet");
                if (expLines != null)
                {
                    foreach (XmlNode exp in expLines)
                    {
                        string expAccount = GetNodeText(exp, "AccountRef/FullName");
                        string expListId = GetNodeText(exp, "AccountRef/ListID");
                        string accNum = LookupAccountNumber(expListId, expAccount, acctNumById, acctNumByName);
                        string expMemo = GetNodeText(exp, "Memo");
                        double expAmt = GetNodeDouble(exp, "Amount");

                        rawReceipts.Add(Tuple.Create(
                            false, // isReceiptExpense
                            accNum ?? "",
                            expAccount ?? "",
                            expMemo ?? "",
                            0.0,
                            0.0,
                            expAmt
                        ));
                    }
                }
            }

            // Sort: Debits first (amount > 0), Credits second (matching InsertDataToItemReceiptCompiled)
            var sortedReceipts = rawReceipts
                .OrderByDescending(r => r.Item7 > 0)
                .ToList();

            List<LineItemDto> finalLines = new List<LineItemDto>();
            foreach (var r in sortedReceipts)
            {
                string particulars = GetLeafAccountName(r.Item3);
                double amt = r.Item7;
                finalLines.Add(new LineItemDto
                {
                    account_number = r.Item2,
                    account_name = particulars,
                    memo = r.Item4,
                    quantity = r.Item5,
                    unit_cost = r.Item6,
                    debit = amt > 0 ? amt : 0.0,
                    credit = amt < 0 ? Math.Abs(amt) : 0.0
                });
            }

            // Subreport footer in CRIR_DRC: AP Title (leaf of BankAccount/apAccount), AP Code, and r0.TotalAmount
            string rawApTitle = GetLeafAccountName(apAccount);
            finalLines.Add(new LineItemDto
            {
                account_number = apAccountCode ?? "",
                account_name = rawApTitle ?? "",
                memo = memo ?? "",
                debit = 0.0,
                credit = totalAmount,
                item_name = "SUBREPORT_FOOTER"
            });

            return new BridgeResponse
            {
                success = true,
                sub_type = "ITEM_RECEIPT",
                ref_number = !string.IsNullOrEmpty(currentRef) ? currentRef : refNumber,
                date = txnDate,
                due_date = txnDate,
                payee_name = vendorName,
                payee_address = fullAddress,
                ap_account = rawApTitle ?? "",
                bank_account = apAccountCode ?? "",
                tin = vendorTin,
                memo = memo,
                total_amount = totalAmount,
                line_items = finalLines
            };
        }

        static string EscapeJson(string s)
        {
            if (s == null) return "";
            return s.Replace("\\", "\\\\")
                    .Replace("\"", "\\\"")
                    .Replace("\r", "\\r")
                    .Replace("\n", "\\n")
                    .Replace("\t", "\\t");
        }

        static void PrintJson(BridgeResponse r)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat("\"success\":{0},", r.success ? "true" : "false");
            sb.AppendFormat("\"error\":\"{0}\",", EscapeJson(r.error));
            sb.AppendFormat("\"ref_number\":\"{0}\",", EscapeJson(r.ref_number));
            sb.AppendFormat("\"date\":\"{0}\",", EscapeJson(r.date));
            sb.AppendFormat("\"due_date\":\"{0}\",", EscapeJson(r.due_date));
            sb.AppendFormat("\"payee_name\":\"{0}\",", EscapeJson(r.payee_name));
            sb.AppendFormat("\"payee_address\":\"{0}\",", EscapeJson(r.payee_address));
            sb.AppendFormat("\"bank_account\":\"{0}\",", EscapeJson(r.bank_account));
            sb.AppendFormat("\"ap_account\":\"{0}\",", EscapeJson(r.ap_account));
            sb.AppendFormat("\"tin\":\"{0}\",", EscapeJson(r.tin));
            sb.AppendFormat("\"terms\":\"{0}\",", EscapeJson(r.terms));
            sb.AppendFormat("\"sub_type\":\"{0}\",", EscapeJson(r.sub_type));
            sb.AppendFormat("\"payee_zip\":\"{0}\",", EscapeJson(r.payee_zip));
            sb.AppendFormat("\"payor_name\":\"{0}\",", EscapeJson(r.payor_name));
            sb.AppendFormat("\"payor_address\":\"{0}\",", EscapeJson(r.payor_address));
            sb.AppendFormat("\"payor_tin\":\"{0}\",", EscapeJson(r.payor_tin));
            sb.AppendFormat("\"payor_zip\":\"{0}\",", EscapeJson(r.payor_zip));
            sb.AppendFormat("\"po_number\":\"{0}\",", EscapeJson(r.po_number));
            sb.AppendFormat("\"memo\":\"{0}\",", EscapeJson(r.memo));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"total_amount\":{0:F2},", r.total_amount);

            sb.Append("\"line_items\":[");
            for (int i = 0; i < r.line_items.Count; i++)
            {
                var li = r.line_items[i];
                if (i > 0) sb.Append(",");
                sb.Append("{");
                sb.AppendFormat("\"account_number\":\"{0}\",", EscapeJson(li.account_number));
                sb.AppendFormat("\"account_name\":\"{0}\",", EscapeJson(li.account_name));
                sb.AppendFormat("\"class_name\":\"{0}\",", EscapeJson(li.class_name));
                sb.AppendFormat("\"customer_job\":\"{0}\",", EscapeJson(li.customer_job));
                sb.AppendFormat("\"memo\":\"{0}\",", EscapeJson(li.memo));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"debit\":{0:F2},", li.debit);
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"credit\":{0:F2},", li.credit);
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"quantity\":{0:F2},", li.quantity);
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"unit_cost\":{0:F2},", li.unit_cost);
                sb.AppendFormat("\"item_name\":\"{0}\"", EscapeJson(li.item_name));
                sb.Append("}");
            }
            sb.Append("],");

            sb.Append("\"bill_credits\":[");
            for (int i = 0; i < r.bill_credits.Count; i++)
            {
                var bc = r.bill_credits[i];
                if (i > 0) sb.Append(",");
                sb.Append("{");
                sb.AppendFormat("\"credit_ref_number\":\"{0}\",", EscapeJson(bc.credit_ref_number));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"applied_amount\":{0:F2},", bc.applied_amount);
                sb.AppendFormat("\"account_name\":\"{0}\",", EscapeJson(bc.account_name));
                sb.AppendFormat("\"class_name\":\"{0}\",", EscapeJson(bc.class_name));
                sb.AppendFormat("\"memo\":\"{0}\"", EscapeJson(bc.memo));
                sb.Append("}");
            }
            sb.Append("]}");

            Console.WriteLine(sb.ToString());
        }
    }
}
