"use client";

import { useState, useEffect } from "react";
import XGBoostXRay from "../components/XGBoostXRay";

interface XGBoostDrillDownProps {
  uploadId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function XGBoostDrillDown({ uploadId, isOpen, onClose }: XGBoostDrillDownProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Slide-over Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "85vw",
          maxWidth: 1400,
          height: "100vh",
          zIndex: 50,
          background: "#0f172a",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.3)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid #1e293b",
            background: "#0f172a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, #f59e0b, #ea580c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>
                XGBoost X-Ray
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                Model explainability • SHAP • What-If simulator
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => {
                window.open(`/dashboard/xgboost-xray?upload_id=${uploadId}`, "_blank");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "white",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Open in Tab
            </button>
            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#94a3b8",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <XGBoostXRay uploadId={uploadId} />
        </div>
      </div>
    </>
  );
}