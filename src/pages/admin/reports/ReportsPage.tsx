import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const ReportsPage = () => {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["reports-overview"],
    queryFn: async () => (await api.get("/reports/overview")).data,
  });

  const { data: revenue } = useQuery({
    queryKey: ["reports-revenue"],
    queryFn: async () => (await api.get("/reports/revenue")).data,
  });

  const { data: classes } = useQuery({
    queryKey: ["reports-classes"],
    queryFn: async () => (await api.get("/reports/classes")).data,
  });

  const { data: retention } = useQuery({
    queryKey: ["reports-retention"],
    queryFn: async () => (await api.get("/reports/retention")).data,
  });

  const { data: instructors } = useQuery({
    queryKey: ["reports-instructors"],
    queryFn: async () => (await api.get("/reports/instructors")).data,
  });

  const o = overview?.data ?? overview ?? {};

  const metric = (label: string, value: string | number | undefined, suffix = "") => (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{value ?? "—"}{suffix}</p>}
      </CardContent>
    </Card>
  );

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Reportes</h1>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {metric("Miembros activos", o.activeMembers)}
            {metric("Ingresos del mes", o.monthlyRevenue ? `$${o.monthlyRevenue}` : undefined)}
            {metric("Reservas del mes", o.monthlyBookings)}
            {metric("Ocupación clases", o.classOccupancyRate, "%")}
            {metric("Nuevos miembros", o.newMembersThisMonth)}
            {metric("Churn rate", o.churnRate, "%")}
          </div>

          <Tabs defaultValue="revenue">
            <TabsList>
              <TabsTrigger value="revenue">Ingresos</TabsTrigger>
              <TabsTrigger value="classes">Clases</TabsTrigger>
              <TabsTrigger value="retention">Retención</TabsTrigger>
              <TabsTrigger value="instructors">Instructores</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Ingresos mensuales</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenue?.data ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="classes" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Clases por semana</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={classes?.data ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Retención de miembros</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={retention?.data ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="instructors" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Clases por instructor</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(instructors?.data ?? []).map((ins: any) => (
                      <div key={ins.id} className="flex items-center justify-between text-sm">
                        <span>{ins.name}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-40 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (ins.classCount / 30) * 100)}%` }} />
                          </div>
                          <span className="font-medium w-8 text-right">{ins.classCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ReportsPage;
