import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import ophelia14 from "@/assets/ophelia-14.jpg";
import ophelia15 from "@/assets/ophelia-15.jpg";
import ophelia28 from "@/assets/ophelia-28.jpg";
import ophelia31 from "@/assets/ophelia-31.jpg";
import ophelia32 from "@/assets/ophelia-32.jpg";
import ophelia38 from "@/assets/ophelia-38.jpg";
import ophelia50 from "@/assets/ophelia-50.jpg";
import opheliaLogo from "@/assets/ophelia-logo-full.png";

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

type ScheduleSlot = {
  id: string;
  time_slot: string;
  day_of_week: number;
  class_label: "JUMPING" | "PILATES" | "SORPRESA";
  shift: "morning" | "evening";
  is_active: boolean;
};

const FALLBACK_CLASS_TYPES: ClassTypeRow[] = [
  { id: "c1", name: "Jumping Fitness", subtitle: "Full Body", description: "Entrena todo el cuerpo en trampolín con coreografías dinámicas y música motivadora. Alta intensidad, bajo impacto.", category: "jumping", intensity: "media", color: "#E15CB8", emoji: "", level: "Todos los niveles", duration_min: 50, capacity: 10, is_active: true, sort_order: 1 },
  { id: "c2", name: "Jumping Dance", subtitle: "Coreografías", description: "Combina el jumping con movimientos de danza. Divertido, enérgico y perfecto para liberar el estrés.", category: "jumping", intensity: "media", color: "#CA71E1", emoji: "", level: "Todos los niveles", duration_min: 50, capacity: 10, is_active: true, sort_order: 2 },
  { id: "c3", name: "Jump & Tone", subtitle: "Tonificación y resistencia", description: "Tonificación y resistencia en tren superior del cuerpo. Usa el trampolín más accesorios de peso.", category: "mixto", intensity: "pesada", color: "#E7EB6E", emoji: "", level: "Intermedio", duration_min: 55, capacity: 10, is_active: true, sort_order: 3 },
  { id: "c4", name: "Strong Jump", subtitle: "Fuerza y glúteo", description: "Fuerza y resistencia en pierna y glúteo. Resultados visibles desde las primeras sesiones.", category: "jumping", intensity: "pesada", color: "#E15CB8", emoji: "", level: "Intermedio", duration_min: 55, capacity: 10, is_active: true, sort_order: 4 },
  { id: "c5", name: "Mindful Jump", subtitle: "Pilates en trampolín", description: "La calma del Pilates con la energía del jumping. Mejora postura, respiración y conciencia corporal.", category: "mixto", intensity: "ligera", color: "#CA71E1", emoji: "", level: "Todos los niveles", duration_min: 60, capacity: 10, is_active: true, sort_order: 5 },
  { id: "c6", name: "Hot Pilates", subtitle: "Pesada", description: "Pilates de alta intensidad con accesorios. Fortalece el core y mejora la postura de manera efectiva.", category: "pilates", intensity: "pesada", color: "#E7EB6E", emoji: "", level: "Avanzado", duration_min: 55, capacity: 10, is_active: true, sort_order: 6 },
  { id: "c7", name: "Flow Pilates", subtitle: "Media", description: "Secuencias fluidas de Pilates Mat que conectan movimiento y respiración. Ideal para todos los niveles.", category: "pilates", intensity: "media", color: "#E15CB8", emoji: "", level: "Todos los niveles", duration_min: 55, capacity: 10, is_active: true, sort_order: 7 },
  { id: "c8", name: "Pilates Mat", subtitle: "Liger", description: "Fundamentos del Pilates en colchoneta. El mejor punto de partida para conocer este método.", category: "pilates", intensity: "ligera", color: "#CA71E1", emoji: "", level: "Principiante", duration_min: 50, capacity: 10, is_active: true, sort_order: 8 },
];

const FALLBACK_PACKAGES: PackageRow[] = [
  // Jumping
  { id: "p1",  name: "4 Clases Jumping",      num_classes: "4",         price: 300,  category: "jumping", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p2",  name: "8 Clases Jumping",      num_classes: "8",         price: 560,  category: "jumping", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p3",  name: "12 Clases Jumping",     num_classes: "12",        price: 780,  category: "jumping", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p4",  name: "16 Clases Jumping",     num_classes: "16",        price: 960,  category: "jumping", validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p5",  name: "20 Clases Jumping",     num_classes: "20",        price: 1100, category: "jumping", validity_days: 30, is_active: true, sort_order: 5 },
  { id: "p6",  name: "Ilimitado Jumping",     num_classes: "ILIMITADO", price: 1000, category: "jumping", validity_days: 30, is_active: true, sort_order: 6 },
  // Pilates
  { id: "p7",  name: "4 Clases Pilates",      num_classes: "4",         price: 300,  category: "pilates", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p8",  name: "8 Clases Pilates",      num_classes: "8",         price: 600,  category: "pilates", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p9",  name: "12 Clases Pilates",     num_classes: "12",        price: 840,  category: "pilates", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p10", name: "16 Clases Pilates",     num_classes: "16",        price: 1120, category: "pilates", validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p11", name: "Ilimitado Pilates",     num_classes: "ILIMITADO", price: 1000, category: "pilates", validity_days: 30, is_active: true, sort_order: 5 },
  // Mixtos
  { id: "p12", name: "8 Clases Mixto",        num_classes: "8",         price: 600,  category: "mixtos",  validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p13", name: "12 Clases Mixto",       num_classes: "12",        price: 860,  category: "mixtos",  validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p14", name: "16 Clases Mixto",       num_classes: "16",        price: 1120, category: "mixtos",  validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p15", name: "20 Clases Mixto",       num_classes: "20",        price: 1300, category: "mixtos",  validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p16", name: "Ilimitado Mixto",       num_classes: "ILIMITADO", price: 1000, category: "mixtos",  validity_days: 30, is_active: true, sort_order: 5 },
];

