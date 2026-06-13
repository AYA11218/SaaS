import React, { useState, useEffect } from "react";
import { Space, Testimonial } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { 
  FileSpreadsheet, 
  HelpCircle, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Unlink, 
  ExternalLink, 
  Sparkles,
  Database,
  Link2,
  Trash2,
  ListFilter,
  Check,
  Copy
} from "lucide-react";

interface GoogleSheetsIntegrationProps {
  selectedSpace: Space | null;
  onSpaceUpdate: (space: Space) => void;
  testimonials: Testimonial[];
  selectedTestimonialIds: string[];
  setSelectedTestimonialIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSyncLogs: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function SaaS_GoogleSheetsIntegration({
  selectedSpace,
  onSpaceUpdate,
  testimonials,
  selectedTestimonialIds,
  setSelectedTestimonialIds,
  setSyncLogs
}: GoogleSheetsIntegrationProps) {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  
  // Custom manual linkage input
  const [manualSheetUrl, setManualSheetUrl] = useState("");
  const [manualLinkError, setManualLinkError] = useState<string | null>(null);

  // Cast Space values 
  const customSpace = selectedSpace as any;
  const sheetsSpreadsheetId = customSpace?.sheetsSpreadsheetId || "";
  const sheetsSpreadsheetUrl = customSpace?.sheetsSpreadsheetUrl || "";
  const sheetsAutoSync = !!customSpace?.sheetsAutoSync;
  const sheetsLastSync = customSpace?.sheetsLastSync || "";

  // Share session storage token with Google Drive integration
  useEffect(() => {
    const savedToken = sessionStorage.getItem("google_access_token");
    if (savedToken) {
      setGoogleAccessToken(savedToken);
    }
  }, []);

  // Listen to session storage changes or window focus to sync token
  useEffect(() => {
    const checkToken = () => {
      const savedToken = sessionStorage.getItem("google_access_token");
      if (savedToken && savedToken !== googleAccessToken) {
        setGoogleAccessToken(savedToken);
      }
    };
    window.addEventListener("focus", checkToken);
    return () => window.removeEventListener("focus", checkToken);
  }, [googleAccessToken]);

  // Connect Google Sheets OAuth
  const handleConnectGoogleSheets = async () => {
    setAuthChecking(true);
    setAuthError(null);
    setOperationSuccess(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add Sheets and read-only Drive scopes
      provider.addScope("https://www.googleapis.com/auth/spreadsheets");
      provider.addScope("https://www.googleapis.com/auth/drive.readonly");
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        const token = credential.accessToken;
        setGoogleAccessToken(token);
        sessionStorage.setItem("google_access_token", token);
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSyncLogs(prev => [
          {
            id: `sheets-connected-${Date.now()}`,
            timestamp,
            integration: "Google Sheets Sync",
            message: `Successfully connected Google Sheets credentials.`,
            type: "success"
          },
          ...prev
        ]);
        setOperationSuccess("Successfully connected your Google account for Sheets integration!");
      } else {
        throw new Error("No authorization token was returned from Google account authentication.");
      }
    } catch (err: any) {
      console.error("Google Sheets OAuth failed:", err);
      let friendlyMsg = err.message || JSON.stringify(err);
      if (err.code === "auth/popup-closed-by-user" || friendlyMsg.includes("popup-closed-by-user") || friendlyMsg.includes("cancelled-by-user")) {
        friendlyMsg = "Google authorization popup was blocked or closed before completion. If you are viewing this app within the AI Studio frame, cross-origin security will block logins. Please click the 'Open in New Tab' button in the upper-right corner of the development preview window and log in there!";
      }
      setAuthError(friendlyMsg);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleDisconnectGoogleSheets = () => {
    setGoogleAccessToken(null);
    sessionStorage.removeItem("google_access_token");
    setOperationSuccess(null);
    setAuthError(null);
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSyncLogs(prev => [
      {
        id: `sheets-revoked-${Date.now()}`,
        timestamp,
        integration: "Google Sheets Sync",
        message: "Logged out of Google Sheets workspace access.",
        type: "warning"
      },
      ...prev
    ]);
  };

  // Create a brand new Google Spreadsheet with headers
  const handleCreateNewSpreadsheet = async () => {
    if (!googleAccessToken) {
      setAuthError("Please connect your Google account before attempting to create spreadsheets.");
      return;
    }
    setSheetsLoading(true);
    setAuthError(null);
    setOperationSuccess(null);

    try {
      const spaceName = selectedSpace?.name || "My Platform";
      const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: `TrustBuilder Testimonials Export: ${spaceName}`
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to generate Google Sheet.");
      }

      const rawResult = await response.json();
      const spreadsheetId = rawResult.spreadsheetId;
      const spreadsheetUrl = rawResult.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      // Initialize with correct headers row
      const initHeadersResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:J1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            range: "Sheet1!A1:J1",
            majorDimension: "ROWS",
            values: [[
              "Review ID",
              "Reviewer Name",
              "Email Address",
              "Company Name",
              "Job Title",
              "Rating (1 to 5 Stars)",
              "Review Text Content",
              "Syndication Status",
              "AI Sentiment Score",
              "Date Submitted (UTC)"
            ]]
          })
        }
      );

      if (!initHeadersResponse.ok) {
        console.warn("Headers initialization failed, but sheet was created successfully.");
      }

      // Update current Firestore Space model
      if (selectedSpace) {
        const spaceRef = doc(db, "spaces", selectedSpace.id);
        await updateDoc(spaceRef, {
          sheetsSpreadsheetId: spreadsheetId,
          sheetsSpreadsheetUrl: spreadsheetUrl,
          sheetsLastSync: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        onSpaceUpdate({
          ...selectedSpace,
          sheetsSpreadsheetId,
          sheetsSpreadsheetUrl,
          sheetsLastSync: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } as any);
      }

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `sheets-create-${Date.now()}`,
          timestamp,
          integration: "Google Sheets Sync",
          message: `Created brand new secure sheet listing: "${rawResult.properties?.title || "TrustBuilder Export"}"`,
          type: "success"
        },
        ...prev
      ]);

      setOperationSuccess("Successfully provisioned a new Google Spreadsheet and linked it to your workspace!");
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "An unexpected error occurred while making Spreadsheet API calls.");
    } finally {
      setSheetsLoading(false);
    }
  };

  // Link an existing Sheet by parsing URL / ID
  const handleLinkExistingSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLinkError(null);
    setOperationSuccess(null);

    let parsedId = manualSheetUrl.trim();
    if (parsedId.includes("docs.google.com/spreadsheets")) {
      const match = parsedId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        parsedId = match[1];
      } else {
        setManualLinkError("Unable to extract Spreadsheet ID from this URL format. Make sure it has /d/[ID] inside it.");
        return;
      }
    }

    if (!parsedId) {
      setManualLinkError("Please enter a valid spreadsheet URL or 44-character ID.");
      return;
    }

    if (!googleAccessToken) {
      setManualLinkError("Please ensure you've connected your Google Account first.");
      return;
    }

    setSheetsLoading(true);
    try {
      // Validate spreadsheet access using spreadsheets.get
      const verifyRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${parsedId}`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });

      if (!verifyRes.ok) {
        throw new Error("Target Spreadsheet was not found or permissions are restricted. Check shared visibility.");
      }

      const sheetMeta = await verifyRes.json();
      const verifiedUrl = sheetMeta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${parsedId}/edit`;
      const verifiedTitle = sheetMeta.properties?.title || "Linked Spreadsheet";

      if (selectedSpace) {
        const spaceRef = doc(db, "spaces", selectedSpace.id);
        await updateDoc(spaceRef, {
          sheetsSpreadsheetId: parsedId,
          sheetsSpreadsheetUrl: verifiedUrl,
          sheetsLastSync: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        onSpaceUpdate({
          ...selectedSpace,
          sheetsSpreadsheetId: parsedId,
          sheetsSpreadsheetUrl: verifiedUrl,
          sheetsLastSync: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } as any);
      }

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `sheets-link-${Date.now()}`,
          timestamp,
          integration: "Google Sheets Sync",
          message: `Linked external asset "${verifiedTitle}" as active data logger.`,
          type: "success"
        },
        ...prev
      ]);

      setOperationSuccess(`Linked with spreadsheet "${verifiedTitle}"!`);
      setManualSheetUrl("");
    } catch (err: any) {
      console.error(err);
      setManualLinkError(err.message || "Failed to confirm spreadsheet access. Verify spreadsheet sharing permissions.");
    } finally {
      setSheetsLoading(false);
    }
  };

  // Perform actual rows append export
  const handleExportTestimonials = async (mode: "all" | "approved" | "selected") => {
    if (!googleAccessToken) {
      setAuthError("No active credentials. Connect Google first.");
      return;
    }
    if (!sheetsSpreadsheetId) {
      setAuthError("No spreadsheet is linked yet. Create or link one below.");
      return;
    }

    setSheetsLoading(true);
    setAuthError(null);
    setOperationSuccess(null);

    try {
      let targets: Testimonial[] = [];
      if (mode === "selected") {
        targets = testimonials.filter(t => selectedTestimonialIds.includes(t.id));
        if (targets.length === 0) {
          throw new Error("No reviews are currently checked. Select reviews via checkmarks from the main list below first.");
        }
      } else if (mode === "approved") {
        targets = testimonials.filter(t => t.status === "approved");
        if (targets.length === 0) {
          throw new Error("There are no approved testimonials in this workspace to export.");
        }
      } else {
        targets = [...testimonials];
        if (targets.length === 0) {
          throw new Error("There are no reviews in this workspace to export.");
        }
      }

      // Convert target list to values rows
      const targetRows = targets.map((t) => [
        t.id,
        t.name || "Anonymous Reviewer",
        t.email || "N/A",
        t.company || "",
        t.title || "",
        t.rating ? `${t.rating} Stars` : "5 Stars",
        t.content || "",
        t.status || "new",
        t.sentiment || "Neutral",
        t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()
      ]);

      // Request append
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetsSpreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            majorDimension: "ROWS",
            values: targetRows
          })
        }
      );

      if (!appendRes.ok) {
        const appendErr = await appendRes.json();
        throw new Error(appendErr.error?.message || "Failed to append rows to active spreadsheet.");
      }

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `sheets-export-${Date.now()}`,
          timestamp,
          integration: "Google Sheets Sync",
          message: `[GOOGLE SHEETS EXPORT] Successfully pushed ${targets.length} review entries to remote logger (append mode).`,
          type: "success"
        },
        ...prev
      ]);

      setOperationSuccess(`Successfully exported ${targets.length} testimonials to the linked Google Sheet!`);
      
      // Update sheets Last Sync state
      if (selectedSpace) {
        const spaceRef = doc(db, "spaces", selectedSpace.id);
        const syncTime = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await updateDoc(spaceRef, { sheetsLastSync: syncTime });
        
        onSpaceUpdate({
          ...selectedSpace,
          sheetsLastSync: syncTime
        } as any);
      }

      // Clear selected state upon successful export
      if (mode === "selected") {
        setSelectedTestimonialIds([]);
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Failed appending spreadsheet data.");
    } finally {
      setSheetsLoading(false);
    }
  };

  // Toggle automated sheets auto-sync in Space
  const handleToggleAutoSync = async () => {
    if (!selectedSpace) return;
    const currentStatus = sheetsAutoSync;
    const spaceRef = doc(db, "spaces", selectedSpace.id);
    
    try {
      await updateDoc(spaceRef, { sheetsAutoSync: !currentStatus });
      onSpaceUpdate({
        ...selectedSpace,
        sheetsAutoSync: !currentStatus
      } as any);

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `sheets-autosync-toggle-${Date.now()}`,
          timestamp,
          integration: "Google Sheets Sync",
          message: `Automated instant customer syndication ${!currentStatus ? "ENABLED" : "DISABLED"}.`,
          type: "info"
        },
        ...prev
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  // Unlink sheet association
  const handleUnlinkSpreadsheet = async () => {
    const confirmation = window.confirm("Are you sure you want to disconnect this spreadsheet connection? This will not delete the file in your Google Drive, but we will stop syndicating reviews to it.");
    if (!confirmation) return;

    if (!selectedSpace) return;
    setSheetsLoading(true);
    try {
      const spaceRef = doc(db, "spaces", selectedSpace.id);
      await updateDoc(spaceRef, {
        sheetsSpreadsheetId: "",
        sheetsSpreadsheetUrl: "",
        sheetsAutoSync: false
      });

      onSpaceUpdate({
        ...selectedSpace,
        sheetsSpreadsheetId: "",
        sheetsSpreadsheetUrl: "",
        sheetsAutoSync: false
      } as any);

      setOperationSuccess("Successfully unlinked Google Sheet connection from your workspace.");
    } catch (err) {
      console.error(err);
    } finally {
      setSheetsLoading(false);
    }
  };

  return (
    <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-xs space-y-6">
      
      {/* Module Header block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="flex gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shrink-0">
            <FileSpreadsheet className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">Google Sheets Export Hub</h3>
              <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                googleAccessToken 
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200/50" 
                  : "bg-slate-100 text-slate-400 border border-slate-205"
              }`}>
                {googleAccessToken ? "● Connected" : "○ Disconnected"}
              </span>
            </div>
            <p className="text-[11px] text-slate-450 font-semibold mt-1 font-sans leading-relaxed">
              Syndicated secure feedback streaming sheets. Instantly stream or batch-export customer reviews, ratings, and AI sentiment scores to Google Sheets.
            </p>
          </div>
        </div>

        {/* Global Connection Controls */}
        <div className="shrink-0">
          {googleAccessToken ? (
            <button
              onClick={handleDisconnectGoogleSheets}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-102 active:scale-98"
            >
              <Unlink className="w-3.5 h-3.5 text-rose-400" /> Disconnect Google
            </button>
          ) : (
            <button
              disabled={authChecking}
              onClick={handleConnectGoogleSheets}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md shadow-emerald-600/10 hover:scale-102 active:scale-98"
            >
              {authChecking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying accounts...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" /> Connect Google Sheets
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Operation Warnings / Alerts */}
      {authError && (
        <div className="bg-rose-50 text-rose-900 text-xs font-bold p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-black uppercase tracking-wider text-[10px]">Google Sheets API Connection Restricted</span>
          </div>
          <p className="font-semibold leading-relaxed text-rose-700">
            {authError}
          </p>
          <div className="pt-1 select-none">
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-950 border border-rose-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-transform cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-rose-800" /> Open Standalone Viewport & Connect
            </a>
          </div>
        </div>
      )}

      {operationSuccess && (
        <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-4 rounded-2xl border border-emerald-250/70 shadow-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <span>{operationSuccess}</span>
        </div>
      )}

      {/* Main Control Panel split into columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Linkage & Sheet Setup */}
        <div className="lg:col-span-2 space-y-4 text-left">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Workspace Sheet Setup</h4>

          {!sheetsSpreadsheetId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Box A: Provision fresh sheet */}
              <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex flex-col justify-between space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-emerald-600 font-black uppercase tracking-wider">Option A: Provision</span>
                  <h5 className="text-xs font-black text-slate-900 leading-tight">Create Fresh Review Spreadsheet</h5>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    Build a complete dedicated ledger pre-formatted with column titles to start exporting your approved customer feedback instantly.
                  </p>
                </div>
                
                <button
                  type="button"
                  disabled={!googleAccessToken || sheetsLoading}
                  onClick={handleCreateNewSpreadsheet}
                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center border cursor-pointer ${
                    googleAccessToken 
                      ? "bg-emerald-50 hover:bg-emerald-100/60 text-emerald-800 border-emerald-200 hover:border-emerald-300 active:scale-98" 
                      : "bg-slate-100 text-slate-400 border-transparent cursor-not-allowed"
                  }`}
                >
                  {sheetsLoading ? "API Writing..." : "✨ Create New Spreadsheet"}
                </button>
              </div>

              {/* Box B: Manual entry or existing ID linking */}
              <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex flex-col justify-between space-y-3.5">
                <form onSubmit={handleLinkExistingSheet} className="space-y-3.5 flex flex-col justify-between h-full">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-indigo-600 font-black uppercase tracking-wider">Option B: Associate</span>
                    <h5 className="text-xs font-black text-slate-900 leading-tight">Link Existing Google Sheet</h5>
                    <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                      Sync reviews directly to an existing sheets database file. Paste the sheet browser URL or its 44-char document ID below.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Paste google sheet link or ID..."
                      value={manualSheetUrl}
                      onChange={(e) => setManualSheetUrl(e.target.value)}
                      disabled={!googleAccessToken || sheetsLoading}
                      className="w-full text-[11px] font-semibold px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-100"
                    />
                    
                    {manualLinkError && (
                      <p className="text-[9px] font-bold text-rose-600 mt-1 leading-normal">
                        ⚠️ {manualLinkError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!googleAccessToken || sheetsLoading || !manualSheetUrl}
                      className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center border cursor-pointer ${
                        googleAccessToken && manualSheetUrl
                          ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50 active:scale-98 shadow-xs" 
                          : "bg-slate-100 text-slate-400 border-transparent cursor-not-allowed"
                      }`}
                    >
                      {sheetsLoading ? "Checking metadata..." : "🔗 Connect Existing Spreadsheet"}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          ) : (
            /* Linked Active target layout */
            <div className="bg-emerald-50/20 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-emerald-600 font-extrabold uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Active Linked Spreadsheet Logger
                  </span>
                  <h5 className="text-xs font-extrabold text-slate-900 leading-tight">TrustBuilder Syndicator Feed Active</h5>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 select-all font-semibold">
                    SHEET ID: {sheetsSpreadsheetId}
                  </p>
                </div>

                <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                  <a
                    href={sheetsSpreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-250 rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Live Sheet
                  </a>
                  <button
                    onClick={handleUnlinkSpreadsheet}
                    disabled={sheetsLoading}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Disconnect Link
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-200/60" />

              {/* real-time sync auto switch toggle */}
              <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200/50">
                <div className="space-y-0.5 max-w-sm">
                  <h6 className="text-[11px] font-black text-slate-900">Instant Real-Time Stream</h6>
                  <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                    Auto-append fresh incoming reviews immediately to your linked Google Sheet when customer submits.
                  </p>
                </div>

                <button
                  onClick={handleToggleAutoSync}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    sheetsAutoSync ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      sheetsAutoSync ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* last sync log tag */}
              {sheetsLastSync && (
                <div className="text-[9px] font-semibold text-slate-400 font-mono flex items-center gap-1.5 justify-end">
                  <span>LAST SHEET DATA UPDATE:</span>
                  <span className="text-slate-800 font-bold">{sheetsLastSync}</span>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Right Column: Actions and Exporter tools */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 space-y-4 text-left">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Feedback Exporter Panel</h4>
          
          <div className="space-y-3">
            
            {/* Box Action: Export checked */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-450 uppercase font-sans">Checked Reviews Queue</span>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-lg border border-indigo-100">
                  {selectedTestimonialIds.length} Selected
                </span>
              </div>
              <button
                type="button"
                disabled={!googleAccessToken || !sheetsSpreadsheetId || selectedTestimonialIds.length === 0 || sheetsLoading}
                onClick={() => handleExportTestimonials("selected")}
                className={`w-full py-3.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  googleAccessToken && sheetsSpreadsheetId && selectedTestimonialIds.length > 0 && !sheetsLoading
                    ? "bg-slate-900 hover:bg-slate-800 text-teal-300 hover:scale-[1.01] active:scale-98 shadow-md"
                    : "bg-slate-100 text-slate-405 border border-transparent cursor-not-allowed opacity-60"
                }`}
              >
                <Sparkles className="w-4 h-4 text-teal-400 animate-bounce" />
                <span>Export ({selectedTestimonialIds.length}) Selected Entries</span>
              </button>
            </div>

            <div className="h-px bg-slate-200/60 my-2" />

            {/* Other bulk methods */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-405 uppercase block">Bulk Sheet Syndication</label>
              
              <button
                type="button"
                disabled={!googleAccessToken || !sheetsSpreadsheetId || sheetsLoading}
                onClick={() => handleExportTestimonials("approved")}
                className={`w-full py-2.5 rounded-xl text-[10px] font-extrabold uppercase transition-all border text-center cursor-pointer ${
                  googleAccessToken && sheetsSpreadsheetId && !sheetsLoading
                    ? "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50 active:scale-98"
                    : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                }`}
              >
                📥 Append Approved Reviews ({testimonials.filter(t => t.status === "approved").length})
              </button>

              <button
                type="button"
                disabled={!googleAccessToken || !sheetsSpreadsheetId || sheetsLoading}
                onClick={() => handleExportTestimonials("all")}
                className={`w-full py-2.5 rounded-xl text-[10px] font-extrabold uppercase transition-all border text-center cursor-pointer ${
                  googleAccessToken && sheetsSpreadsheetId && !sheetsLoading
                    ? "bg-white text-slate-800 border-slate-320 hover:bg-slate-50/70 active:scale-98"
                    : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                }`}
              >
                📂 Push All Workspace Reviews ({testimonials.length})
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Sheet Column headers preview indicator mapping to prove real integrity */}
      <div className="bg-slate-100/40 border border-slate-200/40 rounded-2xl p-4 text-left">
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono block">Spreadsheet Columns Mapping Structure:</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 select-none">
          {["Review ID", "Reviewer Name", "Email Address", "Company Name", "Job Title", "Rating", "Review Content", "Syndication Status", "AI Sentiment", "Date Submitted"].map((col, idx) => (
            <div key={idx} className="bg-white border border-slate-200/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold text-indigo-405">{String.fromCharCode(65 + idx)}</span>
              <span className="text-[10px] font-bold text-slate-600 truncate">{col}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
