import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Schedule from "@/components/Schedule";
import { Dumbbell, Music, Waves, Flame, Zap, Heart, Activity, Sparkles, Flower2, Clock, type LucideIcon, ChevronLeft, ChevronRight, MapPin, Phone, Mail, ArrowUpRight, Menu, X } from "lucide-react";
import pnImg1 from "@/assets/punto-neutro-images/1000452084.jpg";
import pnImg2 from "@/assets/punto-neutro-images/1000452086.jpg";
import pnImg3 from "@/assets/punto-neutro-images/1000452092.jpg";
import pnImg4 from "@/assets/punto-neutro-images/1000452104.jpg";
import pnImg5 from "@/assets/punto-neutro-images/1000452105.jpg";
import pnImg6 from "@/assets/punto-neutro-images/1000452106.jpg";
import pnCafe1 from "@/assets/punto-neutro-images/1000452109.jpg";
import pnCafe2 from "@/assets/punto-neutro-images/1000452120.jpg";
import pnImg7 from "@/assets/punto-neutro-images/1000431479.jpg";
import pnImg8 from "@/assets/punto-neutro-images/1000439853.jpg";
import pnImg9 from "@/assets/punto-neutro-images/1000452523.jpg";
import pnImg10 from "@/assets/punto-neutro-images/1000452524.jpg";
import angiePhoto from "@/assets/punto-neutro-images/1000453952.jpg";
import puntoNeutroLogo from "@/assets/punto-neutro-logo.png";
import imgPilates from "@/assets/pilates_2320695.png";

/* ───── Types ───── */
type ClassTypeRow = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  category: "pilates" | "mixto" | "funcional";
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
  discount_price?: number;
  category: "basico" | "complemento";
  validity_days: number;
  is_active: boolean;
  sort_order: number;
};

/* ───── Fallbacks — Updated with real Punto Neutro info ───── */
const FALLBACK_CLASS_TYPES: ClassTypeRow[] = [
  { id: "c1", name: "Pilates Matt Clásico", subtitle: "Método Clásico", description: "Fortalece la musculatura que le da sostén a tu cuerpo respetando las bases del método clásico. Es una clase que te exige presencia, control, fluidez y una respiración consiente. ¡Utiliza el movimiento como forma de autoconocimiento!", category: "pilates", intensity: "media", color: "#b5bf9c", emoji: "waves", level: "Todos los niveles", duration_min: 55, capacity: 10, is_active: true, sort_order: 1 },
  { id: "c2", name: "Pilates Terapéutico", subtitle: "Fines terapéuticos", description: "Una clase con efectos terapéuticos en el cuerpo como la disminución de dolor, mejora en movilidad y fortalecimiento general. Ideal para quienes buscan ejercitarse por alguna condición médica, lesión o están buscando regresar a ejercitarse después de un proceso de sedentarismo. ¡Recupera la confianza en tu movimiento!", category: "pilates", intensity: "ligera", color: "#ebede5", emoji: "heart", level: "Todos los niveles", duration_min: 55, capacity: 10, is_active: true, sort_order: 2 },
  { id: "c3", name: "Flex & Flow", subtitle: "Movimiento libre", description: "Una clase que te invita a conectar mente y cuerpo por medio de movimientos naturales, fluidos y consientes ayudando a sentirte más libre, ágil, flexible y sin limitación. Un entrenamiento que te ayudará a maximizar tus capacidades físicas. ¡Recupera el placer de un movimiento libre!", category: "mixto", intensity: "media", color: "#b5bf9c", emoji: "activity", level: "Todos los niveles", duration_min: 55, capacity: 10, is_active: true, sort_order: 3 },
  { id: "c4", name: "Body Strong", subtitle: "Dinámica y retadora", description: "Una clase de intensidad moderada, dinámica y retadora, que busca lograr un funcionamiento integral y funcional del cuerpo sin dejar ejecución y cuidado de los movimientos. ¡Conoce y desafía tus propios límites!", category: "funcional", intensity: "pesada", color: "#94867a", emoji: "flame", level: "Intermedio-Avanzado", duration_min: 50, capacity: 10, is_active: true, sort_order: 4 },
];

const FALLBACK_PACKAGES: PackageRow[] = [
  { id: "p0", name: "Clase suelta", num_classes: "1", price: 120, discount_price: 110, category: "basico", validity_days: 7, is_active: true, sort_order: 0 },
  { id: "p1", name: "4 Clases", num_classes: "4", price: 400, discount_price: 380, category: "basico", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p2", name: "8 Clases", num_classes: "8", price: 680, discount_price: 640, category: "basico", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p3", name: "12 Clases", num_classes: "12", price: 900, discount_price: 840, category: "basico", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p4", name: "16 Clases", num_classes: "16", price: 1100, category: "basico", validity_days: 30, is_active: true, sort_order: 4 },
];

const COMPLEMENTOS = [
  { id: "comp1", name: 'Consulta nutrición "Salud hormonal"', specialist: "LN. Clara Pérez", price: 1030, discount_price: 990 },
  { id: "comp2", name: 'Consulta nutrición "Rendimiento Físico"', specialist: "LN. Majo Zamorano", price: 1250, discount_price: 1190 },
  { id: "comp3", name: "Descarga muscular", specialist: "LTF. Angelina Huante", price: 1450, discount_price: 1340 },
];

const GALLERY_IMAGES = [pnImg1, pnImg2, pnImg3, pnImg4, pnImg5, pnImg6, pnImg7, pnImg8, pnImg9, pnImg10, pnCafe1, pnCafe2];

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
  if (t.includes("fitness") || t.includes("tone") || t.includes("strong") || t.includes("body")) return Dumbbell;
  if (t.includes("dance") || t.includes("music")) return Music;
  if (t.includes("pilates") || t.includes("flow") || t.includes("flex")) return Waves;
  if (t.includes("hot") || t.includes("burn")) return Flame;
  if (t.includes("terapéutico") || t.includes("terapeutico")) return Heart;
  return Activity;
}

