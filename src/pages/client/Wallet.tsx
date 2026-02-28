import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Gift, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import opheliaLogo from "@/assets/ophelia-logo-full.png";

const Wallet = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-pass"],
    queryFn: async () => (await api.get("/wallet/pass")).data,
  });
  const wallet = data?.data ?? data ?? null;

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

                {/* Points & Level */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#CA71E1]">Ophelia Club</p>
                  <p className="text-6xl font-black bg-gradient-to-r from-[#E15CB8] to-[#CA71E1] text-transparent bg-clip-text drop-shadow-sm">
                    {wallet?.points ?? 0}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">Puntos acumulados</p>
                </div>

                {wallet?.level && (
                  <div className="px-5 py-1.5 rounded-full border border-[#E7EB6E]/30 bg-[#E7EB6E]/10 text-[#E7EB6E] text-sm font-bold tracking-wide">
                    Nivel {wallet.level}
                  </div>
                )}

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
