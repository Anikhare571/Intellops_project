"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && ['.csv','.xlsx','.xls'].some(ext => dropped.name.endsWith(ext))) {
      setFile(dropped);
      setStatus("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus("Uploading file...");

    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        if (data.status === "existing") {
          setStatus(`✓ File already analyzed — loading existing results...`);
        } else {
          setStatus(`✓ Saved ${data.total_tickets.toLocaleString()} tickets — opening dashboard...`);
        }

        // Instant redirect — no waiting
        setTimeout(() => {
          router.push(`/dashboard?upload_id=${data.upload_id}`);
        }, 1500);

      } else {
        const err = await response.json();
        setStatus(`✗ ${err.detail || "Upload failed"}`);
        setUploading(false);
      }
    } catch {
      setStatus("✗ Connection error. Is the backend running?");
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F8FAFC",
      display: "flex", flexDirection: "column",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: "#0F1117", padding: "16px 32px",
        display: "flex", alignItems: "center", gap: 12
      }}>
        <div style={{
          width: 36, height: 36, background: "rgba(255,255,255,0.1)",
          borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18
        }}></div>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>IntelliOps</div>
          <div style={{ color: "#93C5FD", fontSize: 11 }}>ITSM Intelligence Platform</div>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            marginLeft: "auto", background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)", color: "white",
            padding: "8px 16px", borderRadius: 6, cursor: "pointer",
            fontSize: 13, fontFamily: "inherit"
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Main */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 32
      }}>
        <div style={{ width: "100%", maxWidth: 600 }}>
          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, background: "#EFF6FF",
              borderRadius: 16, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 28, margin: "0 auto 16px"
            }}></div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              Upload ITSM Tickets
            </h1>
            <p style={{ color: "#6B7280", fontSize: 14 }}>
              Upload your incident or service request data for ML-powered analysis
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            padding: 32
          }}>
            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? "#2563EB" : file ? "#10B981" : "#D1D5DB"}`,
                borderRadius: 12, padding: "40px 24px",
                textAlign: "center", cursor: "pointer",
                background: dragOver ? "#EFF6FF" : file ? "#F0FDF4" : "#FAFAFA",
                transition: "all 0.2s", marginBottom: 24
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                {file ? "" : ""}
              </div>
              {file ? (
                <>
                  <p style={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}>{file.name}</p>
                  <p style={{ fontSize: 13, color: "#6B7280" }}>{formatSize(file.size)}</p>
                  <p style={{ fontSize: 12, color: "#10B981", marginTop: 8 }}>Click to change file</p>
                </>
              ) : (
                <>
                  <p style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Drop your file here or click to browse
                  </p>
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>CSV or Excel (.csv, .xlsx, .xls) — max 200MB</p>
                </>
              )}
            </div>

            {/* Info box */}
            <div style={{
              background: "#F0F9FF", border: "1px solid #BAE6FD",
              borderRadius: 10, padding: "12px 16px", marginBottom: 24
            }}>
              <p style={{ fontSize: 13, color: "#0369A1", fontWeight: 600, marginBottom: 4 }}>
                Instant Results
              </p>
              <p style={{ fontSize: 12, color: "#0284C7" }}>
                Dashboard opens immediately after upload. Advanced ML analysis (BERT clustering, XGBoost scoring) runs in the background and updates automatically.
              </p>
            </div>

            {/* Status */}
            {status && (
              <div style={{
                padding: "12px 16px", borderRadius: 8, marginBottom: 16,
                background: status.includes("✓") ? "#F0FDF4" : "#FEF2F2",
                border: `1px solid ${status.includes("✓") ? "#86EFAC" : "#FCA5A5"}`,
                color: status.includes("✓") ? "#15803D" : "#DC2626",
                fontSize: 13, fontWeight: 500
              }}>
                {status}
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{
                width: "100%", height: 48,
                background: !file || uploading ? "#93C5FD" : "#2563EB",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 600, cursor: !file || uploading ? "not-allowed" : "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8
              }}
            >
              {uploading ? (
                <>
                  <span style={{
                    width: 16, height: 16, border: "2px solid white",
                    borderTopColor: "transparent", borderRadius: "50%",
                    display: "inline-block", animation: "spin 0.8s linear infinite"
                  }} />
                  Uploading...
                </>
              ) : (
                "Upload & Analyze →"
              )}
            </button>
          </div>

          {/* Supported formats */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <p style={{ fontSize: 12, color: "#9CA3AF" }}>
              Supports ServiceNow, Jira, Remedy, and any standard ITSM exports
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}