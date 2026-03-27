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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X } from "lucide-react";

const methodLabel: Record<string, string> = {
  cash: "Efectivo",
  efectivo: "Efectivo",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  card: "Tarjeta",
  tarjeta: "Tarjeta",
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

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

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.put(`/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", id] });
      toast({ title: "Perfil actualizado" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al guardar", variant: "destructive" }),
  });

  const u = user?.data ?? user;

  const startEditing = () => {
    setForm({
      displayName: u?.displayName ?? "",
      phone: u?.phone ?? "",
      dateOfBirth: u?.dateOfBirth ?? "",
      emergencyContactName: u?.emergencyContactName ?? "",
      emergencyContactPhone: u?.emergencyContactPhone ?? "",
      healthNotes: u?.healthNotes ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const paymentsArr = Array.isArray(payments?.data) ? payments.data : [];

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="admin-page max-w-5xl">
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
            </TabsList>

            {/* ── Perfil ── */}
            <TabsContent value="profile" className="mt-4">
              {isLoading ? <Skeleton className="h-40 w-full" /> : editing ? (
                <div className="space-y-4 max-w-lg">
                  <div className="space-y-1">
                    <Label>Nombre</Label>
                    <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha de nacimiento</Label>
                    <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Contacto de emergencia</Label>
                      <Input placeholder="Nombre" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Tel. emergencia</Label>
                      <Input placeholder="Teléfono" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Notas de salud</Label>
                    <Textarea rows={3} value={form.healthNotes} onChange={(e) => setForm({ ...form, healthNotes: e.target.value })} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                      <Save size={14} className="mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                      <X size={14} className="mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Nombre:</span> {u?.displayName ?? "—"}</div>
                    <div><span className="font-medium">Email:</span> {u?.email ?? "—"}</div>
                    <div><span className="font-medium">Teléfono:</span> {u?.phone ?? "—"}</div>
                    <div><span className="font-medium">Fecha de nacimiento:</span> {u?.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString("es-MX") : "—"}</div>
                    <div><span className="font-medium">Contacto de emergencia:</span> {u?.emergencyContactName ?? "—"} {u?.emergencyContactPhone ?? ""}</div>
                    <div className="col-span-2"><span className="font-medium">Notas de salud:</span> {u?.healthNotes ?? "—"}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil size={14} className="mr-1" /> Editar perfil
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ── Membresías ── */}
            <TabsContent value="memberships" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Estado</TableHead><TableHead>Vence</TableHead><TableHead>Clases</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(memberships?.data) ? memberships.data : []).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.planName ?? m.planId}</TableCell>
                      <TableCell><Badge>{m.status === "active" ? "Activa" : m.status === "expired" ? "Expirada" : m.status}</Badge></TableCell>
                      <TableCell>{m.endDate ? new Date(m.endDate).toLocaleDateString("es-MX") : "—"}</TableCell>
                      <TableCell>{m.classesRemaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ── Reservas ── */}
            <TabsContent value="bookings" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Clase</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(bookings?.data) ? bookings.data : []).map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.className ?? b.classId}</TableCell>
                      <TableCell>{b.startTime ? new Date(b.startTime).toLocaleString("es-MX", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{b.status === "confirmed" ? "Confirmada" : b.status === "cancelled" ? "Cancelada" : b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ── Pagos ── */}
            <TabsContent value="payments" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Monto</TableHead><TableHead>Método</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paymentsArr.map((p: any) => {
                    const date = p.createdAt || p.created_at;
                    const method = p.method || p.payment_method || "";
                    return (
                      <TableRow key={p.id}>
                        <TableCell>${parseFloat(p.total_amount ?? p.totalAmount ?? p.amount ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{methodLabel[method.toLowerCase()] ?? method}</TableCell>
                        <TableCell>{date ? new Date(date).toLocaleDateString("es-MX") : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ClientDetail;
