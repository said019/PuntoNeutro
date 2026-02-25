import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import ophelia14 from "@/assets/ophelia-14.jpg";
import ophelia15 from "@/assets/ophelia-15.jpg";
import ophelia28 from "@/assets/ophelia-28.jpg";
import ophelia31 from "@/assets/ophelia-31.jpg";
import ophelia32 from "@/assets/ophelia-32.jpg";
import ophelia38 from "@/assets/ophelia-38.jpg";
import ophelia50 from "@/assets/ophelia-50.jpg";

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
  { id: "c1", name: "Jumping Basics", subtitle: "El punto de partida perfecto", description: "Aprende los fundamentos del jumping fitness con movimientos accesibles y musica motivadora.", category: "jumping", intensity: "ligera", color: "#E040FB", emoji: "🚀", level: "Principiante", duration_min: 50, capacity: 15, is_active: true, sort_order: 1 },
  { id: "c2", name: "Power Jump", subtitle: "Lleva tu limite al siguiente nivel", description: "Coreografias dinamicas, intervalos HIIT y musica que no para. Para quienes ya dominan las bases.", category: "jumping", intensity: "pesada", color: "#CA71E1", emoji: "⚡", level: "Intermedio", duration_min: 55, capacity: 12, is_active: true, sort_order: 2 },
  { id: "c3", name: "Jump & Stretch", subtitle: "Muevete y recuperate", description: "Combina jumping con yoga y stretching profundo. Ideal para relajar y ganar flexibilidad.", category: "mixto", intensity: "ligera", color: "#E7EB6E", emoji: "🌸", level: "Todos los niveles", duration_min: 60, capacity: 10, is_active: true, sort_order: 3 },
];

