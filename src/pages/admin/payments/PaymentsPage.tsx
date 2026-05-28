import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, User, Package, CheckCircle2, CreditCard, Banknote, ArrowRight, ChevronLeft, History, Sparkles, Clock, XCircle, Eye } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
  { value: "transfer", label: "Transferencia", icon: ArrowRight },
];

const STEP_META = [
  { label: "Buscar cliente", icon: User },
  { label: "Elegir plan", icon: Package },
  { label: "Confirmar", icon: CheckCircle2 },
];

// ── Category groups for plan display ──────────────────────
function groupPlans(plans: any[]) {
  const groups: Record<string, any[]> = { pilates: [], bienestar: [], otro: [] };
  for (const p of plans) {
    const cat = p.classCategory ?? p.class_category ?? "";
    if (cat === "pilates") groups.pilates.push(p);
    else if (cat === "bienestar") groups.bienestar.push(p);
    else if (cat === "all") groups.otro.push(p);
    else if (p.name?.toLowerCase().includes("pilates") || p.name?.toLowerCase().includes("mat") || p.name?.toLowerCase().includes("flow")) groups.pilates.push(p);
    else if (p.name?.toLowerCase().includes("body") || p.name?.toLowerCase().includes("strong") || p.name?.toLowerCase().includes("flex")) groups.bienestar.push(p);
    else groups.otro.push(p);
  }
  return groups;
}

// ── Step indicator ────────────────────────────────────────
const StepBar = ({ step }: { step: number }) => (
  <div className="flex items-center gap-0 mb-8">
    {STEP_META.map((s, i) => {
      const done = step > i + 1;
      const active = step === i + 1;
      return (
        <div key={i} className="flex items-center gap-0">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
            done && "bg-[#94867a]/20 text-[#94867a] border border-[#94867a]/30",
            active && "bg-gradient-to-r from-[#94867a] to-[#b5bf9c] text-white shadow-[0_0_16px_rgba(148,134,122,0.4)]",
            !done && !active && "bg-[#94867a]/[0.06] text-[#2d2d2d]/25 border border-[#94867a]/15"
          )}>
            <span className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
              done && "bg-[#94867a] text-white",
              active && "bg-[#94867a]/15 text-[#2d2d2d]",
              !done && !active && "bg-[#94867a]/10 text-[#2d2d2d]/30"
            )}>
              {done ? "✓" : i + 1}
            </span>
            {s.label}
          </div>
          {i < 2 && (
            <div className={cn(
              "w-8 h-px mx-1 transition-all",
              done ? "bg-[#94867a]/50" : "bg-[#94867a]/10"
            )} />
          )}
        </div>
      );
    })}
  </div>
);

