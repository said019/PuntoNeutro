import { useEffect, useRef, useState } from "react";
import ophelia14 from "@/assets/ophelia-14.jpg";
import ophelia15 from "@/assets/ophelia-15.jpg";
import ophelia28 from "@/assets/ophelia-28.jpg";
import ophelia31 from "@/assets/ophelia-31.jpg";
import ophelia32 from "@/assets/ophelia-32.jpg";
import ophelia38 from "@/assets/ophelia-38.jpg";
import ophelia50 from "@/assets/ophelia-50.jpg";

const Index = () => {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
        <ul className="hidden lg:flex gap-10 list-none">
          {["Clases", "Beneficios", "Membresías", "Contacto"].map((item) => (
            <li key={item}>
              <button
                onClick={() =>
                  scrollTo(item.toLowerCase().replace("í", "i"))
                }
                className="text-muted-foreground text-[0.85rem] font-normal tracking-widest uppercase hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => scrollTo("contacto")}
          className="bg-primary text-primary-foreground px-7 py-3 rounded-full text-[0.82rem] font-medium tracking-wider uppercase hover:scale-[1.04] hover:shadow-[0_0_30px_hsl(var(--pink-glow)/0.35)] transition-all"
        >
          Unirse ahora
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2 items-center px-6 lg:px-[60px] pt-[140px] pb-20 relative overflow-hidden gap-10 lg:gap-[60px]">
        {/* BG circles */}
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
              onClick={() => scrollTo("contacto")}
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

        {/* Hero right */}
        <div className="relative hidden lg:flex flex-col gap-5 animate-fade-up delay-500">
          <div className="bg-secondary border border-border rounded-[28px] overflow-hidden relative h-[420px]">
            <img
              src={ophelia31}
              alt="Alumnas saltando en trampolines en Ophelia Jumping Studio"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-[-18px] right-[30px] bg-primary rounded-[18px] px-[22px] py-4 flex items-center gap-3 shadow-[0_20px_60px_hsl(var(--primary)/0.4)]">
              <span className="font-bebas text-[2.2rem] leading-none text-primary-foreground">+500</span>
              <span className="text-[0.72rem] text-primary-foreground/80 uppercase tracking-wider leading-tight">
                Alumnas<br />activas
              </span>
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
          <div
            key={i}
            className="py-10 px-5 border-r border-border last:border-r-0 hover:bg-primary/5 transition-colors"
          >
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
            <div
              key={b.num}
              className="bg-background p-[44px_36px] relative overflow-hidden group hover:bg-secondary transition-colors"
            >
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
          {[
            {
              img: ophelia14,
              emoji: "🚀",
              level: "Principiante",
              title: "Jumping Basics",
              desc: "La clase perfecta para comenzar. Aprende los fundamentos del jumping fitness con música motivadora y movimientos accesibles.",
              dur: "50 min",
              cap: "Max. 15",
              days: "L-V",
              gradient: "from-[#1a0820] to-[#2d0a30]",
            },
            {
              img: ophelia28,
              emoji: "⚡",
              level: "Intermedio",
              title: "Power Jump",
              desc: "Lleva tu entrenamiento al siguiente nivel con coreografías dinámicas, intervalos HIIT y música que no para.",
              dur: "55 min",
              cap: "Max. 12",
              days: "L-S",
              gradient: "from-[#0d1a20] to-[#0a2030]",
            },
            {
              img: ophelia50,
              emoji: "🌸",
              level: "Todos los niveles",
              title: "Jump & Stretch",
              desc: "Combina el jumping con yoga y stretching profundo. Ideal para relajar, ganar flexibilidad y recuperarte activamente.",
              dur: "60 min",
              cap: "Max. 10",
              days: "Sáb",
              gradient: "from-[#1a1a0d] to-[#2a2010]",
            },
          ].map((c, i) => (
            <div
              key={i}
              className="rounded-3xl overflow-hidden bg-secondary border border-border hover:-translate-y-2 hover:border-primary transition-all group"
            >
              <div className="h-[220px] relative overflow-hidden">
                <img
                  src={c.img}
                  alt={c.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-60`} />
                <span className="absolute top-4 right-4 z-10 text-[0.65rem] tracking-widest uppercase px-3 py-[5px] rounded-full bg-primary/20 text-primary border border-primary/30">
                  {c.level}
                </span>
                <span className="relative z-10 flex items-center justify-center h-full text-[4rem] drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]">
                  {c.emoji}
                </span>
              </div>
              <div className="p-7">
                <h3 className="font-syne font-bold text-[1.1rem] mb-2">{c.title}</h3>
                <p className="text-[0.84rem] text-muted-foreground leading-[1.6] mb-5">{c.desc}</p>
                <div className="flex gap-4">
                  {[
                    ["⏱", c.dur],
                    ["👥", c.cap],
                    ["📅", c.days],
                  ].map(([icon, val]) => (
                    <span key={val} className="text-[0.75rem] text-muted-foreground flex items-center gap-[6px]">
                      {icon} <span className="text-foreground font-medium">{val}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MEMBERSHIPS ── */}
      <section id="membresias" className="py-20 lg:py-[120px] px-6 lg:px-[60px]">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Planes
          </div>
          <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
            ENCUENTRA TU<br />MEMBRESÍA
          </h2>
        </div>
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-16">
          {[
            {
              name: "Starter",
              price: "$599",
              period: "/ al mes · 8 clases",
              featured: false,
              features: [
                { text: "8 clases al mes", active: true },
                { text: "Acceso a Jumping Basics", active: true },
                { text: "App de reservas", active: true },
                { text: "Power Jump", active: false },
                { text: "Evaluación mensual", active: false },
                { text: "Asesoría nutricional", active: false },
              ],
            },
            {
              name: "Pro",
              price: "$899",
              period: "/ al mes · Clases ilimitadas",
              featured: true,
              features: [
                { text: "Clases ilimitadas", active: true },
                { text: "Todas las clases incluidas", active: true },
                { text: "App con tracking", active: true },
                { text: "Evaluación mensual", active: true },
                { text: "1 sesión de asesoría", active: true },
                { text: "Nutrición personalizada", active: false },
              ],
            },
            {
              name: "Elite",
              price: "$1,299",
              period: "/ al mes · Todo incluido",
              featured: false,
              features: [
                { text: "Clases ilimitadas", active: true },
                { text: "Todas las clases", active: true },
                { text: "App con tracking avanzado", active: true },
                { text: "Evaluación semanal", active: true },
                { text: "Asesoría nutricional completa", active: true },
                { text: "Acceso prioritario", active: true },
              ],
            },
          ].map((plan, i) => (
            <div
              key={i}
              className={`rounded-3xl p-10 border relative overflow-hidden hover:-translate-y-[6px] transition-all ${
                plan.featured
                  ? "bg-primary border-primary"
                  : "bg-secondary border-border"
              }`}
            >
              {plan.featured && (
                <span className="absolute top-5 right-5 bg-primary-foreground/20 text-primary-foreground text-[0.65rem] tracking-widest uppercase px-3 py-[5px] rounded-full">
                  ⭐ Popular
                </span>
              )}
              <div className={`text-[0.8rem] tracking-[0.12em] uppercase mb-6 ${plan.featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {plan.name}
              </div>
              <div className={`font-bebas text-[4.5rem] leading-none mb-1 ${plan.featured ? "text-primary-foreground" : "text-foreground"}`}>
                {plan.price}
              </div>
              <div className={`text-[0.8rem] mb-8 ${plan.featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {plan.period}
              </div>
              <div className={`h-[1px] mb-7 ${plan.featured ? "bg-primary-foreground/10" : "bg-foreground/10"}`} />
              <ul className="flex flex-col gap-[14px] mb-9 list-none">
                {plan.features.map((f, j) => (
                  <li
                    key={j}
                    className={`text-[0.87rem] flex items-center gap-[10px] ${
                      f.active
                        ? plan.featured
                          ? "text-primary-foreground"
                          : "text-foreground"
                        : plan.featured
                        ? "text-primary-foreground/40"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    <span
                      className={`w-[18px] h-[18px] rounded-full flex-shrink-0 flex items-center justify-center text-[0.6rem] ${
                        f.active
                          ? plan.featured
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/20 text-primary"
                          : "bg-foreground/5 text-muted-foreground/30"
                      }`}
                    >
                      {f.active ? "✓" : "—"}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <button
                className={`block w-full text-center py-4 rounded-full text-[0.85rem] font-medium tracking-wider uppercase transition-all ${
                  plan.featured
                    ? "bg-primary-foreground text-primary hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                    : "border border-border text-foreground bg-transparent hover:bg-primary hover:border-primary hover:text-primary-foreground"
                }`}
              >
                Elegir plan
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 lg:py-[120px] px-6 lg:px-[60px] bg-secondary overflow-hidden">
        <div className="reveal opacity-0 translate-y-10 transition-all duration-700 mb-16">
          <div className="text-[0.72rem] tracking-[0.15em] uppercase text-primary font-medium mb-4 flex items-center gap-[10px]">
            <span className="w-[30px] h-[1px] bg-primary inline-block" />
            Testimonios
          </div>
          <h2 className="font-bebas text-[clamp(3rem,5vw,5rem)] leading-[0.95] text-foreground">
            LO QUE DICEN<br />NUESTRAS ALUMNAS
          </h2>
        </div>
        <div className="animate-scroll-left flex gap-6 w-max">
          {[...testimonials, ...testimonials].map((t, i) => (
            <div
              key={i}
              className="bg-secondary border border-border rounded-3xl p-9 w-[380px] flex-shrink-0"
            >
              <div className="text-primary text-[0.9rem] mb-5 tracking-[4px]">★★★★★</div>
              <p className="text-[0.92rem] leading-[1.7] text-muted-foreground mb-7 italic">"{t.text}"</p>
              <div className="flex items-center gap-[14px]">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-[#8B1F8B] flex items-center justify-center font-syne font-bold text-primary-foreground flex-shrink-0">
                  {t.initial}
                </div>
                <div>
                  <div className="font-syne text-[0.9rem] font-bold text-foreground">{t.name}</div>
                  <div className="text-[0.75rem] text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
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
            Únete a más de 500 mujeres que ya eligieron sentir el vuelo. Prueba tu primera clase sin costo.
          </p>
          <div className="flex gap-4 justify-center items-center flex-wrap">
            <a
              href="https://wa.me/524271234567"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground px-10 py-[18px] rounded-full text-[0.9rem] font-medium tracking-wider uppercase inline-flex items-center gap-[10px] hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_20px_50px_hsl(var(--primary)/0.4)] transition-all no-underline"
            >
              Clase gratis via WhatsApp
              <span className="w-[22px] h-[22px] bg-primary-foreground/20 rounded-full flex items-center justify-center text-[0.7rem]">↗</span>
            </a>
            <a
              href="tel:+524271234567"
              className="text-foreground text-[0.85rem] font-normal tracking-wider uppercase flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity no-underline"
            >
              <span className="w-[42px] h-[42px] border border-foreground/20 rounded-full flex items-center justify-center text-[0.8rem]">📞</span>
              Llamar ahora
            </a>
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
              {["ig", "fb", "tt"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground text-[0.85rem] hover:border-primary hover:text-primary transition-colors no-underline"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Estudio</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {["Clases", "Beneficios", "Membresías", "Instructoras"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Legal</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {["Aviso de privacidad", "Términos y condiciones", "Política de cancelación"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[0.72rem] tracking-widest uppercase text-muted-foreground mb-5">Contacto</div>
            <ul className="flex flex-col gap-[10px] list-none">
              {["San Juan del Río, Qro.", "info@opheliajumping.mx", "WhatsApp", "Horarios"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-[0.85rem] text-muted-foreground hover:text-foreground transition-colors no-underline">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[0.75rem] text-muted-foreground/50">© 2025 Ophelia Jumping Studio. Todos los derechos reservados.</p>
          <p className="text-[0.75rem] text-muted-foreground/50">Hecho con ♥ en San Juan del Río</p>
        </div>
      </footer>
    </div>
  );
};

const testimonials = [
  { initial: "S", name: "Sofía Martínez", role: "Miembro Pro · 8 meses", text: "Llevo 8 meses en Ophelia y perdí 12 kg. Pero lo más increíble es que me enamoré del ejercicio por primera vez en mi vida. No puedo faltar ni una semana." },
  { initial: "A", name: "Andrea López", role: "Miembro Elite · 1 año", text: "Tenía una lesión de rodilla y mi médico me recomendó algo de bajo impacto. Ophelia fue la mejor decisión. Ahora salto fuerte y mis rodillas están perfectas." },
  { initial: "V", name: "Valeria Ramos", role: "Miembro Pro · 6 meses", text: "Las instructoras son increíbles, siempre motivando y corrigiendo con mucho cariño. La comunidad de chicas es lo mejor. Me siento en mi segundo hogar." },
  { initial: "M", name: "Mariana Torres", role: "Miembro Starter · 3 meses", text: "Nunca pensé que el ejercicio podría ser tan divertido. Las clases vuelan, la música es increíble y siempre salgo sudada pero con una sonrisa enorme." },
  { initial: "C", name: "Carmen Vega", role: "Miembro Elite · 2 años", text: "Empecé a los 45 años pensando que era demasiado tarde. Ophelia me demostró que no hay edad para empezar. Mi salud y mi energía mejoraron 100%." },
];

export default Index;
