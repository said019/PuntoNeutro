import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, CreditCard, Copy } from "lucide-react";

type Step = "select" | "bank" | "upload" | "done";

const Checkout = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<any>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
  });
  const plans: any[] = Array.isArray(plansData?.data) ? plansData.data : Array.isArray(plansData) ? plansData : [];

  const validateCodeMutation = useMutation({
    mutationFn: () =>
      api.post("/discount-codes/validate", { code: discountCode, planId: selectedPlan?.id }),
    onSuccess: (res) => setDiscountResult(res.data?.data ?? res.data),
    onError: () => toast({ title: "Código inválido", variant: "destructive" }),
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      api.post("/orders", {
        planId: selectedPlan.id,
        discountCode: discountResult?.code,
        paymentMethod: "transfer",
      }),
    onSuccess: (res) => {
      const data = res.data?.data ?? res.data;
      setOrderId(data.orderId ?? data.id);
      setBankDetails(data.bankDetails ?? data.bank_details);
      setStep("bank");
    },
    onError: (err: any) =>
      toast({ title: "Error al crear orden", description: err.response?.data?.message, variant: "destructive" }),
  });

  const uploadProofMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", file!);
      return api.post(`/orders/${orderId}/proof`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setStep("done");
    },
    onError: (err: any) =>
      toast({ title: "Error al subir comprobante", description: err.response?.data?.message, variant: "destructive" }),
  });

  const finalAmount = discountResult
    ? (selectedPlan?.price ?? 0) - (discountResult.discount_amount ?? 0)
    : selectedPlan?.price ?? 0;

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="max-w-2xl space-y-6">
          <h1 className="text-xl font-bold">Comprar membresía</h1>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-sm">
            {(["select", "bank", "upload", "done"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6 bg-border" />}
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Step 1: Select plan */}
          {step === "select" && (
            <div className="space-y-4">
              {loadingPlans ? (
                <p className="text-sm text-muted-foreground">Cargando planes...</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((plan) => (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all ${selectedPlan?.id === plan.id ? "border-primary ring-2 ring-primary" : "hover:border-primary/50"}`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          {plan.name}
                          {selectedPlan?.id === plan.id && <Check size={16} className="text-primary" />}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p className="text-2xl font-bold">${plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.currency}</span></p>
                        <p className="text-xs text-muted-foreground">{plan.duration_days} días</p>
                        {plan.class_limit && <p className="text-xs text-muted-foreground">{plan.class_limit} clases</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {selectedPlan && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código de descuento (opcional)"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    />
                    <Button variant="outline" onClick={() => validateCodeMutation.mutate()} disabled={!discountCode}>
                      Aplicar
                    </Button>
                  </div>
                  {discountResult && (
                    <Badge variant="default">Descuento aplicado: -${discountResult.discount_amount}</Badge>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>${finalAmount} MXN</span>
                  </div>
                  <Button className="w-full" onClick={() => createOrderMutation.mutate()} disabled={createOrderMutation.isPending}>
                    {createOrderMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <CreditCard size={16} className="mr-2" />}
                    Continuar con transferencia
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Bank details */}
          {step === "bank" && bankDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Datos de transferencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Realiza una transferencia SPEI con los siguientes datos:</p>
                {[
                  { label: "CLABE", value: bankDetails.clabe },
                  { label: "Banco", value: bankDetails.bank },
                  { label: "Titular", value: bankDetails.account_holder },
                  { label: "Monto", value: `$${bankDetails.amount} MXN` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{value}</span>
                      <button onClick={() => navigator.clipboard.writeText(String(value))}>
                        <Copy size={14} className="text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button className="w-full mt-2" onClick={() => setStep("upload")}>
                  Ya realicé la transferencia
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Upload proof */}
          {step === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle>Subir comprobante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Sube una foto o PDF de tu comprobante de transferencia.</p>
                <div className="space-y-2">
                  <Label>Comprobante</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    ref={fileRef}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!file || uploadProofMutation.isPending}
                  onClick={() => uploadProofMutation.mutate()}
                >
                  {uploadProofMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  Enviar comprobante
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold">¡Comprobante recibido!</h2>
                <p className="text-sm text-muted-foreground">
                  Verificaremos tu pago en breve. Recibirás una notificación cuando tu membresía esté activa.
                </p>
                <Button variant="outline" onClick={() => window.location.replace("/app/orders")}>
                  Ver mis órdenes
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Checkout;
