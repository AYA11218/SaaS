import React, { useState, useEffect } from "react";
import { Space, Campaign } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { 
  FolderOpen, 
  Image, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  ExternalLink,
  ChevronRight,
  Database,
  Unlink,
  Terminal,
  Paperclip,
  CloudLightning,
  Sparkles
} from "lucide-react";
import firebaseConfig from "../../firebase-applet-config.json";

interface GoogleDriveIntegrationProps {
  selectedSpace: Space | null;
  onSpaceUpdate: (space: Space) => void;
  campaigns: Campaign[];
  setSyncLogs: React.Dispatch<React.SetStateAction<any[]>>;
}

export interface PickedFileLog {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink: string | null;
  sizeBytes: string;
  pickedTime: string;
}

export default function SaaS_GoogleDriveIntegration({
  selectedSpace,
  onSpaceUpdate,
  campaigns,
  setSyncLogs
}: GoogleDriveIntegrationProps) {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  
  // Picked Assets state
  const [pickedLogs, setPickedLogs] = useState<PickedFileLog[]>([]);
  const [selectedInspectFile, setSelectedInspectFile] = useState<any | null>(null);
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Dev configuration from firebase config
  const apiKey = firebaseConfig.apiKey;

  // Load access token from Session Storage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem("google_access_token");
    if (savedToken) {
      setGoogleAccessToken(savedToken);
    }
  }, []);

  // Dynamically Load Google API Client Library & Google Picker
  useEffect(() => {
    let scriptExists = document.getElementById("google-gapi-script");
    if (scriptExists) {
      setScriptsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gapi-script";
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Once loaded, initialize picker library
      if ((window as any).gapi) {
        (window as any).gapi.load("picker", {
          callback: () => {
            setScriptsLoaded(true);
            console.log("Google Picker SDK loaded successfully.");
          },
          onerror: (err: any) => console.error("Error loading google.picker library:", err)
        });
      }
    };
    script.onerror = (err) => console.error("Error loading gapi.js:", err);
    document.body.appendChild(script);
  }, []);

  // Connect Google Account for Drive Integration
  const handleConnectGoogleDrive = async () => {
    setAuthChecking(true);
    setUpdateSuccessMsg("");
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add standard read-only scope for files
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
            id: `gdrive-connected-${Date.now()}`,
            timestamp,
            integration: "Google Drive Sync",
            message: `Successfully connected Google Drive Merchant credentials & initialized Secure Picker access.`,
            type: "success"
          },
          ...prev
        ]);
        setUpdateSuccessMsg("Successfully authenticated Google Drive account!");
      } else {
        throw new Error("No OAuth access token was returned during Google authentication.");
      }
    } catch (err: any) {
      console.error("Google Drive connection failed:", err);
      let friendlyMsg = err.message || JSON.stringify(err);
      if (err.code === "auth/popup-closed-by-user" || friendlyMsg.includes("popup-closed-by-user") || friendlyMsg.includes("cancelled-by-user")) {
        friendlyMsg = "Google login popup was closed, cancelled, or blocked before authentication completed. Since you are in the AI Studio preview iframe, browser security settings block cookie/popups across origins. Please click 'Open in New Tab' at the top-right corner of the development viewport and try connecting your Google Drive there, which will bypass this restriction seamlessly!";
      }
      setAuthError(friendlyMsg);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncLogs(prev => [
        {
          id: `gdrive-fail-${Date.now()}`,
          timestamp,
          integration: "Google Drive Sync",
          message: `Authorization failed: ${err.message || err}`,
          type: "warning"
        },
        ...prev
      ]);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    setGoogleAccessToken(null);
    sessionStorage.removeItem("google_access_token");
    setSelectedInspectFile(null);
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSyncLogs(prev => [
      {
        id: `gdrive-disconnect-${Date.now()}`,
        timestamp,
        integration: "Google Drive Sync",
        message: "Disconnected Google Drive and revoked current session access token tokens.",
        type: "warning"
      },
      ...prev
    ]);
  };

  // Launch Google Picker client modal
  const launchGooglePicker = (mode: "logo" | "inspect") => {
    if (!googleAccessToken) {
      alert("Please connect your Google Drive account first.");
      return;
    }
    if (!scriptsLoaded || !(window as any).google || !(window as any).google.picker) {
      alert("Google Picker scripts are still loading. Please try again in a moment.");
      return;
    }

    setPickerLoading(true);

    try {
      const pickerBuilder = new (window as any).google.picker.PickerBuilder()
        .setDeveloperKey(apiKey)
        .setOAuthToken(googleAccessToken);

      // Setup different views based on mode
      if (mode === "logo") {
        // Look specifically for images/photos
        const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.DOCS_IMAGES);
        pickerBuilder.addView(view);
        pickerBuilder.setTitle("Select Business Workspace Branded Logo");
      } else {
        // General picker layout showcasing folders, files and general docs
        const viewGroup = new (window as any).google.picker.ViewGroup((window as any).google.picker.ViewGroupId.DOCS);
        pickerBuilder.addView(viewGroup);
        pickerBuilder.setTitle("Select Any Google Drive Asset to Inspect");
      }

      // Configure Callback
      pickerBuilder.setCallback(async (data: any) => {
        if (data.action === (window as any).google.picker.Action.PICKED) {
          const docPicked = data.docs[0];
          const fileId = docPicked.id;
          const fileName = docPicked.name;
          const fileMime = docPicked.mimeType;
          const fileUrl = docPicked.url;
          const fileServiceLogo = docPicked.iconUrl;

          // Make direct REST API fetch via drive.v3 to get complete, secure public URL link & thumbnail
          let serverThumbnail = null;
          let webViewLink = fileUrl;
          let sizeLabel = "Dynamic";

          try {
            const apiRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,thumbnailLink,webViewLink,size`,
              {
                headers: { Authorization: `Bearer ${googleAccessToken}` }
              }
            );
            if (apiRes.ok) {
              const fullDetails = await apiRes.json();
              serverThumbnail = fullDetails.thumbnailLink;
              webViewLink = fullDetails.webViewLink || fileUrl;
              if (fullDetails.size) {
                const bytes = parseInt(fullDetails.size, 10);
                if (bytes > 1024 * 1024) {
                  sizeLabel = (bytes / (1024 * 1024)).toFixed(1) + " MB";
                } else if (bytes > 1024) {
                  sizeLabel = (bytes / 1024).toFixed(0) + " KB";
                } else {
                  sizeLabel = bytes + " B";
                }
              }
              
              // Load full JSON detailed metadata in inspector state
              setSelectedInspectFile(fullDetails);
            }
          } catch (err) {
            console.error("Non-blocking metadata fetch error from Google Drive API:", err);
          }

          const freshLog: PickedFileLog = {
            id: fileId,
            name: fileName,
            mimeType: fileMime,
            webViewLink: webViewLink,
            thumbnailLink: serverThumbnail || fileServiceLogo,
            sizeBytes: sizeLabel,
            pickedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          // Save selected picked logs
          setPickedLogs(prev => [freshLog, ...prev]);

          // Workspace Logo Custom Action
          if (mode === "logo" && selectedSpace) {
            // Secure an update in parent state + cloud firestore space record
            try {
              // We'll fallback to drive thumbnail, google account asset link, or the direct view link
              const finalLogoUrl = serverThumbnail || webViewLink || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80";
              const spaceRef = doc(db, "spaces", selectedSpace.id);
              await updateDoc(spaceRef, { logoUrl: finalLogoUrl });
              
              onSpaceUpdate({
                ...selectedSpace,
                logoUrl: finalLogoUrl
              });

              const timestamp = freshLog.pickedTime;
              setSyncLogs(prev => [
                {
                  id: `logo-picked-${Date.now()}`,
                  timestamp,
                  integration: "Google Drive Sync",
                  message: `[GOOGLE PICKER] Selected asset "${fileName}" as the workspace business logo. Live avatar updated.`,
                  type: "success"
                },
                ...prev
              ]);
              setUpdateSuccessMsg(`Successfully updated Business Corporate Logo: "${fileName}"!`);
            } catch (err: any) {
              console.error("Failed to commit selected Google Drive Logo update to Firestore:", err);
            }
          } else if (mode === "inspect") {
            const timestamp = freshLog.pickedTime;
            setSyncLogs(prev => [
              {
                id: `inspect-picked-${Date.now()}`,
                timestamp,
                integration: "Google Drive Sync",
                message: `[GOOGLE PICKER] Selected "${fileName}" (${fileMime}) for system metadata analysis.`,
                type: "info"
              },
              ...prev
            ]);
          }
        }
        setPickerLoading(false);
      });

      const picker = pickerBuilder.build();
      picker.setVisible(true);

    } catch (e: any) {
      console.error("Error drawing Google Picker overlay Builder:", e);
      setPickerLoading(false);
    }
  };

  return (
    <div className="bento-card-glass rounded-3xl border border-slate-200/60 p-6 shadow-xs space-y-6">
      
      {/* Dynamic Module Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="flex gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shrink-0">
            <CloudLightning className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">Google Picker Hub</h3>
              <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                googleAccessToken 
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200/50" 
                  : "bg-slate-100 text-slate-400 border border-slate-205"
              }`}>
                {googleAccessToken ? "● Active Connected" : "○ Disconnected"}
              </span>
            </div>
            <p className="text-[11px] text-slate-450 font-semibold mt-1 font-sans">
              Load documents, spreadsheets, design files, or brand assets directly from Google Drive securely using Google Picker.
            </p>
          </div>
        </div>

        {/* Auth / Disconnect actions */}
        <div>
          {googleAccessToken ? (
            <button
              onClick={handleDisconnectGoogleDrive}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-102"
            >
              <Unlink className="w-3.5 h-3.5 text-rose-450" /> Revoke Drive Access
            </button>
          ) : (
            <button
              disabled={authChecking}
              onClick={handleConnectGoogleDrive}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md hover:scale-102"
            >
              {authChecking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Permission...
                </>
              ) : (
                <>
                  <Paperclip className="w-3.5 h-3.5 text-indigo-200" /> Connect Google Drive
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert Bar */}
      {updateSuccessMsg && (
        <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-3.5 rounded-2xl border border-emerald-200/70 shadow-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
          <span>{updateSuccessMsg}</span>
        </div>
      )}

      {/* Connection Auth Error Alert Bar */}
      {authError && (
        <div className="bg-red-50 text-red-900 text-xs font-bold p-5 rounded-2xl border border-red-200 shadow-md flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-red-750">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-black uppercase tracking-wider text-[10px]">Google Drive Auth Connection Alert</span>
          </div>
          <p className="font-semibold text-xs leading-relaxed text-red-800">
            {authError}
          </p>
          <div className="pt-1.5">
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-900 border border-red-350 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xs cursor-pointer select-none"
            >
              <ExternalLink className="w-3.5 h-3.5 text-red-700" /> Open App in standalone New Tab & Try
            </a>
          </div>
        </div>
      )}

      {/* Primary Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Core Settings triggers */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Operations Panel</h4>
          
          <div className="space-y-3.5">
            {/* Logo Select button */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3.5">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-indigo-500 font-bold uppercase tracking-wider">WORKSPACE CONFIGURATION</span>
                  <h5 className="text-xs font-black text-slate-900 leading-tight">Pick Workspace Corporate Logo</h5>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    Select any PNG/JPEG image directly from your drive files to update your corporate review platform avatar.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                  {selectedSpace?.logoUrl ? (
                    <img 
                      src={selectedSpace.logoUrl} 
                      alt="Space Logo" 
                      className="h-full w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Image className="w-5 h-5 text-slate-350" />
                  )}
                </div>

                <button
                  type="button"
                  disabled={!googleAccessToken || pickerLoading}
                  onClick={() => launchGooglePicker("logo")}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center border cursor-pointer ${
                    googleAccessToken 
                      ? "bg-white text-slate-800 border-slate-350 hover:bg-slate-50 active:scale-98" 
                      : "bg-slate-100 text-slate-400 border-transparent cursor-not-allowed"
                  }`}
                >
                  {pickerLoading ? "Reading drive API..." : "📂 Launch Picker Logo Selection"}
                </button>
              </div>
            </div>

            {/* Inspect Asset configuration details */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-emerald-600 font-bold uppercase tracking-wider">DIAGNOSTIC SYSTEM TOOLS</span>
                <h5 className="text-xs font-black text-slate-900 leading-tight">Inspect Any File Metadata</h5>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Browse, locate, and select any document file on Drive to analyze its payload, size, mime structure, and direct web paths live.
                </p>
              </div>

              <button
                type="button"
                disabled={!googleAccessToken}
                onClick={() => launchGooglePicker("inspect")}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center border cursor-pointer flex justify-center items-center gap-1.5 ${
                  googleAccessToken 
                    ? "bg-emerald-600 text-white border-transparent hover:bg-emerald-500 shadow-sm active:scale-98" 
                    : "bg-slate-100 text-slate-400 border-transparent cursor-not-allowed"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" /> General Asset Inspector
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Inspector console / Preview */}
        <div className="bg-slate-950 text-white rounded-3xl p-5 border border-slate-900 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <span className="text-[9px] font-black text-slate-500 font-mono flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Secure File Metadata Inspector
            </span>
            {selectedInspectFile && (
              <button 
                onClick={() => setSelectedInspectFile(null)}
                className="text-[8px] bg-slate-900 text-slate-400 hover:text-white px-2 py-0.5 rounded font-bold uppercase font-mono cursor-pointer border border-slate-800"
              >
                Reset Console
              </button>
            )}
          </div>

          <div className="flex-1 bg-black/45 rounded-2xl p-4 border border-slate-900/80 max-h-52 overflow-y-auto font-mono text-[10px] leading-relaxed text-left">
            {selectedInspectFile ? (
              <pre className="text-emerald-400 leading-normal scrollbar-thin whitespace-pre-wrap">
                {JSON.stringify(selectedInspectFile, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-8">
                <Database className="w-7 h-7 mb-2 text-slate-700" />
                <p className="font-sans font-bold text-[10px]">Ready for inspection payload...</p>
                <p className="font-sans text-[9px] mt-0.5 max-w-xs leading-normal">
                  Connect your credentials and pick any file to load Google Drive JSON responses.
                </p>
              </div>
            )}
          </div>

          {selectedInspectFile && (
            <div className="flex justify-between items-center bg-slate-900/40 border border-slate-800 p-2.5 rounded-xl">
              <div className="flex items-center gap-2">
                {selectedInspectFile.thumbnailLink && (
                  <img 
                    src={selectedInspectFile.thumbnailLink} 
                    alt="File Thumbnail" 
                    className="w-8 h-8 rounded border border-slate-700 object-cover shrink-0" 
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <p className="text-[10px] font-extrabold text-white truncate max-w-32">{selectedInspectFile.name}</p>
                  <p className="text-[8px] text-slate-500 font-mono mt-0.5 truncate max-w-32">{selectedInspectFile.mimeType}</p>
                </div>
              </div>
              
              {selectedInspectFile.webViewLink && (
                <a
                  href={selectedInspectFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                >
                  view on drive <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Selected Assets Ledger Row */}
      <div className="space-y-3.5">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Google Picker Transaction History</h4>
        
        {pickedLogs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-202 rounded-2xl text-[10px] font-semibold text-slate-400 bg-slate-50/50">
            No files have been selected during this browser session.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-150 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150">
                  <th className="p-3 text-[9px] font-black uppercase text-slate-450 tracking-wider">Asset Preview</th>
                  <th className="p-3 text-[9px] font-black uppercase text-slate-450 tracking-wider">File Name</th>
                  <th className="p-3 text-[9px] font-black uppercase text-slate-450 tracking-wider">Mime class</th>
                  <th className="p-3 text-[9px] font-black uppercase text-slate-450 tracking-wider">Size</th>
                  <th className="p-3 text-[9px] font-black uppercase text-slate-450 tracking-wider">Selected</th>
                  <th className="p-3 text-[9px] font-black uppercase text-slate-450 tracking-wider text-right">Drive link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-705">
                {pickedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="h-8 w-8 rounded bg-white border border-slate-205 flex items-center justify-center overflow-hidden shadow-2xs">
                        {log.thumbnailLink ? (
                          <img 
                            src={log.thumbnailLink} 
                            alt={log.name} 
                            className="h-full w-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-900 truncate max-w-40" title={log.name}>
                      {log.name}
                    </td>
                    <td className="p-3 font-mono text-[9px] text-slate-400 font-bold truncate max-w-32" title={log.mimeType}>
                      {log.mimeType.split(".").pop()}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-500 font-bold">
                      {log.sizeBytes}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-400 font-bold">
                      {log.pickedTime}
                    </td>
                    <td className="p-3 text-right">
                      <a
                        href={log.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 py-1.5 px-2.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg text-[9px] text-indigo-750 uppercase font-black tracking-wide transition-all cursor-pointer"
                      >
                        Launch File <ChevronRight className="w-3 h-3 text-indigo-650" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
