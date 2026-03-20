import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Schedule from "@/components/Schedule";
import { Dumbbell, Music, Waves, Flame, Zap, Heart, Activity, Sparkles, Flower2, Clock, type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
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
  { id: "comp1", name: 'Consulta de nutrición "Salud hormonal"', specialist: "LN. Clara Pérez", price: 1030, discount_price: 990 },
  { id: "comp2", name: 'Consulta de nutrición "Rendimiento Físico"', specialist: "LN. Majo Zamorano", price: 1250, discount_price: 1190 },
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
      {/* ── NAV ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-6 lg:px-[60px] py-3 sm:py-4 transition-all duration-400 ${navScrolled
          ? "bg-background/92 backdrop-blur-[20px]"
          : "bg-gradient-to-b from-background/95 to-transparent"
          }`}
      >
        <a href="#" className="flex items-center" aria-label="Punto Neutro - Inicio">
          <img src={puntoNeutroLogo} alt="Punto Neutro" className="h-20 sm:h-24 lg:h-32 w-auto object-contain" />
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
            onClick={() => navigate(["admin", "super_admin", "instructor", "reception"].includes(user.role) ? "/admin/dashboard" : "/app")}
            className="flex items-center gap-2 bg-primary/15 border border-primary/40 text-primary px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[0.75rem] sm:text-[0.82rem] font-medium tracking-wide hover:bg-primary/25 transition-all max-w-[190px]"
          >
            <span className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[0.75rem] font-bold uppercase">
              {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
            </span>
            <span className="truncate">
              {["admin", "super_admin"].includes(user.role) ? "Admin" : user.displayName?.split(" ")[0] ?? "Mi cuenta"}
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
              className="bg-primary text-primary-foreground px-4 sm:px-7 py-2.5 sm:py-3 rounded-full text-[0.75rem] sm:text-[0.82rem] font-medium tracking-wider uppercase hover:scale-[1.04] hover:shadow-[0_0_30px_hsl(var(--primary)/0.35)] transition-all"
            >
              Unirse
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO — Movimiento con propósito ── */}
      <section className="relative min-h-[90vh] flex flex-col lg:flex-row items-center pt-[100px] pb-20 px-6 lg:px-[60px] bg-[#ebede5] overflow-hidden">
        <div className="flex-1 z-10 w-full lg:max-w-[50%] flex flex-col items-center lg:items-start text-center lg:text-left pt-10 lg:pt-0">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#94867a]/10 text-[#94867a] text-[0.7rem] uppercase tracking-[0.15em] font-medium mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#94867a] animate-pulse" />
            Movimiento con propósito
          </div>

          <h1 className="font-bebas text-[clamp(4rem,10vw,8.5rem)] leading-[0.85] tracking-tight text-[#2d2d2d] animate-fade-up delay-200 mb-6 w-full">
            ENCUENTRA<br />
            <span className="text-[#94867a]">TU EQUILIBRIO</span>
          </h1>

          <p className="text-[clamp(1.05rem,1.5vw,1.25rem)] text-[#2d2d2d]/70 leading-[1.6] max-w-[500px] mb-10 animate-fade-up delay-400">
            Un espacio creado para fortalecer el cuerpo, conectar con el movimiento y encontrar equilibrio. Pilates, Flex & Flow y Body Strong — entrenamos con intención.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-fade-up delay-600">
            <button
              onClick={() => navigate("/auth/register")}
              className="bg-[#94867a] text-[#ebede5] px-10 py-[18px] rounded-full text-[0.85rem] font-medium tracking-wider uppercase inline-flex items-center justify-center gap-[10px] hover:bg-[#7a6f65] transition-colors"
            >
              Comenzar hoy
              <span className="w-[22px] h-[22px] bg-white/10 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
            </button>
            <button
              onClick={() => scrollTo("clases")}
              className="px-8 py-[18px] rounded-full text-[0.85rem] text-[#2d2d2d] border border-[#94867a]/30 font-medium tracking-wider uppercase flex items-center justify-center gap-2 hover:bg-[#94867a]/10 transition-colors"
            >
              Ver clases
            </button>
          </div>
        </div>

        <div className="flex-1 w-full mt-16 lg:mt-0 relative h-[50vh] lg:h-[80vh] ml-0 lg:ml-10 animate-fade-up delay-500">
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden bg-[#d3d8c4] border-4 border-white shadow-2xl z-10 rotate-[-2deg] hover:rotate-0 transition-transform duration-700">
            <img src={pnImg9} alt="Alumnas en Punto Neutro" className="w-full h-full object-cover scale-105" />
          </div>
          <div className="absolute top-10 -right-10 w-32 h-32 rounded-full bg-[#b5bf9c]/30 blur-2xl" />
          <div className="absolute -bottom-10 left-10 w-40 h-40 rounded-full bg-[#94867a]/20 blur-2xl" />
        </div>
      </section>

      {/* ── DISCIPLINAS ── */}
      <div className="bg-secondary border-t border-b border-border">
        <div className="grid grid-cols-2 sm:grid-cols-4 text-center">
          {([
            { name: "PILATES CLÁSICO", color: "#b5bf9c", Icon: Waves, desc: "Método clásico" },
            { name: "TERAPÉUTICO", color: "#94867a", Icon: Heart, desc: "Bienestar integral" },
            { name: "FLEX & FLOW", color: "#b5bf9c", Icon: Activity, desc: "Movimiento libre" },
            { name: "BODY STRONG", color: "#94867a", Icon: Dumbbell, desc: "Fuerza funcional" },
          ] as const).map((d, i) => (
            <div key={i} className="py-8 sm:py-10 px-3 sm:px-5 border-r border-border last:border-r-0 hover:bg-[#94867a]/[0.03] transition-colors group cursor-default">
              <div className="flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: d.color + "15", border: "1px solid " + d.color + "30" }}>
                  <d.Icon size={28} className="sm:hidden" style={{ color: d.color }} strokeWidth={1.8} />
                  <d.Icon size={32} className="hidden sm:block" style={{ color: d.color }} strokeWidth={1.8} />
                </div>
              </div>
              <div className="font-bebas text-[1.1rem] sm:text-[1.5rem] leading-none mb-1 sm:mb-2" style={{ color: d.color }}>{d.name}</div>
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
            Movimiento con propósito
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
          </div>
          <h2 className="font-bebas text-[clamp(2.5rem,4vw,4rem)] leading-[0.95] text-foreground mb-8">
            MÁS QUE UN ESTUDIO,<br /><span className="text-primary">UN ESPACIO PARA TI</span>
          </h2>
          <p className="text-[1.05rem] text-muted-foreground leading-[1.9] mb-6">
            Nuestro estudio es un espacio creado para fortalecer el cuerpo, conectar con el movimiento y encontrar equilibrio. 
            Más que un lugar para entrenar, es un espacio donde cada persona se desafía, avanza y disfruta su proceso.
          </p>
          <p className="text-[1rem] text-foreground/80 leading-[1.8] italic font-alilato">
            &ldquo;Trabajamos con energía, fuerza y constancia, siempre desde el respeto por cada cuerpo y cada etapa. 
            Entrenamos con intención, con exigencia y disciplina, acompañando a cada alumna para que descubra y desarrolle su potencial.&rdquo;
          </p>
          <p className="text-[0.85rem] text-primary mt-4 font-medium">— Punto Neutro</p>
        </div>
      </section>

      {/* ── GALERÍA ── */}
      <section id="galeria" className="py-20 lg:py-32 px-6 lg:px-[60px] bg-secondary border-y border-border">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 max-w-[1200px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
            <div>
              <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
                <span className="w-[30px] h-[1px] bg-primary inline-block" />
                El Estudio
              </div>
              <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">
                NUESTRO<br />ESPACIO
              </h2>
            </div>
            <p className="text-[0.95rem] text-muted-foreground max-w-[400px] leading-[1.8] lg:text-right">
              Un espacio seguro y acogedor, donde cada clienta se sienta cómoda, acompañada y en confianza.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 h-auto md:h-[800px]">
            <div className="md:col-span-2 md:row-span-2 rounded-3xl overflow-hidden relative group">
              <img src={pnImg7} alt="Punto Neutro Studio" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <span className="bg-[#b5bf9c]/30 backdrop-blur-md text-white text-[0.65rem] uppercase tracking-wider px-3 py-1.5 rounded-full mb-3 inline-block">Punto Neutro</span>
                <h3 className="text-white font-syne font-bold text-2xl">Fuerza & Bienestar</h3>
              </div>
            </div>

            <div className="md:col-span-2 md:row-span-1 rounded-3xl overflow-hidden relative group hidden md:block">
              <img src={pnImg10} alt="Pilates" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>

            <div className="md:col-span-1 md:row-span-1 rounded-3xl overflow-hidden relative group">
              <img src={pnImg8} alt="Detalles" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#94867a]/30 to-transparent" />
            </div>

            <div className="md:col-span-1 md:row-span-1 rounded-3xl overflow-hidden relative group">
              <img src={pnImg5} alt="Comunidad" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>

            <div className="md:col-span-4 md:row-span-1 rounded-3xl overflow-hidden relative group">
              <img src={pnImg3} alt="Entrenamiento" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: "center 20%" }} />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-700" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white font-bebas text-4xl tracking-wide opacity-80">MOVIMIENTO CON PROPÓSITO</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLASES ── */}
      <section id="clases" className="py-16 lg:py-24 px-6 lg:px-[60px] bg-background">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Nuestras Modalidades
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">NUESTRAS CLASES</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[400px] leading-[1.7]">
              Descubre qué modalidad va mejor con tu energía. Entrenamientos diseñados para retarte y reconectarte.
            </p>
          </div>
        </div>

        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 md:grid-cols-2 gap-6">
          {classTypes.slice(0, 4).map((c) => {
            const catColors: Record<string, string> = { pilates: "bg-[#b5bf9c]/20 text-[#7a855d]", mixto: "bg-[#ebede5] text-[#8a8c85]", funcional: "bg-[#94867a]/10 text-[#94867a]" };
            const badgeStyle = catColors[c.category] ?? "bg-primary/10 text-primary";
            const Icon = getCardIcon(c.emoji, c.name);
            const catLabel: Record<string, string> = { pilates: "Pilates", mixto: "Flexibilidad", funcional: "Funcional" };

            return (
              <div key={c.id} className="group relative rounded-3xl p-8 bg-secondary/50 border border-border hover:bg-secondary hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#b5bf9c]/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />

                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${badgeStyle}`}>
                    <Icon size={28} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[0.65rem] tracking-wider uppercase font-medium ${badgeStyle}`}>
                    {catLabel[c.category] ?? c.category}
                  </span>
                </div>

                <h3 className="font-syne font-bold text-[1.25rem] text-foreground mb-2 leading-tight group-hover:text-primary transition-colors">{c.name}</h3>
                <p className="text-[0.88rem] text-muted-foreground leading-[1.7] mb-8 flex-1">
                  {c.description}
                </p>

                <div className="flex items-center gap-4 text-[0.75rem] text-muted-foreground font-medium pt-5 border-t border-border mt-auto">
                  <div className="flex items-center gap-1.5"><Clock size={14} /> {c.duration_min} min</div>
                  <div className="w-1 h-1 rounded-full bg-border" />
                  <div>{c.level}</div>
                  <div className="w-1 h-1 rounded-full bg-border" />
                  <div>Max. {c.capacity} per.</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── HORARIO ── */}
      <Schedule />

      {/* ── PAQUETES ── */}
      <section id="membresias" className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Inversión
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">ELIGE TU<br />PAQUETE</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[400px] leading-[1.7]">
              Paquetes básicos y complementos para una experiencia integral. El descuento aplica si pagas en efectivo o con transferencia.
            </p>
          </div>

          {/* Clase muestra */}
          <div className="rounded-3xl border border-[#b5bf9c]/40 bg-background mb-8 p-5 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-5">
              <div>
                <p className="text-[0.68rem] tracking-[0.15em] uppercase text-[#6b7a4e] font-medium">Clase muestra</p>
                <h3 className="font-syne font-bold text-[1.4rem] text-foreground mt-1">Conoce nuestro estudio</h3>
              </div>
              <p className="text-[0.8rem] text-muted-foreground lg:text-right max-w-md">
                $110 · Requiere confirmación de horario · Pago previo · No reembolsable · No transferible
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl border flex items-center justify-center border-[#b5bf9c]/50 bg-[#b5bf9c]/15">
                  <img src={imgPilates} alt="" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <p className="text-[0.7rem] tracking-[0.15em] uppercase text-[#7a6f65]">Punto Neutro</p>
                  <h4 className="font-syne font-bold text-[1rem] text-foreground">Clase muestra</h4>
                </div>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bebas text-[2.8rem] leading-none text-primary">$110</span>
                <span className="text-[0.75rem] text-muted-foreground mb-1">MXN</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[0.67rem]">
                <span className="px-2 py-1 rounded-full border border-primary/30 text-primary">1 clase</span>
                <span className="px-2 py-1 rounded-full border border-border text-muted-foreground">Preguntar disponibilidad</span>
                <span className="px-2 py-1 rounded-full border border-amber-600/25 text-amber-700">No reembolsable</span>
              </div>
              <button onClick={() => navigate(membershipCtaPath)}
                className="mt-2 w-full py-3 rounded-full text-[0.76rem] font-medium tracking-wider uppercase border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                Quiero mi clase muestra
              </button>
            </div>
          </div>

          {/* Paquetes Básicos */}
          <h3 className="font-syne font-bold text-[1.2rem] text-foreground mb-6">Paquetes básicos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {FALLBACK_PACKAGES.map((p) => {
              const isPopular = p.num_classes === "12";
              const isBest = p.num_classes === "16";
              return (
                <div key={p.id}
                  className={"relative rounded-3xl p-8 flex flex-col gap-4 transition-all hover:-translate-y-2 " + (
                    isBest
                      ? "bg-[#94867a] border-2 border-[#94867a] shadow-[0_20px_60px_rgba(148,134,122,0.35)]"
                      : isPopular
                        ? "bg-background border-2 border-[#b5bf9c] shadow-[0_10px_40px_rgba(181,191,156,0.15)]"
                        : "bg-background border border-border hover:border-[#b5bf9c]/50"
                  )}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#b5bf9c] text-[#2d2d2d] text-[0.6rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-medium whitespace-nowrap">Más popular</div>
                  )}
                  {isBest && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ebede5] text-[#94867a] text-[0.6rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-medium whitespace-nowrap">Mejor valor</div>
                  )}
                  <div className={"text-[0.7rem] tracking-[0.15em] uppercase font-medium " + (isBest ? "text-[#ebede5]" : "text-muted-foreground")}>
                    {p.validity_days ?? 30} dias de vigencia
                  </div>
                  <div className={"font-bebas text-[0.95rem] tracking-wide " + (isBest ? "text-white" : "text-foreground")}>
                    {p.num_classes === "1" ? "CLASE SUELTA" : p.num_classes + " CLASES"}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={"font-bebas text-[3.5rem] leading-none " + (isBest ? "text-white" : "text-primary")}>
                      ${Number(p.price).toLocaleString()}
                    </span>
                    <span className={"text-[0.75rem] " + (isBest ? "text-[#ebede5]" : "text-muted-foreground")}>MXN</span>
                  </div>
                  {p.discount_price && (
                    <div className={"text-[0.78rem] " + (isBest ? "text-[#d4dbc4]" : "text-[#6b7a4e]")}>
                      Efectivo/transferencia: <strong>${p.discount_price.toLocaleString()}</strong>
                    </div>
                  )}
                  {Number(p.num_classes) > 1 && (
                    <div className={"text-[0.78rem] " + (isBest ? "text-[#ebede5]" : "text-muted-foreground")}>
                      ${(Number(p.price) / Number(p.num_classes)).toFixed(0)}/clase
                    </div>
                  )}
                  <div className="mt-auto">
                    <button onClick={() => navigate(membershipCtaPath)}
                      className={"w-full py-3 rounded-full text-[0.78rem] font-medium tracking-wider uppercase transition-all " + (
                        isBest
                          ? "bg-[#ebede5] text-[#94867a] hover:bg-[#ebede5]/90"
                          : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      )}>
                      Elegir paquete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paquetes Completos */}
          <h3 className="font-syne font-bold text-[1.2rem] text-foreground mb-2">Paquetes completos</h3>
          <p className="text-[0.85rem] text-muted-foreground mb-6">
            Elige un paquete básico + agrega un complemento. El precio incluye tus clases + 1 sesión con especialista.
          </p>

          {/* Pricing tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              { classes: 8, price: 1030, discount: 990 },
              { classes: 12, price: 1250, discount: 1190 },
              { classes: 16, price: 1450, discount: 1340 },
            ].map((tier) => (
              <div key={tier.classes} className="rounded-3xl p-7 bg-background border border-[#b5bf9c]/30 hover:border-[#b5bf9c]/60 hover:-translate-y-1 transition-all flex flex-col gap-3">
                <div className="text-[0.68rem] tracking-[0.15em] uppercase text-[#6b7a4e] font-medium">Paquete completo</div>
                <h4 className="font-syne font-bold text-[1.1rem] text-foreground">{tier.classes} Clases + Complemento</h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-bebas text-[3rem] leading-none text-primary">${tier.price.toLocaleString()}</span>
                  <span className="text-[0.75rem] text-muted-foreground">MXN</span>
                </div>
                <p className="text-[0.78rem] text-[#6b7a4e]">
                  Efectivo/transferencia: <strong>${tier.discount.toLocaleString()}</strong>
                </p>
                <button onClick={() => navigate(membershipCtaPath)}
                  className="mt-auto w-full py-3 rounded-full text-[0.76rem] font-medium tracking-wider uppercase border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                  Elegir paquete
                </button>
              </div>
            ))}
          </div>

          {/* Complementos disponibles */}
          <p className="text-[0.78rem] font-semibold text-foreground mb-3">Agrega un complemento:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COMPLEMENTOS.map((comp) => (
              <div key={comp.id} className="rounded-2xl p-5 bg-background border border-border flex flex-col gap-2">
                <h4 className="font-syne font-bold text-[0.9rem] text-foreground leading-tight">{comp.name}</h4>
                <p className="text-[0.78rem] text-muted-foreground">{comp.specialist}</p>
              </div>
            ))}
          </div>
          <p className="text-[0.72rem] text-muted-foreground mt-3">
            *El costo con descuento aplica pagando con efectivo o transferencia. El precio es el mismo sin importar que complemento elijas.
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-background/50 p-5 text-center">
            <p className="text-[0.82rem] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Metodos de pago:</strong> Efectivo, transferencia o deposito.<br />
              <strong className="text-foreground">BBVA</strong> · Beneficiario: Angelina Salas Huante · Tarjeta: 4152 3139 4571 6699 · Cuenta: 151 128 2689 · CLABE: 012 680 01511282689 2
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              *El costo con descuento unicamente es si el pago es en efectivo o con transferencia.
            </p>
          </div>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Vigencia desde la primera clase · Aplican terminos y condiciones · Precios en MXN
          </p>
        </div>
      </section>

      {/* ── INSTRUCTORAS ── */}
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
          <div className={"grid grid-cols-1 " + ((instructors.length > 0 ? instructors.length : 1) === 1 ? "max-w-md mx-auto" : "sm:grid-cols-2") + " " + ((instructors.length > 0 ? instructors.length : 1) >= 3 ? "lg:grid-cols-3" : "") + " gap-6"}>
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
              <div key={inst.key} className="group rounded-3xl overflow-hidden bg-secondary border border-border hover:border-primary/50 hover:-translate-y-2 transition-all">
                <div className="h-[380px] lg:h-[460px] bg-gradient-to-br from-[#94867a] via-[#b5bf9c]/30 to-[#ebede5] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,hsl(var(--primary)/0.18)_0%,transparent_65%)]" />
                  {inst.photoUrl ? (
                    <img src={inst.photoUrl} alt={inst.label}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      style={{ objectPosition: clampFocus(inst.photoFocusX) + "% " + clampFocus(inst.photoFocusY) + "%" }} />
                  ) : (
                    <div className="relative flex flex-col items-center gap-4">
                      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#94867a]/25 to-[#b5bf9c]/15 border-2 border-[#94867a]/30 shadow-[0_0_60px_hsl(var(--primary)/0.2)]">
                        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#94867a]/50">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <span className="text-[0.65rem] tracking-[0.2em] uppercase text-[#94867a]/50 font-medium">Foto próximamente</span>
                    </div>
                  )}
                </div>
                <div className="p-7">
                  {inst.coachTitle && (
                    <div className="font-bebas text-[1.6rem] tracking-wide leading-none mb-1 text-[#94867a]">
                      {inst.coachTitle}
                    </div>
                  )}
                  <h3 className="font-syne font-bold text-[1.2rem] text-foreground mb-1">{inst.label}</h3>
                  <p className="text-primary text-[0.78rem] tracking-wide font-medium leading-relaxed">{inst.sub}</p>
                  {inst.bio && <p className="text-[0.8rem] text-muted-foreground mt-3 leading-relaxed">{inst.bio}</p>}
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

      {/* ── POLÍTICAS ── */}
      <section id="politicas" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Información importante
          </div>
          <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground mb-10">POLÍTICAS Y REGLAS</h2>
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
              <div key={p.num} className="rounded-2xl border border-border bg-secondary p-5 hover:border-[#b5bf9c]/40 transition-all">
                <div className="font-bebas text-[2.5rem] text-foreground/[0.12] leading-none -mb-1">{p.num}</div>
                <h4 className="font-syne font-bold text-[0.92rem] text-foreground mb-2">{p.title}</h4>
                <p className="text-[0.8rem] text-muted-foreground leading-[1.65]">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="contacto" className="py-16 lg:py-24 px-6 lg:px-[60px] relative overflow-hidden bg-secondary">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10">
          <div className="text-center mb-16">
            <div className="text-primary text-[0.8rem] tracking-[0.15em] uppercase mb-6">Tu momento es ahora</div>
            <h2 className="font-bebas text-[clamp(3.5rem,7vw,7rem)] leading-[0.9] text-foreground mb-8">
              ¿LISTA PARA VIVIR<br /><span className="text-primary">LA EXPERIENCIA</span><br />
              <span style={{ WebkitTextStroke: "2px hsl(28 12% 53% / 0.4)", color: "transparent" }}>PUNTO NEUTRO?</span>
            </h2>
            <p className="text-[1.1rem] text-muted-foreground max-w-[500px] mx-auto mb-10 leading-[1.7]">
              Un espacio donde puedan tomarse un momento para ellas, liberar tensiones y salir sintiéndose más fuertes, más tranquilas y llenas de energía.
            </p>
            <div className="flex gap-4 justify-center items-center flex-wrap">
              <button onClick={() => navigate(membershipCtaPath)}
                className="bg-primary text-primary-foreground px-10 py-[18px] rounded-full text-[0.9rem] font-medium tracking-wider uppercase inline-flex items-center gap-[10px] hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_20px_50px_hsl(var(--primary)/0.4)] transition-all">
                Reservar clase muestra
                <span className="w-[22px] h-[22px] bg-primary-foreground/20 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
              </button>
              <a href="https://wa.me/524421234567?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Punto%20Neutro%20Studio"
                target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp"
                className="border border-border text-foreground text-[0.85rem] font-normal tracking-wider uppercase flex items-center gap-3 px-8 py-[18px] rounded-full hover:border-primary hover:text-primary transition-all no-underline">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 0 1-4.243-1.214l-.257-.154-2.88.856.856-2.88-.154-.257A8 8 0 1 1 12 20z" /></svg>
                WhatsApp
              </a>
            </div>
          </div>
          {/* Info + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="rounded-3xl p-10 flex flex-col justify-between gap-8 bg-gradient-to-br from-[#94867a] via-[#7a6f65] to-[#5a524a] border border-[#b5bf9c]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,#b5bf9c_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,#ebede5_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />
              <div className="relative z-10">
                <div className="text-[0.7rem] tracking-[0.18em] uppercase text-[#ebede5] font-semibold mb-3">Encuéntranos</div>
                <h3 className="font-bebas text-[clamp(2.5rem,3.5vw,3.5rem)] leading-[0.95] text-[#ebede5] mb-8">VISÍTANOS<br />EN ESTUDIO</h3>
                <div className="flex flex-col gap-6">
                  {[
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>, label: "Ubicación", value: "San Juan del Río, Querétaro", accent: "#ebede5" },
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 11 19.79 19.79 0 0 1 1.77 2.38 2 2 0 0 1 3.74.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.08 6.08l1.28-1.28a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>, label: "Teléfono", value: "+52 442 123 4567", accent: "#b5bf9c" },
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>, label: "Email", value: "contacto@puntoneutro.mx", accent: "#ebede5" },
                    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>, label: "Horarios", value: "Lun–Vie 7am–8:30pm  ·  Sáb 8am–10am", accent: "#b5bf9c" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.accent + "20", color: item.accent, border: "1px solid " + item.accent + "30" }}>{item.icon}</div>
                      <div>
                        <div className="text-[0.65rem] tracking-widest uppercase mb-0.5" style={{ color: item.accent }}>{item.label}</div>
                        <div className="text-[1rem] text-[#ebede5] font-medium leading-snug">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex flex-col gap-4 pt-6 border-t border-[#b5bf9c]/15">
                <a href="https://maps.app.goo.gl/K3eSrZuj474z4kSS6" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#ebede5] text-[#5a524a] text-[0.82rem] font-semibold tracking-wider uppercase hover:bg-[#ebede5]/90 transition-all no-underline w-fit">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
                  Cómo llegar
                </a>
                <div className="flex gap-3">
                  <a href="https://www.instagram.com/punto_neutro/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                    className="w-10 h-10 rounded-full border border-[#ebede5]/30 flex items-center justify-center text-[#ebede5]/70 hover:bg-[#ebede5]/15 hover:text-[#ebede5] transition-all no-underline">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                  </a>
                  <a href="https://www.facebook.com/puntoneutromx/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                    className="w-10 h-10 rounded-full border border-[#ebede5]/30 flex items-center justify-center text-[#ebede5]/70 hover:bg-[#ebede5]/15 hover:text-[#ebede5] transition-all no-underline">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden border border-border min-h-[480px] lg:min-h-0">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3739.577714731379!2d-99.99482528857814!3d20.40029408101758!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d30d002e88643b%3A0xb7eed5074cefa672!2sPunto%20Neutro%20Studio!5e0!3m2!1ses-419!2smx!4v1772066339529!5m2!1ses-419!2smx"
                width="100%" height="480" style={{ border: 0, display: "block", minHeight: "480px" }}
                allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Ubicacion de Punto Neutro Studio en Google Maps" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-background px-6 lg:px-[60px] pt-[60px] border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10">
          <div>
            <div className="mb-3"><img src={puntoNeutroLogo} alt="Punto Neutro" className="h-20 w-auto object-contain" /></div>
            <p className="text-[0.82rem] text-muted-foreground leading-[1.7] max-w-[200px]">
              Aquí se vive la disciplina, el cuidado del cuerpo y la celebración de cada logro.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="https://www.instagram.com/punto_neutro/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors no-underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
              </a>
              <a href="https://www.facebook.com/puntoneutromx/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors no-underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
            </div>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Estudio</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {[["Clases", "clases"], ["Horario", "horario"], ["Paquetes", "membresias"], ["Instructoras", "instructoras"], ["Galería", "galeria"], ["Políticas", "politicas"]].map(([label, id]) => (
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
              <li><a href="mailto:contacto@puntoneutro.mx" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">contacto@puntoneutro.mx</a></li>
              <li><a href="https://wa.me/524421234567" target="_blank" rel="noopener noreferrer" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">WhatsApp</a></li>
              <li><button onClick={() => scrollTo("horario")} className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">Horarios</button></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[0.75rem] text-muted-foreground/50">© 2026 Punto Neutro. Todos los derechos reservados.</p>
          <p className="text-[0.75rem] text-muted-foreground/50">Hecho con pasión en San Juan del Río ♡</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
