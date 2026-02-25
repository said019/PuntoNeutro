import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ClassRow = Tables<"classes">;

const AdminClasses = () => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("jumping");
  const [editId, setEditId] = useState<string | null>(null);

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*").order("sort_order");
    if (data) setClasses(data);
  };

  useEffect(() => { fetchClasses(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editId) {
      await supabase.from("classes").update({ name, subtitle, category }).eq("id", editId);
    } else {
      await supabase.from("classes").insert({ name, subtitle, category, sort_order: classes.length + 1 });
    }
    setName(""); setSubtitle(""); setCategory("jumping"); setEditId(null);
    fetchClasses();
  };

  const handleEdit = (c: ClassRow) => {
    setEditId(c.id); setName(c.name); setSubtitle(c.subtitle || ""); setCategory(c.category);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("classes").delete().eq("id", id);
    fetchClasses();
  };

  const toggleActive = async (c: ClassRow) => {
    await supabase.from("classes").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchClasses();
  };

  return (
    <div>
      <h2 className="font-syne font-bold text-xl mb-6">Clases disponibles</h2>
      
      <div className="bg-secondary border border-border rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-medium mb-4">{editId ? "Editar clase" : "Agregar clase"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtítulo" className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="jumping">Jumping</option>
            <option value="pilates">Pilates</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleSave} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
            {editId ? "Actualizar" : "Agregar"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setName(""); setSubtitle(""); }} className="text-sm text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {classes.map((c) => (
          <div key={c.id} className={`bg-secondary border border-border rounded-xl px-5 py-4 flex items-center justify-between ${!c.is_active ? "opacity-50" : ""}`}>
            <div>
              <span className="font-medium text-sm">{c.name}</span>
              {c.subtitle && <span className="text-muted-foreground text-xs ml-2">— {c.subtitle}</span>}
              <span className={`ml-3 text-[0.65rem] px-2 py-0.5 rounded-full uppercase tracking-wider ${c.category === "jumping" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent-foreground"}`}>
                {c.category}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleActive(c)} className="text-xs text-muted-foreground hover:text-foreground">{c.is_active ? "Desactivar" : "Activar"}</button>
              <button onClick={() => handleEdit(c)} className="text-xs text-primary hover:text-primary/80">Editar</button>
              <button onClick={() => handleDelete(c.id)} className="text-xs text-destructive hover:text-destructive/80">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminClasses;
