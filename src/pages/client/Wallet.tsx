import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Gift, QrCode, ExternalLink, Download, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import opheliaLogo from "@/assets/ophelia-logo-full.png";
import { useState } from "react";

const GoogleIcon = ({ color = "full" }: { color?: "full" | "gray" | "palette" }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 6.9c1.32 0 2.21.57 2.72 1.05l1.99-1.94C15.85 4.79 14.35 4 12.5 4c-3.07 0-5.64 2.05-6.52 4.82l2.32 1.8C9.03 8.57 10.6 6.9 12.5 6.9z" fill={color === "full" ? "#EA4335" : color === "palette" ? "#E7EB6E" : "#888"} />
    <path d="M18.77 12.16c0-.53-.08-1.04-.2-1.52H12.5v2.87h3.52c-.15.8-.61 1.48-1.3 1.94l2.01 1.56c1.2-1.1 1.88-2.73 1.88-4.85h.16z" fill={color === "full" ? "#4285F4" : color === "palette" ? "#E7EB6E" : "#888"} />
    <path d="M8.3 13.38A4.6 4.6 0 018.06 12c0-.48.09-.94.24-1.38l-2.32-1.8A7.52 7.52 0 005 12c0 1.2.29 2.34.8 3.34l2.5-1.96z" fill={color === "full" ? "#FBBC05" : color === "palette" ? "#E7EB6E" : "#888"} />
    <path d="M12.5 20c1.84 0 3.38-.61 4.51-1.65l-2.01-1.56c-.63.4-1.43.64-2.5.64-1.9 0-3.47-1.27-4.06-3h-2.5l-.03.1A7.99 7.99 0 0012.5 20z" fill={color === "full" ? "#34A853" : color === "palette" ? "#E7EB6E" : "#888"} />
  </svg>
);