const FALLBACK_SCHEDULE: ScheduleSlot[] = [
  { id: "s1",  time_slot: "7:00am",  day_of_week: 1, class_label: "JUMPING",  shift: "morning", is_active: true },
  { id: "s2",  time_slot: "7:00am",  day_of_week: 2, class_label: "PILATES",  shift: "morning", is_active: true },
  { id: "s3",  time_slot: "7:00am",  day_of_week: 3, class_label: "JUMPING",  shift: "morning", is_active: true },
  { id: "s4",  time_slot: "7:00am",  day_of_week: 4, class_label: "PILATES",  shift: "morning", is_active: true },
  { id: "s5",  time_slot: "7:00am",  day_of_week: 5, class_label: "SORPRESA", shift: "morning", is_active: true },
  { id: "s6",  time_slot: "9:00am",  day_of_week: 1, class_label: "PILATES",  shift: "morning", is_active: true },
  { id: "s7",  time_slot: "9:00am",  day_of_week: 2, class_label: "JUMPING",  shift: "morning", is_active: true },
  { id: "s8",  time_slot: "9:00am",  day_of_week: 3, class_label: "PILATES",  shift: "morning", is_active: true },
  { id: "s9",  time_slot: "9:00am",  day_of_week: 4, class_label: "JUMPING",  shift: "morning", is_active: true },
  { id: "s10", time_slot: "9:00am",  day_of_week: 6, class_label: "JUMPING",  shift: "morning", is_active: true },
  { id: "s11", time_slot: "6:00pm",  day_of_week: 1, class_label: "JUMPING",  shift: "evening", is_active: true },
  { id: "s12", time_slot: "6:00pm",  day_of_week: 2, class_label: "PILATES",  shift: "evening", is_active: true },
  { id: "s13", time_slot: "6:00pm",  day_of_week: 3, class_label: "JUMPING",  shift: "evening", is_active: true },
  { id: "s14", time_slot: "6:00pm",  day_of_week: 4, class_label: "PILATES",  shift: "evening", is_active: true },
  { id: "s15", time_slot: "6:00pm",  day_of_week: 5, class_label: "JUMPING",  shift: "evening", is_active: true },
  { id: "s16", time_slot: "7:30pm",  day_of_week: 1, class_label: "PILATES",  shift: "evening", is_active: true },
  { id: "s17", time_slot: "7:30pm",  day_of_week: 2, class_label: "JUMPING",  shift: "evening", is_active: true },
  { id: "s18", time_slot: "7:30pm",  day_of_week: 3, class_label: "SORPRESA", shift: "evening", is_active: true },
  { id: "s19", time_slot: "7:30pm",  day_of_week: 4, class_label: "JUMPING",  shift: "evening", is_active: true },
  { id: "s20", time_slot: "7:30pm",  day_of_week: 5, class_label: "PILATES",  shift: "evening", is_active: true },
];

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

/** Returns e.g. "Semana del 23 al 28 de febrero · 2026" in CDMX time */
function getCDMXWeekLabel(): string {
  // Get today in CDMX timezone (UTC-6 / UTC-5 DST — use Intl for accuracy)
  const nowCDMX = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })
  );
  const day = nowCDMX.getDay(); // 0=Sun
  // Monday = start of week
  const diffToMon = day === 0 ? -6 : 1 - day;
  const diffToSat = day === 0 ? 0 : 6 - day;
  const mon = new Date(nowCDMX); mon.setDate(nowCDMX.getDate() + diffToMon);
  const sat = new Date(nowCDMX); sat.setDate(nowCDMX.getDate() + diffToSat);
  const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const monStr = `${mon.getDate()} de ${MONTHS[mon.getMonth()]}`;
  const satStr = mon.getMonth() === sat.getMonth()
    ? `${sat.getDate()} de ${MONTHS[sat.getMonth()]}`
    : `${sat.getDate()} de ${MONTHS[sat.getMonth()]}`;
  return `Semana del ${monStr} al ${satStr} · ${sat.getFullYear()}`;
}

const TESTIMONIOS = [
  { name: "Karla M.", stars: 5, text: "Llevo 6 meses y no puedo parar! Baje 8 kg y me siento increible. El ambiente del studio es unico, las instructoras te motivan a dar lo mejor.", avatar: "KM" },
  { name: "Sofia R.", stars: 5, text: "Empece sin forma fisica y ahora hago Power Jump sin problema. La comunidad de Ophelia es lo mejor, todas nos apoyamos.", avatar: "SR" },
  { name: "Daniela V.", stars: 5, text: "El jumping fue lo que necesitaba. Cuida mis rodillas y aun asi siento que entene duro. Las clases de 7am me cambiaron la manana.", avatar: "DV" },
  { name: "Mariana L.", stars: 5, text: "Desde el primer dia me senti bienvenida. El studio es hermoso, la musica increible y los resultados hablan solos. 100% recomendado.", avatar: "ML" },
  { name: "Valeria P.", stars: 5, text: "Probe mil clases y ninguna me engancho como el jumping. Es adictivo en el mejor sentido, cada clase es diferente y divertidisima.", avatar: "VP" },
  { name: "Fernanda T.", stars: 5, text: "Las instructoras son excelentes, siempre atentas a la tecnica. Me encanta que hay clases para todos los niveles. Ophelia es mi lugar favorito.", avatar: "FT" },
];