// ── Cash Assignment Wizard ──────────────────────────────
const CashAssignment = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedUser, setSelectedUser] = useState<{ id: string; displayName: string; email?: string; phone?: string | null } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; price: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const { data: usersData, isLoading: usersLoading } = useQuery<{ data: { id: string; displayName: string; email: string; phone?: string | null }[] }>({
    queryKey: ["users-search", debouncedSearch],
    queryFn: async () => (
      await api.get(`/users?role=client${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`)
    ).data,
  });

  const allUsers = Array.isArray(usersData?.data) ? usersData.data : [];
  const filteredUsers = allUsers;

  const { data: plansData } = useQuery<{ data: { id: string; name: string; price: number; classLimit?: number | null; durationDays?: number; classCategory?: string }[] }>({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
  });

  const assignMutation = useMutation({
    mutationFn: () => api.post("/memberships", {
      userId: selectedUser?.id,
      planId: selectedPlan?.id,
      paymentMethod,
      startDate: new Date().toISOString().split("T")[0],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memberships"] });
      toast({ title: "✅ Membresía activada correctamente" });
      setStep(1); setSelectedUser(null); setSelectedPlan(null); setSearch("");
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al asignar", variant: "destructive" }),
  });

  const plans = (Array.isArray(plansData?.data) ? plansData.data : []).filter((p) => (p as any).isActive !== false && (p as any).is_active !== false);
  const planGroups = groupPlans(plans);

  return (
    <div className="max-w-2xl mx-auto">
      <StepBar step={step} />

      {/* ── Step 1: Buscar cliente ─────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] p-5">
            <h3 className="text-sm font-semibold text-[#2d2d2d]/60 uppercase tracking-wider mb-4">Buscar cliente</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b5bf9c]/60" />
              <Input
                className="pl-9 bg-[#94867a]/[0.06] border-[#94867a]/15 focus:border-[#94867a]/50 focus:ring-[#94867a]/20 text-[#2d2d2d] placeholder:text-[#94867a]/40 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, email o teléfono…"
                autoFocus
              />
            </div>
          </div>

          {usersLoading && (
            <div className="flex items-center justify-center py-8 text-[#b5bf9c]/60">
              <Loader2 className="animate-spin mr-2" size={16} /> Buscando…
            </div>
          )}

          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] hover:bg-[#94867a]/5 hover:border-[#94867a]/25 transition-all group text-left"
                onClick={() => { setSelectedUser(u); setStep(2); }}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#94867a]/30 to-[#b5bf9c]/20 border border-[#94867a]/30 flex items-center justify-center text-sm font-bold text-[#94867a] shrink-0">
                  {u.displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#2d2d2d]/90 truncate">{u.displayName}</p>
                  <p className="text-xs text-[#2d2d2d]/35 truncate">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </p>
                </div>
                <ArrowRight size={14} className="text-[#2d2d2d]/20 group-hover:text-[#94867a]/60 transition-colors shrink-0" />
              </button>
            ))}
            {filteredUsers.length === 0 && !usersLoading && (
              <p className="text-center py-6 text-[#2d2d2d]/30 text-sm">No se encontraron clientes</p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Elegir plan ────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Cliente seleccionado */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#94867a]/8 border border-[#94867a]/20">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#94867a] to-[#b5bf9c] flex items-center justify-center text-xs font-bold text-white">
              {selectedUser?.displayName?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2d2d2d]/90">{selectedUser?.displayName}</p>
              <p className="text-xs text-[#2d2d2d]/40">{selectedUser?.email}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto text-[#2d2d2d]/30 hover:text-[#2d2d2d]/60 text-xs" onClick={() => setStep(1)}>
              <ChevronLeft size={12} className="mr-1" /> Cambiar
            </Button>
          </div>

          {/* Plan groups */}
          {Object.entries(planGroups).map(([group, items]) => {
            if (!items.length) return null;
            const groupColors: Record<string, string> = {
              pilates: "text-[#b5bf9c]",
              bienestar: "text-[#94867a]",
              otro: "text-[#2d2d2d]/50",
            };
            const groupLabels: Record<string, string> = {
              pilates: "Paquetes Pilates",
              bienestar: "Paquetes Bienestar",
              otro: "Otros paquetes",
            };
            return (
              <div key={group}>
                <p className={cn("text-[11px] font-semibold uppercase tracking-widest mb-2 px-1", groupColors[group])}>
                  {groupLabels[group] ?? group}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group",
                        selectedPlan?.id === p.id
                          ? "border-[#94867a]/50 bg-gradient-to-r from-[#94867a]/10 to-[#b5bf9c]/5 shadow-[0_0_16px_rgba(148,134,122,0.12)]"
                          : "border-[#94867a]/15 bg-[#94867a]/[0.04] hover:border-[#94867a]/25 hover:bg-[#94867a]/5"
                      )}
                      onClick={() => setSelectedPlan(p)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0 transition-all",
                          selectedPlan?.id === p.id
                            ? "bg-[#94867a] shadow-[0_0_8px_#94867a]"
                            : "bg-[#94867a]/12 group-hover:bg-[#94867a]/50"
                        )} />
                        <div>
                          <p className="text-sm font-semibold text-[#2d2d2d]/85">{p.name}</p>
                          <p className="text-xs text-[#2d2d2d]/30">
                            {p.classLimit === null ? "Ilimitado" : `${p.classLimit} clases`}
                            {p.durationDays ? ` · ${p.durationDays} días` : ""}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-sm font-bold transition-colors",
                        selectedPlan?.id === p.id ? "text-[#94867a]" : "text-[#2d2d2d]/60 group-hover:text-[#2d2d2d]/90"
                      )}>
                        ${Number(p.price).toLocaleString()} MXN
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="border-[#94867a]/15 text-[#2d2d2d]/50 hover:text-[#2d2d2d] hover:border-[#94867a]/25" onClick={() => setStep(1)}>
              <ChevronLeft size={14} className="mr-1" /> Volver
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 text-white font-semibold shadow-[0_0_20px_rgba(148,134,122,0.3)]"
              disabled={!selectedPlan}
              onClick={() => setStep(3)}
            >
              Continuar <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirmar ─────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#94867a]/15 flex items-center gap-2">
              <Sparkles size={14} className="text-[#ebede5]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2d2d2d]/50">Resumen de la membresía</span>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#2d2d2d]/50">Cliente</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#94867a] to-[#b5bf9c] flex items-center justify-center text-[9px] font-bold text-white">
                    {selectedUser?.displayName?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-[#2d2d2d]/90">{selectedUser?.displayName}</span>
                </div>
              </div>
              <div className="h-px bg-[#94867a]/[0.06]" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#2d2d2d]/50">Plan</span>
                <span className="text-sm font-semibold text-[#2d2d2d]/90">{selectedPlan?.name}</span>
              </div>
              <div className="h-px bg-[#94867a]/[0.06]" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#2d2d2d]/50">Total</span>
                <span className="text-lg font-bold text-[#94867a]">${Number(selectedPlan?.price).toLocaleString()} MXN</span>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div className="rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] p-5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[#2d2d2d]/40 mb-3 block">Método de pago</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    paymentMethod === value
                      ? "border-[#94867a]/50 bg-[#94867a]/10 text-[#94867a]"
                      : "border-[#94867a]/15 bg-[#94867a]/[0.04] text-[#2d2d2d]/40 hover:border-[#94867a]/20 hover:text-[#2d2d2d]/70"
                  )}
                  onClick={() => setPaymentMethod(value)}
                >
                  <Icon size={16} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="border-[#94867a]/15 text-[#2d2d2d]/50 hover:text-[#2d2d2d] hover:border-[#94867a]/25" onClick={() => setStep(2)}>
              <ChevronLeft size={14} className="mr-1" /> Volver
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 text-white font-bold shadow-[0_0_24px_rgba(148,134,122,0.35)] h-11"
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending
                ? <><Loader2 className="animate-spin mr-2" size={14} /> Activando…</>
                : <><CheckCircle2 size={15} className="mr-2" /> Confirmar y activar membresía</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Pending Orders (verify / reject) ─────────────────────
const PendingOrders = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: dataVerify, isLoading: loadingVerify } = useQuery<{ data: any[] }>({
    queryKey: ["admin-orders-pending-verification"],
    queryFn: async () => (await api.get("/admin/orders?status=pending_verification")).data,
  });
  const { data: dataPending, isLoading: loadingPending } = useQuery<{ data: any[] }>({
    queryKey: ["admin-orders-pending-payment"],
    queryFn: async () => (await api.get("/admin/orders?status=pending_payment")).data,
  });
  const isLoading = loadingVerify || loadingPending;
  const orders = [
    ...(Array.isArray(dataVerify?.data) ? dataVerify.data : []),
    ...(Array.isArray(dataPending?.data) ? dataPending.data.filter((o: any) => o.payment_method === "cash") : []),
  ].sort((a: any, b: any) => new Date(b.createdAt ?? b.created_at).getTime() - new Date(a.createdAt ?? a.created_at).getTime());

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.put(`/admin/orders/${id}/verify`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders-pending-verification"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-pending-payment"] });
      qc.invalidateQueries({ queryKey: ["orders-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      toast({ title: "✅ Orden verificada y membresía activada" });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al verificar", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.put(`/admin/orders/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders-pending-verification"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-pending-payment"] });
      qc.invalidateQueries({ queryKey: ["orders-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "Orden rechazada" });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al rechazar", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#94867a]/60">
        <Loader2 className="animate-spin mr-2" size={16} /> Cargando…
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckCircle2 size={32} className="text-[#b5bf9c]/40 mb-3" />
        <p className="text-[#2d2d2d]/40 text-sm font-medium">No hay órdenes pendientes</p>
        <p className="text-[#2d2d2d]/25 text-xs mt-1">Todas las órdenes han sido procesadas</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {orders.map((o: any) => {
          const isCash = o.payment_method === "cash";
          const isTransfer = o.payment_method === "transfer";
          return (
          <div
            key={o.id}
            className={cn(
              "rounded-xl border p-4 space-y-3",
              isCash
                ? "border-blue-500/25 bg-blue-50/40"
                : "border-amber-600/20 bg-amber-50/50"
            )}
          >
            {/* Payment method banner */}
            <div className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 -mx-0.5",
              isCash
                ? "bg-blue-100/70 border border-blue-200/50"
                : "bg-amber-100/70 border border-amber-200/50"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                isCash ? "bg-blue-500 text-white" : "bg-amber-500 text-white"
              )}>
                {isCash ? <Banknote size={15} /> : <CreditCard size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-bold", isCash ? "text-blue-800" : "text-amber-800")}>
                  {isCash ? "PAGO EN EFECTIVO — EN ESTUDIO" : isTransfer ? "TRANSFERENCIA / SPEI" : "TARJETA"}
                </p>
                <p className={cn("text-[10px]", isCash ? "text-blue-600/70" : "text-amber-600/70")}>
                  {isCash ? "La clienta pagará directamente en recepción" : "Comprobante enviado, verificar pago"}
                </p>
              </div>
              <Badge variant="outline" className={cn(
                "text-[10px] shrink-0",
                isCash ? "text-blue-700 border-blue-400/40 bg-blue-50" : "text-amber-700 border-amber-400/40 bg-amber-50"
              )}>
                <Clock size={9} className="mr-1" />
                {isCash ? "Por cobrar" : "Por verificar"}
              </Badge>
            </div>

            {/* Client info + amount */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#94867a]/30 to-[#b5bf9c]/20 border border-[#94867a]/30 flex items-center justify-center text-sm font-bold text-[#94867a] shrink-0">
                  {(o.userName ?? "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2d2d2d]/90">{o.userName ?? "—"}</p>
                  <p className="text-xs text-[#2d2d2d]/40">{o.planName ?? "Plan"}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm text-[#2d2d2d]/90">
                  ${Number(o.totalAmount ?? o.total_amount ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                </p>
                <p className="text-[10px] text-[#2d2d2d]/35">
                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>
            </div>

            {/* Proof link (only for transfers) */}
            {o.proofUrl && (
              <button
                onClick={() => setPreviewUrl(o.proofUrl)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#94867a] hover:text-[#2d2d2d] transition-colors px-1"
              >
                <Eye size={13} /> Ver comprobante de pago
              </button>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className={cn(
                  "flex-1 font-semibold text-xs h-9 text-white hover:opacity-90",
                  isCash
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 shadow-blue-500/20 shadow-sm"
                    : "bg-gradient-to-r from-[#4a7a38] to-[#6b9a52]"
                )}
                onClick={() => verifyMutation.mutate(o.id)}
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending
                  ? <Loader2 className="animate-spin" size={13} />
                  : <><CheckCircle2 size={13} className="mr-1" /> {isCash ? "Confirmar pago y activar" : "Verificar y activar"}</>
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-400/30 text-red-600 hover:bg-red-50 hover:border-red-400/50 font-semibold text-xs h-9"
                onClick={() => rejectMutation.mutate(o.id)}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? <Loader2 className="animate-spin" size={13} /> : <><XCircle size={13} className="mr-1" /> Rechazar</>}
              </Button>
            </div>
          </div>
          );
        })}
      </div>

      {/* Proof preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-3 pb-2">
              <p className="text-sm font-semibold text-[#2d2d2d]/80">Comprobante de pago</p>
              <button onClick={() => setPreviewUrl(null)} className="text-[#2d2d2d]/40 hover:text-[#2d2d2d] text-lg">✕</button>
            </div>
            {previewUrl.includes("application/pdf") || previewUrl.endsWith(".pdf") ? (
              <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border-0" title="Comprobante PDF" />
            ) : (
              <img src={previewUrl} alt="Comprobante" className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ── Payments History ──────────────────────────────────────
const PaymentsHistory = () => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ["payments", startDate, endDate],
    queryFn: async () => (
      await api.get(`/payments?startDate=${startDate}&endDate=${endDate}T23:59:59`)
    ).data,
  });
  const allPayments = Array.isArray(data?.data) ? data.data : [];

  const payments = allPayments.filter((p: any) => {
    if (methodFilter !== "all" && p.method !== methodFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${p.userName ?? ""} ${p.planName ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const totalFiltered = payments.reduce((sum: number, p: any) => sum + Number(p.total_amount ?? 0), 0);
  const countByMethod = payments.reduce((acc: Record<string, { count: number; total: number }>, p: any) => {
    const m = p.method ?? "otro";
    acc[m] = acc[m] ?? { count: 0, total: 0 };
    acc[m].count++;
    acc[m].total += Number(p.total_amount ?? 0);
    return acc;
  }, {});

  const methodStyles: Record<string, string> = {
    cash: "text-blue-700 border-blue-400/30 bg-blue-50",
    card: "text-[#4a5638] border-[#b5bf9c]/40 bg-[#b5bf9c]/15",
    transfer: "text-amber-700 border-amber-400/30 bg-amber-50",
  };
  const methodLabels: Record<string, string> = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
  const methodIcons: Record<string, any> = { cash: Banknote, card: CreditCard, transfer: ArrowRight };
  const sourceLabels: Record<string, string> = { order: "Orden en línea", membership: "Asignación manual", walkin: "Walk-in" };
  const sourceStyles: Record<string, string> = {
    order: "text-[#4a5638] bg-[#b5bf9c]/12 border-[#b5bf9c]/30",
    membership: "text-[#5a4f46] bg-[#94867a]/12 border-[#94867a]/30",
    walkin: "text-[#2d2d2d]/55 bg-[#94867a]/[0.06] border-[#94867a]/15",
  };

  const fmtFullDate = (raw: any) => {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  };
  const fmtTime = (raw: any) => {
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-[#2d2d2d]/45 mb-1.5 block">Desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/60 border-[#94867a]/15 text-sm" />
          </div>
          <div>
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-[#2d2d2d]/45 mb-1.5 block">Hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/60 border-[#94867a]/15 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94867a]/50" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente o plan…"
              className="pl-9 bg-white/60 border-[#94867a]/15 text-sm" />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="bg-white/60 border-[#94867a]/15 text-sm">
              <SelectValue placeholder="Método de pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { label: "Hoy", start: todayStr, end: todayStr },
            { label: "Este mes", start: firstOfMonth, end: todayStr },
            { label: "Mes pasado", start: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10), end: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10) },
            { label: "Últimos 30 días", start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), end: todayStr },
          ].map((preset) => (
            <button key={preset.label}
              onClick={() => { setStartDate(preset.start); setEndDate(preset.end); }}
              className="text-[11px] font-semibold px-3 py-1 rounded-full border border-[#94867a]/20 bg-white/40 text-[#2d2d2d]/60 hover:bg-[#94867a]/10 hover:text-[#2d2d2d]/90 transition-all">
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#b5bf9c]/30 bg-gradient-to-br from-[#b5bf9c]/12 to-[#b5bf9c]/4 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5638]/70">Total filtrado</p>
          <p className="text-xl font-bold text-[#4a5638] mt-0.5">${totalFiltered.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-[#2d2d2d]/40 mt-0.5">{payments.length} {payments.length === 1 ? "pago" : "pagos"}</p>
        </div>
        {(["cash", "transfer", "card"] as const).map((m) => {
          const stats = countByMethod[m] ?? { count: 0, total: 0 };
          const Icon = methodIcons[m];
          return (
            <div key={m} className="rounded-xl border border-[#94867a]/15 bg-[#94867a]/[0.04] p-3">
              <div className="flex items-center gap-1.5">
                <Icon size={11} className="text-[#94867a]/60" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2d2d2d]/55">{methodLabels[m]}</p>
              </div>
              <p className="text-base font-bold text-[#2d2d2d]/85 mt-0.5">${stats.total.toLocaleString("es-MX", { minimumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-[#2d2d2d]/40 mt-0.5">{stats.count} {stats.count === 1 ? "pago" : "pagos"}</p>
            </div>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#94867a]/60">
          <Loader2 className="animate-spin mr-2" size={16} /> Cargando pagos…
        </div>
      ) : !payments.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History size={32} className="text-[#2d2d2d]/10 mb-3" />
          <p className="text-[#2d2d2d]/40 text-sm font-medium">No hay pagos en este rango</p>
          <p className="text-[#2d2d2d]/25 text-xs mt-1">Cambia las fechas o el filtro para ver más resultados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p: any) => {
            const Icon = methodIcons[p.method] ?? CreditCard;
            return (
              <div key={`${p.source}-${p.id}`} className="flex items-start gap-3 p-4 rounded-xl border border-[#94867a]/15 bg-white/40 hover:bg-[#94867a]/[0.04] transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#94867a]/25 to-[#b5bf9c]/15 border border-[#94867a]/25 flex items-center justify-center text-sm font-bold text-[#94867a] shrink-0">
                  {(p.userName ?? "?")[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-[#2d2d2d]/90">{p.userName ?? "Sin nombre"}</p>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", sourceStyles[p.source] ?? sourceStyles.walkin)}>
                      {sourceLabels[p.source] ?? p.source}
                    </span>
                  </div>
                  <p className="text-xs text-[#2d2d2d]/55 mt-0.5 flex items-center gap-1">
                    <Package size={11} className="text-[#94867a]/60" /> {p.planName ?? "—"}
                  </p>
                  <p className="text-[11px] text-[#2d2d2d]/40 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {fmtFullDate(p.createdAt)}
                    <span className="text-[#2d2d2d]/30">·</span>
                    <span>{fmtTime(p.createdAt)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-base font-bold text-[#2d2d2d]/90">${Number(p.total_amount ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1", methodStyles[p.method] ?? "text-[#2d2d2d]/45 border-[#94867a]/15 bg-[#94867a]/[0.06]")}>
                    <Icon size={9} /> {methodLabels[p.method] ?? p.method ?? "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main Payments Page ────────────────────────────────────
const PaymentsPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "pending" ? "pending" : "cash";
  const [activeTab, setActiveTab] = useState<"cash" | "pending" | "history">(initialTab);

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="admin-page max-w-3xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#2d2d2d] mb-1">Pagos</h1>
            <p className="text-sm text-[#2d2d2d]/35">Asigna membresías en efectivo, verifica pagos pendientes y consulta el historial</p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl bg-[#94867a]/[0.06] border border-[#94867a]/15 w-fit mb-8">
            {([["cash", "Asignación efectivo"], ["pending", "Pendientes"], ["history", "Historial"]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                  activeTab === val
                    ? "bg-gradient-to-r from-[#94867a] to-[#b5bf9c] text-white shadow-[0_0_14px_rgba(148,134,122,0.3)]"
                    : "text-[#2d2d2d]/40 hover:text-[#2d2d2d]/70"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "cash" && <CashAssignment />}
          {activeTab === "pending" && <PendingOrders />}
          {activeTab === "history" && <PaymentsHistory />}
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default PaymentsPage;
