import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format,
  isBefore, isAfter,
} from "date-fns";
import { es } from "date-fns/locale";
import api from "@/lib/api";
import { safeParse } from "@/lib/utils";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BookingClient } from "@/types/booking";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const BookClasses = () => {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const navigate = useNavigate();

  const { data: classesData, isLoading: loadingClasses } = useQuery({
    queryKey: ["public-classes", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () =>
      (await api.get(`/classes?start=${format(weekStart, "yyyy-MM-dd")}&end=${format(weekEnd, "yyyy-MM-dd")}`)).data,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => (await api.get("/bookings/my-bookings")).data,
  });

  const classes: any[] = Array.isArray(classesData?.data) ? classesData.data : Array.isArray(classesData) ? classesData : [];
  const myBookings: BookingClient[] = Array.isArray(bookingsData?.data) ? bookingsData.data : Array.isArray(bookingsData) ? bookingsData : [];
  const myBookedClassIds = new Set(myBookings.map((b) => b.class_id));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const classesForDay = (day: Date) =>
    classes
      .filter((c) => {
        if (!c.start_time) return false;
        const dt = safeParse(c.start_time);
        return format(dt, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
      })
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const now = new Date();

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Reservar clase</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium min-w-[130px] text-center">
                {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1 min-w-[600px]">
              {days.map((day, i) => (
                <div key={i} className="text-center">
                  <div className="text-xs font-medium text-muted-foreground py-1">{DAYS[i]}</div>
                  <div className="text-sm font-bold pb-2">{format(day, "d")}</div>
                  {loadingClasses ? (
                    <Skeleton className="h-16 w-full rounded-lg" />
                  ) : (
                    <div className="space-y-1">
                      {classesForDay(day).map((cls) => {
                        const isPast = cls.start_time ? isBefore(safeParse(cls.start_time), now) : true;
                        const isBooked = myBookedClassIds.has(cls.id);
                        return (
                          <button
                            key={cls.id}
                            disabled={isPast}
                            onClick={() => navigate(`/app/classes/${cls.id}`)}
                            className={`w-full text-left rounded-lg border p-1.5 text-xs transition-colors ${
                              isPast
                                ? "opacity-40 cursor-not-allowed bg-muted"
                                : "hover:border-primary hover:bg-primary/5 cursor-pointer"
                            }`}
                          >
                            <p className="font-medium truncate">{cls.class_type_name}</p>
                            <p className="text-muted-foreground">{cls.start_time ? format(safeParse(cls.start_time), "HH:mm") : "—"}</p>
                            {isBooked && (
                              <Badge variant="default" className="text-[10px] px-1 py-0 mt-0.5">✓</Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default BookClasses;
