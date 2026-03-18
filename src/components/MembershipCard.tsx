/**
 * MembershipCard – Tarjeta visual de membresía
 * Paleta oficial Punto Neutro · Fuentes Gulfs + Alilato
 */

import { useMemo } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { Infinity as InfinityIcon, CalendarDays } from "lucide-react";
import { safeParse } from "@/lib/utils";
import type { ClientMembership } from "@/types/membership";
import imgPilates    from "@/assets/pilates_2320695.png";

// ─────────────────────────────────────────────
// Categoría
// ─────────────────────────────────────────────
type PlanCategory = "pilates" | "bienestar" | "other";

function detectCategory(planName: string): PlanCategory {
  const lower = planName.toLowerCase();
  if (lower.includes("body") || lower.includes("strong") || lower.includes("flex")) return "bienestar";
  if (lower.includes("pilates") || lower.includes("mat") || lower.includes("flow") || lower.includes("terapéutico") || lower.includes("clásico")) return "pilates";
  return "other";
}

// ─────────────────────────────────────────────
// Paleta Punto Neutro
// ─────────────────────────────────────────────
const PALETTE = {
  pilates: {
    gradient:     "linear-gradient(145deg, #1a1f12 0%, #2a3318 55%, #1a1f12 100%)",
    noise:        "rgba(181,191,156,0.04)",
    glow1:        "#b5bf9c",
    glow2:        "#ebede5",
    accent:       "#b5bf9c",
    accentLight:  "#ebede5",
    badge:        "rgba(181,191,156,0.18)",
    badgeText:    "#ebede5",
    badgeBorder:  "rgba(181,191,156,0.35)",
    label:        "Pilates",
    border:       "rgba(181,191,156,0.30)",
    stampBg:      "rgba(181,191,156,0.12)",
    stampBorder:  "rgba(181,191,156,0.30)",
    iconHighlight:"#b5bf9c",
    iconMuted:    "rgba(255,255,255,0.26)",
    progressFrom: "#b5bf9c",
    progressTo:   "#ebede5",
    divider:      "rgba(181,191,156,0.15)",
  },
  bienestar: {
    gradient:     "linear-gradient(145deg, #1f1a17 0%, #332c27 55%, #1f1a17 100%)",
    noise:        "rgba(148,134,122,0.04)",
    glow1:        "#94867a",
    glow2:        "#ebede5",
    accent:       "#94867a",
    accentLight:  "#ebede5",
    badge:        "rgba(148,134,122,0.18)",
    badgeText:    "#ebede5",
    badgeBorder:  "rgba(148,134,122,0.35)",
    label:        "Bienestar",
    border:       "rgba(148,134,122,0.30)",
    stampBg:      "rgba(148,134,122,0.12)",
    stampBorder:  "rgba(148,134,122,0.30)",
    iconHighlight:"#ebede5",
    iconMuted:    "rgba(255,255,255,0.28)",
    progressFrom: "#94867a",
    progressTo:   "#ebede5",
    divider:      "rgba(148,134,122,0.15)",
  },
  other: {
    gradient:     "linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 55%, #1a1a1a 100%)",
    noise:        "rgba(235,237,229,0.03)",
    glow1:        "#94867a",
    glow2:        "#b5bf9c",
    accent:       "#ebede5",
    accentLight:  "#b5bf9c",
    badge:        "rgba(235,237,229,0.14)",
    badgeText:    "#ebede5",
    badgeBorder:  "rgba(235,237,229,0.30)",
    label:        "Membresía",
    border:       "rgba(235,237,229,0.25)",
    stampBg:      "rgba(235,237,229,0.10)",
    stampBorder:  "rgba(235,237,229,0.28)",
    iconHighlight:"#ebede5",
    iconMuted:    "rgba(255,255,255,0.28)",
    progressFrom: "#94867a",
    progressTo:   "#b5bf9c",
    divider:      "rgba(235,237,229,0.13)",
  },
} satisfies Record<PlanCategory, {
  gradient: string; noise: string; glow1: string; glow2: string;
  accent: string; accentLight: string; badge: string; badgeText: string;
  badgeBorder: string; label: string; border: string; stampBg: string;
  stampBorder: string; iconHighlight: string; iconMuted: string;
  progressFrom: string; progressTo: string; divider: string;
}>;

