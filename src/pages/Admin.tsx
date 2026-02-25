import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminClasses from "@/components/admin/AdminClasses";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminPackages from "@/components/admin/AdminPackages";
import AdminStudents from "@/components/admin/AdminStudents";

type Tab = "clases" | "horarios" | "paquetes" | "alumnas";

const Admin = () => {
  const [tab, setTab] = useState<Tab>("clases");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Cargando...</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "clases", label: "Clases" },
    { key: "horarios", label: "Horarios" },
    { key: "paquetes", label: "Paquetes" },
    { key: "alumnas", label: "Alumnas" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-secondary border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-syne font-extrabold text-lg">
            Ophelia<span className="text-primary">.</span>
            <span className="text-muted-foreground text-xs font-normal ml-2">Admin</span>
          </h1>
          <nav className="hidden sm:flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Ver sitio
          </button>
          <button onClick={handleLogout} className="text-xs text-destructive hover:text-destructive/80 transition-colors">
            Salir
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="sm:hidden flex border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-3 text-xs whitespace-nowrap ${
              tab === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="p-6 max-w-6xl mx-auto">
        {tab === "clases" && <AdminClasses />}
        {tab === "horarios" && <AdminSchedule />}
        {tab === "paquetes" && <AdminPackages />}
        {tab === "alumnas" && <AdminStudents />}
      </main>
    </div>
  );
};

export default Admin;
