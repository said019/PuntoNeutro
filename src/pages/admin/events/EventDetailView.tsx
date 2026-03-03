import { useState } from "react";
import {
  ArrowLeft, Edit, Globe, CheckCircle, XCircle, Clock, Users,
  MapPin, UserCircle, Calendar, ChevronRight, QrCode, Trash2,
  AlertTriangle, Bell, MessageSquare, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StudioEvent, EventRegistration, EVENT_TYPES } from "./types";
import EventTypeIcon from "./EventTypeIcon";
import { formatEventDate, formatCurrency, occupancyPercent, occupancyColor, calcCurrentPrice } from "./utils";

interface Props {
  event: StudioEvent;
  onBack: () => void;
  onEdit: () => void;
  onUpdateStatus: (status: StudioEvent["status"]) => void;
  onConfirmReg: (regId: string) => void;
  onCancelReg: (regId: string) => void;
  onCheckin: (regId: string) => void;
  onDelete: () => void;
}

const REG_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5" },
  pending:   { label: "Pendiente",  className: "text-[#fbbf24] border-[#fbbf24]/30 bg-[#fbbf24]/5" },
  waitlist:  { label: "Espera",     className: "text-[#CA71E1] border-[#CA71E1]/30 bg-[#CA71E1]/5" },
  cancelled: { label: "Cancelado",  className: "text-white/30 border-white/10 bg-white/3" },
  no_show:   { label: "No asistió", className: "text-[#f87171] border-[#f87171]/30 bg-[#f87171]/5" },
};

const TABS = ["Resumen", "Inscripciones", "Check-in", "Configuración"] as const;
type Tab = typeof TABS[number];

