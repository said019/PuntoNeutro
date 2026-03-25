import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus, Search, UserPlus, CreditCard, Banknote, Building2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

// ── Schemas ────────────────────────────────────────────────────────────────────
const editSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  displayName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  healthNotes: z.string().optional(),
  acceptsCommunications: z.boolean().default(true),
});

const manualSchema = z.object({
  displayName: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  healthNotes: z.string().optional(),
  planId: z.string().optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;
type ManualFormData = z.infer<typeof manualSchema>;

interface Client extends EditFormData {
  id: string;
  role: string;
}

interface Plan { id: string; name: string; price: number; category: string; }

// ── Payment method selector ────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: "cash",     label: "Efectivo",     Icon: Banknote },
  { value: "card",     label: "Tarjeta",      Icon: CreditCard },
  { value: "transfer", label: "Transferencia",Icon: Building2 },
] as const;

// ── Main component ─────────────────────────────────────────────────────────────
const ClientsList = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing]   = useState<Client | null>(null);
  // Manual registration dialog
  const [manualOpen, setManualOpen] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Clients list
  const { data, isLoading } = useQuery<{ data: Client[] }>({
    queryKey: ["clients", debouncedSearch],
    queryFn: async () => (await api.get(`/users?role=client&search=${debouncedSearch}`)).data,
  });
  const clients = Array.isArray(data?.data) ? data.data : [];

  // Plans for the manual dialog
  const { data: plansData } = useQuery<{ data: Plan[] }>({
    queryKey: ["plans-active"],
    queryFn: async () => (await api.get("/plans?active=true")).data,
    staleTime: 60_000,
  });
  const plans: Plan[] = Array.isArray(plansData?.data) ? plansData.data : [];

  // ── Edit form ──────────────────────────────────────────────────────────────
  const editForm = useForm<EditFormData>({ resolver: zodResolver(editSchema) });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: Client) => api.put(`/users/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente actualizado" });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente eliminado" });
    },
  });

  const openEdit = (c: Client) => { editForm.reset(c); setEditing(c); setEditOpen(true); };
  const onEditSubmit = (d: EditFormData) => {
    if (editing) updateMutation.mutate({ ...d, id: editing.id, role: "client" });
  };

  // ── Manual registration form ───────────────────────────────────────────────
  const manualForm = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
    defaultValues: { startDate: format(new Date(), "yyyy-MM-dd") },
  });
  const selectedPlanId = manualForm.watch("planId");
  const selectedPlan   = plans.find((p) => p.id === selectedPlanId);
  const paymentMethod  = manualForm.watch("paymentMethod");

  const manualMutation = useMutation({
    mutationFn: (d: ManualFormData) => api.post("/admin/clients/manual", d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      const msg = res.data?.data?.membershipId
        ? "Clienta registrada y membresía activada ✓"
        : "Clienta registrada ✓";
      toast({ title: msg });
      setManualOpen(false);
      manualForm.reset({ startDate: format(new Date(), "yyyy-MM-dd") });
    },
    onError: (err: any) => {
      toast({
        title: "Error al registrar",
        description: err?.response?.data?.error ?? "Revisa los datos e intenta de nuevo",
        variant: "destructive",
      });
    },
  });

  const onManualSubmit = (d: ManualFormData) => manualMutation.mutate(d);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <AdminLayout>
        <div className="admin-page max-w-6xl">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-7">
            <div>
              <h1 className="text-3xl font-bold text-[#2d2d2d] mb-1">Clientas</h1>
              <p className="text-sm text-[#2d2d2d]/35">{clients.length} clientas registradas</p>
            </div>
            <button
              onClick={() => setManualOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 transition-opacity"
            >
              <UserPlus size={15} /> Nueva clienta
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-5 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2d2d2d]/30" />
            <Input
              className="pl-8 bg-[#94867a]/[0.05] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40 focus:border-[#94867a]/40"
              placeholder="Buscar clienta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-[#94867a]/15 overflow-hidden bg-[#94867a]/[0.03]">
            <Table>
              <TableHeader>
                <TableRow className="border-[#94867a]/15 hover:bg-transparent">
                  <TableHead className="text-[#2d2d2d]/40 font-semibold text-xs uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="text-[#2d2d2d]/40 font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-[#2d2d2d]/40 font-semibold text-xs uppercase tracking-wider">Teléfono</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} className="border-[#94867a]/12">
                      {Array(4).fill(0).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full bg-[#94867a]/[0.06]" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                  : clients.map((c) => (
                    <TableRow key={c.id} className="border-[#94867a]/12 hover:bg-[#94867a]/[0.05] transition-colors">
                      <TableCell className="font-semibold text-[#2d2d2d]/85">{c.displayName}</TableCell>
                      <TableCell className="text-sm text-[#2d2d2d]/45">{c.email}</TableCell>
                      <TableCell className="text-sm text-[#2d2d2d]/45">{c.phone ?? "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-[#2d2d2d]/30 hover:text-[#2d2d2d]/70 hover:bg-[#94867a]/[0.06]">
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#e2e5da] border-[#94867a]/15">
                            <DropdownMenuItem
                              className="text-[#2d2d2d]/70 hover:text-[#2d2d2d] focus:text-[#2d2d2d] hover:bg-[#94867a]/[0.06] focus:bg-[#94867a]/[0.06]"
                              onClick={() => navigate(`/admin/clients/${c.id}`)}
                            >
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[#2d2d2d]/70 hover:text-[#2d2d2d] focus:text-[#2d2d2d] hover:bg-[#94867a]/[0.06] focus:bg-[#94867a]/[0.06]"
                              onClick={() => openEdit(c)}
                            >
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[#f87171] hover:text-[#f87171] focus:text-[#f87171] hover:bg-[#f87171]/5 focus:bg-[#f87171]/5"
                              onClick={() => { if (window.confirm("¿Eliminar este cliente?")) deleteMutation.mutate(c.id); }}
                            >
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Edit dialog ──────────────────────────────────────────────────── */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg bg-[#e2e5da] border-[#94867a]/15 text-[#2d2d2d]">
            <DialogHeader>
              <DialogTitle className="text-[#2d2d2d]">Editar clienta</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[#2d2d2d]/60 text-xs">Nombre</Label>
                  <Input className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]" {...editForm.register("displayName")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#2d2d2d]/60 text-xs">Email</Label>
                  <Input type="email" className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]" {...editForm.register("email")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#2d2d2d]/60 text-xs">Teléfono</Label>
                  <Input className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]" {...editForm.register("phone")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#2d2d2d]/60 text-xs">Fecha de nacimiento</Label>
                  <DatePicker value={editForm.watch("dateOfBirth")} onChange={(v) => editForm.setValue("dateOfBirth", v)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[#2d2d2d]/60 text-xs">Notas de salud</Label>
                <Input className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]" {...editForm.register("healthNotes")} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[#2d2d2d]/60 text-xs">Contacto de emergencia</Label>
                  <Input className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]" placeholder="Nombre" {...editForm.register("emergencyContactName")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[#2d2d2d]/60 text-xs">Teléfono emergencia</Label>
                  <Input className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]" {...editForm.register("emergencyContactPhone")} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="border-[#94867a]/15 text-[#2d2d2d]/60 hover:bg-[#94867a]/[0.06]" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-gradient-to-r from-[#94867a] to-[#b5bf9c] text-white border-0"
                >
                  Actualizar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Manual registration dialog ───────────────────────────────────── */}
        <Dialog open={manualOpen} onOpenChange={(v) => { setManualOpen(v); if (!v) manualForm.reset({ startDate: format(new Date(), "yyyy-MM-dd") }); }}>
          <DialogContent className="max-w-xl bg-[#e2e5da] border-[#94867a]/15 text-[#2d2d2d] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#2d2d2d] flex items-center gap-2">
                <UserPlus size={18} className="text-[#94867a]" />
                Nueva clienta
              </DialogTitle>
              <p className="text-xs text-[#2d2d2d]/35 mt-0.5">Registro manual · Si se proporciona email, la clienta podrá iniciar sesión</p>
            </DialogHeader>

            <form onSubmit={manualForm.handleSubmit(onManualSubmit)} className="space-y-5 pt-1">
              {/* Personal info */}
              <div>
                <p className="text-[11px] text-[#94867a]/70 font-semibold uppercase tracking-wider mb-3">Datos personales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-[#2d2d2d]/60 text-xs">Nombre completo *</Label>
                    <Input
                      className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40"
                      placeholder="Ana García"
                      {...manualForm.register("displayName")}
                    />
                    {manualForm.formState.errors.displayName && (
                      <p className="text-[10px] text-[#f87171]">{manualForm.formState.errors.displayName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[#2d2d2d]/60 text-xs">Email <span className="text-[#94867a]/40">(opcional)</span></Label>
                    <Input
                      type="email"
                      className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40"
                      placeholder="ana@email.com"
                      {...manualForm.register("email")}
                    />
                    {manualForm.formState.errors.email && (
                      <p className="text-[10px] text-[#f87171]">{manualForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[#2d2d2d]/60 text-xs">Teléfono</Label>
                    <Input
                      className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40"
                      placeholder="55 1234 5678"
                      {...manualForm.register("phone")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[#2d2d2d]/60 text-xs">Fecha de nacimiento</Label>
                    <DatePicker value={manualForm.watch("dateOfBirth")} onChange={(v) => manualForm.setValue("dateOfBirth", v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[#2d2d2d]/60 text-xs">Notas de salud</Label>
                    <Input
                      className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40"
                      placeholder="Lesiones, condiciones..."
                      {...manualForm.register("healthNotes")}
                    />
                  </div>
                </div>
              </div>

              {/* Plan (optional) */}
              <div>
                <p className="text-[11px] text-[#b5bf9c]/70 font-semibold uppercase tracking-wider mb-3">Membresía (opcional)</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[#2d2d2d]/60 text-xs">Plan</Label>
                    <Select
                      value={selectedPlanId ?? "none"}
                      onValueChange={(v) => manualForm.setValue("planId", v === "none" ? undefined : v)}
                    >
                      <SelectTrigger className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d]">
                        <SelectValue placeholder="Sin plan (solo crear cuenta)" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#e2e5da] border-[#94867a]/15">
                        <SelectItem value="none" className="text-[#2d2d2d]/50">Sin plan</SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-[#2d2d2d]">
                            {p.name}
                            {p.price > 0 && (
                              <span className="ml-2 text-[#2d2d2d]/40">${p.price.toLocaleString("es-MX")}</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show price of selected plan */}
                  {selectedPlan && (
                    <div className="flex items-center justify-between rounded-xl border border-[#b5bf9c]/20 bg-[#b5bf9c]/5 px-4 py-2.5">
                      <span className="text-sm text-[#2d2d2d]/70">{selectedPlan.name}</span>
                      <span className="text-lg font-bold text-[#b5bf9c]">${selectedPlan.price.toLocaleString("es-MX")}</span>
                    </div>
                  )}

                  {/* Payment method — only if plan selected */}
                  {selectedPlanId && selectedPlanId !== "none" && (
                    <div className="space-y-1">
                      <Label className="text-[#2d2d2d]/60 text-xs">Método de pago</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => manualForm.setValue("paymentMethod", value)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all",
                              paymentMethod === value
                                ? "border-[#94867a]/50 bg-[#94867a]/10 text-[#94867a]"
                                : "border-[#94867a]/15 bg-[#94867a]/[0.04] text-[#2d2d2d]/40 hover:border-[#94867a]/25 hover:text-[#2d2d2d]/60"
                            )}
                          >
                            <Icon size={16} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Start date — only if plan selected */}
                  {selectedPlanId && selectedPlanId !== "none" && (
                    <div className="space-y-1">
                      <Label className="text-[#2d2d2d]/60 text-xs">Fecha de inicio</Label>
                      <DatePicker value={manualForm.watch("startDate")} onChange={(v) => manualForm.setValue("startDate", v)} />
                    </div>
                  )}
                </div>
              </div>

              {/* Internal notes */}
              <div className="space-y-1">
                <Label className="text-[#2d2d2d]/60 text-xs">Notas internas</Label>
                <Input
                  className="bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40"
                  placeholder="Referida por, observaciones..."
                  {...manualForm.register("notes")}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#94867a]/15 text-[#2d2d2d]/60 hover:bg-[#94867a]/[0.06]"
                  onClick={() => setManualOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={manualMutation.isPending}
                  className="bg-gradient-to-r from-[#94867a] to-[#b5bf9c] text-white border-0 min-w-[140px]"
                >
                  {manualMutation.isPending ? "Registrando…" : selectedPlanId && selectedPlanId !== "none" ? "Registrar + activar plan" : "Registrar clienta"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </AdminLayout>
    </AuthGuard>
  );
};

export default ClientsList;