function clampFocus(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ═══════════════════════════════════════════════════════════
   INDEX — Punto Neutro · Movimiento con propósito
   ═══════════════════════════════════════════════════════════ */
const Index = () => {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>(FALLBACK_CLASS_TYPES);
  const [packages, setPackages] = useState<PackageRow[]>(FALLBACK_PACKAGES);
  const [galleryIdx, setGalleryIdx] = useState(0);
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

  /* ── Effects ── */
  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    api.get<{ data: ClassTypeRow[] }>("/admin/class-types").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data.filter((c: any) => c.is_active) : [];
      if (rows.length > 0) setClassTypes(rows);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    api.get<{ data: PackageRow[] }>("/packages").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length > 0) setPackages(rows);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    api.get("/public/instructors").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length > 0) setInstructors(rows);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setGalleryIdx((prev) => (prev + 1) % GALLERY_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const NAV_ITEMS = [
    { label: "Clases", id: "clases" },
    { label: "Horario", id: "horario" },
    { label: "Paquetes", id: "membresias" },
    { label: "Instructoras", id: "instructoras" },
    { label: "Galería", id: "galeria" },
    { label: "Contacto", id: "contacto" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5ef] text-[#2d2d2d]">
      {/* ─────────────────── NAV ─────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-[100] transition-all duration-500 ${
          navScrolled
            ? "bg-[#f4f5ef]/95 backdrop-blur-xl shadow-[0_1px_0_#94867a20]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 py-3">
          <a href="#" className="flex items-center" aria-label="Punto Neutro - Inicio">
            <img
              src={puntoNeutroLogo}
              alt="Punto Neutro"
              className="h-16 sm:h-20 w-auto object-contain"
            />
          </a>

          {/* Desktop Nav */}
          <ul className="hidden lg:flex items-center gap-1 list-none">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => scrollTo(item.id)}
                  className="px-4 py-2 text-[0.8rem] font-medium tracking-[0.08em] uppercase text-[#5a524a] hover:text-[#2d2d2d] hover:bg-[#94867a]/8 rounded-full transition-all duration-200 bg-transparent border-none cursor-pointer"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <button
                onClick={() => navigate(["admin", "super_admin", "instructor", "reception"].includes(user.role) ? "/admin/dashboard" : "/app")}
                className="flex items-center gap-2 bg-[#94867a] text-white px-5 py-2.5 rounded-full text-[0.8rem] font-medium tracking-wide hover:bg-[#7a6f65] transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[0.7rem] font-bold uppercase">
                  {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
                </span>
                <span className="truncate max-w-[120px]">
                  {["admin", "super_admin"].includes(user.role) ? "Admin" : user.displayName?.split(" ")[0] ?? "Mi cuenta"}
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/auth/login")}
                  className="hidden sm:block text-[0.8rem] font-medium tracking-wide text-[#5a524a] hover:text-[#2d2d2d] transition-colors bg-transparent border-none cursor-pointer px-3 py-2"
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => navigate("/auth/register")}
                  className="bg-[#94867a] text-white px-6 py-2.5 rounded-full text-[0.8rem] font-medium tracking-wider hover:bg-[#7a6f65] transition-colors"
                >
                  Unirse
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#94867a]/10 transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={20} className="text-[#5a524a]" />
            </button>
          </div>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden">
            <button
              className="absolute inset-0 bg-[#2d2d2d]/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
            />
            <div className="absolute right-0 top-0 bottom-0 w-[280px] bg-[#f4f5ef] shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#94867a]/15">
                <span className="text-[0.75rem] tracking-widest uppercase text-[#94867a] font-semibold">Menú</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#94867a]/10 transition-colors"
                  aria-label="Cerrar menú"
                >
                  <X size={18} className="text-[#5a524a]" />
                </button>
              </div>
              <nav className="flex-1 py-4">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="w-full text-left px-6 py-3.5 text-[0.9rem] font-medium text-[#2d2d2d] hover:bg-[#94867a]/8 transition-colors bg-transparent border-none cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              {!isAuthenticated && (
                <div className="px-5 py-5 border-t border-[#94867a]/15 space-y-3">
                  <button
                    onClick={() => { setMobileMenuOpen(false); navigate("/auth/login"); }}
                    className="w-full py-3 rounded-full border border-[#94867a]/30 text-[#5a524a] text-[0.82rem] font-medium tracking-wide hover:bg-[#94867a]/8 transition-colors"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); navigate("/auth/register"); }}
                    className="w-full py-3 rounded-full bg-[#94867a] text-white text-[0.82rem] font-medium tracking-wide hover:bg-[#7a6f65] transition-colors"
                  >
                    Unirse
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ─────────────────── HERO ─────────────────── */}
      <section className="relative min-h-[100vh] flex items-end overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={pnImg9}
            alt="Alumnas en Punto Neutro"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 30%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/80 via-[#2d2d2d]/30 to-[#2d2d2d]/10" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 sm:pb-20 pt-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-[0.72rem] uppercase tracking-[0.15em] font-medium mb-8 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b5bf9c] animate-pulse" />
              San Juan del Río, Querétaro
            </div>

            <h1 className="font-bebas text-[clamp(3.5rem,9vw,7.5rem)] leading-[0.88] tracking-tight text-white mb-6 animate-fade-up delay-200">
              MOVIMIENTO<br />
              <span className="text-[#b5bf9c]">CON PROPÓSITO</span>
            </h1>

            <p className="text-[clamp(1rem,1.4vw,1.15rem)] text-white/80 leading-relaxed max-w-lg mb-10 animate-fade-up delay-400 font-alilato">
              Un espacio creado para fortalecer el cuerpo, conectar con el movimiento y encontrar equilibrio. Pilates, Flex & Flow y Body Strong.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 animate-fade-up delay-600">
              <button
                onClick={() => navigate("/auth/register")}
                className="bg-white text-[#2d2d2d] px-8 py-4 rounded-full text-[0.82rem] font-semibold tracking-wider uppercase inline-flex items-center justify-center gap-2.5 hover:bg-[#b5bf9c] hover:text-white transition-all duration-300"
              >
                Comenzar hoy
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => scrollTo("clases")}
                className="px-8 py-4 rounded-full text-[0.82rem] text-white border border-white/30 font-medium tracking-wider uppercase flex items-center justify-center gap-2 hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
              >
                Explorar clases
              </button>
            </div>
          </div>
        </div>

        {/* Bottom decorative fade */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#f4f5ef] to-transparent z-10" />
      </section>

      {/* ─────────────────── DISCIPLINES STRIP ─────────────────── */}
      <section className="relative z-20 -mt-12">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {([
              { name: "Pilates Clásico", color: "#b5bf9c", Icon: Waves, desc: "Método clásico" },
              { name: "Terapéutico", color: "#94867a", Icon: Heart, desc: "Bienestar integral" },
              { name: "Flex & Flow", color: "#b5bf9c", Icon: Activity, desc: "Movimiento libre" },
              { name: "Body Strong", color: "#94867a", Icon: Dumbbell, desc: "Fuerza funcional" },
            ] as const).map((d, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 sm:p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-default group"
              >
                <div className="flex items-center justify-center mb-3">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: d.color + "18", border: "1px solid " + d.color + "30" }}
                  >
                    <d.Icon size={24} style={{ color: d.color }} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="font-bebas text-[1rem] sm:text-[1.2rem] leading-none mb-1" style={{ color: d.color }}>
                  {d.name}
                </div>
                <div className="text-[0.7rem] text-[#5a524a] tracking-wide font-alilato">{d.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── MANIFIESTO ─────────────────── */}
      <section className="py-24 lg:py-32 px-5 sm:px-8 overflow-hidden">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 max-w-3xl mx-auto text-center">
          <div className="text-[0.72rem] tracking-[0.18em] uppercase text-[#94867a] font-semibold mb-5 flex items-center justify-center gap-3">
            <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
            Nuestro espíritu
            <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
          </div>
          <h2 className="font-bebas text-[clamp(2.5rem,4vw,4rem)] leading-[0.95] text-[#2d2d2d] mb-8">
            MÁS QUE UN ESTUDIO,<br />
            <span className="text-[#94867a]">UN ESPACIO PARA TI</span>
          </h2>
          <p className="text-[1.05rem] text-[#5a524a] leading-[1.85] mb-6 font-alilato">
            Nuestro estudio es un espacio creado para fortalecer el cuerpo, conectar con el movimiento y encontrar equilibrio.
            Más que un lugar para entrenar, es un espacio donde cada persona se desafía, avanza y disfruta su proceso.
          </p>
          <blockquote className="relative px-6 py-4">
            <div className="absolute left-1/2 -translate-x-1/2 -top-3 text-[#b5bf9c] text-4xl font-serif leading-none">&ldquo;</div>
            <p className="text-[1rem] text-[#2d2d2d]/80 leading-[1.8] italic font-alilato">
              Trabajamos con energía, fuerza y constancia, siempre desde el respeto por cada cuerpo y cada etapa.
              Entrenamos con intención, con exigencia y disciplina, acompañando a cada alumna para que descubra y desarrolle su potencial.
            </p>
          </blockquote>
          <p className="text-[0.82rem] text-[#94867a] mt-4 font-semibold tracking-wide">— Punto Neutro</p>
        </div>
      </section>

      {/* ─────────────────── GALERÍA — Nuestro Espacio ─────────────────── */}
      <section id="galeria" className="py-20 lg:py-28 px-5 sm:px-8 bg-white">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
            <div>
              <div className="text-[0.72rem] tracking-[0.18em] uppercase text-[#94867a] font-semibold mb-4 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
                El Estudio
              </div>
              <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-[#2d2d2d]">
                NUESTRO<br />ESPACIO
              </h2>
            </div>
            <p className="text-[0.95rem] text-[#5a524a] max-w-[400px] leading-[1.8] lg:text-right font-alilato">
              Un espacio seguro y acogedor, donde cada clienta se sienta cómoda, acompañada y en confianza.
            </p>
          </div>

          {/* ── Row 1: 3 columns ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Recepción — hero */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden relative group aspect-[16/10]">
              <img src={pnCafe1} alt="Recepción Punto Neutro" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/50 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <span className="bg-[#b5bf9c]/30 backdrop-blur-md text-white text-[0.62rem] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full mb-2 inline-block font-medium">
                  Hybrid Studio & Coffee
                </span>
                <h3 className="text-white font-bebas text-2xl tracking-wide">Nuestro Espacio</h3>
              </div>
            </div>
            {/* Side plank instructora */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[3/4] sm:aspect-[16/10] lg:aspect-[3/4]">
              <img src={angiePhoto} alt="Instructora Punto Neutro" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 20%" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/35 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="text-white/90 text-[0.65rem] uppercase tracking-[0.15em] font-medium">Fuerza & Equilibrio</span>
              </div>
            </div>
          </div>

          {/* ── Row 2: 4 equal columns ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {/* Sala amplia */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[4/5]">
              <img src={pnImg2} alt="Sala de práctica" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Clase con pesas */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[4/5]">
              <img src={pnImg8} alt="Clase con pesas" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 20%" }} />
            </div>
            {/* Rack de mats */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[4/5]">
              <img src={pnImg5} alt="Mats del estudio" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Rincón con planta */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[4/5]">
              <img src={pnImg4} alt="Ambiente del estudio" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
          </div>

          {/* ── Row 3: 3 columns ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {/* Alumnas pilates mat */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[3/4] sm:aspect-[16/10] lg:aspect-[3/4]">
              <img src={pnImg9} alt="Clase de pilates" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 30%" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/30 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="text-white/90 text-[0.65rem] uppercase tracking-[0.15em] font-medium">Clases grupales</span>
              </div>
            </div>
            {/* Lobby Body Motion Mind */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden relative group aspect-[16/10]">
              <img src={pnCafe2} alt="Lobby Punto Neutro" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/40 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5">
                <span className="text-white/90 text-[0.65rem] uppercase tracking-[0.15em] font-medium">Body · Motion · Mind in Peace</span>
              </div>
            </div>
          </div>

          {/* ── Row 4: 3 columns ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {/* Planks en pelotas */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[4/5]">
              <img src={pnImg10} alt="Body Strong" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 30%" }} />
            </div>
            {/* Equipo organizado */}
            <div className="rounded-2xl overflow-hidden relative group aspect-[4/5]">
              <img src={pnImg1} alt="Equipo del estudio" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Matcha / café */}
            <div className="col-span-2 lg:col-span-1 rounded-2xl overflow-hidden relative group aspect-[16/10] lg:aspect-[4/5]">
              <img src={pnImg7} alt="Punto Neutro Coffee" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 40%" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/40 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="text-white/90 text-[0.65rem] uppercase tracking-[0.15em] font-medium">Studio & Coffee</span>
              </div>
            </div>
          </div>

          {/* ── Row 5: wide panoramic ── */}
          <div className="mt-3 sm:mt-4 rounded-2xl overflow-hidden relative group aspect-[21/9]">
            <img src={pnImg3} alt="Vista panorámica del estudio" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 40%" }} />
            <div className="absolute inset-0 bg-[#2d2d2d]/20 group-hover:bg-[#2d2d2d]/10 transition-colors duration-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white font-bebas text-3xl sm:text-4xl lg:text-5xl tracking-widest opacity-90">MOVIMIENTO CON PROPÓSITO</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── CLASES ─────────────────── */}
      <section id="clases" className="py-20 lg:py-28 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
            <div className="text-[0.72rem] tracking-[0.18em] uppercase text-[#94867a] font-semibold mb-4 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
              Nuestras Modalidades
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
              <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-[#2d2d2d]">NUESTRAS CLASES</h2>
              <p className="text-[0.9rem] text-[#5a524a] max-w-[380px] leading-[1.7] font-alilato">
                Descubre qué modalidad va mejor con tu energía. Entrenamientos diseñados para retarte y reconectarte.
              </p>
            </div>
          </div>

          <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 md:grid-cols-2 gap-5">
            {classTypes.slice(0, 4).map((c) => {
              const Icon = getCardIcon(c.emoji, c.name);
              const catLabel: Record<string, string> = { pilates: "Pilates", mixto: "Flexibilidad", funcional: "Funcional" };
              const accentColor = c.category === "funcional" ? "#94867a" : "#b5bf9c";

              return (
                <div
                  key={c.id}
                  className="group relative bg-white rounded-2xl p-7 sm:p-8 border border-[#e8e9e3] hover:border-[#b5bf9c]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-400 flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: accentColor + "15", border: `1px solid ${accentColor}30` }}
                    >
                      <Icon size={24} style={{ color: accentColor }} />
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-[0.65rem] tracking-[0.1em] uppercase font-semibold"
                      style={{ backgroundColor: accentColor + "12", color: accentColor }}
                    >
                      {catLabel[c.category] ?? c.category}
                    </span>
                  </div>

                  <h3 className="font-alilato font-bold text-[1.15rem] text-[#2d2d2d] mb-2 leading-tight group-hover:text-[#94867a] transition-colors duration-300">
                    {c.name}
                  </h3>
                  {c.subtitle && (
                    <p className="text-[0.78rem] text-[#94867a] font-medium mb-3">{c.subtitle}</p>
                  )}
                  <p className="text-[0.88rem] text-[#5a524a] leading-[1.7] mb-6 flex-1 font-alilato">
                    {c.description}
                  </p>

                  <div className="flex items-center gap-4 text-[0.75rem] text-[#5a524a] font-medium pt-4 border-t border-[#e8e9e3] mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-[#94867a]" />
                      {c.duration_min} min
                    </div>
                    <div className="w-1 h-1 rounded-full bg-[#d4d6ce]" />
                    <div>{c.level}</div>
                    <div className="w-1 h-1 rounded-full bg-[#d4d6ce]" />
                    <div>Max. {c.capacity}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────── HORARIO ─────────────────── */}
      <Schedule />

      {/* ─────────────────── PAQUETES ─────────────────── */}
      <section id="membresias" className="py-20 lg:py-28 px-5 sm:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
            <div className="text-[0.72rem] tracking-[0.18em] uppercase text-[#94867a] font-semibold mb-4 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
              Inversión
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-14">
              <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-[#2d2d2d]">
                ELIGE TU<br />PAQUETE
              </h2>
              <p className="text-[0.9rem] text-[#5a524a] max-w-[400px] leading-[1.7] font-alilato">
                Paquetes básicos y complementos para una experiencia integral. El descuento aplica si pagas en efectivo o con transferencia.
              </p>
            </div>
          </div>

          {/* Clase muestra */}
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700 rounded-2xl border border-[#b5bf9c]/30 bg-[#f4f5ef] mb-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-[#b5bf9c]/15 border border-[#b5bf9c]/30">
                  <img src={imgPilates} alt="" className="h-7 w-7 object-contain" />
                </div>
                <div>
                  <p className="text-[0.68rem] tracking-[0.15em] uppercase text-[#94867a] font-semibold">Conoce nuestro estudio</p>
                  <h3 className="font-alilato font-bold text-[1.15rem] text-[#2d2d2d]">Clase muestra</h3>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bebas text-[2.5rem] leading-none text-[#94867a]">$110</span>
                <span className="text-[0.75rem] text-[#5a524a]">MXN</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.68rem] mb-5">
              <span className="px-3 py-1.5 rounded-full bg-[#b5bf9c]/12 text-[#6b7a4e] font-medium">1 clase</span>
              <span className="px-3 py-1.5 rounded-full bg-[#f4f5ef] border border-[#d4d6ce] text-[#5a524a]">Preguntar disponibilidad</span>
              <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">No reembolsable</span>
            </div>
            <button
              onClick={() => navigate(membershipCtaPath)}
              className="w-full sm:w-auto px-8 py-3 rounded-full text-[0.78rem] font-semibold tracking-wider uppercase border-2 border-[#94867a] text-[#94867a] hover:bg-[#94867a] hover:text-white transition-all duration-300 cursor-pointer"
            >
              Quiero mi clase muestra
            </button>
          </div>

          {/* Paquetes Básicos */}
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
            <h3 className="font-alilato font-bold text-[1.15rem] text-[#2d2d2d] mb-6">Paquetes de clases</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-14">
              {FALLBACK_PACKAGES.map((p) => {
                const isPopular = p.num_classes === "12";
                const isBest = p.num_classes === "16";
                return (
                  <div
                    key={p.id}
                    className={`relative rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 ${
                      isBest
                        ? "bg-[#94867a] shadow-[0_12px_40px_rgba(148,134,122,0.3)]"
                        : isPopular
                          ? "bg-[#f4f5ef] border-2 border-[#b5bf9c] shadow-[0_8px_30px_rgba(181,191,156,0.12)]"
                          : "bg-[#f4f5ef] border border-[#e8e9e3] hover:border-[#b5bf9c]/40"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#b5bf9c] text-[#2d2d2d] text-[0.6rem] tracking-[0.12em] uppercase px-4 py-1 rounded-full font-semibold whitespace-nowrap">
                        Más popular
                      </div>
                    )}
                    {isBest && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-[#94867a] text-[0.6rem] tracking-[0.12em] uppercase px-4 py-1 rounded-full font-semibold whitespace-nowrap">
                        Mejor valor
                      </div>
                    )}
                    <div className={`text-[0.68rem] tracking-[0.15em] uppercase font-medium ${isBest ? "text-white/70" : "text-[#5a524a]"}`}>
                      {p.validity_days ?? 30} días de vigencia
                    </div>
                    <div className={`font-bebas text-[0.95rem] tracking-wider ${isBest ? "text-white" : "text-[#2d2d2d]"}`}>
                      {p.num_classes === "1" ? "CLASE SUELTA" : p.num_classes + " CLASES"}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-bebas text-[3rem] leading-none ${isBest ? "text-white" : "text-[#94867a]"}`}>
                        ${Number(p.price).toLocaleString()}
                      </span>
                      <span className={`text-[0.75rem] ${isBest ? "text-white/60" : "text-[#5a524a]"}`}>MXN</span>
                    </div>
                    {p.discount_price && (
                      <div className={`text-[0.78rem] ${isBest ? "text-[#d4dbc4]" : "text-[#6b7a4e]"}`}>
                        Efectivo/transferencia: <strong>${p.discount_price.toLocaleString()}</strong>
                      </div>
                    )}
                    {Number(p.num_classes) > 1 && (
                      <div className={`text-[0.78rem] ${isBest ? "text-white/60" : "text-[#5a524a]"}`}>
                        ${(Number(p.price) / Number(p.num_classes)).toFixed(0)}/clase
                      </div>
                    )}
                    <div className="mt-auto pt-2">
                      <button
                        onClick={() => navigate(membershipCtaPath)}
                        className={`w-full py-3 rounded-full text-[0.78rem] font-semibold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                          isBest
                            ? "bg-white text-[#94867a] hover:bg-[#f4f5ef]"
                            : "border-2 border-[#94867a] text-[#94867a] hover:bg-[#94867a] hover:text-white"
                        }`}
                      >
                        Elegir paquete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Paquetes Completos */}
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
            <h3 className="font-alilato font-bold text-[1.15rem] text-[#2d2d2d] mb-2">Paquetes completos</h3>
            <p className="text-[0.88rem] text-[#5a524a] mb-8 font-alilato">
              Elige un paquete básico + agrega un complemento. El precio incluye tus clases + 1 sesión con especialista.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
              {[
                { classes: 8, price: 1030, discount: 990 },
                { classes: 12, price: 1250, discount: 1190 },
                { classes: 16, price: 1450, discount: 1340 },
              ].map((tier) => (
                <div
                  key={tier.classes}
                  className="rounded-2xl p-7 bg-[#f4f5ef] border border-[#b5bf9c]/25 hover:border-[#b5bf9c]/50 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(181,191,156,0.12)] transition-all duration-300 flex flex-col gap-3"
                >
                  <div className="text-[0.68rem] tracking-[0.15em] uppercase text-[#6b7a4e] font-semibold">Paquete completo</div>
                  <h4 className="font-alilato font-bold text-[1.05rem] text-[#2d2d2d]">{tier.classes} Clases + Complemento</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-bebas text-[2.8rem] leading-none text-[#94867a]">${tier.price.toLocaleString()}</span>
                    <span className="text-[0.75rem] text-[#5a524a]">MXN</span>
                  </div>
                  <p className="text-[0.78rem] text-[#6b7a4e]">
                    Efectivo/transferencia: <strong>${tier.discount.toLocaleString()}</strong>
                  </p>
                  <button
                    onClick={() => navigate(membershipCtaPath)}
                    className="mt-auto w-full py-3 rounded-full text-[0.76rem] font-semibold tracking-wider uppercase border-2 border-[#94867a] text-[#94867a] hover:bg-[#94867a] hover:text-white transition-all duration-300 cursor-pointer"
                  >
                    Elegir paquete
                  </button>
                </div>
              ))}
            </div>

            {/* Complementos disponibles */}
            <p className="text-[0.82rem] font-semibold text-[#2d2d2d] mb-3 font-alilato">Complementos disponibles:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COMPLEMENTOS.map((comp) => (
                <div key={comp.id} className="rounded-xl p-4 bg-[#f4f5ef] border border-[#e8e9e3] flex flex-col gap-1.5">
                  <h4 className="font-alilato font-bold text-[0.88rem] text-[#2d2d2d] leading-tight">{comp.name}</h4>
                  <p className="text-[0.78rem] text-[#94867a] font-medium">{comp.specialist}</p>
                </div>
              ))}
            </div>
            <p className="text-[0.72rem] text-[#5a524a] mt-3 font-alilato">
              *El costo con descuento aplica pagando con efectivo o transferencia. El precio es el mismo sin importar qué complemento elijas.
            </p>
          </div>

          {/* Payment info */}
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700 mt-8 rounded-2xl border border-[#e8e9e3] bg-[#f4f5ef] p-6 text-center">
            <p className="text-[0.82rem] text-[#5a524a] leading-relaxed font-alilato">
              <strong className="text-[#2d2d2d]">Métodos de pago:</strong> Efectivo, transferencia o depósito.<br />
              <strong className="text-[#2d2d2d]">BBVA</strong> · Beneficiario: Angelina Salas Huante · Tarjeta: 4152 3139 4571 6699 · Cuenta: 151 128 2689 · CLABE: 012 680 01511282689 2
            </p>
            <p className="text-[0.72rem] text-[#5a524a] mt-3 font-alilato">
              *El costo con descuento únicamente es si el pago es en efectivo o con transferencia.
            </p>
          </div>

          <p className="text-[0.72rem] text-[#5a524a] mt-6 text-center font-alilato">
            Vigencia desde la primera clase · Aplican términos y condiciones · Precios en MXN
          </p>
        </div>
      </section>

      {/* ─────────────────── INSTRUCTORAS ─────────────────── */}
      <section id="instructoras" className="py-20 lg:py-28 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
            <div className="text-[0.72rem] tracking-[0.18em] uppercase text-[#94867a] font-semibold mb-4 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
              El equipo
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
              <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-[#2d2d2d]">
                NUESTRAS<br />INSTRUCTORAS
              </h2>
              <p className="text-[0.9rem] text-[#5a524a] max-w-[360px] leading-[1.7] font-alilato">
                Certificadas, apasionadas y dedicadas a que cada clase sea tu mejor versión.
              </p>
            </div>
          </div>

          <div
            className={`reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 ${
              (instructors.length > 0 ? instructors.length : 1) === 1
                ? "max-w-md mx-auto"
                : "sm:grid-cols-2"
            } ${(instructors.length > 0 ? instructors.length : 1) >= 3 ? "lg:grid-cols-3" : ""} gap-6`}
          >
            {(instructors.length > 0
              ? instructors.map((inst) => ({
                  key: inst.id,
                  label: inst.displayName,
                  coachTitle: inst.displayName?.toUpperCase() ?? null,
                  sub: Array.isArray(inst.specialties)
                    ? (inst.specialties as unknown as string[]).join(" · ")
                    : typeof inst.specialties === "string" && inst.specialties ? inst.specialties : "Instructora",
                  bio: inst.bio || null,
                  funFact: null as string | null,
                  photoUrl: inst.photoUrl || angiePhoto,
                  photoFocusX: clampFocus(inst.photoFocusX),
                  photoFocusY: clampFocus(inst.photoFocusY) || 25,
                }))
              : [
                  {
                    key: "angie", label: "Angie", coachTitle: "ANGIE",
                    sub: "Pilates Matt Clásico · Pilates Terapéutico · Flex & Flow · Body Strong",
                    bio: "Soy una profesional del movimiento apasionada por acompañar a las personas a sentirse mejor en su cuerpo desde un enfoque consciente, funcional y sostenible. Mi enfoque integra fuerza, movilidad y control corporal, adaptándose a cada persona y a cada proceso. Aquí no solo vienes a entrenar, vienes a conectar contigo, a avanzar a tu ritmo y a formar parte de una experiencia que equilibra movimiento y pausa.",
                    funFact: null,
                    photoUrl: angiePhoto, photoFocusX: 50, photoFocusY: 25
                  },
                ]
            ).map((inst) => (
              <div
                key={inst.key}
                className="group rounded-2xl overflow-hidden bg-white border border-[#e8e9e3] hover:border-[#b5bf9c]/40 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400"
              >
                <div className="h-[380px] lg:h-[440px] relative overflow-hidden">
                  {inst.photoUrl ? (
                    <img
                      src={inst.photoUrl}
                      alt={inst.label}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 grayscale-[30%] group-hover:grayscale-0"
                      style={{ objectPosition: clampFocus(inst.photoFocusX) + "% " + clampFocus(inst.photoFocusY) + "%" }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#94867a]/10 to-[#b5bf9c]/10 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full bg-[#94867a]/10 border border-[#94867a]/20 flex items-center justify-center">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#94867a]/40">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <span className="text-[0.65rem] tracking-[0.2em] uppercase text-[#94867a]/50 font-medium">Foto próximamente</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
                <div className="p-6">
                  {inst.coachTitle && (
                    <div className="font-bebas text-[1.5rem] tracking-wider leading-none mb-1 text-[#94867a]">
                      {inst.coachTitle}
                    </div>
                  )}
                  <h3 className="font-alilato font-bold text-[1.1rem] text-[#2d2d2d] mb-1">{inst.label}</h3>
                  <p className="text-[#94867a] text-[0.78rem] tracking-wide font-medium leading-relaxed">{inst.sub}</p>
                  {inst.bio && <p className="text-[0.82rem] text-[#5a524a] mt-3 leading-relaxed font-alilato">{inst.bio}</p>}
                  {inst.funFact && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-[#b5bf9c]/10 border border-[#b5bf9c]/20">
                      <p className="text-[0.75rem] text-[#6b7a4e] italic leading-relaxed font-alilato">
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

      {/* ─────────────────── POLÍTICAS ─────────────────── */}
      <section id="politicas" className="py-20 lg:py-28 px-5 sm:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
            <div className="text-[0.72rem] tracking-[0.18em] uppercase text-[#94867a] font-semibold mb-4 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-[#94867a]/40 inline-block" />
              Información importante
            </div>
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-[#2d2d2d] mb-10">
              POLÍTICAS Y REGLAS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { num: "01", title: "Puntualidad", text: "Llegar con tiempo a tu clase nos ayuda a informarnos sobre alguna lesión o condición. Cuentas con 10 minutos de tolerancia, después de ese tiempo no se podrá interrumpir la clase." },
                { num: "02", title: "Atención plena", text: "Somos un estudio enfocado en promover el movimiento y atención consciente. Agradecemos que tu teléfono esté en silencio y si tienes que atenderlo sea fuera de la clase." },
                { num: "03", title: "Cancelación", text: "Para cancelar tu reserva se tiene como mínimo 2 horas de tolerancia. De no hacerlo se perderá la clase y no habrá reposición." },
                { num: "04", title: "Clase muestra", text: "Costo de $110 con pago total previo. Pregunta disponibilidad antes de pagar. Una vez confirmado, tienes 2hrs para pagar y enviar comprobante. No es reembolsable ni transferible." },
                { num: "05", title: "Reagendar", text: "Para volver a reagendar una clase muestra será necesario realizar el pago nuevamente." },
                { num: "06", title: "Vestimenta", text: "Ropa deportiva cómoda. Calcetas antideslizantes para Pilates. Llega lista para entrenar con comodidad." },
                { num: "07", title: "Pagos", text: "Efectivo, transferencia o depósito. BBVA — Angelina Salas Huante — Tarjeta: 4152 3139 4571 6699 — CLABE: 012 680 01511282689 2" },
                { num: "08", title: "Descuentos", text: "El costo con descuento aplica únicamente si el pago es en efectivo o con transferencia bancaria." },
              ].map((p) => (
                <div
                  key={p.num}
                  className="rounded-2xl border border-[#e8e9e3] bg-[#f4f5ef] p-5 hover:border-[#b5bf9c]/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-300"
                >
                  <div className="font-bebas text-[2.2rem] text-[#b5bf9c]/30 leading-none mb-1">{p.num}</div>
                  <h4 className="font-alilato font-bold text-[0.9rem] text-[#2d2d2d] mb-2">{p.title}</h4>
                  <p className="text-[0.8rem] text-[#5a524a] leading-[1.65] font-alilato">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── CTA + CONTACTO ─────────────────── */}
      <section id="contacto" className="py-20 lg:py-28 px-5 sm:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* CTA Banner */}
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700 text-center mb-16">
            <div className="text-[#94867a] text-[0.78rem] tracking-[0.18em] uppercase font-semibold mb-5">Tu momento es ahora</div>
            <h2 className="font-bebas text-[clamp(3rem,6vw,6rem)] leading-[0.9] text-[#2d2d2d] mb-6">
              ¿LISTA PARA VIVIR<br />
              <span className="text-[#94867a]">LA EXPERIENCIA</span><br />
              <span className="text-[#b5bf9c]">PUNTO NEUTRO?</span>
            </h2>
            <p className="text-[1.05rem] text-[#5a524a] max-w-[500px] mx-auto mb-10 leading-[1.7] font-alilato">
              Un espacio donde puedan tomarse un momento para ellas, liberar tensiones y salir sintiéndose más fuertes, más tranquilas y llenas de energía.
            </p>
            <div className="flex gap-3 justify-center items-center flex-wrap">
              <button
                onClick={() => navigate(membershipCtaPath)}
                className="bg-[#94867a] text-white px-8 sm:px-10 py-4 rounded-full text-[0.85rem] font-semibold tracking-wider uppercase inline-flex items-center gap-2.5 hover:bg-[#7a6f65] hover:shadow-[0_12px_40px_rgba(148,134,122,0.3)] transition-all duration-300 cursor-pointer"
              >
                Reservar clase muestra
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </button>
              <a
                href="https://wa.me/524421234567?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Punto%20Neutro%20Studio"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contactar por WhatsApp"
                className="border-2 border-[#e8e9e3] text-[#2d2d2d] text-[0.85rem] font-medium tracking-wider uppercase flex items-center gap-2.5 px-8 py-4 rounded-full hover:border-[#94867a] hover:text-[#94867a] transition-all duration-300 no-underline cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 0 1-4.243-1.214l-.257-.154-2.88.856.856-2.88-.154-.257A8 8 0 1 1 12 20z" /></svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* Contact + Map grid */}
          <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* Contact card */}
            <div className="rounded-2xl p-8 sm:p-10 flex flex-col justify-between gap-8 bg-[#94867a] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full bg-[radial-gradient(circle,#b5bf9c_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />
              <div className="relative z-10">
                <div className="text-[0.7rem] tracking-[0.18em] uppercase text-white/70 font-semibold mb-3">Encuéntranos</div>
                <h3 className="font-bebas text-[clamp(2rem,3vw,3rem)] leading-[0.95] text-white mb-8">
                  VISÍTANOS<br />EN ESTUDIO
                </h3>
                <div className="flex flex-col gap-5">
                  {[
                    { icon: <MapPin size={20} />, label: "Ubicación", value: "San Juan del Río, Querétaro", accent: "white" },
                    { icon: <Phone size={20} />, label: "Teléfono", value: "+52 442 123 4567", accent: "#b5bf9c" },
                    { icon: <Mail size={20} />, label: "Email", value: "contacto@puntoneutro.mx", accent: "white" },
                    { icon: <Clock size={20} />, label: "Horarios", value: "Lun–Vie 7am–8:30pm · Sáb 8am–10am", accent: "#b5bf9c" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/10 border border-white/15 text-white/80"
                      >
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-[0.65rem] tracking-widest uppercase mb-0.5 text-white/50">{item.label}</div>
                        <div className="text-[0.95rem] text-white font-medium leading-snug">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex flex-col gap-4 pt-6 border-t border-white/15">
                <a
                  href="https://maps.app.goo.gl/qXd1DpwJdTpPeiSP8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-[#5a524a] text-[0.82rem] font-semibold tracking-wider uppercase hover:bg-[#f4f5ef] transition-all no-underline w-fit cursor-pointer"
                >
                  <MapPin size={15} />
                  Cómo llegar
                </a>
                <div className="flex gap-2.5">
                  <a
                    href="https://www.instagram.com/punto_neutro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all no-underline"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                  </a>
                  <a
                    href="https://www.facebook.com/puntoneutromx/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all no-underline"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-2xl overflow-hidden border border-[#e8e9e3] min-h-[450px] lg:min-h-0">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3735.8!2d-99.892498!3d20.5256602!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d39db3c59befdf%3A0x38024941d899fa4d!2sPunto%20Neutro%20Hybrid%20Studio%20%26%20Co.!5e0!3m2!1ses-419!2smx!4v1772066339529!5m2!1ses-419!2smx"
                width="100%"
                height="100%"
                style={{ border: 0, display: "block", minHeight: "450px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de Punto Neutro Studio en Google Maps"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer className="bg-[#2d2d2d] text-white px-5 sm:px-8 pt-16 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/10">
            {/* Brand */}
            <div>
              <img src={puntoNeutroLogo} alt="Punto Neutro" className="h-16 w-auto object-contain mb-4 brightness-200" />
              <p className="text-[0.82rem] text-white/50 leading-[1.7] max-w-[200px] font-alilato">
                Aquí se vive la disciplina, el cuidado del cuerpo y la celebración de cada logro.
              </p>
              <div className="flex gap-2.5 mt-5">
                <a
                  href="https://www.instagram.com/punto_neutro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/40 hover:border-[#b5bf9c] hover:text-[#b5bf9c] transition-colors no-underline"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                </a>
                <a
                  href="https://www.facebook.com/puntoneutromx/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/40 hover:border-[#b5bf9c] hover:text-[#b5bf9c] transition-colors no-underline"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                </a>
              </div>
            </div>

            {/* Estudio */}
            <div>
              <div className="text-[0.7rem] tracking-[0.15em] uppercase text-white/30 font-semibold mb-5">Estudio</div>
              <ul className="flex flex-col gap-2.5 list-none">
                {[["Clases", "clases"], ["Horario", "horario"], ["Paquetes", "membresias"], ["Instructoras", "instructoras"], ["Galería", "galeria"], ["Políticas", "politicas"]].map(([label, id]) => (
                  <li key={id}>
                    <button
                      onClick={() => scrollTo(id)}
                      className="text-[0.85rem] text-white/45 hover:text-[#b5bf9c] transition-colors bg-transparent border-none cursor-pointer p-0 font-alilato"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <div className="text-[0.7rem] tracking-[0.15em] uppercase text-white/30 font-semibold mb-5">Legal</div>
              <ul className="flex flex-col gap-2.5 list-none">
                {[
                  { label: "Aviso de privacidad", path: "/legal/privacidad" },
                  { label: "Términos y condiciones", path: "/legal/terminos" },
                  { label: "Política de cancelación", path: "/legal/cancelacion" },
                ].map((l) => (
                  <li key={l.path}>
                    <button
                      onClick={() => navigate(l.path)}
                      className="text-[0.85rem] text-white/45 hover:text-[#b5bf9c] transition-colors bg-transparent border-none cursor-pointer p-0 font-alilato"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <div className="text-[0.7rem] tracking-[0.15em] uppercase text-white/30 font-semibold mb-5">Contacto</div>
              <ul className="flex flex-col gap-2.5 list-none">
                <li><span className="text-[0.85rem] text-white/45 font-alilato">San Juan del Río, Qro.</span></li>
                <li>
                  <a href="mailto:contacto@puntoneutro.mx" className="text-[0.85rem] text-white/45 hover:text-[#b5bf9c] transition-colors no-underline font-alilato">
                    contacto@puntoneutro.mx
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/524421234567" target="_blank" rel="noopener noreferrer" className="text-[0.85rem] text-white/45 hover:text-[#b5bf9c] transition-colors no-underline font-alilato">
                    WhatsApp
                  </a>
                </li>
                <li>
                  <button onClick={() => scrollTo("horario")} className="text-[0.85rem] text-white/45 hover:text-[#b5bf9c] transition-colors bg-transparent border-none cursor-pointer p-0 font-alilato">
                    Horarios
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-[0.72rem] text-white/25 font-alilato">&copy; 2026 Punto Neutro. Todos los derechos reservados.</p>
            <p className="text-[0.72rem] text-white/25 font-alilato">Hecho con pasión en San Juan del Río</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
