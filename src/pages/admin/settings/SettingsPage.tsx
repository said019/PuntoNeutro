import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users, MessageSquare, RefreshCw, Wifi, WifiOff, Pencil } from "lucide-react";

function normalizeQrDataUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  // Guard against Evolution "code" payloads that are not image data.
  if (trimmed.includes(",") && trimmed.includes("@")) return null;
  return `data:image/png;base64,${trimmed}`;
}

// Generic settings section — reads { data: <value_object> } from server
const SettingsSection = ({ settingKey, fields }: { settingKey: string; fields: { key: string; label: string; type?: string; multiline?: boolean }[] }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  const { data } = useQuery({
    queryKey: ["settings", settingKey],
    queryFn: async () => (await api.get(`/settings/${settingKey}`)).data,
    staleTime: Infinity, // don't re-fetch unless explicitly invalidated
  });

  useEffect(() => {
    // Server returns { data: <value_object> } where <value_object> is the saved JSON
    const raw = data?.data ?? data?.value ?? data?.data?.value;
    if (raw && typeof raw === "object" && !loaded) {
      setValues(raw);
      setLoaded(true);
    }
  }, [data, loaded]);

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/settings/${settingKey}`, { value: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", settingKey] });
      setLoaded(false); // allow re-sync after save
      toast({ title: "✅ Configuración guardada" });
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 max-w-md">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label>{f.label}</Label>
          {f.type === "boolean"
            ? <div className="flex items-center gap-3"><Switch checked={!!values[f.key]} onCheckedChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} /></div>
            : f.multiline
              ? <Textarea rows={5} value={values[f.key] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
              : <Input type={f.type ?? "text"} value={values[f.key] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
          }
        </div>
      ))}
      <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
        Guardar cambios
      </Button>
    </div>
  );
};

// WhatsApp Evolution API
const WhatsAppSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Connection ──────────────────────────────────────────────────────
  const { data: statusData, refetch, isFetching } = useQuery({
    queryKey: ["evolution-status"],
    queryFn: async () => (await api.get("/evolution/status")).data,
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d?.data?.state === "qr_pending" || d?.state === "qr_pending" ? 3000 : false;
    },
  });

  const status = (statusData as any)?.data ?? statusData ?? {};

  const connectMutation = useMutation({
    mutationFn: () => api.post("/evolution/connect"),
    onSuccess: (res: any) => {
      const d = res?.data?.data ?? res?.data ?? {};
      const qrCode = normalizeQrDataUrl(
        d.qrCode ??
        d.base64 ??
        d.code ??
        d.qrcode?.base64 ??
        d.qrcode?.code ??
        null,
      );
      // Immediately inject the QR code returned by connect into the status cache
      qc.setQueryData(["evolution-status"], { data: { connected: false, state: "qr_pending", qrCode, instanceExists: true } });
      refetch();
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al conectar", variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.post("/evolution/disconnect"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evolution-status"] }); toast({ title: "WhatsApp desconectado" }); },
    onError: () => toast({ title: "Error al desconectar", variant: "destructive" }),
  });

  // ── Test message ────────────────────────────────────────────────────
  const [testPhone, setTestPhone] = useState("");
  const testMutation = useMutation({
    mutationFn: () => api.post("/evolution/send-test", { phone: testPhone }),
    onSuccess: () => toast({ title: "✅ Mensaje de prueba enviado" }),
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al enviar prueba", variant: "destructive" }),
  });

  // ── Notify clients ──────────────────────────────────────────────────
  const [notifyFilter, setNotifyFilter] = useState<"all" | "members" | "active">("all");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyResult, setNotifyResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const notifyMutation = useMutation({
    mutationFn: () => api.post("/evolution/notify-clients", { filter: notifyFilter, message: notifyMessage }),
    onSuccess: (res) => {
      const d = (res as any).data?.data ?? (res as any).data;
      setNotifyResult(d);
      toast({ title: `✅ Enviados ${d.sent} / ${d.total}` });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al enviar notificaciones", variant: "destructive" }),
  });

  const filterLabels: Record<string, string> = {
    all: "Todos los clientes",
    members: "Solo con membresía activa",
    active: "Clientes activos (últimos 60 días)",
  };

  return (
    <div className="space-y-8 max-w-xl">
      {/* ── Status ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            {status.connected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-muted-foreground" />}
            Conexión WhatsApp
          </h3>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={status.connected ? "default" : "secondary"} className={status.connected ? "bg-green-500" : ""}>
            {status.connected ? "Conectado" : status.state === "qr_pending" ? "Esperando QR" : "Desconectado"}
          </Badge>
          {status.number && <span className="text-sm text-muted-foreground">{status.number}</span>}
        </div>

        {status.state === "qr_pending" && status.qrCode && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Escanea con WhatsApp para conectar:</p>
            <img src={status.qrCode} alt="QR Code" className="w-52 h-52 border border-border rounded-xl" />
            <p className="text-xs text-muted-foreground">Actualizando cada 3 segundos…</p>
          </div>
        )}

        <div className="flex gap-3">
          {!status.connected ? (
            <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              {status.state === "qr_pending" ? "Obtener nuevo QR" : "Conectar WhatsApp"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {/* ── Test message ────────────────────────────────────────────── */}
      {status.connected && (
        <div className="rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare size={16} />
            Mensaje de prueba
          </h3>
          <div className="flex gap-3">
            <Input
              placeholder="Ej. 5219991234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testPhone}
            >
              {testMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Incluye código de país. Ej: 521 + 10 dígitos para México.</p>
        </div>
      )}

      {/* ── Notify clients ──────────────────────────────────────────── */}
      {status.connected && (
        <div className="rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Users size={16} />
            Notificar a clientes
          </h3>

          <div className="space-y-1">
            <Label>Destinatarios</Label>
            <Select value={notifyFilter} onValueChange={(v) => setNotifyFilter(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                <SelectItem value="members">Solo con membresía activa</SelectItem>
                <SelectItem value="active">Clientes activos (últimos 60 días)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{filterLabels[notifyFilter]}</p>
          </div>

          <div className="space-y-1">
            <Label>Mensaje</Label>
            <Textarea
              placeholder="Escribe tu mensaje aquí…"
              rows={4}
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{notifyMessage.length} caracteres</p>
          </div>

          {notifyResult && (
            <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
              <p>✅ Enviados: <strong>{notifyResult.sent}</strong></p>
              {notifyResult.failed > 0 && <p>❌ Fallidos: <strong>{notifyResult.failed}</strong></p>}
              <p className="text-muted-foreground">Total: {notifyResult.total}</p>
            </div>
          )}

          <Button
            onClick={() => { setNotifyResult(null); notifyMutation.mutate(); }}
            disabled={notifyMutation.isPending || !notifyMessage.trim()}
            className="w-full"
          >
            {notifyMutation.isPending
              ? <><Loader2 className="animate-spin mr-2" size={14} /> Enviando…</>
              : <><Send size={14} className="mr-2" /> Enviar notificación</>
            }
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Notification Templates Section ─────────────────────────────────────────
const NOTIFICATION_TEMPLATES = [
  { key: "booking_confirmed",     label: "✅ Reserva confirmada",         icon: "📅", hint: "Se envía al confirmar una reserva. Vars: {name}, {class}, {date}, {time}" },
  { key: "booking_cancelled",     label: "❌ Reserva cancelada",          icon: "🚫", hint: "Se envía al cancelar. Vars: {name}, {class}, {date}, {creditRestored}" },
  { key: "membership_activated",  label: "🎉 Membresía activada",         icon: "🏋️", hint: "Se envía al activar membresía. Vars: {name}, {plan}, {startDate}, {endDate}" },
  { key: "transfer_rejected",     label: "⚠️ Transferencia rechazada",    icon: "💳", hint: "Se envía cuando se rechaza un comprobante. Vars: {name}, {reason}" },
  { key: "class_reminder",        label: "⏰ Recordatorio de clase",       icon: "🔔", hint: "Se envía horas antes de la clase. Vars: {name}, {class}, {time}" },
  { key: "renewal_reminder",      label: "🔄 Recordatorio de renovación", icon: "📆", hint: "Se envía cuando la membresía está por vencer. Vars: {name}, {plan}, {expiresAt}" },
  { key: "welcome",               label: "👋 Bienvenida",                 icon: "🌟", hint: "Se envía al registrarse. Vars: {name}" },
  { key: "password_reset",        label: "🔐 Recuperación de contraseña", icon: "🔑", hint: "Se envía para restablecer contraseña. Vars: {name}, {link}" },
];

const NotificationTemplates = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSubject, setEditSubject] = useState("");

  const { data: tplData } = useQuery({
    queryKey: ["settings", "notification_templates"],
    queryFn: async () => (await api.get("/settings/notification_templates")).data,
    staleTime: Infinity,
  });

  const { data: configData, refetch: refetchConfig } = useQuery({
    queryKey: ["settings", "notification_settings"],
    queryFn: async () => (await api.get("/settings/notification_settings")).data,
    staleTime: Infinity,
  });

  const [config, setConfig] = useState<Record<string, any>>({});
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const raw = configData?.data ?? configData?.value;
    if (raw && !configLoaded) { setConfig(raw); setConfigLoaded(true); }
  }, [configData, configLoaded]);

  const templates: Record<string, { subject?: string; body: string }> = tplData?.data ?? {};

  const saveTplMutation = useMutation({
    mutationFn: ({ key, subject, body }: { key: string; subject: string; body: string }) => {
      const updated = { ...templates, [key]: { subject, body } };
      return api.put("/settings/notification_templates", { value: updated });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "notification_templates"] });
      toast({ title: "✅ Plantilla guardada" });
      setEditingKey(null);
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const saveConfigMutation = useMutation({
    mutationFn: () => api.put("/settings/notification_settings", { value: config }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "notification_settings"] });
      setConfigLoaded(false);
      refetchConfig();
      toast({ title: "✅ Configuración guardada" });
    },
  });

  const openEdit = (key: string) => {
    const tpl = templates[key];
    setEditText(tpl?.body ?? "");
    setEditSubject(tpl?.subject ?? "");
    setEditingKey(key);
  };

  const currentTpl = NOTIFICATION_TEMPLATES.find((t) => t.key === editingKey);

  return (
    <div className="space-y-6 max-w-xl">
      {/* Config toggles */}
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-sm">Canales activos</h3>
        {[
          { key: "email_reminders", label: "Recordatorios por email" },
          { key: "whatsapp_reminders", label: "Recordatorios por WhatsApp" },
        ].map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <Switch checked={!!config[f.key]} onCheckedChange={(v) => setConfig((p) => ({ ...p, [f.key]: v }))} />
            <Label>{f.label}</Label>
          </div>
        ))}
        <div className="space-y-1 pt-1">
          <Label>Horas antes del recordatorio</Label>
          <Input type="number" className="w-28" value={config.reminder_hours_before ?? 2} onChange={(e) => setConfig((p) => ({ ...p, reminder_hours_before: Number(e.target.value) }))} />
        </div>
        <Button size="sm" onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
          {saveConfigMutation.isPending ? <Loader2 className="animate-spin mr-1" size={12} /> : null}Guardar
        </Button>
      </div>

      {/* Templates list */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm mb-3">Plantillas de mensajes</h3>
        {NOTIFICATION_TEMPLATES.map((t) => {
          const tpl = templates[t.key];
          return (
            <div key={t.key} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {tpl?.body ? tpl.body.slice(0, 80) + (tpl.body.length > 80 ? "…" : "") : <span className="italic opacity-60">Sin personalizar (usa plantilla por defecto)</span>}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="shrink-0" onClick={() => openEdit(t.key)}>
                <Pencil size={13} />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingKey} onOpenChange={(v) => !v && setEditingKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plantilla · {currentTpl?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{currentTpl?.hint}</p>
            <div className="space-y-1">
              <Label>Asunto (email)</Label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Asunto del email..." />
            </div>
            <div className="space-y-1">
              <Label>Cuerpo del mensaje (WhatsApp / Email)</Label>
              <Textarea rows={6} value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="Escribe el mensaje aquí..." />
              <p className="text-xs text-muted-foreground">{editText.length} caracteres</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKey(null)}>Cancelar</Button>
            <Button
              onClick={() => editingKey && saveTplMutation.mutate({ key: editingKey, subject: editSubject, body: editText })}
              disabled={saveTplMutation.isPending}
            >
              {saveTplMutation.isPending ? <Loader2 className="animate-spin mr-1" size={12} /> : null}Guardar plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SettingsPage = () => (
  <AuthGuard>
    <AdminLayout>
      <div className="admin-page max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Configuración</h1>
        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="policies">Políticas</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <SettingsSection
              settingKey="general_settings"
              fields={[
                { key: "studio_name", label: "Nombre del estudio" },
                { key: "address", label: "Dirección" },
                { key: "phone", label: "Teléfono de contacto" },
                { key: "instagram", label: "Instagram (@usuario)" },
                { key: "facebook", label: "Facebook (URL o usuario)" },
                { key: "timezone", label: "Zona horaria (ej: America/Mexico_City)" },
                { key: "currency", label: "Moneda (ej: MXN)" },
                { key: "maintenance_mode", label: "Modo mantenimiento", type: "boolean" },
              ]}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationTemplates />
          </TabsContent>

          <TabsContent value="policies">
            <SettingsSection
              settingKey="policies_settings"
              fields={[
                { key: "cancellation_policy", label: "Política de cancelación", multiline: true },
                { key: "terms_of_service", label: "Términos de servicio", multiline: true },
                { key: "privacy_policy", label: "Política de privacidad", multiline: true },
              ]}
            />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  </AuthGuard>
);

export default SettingsPage;
