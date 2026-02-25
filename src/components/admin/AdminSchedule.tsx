import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ScheduleRow = Tables<"schedule">;

const DAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const DAY_MAP: Record<number, string> = { 1: "LUN", 2: "MAR", 3: "MIÉ", 4: "JUE", 5: "VIE", 6: "SÁB" };

const AdminSchedule = () => {
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [timeSlot, setTimeSlot] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [classType, setClassType] = useState("JUMPING");
  const [shift, setShift] = useState("morning");
  const [editId, setEditId] = useState<string | null>(null);

  const fetchSchedule = async () => {
    const { data } = await supabase.from("schedule").select("*").order("time_slot").order("day_of_week");
    if (data) setSchedule(data);
  };

  useEffect(() => { fetchSchedule(); }, []);

  const handleSave = async () => {
    if (!timeSlot.trim()) return;
    if (editId) {
      await supabase.from("schedule").update({ time_slot: timeSlot, day_of_week: dayOfWeek, class_type: classType, shift }).eq("id", editId);
    } else {
      await supabase.from("schedule").insert({ time_slot: timeSlot, day_of_week: dayOfWeek, class_type: classType, shift });
    }
    setTimeSlot(""); setDayOfWeek(1); setClassType("JUMPING"); setShift("morning"); setEditId(null);
    fetchSchedule();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("schedule").delete().eq("id", id);
    fetchSchedule();
  };

  // Group by shift and time_slot
  const morningSlots = schedule.filter(s => s.shift === "morning");
  const eveningSlots = schedule.filter(s => s.shift === "evening");

  const timeSlots = (slots: ScheduleRow[]) => {
    const times = [...new Set(slots.map(s => s.time_slot))].sort();
    return times;
  };

  const getCell = (slots: ScheduleRow[], time: string, day: number) => {
    return slots.find(s => s.time_slot === time && s.day_of_week === day);
  };

  const renderTable = (title: string, slots: ScheduleRow[]) => (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground text-xs">HORA</th>
              {DAYS.map(d => <th key={d} className="text-center py-2 px-3 text-muted-foreground text-xs">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {timeSlots(slots).map(time => (
              <tr key={time} className="border-b border-border/50">
                <td className="py-3 px-3 font-medium text-foreground">{time}</td>
                {[1,2,3,4,5,6].map(day => {
                  const cell = getCell(slots, time, day);
                  return (
                    <td key={day} className="text-center py-3 px-3">
                      {cell ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${cell.class_type === "JUMPING" ? "bg-primary/20 text-primary" : cell.class_type === "SORPRESA" ? "bg-accent/20 text-accent-foreground" : "bg-foreground/10 text-foreground"}`}>
                          {cell.class_type}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="font-syne font-bold text-xl mb-6">Horarios semanales</h2>
      <p className="text-xs text-muted-foreground mb-6">Nota: cada semana cambian los tipos de clases, no los horarios.</p>

      <div className="bg-secondary border border-border rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-medium mb-4">{editId ? "Editar horario" : "Agregar horario"}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} placeholder="Ej: 7:00am" className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
            {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
          <select value={classType} onChange={(e) => setClassType(e.target.value)} className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="JUMPING">JUMPING</option>
            <option value="PILATES">PILATES</option>
            <option value="SORPRESA">SORPRESA</option>
          </select>
          <select value={shift} onChange={(e) => setShift(e.target.value)} className="bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="morning">Mañana</option>
            <option value="evening">Tarde</option>
          </select>
        </div>
        <button onClick={handleSave} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity mt-4">
          {editId ? "Actualizar" : "Agregar"}
        </button>
      </div>

      <div className="bg-secondary border border-border rounded-2xl p-6">
        {renderTable("🌅 Turno Mañana", morningSlots)}
        {renderTable("🌙 Turno Tarde", eveningSlots)}
      </div>
    </div>
  );
};

export default AdminSchedule;
