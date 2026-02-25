import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PackageRow = Tables<"packages">;

const CATEGORIES = [
  { key: "jumping", label: "🏃‍♀️ Paquetes Jumping" },
  { key: "pilates", label: "🧘‍♀️ Paquetes Pilates" },
  { key: "mixtos", label: "🔀 Paquetes Mixtos" },
];

const AdminPackages = () => {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [numClasses, setNumClasses] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("jumping");
  const [editId, setEditId] = useState<string | null>(null);

  const fetchPackages = async () => {
    const { data } = await supabase.from("packages").select("*").order("category").order("sort_order");
    if (data) setPackages(data);
  };

  useEffect(() => { fetchPackages(); }, []);

  const handleSave = async () => {
    if (!numClasses.trim() || !price.trim()) return;
    if (editId) {
      await supabase.from("packages").update({ num_classes: numClasses, price: Number(price), category }).eq("id", editId);
    } else {
      const catPkgs = packages.filter(p => p.category === category);
      await supabase.from("packages").insert({ num_classes: numClasses, price: Number(price), category, sort_order: catPkgs.length + 1 });
    }
    setNumClasses(""); setPrice(""); setCategory("jumping"); setEditId(null);
    fetchPackages();
  };

  const handleEdit = (p: PackageRow) => {
    setEditId(p.id); setNumClasses(p.num_classes); setPrice(String(p.price)); setCategory(p.category);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("packages").delete().eq("id", id);
    fetchPackages();
  };

  return (
    <div>
      <h2 className="font-syne font-bold text-xl mb-6">Paquetes de clases</h2>

      <div className="bg-secondary border border-border rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-medium mb-4">{editId ? "Editar paquete" : "Agregar paquete"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={numClasses} onChange={(e) => setNumClasses(e.target.value)} placeholder='Ej: 4, 8, ILIMITADO' className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio (MXN)" type="number" className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="jumping">Jumping</option>
            <option value="pilates">Pilates</option>
            <option value="mixtos">Mixtos</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleSave} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
            {editId ? "Actualizar" : "Agregar"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setNumClasses(""); setPrice(""); }} className="text-sm text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          )}
        </div>
      </div>

      {CATEGORIES.map(({ key, label }) => {
        const catPkgs = packages.filter(p => p.category === key);
        if (catPkgs.length === 0) return null;
        return (
          <div key={key} className="mb-8">
            <h3 className="font-syne font-bold text-base mb-3">{label}</h3>
            <div className="bg-secondary border border-border rounded-2xl overflow-hidden">
              {catPkgs.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-4 border-b border-border/50 last:border-b-0">
                  <div className="flex items-center gap-6">
                    <span className="font-medium text-sm w-24">{p.num_classes} CLASES</span>
                    <span className="font-bebas text-2xl text-primary">${p.price.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(p)} className="text-xs text-primary hover:text-primary/80">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-destructive hover:text-destructive/80">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Vigencia: 30 días. Aplican términos y condiciones.</p>
          </div>
        );
      })}
    </div>
  );
};

export default AdminPackages;
