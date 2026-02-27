import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  format, addDays, startOfWeek, isSameDay, parseISO,
  isToday, addWeeks, subWeeks, differenceInMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import api from "@/lib/api";
import { BookingDialog, type ClassItem } from "@/components/BookingDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiClass {
  id: string;
  date: string;
  class_date: string;
  start_time: string;
  end_time: string;
  class_type_name: string;
  class_type_color: string;
  instructor_name: string;
  instructor_photo?: string;
  capacity: number;
  max_capacity?: number;
  current_bookings: number;
  status: string;
}

interface ScheduleClass {
  id: string;
  name: string;
  time: string;      // ISO 'YYYY-MM-DDTHH:MM'
  endTime: string;
  duration: number;
  instructor: string;
  instructorPhoto?: string | null;
  spots: number;
  maxSpots: number;
  color: string;
}

// ─── Fallback colors ──────────────────────────────────────────────────────────

const fallbackColors: Record<string, string> = {
  "Jumping Fitness": "#E15CB8",
  "Jumping Dance":   "#CA71E1",
  "Jump & Tone":     "#E7EB6E",
  "Strong Jump":     "#E15CB8",
  "Mindful Jump":    "#CA71E1",
  "Hot Pilates":     "#E7EB6E",
  "Flow Pilates":    "#E15CB8",
  "Pilates Mat":     "#CA71E1",
};
const DEFAULT_COLOR = "#A48550";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  try { return format(parseISO(iso), "HH:mm"); } catch { return iso.slice(11, 16); }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Tick every 30 s for real-time badges
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Reset filter when day changes
  useEffect(() => { setFilter("all"); }, [selectedDate]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate   = format(addDays(weekStart, 13), "yyyy-MM-dd");

  const { data: rawClasses, isLoading } = useQuery<ApiClass[]>({
    queryKey: ["public-classes", startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get(`/classes?start=${startDate}&end=${endDate}`);
      // API returns { data: [...] } or directly [...]
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    staleTime: 1000 * 60 * 2,
  });

  // ── Transform ──────────────────────────────────────────────────────────────
  const allClasses: ScheduleClass[] = useMemo(() => {
    if (!rawClasses) return [];
    return rawClasses
      .filter((c) => c.status !== "cancelled")
      .map((c) => {
        // start_time is now a full ISO string "YYYY-MM-DDTHH:mm" from the server
        const dateStr = (c.date || c.class_date || (c.start_time?.split("T")[0]) || "").split("T")[0];
        // Extract just the HH:mm part from whatever format start_time comes in
        const startTimePart = c.start_time?.includes("T")
          ? c.start_time.split("T")[1].slice(0, 5)
          : (c.start_time ?? "00:00").slice(0, 5);
        const endTimePart = c.end_time?.includes("T")
          ? c.end_time.split("T")[1].slice(0, 5)
          : (c.end_time ?? "").slice(0, 5);
        const available = (c.capacity ?? c.max_capacity ?? 0) - (c.current_bookings ?? 0);
        return {
          id:         c.id,
          name:       c.class_type_name ?? "Clase",
          time:       `${dateStr}T${startTimePart}`,
          endTime:    endTimePart,
          duration:   50,
          instructor: c.instructor_name ?? "Por confirmar",
          instructorPhoto: (c as any).instructor_photo ?? null,
          spots:      Math.max(0, available),
          maxSpots:   c.capacity ?? (c as any).max_capacity ?? 1,
          color:      c.class_type_color || fallbackColors[c.class_type_name] || DEFAULT_COLOR,
        };
      });
  }, [rawClasses]);

  // ── Week days ──────────────────────────────────────────────────────────────
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // ── Day classes ────────────────────────────────────────────────────────────
  const dayClasses = useMemo(
    () => allClasses.filter((c) => {
      try { return isSameDay(parseISO(c.time), selectedDate); } catch { return false; }
    }).sort((a, b) => a.time.localeCompare(b.time)),
    [allClasses, selectedDate]
  );

  // ── Unique types for filter pills ──────────────────────────────────────────
  const uniqueTypes = useMemo(
    () => [...new Set(dayClasses.map((c) => c.name))],
    [dayClasses]
  );

  const filteredClasses = useMemo(
    () => filter === "all" ? dayClasses : dayClasses.filter((c) => c.name === filter),
    [dayClasses, filter]
  );

  // ── Real-time status ───────────────────────────────────────────────────────
  const getTimeStatus = (cls: ScheduleClass) => {
    try {
      const classStart = parseISO(cls.time);
      if (!isToday(classStart)) return null;

      const dateStr     = cls.time.split("T")[0];
      const endDateTime = cls.endTime
        ? parseISO(`${dateStr}T${cls.endTime.slice(0, 5)}`)
        : new Date(classStart.getTime() + cls.duration * 60_000);

      if (now >= endDateTime) return { status: "past", label: "Finalizada" };
      if (now >= classStart) {
        const minsLeft = differenceInMinutes(endDateTime, now);
        return { status: "in-progress", label: `En curso · ${minsLeft} min restantes` };
      }
      const minsUntil = differenceInMinutes(classStart, now);
      if (minsUntil < 60) return { status: "upcoming", label: `En ${minsUntil} min` };
      const hours = Math.floor(minsUntil / 60);
      const mins  = minsUntil % 60;
      return { status: "upcoming", label: mins === 0 ? `En ${hours}h` : `En ${hours}h ${mins}m` };
    } catch { return null; }
  };

  // ── Dots per day ───────────────────────────────────────────────────────────
  const classCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    allClasses.forEach((c) => {
      const key = c.time.split("T")[0];
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [allClasses]);

  // ── Book handler ───────────────────────────────────────────────────────────
  const handleBook = (cls: ScheduleClass) => {
    setSelectedClass({
      id:         cls.id,
      time:       formatTime(cls.time),
      type:       cls.name,
      instructor: cls.instructor,
      spots:      cls.spots,
      duration:   `${cls.duration} min`,
      date:       parseISO(cls.time),
      color:      cls.color,
    });
    setDialogOpen(true);
  };

  // ── isPastDay ──────────────────────────────────────────────────────────────
  const isPastDay = (d: Date) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const check = new Date(d);  check.setHours(0, 0, 0, 0);
    return check < today;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section id="horario" className="scroll-mt-16">
      {/* ── Header dark ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1A0F0A] via-[#2A1C14] to-[#1A0F0A] relative overflow-hidden py-14 px-6 lg:px-[60px]">
        {/* Blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute top-0 right-0 w-56 h-56 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full bg-primary/6 blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Label + title */}
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-3 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Reserva tu lugar
          </div>
          <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4rem)] leading-[0.95] text-white mb-2">
            Horario de clases
          </h2>
          <div className="w-12 h-[2px] bg-primary mb-8" />

          {/* Week nav */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setWeekStart((p) => subWeeks(p, 1))}
              className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:border-primary hover:text-primary transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-white/80 text-sm font-medium capitalize min-w-[160px] text-center">
              {format(weekStart, "MMMM yyyy", { locale: es })}
            </span>
            <button
              onClick={() => setWeekStart((p) => addWeeks(p, 1))}
              className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:border-primary hover:text-primary transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day pills */}
          <div className="flex gap-2 flex-wrap">
            {weekDays.map((day) => {
              const past      = isPastDay(day);
              const selected  = isSameDay(day, selectedDate);
              const todayDay  = isToday(day);
              const dayKey    = format(day, "yyyy-MM-dd");
              const count     = classCountByDay[dayKey] ?? 0;
              const dots      = !past && count > 0
                ? Array.from({ length: Math.min(count, 4) })
                : [];

              return (
                <button
                  key={dayKey}
                  disabled={past}
                  onClick={() => setSelectedDate(day)}
                  className={[
                    "flex flex-col items-center px-3 py-2.5 rounded-2xl min-w-[54px] transition-all duration-200 select-none",
                    past     ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
                    selected ? "bg-primary text-white scale-[1.04] shadow-lg shadow-primary/30"
                    : todayDay ? "border border-primary/40 bg-white/5 text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/80",
                  ].join(" ")}
                >
                  <span className="text-[0.65rem] uppercase tracking-wide opacity-70">
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span className={[
                    "text-[1.15rem] font-bold leading-tight",
                    !selected && todayDay ? "text-primary" : "",
                  ].join(" ")}>
                    {format(day, "d")}
                  </span>
                  {/* Dots */}
                  <div className="flex gap-[3px] mt-1 h-[5px] items-center">
                    {dots.map((_, i) => (
                      <span
                        key={i}
                        className="w-[4px] h-[4px] rounded-full"
                        style={{
                          background: selected ? "#fff" : todayDay ? "#A48550" : "rgba(255,255,255,0.35)",
                        }}
                      />
                    ))}
                    {count > 4 && (
                      <span className="text-[0.45rem] leading-none" style={{ color: selected ? "#fff" : "#A48550" }}>+</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="py-10 px-6 lg:px-[60px] bg-background">
        <div className="max-w-5xl mx-auto">

          {/* Summary + filter pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredClasses.length} clase{filteredClasses.length !== 1 ? "s" : ""}</span>
              {" · "}
              <span className="capitalize">{format(selectedDate, "EEE d 'de' MMM", { locale: es })}</span>
            </p>

            {uniqueTypes.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                    filter === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  ].join(" ")}
                >
                  Todas
                </button>
                {uniqueTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={[
                      "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                      filter === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Classes grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Cargando clases…</span>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-sm">No hay clases para este día.</p>
              {filter !== "all" && (
                <button onClick={() => setFilter("all")} className="mt-3 text-primary text-sm underline underline-offset-2">
                  Ver todas
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => {
                const ts        = getTimeStatus(cls);
                const isPast    = ts?.status === "past";
                const inProg    = ts?.status === "in-progress";
                const full      = cls.spots === 0;
                const spotsPercent = ((cls.maxSpots - cls.spots) / cls.maxSpots) * 100;
                const barColor  = full ? "#E57373" : cls.spots <= 2 ? "#F0A050" : cls.color;

                return (
                  <div
                    key={cls.id}
                    className={[
                      "rounded-2xl border bg-card overflow-hidden transition-all duration-200",
                      "hover:-translate-y-0.5 hover:shadow-md",
                      inProg ? "ring-2 ring-primary/40 shadow-md" : "shadow-sm border-border/80",
                      (isPast || full) ? "opacity-55" : "",
                    ].join(" ")}
                  >
                    {/* Color bar */}
                    <div className="h-[3px]" style={{ background: isPast ? "#888" : cls.color }} />

                    <div className="p-4 space-y-3">
                      {/* Time badge (only today) */}
                      {ts && (
                        <div className={[
                          "inline-flex items-center gap-1.5 text-[0.68rem] font-semibold px-2 py-0.5 rounded-full",
                          isPast    ? "bg-muted text-muted-foreground"
                          : inProg  ? "bg-primary/15 text-primary"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                        ].join(" ")}>
                          {inProg && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                          {!inProg && !isPast && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                          {ts.label}
                        </div>
                      )}

                      {/* Name + book button */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[0.95rem] leading-tight">{cls.name}</h3>
                        <button
                          disabled={isPast || full}
                          onClick={() => !isPast && !full && handleBook(cls)}
                          className={[
                            "shrink-0 text-[0.7rem] font-semibold px-3 py-1 rounded-full transition-all",
                            isPast || full
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "text-primary-foreground hover:opacity-90 hover:scale-105",
                          ].join(" ")}
                          style={!isPast && !full ? { background: cls.color } : {}}
                        >
                          {isPast ? "Finalizada" : full ? "Llena" : "Reservar"}
                        </button>
                      </div>

                      {/* Time + instructor */}
                      <div className="flex flex-col gap-1 text-[0.78rem] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {formatTime(cls.time)}
                          {cls.endTime ? ` — ${cls.endTime.slice(0, 5)}` : ` · ${cls.duration} min`}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {cls.instructorPhoto ? (
                            <img
                              src={cls.instructorPhoto}
                              alt={cls.instructor}
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-border"
                            />
                          ) : (
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold text-white shrink-0"
                              style={{ background: isPast ? "#888" : cls.color }}
                            >
                              {cls.instructor.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                            </span>
                          )}
                          {cls.instructor}
                        </span>
                      </div>

                      {/* Capacity bar */}
                      <div className="space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${spotsPercent}%`, background: barColor }}
                          />
                        </div>
                        <p className="text-[0.7rem]" style={{ color: barColor }}>
                          {full
                            ? "Sin lugares"
                            : <><span className="font-semibold">{cls.spots}</span> / {cls.maxSpots} lugares</>
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CTA ─────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-8 text-center">
            <p className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-2">
              ¿Primera vez en Ophelia?
            </p>
            <h3 className="font-bebas text-[clamp(1.8rem,3vw,2.5rem)] leading-none text-foreground mb-2">
              Prueba una clase sin compromiso
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Reserva tu sesión muestra y descubre por qué cientos de mujeres eligen Ophelia.
            </p>
            <Link
              to="/auth/register?returnUrl=/app/book"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full text-[0.82rem] font-medium tracking-wider uppercase hover:-translate-y-1 hover:shadow-[0_15px_40px_hsl(var(--primary)/0.35)] transition-all"
            >
              Reservar mi primera clase
              <span className="text-[0.7rem]">↗</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Booking dialog */}
      <BookingDialog
        classData={selectedClass}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {}}
      />
    </section>
  );
}