// ─────────────────────────────────────────────
// Sello individual
// ─────────────────────────────────────────────
function Stamp({
  active,
  src,
  accent,
  stampBg,
  stampBorder,
  iconHighlight,
  iconMuted,
  size,
}: {
  active: boolean;
  src: string;
  accent: string;
  stampBg: string;
  stampBorder: string;
  iconHighlight: string;
  iconMuted: string;
  size: number;
}) {
  const pad = Math.round(size * 0.18);
  return (
    <div
      style={{
        width:  size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.35s, filter 0.35s, box-shadow 0.35s",
        background:  active ? stampBg  : "rgba(255,255,255,0.03)",
        border:      `1.5px solid ${active ? stampBorder : "rgba(255,255,255,0.07)"}`,
        boxShadow:   active ? `0 0 12px ${iconHighlight}66, inset 0 0 7px ${accent}22` : "none",
        opacity:     active ? 1 : 0.30,
        filter:      active ? "none" : "saturate(0.3)",
        padding:     pad,
      }}
    >
      <span
        aria-hidden
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: active ? iconHighlight : iconMuted,
          filter: active ? `drop-shadow(0 0 4px ${iconHighlight}aa)` : "none",
          WebkitMaskImage: `url(${src})`,
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          WebkitMaskSize: "contain",
          maskImage: `url(${src})`,
          maskRepeat: "no-repeat",
          maskPosition: "center",
          maskSize: "contain",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Grilla de sellos
// ─────────────────────────────────────────────
function StampGrid({
  classLimit,
  classesRemaining,
  category,
  pal,
}: {
  classLimit: number;
  classesRemaining: number;
  category: PlanCategory;
  pal: typeof PALETTE[PlanCategory];
}) {
  const used   = classLimit - classesRemaining;
  const stamps = useMemo(
    () => Array.from({ length: classLimit }, (_, i) => i),
    [classLimit],
  );

  // tamaño y columnas según cantidad
  const size = classLimit <= 4 ? 52 : classLimit <= 8 ? 44 : classLimit <= 12 ? 38 : classLimit <= 16 ? 32 : 26;
  const cols = classLimit <= 4 ? classLimit : classLimit <= 8 ? 4 : classLimit <= 12 ? 6 : classLimit <= 16 ? 4 : 5;

  const getImg = (_i: number) => {
    return imgPilates;
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: classLimit <= 8 ? "10px" : "7px",
        justifyItems: "center",
      }}
    >
      {stamps.map((i) => (
        <Stamp
          key={i}
          active={i >= used}
          src={getImg(i)}
          accent={pal.accent}
          stampBg={pal.stampBg}
          stampBorder={pal.stampBorder}
          iconHighlight={pal.iconHighlight}
          iconMuted={pal.iconMuted}
          size={size}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
interface MembershipCardProps {
  membership: ClientMembership & { classCategory?: string };
  expanded?: boolean;
}

export function MembershipCard({ membership }: MembershipCardProps) {
  const planName        = membership.plan_name  ?? membership.planName  ?? "Plan personalizado";
  const classLimit      = membership.class_limit ?? membership.classLimit ?? null;
  const classesRemaining = membership.classes_remaining ?? membership.classesRemaining ?? null;
  const endDate         = membership.end_date ?? membership.endDate ?? null;
  const isUnlimited     = classLimit === null;

  const category = detectCategory(planName);
  const pal      = PALETTE[category];

  const used          = classLimit !== null && classesRemaining !== null ? classLimit - classesRemaining : 0;
  const hasStampIcons = !isUnlimited && classLimit !== null && classLimit <= 20;
  const daysRemaining = endDate
    ? Math.max(differenceInCalendarDays(safeParse(endDate), new Date()), 0)
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl select-none"
      style={{
        background: pal.gradient,
        border:     `1.5px solid ${pal.border}`,
        boxShadow:  `0 8px 40px ${pal.glow1}20, 0 2px 12px rgba(0,0,0,0.5)`,
      }}
    >
      {/* ── Blobs decorativos ── */}
      <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full blur-[70px]"
           style={{ background: `${pal.glow1}20` }} />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full blur-[55px]"
           style={{ background: `${pal.glow2}16` }} />
      {/* Línea sutil horizontal tipo tarjeta */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px"
           style={{ background: `linear-gradient(90deg, transparent, ${pal.accent}40, transparent)` }} />

      {/* ── Cuerpo ── */}
      <div className="relative p-5 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          {/* Nombre + badge */}
          <div className="flex flex-col gap-2">
            <span
              className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background:   pal.badge,
                color:        pal.badgeText,
                border:       `1px solid ${pal.badgeBorder}`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: pal.badgeText }} />
              {pal.label}
            </span>

            <h3
              className="font-gulfs text-2xl leading-tight text-[#2d2d2d]"
              style={{ textShadow: `0 0 24px ${pal.accent}55` }}
            >
              {planName}
            </h3>
          </div>

          {/* Contador de clases */}
          {!isUnlimited && classesRemaining !== null && classLimit !== null && !hasStampIcons ? (
            <div
              className="shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2"
              style={{
                background: `${pal.accent}12`,
                border:     `1px solid ${pal.accent}28`,
                minWidth:   56,
              }}
            >
              <span
                className="font-gulfs text-3xl font-black leading-none"
                style={{ color: pal.accent, textShadow: `0 0 16px ${pal.accent}88` }}
              >
                {classesRemaining}
              </span>
              <span className="font-alilato text-[9px] uppercase tracking-widest text-[#2d2d2d]/40 mt-0.5 leading-tight text-center">
                de {classLimit}<br />clases
              </span>
            </div>
          ) : isUnlimited ? (
            <div
              className="shrink-0 flex items-center justify-center rounded-2xl h-14 w-14"
              style={{ background: `${pal.accent}12`, border: `1px solid ${pal.accent}28`, color: pal.accent }}
            >
              <InfinityIcon size={22} />
            </div>
          ) : null}
        </div>

        {/* ── Divider ── */}
        <div className="h-px w-full" style={{ background: pal.divider }} />

        {/* ── Sellos o barra ── */}
        {!isUnlimited && classLimit !== null && classesRemaining !== null ? (
          <div className="space-y-3">
            {classLimit <= 20 ? (
              <>
                <span className="sr-only">
                  {used} de {classLimit} clases usadas. {classesRemaining} restantes.
                </span>
                <StampGrid
                  classLimit={classLimit}
                  classesRemaining={classesRemaining}
                  category={category}
                  pal={pal}
                />
              </>
            ) : (
              /* Planes grandes (> 20): barra de progreso */
              <div className="space-y-2">
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width:      `${(classesRemaining / classLimit) * 100}%`,
                      background: `linear-gradient(90deg, ${pal.progressFrom}, ${pal.progressTo})`,
                      boxShadow:  `0 0 8px ${pal.progressFrom}88`,
                    }}
                  />
                </div>
                <p className="font-alilato text-[10px] text-[#2d2d2d]/30">
                  {used} de {classLimit} clases usadas
                </p>
              </div>
            )}
          </div>
        ) : isUnlimited ? (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: `${pal.accent}0d`, border: `1px solid ${pal.accent}1a` }}
          >
            <InfinityIcon size={20} style={{ color: pal.accent }} />
            <div>
              <p className="font-gulfs text-base text-[#2d2d2d]">Clases ilimitadas</p>
              <p className="font-alilato text-[11px] text-[#2d2d2d]/40">Sin límite de sesiones</p>
            </div>
          </div>
        ) : null}

        {/* ── Footer: vencimiento ── */}
        {endDate && (
          <>
            <div className="h-px w-full" style={{ background: pal.divider }} />
            <div className="flex items-center gap-2">
              <CalendarDays size={12} style={{ color: pal.accent, opacity: 0.8 }} />
              <span className="font-alilato text-[11px] text-[#2d2d2d]/40">
                Vence el{" "}
                <span className="text-[#2d2d2d]/65 font-medium">
                  {format(safeParse(endDate), "d 'de' MMMM yyyy", { locale: es })}
                </span>
                {daysRemaining !== null && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                    style={{
                      background: daysRemaining <= 5 ? "rgba(248,113,113,0.15)" : `${pal.accent}15`,
                      color:      daysRemaining <= 5 ? "#f87171" : pal.accentLight,
                    }}
                  >
                    {daysRemaining === 0 ? "vence hoy" : `${daysRemaining}d restantes`}
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MembershipCard;
