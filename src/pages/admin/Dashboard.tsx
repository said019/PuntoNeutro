import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Users, DollarSign, AlertCircle } from "lucide-react";

interface Stats {
  classesToday: number;
  activeMembers: number;
  monthlyRevenue: number;
  pendingAlerts: number;
  recentMemberships: { id: string; userName: string; planName: string; status: string; createdAt: string }[];
  pendingOrders: { id: string; userName: string; amount: number; status: string }[];
}

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
  });

  const { data: memberships } = useQuery<{ data: Stats["recentMemberships"] }>({
    queryKey: ["memberships-recent"],
    queryFn: async () => (await api.get("/memberships?limit=5")).data,
  });

  const { data: pendingOrders } = useQuery<{ data: Stats["pendingOrders"] }>({
    queryKey: ["orders-pending"],
    queryFn: async () => (await api.get("/orders/pending")).data,
  });

  const metric = (label: string, value: number | undefined, icon: React.ReactNode, prefix = "") => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold">
            {prefix}{value ?? 0}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AuthGuard requiredRoles={["admin", "instructor"]}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {metric("Clases de hoy", stats?.classesToday, <CalendarDays size={18} />)}
            {metric("Membresías activas", stats?.activeMembers, <Users size={18} />)}
            {metric("Ingresos del mes", stats?.monthlyRevenue, <DollarSign size={18} />, "$")}
            {metric("Alertas pendientes", stats?.pendingAlerts, <AlertCircle size={18} />)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent memberships */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas membresías</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading
                  ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                  : (memberships?.data ?? []).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{m.userName}</p>
                          <p className="text-muted-foreground text-xs">{m.planName}</p>
                        </div>
                        <Badge
                          variant={m.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {m.status}
                        </Badge>
                      </div>
                    ))}
                {(!memberships?.data || memberships.data.length === 0) && !isLoading && (
                  <p className="text-sm text-muted-foreground">Sin membresías recientes.</p>
                )}
              </CardContent>
            </Card>

            {/* Pending orders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Órdenes pendientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading
                  ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                  : (pendingOrders?.data ?? []).map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{o.userName}</p>
                          <p className="text-muted-foreground text-xs">${o.amount} MXN</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {o.status}
                        </Badge>
                      </div>
                    ))}
                {(!pendingOrders?.data || pendingOrders.data.length === 0) && !isLoading && (
                  <p className="text-sm text-muted-foreground">Sin órdenes pendientes.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default Dashboard;
