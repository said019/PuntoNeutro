import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Gift } from "lucide-react";

const Wallet = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-pass"],
    queryFn: async () => (await api.get("/wallet/pass")).data,
  });
  const wallet = data?.data ?? data ?? null;

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="max-w-md space-y-6">
          <h1 className="text-xl font-bold">Club / Wallet</h1>
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-medium">Puntos acumulados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-6xl font-bold">{wallet?.points ?? 0}</p>
                {wallet?.level && (
                  <p className="text-sm font-medium text-primary">{wallet.level}</p>
                )}
                {wallet?.qr_code && (
                  <div className="flex justify-center">
                    <img src={wallet.qr_code} alt="QR check-in" className="h-40 w-40 rounded-xl border" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Muestra este QR al instructor para hacer check-in</p>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/app/wallet/history"><History size={16} className="mr-2" />Historial</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/app/wallet/rewards"><Gift size={16} className="mr-2" />Canjear</Link>
            </Button>
          </div>
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Wallet;
