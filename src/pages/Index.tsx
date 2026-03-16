import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Schedule from "@/components/Schedule";
import { Dumbbell, Music, Waves, Flame, Zap, Heart, Activity, Sparkles, Flower2, type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
import ophelia14 from "@/assets/ophelia-14.jpg";
import ophelia15 from "@/assets/ophelia-15.jpg";
import ophelia28 from "@/assets/ophelia-28.jpg";
import ophelia31 from "@/assets/ophelia-31.jpg";
import ophelia32 from "@/assets/ophelia-32.jpg";
import ophelia38 from "@/assets/ophelia-38.jpg";
import ophelia50 from "@/assets/ophelia-50.jpg";
import opheliaLogo from "@/assets/ophelia-logo-full.png";
import imgTrampoline from "@/assets/trampoline_2982156.png";
import imgPilates from "@/assets/pilates_2320695.png";

/* ───── Types ───── */
type ClassTypeRow = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  category: "jumping" | "pilates" | "mixto";
  intensity: "ligera" | "media" | "pesada" | "todas";
  color: string;
  emoji: string;
  level: string;
  duration_min: number;
  capacity: number;
  is_active: boolean;
  sort_order: number;
};

type PackageRow = {
  id: string;
  name: string;
  num_classes: string;
  price: number;
  category: "jumping" | "pilates" | "mixtos";
  validity_days: number;
  is_active: boolean;
  sort_order: number;
};

type TrialPlanRow = {
  id: string;
  name: string;
  classCategory: "jumping" | "pilates";
  price: number;
  durationDays: number;
  classLimit: number;
  isNonTransferable: boolean;
  isNonRepeatable: boolean;
};

/* ───── Fallbacks ───── */
const FALLBACK_CLASS_TYPES: ClassTypeRow[] = [
  { id: "c1", name: "Jumping Fitness", subtitle: "Full Body Cardio", description: "Cardio en trampolín lleno de energía, música y diversión. Un entrenamiento completo que te hará volar.", category: "jumping", intensity: "media", color: "#E15CB8", emoji: "zap", level: "Todos los niveles", duration_min: 50, capacity: 10, is_active: true, sort_order: 1 },
  { id: "c2", name: "Strong Jump", subtitle: "Fuerza & Glúteo", description: "Clase enfocada en piernas y glúteos. Fuerza y resistencia sobre el trampolín con resultados visibles.", category: "jumping", intensity: "pesada", color: "#E15CB8", emoji: "dumbbell", level: "Intermedio", duration_min: 55, capacity: 10, is_active: true, sort_order: 2 },
  { id: "c3", name: "Jump & Tone", subtitle: "Tren Superior", description: "Brazos, abdomen y tren superior mientras mantienes el ritmo del jumping. Tonificación inteligente.", category: "jumping", intensity: "media", color: "#E15CB8", emoji: "activity", level: "Todos los niveles", duration_min: 55, capacity: 10, is_active: true, sort_order: 3 },
  { id: "c4", name: "Jump Dance", subtitle: "Baila & Salta", description: "Cardio al ritmo de la música. Saltar, bailar y disfrutar. La clase más divertida del estudio.", category: "jumping", intensity: "media", color: "#E15CB8", emoji: "music", level: "Todos los niveles", duration_min: 50, capacity: 10, is_active: true, sort_order: 4 },
  { id: "c5", name: "Pilates Mat", subtitle: "Core & Postura", description: "Conecta con tu cuerpo, fortalece tu core y mejora tu postura. Pilates en colchoneta desde la base.", category: "pilates", intensity: "ligera", color: "#CA71E1", emoji: "waves", level: "Principiante", duration_min: 50, capacity: 10, is_active: true, sort_order: 5 },
  { id: "c6", name: "Flow Pilates · Sculpt", subtitle: "Fluir & Esculpir", description: "Secuencias fluidas que conectan movimiento y respiración. Esculpe tu cuerpo con control y elegancia.", category: "pilates", intensity: "media", color: "#CA71E1", emoji: "sparkles", level: "Todos los niveles", duration_min: 55, capacity: 10, is_active: true, sort_order: 6 },
  { id: "c7", name: "Hot Pilates · Barralates", subtitle: "Alta Intensidad", description: "Pilates de alta intensidad con accesorios y movimientos de barre. Quema, fortalece, transforma.", category: "pilates", intensity: "pesada", color: "#CA71E1", emoji: "flame", level: "Avanzado", duration_min: 55, capacity: 10, is_active: true, sort_order: 7 },
  { id: "c8", name: "Yoga", subtitle: "Cuerpo, Mente & Espíritu", description: "Unión del cuerpo, mente y espíritu a través de asanas, pranayama y meditación. Tu momento de paz.", category: "mixto", intensity: "ligera", color: "#E7EB6E", emoji: "flower2", level: "Todos los niveles", duration_min: 60, capacity: 10, is_active: true, sort_order: 8 },
];

const FALLBACK_PACKAGES: PackageRow[] = [
  { id: "p1",  name: "4 Clases Jumping",      num_classes: "4",         price: 300,  category: "jumping", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p2",  name: "8 Clases Jumping",      num_classes: "8",         price: 560,  category: "jumping", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p3",  name: "12 Clases Jumping",     num_classes: "12",        price: 780,  category: "jumping", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p4",  name: "16 Clases Jumping",     num_classes: "16",        price: 960,  category: "jumping", validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p5",  name: "20 Clases Jumping",     num_classes: "20",        price: 1100, category: "jumping", validity_days: 30, is_active: true, sort_order: 5 },
  { id: "p6",  name: "Ilimitado Jumping",     num_classes: "ILIMITADO", price: 1000, category: "jumping", validity_days: 30, is_active: true, sort_order: 6 },
  { id: "p7",  name: "4 Clases Pilates",      num_classes: "4",         price: 300,  category: "pilates", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p8",  name: "8 Clases Pilates",      num_classes: "8",         price: 600,  category: "pilates", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p9",  name: "12 Clases Pilates",     num_classes: "12",        price: 840,  category: "pilates", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p10", name: "16 Clases Pilates",     num_classes: "16",        price: 1120, category: "pilates", validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p11", name: "Ilimitado Pilates",     num_classes: "ILIMITADO", price: 1000, category: "pilates", validity_days: 30, is_active: true, sort_order: 5 },
  { id: "p12", name: "8 Clases Mixto",        num_classes: "8",         price: 600,  category: "mixtos",  validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p13", name: "12 Clases Mixto",       num_classes: "12",        price: 860,  category: "mixtos",  validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p14", name: "16 Clases Mixto",       num_classes: "16",        price: 1120, category: "mixtos",  validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p15", name: "20 Clases Mixto",       num_classes: "20",        price: 1300, category: "mixtos",  validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p16", name: "Ilimitado Mixto",       num_classes: "ILIMITADO", price: 1000, category: "mixtos",  validity_days: 30, is_active: true, sort_order: 5 },
];

