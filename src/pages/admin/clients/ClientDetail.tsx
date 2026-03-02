import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adjPoints, setAdjPoints] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await api.get(`/users/${id}`)).data,
    enabled: !!id,
  });

  const { data: bookings } = useQuery({
    queryKey: ["client-bookings", id],
    queryFn: async () => (await api.get(`/bookings?userId=${id}`)).data,
    enabled: !!id,
  });

  const { data: memberships } = useQuery({
    queryKey: ["client-memberships", id],
    queryFn: async () => (await api.get(`/memberships?userId=${id}`)).data,
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => (await api.get(`/payments?userId=${id}`)).data,
    enabled: !!id,
  });

  const { data: loyalty, refetch: refetchLoyalty } = useQuery({
    queryKey: ["client-loyalty", id],
    queryFn: async () => (await api.get(`/loyalty/points/${id}`)).data,
    enabled: !!id,
  });

  const adjustMutation = useMutation({
    mutationFn: ({ points, reason, type }: { points: number; reason: string; type: "earn" | "redeem" }) =>
      api.post("/admin/loyalty/adjust", { userId: id, points, reason, type }),
    onSuccess: () => {
      refetchLoyalty();
      qc.invalidateQueries({ queryKey: ["client-loyalty", id] });
      toast({ title: "✅ Puntos ajustados" });
      setAdjPoints("");
      setAdjReason("");
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al ajustar puntos", variant: "destructive" }),
  });

  const recalcMutation = useMutation({
    mutationFn: () => api.post(`/admin/loyalty/recalculate/${id}`),
    onSuccess: (res: any) => {
      refetchLoyalty();
      qc.invalidateQueries({ queryKey: ["client-loyalty", id] });
      const msg = res?.data?.data?.message ?? "Recalculado";
      toast({ title: `✅ ${msg}` });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al recalcular", variant: "destructive" }),
  });

  const u = user?.data ?? user;

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          {isLoading ? (
            <Skeleton className="h-10 w-60 mb-4" />
          ) : (
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{u?.displayName}</h1>
              <p className="text-muted-foreground text-sm">{u?.email} · {u?.phone}</p>
            </div>
          )}

          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="memberships">Membresías</TabsTrigger>
              <TabsTrigger value="bookings">Reservas</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="loyalty">Lealtad</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4">
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Fecha de nacimiento:</span> {u?.dateOfBirth ?? "—"}</div>
                  <div><span className="font-medium">Emergencia:</span> {u?.emergencyContactName ?? "—"} {u?.emergencyContactPhone ?? ""}</div>
                  <div className="col-span-2"><span className="font-medium">Notas de salud:</span> {u?.healthNotes ?? "—"}</div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="memberships" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Estado</TableHead><TableHead>Vence</TableHead><TableHead>Clases</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(memberships?.data) ? memberships.data : []).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.planName ?? m.planId}</TableCell>
                      <TableCell><Badge>{m.status}</Badge></TableCell>
                      <TableCell>{m.endDate ? new Date(m.endDate).toLocaleDateString("es-MX") : "—"}</TableCell>
                      <TableCell>{m.classesRemaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Clase</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(bookings?.data) ? bookings.data : []).map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.className ?? b.classId}</TableCell>
                      <TableCell>{b.startTime ? new Date(b.startTime).toLocaleString("es-MX", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Monto</TableHead><TableHead>Método</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(payments?.data) ? payments.data : []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>${p.total_amount ?? p.amount}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-MX") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="loyalty" className="mt-4 space-y-6">
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-4xl font-bold">{(loyalty as any)?.data?.balance ?? (loyalty as any)?.balance ?? (loyalty as any)?.points ?? 0}</div>
                  <p className="text-muted-foreground text-sm">puntos acumulados</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recalcMutation.isPending}
                  onClick={() => recalcMutation.mutate()}
                >
                  {recalcMutation.isPending ? "Recalculando…" : "🔄 Recalcular desde membresías"}
                </Button>
              </div>
              <div className="rounded-xl border p-4 space-y-3 max-w-sm">
                <p className="text-sm font-semibold">Ajustar puntos manualmente</p>
                <div className="space-y-1">
                  <Label>Puntos (número positivo)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ej: 150"
                    value={adjPoints}
                    onChange={(e) => setAdjPoints(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Motivo</Label>
                  <Input
                    placeholder="Ej: Membresía no contabilizada"
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={!adjPoints || adjustMutation.isPending}
                    onClick={() => adjustMutation.mutate({ points: Math.abs(Number(adjPoints)), reason: adjReason || "Ajuste manual", type: "earn" })}
                  >
                    + Agregar puntos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!adjPoints || adjustMutation.isPending}
                    onClick={() => adjustMutation.mutate({ points: Math.abs(Number(adjPoints)), reason: adjReason || "Ajuste manual", type: "redeem" })}
                  >
                    − Deducir puntos
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ClientDetail;
