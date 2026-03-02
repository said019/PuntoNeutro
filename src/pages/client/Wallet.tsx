import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Gift, QrCode, Smartphone, ExternalLink, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import opheliaLogo from "@/assets/ophelia-logo-full.png";
import { useState } from "react";

const Wallet = () => {
  const { toast } = useToast();
  const [appleLoading, setAppleLoading] = useState(false);

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
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const googleSaveUrl = gwData?.saveUrl || null;

  // Apple Wallet status
  const { data: appleStatus } = useQuery({
    queryKey: ["apple-wallet-status"],
    queryFn: async () => {
      const resp = await api.get("/wallet/apple/status");
      return resp.data;
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const appleConfigured = appleStatus?.configured ?? false;

  const handleAppleWalletDownload = async () => {
    setAppleLoading(true);
    try {
      const resp = await api.get("/wallet/apple/pkpass", { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/vnd.apple.pkpass" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ophelia-pass.pkpass";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "¡Pase descargado!", description: "Ábrelo para agregarlo a Apple Wallet." });
    } catch (err: any) {
      const msg = err?.response?.status === 503
        ? "Apple Wallet aún no está configurado. Contacta al administrador."
        : "Error al descargar el pase. Intenta de nuevo.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAppleLoading(false);
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
                  Muestra este código QR en recepción al llegar al estudio
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
              {gwLoading ? (
                <div className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/10 animate-pulse">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 6.9c1.32 0 2.21.57 2.72 1.05l1.99-1.94C15.85 4.79 14.35 4 12.5 4c-3.07 0-5.64 2.05-6.52 4.82l2.32 1.8C9.03 8.57 10.6 6.9 12.5 6.9z" fill="#EA4335"/>
                    <path d="M18.77 12.16c0-.53-.08-1.04-.2-1.52H12.5v2.87h3.52c-.15.8-.61 1.48-1.3 1.94l2.01 1.56c1.2-1.1 1.88-2.73 1.88-4.85h.16z" fill="#4285F4"/>
                    <path d="M8.3 13.38A4.6 4.6 0 018.06 12c0-.48.09-.94.24-1.38l-2.32-1.8A7.52 7.52 0 005 12c0 1.2.29 2.34.8 3.34l2.5-1.96z" fill="#FBBC05"/>
                    <path d="M12.5 20c1.84 0 3.38-.61 4.51-1.65l-2.01-1.56c-.63.4-1.43.64-2.5.64-1.9 0-3.47-1.27-4.06-3h-2.5l-.03.1A7.99 7.99 0 0012.5 20z" fill="#34A853"/>
                  </svg>
                  <span className="text-white/50 font-medium text-sm">Cargando Google Wallet…</span>
                </div>
              ) : googleSaveUrl ? (
                <a
                  href={googleSaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/15 hover:border-white/30 transition-all shadow-md"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 6.9c1.32 0 2.21.57 2.72 1.05l1.99-1.94C15.85 4.79 14.35 4 12.5 4c-3.07 0-5.64 2.05-6.52 4.82l2.32 1.8C9.03 8.57 10.6 6.9 12.5 6.9z" fill="#EA4335"/>
                    <path d="M18.77 12.16c0-.53-.08-1.04-.2-1.52H12.5v2.87h3.52c-.15.8-.61 1.48-1.3 1.94l2.01 1.56c1.2-1.1 1.88-2.73 1.88-4.85h.16z" fill="#4285F4"/>
                    <path d="M8.3 13.38A4.6 4.6 0 018.06 12c0-.48.09-.94.24-1.38l-2.32-1.8A7.52 7.52 0 005 12c0 1.2.29 2.34.8 3.34l2.5-1.96z" fill="#FBBC05"/>
                    <path d="M12.5 20c1.84 0 3.38-.61 4.51-1.65l-2.01-1.56c-.63.4-1.43.64-2.5.64-1.9 0-3.47-1.27-4.06-3h-2.5l-.03.1A7.99 7.99 0 0012.5 20z" fill="#34A853"/>
                  </svg>
                  <span className="text-white font-semibold text-sm">Agregar a Google Wallet</span>
                  <ExternalLink size={14} className="text-white/50" />
                </a>
              ) : (
                <button
                  onClick={() => toast({ title: "Error", description: "No se pudo generar el pase. Intenta de nuevo.", variant: "destructive" })}
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 6.9c1.32 0 2.21.57 2.72 1.05l1.99-1.94C15.85 4.79 14.35 4 12.5 4c-3.07 0-5.64 2.05-6.52 4.82l2.32 1.8C9.03 8.57 10.6 6.9 12.5 6.9z" fill="#EA4335"/>
                    <path d="M18.77 12.16c0-.53-.08-1.04-.2-1.52H12.5v2.87h3.52c-.15.8-.61 1.48-1.3 1.94l2.01 1.56c1.2-1.1 1.88-2.73 1.88-4.85h.16z" fill="#4285F4"/>
                    <path d="M8.3 13.38A4.6 4.6 0 018.06 12c0-.48.09-.94.24-1.38l-2.32-1.8A7.52 7.52 0 005 12c0 1.2.29 2.34.8 3.34l2.5-1.96z" fill="#FBBC05"/>
                    <path d="M12.5 20c1.84 0 3.38-.61 4.51-1.65l-2.01-1.56c-.63.4-1.43.64-2.5.64-1.9 0-3.47-1.27-4.06-3h-2.5l-.03.1A7.99 7.99 0 0012.5 20z" fill="#34A853"/>
                  </svg>
                  <span className="text-white/70 font-medium text-sm">Reintentar Google Wallet</span>
                </button>
              )}

              {/* Apple Wallet */}
              {appleConfigured ? (
                <button
                  onClick={handleAppleWalletDownload}
                  disabled={appleLoading}
                  className={cn(
                    "flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/15 hover:border-white/30 transition-all shadow-md",
                    appleLoading && "opacity-60 cursor-wait"
                  )}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="white"/>
                  </svg>
                  <span className="text-white font-semibold text-sm">
                    {appleLoading ? "Descargando…" : "Agregar a Apple Wallet"}
                  </span>
                  {!appleLoading && <Download size={14} className="text-white/50" />}
                </button>
              ) : (
                <button
                  onClick={() => toast({ title: "No disponible", description: "Apple Wallet se está configurando. Pronto estará listo.", variant: "destructive" })}
                  className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-black border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#888"/>
                  </svg>
                  <span className="text-white/70 font-medium text-sm">Apple Wallet — configurando</span>
                </button>
              )}
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