const FALLBACK_TRIAL_PLANS: TrialPlanRow[] = [
  { id: "trial-jumping", name: "Clase muestra Jumping", classCategory: "jumping", price: 65, durationDays: 7, classLimit: 1, isNonTransferable: true, isNonRepeatable: true },
  { id: "trial-pilates", name: "Clase muestra Pilates", classCategory: "pilates", price: 65, durationDays: 7, classLimit: 1, isNonTransferable: true, isNonRepeatable: true },
];

const GALLERY_IMAGES = [ophelia31, ophelia14, ophelia50, ophelia28, ophelia15, ophelia38, ophelia32];

/* ───── Helpers ───── */
const ICON_MAP: Record<string, LucideIcon> = {
  dumbbell: Dumbbell, music: Music, waves: Waves, flame: Flame,
  zap: Zap, heart: Heart, activity: Activity, sparkles: Sparkles,
  flower2: Flower2,
};
function getCardIcon(emoji?: string, title?: string): LucideIcon {
  if (emoji && ICON_MAP[emoji]) return ICON_MAP[emoji];
  const t = (title || "").toLowerCase();
  if (t.includes("yoga") || t.includes("mindful") || t.includes("meditation")) return Flower2;
  if (t.includes("fitness") || t.includes("tone") || t.includes("strong")) return Dumbbell;
  if (t.includes("dance") || t.includes("music")) return Music;
  if (t.includes("pilates") || t.includes("flow")) return Waves;
  if (t.includes("hot") || t.includes("burn")) return Flame;
  if (t.includes("jump") || t.includes("cardio")) return Zap;
  return Activity;
}

function normalizeVideoUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/drive/video/")) return url;
  const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)\/preview/);
  if (m) return `/api/drive/video/${m[1]}`;
  return url;
}