const AppleIcon = ({ color = "white" }: { color?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill={color}/>
  </svg>
);

const Wallet = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [appleLoading, setAppleLoading] = useState(false);
  const [gwRetrying, setGwRetrying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet-pass"],
    queryFn: async () => (await api.get("/wallet/pass")).data,
  });
  const wallet = data?.data ?? data ?? null;

  // Google Wallet save URL
  const { data: gwData, isLoading: gwLoading, error: gwError } = useQuery({
    queryKey: ["google-wallet-save"],
    queryFn: async () => {
      const resp = await api.get("/wallet/google/save-url");
      return resp.data?.data ?? resp.data ?? null;
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
  });

  const googleSaveUrl = gwData?.saveUrl || null;

  const handleGoogleRetry = async () => {
    setGwRetrying(true);
    try {
      await qc.invalidateQueries({ queryKey: ["google-wallet-save"] });
    } finally {
      setTimeout(() => setGwRetrying(false), 1500);
    }
  };

  const handleAppleWalletDownload = async () => {
    setAppleLoading(true);
    try {
      const resp = await api.get("/wallet/apple/pkpass", { responseType: "blob" });
      const contentType = resp.headers?.["content-type"] || "";

      if (contentType.includes("application/vnd.apple.pkpass")) {
        // Real .pkpass file — download it
        const blob = new Blob([resp.data], { type: "application/vnd.apple.pkpass" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ophelia-pass.pkpass";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        // Small delay before cleanup to ensure download starts
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 500);
        toast({ title: "¡Pase descargado!", description: "Ábrelo para agregarlo a Apple Wallet." });
      } else if (contentType.includes("text/html")) {
        // Server returned a full HTML web pass
        const htmlText = await resp.data.text();
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlText);
          newWindow.document.close();
          toast({
            title: "¡Pase Web abierto!",
            description: "Se abrió tu pase digital. Puedes guardarlo desde el menú de tu navegador.",
          });
        } else {
          toast({
            title: "Ventana bloqueada",
            description: "Permite las ventanas emergentes e intenta de nuevo.",
            variant: "destructive",
          });
        }
      } else if (contentType.includes("application/json")) {
        // Server returned a JSON error — try to parse it from blob
        const text = await resp.data.text();
        try {
          const json = JSON.parse(text);
          console.error("Apple Wallet server error:", json);
          if (json.fallback === "webpass") {
            // Retry requesting the web pass HTML directly
            toast({
              title: "Certificados no válidos",
              description: "Se abrirá tu pase digital web como alternativa.",
            });
            // Fallback: open webpass version
            openWebPass();
          } else {
            toast({
              title: "Error",
              description: json.message || "No se pudo generar el pase.",
              variant: "destructive",
            });
          }
        } catch {
          toast({ title: "Error", description: "Respuesta inesperada del servidor.", variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: "No se pudo generar el pase. Intenta de nuevo.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Apple Wallet error:", err);
      // If 500 response with JSON body (axios wraps blob errors)
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          console.error("Apple Wallet server error detail:", json);
          if (json.fallback === "webpass") {
            toast({
              title: "Pase .pkpass no disponible",
              description: "Se abrirá tu pase digital web.",
            });
            openWebPass();
            return;
          }
        } catch {
          // ignore parse error
        }
      }
      toast({
        title: "Error",
        description: "No se pudo descargar el pase. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setAppleLoading(false);
    }
  };

  /** Open the web pass fallback in a new window */
  const openWebPass = async () => {
    try {
      // Request web pass HTML — server returns it when certs are not configured
      // We force this by going through the status endpoint to know, then open the pass page
      const walletData = wallet;
      if (!walletData) return;

      const userName = walletData.display_name || walletData.email || "Miembro";
      const points = walletData.points ?? 0;
      const qrCode = walletData.qr_code || "";

      // Build a local web pass
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Ophelia Club</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.pass{width:100%;max-width:380px;border-radius:24px;overflow:hidden;background:linear-gradient(160deg,#1a0b26 0%,#2d0a40 50%,#1a0b26 100%);box-shadow:0 20px 60px rgba(225,92,184,.2)}
.header{padding:24px 24px 16px;display:flex;align-items:center;justify-content:space-between}
.logo{font-size:18px;font-weight:800;background:linear-gradient(135deg,#E15CB8,#CA71E1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.badge{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:rgba(202,113,225,.7);border:1px solid rgba(202,113,225,.3);padding:4px 10px;border-radius:20px}
.name{text-align:center;font-size:16px;font-weight:700;padding:0 24px 4px}
.points-section{text-align:center;padding:8px 24px 24px}
.points{font-size:72px;font-weight:900;background:linear-gradient(135deg,#E15CB8,#CA71E1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
.points-label{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#CA71E1;margin-bottom:4px}
.qr-section{display:flex;justify-content:center;padding:0 24px 24px}
.qr-wrap{background:#fff;border-radius:20px;padding:16px}
.qr-wrap img{width:160px;height:160px;display:block}
.qr-hint{text-align:center;font-size:11px;color:rgba(255,255,255,.35);padding:0 24px 20px}
.footer{text-align:center;padding:0 24px 24px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:12px 20px;border-radius:14px;border:none;font-size:13px;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#E15CB8,#CA71E1);color:#fff}
</style>
</head>
<body>
<div class="pass">
<div class="header"><div class="logo">Ophelia Studio</div><div class="badge">Club</div></div>
<div class="name">${userName}</div>
<div class="points-section">
<div class="points-label">Puntos acumulados</div>
<div class="points">${points}</div>
</div>
<div class="qr-section"><div class="qr-wrap"><img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCode)}&bgcolor=FFFFFF&color=1a0b26" alt="QR" /></div></div>
<div class="qr-hint">Tu código de acceso Ophelia</div>
<div class="footer"><button class="btn" onclick="window.print()">Imprimir pase</button></div>
</div>
</body>
</html>`;
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } catch (e) {
      console.error("Web pass error:", e);
    }
  };

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-xl font-bold">Club / Wallet</h1>

          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-3xl" />
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-[#CA71E1]/30 bg-gradient-to-b from-[#1a0b26] to-[#0a0a0a] shadow-2xl shadow-[#E15CB8]/10 group">
              {/* Decorative background glows */}
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-[#E15CB8] opacity-10 blur-[80px]" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[#CA71E1] opacity-10 blur-[80px]" />

              <div className="relative p-8 flex flex-col items-center text-center space-y-6">
                {/* Logo */}
                <img src={opheliaLogo} alt="Ophelia Studio" className="h-10 w-auto opacity-90" />

                {/* Points */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#CA71E1]">Ophelia Club</p>
                  <p className="text-6xl font-black bg-gradient-to-r from-[#E15CB8] to-[#CA71E1] text-transparent bg-clip-text drop-shadow-sm">
                    {wallet?.points ?? 0}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">Puntos acumulados</p>
                </div>

                {/* QR Code section */}
                {wallet?.qr_code && (
                  <div className="relative w-full max-w-[200px] aspect-square mx-auto mt-4 p-4 rounded-3xl bg-white shadow-xl flex items-center justify-center ring-4 ring-white/10 group-hover:ring-[#CA71E1]/30 transition-all duration-500">
                    <QRCodeSVG value={wallet.qr_code} size={150} className="w-full h-full" />
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full border-2 border-[#1a0b26] bg-[#E15CB8] flex items-center justify-center shadow-lg">
                      <QrCode size={16} className="text-white" />
                    </div>
                  </div>
                )}
                <p className="text-xs text-white/40 max-w-[200px] mx-auto leading-relaxed">
                  Presenta este código QR al ingresar
                </p>
              </div>
            </div>
          )}

          {/* ── Add to Wallet buttons ─────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">
              Agregar a tu teléfono
            </p>
            <div className="flex flex-col gap-2.5">
              {/* Google Wallet */}
              {gwLoading || gwRetrying ? (
                <div className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/10 animate-pulse">
                  <GoogleIcon />
                  <span className="text-white/50 font-medium text-sm">Cargando Google Wallet…</span>
                </div>
              ) : googleSaveUrl ? (
                <a
                  href={googleSaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/15 hover:border-white/30 transition-all shadow-md"
                >
                  <GoogleIcon color="palette" />
                  <span className="text-white font-semibold text-sm">Agregar a Google Wallet</span>
                  <ExternalLink size={14} className="text-[#E7EB6E]/70" />
                </a>
              ) : (
                <button
                  onClick={handleGoogleRetry}
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                >
                  <GoogleIcon color="palette" />
                  <span className="text-white/70 font-medium text-sm">Reintentar Google Wallet</span>
                  <RefreshCw size={13} className="text-[#E7EB6E]/65" />
                </button>
              )}

              {/* Apple Wallet */}
              <button
                onClick={handleAppleWalletDownload}
                disabled={appleLoading}
                className={cn(
                  "flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/15 hover:border-white/30 transition-all shadow-md",
                  appleLoading && "opacity-60 cursor-wait"
                )}
              >
                <AppleIcon color="#E7EB6E" />
                <span className="text-white font-semibold text-sm">
                  {appleLoading ? "Preparando pase…" : "Agregar a Apple Wallet"}
                </span>
                {!appleLoading && <Download size={14} className="text-[#E7EB6E]/70" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Link
              to="/app/wallet/history"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-sm font-medium text-white transition-all"
            >
              <History size={16} className="text-[#CA71E1]" />
              Historial
            </Link>
            <Link
              to="/app/wallet/rewards"
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#E15CB8] to-[#CA71E1] shadow-lg shadow-[#E15CB8]/20 hover:opacity-90 text-sm font-bold text-white transition-all"
            >
              <div className="flex items-center gap-1.5">
                <Gift size={16} />
                <span>Canjear</span>
              </div>
              <span className="text-[10px] font-medium text-white/80">premios con puntos</span>
            </Link>
          </div>
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Wallet;