export default function EventDetailView({
  event, onBack, onEdit, onUpdateStatus, onConfirmReg, onCancelReg, onCheckin, onDelete,
}: Props) {
  const [tab, setTab] = useState<Tab>("Resumen");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const typeInfo = EVENT_TYPES.find((t) => t.value === event.type);
  const color = typeInfo?.color ?? "#E15CB8";
  const pct = occupancyPercent(event.registered, event.capacity);
  const barColor = occupancyColor(pct);
  const currentPrice = calcCurrentPrice(event);

  const confirmed   = event.registrations.filter((r) => r.status === "confirmed");
  const pending     = event.registrations.filter((r) => r.status === "pending");
  const waitlist    = event.registrations.filter((r) => r.status === "waitlist");
  const checkedIn   = event.registrations.filter((r) => r.checkedIn);
  const income      = confirmed.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      {/* ── Back + Edit header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Eventos
        </button>
        <ChevronRight size={14} className="text-white/20" />
        <span className="text-sm text-foreground truncate">{event.title}</span>
      </div>

      {/* ── Main card ── */}
      <div
        className="rounded-2xl border bg-white/[0.02] p-5 space-y-4"
        style={{ borderColor: `${color}22` }}
      >
        {/* Title row */}
        <div className="flex items-start gap-4">
          <EventTypeIcon type={event.type} size={22} withBg className="flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
              <span
                className={cn(
                  "text-[0.65rem] font-semibold border rounded-full px-2 py-0.5",
                  event.status === "published" ? "text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5"
                  : event.status === "draft" ? "text-white/50 border-white/15 bg-white/3"
                  : event.status === "cancelled" ? "text-[#f87171] border-[#f87171]/30 bg-[#f87171]/5"
                  : "text-[#CA71E1] border-[#CA71E1]/30 bg-[#CA71E1]/5"
                )}
              >
                {event.status === "published" ? "Publicado" : event.status === "draft" ? "Borrador"
                  : event.status === "cancelled" ? "Cancelado" : "Completado"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
          </div>
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: Calendar, text: formatEventDate(event.date) },
            { icon: Clock, text: `${event.startTime} – ${event.endTime}` },
            { icon: MapPin, text: event.location },
            { icon: UserCircle, text: event.instructor },
          ].map((chip) => (
            <span key={chip.text} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1">
              <chip.icon size={11} />
              {chip.text}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-foreground"
          >
            <Edit size={14} />
            Editar
          </button>
          {event.status === "draft" && (
            <button
              onClick={() => onUpdateStatus("published")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-[#4ade80]/10 border border-[#4ade80]/30 hover:bg-[#4ade80]/15 transition-all text-[#4ade80]"
            >
              <Globe size={14} />
              Publicar
            </button>
          )}
          {event.status === "published" && (
            <button
              onClick={() => onUpdateStatus("completed")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-[#CA71E1]/10 border border-[#CA71E1]/30 hover:bg-[#CA71E1]/15 transition-all text-[#CA71E1]"
            >
              <CheckCircle size={14} />
              Marcar completado
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Inscritos",   value: `${confirmed.length + pending.length}/${event.capacity}`, sub: `${pending.length} pendiente${pending.length !== 1 ? "s" : ""}`, color: "#E15CB8" },
            { label: "En espera",   value: String(waitlist.length),    sub: null, color: "#CA71E1" },
            { label: "Ingresos",    value: formatCurrency(income),      sub: `${confirmed.length} confirmados`, color: "#E7EB6E" },
            { label: "Precio",      value: event.price === 0 ? "Gratis" : formatCurrency(currentPrice), sub: event.earlyBirdPrice ? `Early Bird: ${formatCurrency(event.earlyBirdPrice)}` : null, color: color },
            { label: "Dto. Socias", value: event.memberDiscount > 0 ? `${event.memberDiscount}%` : "—", sub: null, color: "#4ade80" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.05]">
              <p className="text-[0.65rem] text-muted-foreground mb-0.5">{s.label}</p>
              <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
              {s.sub && <p className="text-[0.62rem] text-muted-foreground mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Occupancy bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Ocupación</span>
            <span style={{ color: barColor }}>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              tab === t ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "Inscripciones" ? `Inscripciones (${event.registrations.filter(r => r.status !== "cancelled").length})` : t}
          </button>
        ))}
      </div>

      {/* ── Tab: Resumen ── */}
      {tab === "Resumen" && (
        <div className="space-y-4">
          {event.requirements && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Requisitos</p>
              <p className="text-sm text-foreground">{event.requirements}</p>
            </div>
          )}
          {event.includes.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Incluye</p>
              <div className="space-y-2">
                {event.includes.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle size={13} className="text-[#4ade80] flex-shrink-0" />
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag, i) => (
                <span key={i} className="text-xs text-[#CA71E1] bg-[#CA71E1]/10 border border-[#CA71E1]/20 rounded-full px-2.5 py-1">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Inscripciones ── */}
      {tab === "Inscripciones" && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: `${confirmed.length} confirmado${confirmed.length !== 1 ? "s" : ""}`, color: "#4ade80" },
              { label: `${pending.length} pendiente${pending.length !== 1 ? "s" : ""}`,  color: "#fbbf24" },
              { label: `${waitlist.length} en espera`, color: "#CA71E1" },
            ].map((b) => (
              <span
                key={b.label}
                className="text-xs font-medium border rounded-full px-3 py-1"
                style={{ color: b.color, borderColor: `${b.color}40`, background: `${b.color}10` }}
              >
                {b.label}
              </span>
            ))}
          </div>

          {/* Registrations list */}
          {event.registrations.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Users size={32} className="mx-auto mb-2 text-white/20" />
              Sin inscripciones aún.
            </div>
          ) : (
            <div className="space-y-2">
              {event.registrations.map((reg) => {
                const badge = REG_STATUS_BADGE[reg.status] ?? REG_STATUS_BADGE.pending;
                return (
                  <div key={reg.id} className="flex items-center gap-3 rounded-xl p-3 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E15CB8]/15 text-[#E15CB8] text-xs font-bold flex-shrink-0">
                      {reg.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{reg.name}</p>
                      <p className="text-[0.7rem] text-muted-foreground truncate">{reg.email}</p>
                    </div>
                    <div className="hidden sm:block text-right mr-2">
                      <p className="text-sm font-semibold text-[#E7EB6E]">
                        {reg.amount === 0 ? "Gratis" : formatCurrency(reg.amount)}
                      </p>
                      {reg.paymentMethod && (
                        <p className="text-[0.65rem] text-muted-foreground capitalize">{reg.paymentMethod}</p>
                      )}
                    </div>
                    <span className={cn("text-[0.65rem] font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap", badge.className)}>
                      {badge.label}
                    </span>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {reg.status === "pending" && (
                        <>
                          <button
                            onClick={() => onConfirmReg(reg.id)}
                            className="rounded-lg px-2 py-1 text-[0.65rem] font-medium bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/15 transition-all"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => onCancelReg(reg.id)}
                            className="rounded-lg px-2 py-1 text-[0.65rem] font-medium bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/15 transition-all"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      {reg.status === "confirmed" && (
                        <button
                          onClick={() => onCancelReg(reg.id)}
                          className="rounded-lg px-2 py-1 text-[0.65rem] font-medium bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/15 transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                      {reg.status === "waitlist" && (
                        <button
                          onClick={() => onConfirmReg(reg.id)}
                          className="rounded-lg px-2 py-1 text-[0.65rem] font-medium bg-[#CA71E1]/10 border border-[#CA71E1]/30 text-[#CA71E1] hover:bg-[#CA71E1]/15 transition-all"
                        >
                          Inscribir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Check-in ── */}
      {tab === "Check-in" && (
        <div className="space-y-5">
          {/* Counter */}
          <div className="rounded-2xl border border-[#E7EB6E]/20 bg-[#E7EB6E]/[0.04] p-5 flex items-center gap-4">
            <div className="text-4xl font-bold text-[#E7EB6E]">{checkedIn.length}</div>
            <div>
              <p className="text-sm font-medium text-foreground">Check-ins realizados</p>
              <p className="text-xs text-muted-foreground">de {confirmed.length} confirmados</p>
            </div>
            <div className="ml-auto h-1.5 w-24 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#E7EB6E]"
                style={{ width: `${confirmed.length ? Math.round((checkedIn.length / confirmed.length) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* QR placeholder */}
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.01] p-6 flex flex-col items-center gap-3">
            <QrCode size={32} className="text-white/30" />
            <p className="text-sm text-muted-foreground">Escáner QR — Próximamente</p>
          </div>

          {/* Manual check-in */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-in manual</p>
            {confirmed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin inscritos confirmados.</p>
            ) : (
              confirmed.map((reg) => (
                <div key={reg.id} className="flex items-center gap-3 rounded-xl p-3 bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E15CB8]/15 text-[#E15CB8] text-xs font-bold flex-shrink-0">
                    {reg.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{reg.name}</p>
                    <p className="text-[0.7rem] text-muted-foreground">{reg.email}</p>
                  </div>
                  {reg.checkedIn ? (
                    <span className="text-[0.65rem] font-semibold border rounded-full px-2.5 py-1 text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5">
                      ✓ Registrado
                    </span>
                  ) : (
                    <button
                      onClick={() => onCheckin(reg.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/15 transition-all"
                    >
                      Check-in
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Configuración ── */}
      {tab === "Configuración" && (
        <div className="space-y-4">
          {/* Notifications */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Notificaciones</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Push Notification", icon: Bell, color: "#E15CB8" },
                { label: "WhatsApp Masivo",   icon: MessageSquare, color: "#4ade80" },
                { label: "Email a inscritas", icon: Mail, color: "#CA71E1" },
              ].map((btn) => (
                <button
                  key={btn.label}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border transition-all"
                  style={{ borderColor: `${btn.color}30`, color: btn.color, background: `${btn.color}08` }}
                >
                  <btn.icon size={14} />
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-[#f87171]/20 bg-[#f87171]/[0.03] p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-[#f87171]" />
              <p className="text-sm font-semibold text-[#f87171]">Zona de peligro</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {event.status !== "cancelled" && (
                <button
                  onClick={() => onUpdateStatus("cancelled")}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/15 transition-all"
                >
                  <XCircle size={14} />
                  Cancelar evento
                </button>
              )}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/15 transition-all"
                >
                  <Trash2 size={14} />
                  Eliminar evento
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#f87171]">¿Confirmar?</span>
                  <button
                    onClick={onDelete}
                    className="rounded-xl px-3 py-2 text-sm font-semibold bg-[#f87171] text-white hover:opacity-90 transition-all"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