function clampFocus(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ═══════════════════════════════════════════════════════════
   INDEX — Redesign based on owner feedback
   ═══════════════════════════════════════════════════════════ */
const Index = () => {
  const [navScrolled, setNavScrolled] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>(FALLBACK_CLASS_TYPES);
  const [packages, setPackages] = useState<PackageRow[]>(FALLBACK_PACKAGES);
  const [activePkgTab, setActivePkgTab] = useState<"jumping" | "pilates" | "mixtos">("jumping");
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  const [flippedCard, setFlippedCard] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const isAdminRole = ["admin", "super_admin", "instructor", "reception"].includes(user?.role ?? "");
  const membershipCtaPath = isAuthenticated
    ? (isAdminRole ? "/admin/dashboard" : "/app/checkout")
    : "/auth/register";

  const [instructors, setInstructors] = useState<{
    id: string;
    displayName: string;
    bio?: string;
    specialties?: string | string[];
    photoUrl?: string;
    photoFocusX?: number;
    photoFocusY?: number;
  }[]>([]);

  /* ── Queries ── */
  const { data: videoCardsData } = useQuery<{ data: { id: number; title: string; description: string; emoji: string; video_url?: string | null; thumbnail_url?: string | null }[] }>({
    queryKey: ["homepage-video-cards"],
    queryFn: async () => (await api.get("/homepage-video-cards")).data,
    staleTime: 1000 * 60 * 5,
  });
  const videoCards = videoCardsData?.data?.length
    ? videoCardsData.data
    : [
        { id: 1, title: "Jumping Fitness", description: "Cardio de alta intensidad en trampolín con música que te hará volar.", emoji: "dumbbell", video_url: null, thumbnail_url: null },
        { id: 2, title: "Jumping Dance",   description: "Coreografías sobre el trampolín que combinan ritmo y diversión.",     emoji: "music", video_url: null, thumbnail_url: null },
        { id: 3, title: "Pilates Flow",    description: "Secuencias fluidas para fortalecer tu core y mejorar postura.",        emoji: "waves", video_url: null, thumbnail_url: null },
      ];

  const { data: plansData } = useQuery<{ data: any[] }>({
    queryKey: ["plans-public"],
    queryFn: async () => (await api.get("/plans")).data,
    staleTime: 1000 * 60 * 5,
  });
  const trialPlans: TrialPlanRow[] = (() => {
    const rows = Array.isArray(plansData?.data) ? plansData.data : [];
    const byCategory = new Map<"jumping" | "pilates", TrialPlanRow>();
    for (const row of rows) {
      const isActive = (row?.isActive ?? row?.is_active) !== false;
      if (!isActive) continue;
      const category = String(row?.classCategory ?? row?.class_category ?? "").toLowerCase();
      if (category !== "jumping" && category !== "pilates") continue;
      const repeatKey = String(row?.repeatKey ?? row?.repeat_key ?? "");
      const classLimit = Number(row?.classLimit ?? row?.class_limit ?? 0);
      const price = Number(row?.price ?? 0);
      const looksLikeTrial = repeatKey.startsWith("trial_single_session") || (classLimit === 1 && Math.abs(price - 65) < 0.01);
      if (!looksLikeTrial || byCategory.has(category)) continue;
      byCategory.set(category, {
        id: String(row?.id ?? category + "-trial"),
        name: String(row?.name ?? "Clase muestra " + (category === "jumping" ? "Jumping" : "Pilates")),
        classCategory: category,
        price,
        durationDays: Number(row?.durationDays ?? row?.duration_days ?? 7) || 7,
        classLimit: classLimit || 1,
        isNonTransferable: Boolean(row?.isNonTransferable ?? row?.is_non_transferable),
        isNonRepeatable: Boolean(row?.isNonRepeatable ?? row?.is_non_repeatable),
      });
    }
    const ordered = ["jumping", "pilates"].map((cat) => byCategory.get(cat as "jumping" | "pilates")).filter(Boolean) as TrialPlanRow[];
    return ordered.length > 0 ? ordered : FALLBACK_TRIAL_PLANS;
  })();

  /* ── Effects ── */
  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    api.get<{ data: ClassTypeRow[] }>("/admin/class-types").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data.filter((c) => c.is_active) : [];
      if (rows.length > 0) setClassTypes(rows);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ data: PackageRow[] }>("/packages").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length > 0) setPackages(rows);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/public/instructors").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length > 0) setInstructors(rows);
    }).catch(() => {});
  }, []);

  // Gallery auto-rotate
  useEffect(() => {
    const timer = setInterval(() => {
      setGalleryIdx((prev) => (prev + 1) % GALLERY_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV — Logo más grande ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-6 lg:px-[60px] py-3 sm:py-4 transition-all duration-400 ${
          navScrolled
            ? "bg-background/92 backdrop-blur-[20px]"
            : "bg-gradient-to-b from-background/95 to-transparent"
        }`}
      >
        <a href="#" className="flex items-center">
          <img src={opheliaLogo} alt="Ophelia Studio" className="h-16 sm:h-20 lg:h-24 w-auto object-contain" />
        </a>
        <ul className="hidden lg:flex gap-8 list-none">
          {[
            { label: "Clases", id: "clases" },
            { label: "Horario", id: "horario" },
            { label: "Paquetes", id: "membresias" },
            { label: "Instructoras", id: "instructoras" },
            { label: "Galería", id: "galeria" },
            { label: "Contacto", id: "contacto" },
          ].map((item) => (
            <li key={item.id}>
              <button
                onClick={() => scrollTo(item.id)}
                className="text-muted-foreground text-[0.82rem] font-normal tracking-widest uppercase hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        {isAuthenticated && user ? (
          <button
            onClick={() => navigate(["admin","super_admin","instructor","reception"].includes(user.role) ? "/admin/dashboard" : "/app")}
            className="flex items-center gap-2 bg-primary/15 border border-primary/40 text-primary px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[0.75rem] sm:text-[0.82rem] font-medium tracking-wide hover:bg-primary/25 transition-all max-w-[190px]"
          >
            <span className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[0.75rem] font-bold uppercase">
              {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
            </span>
            <span className="truncate">
              {["admin","super_admin"].includes(user.role) ? "Admin" : user.displayName?.split(" ")[0] ?? "Mi cuenta"}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => navigate("/auth/login")}
              className="hidden sm:block text-muted-foreground text-[0.82rem] font-normal tracking-widest uppercase hover:text-foreground transition-colors bg-transparent border-none cursor-pointer px-2"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => navigate("/auth/register")}
              className="bg-primary text-primary-foreground px-4 sm:px-7 py-2.5 sm:py-3 rounded-full text-[0.75rem] sm:text-[0.82rem] font-medium tracking-wider uppercase hover:scale-[1.04] hover:shadow-[0_0_30px_hsl(var(--pink-glow)/0.35)] transition-all"
            >
              Unirse
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO — Full-width photo, "Where Focus Goes, Energy Flows" ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={ophelia31} alt="Alumnas en Ophelia Studio" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        </div>
        <div className="relative z-10 text-center px-6 lg:px-[60px] pt-[140px] pb-20 max-w-[900px] mx-auto">
          <p className="font-gulfs italic text-[clamp(1.1rem,2.2vw,1.6rem)] text-[#F9F7E8]/80 mb-6 animate-fade-up delay-200 tracking-wide">
            &ldquo;Where Focus Goes, Energy Flows&rdquo;
          </p>
          <h1 className="font-bebas text-[clamp(3.5rem,8vw,7rem)] leading-[0.9] tracking-tight text-[#F9F7E8] animate-fade-up delay-400 mb-8">
            LIBERA TU ENERGÍA<br />
            <span className="text-primary">Y DESCUBRE</span><br />
            <span style={{ WebkitTextStroke: "2px rgba(249,247,232,0.5)", color: "transparent" }}>LO FUERTE QUE ERES</span>
          </h1>
          <p className="text-[clamp(0.95rem,1.3vw,1.15rem)] text-[#F9F7E8]/75 leading-[1.8] max-w-[600px] mx-auto mb-10 animate-fade-up delay-600">
            Un espacio donde cada entrenamiento se celebra, cada logro importa
            y cada persona encuentra su propio ritmo.<br />
            <span className="text-primary font-medium">Aquí no solo entrenas… aquí vuelves a ti.</span>
          </p>
          <div className="flex gap-4 justify-center items-center flex-wrap animate-fade-up delay-800">
            <button
              onClick={() => navigate("/auth/register")}
              className="bg-primary text-primary-foreground px-10 py-[18px] rounded-full text-[0.9rem] font-medium tracking-wider uppercase inline-flex items-center gap-[10px] hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_20px_50px_hsl(var(--primary)/0.4)] transition-all"
            >
              Comenzar hoy
              <span className="w-[22px] h-[22px] bg-primary-foreground/20 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
            </button>
            <button
              onClick={() => scrollTo("clases")}
              className="text-[#F9F7E8] text-[0.85rem] font-normal tracking-wider uppercase flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer"
            >
              <span className="w-[42px] h-[42px] border border-[#F9F7E8]/30 rounded-full flex items-center justify-center text-[0.8rem]">▶</span>
              Ver clases
            </button>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse-dot z-10">
          <div className="w-[1px] h-10 bg-gradient-to-b from-transparent to-[#F9F7E8]/40" />
          <span className="text-[0.6rem] tracking-[0.2em] uppercase text-[#F9F7E8]/40">Scroll</span>
        </div>
      </section>

      {/* ── DISCIPLINAS — JUMP · PILATES · YOGA ── */}
      <div className="bg-secondary border-t border-b border-border">
        <div className="grid grid-cols-3 text-center">
          {([
            { name: "JUMP", color: "#E15CB8", Icon: Zap, desc: "Cardio en trampolín" },
            { name: "PILATES", color: "#CA71E1", Icon: Activity, desc: "Fuerza y control" },
            { name: "YOGA", color: "#E7EB6E", Icon: Flower2, desc: "Cuerpo, mente y espíritu" },
          ] as const).map((d, i) => (
            <div key={i} className="py-8 sm:py-10 px-3 sm:px-5 border-r border-border last:border-r-0 hover:bg-[hsl(var(--primary)/0.03)] transition-colors group cursor-default">
              <div className="flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: d.color + "15", border: "1px solid " + d.color + "30" }}>
                  <d.Icon size={28} className="sm:hidden" style={{ color: d.color }} strokeWidth={1.8} />
                  <d.Icon size={32} className="hidden sm:block" style={{ color: d.color }} strokeWidth={1.8} />
                </div>
              </div>
              <div className="font-bebas text-[1.4rem] sm:text-[2rem] leading-none mb-1 sm:mb-2" style={{ color: d.color }}>{d.name}</div>
              <div className="text-[0.65rem] sm:text-[0.78rem] text-muted-foreground tracking-wide">{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MANIFIESTO ── */}
      <section className="py-20 lg:py-28 px-6 lg:px-[60px] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10 max-w-[800px] mx-auto text-center">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-6 flex items-center justify-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Nuestro manifiesto
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
          </div>
          <h2 className="font-bebas text-[clamp(2.5rem,4vw,4rem)] leading-[0.95] text-foreground mb-8">
            MÁS QUE UN ESTUDIO,<br /><span className="text-primary">UN ESPACIO PARA TI</span>
          </h2>
          <p className="text-[1.05rem] text-muted-foreground leading-[1.9] mb-6">
            Ophelia nació de la idea de crear un lugar donde cada mujer pueda
            reconectar con su fuerza, celebrar su cuerpo y encontrar una comunidad
            que la impulse. No importa tu nivel, tu edad ni tu experiencia —
            aquí cada salto cuenta, cada respiración importa.
          </p>
          <p className="text-[1rem] text-foreground/80 leading-[1.8] italic font-gulfs">
            &ldquo;Creemos en el poder de moverse con intención, en entrenar con alegría
            y en que la mejor versión de ti misma se construye salto a salto.&rdquo;
          </p>
        </div>
      </section>

      {/* ── GALERÍA ROTATIVA ── */}
      <section id="galeria" className="py-16 lg:py-24 px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Galería
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">
              VIVE LA<br />EXPERIENCIA
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Cada sesión es única. Capturamos los mejores momentos de nuestras alumnas.
            </p>
          </div>
          {/* Main carousel */}
          <div className="relative rounded-3xl overflow-hidden aspect-[16/7] mb-5 group">
            {GALLERY_IMAGES.map((img, i) => (
              <img key={i} src={img} alt={"Ophelia Studio momento " + (i + 1)}
                className={"absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 " + (i === galleryIdx ? "opacity-100" : "opacity-0")} />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <button onClick={() => setGalleryIdx((prev) => (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setGalleryIdx((prev) => (prev + 1) % GALLERY_IMAGES.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60">
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {GALLERY_IMAGES.map((_, i) => (
                <button key={i} onClick={() => setGalleryIdx(i)}
                  className={"w-2 h-2 rounded-full transition-all " + (i === galleryIdx ? "bg-primary w-6" : "bg-white/50 hover:bg-white/70")} />
              ))}
            </div>
          </div>
          {/* Thumbnails */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {GALLERY_IMAGES.map((img, i) => (
              <button key={i} onClick={() => setGalleryIdx(i)}
                className={"rounded-xl overflow-hidden aspect-square transition-all " + (i === galleryIdx ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[0.95]" : "opacity-50 hover:opacity-80")}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLASES — 8 clases, card flip ── */}
      <section id="clases" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Nuestras modalidades
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">NUESTRAS CLASES</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Toca una clase para descubrir de qué se trata. Cada semana cambian los tipos, no los horarios.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 mb-10 text-[0.72rem] tracking-wider uppercase">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#E15CB8]" /> Jumping</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#CA71E1]" /> Pilates</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#E7EB6E]" /> Mixto / Yoga</span>
          </div>
        </div>
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {classTypes.slice(0, 8).map((c) => {
            const catBorder: Record<string, string> = { jumping: "#E15CB8", pilates: "#CA71E1", mixto: "#E7EB6E" };
            const accent = catBorder[c.category] ?? "#E15CB8";
            const isFlipped = flippedCard === c.id;
            const Icon = getCardIcon(c.emoji, c.name);
            return (
              <div key={c.id} className="cursor-pointer" style={{ perspective: "1000px" }}
                onClick={() => setFlippedCard(isFlipped ? null : c.id)}>
                <div style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)", transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                  {/* Front */}
                  <div className="rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center min-h-[220px]"
                    style={{ backfaceVisibility: "hidden", border: "1px solid " + accent + "40", background: accent + "08" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: accent + "20", border: "1px solid " + accent + "30" }}>
                      <Icon size={28} style={{ color: accent }} />
                    </div>
                    <h3 className="font-syne font-bold text-[1.05rem] text-foreground leading-tight">{c.name}</h3>
                    {c.subtitle && <p className="text-[0.78rem] font-medium" style={{ color: accent }}>{c.subtitle}</p>}
                    <div className="flex gap-3 text-[0.68rem] text-muted-foreground mt-auto">
                      <span>{c.duration_min} min</span><span>·</span><span>{c.level}</span>
                    </div>
                    <p className="text-[0.65rem] text-muted-foreground/60 mt-1">Toca para ver más →</p>
                  </div>
                  {/* Back */}
                  <div className="rounded-2xl p-6 flex flex-col justify-center gap-3 min-h-[220px] absolute inset-0"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", border: "2px solid " + accent, background: "linear-gradient(135deg, " + accent + "15, " + accent + "05)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} style={{ color: accent }} />
                      <h3 className="font-syne font-bold text-[0.95rem] text-foreground">{c.name}</h3>
                    </div>
                    <p className="text-[0.84rem] text-muted-foreground leading-[1.65] flex-1">{c.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: accent + "25" }}>
                      <span className="text-[0.7rem]" style={{ color: accent }}>{c.category.toUpperCase()}</span>
                      <span className="text-[0.7rem] text-muted-foreground">Max. {c.capacity} personas</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[0.72rem] text-muted-foreground text-center mt-8 tracking-wide">
          CADA SEMANA CAMBIAN LOS TIPOS DE CLASES, NO LOS HORARIOS · TOCA UNA TARJETA PARA VER MÁS
        </p>
      </section>

      {/* ── HORARIO ── */}
      <Schedule />

      {/* ── VIDEOS ── */}
      <section id="videos" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Conoce la experiencia
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">MIRA CÓMO<br />SE VIVE</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Descubre la energía de cada clase. Fragmentos de lo que te espera en Ophelia.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {videoCards.map((v) => {
              const videoUrl = normalizeVideoUrl(v.video_url);
              const isPlaying = playingVideoId === v.id;
              const hasThumbnail = Boolean(v.thumbnail_url);
              const handlePlay = () => {
                if (!videoUrl) return;
                setPlayingVideoId(v.id);
                setTimeout(() => { const el = videoRefs.current[v.id]; if (el) el.play().catch(() => {}); }, 100);
              };
              return (
                <div key={v.id} className="group rounded-3xl overflow-hidden bg-secondary border border-border hover:border-primary/50 transition-all">
                  <div className="relative aspect-video bg-gradient-to-br from-[#1F0047] via-[#2d0a40] to-[#1a0035] flex items-center justify-center overflow-hidden">
                    {videoUrl && isPlaying ? (
                      <video ref={(el) => { videoRefs.current[v.id] = el; }} src={videoUrl}
                        className="absolute inset-0 w-full h-full object-contain bg-black"
                        controls autoPlay playsInline title={v.title} onEnded={() => setPlayingVideoId(null)} />
                    ) : videoUrl ? (
                      <button onClick={handlePlay} className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none" aria-label={"Reproducir " + v.title}>
                        {hasThumbnail ? (
                          <img src={v.thumbnail_url!} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <video src={videoUrl} className="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none" preload="metadata" muted playsInline />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/80 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_40px_hsl(var(--primary)/0.4)]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <>
                        {hasThumbnail ? (
                          <img src={v.thumbnail_url!} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.15)_0%,transparent_65%)]" />
                        )}
                        <div className="relative flex flex-col items-center gap-3">
                          <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_40px_hsl(var(--primary)/0.3)]">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-primary ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                          <span className="text-[0.65rem] tracking-[0.15em] uppercase text-primary/60 font-medium">Video próximamente</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {(() => { const Ic = getCardIcon(v.emoji, v.title); return <Ic size={20} className="text-primary flex-shrink-0" />; })()}
                      <h3 className="font-syne font-bold text-[1rem] text-foreground">{v.title}</h3>
                    </div>
                    <p className="text-[0.82rem] text-muted-foreground leading-[1.6]">{v.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PAQUETES ── */}
      <section id="membresias" className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Inversión
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">ELIGE TU<br />PAQUETE</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Paquetes mensuales y clase muestra de $65. Compra directo desde la app.
            </p>
          </div>
          {/* Clase muestra */}
          <div className="rounded-3xl border border-primary/30 bg-background mb-8 p-5 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-5">
              <div>
                <p className="text-[0.68rem] tracking-[0.15em] uppercase text-primary font-medium">Clase muestra</p>
                <h3 className="font-syne font-bold text-[1.4rem] text-foreground mt-1">1 por persona en cada modalidad</h3>
              </div>
              <p className="text-[0.8rem] text-muted-foreground lg:text-right">
                1 Jumping + 1 Pilates por persona · $65 cada clase · no transferible · no repetible
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trialPlans.map((plan) => {
                const isJumping = plan.classCategory === "jumping";
                const accent = isJumping ? "#E15CB8" : "#CA71E1";
                const icon = isJumping ? imgTrampoline : imgPilates;
                return (
                  <div key={plan.id} className="rounded-2xl border border-border bg-secondary p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl border flex items-center justify-center" style={{ borderColor: accent + "55", background: accent + "18" }}>
                        <img src={icon} alt="" className="h-8 w-8 object-contain" />
                      </div>
                      <div>
                        <p className="text-[0.7rem] tracking-[0.15em] uppercase" style={{ color: accent }}>{isJumping ? "Jumping" : "Pilates"}</p>
                        <h4 className="font-syne font-bold text-[1rem] text-foreground">{plan.name}</h4>
                      </div>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="font-bebas text-[2.8rem] leading-none text-primary">${plan.price.toLocaleString("es-MX")}</span>
                      <span className="text-[0.75rem] text-muted-foreground mb-1">MXN</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[0.67rem]">
                      <span className="px-2 py-1 rounded-full border border-primary/30 text-primary">{plan.classLimit} clase</span>
                      <span className="px-2 py-1 rounded-full border border-border text-muted-foreground">{plan.durationDays} días vigencia</span>
                      {plan.isNonTransferable && <span className="px-2 py-1 rounded-full border border-amber-300/25 text-amber-300">No transferible</span>}
                      {plan.isNonRepeatable && <span className="px-2 py-1 rounded-full border border-rose-300/25 text-rose-300">No repetible</span>}
                    </div>
                    <button onClick={() => navigate(membershipCtaPath)}
                      className="mt-2 w-full py-3 rounded-full text-[0.76rem] font-medium tracking-wider uppercase border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                      Quiero mi clase muestra
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Category tabs */}
          <div className="flex gap-2 mb-8 flex-wrap">
            {(["jumping", "pilates", "mixtos"] as const).map((cat) => (
              <button key={cat} onClick={() => setActivePkgTab(cat)}
                className={"px-5 py-2 rounded-full text-[0.78rem] font-medium tracking-wide uppercase transition-all " + (
                  activePkgTab === cat
                    ? "bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.3)]"
                    : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}>
                {cat}
              </button>
            ))}
          </div>
          {/* Package grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {packages
              .filter((p) => p.category === activePkgTab && p.is_active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((p, i, arr) => {
                const isUnlimited = p.num_classes?.toString().toUpperCase() === "ILIMITADO";
                const isPopular = i === arr.length - 2 && !isUnlimited;
                return (
                  <div key={p.id}
                    className={"relative rounded-3xl p-8 flex flex-col gap-4 transition-all hover:-translate-y-2 " + (
                      isUnlimited
                        ? "bg-primary border-2 border-primary shadow-[0_20px_60px_hsl(var(--primary)/0.35)]"
                        : isPopular
                        ? "bg-background border-2 border-primary/60 shadow-[0_10px_40px_hsl(var(--primary)/0.15)]"
                        : "bg-background border border-border hover:border-primary/50"
                    )}>
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CA71E1] text-white text-[0.6rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-medium whitespace-nowrap">Más popular</div>
                    )}
                    {isUnlimited && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-foreground text-primary text-[0.6rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-medium whitespace-nowrap">Mejor valor</div>
                    )}
                    <div className={"text-[0.7rem] tracking-[0.15em] uppercase font-medium " + (isUnlimited ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {p.validity_days ?? 30} días de vigencia
                    </div>
                    <div className={"font-bebas text-[0.95rem] tracking-wide " + (isUnlimited ? "text-primary-foreground" : "text-foreground")}>
                      {isUnlimited ? "ILIMITADO" : p.num_classes + " CLASES"}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={"font-bebas text-[3.5rem] leading-none " + (isUnlimited ? "text-primary-foreground" : "text-primary")}>
                        ${Number(p.price).toLocaleString()}
                      </span>
                      <span className={"text-[0.75rem] " + (isUnlimited ? "text-primary-foreground/60" : "text-muted-foreground")}>MXN</span>
                    </div>
                    {!isUnlimited && Number(p.num_classes) > 0 && (
                      <div className={"text-[0.78rem] " + (isUnlimited ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        ${(Number(p.price) / Number(p.num_classes)).toFixed(0)}/clase
                      </div>
                    )}
                    <div className="mt-auto">
                      <button onClick={() => navigate(membershipCtaPath)}
                        className={"w-full py-3 rounded-full text-[0.78rem] font-medium tracking-wider uppercase transition-all " + (
                          isUnlimited
                            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                            : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        )}>
                        Elegir paquete
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-muted-foreground mt-8 text-center">
            Vigencia desde la primera clase · Aplican términos y condiciones · Precios en MXN
          </p>
        </div>
      </section>

      {/* ── INSTRUCTORAS — Emi & Mon ── */}
      <section id="instructoras" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            El equipo
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">NUESTRAS<br />INSTRUCTORAS</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Certificadas, apasionadas y dedicadas a que cada clase sea tu mejor versión.
            </p>
          </div>
          <div className={"grid grid-cols-1 " + ((instructors.length > 0 ? instructors.length : 2) === 1 ? "max-w-md mx-auto" : "sm:grid-cols-2") + " " + ((instructors.length > 0 ? instructors.length : 2) >= 3 ? "lg:grid-cols-3" : "") + " gap-6"}>
            {(instructors.length > 0
              ? instructors.map((inst) => ({
                  key: inst.id,
                  label: inst.displayName,
                  sub: Array.isArray(inst.specialties)
                    ? (inst.specialties as unknown as string[]).join(" & ")
                    : typeof inst.specialties === "string" && inst.specialties ? inst.specialties : "Instructora",
                  bio: inst.bio || null,
                  funFact: null as string | null,
                  photoUrl: inst.photoUrl || null,
                  photoFocusX: clampFocus(inst.photoFocusX),
                  photoFocusY: clampFocus(inst.photoFocusY),
                }))
              : [
                  { key: "emi", label: "Emi", sub: "Jumping & Yoga",
                    bio: "Instructora certificada que combina la energía explosiva del jumping con la calma profunda del yoga. Cada clase con ella es una aventura.",
                    funFact: "Siempre dice que ya es la última repetición… pero no es verdad 😅",
                    photoUrl: null, photoFocusX: 50, photoFocusY: 50 },
                  { key: "mon", label: "Mon", sub: "Jumping & Pilates",
                    bio: "Creadora de Ophelia Studio. Su pasión por el movimiento y su energía contagiosa hacen de cada sesión una experiencia transformadora.",
                    funFact: "Siempre dice que estará tranquila la clase, pero al final sales temblando 💪",
                    photoUrl: null, photoFocusX: 50, photoFocusY: 50 },
                ]
            ).map((inst) => (
              <div key={inst.key} className="group rounded-3xl overflow-hidden bg-secondary border border-border hover:border-primary/50 hover:-translate-y-2 transition-all">
                <div className="h-[380px] lg:h-[460px] bg-gradient-to-br from-[#1F0047] via-[#2d0a40] to-[#1a0035] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,hsl(var(--primary)/0.18)_0%,transparent_65%)]" />
                  {inst.photoUrl ? (
                    <img src={inst.photoUrl} alt={inst.label}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      style={{ objectPosition: clampFocus(inst.photoFocusX) + "% " + clampFocus(inst.photoFocusY) + "%" }} />
                  ) : (
                    <div className="relative flex flex-col items-center gap-4">
                      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#E15CB8]/25 to-[#CA71E1]/15 border-2 border-[#E15CB8]/30 shadow-[0_0_60px_hsl(var(--primary)/0.2)]">
                        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#E15CB8]/50">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <span className="text-[0.65rem] tracking-[0.2em] uppercase text-[#E15CB8]/50 font-medium">Foto próximamente</span>
                    </div>
                  )}
                </div>
                <div className="p-7">
                  <h3 className="font-syne font-bold text-[1.2rem] text-foreground mb-1">{inst.label}</h3>
                  <p className="text-primary text-[0.85rem] tracking-wide font-medium">{inst.sub}</p>
                  {inst.bio && <p className="text-[0.8rem] text-muted-foreground mt-2 leading-relaxed line-clamp-3">{inst.bio}</p>}
                  {inst.funFact && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-[0.75rem] text-primary italic leading-relaxed">
                        <span className="font-semibold not-italic">Fun fact:</span> {inst.funFact}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HISTORIA DE OPHELIA ── */}
      <section className="py-20 lg:py-28 px-6 lg:px-[60px] bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,hsl(var(--primary)/0.06)_0%,transparent_50%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative">
              <div className="rounded-3xl overflow-hidden aspect-[4/5] relative">
                <img src={ophelia50} alt="Ophelia Studio" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <div className="absolute -bottom-4 -right-4 lg:-right-8 bg-primary/90 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-[0_20px_60px_hsl(var(--primary)/0.3)]">
                <p className="font-gulfs italic text-[1.1rem] text-primary-foreground leading-tight">
                  &ldquo;Ella era mi<br />lugar seguro&rdquo;
                </p>
              </div>
            </div>
            <div>
              <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
                <span className="w-[30px] h-[1px] bg-primary inline-block" />
                Nuestra historia
              </div>
              <h2 className="font-bebas text-[clamp(2.5rem,4vw,4rem)] leading-[0.95] text-foreground mb-8">
                ¿POR QUÉ<br /><span className="text-primary">&ldquo;OPHELIA&rdquo;?</span>
              </h2>
              <div className="space-y-5 text-[0.95rem] text-muted-foreground leading-[1.85]">
                <p>El nombre <span className="text-foreground font-medium">Ophelia</span> viene de mi abuela
                  <span className="text-primary font-medium"> Ofelia</span> — una mujer fuerte, amorosa y llena de vida.</p>
                <p>Ella era mi lugar seguro. Su risa llenaba la casa, su abrazo curaba todo
                  y su fortaleza me enseñó que ser mujer es un superpoder.</p>
                <p>Este estudio lleva su nombre porque quiero que cada persona que entre
                  sienta lo que yo sentía con ella: <span className="text-foreground font-medium">que pertenece,
                  que es suficiente y que es capaz de todo.</span></p>
                <p className="font-gulfs italic text-foreground text-[1.1rem]">
                  Ophelia es más que un estudio — es un abrazo en forma de movimiento.</p>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="w-12 h-[1px] bg-primary" />
                <span className="text-[0.78rem] text-primary font-medium tracking-wide">Mon — Fundadora</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── POLÍTICAS ── */}
      <section id="politicas" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Información importante
          </div>
          <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground mb-10">POLÍTICAS DE CLASE</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { num: "01", title: "Puntualidad", text: "Tienes 5 minutos de tolerancia. Una vez iniciada la canción no podremos permitir el ingreso por seguridad y respeto al grupo." },
              { num: "02", title: "Reservación", text: "Todas las clases requieren reservación previa. Cupo limitado a 10 lugares. Tu lugar queda confirmado desde la app." },
              { num: "03", title: "Cancelaciones", text: "Puedes cancelar hasta 2 horas antes de tu clase y se te devuelve el crédito automáticamente. Solo puedes cancelar un máximo de 2 veces. Después de ese límite o pasadas las 2 horas, se pierde la clase." },
              { num: "04", title: "Pagos", text: "Los pagos se realizan por transferencia bancaria a: Montserrath Cornejo Ramírez · BBVA · CLABE: 012 180 01578244526 8. Envía tu comprobante por WhatsApp para activar tu paquete." },
              { num: "05", title: "Salud", text: "Si estás embarazada, en postparto o tienes lesión, notifícalo antes. Cada alumna es responsable de su condición física." },
              { num: "06", title: "Vestimenta", text: "Ropa deportiva cómoda. Tenis deportivos obligatorios para Jumping. Calcetas antideslizantes para Pilates." },
              { num: "07", title: "Celular", text: "Celular en silencio durante la clase. No lo traigas al Mat. Si necesitas usarlo, sal de la clase." },
              { num: "08", title: "Artículos", text: "Todos los artículos en los lockers. No lleves nada al mat. El agua también va en locker para evitar accidentes." },
            ].map((p) => (
              <div key={p.num} className="rounded-2xl border border-border bg-secondary p-5 hover:border-primary/30 transition-all">
                <div className="font-bebas text-[2.5rem] text-foreground/[0.07] leading-none -mb-1">{p.num}</div>
                <h4 className="font-syne font-bold text-[0.92rem] text-foreground mb-2">{p.title}</h4>
                <p className="text-[0.8rem] text-muted-foreground leading-[1.65]">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA — "¿Lista para vivir la experiencia Ophelia?" ── */}
      <section id="contacto" className="py-16 lg:py-24 px-6 lg:px-[60px] relative overflow-hidden bg-secondary">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10">
          <div className="text-center mb-16">
            <div className="text-primary text-[0.8rem] tracking-[0.15em] uppercase mb-6">Tu momento es ahora</div>
            <h2 className="font-bebas text-[clamp(3.5rem,7vw,7rem)] leading-[0.9] text-foreground mb-8">
              ¿LISTA PARA VIVIR<br /><span className="text-primary">LA EXPERIENCIA</span><br />
              <span style={{ WebkitTextStroke: "2px hsl(53 74% 94% / 0.4)", color: "transparent" }}>OPHELIA?</span>
            </h2>
            <p className="text-[1.1rem] text-muted-foreground max-w-[500px] mx-auto mb-10 leading-[1.7]">
              Únete a más de 500 mujeres que ya eligieron sentir el vuelo. Prueba Jumping o Pilates por $65 en tu clase muestra.
            </p>
            <div className="flex gap-4 justify-center items-center flex-wrap">
              <button onClick={() => navigate(membershipCtaPath)}
                className="bg-primary text-primary-foreground px-10 py-[18px] rounded-full text-[0.9rem] font-medium tracking-wider uppercase inline-flex items-center gap-[10px] hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_20px_50px_hsl(var(--primary)/0.4)] transition-all">
                Reservar clase muestra
                <span className="w-[22px] h-[22px] bg-primary-foreground/20 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
              </button>
              <a href="https://wa.me/524421234567?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Ophelia%20Studio"
                target="_blank" rel="noopener noreferrer"
                className="border border-border text-foreground text-[0.85rem] font-normal tracking-wider uppercase flex items-center gap-3 px-8 py-[18px] rounded-full opacity-70 hover:opacity-100 hover:border-primary transition-all no-underline">
                WhatsApp
              </a>
            </div>
          </div>
          {/* Info + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="rounded-3xl p-10 flex flex-col justify-between gap-8 bg-gradient-to-br from-[#1F0047] via-[#2a0050] to-[#1a003a] border border-[#CA71E1]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,#E15CB8_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,#CA71E1_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />
              <div className="relative z-10">
                <div className="text-[0.7rem] tracking-[0.18em] uppercase text-[#E15CB8] font-semibold mb-3">Encuéntranos</div>
                <h3 className="font-bebas text-[clamp(2.5rem,3.5vw,3.5rem)] leading-[0.95] text-[#F9F7E8] mb-8">VISÍTANOS<br />EN ESTUDIO</h3>
                <div className="flex flex-col gap-6">
                  {[
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>, label: "Ubicación", value: "San Juan del Río, Querétaro", accent: "#E15CB8" },
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 11 19.79 19.79 0 0 1 1.77 2.38 2 2 0 0 1 3.74.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.08 6.08l1.28-1.28a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, label: "Teléfono", value: "+52 442 123 4567", accent: "#CA71E1" },
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>, label: "Email", value: "info@opheliajumping.mx", accent: "#E15CB8" },
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>, label: "Horarios", value: "Lun–Vie 6am–9pm  ·  Sáb 7am–2pm", accent: "#E7EB6E" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.accent + "20", color: item.accent, border: "1px solid " + item.accent + "30" }}>{item.icon}</div>
                      <div>
                        <div className="text-[0.65rem] tracking-widest uppercase mb-0.5" style={{ color: item.accent }}>{item.label}</div>
                        <div className="text-[1rem] text-[#F9F7E8] font-medium leading-snug">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex gap-3 pt-6 border-t border-[#CA71E1]/15">
                {[
                  { label: "Instagram", href: "https://www.instagram.com/ophelia_studiomx/", short: "ig" },
                  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61574872102085", short: "fb" },
                ].map((s) => (
                  <a key={s.short} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full border border-[#E15CB8]/30 flex items-center justify-center text-[0.8rem] text-[#E15CB8]/70 hover:bg-[#E15CB8]/15 hover:text-[#E15CB8] transition-all no-underline">{s.short}</a>
                ))}
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden border border-border min-h-[480px] lg:min-h-0">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3739.577714731379!2d-99.99482528857814!3d20.40029408101758!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d30d002e88643b%3A0xb7eed5074cefa672!2sOphelia%20Jumping%20Studio!5e0!3m2!1ses-419!2smx!4v1772066339529!5m2!1ses-419!2smx"
                width="100%" height="100%" style={{ border: 0, display: "block", minHeight: "480px" }}
                allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Ophelia Jumping Studio ubicación" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-background px-6 lg:px-[60px] pt-[60px] border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10">
          <div>
            <div className="mb-3"><img src={opheliaLogo} alt="Ophelia Studio" className="h-20 w-auto object-contain" /></div>
            <p className="text-[0.82rem] text-muted-foreground leading-[1.7] max-w-[200px]">
              Aquí no solo entrenas… aquí vuelves a ti. Salto a salto, respiración a respiración.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="https://www.instagram.com/ophelia_studiomx/" target="_blank" rel="noopener noreferrer" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground text-[0.85rem] hover:border-primary hover:text-primary transition-colors no-underline">ig</a>
              <a href="https://www.facebook.com/profile.php?id=61574872102085" target="_blank" rel="noopener noreferrer" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground text-[0.85rem] hover:border-primary hover:text-primary transition-colors no-underline">fb</a>
            </div>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Estudio</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {[["Clases","clases"],["Horario","horario"],["Paquetes","membresias"],["Instructoras","instructoras"],["Galería","galeria"],["Políticas","politicas"]].map(([label, id]) => (
                <li key={id}><button onClick={() => scrollTo(id)} className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">{label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Legal</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {[
                { label: "Aviso de privacidad", path: "/legal/privacidad" },
                { label: "Términos y condiciones", path: "/legal/terminos" },
                { label: "Política de cancelación", path: "/legal/cancelacion" },
              ].map((l) => (
                <li key={l.path}><button onClick={() => navigate(l.path)} className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">{l.label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Contacto</div>
            <ul className="flex flex-col gap-[10px] list-none">
              <li><span className="text-[0.85rem] text-muted-foreground">San Juan del Río, Qro.</span></li>
              <li><a href="mailto:info@opheliajumping.mx" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">info@opheliajumping.mx</a></li>
              <li><a href="https://wa.me/524421234567" target="_blank" rel="noopener noreferrer" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">WhatsApp</a></li>
              <li><button onClick={() => scrollTo("horario")} className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">Horarios</button></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[0.75rem] text-muted-foreground/50">© 2026 Ophelia Studio. Todos los derechos reservados.</p>
          <p className="text-[0.75rem] text-muted-foreground/50">Hecho con pasión en San Juan del Río ♡</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
