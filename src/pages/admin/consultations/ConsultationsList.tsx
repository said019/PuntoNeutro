import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react";

type ConsultationStatus = "pending" | "scheduled" | "completed" | "cancelled";

const STATUS_LABELS: Record<ConsultationStatus, string> = {
  pending: "Pendiente",
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const ConsultationsList = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editDialog, setEditDialog] = useState<any>(null);
  const [editStatus, setEditStatus] = useState<ConsultationStatus>("pending");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-consultations", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return (await api.get(`/admin/consultations${params}`)).data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ["admin-consultations-stats"],
    queryFn: async () => (await api.get("/admin/consultations/stats")).data,
  });

  const stats = statsData?.data ?? { pending: 0, scheduled: 0, completed: 0, cancelled: 0 };
  const consultations: any[] = Array.isArray(data?.data) ? data.data : [];

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; status?: string; scheduledDate?: string; notes?: string }) =>
      api.put(`/admin/consultations/${vars.id}`, {
        status: vars.status,
        scheduledDate: vars.scheduledDate || null,
        notes: vars.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-consultations"] });
      qc.invalidateQueries({ queryKey: ["admin-consultations-stats"] });
      setEditDialog(null);
      toast({ title: "Consulta actualizada" });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err.response?.data?.message, variant: "destructive" }),
  });

  const openEdit = (c: any) => {
    setEditDialog(c);
    setEditStatus(c.status);
    setEditDate(c.scheduledDate ?? c.scheduled_date ?? "");
    setEditNotes(c.notes ?? "");
  };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2d2d2d]">Consultas</h1>
            <p className="text-sm text-muted-foreground">Gestiona las consultas de nutrición y descargas musculares</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border p-4 bg-amber-50/50">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-amber-800 mt-1">{stats.pending}</p>
            </div>
            <div className="rounded-xl border p-4 bg-blue-50/50">
              <div className="flex items-center gap-2 text-blue-700">
                <Calendar size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Programadas</span>
              </div>
              <p className="text-2xl font-bold text-blue-800 mt-1">{stats.scheduled}</p>
            </div>
            <div className="rounded-xl border p-4 bg-emerald-50/50">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Completadas</span>
              </div>
              <p className="text-2xl font-bold text-emerald-800 mt-1">{stats.completed}</p>
            </div>
            <div className="rounded-xl border p-4 bg-red-50/50">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Canceladas</span>
              </div>
              <p className="text-2xl font-bold text-red-800 mt-1">{stats.cancelled}</p>
            </div>
          </div>

          {/* Filter tabs */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="scheduled">Programadas</TabsTrigger>
              <TabsTrigger value="completed">Completadas</TabsTrigger>
              <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
            </TabsList>

            <TabsContent value={statusFilter} className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : consultations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No hay consultas {statusFilter !== "all" ? STATUS_LABELS[statusFilter as ConsultationStatus]?.toLowerCase() + "s" : ""}
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Complemento</TableHead>
                        <TableHead>Especialista</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha programada</TableHead>
                        <TableHead>Compra</TableHead>
                        <TableHead className="w-[80px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consultations.map((c: any) => {
                        const status = (c.status as ConsultationStatus) || "pending";
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{c.clientName ?? c.client_name ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">{c.clientEmail ?? c.client_email ?? ""}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{c.complementName ?? c.complement_name ?? "—"}</TableCell>
                            <TableCell className="text-sm">{c.specialist ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_COLORS[status]}>
                                {STATUS_LABELS[status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.scheduledDate ?? c.scheduled_date
                                ? new Date(c.scheduledDate ?? c.scheduled_date).toLocaleDateString("es-MX")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.createdAt ?? c.created_at).toLocaleDateString("es-MX")}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                                Editar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Edit dialog */}
        <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar consulta</DialogTitle>
            </DialogHeader>
            {editDialog && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
                  <p><strong>Cliente:</strong> {editDialog.clientName ?? editDialog.client_name}</p>
                  <p><strong>Complemento:</strong> {editDialog.complementName ?? editDialog.complement_name}</p>
                  <p><strong>Especialista:</strong> {editDialog.specialist}</p>
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ConsultationStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="scheduled">Programada</SelectItem>
                      <SelectItem value="completed">Completada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fecha programada</Label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input
                    placeholder="Notas adicionales..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
              <Button
                onClick={() => updateMutation.mutate({
                  id: editDialog.id,
                  status: editStatus,
                  scheduledDate: editDate,
                  notes: editNotes,
                })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ConsultationsList;