const FALLBACK_PACKAGES: PackageRow[] = [
  { id: "p1", name: "4 Clases Jumping", num_classes: "4", price: 380, category: "jumping", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p2", name: "8 Clases Jumping", num_classes: "8", price: 700, category: "jumping", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p3", name: "12 Clases Jumping", num_classes: "12", price: 980, category: "jumping", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p4", name: "Ilimitado Jumping", num_classes: "ILIMITADO", price: 1350, category: "jumping", validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p5", name: "4 Clases Pilates", num_classes: "4", price: 400, category: "pilates", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p6", name: "8 Clases Pilates", num_classes: "8", price: 740, category: "pilates", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p7", name: "12 Clases Pilates", num_classes: "12", price: 1050, category: "pilates", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p8", name: "Ilimitado Pilates", num_classes: "ILIMITADO", price: 1400, category: "pilates", validity_days: 30, is_active: true, sort_order: 4 },
  { id: "p9", name: "4 Clases Mixto", num_classes: "4", price: 420, category: "mixtos", validity_days: 30, is_active: true, sort_order: 1 },
  { id: "p10", name: "8 Clases Mixto", num_classes: "8", price: 780, category: "mixtos", validity_days: 30, is_active: true, sort_order: 2 },
  { id: "p11", name: "12 Clases Mixto", num_classes: "12", price: 1100, category: "mixtos", validity_days: 30, is_active: true, sort_order: 3 },
  { id: "p12", name: "Ilimitado Mixto", num_classes: "ILIMITADO", price: 1500, category: "mixtos", validity_days: 30, is_active: true, sort_order: 4 },
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

const LABEL_STYLE: Record<string, string> = {
  JUMPING:  "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30",
  PILATES:  "bg-pink-500/20 text-pink-300 border border-pink-500/30",
  SORPRESA: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
};

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
        <a href="#" className="font-syne font-extrabold text-xl tracking-tight text-foreground">
          Ophelia<span className="text-primary">.</span>
        </a>
        <ul className="hidden lg:flex gap-8 list-none">
          {[
            { label: "Clases",      id: "clases" },
            { label: "Horario",     id: "horario" },
            { label: "Paquetes",    id: "membresias" },
            { label: "Instructoras",id: "instructoras" },
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
        <button
          onClick={() => navigate("/auth/register")}
          className="bg-primary text-primary-foreground px-7 py-3 rounded-full text-[0.82rem] font-medium tracking-wider uppercase hover:scale-[1.04] hover:shadow-[0_0_30px_hsl(var(--pink-glow)/0.35)] transition-all"
        >
          Unirse ahora
        </button>
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
              <div className="text-[1.6rem] mb-[10px]">🔥</div>
              <div className="font-syne text-[0.95rem] font-bold mb-1">800 kcal</div>
              <div className="text-[0.78rem] text-muted-foreground leading-[1.5]">Quema promedio por sesión de 50 min</div>
            </div>
            <div className="bg-secondary border border-border rounded-[18px] p-[22px] hover:border-primary hover:-translate-y-[3px] transition-all">
              <div className="text-[1.6rem] mb-[10px]">⚡</div>
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
      <section id="beneficios" className="py-20 lg:py-[120px] px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 lg:grid-cols-2 items-end gap-[60px] mb-20">
          <div>
            <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
              <span className="w-[30px] h-[1px] bg-primary inline-block" />
              Por qué elegirnos
            </div>
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
              BENEFICIOS QUE<br />TRANSFORMAN
            </h2>
          </div>
          <p className="text-base leading-[1.8] text-muted-foreground pt-5">
            El jumping fitness en trampolín no es solo un entrenamiento — es una experiencia completa. Activa tu cuerpo, mejora tu postura, fortalece tu sistema linfático y libera endorfinas desde el primer salto.
          </p>
        </div>
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px] bg-border rounded-[28px] overflow-hidden">
          {[
            { num: "01", icon: "💪", title: "Tonificación total", text: "Trabaja piernas, glúteos, abdomen y brazos en una sola sesión de alta intensidad y bajo impacto articular." },
            { num: "02", icon: "🫀", title: "Cardio sin dolor", text: "El trampolín absorbe hasta el 80% del impacto. Tu corazón se fortalece mientras tus rodillas y cadera se protegen." },
            { num: "03", icon: "🧠", title: "Bienestar mental", text: "Cada sesión libera serotonina y dopamina. Reduce el estrés, mejora el sueño y eleva tu estado de ánimo naturalmente." },
            { num: "04", icon: "⚖️", title: "Control de peso", text: "Quema entre 600 y 1000 kcal por clase. Activa tu metabolismo hasta 24 horas después del entrenamiento." },
            { num: "05", icon: "🦋", title: "Sistema linfático", text: "Los rebotes activan el drenaje linfático de forma natural, reduciendo la retención de líquidos y la celulitis." },
            { num: "06", icon: "🏆", title: "Comunidad de élite", text: "Entrena rodeada de mujeres que se inspiran mutuamente. Nuestro ambiente motiva y celebra cada logro tuyo." },
          ].map((b) => (
            <div key={b.num} className="bg-background p-[44px_36px] relative overflow-hidden group hover:bg-secondary transition-colors">
              <div className="absolute -bottom-[60px] -right-[60px] w-[150px] h-[150px] bg-[radial-gradient(circle,hsl(var(--primary)/0.1)_0%,transparent_70%)] rounded-full transition-transform duration-400 group-hover:scale-[2]" />
              <div className="font-bebas text-[5rem] text-foreground/[0.06] leading-none -mb-[10px]">{b.num}</div>
              <div className="text-[2rem] mb-[18px]">{b.icon}</div>
              <div className="font-syne font-bold text-[1.15rem] mb-3 text-foreground">{b.title}</div>
              <div className="text-[0.88rem] text-muted-foreground leading-[1.7]">{b.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLASSES ── */}
      <section id="clases" className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Oferta
          </div>
          <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">NUESTRAS CLASES</h2>
        </div>
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-16">
          {classTypes.slice(0, 6).map((c, i) => {
            const imgs = [ophelia14, ophelia28, ophelia50, ophelia31, ophelia15, ophelia32];
            const gradients = [
              "from-[#1a0820] to-[#2d0a30]",
              "from-[#0d1a20] to-[#0a2030]",
              "from-[#1a1a0d] to-[#2a2010]",
              "from-[#1a0820] to-[#2d0a30]",
              "from-[#0d1a20] to-[#0a2030]",
              "from-[#1a1a0d] to-[#2a2010]",
            ];
            return (
              <div key={c.id} className="rounded-3xl overflow-hidden bg-secondary border border-border hover:-translate-y-2 hover:border-primary transition-all group">
                <div className="h-[220px] relative overflow-hidden">
                  <img src={imgs[i % imgs.length]} alt={c.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradients[i % gradients.length]} opacity-60`} />
                  <span className="absolute top-4 right-4 z-10 text-[0.65rem] tracking-widest uppercase px-3 py-[5px] rounded-full bg-primary/20 text-primary border border-primary/30">{c.level}</span>
                  <span className="relative z-10 flex items-center justify-center h-full text-[4rem] drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]">{c.emoji}</span>
                </div>
                <div className="p-7">
                  <h3 className="font-syne font-bold text-[1.1rem] mb-1">{c.name}</h3>
                  {c.subtitle && <p className="text-xs text-primary mb-2">{c.subtitle}</p>}
                  <p className="text-[0.84rem] text-muted-foreground leading-[1.6] mb-5">{c.description}</p>
                  <div className="flex gap-4">
                    {[["⏱", `${c.duration_min} min`], ["👥", `Max. ${c.capacity}`]].map(([icon, val]) => (
                      <span key={val} className="text-[0.75rem] text-muted-foreground flex items-center gap-[6px]">
                        {icon} <span className="text-foreground font-medium">{val}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── HORARIO ── */}
      <section id="horario" className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Disponibilidad
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
              HORARIO<br />SEMANAL
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Clases de lunes a sabado. Elige el horario que mejor se adapte a tu dia y reserva tu lugar desde la app.
            </p>
          </div>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 mb-8">
            {(["JUMPING", "PILATES", "SORPRESA"] as const).map((label) => (
              <span key={label} className={`text-[0.7rem] tracking-wider px-3 py-1 rounded-full font-medium ${LABEL_STYLE[label]}`}>{label}</span>
            ))}
          </div>
          {/* Tabla desktop */}
          {(() => {
            const times = [...new Set(schedule.map((s) => s.time_slot))].sort();
            return (
              <>
                <div className="hidden lg:block rounded-2xl overflow-hidden border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-background/60">
                        <th className="py-4 px-5 text-left text-[0.7rem] tracking-widest uppercase text-muted-foreground font-medium w-[90px]">Hora</th>
                        {DAYS.map((d) => (
                          <th key={d} className="py-4 px-3 text-[0.7rem] tracking-widest uppercase text-muted-foreground font-medium text-center">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {times.map((time) => (
                        <tr key={time} className="border-t border-border hover:bg-background/40 transition-colors">
                          <td className="py-4 px-5 text-foreground font-medium text-[0.82rem] whitespace-nowrap">{time}</td>
                          {[1, 2, 3, 4, 5, 6].map((day) => {
                            const cell = schedule.find((s) => s.time_slot === time && s.day_of_week === day);
                            return (
                              <td key={day} className="py-3 px-3 text-center">
                                {cell ? (
                                  <span className={`inline-block text-[0.68rem] tracking-wide px-2 py-[5px] rounded-lg font-medium ${LABEL_STYLE[cell.class_label] ?? "bg-secondary text-foreground"}`}>
                                    {cell.class_label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/20 text-[0.8rem]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Cards mobile */}
                <div className="lg:hidden flex flex-col gap-3">
                  {times.map((time) => (
                    <div key={time} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="text-foreground font-semibold text-sm mb-3">{time}</div>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5, 6].map((day) => {
                          const cell = schedule.find((s) => s.time_slot === time && s.day_of_week === day);
                          if (!cell) return null;
                          return (
                            <div key={day} className="flex flex-col items-center gap-1">
                              <span className="text-[0.6rem] text-muted-foreground">{DAYS[day - 1]}</span>
                              <span className={`text-[0.65rem] px-2 py-[3px] rounded-md font-medium ${LABEL_STYLE[cell.class_label] ?? ""}`}>{cell.class_label}</span>
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
      <section id="galeria" className="py-20 lg:py-[120px] px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Galería
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
              VIVE LA<br />EXPERIENCIA
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Cada sesión es única. Capturamos los mejores momentos de nuestras alumnas en el studio.
            </p>
          </div>
          {/* Masonry grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[200px]">
            {[
              { src: ophelia31, span: "md:col-span-2 md:row-span-2", h: "h-full" },
              { src: ophelia14, span: "", h: "h-full" },
              { src: ophelia50, span: "", h: "h-full" },
              { src: ophelia28, span: "md:row-span-2", h: "h-full" },
              { src: ophelia15, span: "", h: "h-full" },
              { src: ophelia38, span: "", h: "h-full" },
              { src: ophelia32, span: "md:col-span-2", h: "h-full" },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-2xl group cursor-pointer ${item.span}`}
              >
                <img
                  src={item.src}
                  alt={`Ophelia Studio ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  <span className="text-[0.7rem] tracking-widest uppercase text-primary bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
                    Ophelia Studio
                  </span>
                </div>
              </div>
            ))}
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
      <section id="instructoras" className="py-20 lg:py-[120px] px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            El equipo
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
              NUESTRAS<br />INSTRUCTORAS
            </h2>
            <p className="text-[0.88rem] text-muted-foreground max-w-[360px] leading-[1.7]">
              Certificadas, apasionadas y dedicadas a que cada clase sea tu mejor versión.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "Fernanda G.", role: "Fundadora · Jumping & Pilates", exp: "8 años de experiencia", certs: "FISAF · FitJump · Pilates Mat", img: ophelia38, color: "from-primary/20" },
              { name: "Valeria M.", role: "Instructora Senior · Power Jump", exp: "5 años de experiencia", certs: "FitJump · HIIT Certified", img: ophelia15, color: "from-[#CA71E1]/20" },
              { name: "Camila R.", role: "Instructora · Jumping Basics", exp: "3 años de experiencia", certs: "FitJump · Stretching Pro", img: ophelia32, color: "from-[#E7EB6E]/20" },
            ].map((inst, i) => (
              <div key={i} className="group rounded-3xl overflow-hidden bg-secondary border border-border hover:border-primary/50 hover:-translate-y-2 transition-all">
                <div className="h-[280px] relative overflow-hidden">
                  <img src={inst.img} alt={inst.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${inst.color} to-transparent`} />
                </div>
                <div className="p-7">
                  <h3 className="font-syne font-bold text-[1.1rem] text-foreground mb-1">{inst.name}</h3>
                  <p className="text-primary text-[0.78rem] tracking-wide font-medium mb-3">{inst.role}</p>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[0.78rem] flex items-center gap-2">
                      <span className="text-[0.9rem]">🏅</span>{inst.exp}
                    </span>
                    <span className="text-muted-foreground text-[0.78rem] flex items-center gap-2">
                      <span className="text-[0.9rem]">📋</span>{inst.certs}
                    </span>
                  </div>
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

      {/* ── CTA ── */}
      <section id="contacto" className="py-20 lg:py-[120px] px-6 lg:px-[60px] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12)_0%,transparent_60%)] pointer-events-none" />
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 relative z-10">
          <div className="text-primary text-[0.8rem] tracking-[0.15em] uppercase mb-6">¿Lista para transformarte?</div>
          <h2 className="font-bebas text-[clamp(4rem,8vw,8rem)] leading-[0.9] text-foreground mb-8">
            TU PRIMER<br />
            <span className="[-webkit-text-stroke:2px_hsl(var(--foreground)/0.4)] text-transparent">SALTO</span><br />
            TE ESPERA
          </h2>
          <p className="text-[1.1rem] text-muted-foreground max-w-[500px] mx-auto mb-12 leading-[1.7]">
            Únete a más de 500 mujeres que ya eligieron sentir el vuelo. Tu primera clase es gratis.
          </p>
          <div className="flex gap-4 justify-center items-center flex-wrap mb-16">
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
              <span className="text-[1.1rem]">📱</span>
              WhatsApp
            </a>
          </div>
          {/* Datos de contacto */}
          <div className="flex flex-wrap justify-center gap-8 border-t border-border pt-12">
            {[
              { icon: "📍", label: "Ubicación", value: "San Juan del Río, Querétaro" },
              { icon: "📞", label: "Teléfono", value: "+52 442 123 4567" },
              { icon: "✉️", label: "Email", value: "info@opheliajumping.mx" },
              { icon: "🕐", label: "Horarios", value: "Lun–Vie 6am–9pm · Sáb 7am–2pm" },
            ].map((c) => (
              <div key={c.label} className="text-center">
                <div className="text-[1.6rem] mb-2">{c.icon}</div>
                <div className="text-[0.65rem] tracking-widest uppercase text-muted-foreground mb-1">{c.label}</div>
                <div className="text-[0.85rem] text-foreground">{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-secondary px-6 lg:px-[60px] pt-[60px] border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10">
          <div>
            <h3 className="font-syne font-extrabold text-[1.4rem] mb-3 text-foreground">
              Ophelia<span className="text-primary">.</span>
            </h3>
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
              {[["Clases", "clases"], ["Horario", "horario"], ["Paquetes", "membresias"], ["Instructoras", "instructoras"]].map(([label, id]) => (
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
              {["Aviso de privacidad", "Términos y condiciones", "Política de cancelación"].map((l) => (
                <li key={l}><a href="#" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">{l}</a></li>
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