const Index = () => {
  const [navScrolled, setNavScrolled] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>(FALLBACK_CLASS_TYPES);
  const [packages, setPackages] = useState<PackageRow[]>(FALLBACK_PACKAGES);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(FALLBACK_SCHEDULE);
  const [activePkgTab, setActivePkgTab] = useState<"jumping" | "pilates" | "mixtos">("jumping");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

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
    api.get<{ data: ScheduleSlot[] }>("/admin/schedule").then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data.filter((s) => s.is_active) : [];
      if (rows.length > 0) setSchedule(rows);
    }).catch(() => {});
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((p) => (p + 1) % TESTIMONIOS.length), 5000);
    return () => clearInterval(t);
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
        className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 lg:px-[60px] py-5 transition-all duration-400 ${
          navScrolled
            ? "bg-background/92 backdrop-blur-[20px]"
            : "bg-gradient-to-b from-background/95 to-transparent"
        }`}
      >
        <a href="#" className="flex items-center">
          <img src={opheliaLogo} alt="Ophelia Jumping Studio" className="h-20 w-auto object-contain" />
        </a>
        <ul className="hidden lg:flex gap-8 list-none">
          {[
            { label: "Clases",      id: "clases" },
            { label: "Horario",     id: "horario" },
            { label: "Paquetes",    id: "membresias" },
            { label: "Instructoras",id: "instructoras" },
            { label: "Videos",      id: "videos" },
            { label: "Contacto",    id: "contacto" },
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
            className="flex items-center gap-2 bg-primary/15 border border-primary/40 text-primary px-5 py-2.5 rounded-full text-[0.82rem] font-medium tracking-wide hover:bg-primary/25 transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[0.75rem] font-bold uppercase">
              {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
            </span>
            {["admin","super_admin"].includes(user.role) ? "Admin" : user.displayName?.split(" ")[0] ?? "Mi cuenta"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/auth/login")}
              className="text-muted-foreground text-[0.82rem] font-normal tracking-widest uppercase hover:text-foreground transition-colors bg-transparent border-none cursor-pointer px-2"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => navigate("/auth/register")}
              className="bg-primary text-primary-foreground px-7 py-3 rounded-full text-[0.82rem] font-medium tracking-wider uppercase hover:scale-[1.04] hover:shadow-[0_0_30px_hsl(var(--pink-glow)/0.35)] transition-all"
            >
              Unirse
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2 items-center px-6 lg:px-[60px] pt-[140px] pb-20 relative overflow-hidden gap-10 lg:gap-[60px]">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[80px] bg-[radial-gradient(circle,hsl(var(--primary)/0.18)_0%,transparent_70%)] -top-[100px] -right-[100px] animate-float pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-[80px] bg-[radial-gradient(circle,hsl(var(--primary)/0.1)_0%,transparent_70%)] bottom-0 left-[100px] animate-float-reverse pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 border border-primary/40 px-4 py-[7px] rounded-full text-xs tracking-[0.12em] uppercase text-primary mb-8 animate-fade-up delay-200">
            <span className="w-[6px] h-[6px] rounded-full bg-primary animate-pulse-dot" />
            San Juan del Río · Querétaro
          </div>
          <h1 className="font-bebas text-[clamp(5rem,9vw,9rem)] leading-[0.9] tracking-tight text-foreground animate-fade-up delay-400">
            SIENTE<br />
            <span className="text-primary">EL VUELO</span><br />
            EN CADA<br />
            <span className="[-webkit-text-stroke:2px_hsl(var(--foreground))] text-transparent">SALTO</span>
          </h1>
          <p className="mt-7 text-[1.05rem] font-light leading-[1.7] text-muted-foreground max-w-[440px] animate-fade-up delay-600">
            El estudio de jumping fitness más completo de la región. Transforma tu cuerpo, libera tu mente y vive la experiencia de volar cada sesión.
          </p>
          <div className="mt-11 flex gap-4 items-center animate-fade-up delay-800">
            <button
              onClick={() => navigate("/auth/register")}
              className="bg-primary text-primary-foreground px-10 py-[18px] rounded-full text-[0.9rem] font-medium tracking-wider uppercase inline-flex items-center gap-[10px] hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_20px_50px_hsl(var(--primary)/0.4)] transition-all"
            >
              Comenzar hoy
              <span className="w-[22px] h-[22px] bg-primary-foreground/20 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
            </button>
            <button
              onClick={() => scrollTo("clases")}
              className="text-foreground text-[0.85rem] font-normal tracking-wider uppercase flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer"
            >
              <span className="w-[42px] h-[42px] border border-foreground/20 rounded-full flex items-center justify-center text-[0.8rem]">▶</span>
              Ver clases
            </button>
          </div>
        </div>

        <div className="relative hidden lg:flex flex-col gap-5 animate-fade-up delay-500">
          <div className="bg-secondary border border-border rounded-[28px] overflow-hidden relative h-[420px]">
            <img src={ophelia31} alt="Alumnas saltando en trampolines en Ophelia Jumping Studio" className="w-full h-full object-cover" />
            <div className="absolute bottom-[-18px] right-[30px] bg-primary rounded-[18px] px-[22px] py-4 flex items-center gap-3 shadow-[0_20px_60px_hsl(var(--primary)/0.4)]">
              <span className="font-bebas text-[2.2rem] leading-none text-primary-foreground">+500</span>
              <span className="text-[0.72rem] text-primary-foreground/80 uppercase tracking-wider leading-tight">Alumnas<br />activas</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-secondary border border-border rounded-[18px] p-[22px] hover:border-primary hover:-translate-y-[3px] transition-all">
              <div className="font-syne text-[0.95rem] font-bold mb-1">800 kcal</div>
              <div className="text-[0.78rem] text-muted-foreground leading-[1.5]">Quema promedio por sesión de 50 min</div>
            </div>
            <div className="bg-secondary border border-border rounded-[18px] p-[22px] hover:border-primary hover:-translate-y-[3px] transition-all">
              <div className="font-syne text-[0.95rem] font-bold mb-1">Bajo impacto</div>
              <div className="text-[0.78rem] text-muted-foreground leading-[1.5]">Cuida tus articulaciones mientras entrenas fuerte</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="bg-secondary border-t border-b border-border grid grid-cols-2 lg:grid-cols-4 text-center">
        {[
          { num: "+500", label: "Alumnas activas" },
          { num: "12", label: "Clases por semana" },
          { num: "5", label: "Años de experiencia" },
          { num: "98%", label: "Lo recomiendan" },
        ].map((s, i) => (
          <div key={i} className="py-10 px-5 border-r border-border last:border-r-0 hover:bg-primary/5 transition-colors">
            <div className="font-bebas text-[3.2rem] text-foreground leading-none mb-[6px]">
              {s.num.includes("+") || s.num.includes("%") ? (
                <>
                  {s.num.replace(/[+%]/g, "")}
                  <span className="text-primary">{s.num.includes("+") ? "+" : "%"}</span>
                </>
              ) : (
                s.num
              )}
            </div>
            <div className="text-[0.78rem] text-muted-foreground tracking-widest uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── BENEFITS ── */}
      <section id="beneficios" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 lg:grid-cols-2 items-end gap-10 mb-12">
          <div>
            <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
              <span className="w-[30px] h-[1px] bg-primary inline-block" />
              Por qué elegirnos
            </div>
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">
              BENEFICIOS QUE<br />TRANSFORMAN
            </h2>
          </div>
          <p className="text-[0.9rem] leading-[1.8] text-muted-foreground">
            El jumping fitness en trampolín no es solo un entrenamiento — es una experiencia completa. Activa tu cuerpo, mejora tu postura, fortalece tu sistema linfático y libera endorfinas desde el primer salto.
          </p>
        </div>
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-[24px] overflow-hidden">
          {[
            { num: "01", title: "Tonificación total", text: "Piernas, glúteos, abdomen y brazos en una sola sesión de alta intensidad y bajo impacto articular." },
            { num: "02", title: "Cardio sin dolor", text: "El trampolín absorbe hasta el 80% del impacto. Tu corazón se fortalece mientras cuidas rodillas y cadera." },
            { num: "03", title: "Bienestar mental", text: "Cada sesión libera serotonina y dopamina. Reduce el estrés, mejora el sueño y eleva tu ánimo." },
            { num: "04", title: "Control de peso", text: "Quema entre 600 y 1000 kcal por clase. Activa tu metabolismo hasta 24 horas después." },
            { num: "05", title: "Sistema linfático", text: "Los rebotes activan el drenaje linfático natural, reduciendo retención de líquidos y celulitis." },
            { num: "06", title: "Comunidad", text: "Entrena rodeada de mujeres que se inspiran mutuamente. Nuestro ambiente celebra cada logro." },
          ].map((b) => (
            <div key={b.num} className="bg-background p-8 relative overflow-hidden group hover:bg-secondary transition-colors">
              <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-[radial-gradient(circle,hsl(var(--primary)/0.1)_0%,transparent_70%)] rounded-full transition-transform duration-400 group-hover:scale-[2.5]" />
              <div className="font-bebas text-[3.5rem] text-foreground/[0.06] leading-none -mb-2">{b.num}</div>
              <div className="font-syne font-bold text-[1rem] mb-2 text-foreground">{b.title}</div>
              <div className="text-[0.84rem] text-muted-foreground leading-[1.65]">{b.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLASSES ── */}
      <section id="clases" className="py-16 lg:py-24 px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Oferta
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">NUESTRAS CLASES</h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Cada semana cambian los tipos de clases, no los horarios. Siempre algo nuevo que descubrir.
            </p>
          </div>
        </div>
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {classTypes.slice(0, 8).map((c) => {
            const catColors: Record<string, string> = {
              jumping: "border-[#E15CB8]/40 bg-[#E15CB8]/5",
              pilates: "border-[#CA71E1]/40 bg-[#CA71E1]/5",
              mixto:   "border-[#E7EB6E]/30 bg-[#E7EB6E]/5",
            };
            const catAccent: Record<string, string> = {
              jumping: "text-[#E15CB8]",
              pilates: "text-[#CA71E1]",
              mixto:   "text-[#E7EB6E]",
            };
            const catTag: Record<string, string> = {
              jumping: "bg-[#E15CB8]/15 text-[#E15CB8] border-[#E15CB8]/25",
              pilates: "bg-[#CA71E1]/15 text-[#CA71E1] border-[#CA71E1]/25",
              mixto:   "bg-[#E7EB6E]/10 text-[#E7EB6E] border-[#E7EB6E]/20",
            };
            return (
              <div key={c.id} className={`rounded-2xl border p-6 flex flex-col gap-3 hover:-translate-y-1 transition-all ${catColors[c.category] ?? "border-border bg-background"}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-syne font-bold text-[1rem] text-foreground leading-tight">{c.name}</h3>
                  <span className={`flex-shrink-0 text-[0.6rem] tracking-wider uppercase px-2 py-[3px] rounded-full border ${catTag[c.category] ?? ""}`}>
                    {c.category}
                  </span>
                </div>
                {c.subtitle && (
                  <p className={`text-[0.78rem] font-medium ${catAccent[c.category] ?? "text-primary"}`}>{c.subtitle}</p>
                )}
                <p className="text-[0.82rem] text-muted-foreground leading-[1.6] flex-1">{c.description}</p>
                <div className="flex gap-4 pt-1 border-t border-white/[0.06]">
                  <span className="text-[0.72rem] text-muted-foreground">{c.duration_min} min</span>
                  <span className="text-[0.72rem] text-muted-foreground">Max. {c.capacity} personas</span>
                  <span className={`text-[0.72rem] ml-auto font-medium ${catAccent[c.category] ?? ""}`}>{c.level}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[0.72rem] text-muted-foreground text-center mt-6 tracking-wide">
          NOTA: CADA SEMANA CAMBIAN LOS TIPOS DE CLASES, NO LOS HORARIOS
        </p>
      </section>

      {/* ── HORARIO ── */}
      <section id="horario" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Disponibilidad
          </div>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-12">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">
              HORARIO<br />SEMANAL
            </h2>
            <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 lg:p-8 lg:min-w-[380px]">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-3 h-3 rounded-full bg-primary animate-pulse flex-shrink-0" />
                <span className="font-bebas text-[clamp(1.3rem,2vw,1.8rem)] text-primary tracking-wide leading-tight">
                  {getCDMXWeekLabel()}
                </span>
              </div>
              <p className="text-[0.9rem] text-muted-foreground leading-[1.7]">
                Clases de lunes a sábado. Reserva tu lugar desde la app con anticipación.
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-8">
            {([
              { label: "JUMPING", bg: "bg-[#E15CB8]", border: "border-[#E15CB8]/50" },
              { label: "PILATES", bg: "bg-[#CA71E1]", border: "border-[#CA71E1]/50" },
              { label: "SORPRESA", bg: "bg-[#E7EB6E]", border: "border-[#E7EB6E]/50" },
            ] as const).map(({ label, bg, border }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${border} bg-white/[0.04]`}>
                <span className={`w-2 h-2 rounded-full ${bg}`} />
                <span className="text-[0.7rem] font-semibold tracking-wider text-foreground/80">{label}</span>
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          {(() => {
            const CELL_STYLE: Record<string, string> = {
              JUMPING:  "bg-[#E15CB8] text-white",
              PILATES:  "bg-[#CA71E1] text-white",
              SORPRESA: "bg-[#E7EB6E] text-[#1F0047]",
            };
            const times = [...new Set(schedule.map((s) => s.time_slot))].sort((a, b) => {
              const toMin = (t: string) => {
                const [h, rest] = t.replace("am","am").replace("pm","pm").split(/(?=[ap]m)/i);
                const [hh, mm] = h.split(":").map(Number);
                const pm = rest?.toLowerCase() === "pm";
                return (pm && hh !== 12 ? hh + 12 : (!pm && hh === 12 ? 0 : hh)) * 60 + (mm || 0);
              };
              return toMin(a) - toMin(b);
            });
            return (
              <>
                {/* Desktop */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[90px_repeat(6,1fr)] gap-2">
                    {/* Header */}
                    <div />
                    {DAYS.map((d) => (
                      <div key={d} className="text-center py-3 px-2 bg-secondary rounded-xl text-[0.8rem] font-bold tracking-widest uppercase text-muted-foreground">{d}</div>
                    ))}
                    {/* Rows */}
                    {times.map((time) => (
                      <>
                        <div key={`t-${time}`} className="flex items-center justify-end pr-3">
                          <span className="text-[0.88rem] font-bold text-foreground/80 whitespace-nowrap">{time}</span>
                        </div>
                        {[1, 2, 3, 4, 5, 6].map((day) => {
                          const cell = schedule.find((s) => s.time_slot === time && s.day_of_week === day);
                          return (
                            <div key={`${time}-${day}`} className="rounded-xl overflow-hidden h-14">
                              {cell ? (
                                <div className={`h-full flex items-center justify-center text-[0.75rem] font-bold tracking-wider ${CELL_STYLE[cell.class_label] ?? "bg-secondary text-foreground"}`}>
                                  {cell.class_label}
                                </div>
                              ) : (
                                <div className="h-full bg-secondary/40 rounded-xl" />
                              )}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>

                {/* Mobile — time blocks */}
                <div className="lg:hidden flex flex-col gap-3">
                  {times.map((time) => (
                    <div key={time} className="rounded-2xl border border-border bg-secondary/40 p-4">
                      <p className="text-[0.82rem] font-bold text-foreground mb-3">{time}</p>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5, 6].map((day) => {
                          const cell = schedule.find((s) => s.time_slot === time && s.day_of_week === day);
                          if (!cell) return null;
                          return (
                            <div key={day} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[0.65rem] font-bold ${CELL_STYLE[cell.class_label] ?? ""}`}>
                              <span className="text-[0.6rem] opacity-70">{DAYS[day - 1]}</span>
                              <span>{cell.class_label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate("/auth/register")}
              className="bg-primary text-primary-foreground px-8 py-4 rounded-full text-[0.82rem] font-medium tracking-wider uppercase hover:-translate-y-1 hover:shadow-[0_15px_40px_hsl(var(--primary)/0.35)] transition-all inline-flex items-center gap-2"
            >
              Reservar mi lugar
              <span className="text-[0.7rem]">↗</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── GALERÍA ── */}
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
          {/* Clean 3-col grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Col 1 — tall + small */}
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-2xl aspect-[4/5] group">
                <img src={ophelia31} alt="Ophelia Studio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="relative overflow-hidden rounded-2xl aspect-square group">
                <img src={ophelia14} alt="Ophelia Studio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {/* Col 2 — small + tall */}
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-2xl aspect-square group">
                <img src={ophelia50} alt="Ophelia Studio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="relative overflow-hidden rounded-2xl aspect-[4/5] group">
                <img src={ophelia28} alt="Ophelia Studio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {/* Col 3 — even split */}
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-2xl aspect-square group">
                <img src={ophelia15} alt="Ophelia Studio" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="relative overflow-hidden rounded-2xl aspect-square group">
                <img src={ophelia38} alt="Ophelia Studio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="relative overflow-hidden rounded-2xl aspect-[3/2] group">
                <img src={ophelia32} alt="Ophelia Studio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VIDEOS ── */}
      <section id="videos" className="py-16 lg:py-24 px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Conoce la experiencia
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">
              MIRA CÓMO<br />SE VIVE
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Descubre la energía de cada clase. Aquí puedes ver fragmentos de lo que te espera en Ophelia.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { title: "Jumping Fitness", desc: "Cardio de alta intensidad en trampolín con música que te hará volar.", placeholder: "🏋️" },
              { title: "Jumping Dance", desc: "Coreografías sobre el trampolín que combinan ritmo y diversión.", placeholder: "💃" },
              { title: "Pilates Flow", desc: "Secuencias fluidas para fortalecer tu core y mejorar postura.", placeholder: "🧘" },
            ].map((v, i) => (
              <div key={i} className="group rounded-3xl overflow-hidden bg-secondary border border-border hover:border-primary/50 transition-all">
                <div className="relative aspect-video bg-gradient-to-br from-[#1F0047] via-[#2d0a40] to-[#1a0035] flex items-center justify-center overflow-hidden">
                  {/* decorative glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.15)_0%,transparent_65%)]" />
                  <div className="relative flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_40px_hsl(var(--primary)/0.3)]">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-primary ml-1">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <span className="text-[0.65rem] tracking-[0.15em] uppercase text-primary/60 font-medium">Video próximamente</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{v.placeholder}</span>
                    <h3 className="font-syne font-bold text-[1rem] text-foreground">{v.title}</h3>
                  </div>
                  <p className="text-[0.82rem] text-muted-foreground leading-[1.6]">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6 tracking-wide">
            LOS VIDEOS SE ACTUALIZARÁN SEMANALMENTE · SIGUE NUESTRAS REDES PARA MÁS CONTENIDO
          </p>
        </div>
      </section>

      {/* ── PAQUETES ── */}
      <section id="membresias" className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Inversion
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
              ELIGE TU<br />PAQUETE
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Paquetes para todos los gustos. Vigencia de 30 dias. Sin compromisos.
            </p>
          </div>
          {/* Category tabs */}
          <div className="flex gap-2 mb-8 flex-wrap">
            {(["jumping", "pilates", "mixtos"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActivePkgTab(cat)}
                className={`px-5 py-2 rounded-full text-[0.78rem] font-medium tracking-wide uppercase transition-all ${
                  activePkgTab === cat
                    ? "bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.3)]"
                    : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
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
                  <div
                    key={p.id}
                    className={`relative rounded-3xl p-8 flex flex-col gap-4 transition-all hover:-translate-y-2 ${
                      isUnlimited
                        ? "bg-primary border-2 border-primary shadow-[0_20px_60px_hsl(var(--primary)/0.35)]"
                        : isPopular
                        ? "bg-background border-2 border-primary/60 shadow-[0_10px_40px_hsl(var(--primary)/0.15)]"
                        : "bg-background border border-border hover:border-primary/50"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CA71E1] text-white text-[0.6rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-medium whitespace-nowrap">
                        Mas popular
                      </div>
                    )}
                    {isUnlimited && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-foreground text-primary text-[0.6rem] tracking-[0.15em] uppercase px-3 py-1 rounded-full font-medium whitespace-nowrap">
                        Mejor valor
                      </div>
                    )}
                    <div className={`text-[0.7rem] tracking-[0.15em] uppercase font-medium ${isUnlimited ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {p.validity_days ?? 30} dias de vigencia
                    </div>
                    <div className={`font-bebas text-[0.95rem] tracking-wide ${isUnlimited ? "text-primary-foreground" : "text-foreground"}`}>
                      {isUnlimited ? "ILIMITADO" : `${p.num_classes} CLASES`}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-bebas text-[3.5rem] leading-none ${isUnlimited ? "text-primary-foreground" : "text-primary"}`}>
                        ${Number(p.price).toLocaleString()}
                      </span>
                      <span className={`text-[0.75rem] ${isUnlimited ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        MXN
                      </span>
                    </div>
                    {!isUnlimited && Number(p.num_classes) > 0 && (
                      <div className={`text-[0.78rem] ${isUnlimited ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        ${(Number(p.price) / Number(p.num_classes)).toFixed(0)}/clase
                      </div>
                    )}
                    <div className="mt-auto">
                      <button
                        onClick={() => navigate("/auth/register")}
                        className={`w-full py-3 rounded-full text-[0.78rem] font-medium tracking-wider uppercase transition-all ${
                          isUnlimited
                            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                            : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        }`}
                      >
                        Elegir paquete
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-muted-foreground mt-8 text-center">
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
            <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground">
              NUESTRAS<br />INSTRUCTORAS
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Certificadas, apasionadas y dedicadas a que cada clase sea tu mejor versión.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { label: "Instructora 1", sub: "Jumping & Pilates" },
              { label: "Instructora 2", sub: "Jumping & Pilates" },
            ].map((inst, i) => (
              <div key={i} className="group rounded-3xl overflow-hidden bg-secondary border border-border hover:border-primary/50 hover:-translate-y-2 transition-all">
                {/* Photo placeholder — full width, tall */}
                <div className="h-[380px] lg:h-[460px] bg-gradient-to-br from-[#1F0047] via-[#2d0a40] to-[#1a0035] flex items-center justify-center relative overflow-hidden">
                  {/* decorative glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,hsl(var(--primary)/0.18)_0%,transparent_65%)]" />
                  <div className="relative flex flex-col items-center gap-4">
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#E15CB8]/25 to-[#CA71E1]/15 border-2 border-[#E15CB8]/30 shadow-[0_0_60px_hsl(var(--primary)/0.2)]">
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#E15CB8]/50">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <span className="text-[0.65rem] tracking-[0.2em] uppercase text-[#E15CB8]/50 font-medium">Foto próximamente</span>
                  </div>
                </div>
                <div className="p-7">
                  <h3 className="font-syne font-bold text-[1.2rem] text-foreground mb-1">{inst.label}</h3>
                  <p className="text-primary text-[0.85rem] tracking-wide font-medium">{inst.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section id="testimonios" className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Comunidad
          </div>
          <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground mb-16">
            LO QUE DICEN<br />NUESTRAS ALUMNAS
          </h2>
          {/* Featured testimonial */}
          <div className="max-w-[700px] mx-auto text-center mb-12">
            <div className="flex justify-center gap-1 mb-6">
              {Array.from({ length: TESTIMONIOS[activeTestimonial].stars }).map((_, i) => (
                <span key={i} className="text-primary text-xl">★</span>
              ))}
            </div>
            <blockquote className="text-[1.1rem] text-foreground leading-[1.8] font-light mb-8 min-h-[80px] transition-all">
              "{TESTIMONIOS[activeTestimonial].text}"
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#CA71E1] flex items-center justify-center text-white font-bold text-sm">
                {TESTIMONIOS[activeTestimonial].avatar}
              </div>
              <span className="font-syne font-semibold text-foreground">{TESTIMONIOS[activeTestimonial].name}</span>
            </div>
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-2 mb-12">
            {TESTIMONIOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`rounded-full transition-all ${i === activeTestimonial ? "w-8 h-2 bg-primary" : "w-2 h-2 bg-border hover:bg-primary/50"}`}
              />
            ))}
          </div>
          {/* Grid de mini testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TESTIMONIOS.map((t, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`text-left rounded-2xl p-6 border transition-all ${
                  i === activeTestimonial
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/40 hover:border-primary/40"
                }`}
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <span key={s} className="text-primary text-sm">★</span>
                  ))}
                </div>
                <p className="text-[0.82rem] text-muted-foreground leading-[1.6] mb-4 line-clamp-2">{t.text}</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-[#CA71E1]/40 flex items-center justify-center text-[0.65rem] font-bold text-primary">
                    {t.avatar}
                  </div>
                  <span className="text-[0.78rem] font-medium text-foreground">{t.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── POLÍTICAS ── */}
      <section id="politicas" className="py-16 lg:py-24 px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Información importante
          </div>
          <h2 className="font-bebas text-[clamp(2.8rem,4.5vw,4.5rem)] leading-[0.95] text-foreground mb-10">
            POLÍTICAS DE CLASE
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                num: "01", title: "Puntualidad",
                text: "Tienes 5 minutos de tolerancia. Una vez iniciada la canción no podremos permitir el ingreso por seguridad y respeto al grupo.",
              },
              {
                num: "02", title: "Reservación",
                text: "Todas las clases requieren reservación previa. Cupo limitado a 10 lugares. Tu lugar queda confirmado desde la app.",
              },
              {
                num: "03", title: "Cancelaciones",
                text: "Con mínimo 2 horas de anticipación. Cancelaciones tardías o inasistencias sin aviso generarán pérdida de clase.",
              },
              {
                num: "04", title: "Pagos",
                text: "Los paquetes deben liquidarse antes o el mismo día. No son transferibles ni reembolsables. Vigencia de 30 días.",
              },
              {
                num: "05", title: "Salud",
                text: "Si estás embarazada, en postparto o tienes lesión, notifícalo antes. Cada alumna es responsable de su condición física.",
              },
              {
                num: "06", title: "Vestimenta",
                text: "Ropa deportiva cómoda. Tenis deportivos obligatorios para Jumping. Calcetas antideslizantes para Pilates.",
              },
              {
                num: "07", title: "Celular",
                text: "Celular en silencio durante la clase. No lo traigas al Mat. Si necesitas usarlo, sal de la clase.",
              },
              {
                num: "08", title: "Artículos",
                text: "Todos los artículos en los lockers. No lleves nada al mat. El agua también va en locker para evitar accidentes.",
              },
            ].map((p) => (
              <div key={p.num} className="rounded-2xl border border-border bg-background p-5 hover:border-primary/30 transition-all">
                <div className="font-bebas text-[2.5rem] text-foreground/[0.07] leading-none -mb-1">{p.num}</div>
                <h4 className="font-syne font-bold text-[0.92rem] text-foreground mb-2">{p.title}</h4>
                <p className="text-[0.8rem] text-muted-foreground leading-[1.65]">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="contacto" className="py-16 lg:py-24 px-6 lg:px-[60px] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10">
          {/* CTA heading */}
          <div className="text-center mb-16">
            <div className="text-primary text-[0.8rem] tracking-[0.15em] uppercase mb-6">¿Lista para transformarte?</div>
            <h2 className="font-bebas text-[clamp(4rem,8vw,8rem)] leading-[0.9] text-foreground mb-8">
              TU PRIMER<br />
              <span className="[-webkit-text-stroke:2px_hsl(var(--foreground)/0.4)] text-transparent">SALTO</span><br />
              TE ESPERA
            </h2>
            <p className="text-[1.1rem] text-muted-foreground max-w-[500px] mx-auto mb-10 leading-[1.7]">
              Únete a más de 500 mujeres que ya eligieron sentir el vuelo. Tu primera clase es gratis.
            </p>
            <div className="flex gap-4 justify-center items-center flex-wrap">
              <button
                onClick={() => navigate("/auth/register")}
                className="bg-primary text-primary-foreground px-10 py-[18px] rounded-full text-[0.9rem] font-medium tracking-wider uppercase inline-flex items-center gap-[10px] hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_20px_50px_hsl(var(--primary)/0.4)] transition-all"
              >
                Crear cuenta gratis
                <span className="w-[22px] h-[22px] bg-primary-foreground/20 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
              </button>
              <a
                href="https://wa.me/524421234567?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20Ophelia%20Studio"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border text-foreground text-[0.85rem] font-normal tracking-wider uppercase flex items-center gap-3 px-8 py-[18px] rounded-full opacity-70 hover:opacity-100 hover:border-primary transition-all no-underline"
              >
                WhatsApp
              </a>
            </div>
          </div>

          {/* Info + Map — 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left — contact info with palette colors */}
            <div className="rounded-3xl p-10 flex flex-col justify-between gap-8 bg-gradient-to-br from-[#1F0047] via-[#2a0050] to-[#1a003a] border border-[#CA71E1]/20 relative overflow-hidden">
              {/* decorative glow */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,#E15CB8_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,#CA71E1_0%,transparent_65%)] opacity-[0.08] pointer-events-none" />

              <div className="relative z-10">
                <div className="text-[0.7rem] tracking-[0.18em] uppercase text-[#E15CB8] font-semibold mb-3">Encuéntranos</div>
                <h3 className="font-bebas text-[clamp(2.5rem,3.5vw,3.5rem)] leading-[0.95] text-[#F9F7E8] mb-8">
                  VISÍTANOS<br />EN ESTUDIO
                </h3>

                <div className="flex flex-col gap-6">
                  {[
                    {
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                        </svg>
                      ),
                      label: "Ubicación",
                      value: "San Juan del Río, Querétaro",
                      accent: "#E15CB8",
                    },
                    {
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.86 11 19.79 19.79 0 0 1 1.77 2.38 2 2 0 0 1 3.74.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.08 6.08l1.28-1.28a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      ),
                      label: "Teléfono",
                      value: "+52 442 123 4567",
                      accent: "#CA71E1",
                    },
                    {
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                      ),
                      label: "Email",
                      value: "info@opheliajumping.mx",
                      accent: "#E15CB8",
                    },
                    {
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                      ),
                      label: "Horarios",
                      value: "Lun–Vie 6am–9pm  ·  Sáb 7am–2pm",
                      accent: "#E7EB6E",
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: item.accent + "20", color: item.accent, border: `1px solid ${item.accent}30` }}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-[0.65rem] tracking-widest uppercase mb-0.5" style={{ color: item.accent }}>{item.label}</div>
                        <div className="text-[1rem] text-[#F9F7E8] font-medium leading-snug">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social row */}
              <div className="relative z-10 flex gap-3 pt-6 border-t border-[#CA71E1]/15">
                {[
                  { label: "Instagram", href: "https://instagram.com/opheliajumping", short: "ig" },
                  { label: "Facebook",  href: "https://facebook.com/opheliajumping",  short: "fb" },
                  { label: "TikTok",    href: "https://tiktok.com/@opheliajumping",   short: "tt" },
                ].map((s) => (
                  <a
                    key={s.short}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full border border-[#E15CB8]/30 flex items-center justify-center text-[0.8rem] text-[#E15CB8]/70 hover:bg-[#E15CB8]/15 hover:text-[#E15CB8] transition-all no-underline"
                  >
                    {s.short}
                  </a>
                ))}
              </div>
            </div>

            {/* Right — Google Map */}
            <div className="rounded-3xl overflow-hidden border border-border min-h-[480px] lg:min-h-0">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3739.577714731379!2d-99.99482528857814!3d20.40029408101758!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d30d002e88643b%3A0xb7eed5074cefa672!2sOphelia%20Jumping%20Studio!5e0!3m2!1ses-419!2smx!4v1772066339529!5m2!1ses-419!2smx"
                width="100%"
                height="100%"
                style={{ border: 0, display: "block", minHeight: "480px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ophelia Jumping Studio ubicación"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-secondary px-6 lg:px-[60px] pt-[60px] border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10">
        <div>
            <div className="mb-3">
              <img src={opheliaLogo} alt="Ophelia Jumping Studio" className="h-20 w-auto object-contain" />
            </div>
            <p className="text-[0.82rem] text-muted-foreground leading-[1.7] max-w-[200px]">
              El jumping studio que eleva tu cuerpo y transforma tu vida, salto a salto.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="https://instagram.com/opheliajumping" target="_blank" rel="noopener noreferrer" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground text-[0.85rem] hover:border-primary hover:text-primary transition-colors no-underline">ig</a>
              <a href="https://facebook.com/opheliajumping" target="_blank" rel="noopener noreferrer" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground text-[0.85rem] hover:border-primary hover:text-primary transition-colors no-underline">fb</a>
              <a href="https://tiktok.com/@opheliajumping" target="_blank" rel="noopener noreferrer" className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground text-[0.85rem] hover:border-primary hover:text-primary transition-colors no-underline">tt</a>
            </div>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Estudio</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {[["Clases", "clases"], ["Horario", "horario"], ["Paquetes", "membresias"], ["Instructoras", "instructoras"], ["Políticas", "politicas"]].map(([label, id]) => (
                <li key={id}>
                  <button onClick={() => scrollTo(id)} className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">
                    {label}
                  </button>
                </li>
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
                <li key={l.path}>
                  <button
                    onClick={() => navigate(l.path)}
                    className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    {l.label}
                  </button>
                </li>
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
          <p className="text-[0.75rem] text-muted-foreground/50">© 2026 Ophelia Jumping Studio. Todos los derechos reservados.</p>
          <p className="text-[0.75rem] text-muted-foreground/50">Hecho con ♥ en San Juan del Río</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
