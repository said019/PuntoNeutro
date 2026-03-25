import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Check, Loader2, CreditCard, Copy, Banknote, Building2,
  Tag, ChevronRight, ArrowLeft, Upload, CheckCircle, Sparkles,
} from "lucide-react";
import imgPilates from "@/assets/pilates_2320695.png";

type Step = "select" | "method" | "bank" | "cash" | "upload" | "done";
type PaymentMethod = "transfer" | "cash";

function flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes", "si", "sí", "t"].includes(value.toLowerCase());
  return false;
}

function detectPlanCategory(plan: any): "pilates" | "bienestar" | "all" {
  const raw = String(plan.classCategory ?? plan.class_category ?? "").toLowerCase();
  if (["pilates", "bienestar", "all"].includes(raw)) return raw as "pilates" | "bienestar" | "all";
  const byName = String(plan.name ?? "").toLowerCase();
  if (byName.includes("pilates") || byName.includes("mat") || byName.includes("flow") || byName.includes("clásico") || byName.includes("terapéutico")) return "pilates";
  if (byName.includes("body") || byName.includes("strong") || byName.includes("flex")) return "bienestar";
  return "all";
}

// ── Plan card ─────────────────────────────────────────────────────────────────
const PlanCard = ({
  plan, selected, onSelect,
}: { plan: any; selected: boolean; onSelect: () => void }) => {
  const durationDays = Number(plan.durationDays ?? plan.duration_days ?? 0);
  const classLimit = plan.classLimit ?? plan.class_limit ?? null;
  const nonTransferable = flag(plan.isNonTransferable ?? plan.is_non_transferable);
  const nonRepeatable = flag(plan.isNonRepeatable ?? plan.is_non_repeatable);
  const category = detectPlanCategory(plan);
  const accent =
    category === "pilates" ? "#b5bf9c" :
    category === "bienestar" ? "#94867a" : "#b5bf9c";
  const iconSrc = imgPilates;

  const description = plan.description ?? "";
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  const isCombo = plan.name?.toLowerCase().includes("paquete +");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden",
        selected
          ? "border-[#94867a]/60 bg-gradient-to-br from-[#94867a]/10 to-[#b5bf9c]/5 shadow-[0_0_20px_rgba(148,134,122,0.15)]"
          : "border-[#94867a]/15 bg-[#94867a]/[0.04] hover:border-[#94867a]/25 hover:bg-[#94867a]/[0.06]"
      )}
    >
      <div className="pointer-events-none absolute -top-12 -right-10 h-28 w-28 rounded-full opacity-30 blur-2xl" style={{ backgroundColor: accent }} />
      {selected && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-br from-[#94867a] to-[#b5bf9c] flex items-center justify-center">
          <Check size={11} className="text-white" />
        </span>
      )}
      <div className="flex items-start gap-3 pr-7">
        <div
          className="h-11 w-11 rounded-xl border flex items-center justify-center shrink-0"
          style={{ borderColor: `${accent}55`, background: `${accent}20` }}
        >
          <img src={iconSrc} alt="" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2d2d2d]/85 leading-snug">{plan.name}</p>
          {description && (
            <p className="text-[11px] text-[#2d2d2d]/45 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-2xl font-bold text-[#2d2d2d]">${Number(plan.price ?? 0).toLocaleString("es-MX")}</span>
        <span className="text-xs text-[#2d2d2d]/35">{plan.currency ?? "MXN"}</span>
      </div>
      {/* Features list */}
      {features.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {features.map((f, i) => (
            <li key={i} className={cn(
              "text-[10px] flex items-start gap-1.5",
              f.startsWith("Precio con descuento")
                ? "text-[#4a7a38] font-semibold"
                : "text-[#2d2d2d]/45"
            )}>
              <span className="mt-0.5 shrink-0">
                {f.startsWith("Precio con descuento") ? "💰" : "•"}
              </span>
              {f}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {durationDays > 0 && (
          <span className="text-[10px] text-[#4a5638] bg-[#b5bf9c]/15 border border-[#b5bf9c]/25 rounded-full px-2 py-0.5">
            {durationDays} días
          </span>
        )}
        {Number(classLimit) > 0 && (
          <span className="text-[10px] text-[#5a4f46] bg-[#94867a]/12 border border-[#94867a]/20 rounded-full px-2 py-0.5">
            {classLimit} clases
          </span>
        )}
        {isCombo && (
          <span className="text-[10px] text-[#7a6d62] bg-[#94867a]/10 border border-[#94867a]/25 rounded-full px-2 py-0.5 font-semibold">
            ✨ Paquete completo
          </span>
        )}
        {nonTransferable && (
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            No transferible
          </span>
        )}
        {nonRepeatable && (
          <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
            No repetible
          </span>
        )}
      </div>
    </button>
  );
};

// ── Step pill bar ──────────────────────────────────────────────────────────────
const STEPS: { id: Step; label: string }[] = [
  { id: "select", label: "Plan" },
  { id: "method", label: "Pago" },
  { id: "upload", label: "Comprobante" },
  { id: "done",   label: "Listo" },
];

const StepBar = ({ current }: { current: Step }) => {
  const order: Step[] = ["select", "method", "bank", "cash", "upload", "done"];
  const currentIdx = order.indexOf(current);
  const visibleSteps = STEPS;

  return (
    <div className="flex items-center gap-1">
      {visibleSteps.map((s, i) => {
        const sIdx = order.indexOf(s.id === "method" ? "method" : s.id);
        const done = currentIdx > sIdx;
        const active = s.id === current || (current === "bank" && s.id === "method") || (current === "cash" && s.id === "method");
        return (
          <div key={s.id} className="flex items-center gap-1">
            {i > 0 && (
              <div className={cn("h-px w-6 rounded", done ? "bg-[#94867a]/60" : "bg-[#94867a]/10")} />
            )}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
              active
                ? "border-[#94867a]/40 bg-[#94867a]/10 text-[#94867a]"
                : done
                  ? "border-[#4ade80]/30 bg-[#4ade80]/5 text-[#4ade80]"
                  : "border-[#94867a]/15 text-[#2d2d2d]/25"
            )}>
              {done ? <Check size={10} /> : <span>{i + 1}</span>}
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const Checkout = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedComplement, setSelectedComplement] = useState<any>(null);
  const [comboMode, setComboMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<any>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderUuid, setOrderUuid] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
  });
  const { data: complementsData } = useQuery({
    queryKey: ["complements"],
    queryFn: async () => (await api.get("/complements")).data,
  });
  const { data: comboPricingData } = useQuery({
    queryKey: ["combo-pricing"],
    queryFn: async () => (await api.get("/combo-pricing")).data,
  });

  const complements: any[] = Array.isArray(complementsData?.data) ? complementsData.data : [];
  const comboPricing: any[] = Array.isArray(comboPricingData?.data) ? comboPricingData.data : [];

  const rawPlans: any[] = Array.isArray(plansData?.data) ? plansData.data : Array.isArray(plansData) ? plansData : [];
  const plans = rawPlans
    .filter((p) => (p.isActive ?? p.is_active) !== false)
    .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 99) - (b.sortOrder ?? b.sort_order ?? 99));

  // Only basic plans (no old "Paquete +" entries)
  const basicPlans = plans.filter((p) => !(p.name ?? "").toLowerCase().includes("paquete +"));

  // Plans eligible for combo (8, 12, 16 classes)
  const comboEligibleCounts = comboPricing.map((cp: any) => cp.classCount ?? cp.class_count);
  const isComboEligible = (plan: any) => {
    const cl = plan.classLimit ?? plan.class_limit;
    return cl && comboEligibleCounts.includes(cl);
  };

  // Get combo price for current selection
  const getComboPrice = (plan: any) => {
    const cl = plan?.classLimit ?? plan?.class_limit;
    return comboPricing.find((cp: any) => (cp.classCount ?? cp.class_count) === cl);
  };

  const validateCodeMutation = useMutation({
    mutationFn: () => api.post("/discount-codes/validate", { code: discountCode, planId: selectedPlan?.id }),
    onSuccess: (res) => setDiscountResult(res.data?.data ?? res.data),
    onError: () => toast({ title: "Código inválido", variant: "destructive" }),
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      api.post("/orders", {
        planId: selectedPlan.id,
        discountCode: discountResult?.code,
        paymentMethod,
        complementId: selectedComplement?.id ?? null,
      }),
    onSuccess: (res) => {
      const data = res.data?.data ?? res.data;
      setOrderUuid(data.id);
      setOrderId(data.order_number ?? data.orderNumber ?? data.orderId ?? data.id);
      setBankDetails(data.bankDetails ?? data.bank_details);
      if (paymentMethod === "transfer") setStep("bank");
      else setStep("cash");
    },
    onError: (err: any) =>
      toast({ title: "Error al crear orden", description: err.response?.data?.message, variant: "destructive" }),
  });

  const uploadProofMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", file!);
      return api.post(`/orders/${orderUuid}/proof`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-orders"] }); setStep("done"); },
    onError: (err: any) =>
      toast({ title: "Error al subir comprobante", description: err.response?.data?.message, variant: "destructive" }),
  });

  // Compute display price: combo pricing if complement selected, else plan price
  const comboTier = selectedComplement ? getComboPrice(selectedPlan) : null;
  const basePrice = comboTier ? parseFloat(comboTier.price ?? comboTier.price) : (selectedPlan?.price ?? 0);
  const comboDiscountPrice = comboTier ? parseFloat(comboTier.discountPrice ?? comboTier.discount_price ?? comboTier.price) : null;
  const finalAmount = discountResult
    ? basePrice - (discountResult.discount_amount ?? 0)
    : basePrice;

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="max-w-xl mx-auto space-y-6">
          <h1 className="text-xl font-bold text-[#2d2d2d]">Comprar membresía</h1>

          <StepBar current={step} />

          {/* ── Step 1: Select plan ── */}
          {step === "select" && (
            <div className="space-y-5">
              {loadingPlans ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Basic plans */}
                  {basicPlans.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-[#94867a]/70">
                        Paquetes de clases
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {basicPlans.map((plan) => (
                          <PlanCard
                            key={plan.id}
                            plan={plan}
                            selected={selectedPlan?.id === plan.id && !comboMode}
                            onSelect={() => { setSelectedPlan(plan); setComboMode(false); setSelectedComplement(null); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Paquetes Completos (combo: plan + complemento) ── */}
                  {complements.length > 0 && comboPricing.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-[#94867a]/70">
                        Paquetes completos
                      </p>
                      <p className="text-[10px] text-[#94867a]/50 -mt-1 mb-2">
                        Elige un paquete de clases + un complemento de bienestar
                      </p>

                      {/* Combo tier cards (8, 12, 16 classes) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        {comboPricing.map((tier: any) => {
                          const cc = tier.classCount ?? tier.class_count;
                          const price = parseFloat(tier.price);
                          const dp = tier.discountPrice ?? tier.discount_price;
                          const discountP = dp ? parseFloat(dp) : null;
                          const isSelected = comboMode && (selectedPlan?.classLimit ?? selectedPlan?.class_limit) === cc;
                          return (
                            <button
                              key={cc}
                              type="button"
                              onClick={() => {
                                // Find a basic plan matching this class count
                                const match = basicPlans.find((p: any) => (p.classLimit ?? p.class_limit) === cc);
                                if (match) {
                                  setSelectedPlan(match);
                                  setComboMode(true);
                                  // Keep complement if already selected, otherwise clear
                                }
                              }}
                              className={cn(
                                "relative text-left rounded-2xl border p-4 transition-all duration-200",
                                isSelected
                                  ? "border-[#b5bf9c]/60 bg-gradient-to-br from-[#b5bf9c]/15 to-[#94867a]/5 shadow-[0_0_20px_rgba(181,191,156,0.2)]"
                                  : "border-[#94867a]/15 bg-[#94867a]/[0.04] hover:border-[#94867a]/25"
                              )}
                            >
                              {isSelected && (
                                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-br from-[#b5bf9c] to-[#94867a] flex items-center justify-center">
                                  <Check size={10} className="text-white" />
                                </span>
                              )}
                              <p className="text-[0.68rem] tracking-[0.12em] uppercase text-[#b5bf9c] font-medium mb-1">Paquete completo</p>
                              <p className="font-bold text-[#2d2d2d] text-sm">{cc} Clases + Complemento</p>
                              <p className="font-bold text-[#2d2d2d] text-lg mt-1">${price.toLocaleString("es-MX")} <span className="text-xs font-normal text-[#2d2d2d]/40">MXN</span></p>
                              {discountP && discountP < price && (
                                <p className="text-[0.72rem] text-[#b5bf9c] mt-0.5">Efectivo/transf: <strong>${discountP.toLocaleString("es-MX")}</strong></p>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Complement selector (shown when combo mode active) */}
                      {comboMode && selectedPlan && (
                        <div className="rounded-2xl border border-[#b5bf9c]/20 bg-[#b5bf9c]/[0.04] p-3 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b5bf9c]/70">
                            Elige tu complemento
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {complements.map((comp: any) => {
                              const isSel = selectedComplement?.id === comp.id;
                              return (
                                <button
                                  key={comp.id}
                                  type="button"
                                  onClick={() => setSelectedComplement(comp)}
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                    isSel
                                      ? "border-[#b5bf9c]/50 bg-[#b5bf9c]/10"
                                      : "border-[#94867a]/10 bg-white/50 hover:border-[#94867a]/20"
                                  )}
                                >
                                  {isSel && (
                                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#b5bf9c] to-[#94867a] flex items-center justify-center shrink-0">
                                      <Check size={10} className="text-white" />
                                    </span>
                                  )}
                                  {!isSel && <span className="w-5 h-5 rounded-full border border-[#94867a]/20 shrink-0" />}
                                  <div>
                                    <p className="text-sm font-semibold text-[#2d2d2d]">{comp.name}</p>
                                    <p className="text-xs text-[#94867a]/60">{comp.specialist}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedPlan && (!comboMode || selectedComplement) && (
                <div className="rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] p-4 space-y-4">
                  {/* Summary */}
                  <div className="text-xs text-[#2d2d2d]/60 space-y-1">
                    <p><strong className="text-[#2d2d2d]/80">{selectedPlan.name}</strong></p>
                    {selectedComplement && (
                      <p className="text-[#b5bf9c]">+ {selectedComplement.name} ({selectedComplement.specialist})</p>
                    )}
                    {comboDiscountPrice && comboDiscountPrice < basePrice && (
                      <p className="text-[#b5bf9c] text-[0.72rem]">Paga con efectivo/transferencia y obtén precio de ${comboDiscountPrice.toLocaleString("es-MX")}</p>
                    )}
                  </div>

                  {/* Discount code */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94867a]/50" />
                      <Input
                        className="pl-8 bg-[#94867a]/[0.06] border-[#94867a]/15 text-[#2d2d2d] placeholder:text-[#94867a]/40 uppercase"
                        placeholder="Código de descuento"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <button
                      onClick={() => validateCodeMutation.mutate()}
                      disabled={!discountCode || validateCodeMutation.isPending}
                      className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#94867a]/30 text-[#94867a] bg-[#94867a]/5 hover:bg-[#94867a]/10 transition-all disabled:opacity-40"
                    >
                      Aplicar
                    </button>
                  </div>
                  {discountResult && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                      <Check size={12} />
                      Descuento aplicado: -${discountResult.discount_amount} MXN
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between py-3 border-t border-[#94867a]/15">
                    <span className="text-sm text-[#2d2d2d]/60">Total a pagar</span>
                    <span className="text-2xl font-bold text-[#2d2d2d]">${finalAmount.toLocaleString("es-MX")} <span className="text-sm font-normal text-[#2d2d2d]/35">MXN</span></span>
                  </div>

                  <button
                    onClick={() => setStep("method")}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 transition-opacity"
                  >
                    Seleccionar método de pago <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Payment method ── */}
          {step === "method" && (
            <div className="space-y-4">
              <button onClick={() => setStep("select")} className="flex items-center gap-1.5 text-xs text-[#2d2d2d]/40 hover:text-[#2d2d2d]/70 transition-colors">
                <ArrowLeft size={13} /> Cambiar plan
              </button>

              {/* Selected plan summary */}
              <div className="rounded-2xl border border-[#94867a]/20 bg-[#94867a]/5 px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#2d2d2d]/70">{selectedPlan?.name}</span>
                  <span className="text-lg font-bold text-[#2d2d2d]">${finalAmount.toLocaleString("es-MX")} MXN</span>
                </div>
                {selectedComplement && (
                  <p className="text-xs text-[#b5bf9c] mt-1">+ {selectedComplement.name} ({selectedComplement.specialist})</p>
                )}
              </div>

              <p className="text-sm font-semibold text-[#2d2d2d]/80">¿Cómo quieres pagar?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Transfer */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("transfer")}
                  className={cn(
                    "flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all",
                    paymentMethod === "transfer"
                      ? "border-[#b5bf9c]/50 bg-[#b5bf9c]/10 shadow-[0_0_16px_rgba(181,191,156,0.15)]"
                      : "border-[#94867a]/15 bg-[#94867a]/[0.04] hover:border-[#94867a]/25"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    paymentMethod === "transfer" ? "bg-[#b5bf9c]/20 text-[#b5bf9c]" : "bg-[#94867a]/[0.06] text-[#2d2d2d]/40"
                  )}>
                    <Building2 size={22} />
                  </div>
                  <div className="text-center">
                    <p className={cn("text-sm font-semibold", paymentMethod === "transfer" ? "text-[#b5bf9c]" : "text-[#2d2d2d]/60")}>
                      Transferencia
                    </p>
                    <p className="text-[10px] text-[#2d2d2d]/30 mt-0.5">SPEI / banco</p>
                  </div>
                  {paymentMethod === "transfer" && (
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#b5bf9c] to-[#94867a] flex items-center justify-center">
                      <Check size={10} className="text-[#2d2d2d]" />
                    </span>
                  )}
                </button>

                {/* Cash in studio */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={cn(
                    "flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all",
                    paymentMethod === "cash"
                      ? "border-[#94867a]/50 bg-[#94867a]/10 shadow-[0_0_16px_rgba(148,134,122,0.15)]"
                      : "border-[#94867a]/15 bg-[#94867a]/[0.04] hover:border-[#94867a]/25"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    paymentMethod === "cash" ? "bg-[#94867a]/20 text-[#94867a]" : "bg-[#94867a]/[0.06] text-[#2d2d2d]/40"
                  )}>
                    <Banknote size={22} />
                  </div>
                  <div className="text-center">
                    <p className={cn("text-sm font-semibold", paymentMethod === "cash" ? "text-[#94867a]" : "text-[#2d2d2d]/60")}>
                      Efectivo
                    </p>
                    <p className="text-[10px] text-[#2d2d2d]/30 mt-0.5">Pagar en estudio</p>
                  </div>
                  {paymentMethod === "cash" && (
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#94867a] to-[#b5bf9c] flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={() => createOrderMutation.mutate()}
                disabled={createOrderMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {createOrderMutation.isPending
                  ? <Loader2 className="animate-spin" size={16} />
                  : <CreditCard size={16} />}
                {createOrderMutation.isPending ? "Procesando…" : "Confirmar"}
              </button>
            </div>
          )}

          {/* ── Step 3a: Bank details (transfer) ── */}
          {step === "bank" && bankDetails && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#b5bf9c]/20 bg-[#b5bf9c]/5 p-5 space-y-4">
                <p className="text-sm font-semibold text-[#b5bf9c]">Datos de transferencia SPEI</p>
                <p className="text-xs text-[#2d2d2d]/40">Realiza la transferencia con los siguientes datos. Luego sube tu comprobante.</p>
                {[
                  { label: "CLABE", value: bankDetails.clabe },
                  { label: "Cuenta", value: bankDetails.account_number ?? bankDetails.accountNumber },
                  { label: "Banco", value: bankDetails.bank },
                  { label: "Titular", value: bankDetails.account_holder ?? bankDetails.accountHolder },
                  { label: "Monto", value: `$${bankDetails.amount?.toLocaleString("es-MX")} MXN` },
                ].map(({ label, value }) => value && (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-[#94867a]/15 last:border-0">
                    <span className="text-xs text-[#2d2d2d]/40">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[#2d2d2d]/80">{value}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(String(value)); toast({ title: "Copiado" }); }}
                        className="text-[#b5bf9c]/50 hover:text-[#b5bf9c] transition-colors"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep("upload")}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 transition-opacity"
              >
                Ya realicé la transferencia →
              </button>
            </div>
          )}

          {/* ── Step 3b: Cash in studio ── */}
          {step === "cash" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#94867a]/20 bg-[#94867a]/5 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#94867a]/15 flex items-center justify-center mx-auto">
                  <Banknote size={26} className="text-[#94867a]" />
                </div>
                <p className="font-semibold text-[#2d2d2d]">Pago en el estudio</p>
                <p className="text-sm text-[#2d2d2d]/50">
                  Acércate a la recepción con el número de orden para completar tu pago en efectivo.
                </p>
                {orderId && (
                  <div className="bg-[#94867a]/[0.06] border border-[#94867a]/15 rounded-xl px-4 py-2 inline-block">
                    <p className="text-[10px] text-[#2d2d2d]/35 uppercase tracking-wider mb-0.5">Número de orden</p>
                    <p className="font-mono font-bold text-[#2d2d2d] text-sm">{orderId}</p>
                  </div>
                )}
                <p className="text-xs text-[#2d2d2d]/30">
                  Tu membresía se activará una vez que el equipo confirme el pago.
                </p>
              </div>
              <button
                onClick={() => window.location.replace("/app")}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 transition-opacity"
              >
                Ir a mi panel
              </button>
            </div>
          )}

          {/* ── Step 4: Upload proof ── */}
          {step === "upload" && (
            <div className="rounded-2xl border border-[#94867a]/15 bg-[#94867a]/[0.04] p-5 space-y-4">
              <p className="font-semibold text-[#2d2d2d]">Subir comprobante</p>
              <p className="text-xs text-[#2d2d2d]/40">Sube una foto o PDF de tu comprobante de transferencia.</p>

              <div
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 cursor-pointer text-center transition-all",
                  file
                    ? "border-[#4ade80]/40 bg-[#4ade80]/5"
                    : "border-[#94867a]/15 hover:border-[#94867a]/30 hover:bg-[#94867a]/3"
                )}
              >
                <input
                  type="file"
                  accept="image/*,.pdf"
                  ref={fileRef}
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <>
                    <Check size={24} className="text-[#4ade80] mx-auto mb-2" />
                    <p className="text-sm text-[#4ade80] font-medium">{file.name}</p>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-[#2d2d2d]/20 mx-auto mb-2" />
                    <p className="text-sm text-[#2d2d2d]/40">Haz clic o arrastra tu comprobante aquí</p>
                    <p className="text-xs text-[#2d2d2d]/20 mt-1">JPG, PNG o PDF</p>
                  </>
                )}
              </div>

              <button
                onClick={() => uploadProofMutation.mutate()}
                disabled={!file || uploadProofMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#94867a] to-[#b5bf9c] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {uploadProofMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploadProofMutation.isPending ? "Enviando…" : "Enviar comprobante"}
              </button>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === "done" && (
            <div className="rounded-2xl border border-[#4ade80]/20 bg-[#4ade80]/5 p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4ade80]/20 to-[#4ade80]/5 border border-[#4ade80]/30 flex items-center justify-center mx-auto">
                <CheckCircle size={30} className="text-[#4ade80]" />
              </div>
              <h2 className="text-xl font-bold text-[#2d2d2d]">¡Comprobante recibido!</h2>
              <p className="text-sm text-[#2d2d2d]/45 max-w-xs mx-auto">
                Verificaremos tu pago en breve. Recibirás una notificación cuando tu membresía esté activa.
              </p>
              <button
                onClick={() => window.location.replace("/app")}
                className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#94867a]/20 text-[#2d2d2d]/70 hover:text-[#2d2d2d] hover:border-[#94867a]/30 transition-all"
              >
                Ir a mi panel
              </button>
            </div>
          )}
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Checkout;
