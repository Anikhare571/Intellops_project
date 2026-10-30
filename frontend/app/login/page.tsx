"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/login`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        router.push("/dashboard");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Invalid credentials");
      }
    } catch {
      setError("Connection error. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'DM Sans',sans-serif", overflow:"hidden" }}>
      {/* Left Panel */}
      <div style={{
        width:"420px", flexShrink:0,
        background:"linear-gradient(135deg, #0F1117 0%, #1e3a5f 50%, #0F1117 100%)",
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding:"48px 40px", color:"white", position:"relative", overflow:"hidden"
      }}>
        {/* Grid background */}
        <div style={{
          position:"absolute", inset:0, opacity:0.05,
          backgroundImage:"linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize:"40px 40px"
        }} />
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative" }}>
          <div style={{ width:40, height:40, background:"rgba(255,255,255,0.1)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
            
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:700 }}>IntelliOps</div>
            <div style={{ fontSize:11, color:"#93C5FD" }}>Analytics Platform</div>
          </div>
        </div>
        {/* Content */}
        <div style={{ position:"relative" }}>
          <h2 style={{ fontSize:32, fontWeight:700, lineHeight:1.2, marginBottom:12 }}>
            Enterprise ITSM Analytics
          </h2>
          <p style={{ fontSize:14, color:"#BFDBFE", lineHeight:1.6, marginBottom:32 }}>
            ML-powered platform for service optimization and automation discovery
          </p>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", paddingTop:24, display:"flex", flexDirection:"column", gap:12 }}>
            {["Calibrated XGBoost automation classifier with SHAP explanations",
              "Sentence-embedding clustering of ticket descriptions",
              "Team-scoped data: every query is filtered to your team"
            ].map((text, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:6, height:6, background:"#60A5FA", borderRadius:"50%", marginTop:6, flexShrink:0 }} />
                <p style={{ fontSize:13, color:"#BFDBFE", margin:0 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", position:"relative" }}>© 2026 IntelliOps</div>
      </div>

      {/* Right Panel */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#F8FAFC" }}>
        <div style={{ width:"100%", maxWidth:400, padding:"0 40px" }}>
          <div style={{ marginBottom:32 }}>
            <h1 style={{ fontSize:28, fontWeight:700, color:"#111827", marginBottom:6 }}>Sign in</h1>
            <p style={{ fontSize:14, color:"#6B7280" }}>Access your analytics workspace</p>
          </div>

          <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div>
              <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                style={{
                  width:"100%", height:44, padding:"0 14px",
                  border:"1px solid #D1D5DB", borderRadius:8,
                  fontSize:14, color:"#111827", background:"white",
                  outline:"none", boxSizing:"border-box",
                  fontFamily:"inherit"
                }}
                onFocus={(e) => e.target.style.borderColor="#2563EB"}
                onBlur={(e) => e.target.style.borderColor="#D1D5DB"}
              />
            </div>

            <div>
              <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width:"100%", height:44, padding:"0 14px",
                  border:"1px solid #D1D5DB", borderRadius:8,
                  fontSize:14, color:"#111827", background:"white",
                  outline:"none", boxSizing:"border-box",
                  fontFamily:"inherit"
                }}
                onFocus={(e) => e.target.style.borderColor="#2563EB"}
                onBlur={(e) => e.target.style.borderColor="#D1D5DB"}
              />
            </div>

            {error && (
              <div style={{
                background:"#FEF2F2", border:"1px solid #FCA5A5",
                borderLeft:"4px solid #EF4444", borderRadius:6,
                padding:"10px 14px", fontSize:13, color:"#DC2626"
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                height:46, background: loading ? "#93C5FD" : "#2563EB",
                color:"white", border:"none", borderRadius:8,
                fontSize:14, fontWeight:600, cursor: loading ? "not-allowed" : "pointer",
                fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8
              }}
            >
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          <div style={{
            marginTop:24, padding:"12px 16px",
            background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8,
            textAlign:"center", fontSize:13, color:"#374151"
          }}>
            <strong>Demo:</strong> <code style={{ background:"white", padding:"2px 6px", borderRadius:4, color:"#2563EB" }}>test</code>
            {" / "}
            <code style={{ background:"white", padding:"2px 6px", borderRadius:4, color:"#2563EB" }}>test123</code>
          </div>
        </div>
      </div>
    </div>
  );
}