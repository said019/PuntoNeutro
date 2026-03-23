import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, Receipt, Users } from "lucide-react";

const ReportsPage = () => {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["reports-overview"],
    queryFn: async () => (await api.get("/reports/overview")).data,
  });

  const { data: revenue } = useQuery({
    queryKey: ["reports-revenue"],
    queryFn: async () => (await api.get("/reports/revenue")).data,
  });

  const o = overview?.data ?? overview ?? {};

  const safeArray = (v: any) => (Array.isArray(v) ? v : []);
  const fmtMonth = (raw: any) => {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" }).format(d);
  };

  const revenueRows = safeArray(revenue?.data ?? revenue);
  const revenueDataRaw = revenueRows.map((row: any) => ({
    month: fmtMonth(row.month),
    amount: Number(row.amount ?? row.total ?? 0),
    count: Number(row.count ?? 0),
  })).reverse();
  const revenueData = revenueDataRaw.length
    ? revenueDataRaw
    : Array.from({ length: 6 }).map((_, idx) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - idx));
        return { month: fmtMonth(d), amount: 0, count: 0 };
      });

  // Calculate totals from chart data
  const totalRevenue = revenueData.reduce((sum, r) => sum + r.amount, 0);
  const totalOrders = revenueData.reduce((sum, r) => sum + r.count, 0);
  const currentMonth = revenueData[revenueData.length - 1];
  const prevMonth = revenueData.length >= 2 ? revenueData[revenueData.length - 2] : null;
  const growth = prevMonth && prevMonth.amount > 0
    ? (((currentMonth.amount - prevMonth.amount) / prevMonth.amount) * 100).toFixed(1)
    : null;

  const metric = (
    label: string,
    value: string | number | undefined,
    icon: React.ReactNode,
    accent: string,
    subtitle?: string,
  ) => (
    <Card className="border-t-2" style={{ borderTopColor: accent }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span style={{ color: accent }}>{icon}</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-2xl font-bold text-[#2d2d2d]">{value ?? "—"}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-[#94867a]/20 bg-white px-4 py-3 shadow-lg">
        <p className="text-xs font-semibold text-[#2d2d2d]/60 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-sm font-bold text-[#2d2d2d]">{formatCurrency(payload[0].value)}</p>
        {payload[0]?.payload?.count > 0 && (
          <p className="text-xs text-[#2d2d2d]/50 mt-0.5">{payload[0].payload.count} orden{payload[0].payload.count !== 1 ? "es" : ""}</p>
        )}
      </div>
    );
  };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="admin-page max-w-6xl">
          <h1 className="text-2xl font-bold mb-6">Reportes</h1>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {metric(
              "Ingresos del mes",
              o.monthlyRevenue ? formatCurrency(Number(o.monthlyRevenue)) : "$0.00",
              <DollarSign size={18} />,
              "#b5bf9c",
              growth ? `${Number(growth) >= 0 ? "+" : ""}${growth}% vs mes anterior` : undefined,
            )}
            {metric(
              "Ingresos totales (12m)",
              formatCurrency(totalRevenue),
              <TrendingUp size={18} />,
              "#94867a",
              "Últimos 12 meses",
            )}
            {metric(
              "Órdenes aprobadas",
              totalOrders,
              <Receipt size={18} />,
              "#C4A882",
              "Últimos 12 meses",
            )}
            {metric(
              "Miembros activos",
              o.activeMembers ?? 0,
              <Users size={18} />,
              "#6366F1",
            )}
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={revenueData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#94867a20" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#2d2d2d", fontSize: 12 }}
                    axisLine={{ stroke: "#94867a30" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#2d2d2d99", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? "k" : ""}`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#94867a10" }} />
                  <Bar
                    dataKey="amount"
                    fill="#b5bf9c"
                    radius={[6, 6, 0, 0]}
                    name="Ingresos"
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ReportsPage;
