import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DollarSign, TrendingUp, Receipt, Users, ArrowRight } from "lucide-react";

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
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const fmtMonthLabel = (raw: any) => {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    const isCurrentYear = d.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat("es-MX", {
      month: "long",
      ...(isCurrentYear ? {} : { year: "numeric" }),
    }).format(d);
  };
  const fmtMonthKey = (raw: any) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const revenueRows = safeArray(revenue?.data ?? revenue);
  const revenueDataRaw = revenueRows.map((row: any) => ({
    month: fmtMonthLabel(row.month),
    monthKey: fmtMonthKey(row.month),
    rawMonth: row.month,
    amount: Number(row.amount ?? row.total ?? 0),
    count: Number(row.count ?? 0),
    isCurrent: fmtMonthKey(row.month) === currentMonthKey,
  })).reverse();
  const revenueData = revenueDataRaw.length
    ? revenueDataRaw
    : Array.from({ length: 6 }).map((_, idx) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - idx));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { month: fmtMonthLabel(d), monthKey: key, rawMonth: d.toISOString(), amount: 0, count: 0, isCurrent: key === currentMonthKey };
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
      <div className="rounded-xl border border-[#94867a]/20 bg-white px-4 py-3 shadow-lg capitalize">
        <p className="text-xs font-semibold text-[#2d2d2d]/60 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-sm font-bold text-[#2d2d2d]">{formatCurrency(payload[0].value)}</p>
        {payload[0]?.payload?.count > 0 && (
          <p className="text-xs text-[#2d2d2d]/50 mt-0.5">{payload[0].payload.count} orden{payload[0].payload.count !== 1 ? "es" : ""}</p>
        )}
      </div>
    );
  };

  const todayLabel = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(now);

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="admin-page max-w-6xl">
          {/* Header with current date */}
          <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold text-[#2d2d2d]">Reportes</h1>
              <p className="text-xs text-[#2d2d2d]/45 mt-0.5 capitalize">{todayLabel}</p>
            </div>
            <Link
              to="/admin/payments?tab=history"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94867a] hover:text-[#2d2d2d] transition-colors px-3 py-1.5 rounded-lg border border-[#94867a]/20 bg-[#94867a]/[0.04] hover:bg-[#94867a]/10"
            >
              Ver historial de pagos <ArrowRight size={12} />
            </Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {metric(
              `Ingresos de ${new Intl.DateTimeFormat("es-MX", { month: "long" }).format(now)}`,
              o.monthlyRevenue ? formatCurrency(Number(o.monthlyRevenue)) : "$0.00",
              <DollarSign size={18} />,
              "#b5bf9c",
              growth ? `${Number(growth) >= 0 ? "+" : ""}${growth}% vs mes anterior` : "Mes en curso",
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
              <p className="text-xs text-[#2d2d2d]/45 mt-0.5">El mes actual aparece resaltado en verde oliva</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={revenueData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#94867a20" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#2d2d2d", fontSize: 11 }}
                    tickFormatter={(v) => String(v).charAt(0).toUpperCase() + String(v).slice(1)}
                    axisLine={{ stroke: "#94867a30" }}
                    tickLine={false}
                    interval={0}
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
                    radius={[6, 6, 0, 0]}
                    name="Ingresos"
                    maxBarSize={48}
                  >
                    {revenueData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.isCurrent ? "#6b7a52" : "#b5bf9c"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Detailed month table below chart */}
              <div className="mt-6 border-t border-[#94867a]/15 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2d2d2d]/45 mb-2 px-1">Desglose mensual</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {[...revenueData].reverse().map((row: any) => (
                    <div
                      key={row.monthKey}
                      className={`rounded-lg border p-2.5 ${row.isCurrent
                        ? "border-[#6b7a52]/40 bg-[#b5bf9c]/15"
                        : "border-[#94867a]/15 bg-[#94867a]/[0.04]"
                        }`}
                    >
                      <p className={`text-[10px] font-semibold uppercase tracking-wide capitalize ${row.isCurrent ? "text-[#4a5638]" : "text-[#2d2d2d]/55"
                        }`}>
                        {row.month}{row.isCurrent && " · actual"}
                      </p>
                      <p className={`text-sm font-bold mt-0.5 ${row.isCurrent ? "text-[#4a5638]" : "text-[#2d2d2d]/85"}`}>
                        {formatCurrency(row.amount)}
                      </p>
                      <p className="text-[10px] text-[#2d2d2d]/40 mt-0.5">
                        {row.count} {row.count === 1 ? "orden" : "órdenes"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ReportsPage;
