import { Pool } from "pg";
import { addDays, startOfWeek, setHours, setMinutes, format } from "date-fns";

const pool = new Pool({
    connectionString: "postgresql://postgres:InhSTEYtQcRuJcCqOCKSMJiPuLBxtqEY@turntable.proxy.rlwy.net:16605/railway",
});

async function run() {
    try {
        console.log("Conectando a la base de datos...");

        // Inactivate all class types again to start fresh
        await pool.query("UPDATE class_types SET is_active = false");

        const clases = [
            {
                name: "Pilates Matt Clásico",
                description: "Fortalece la musculatura que le da sostén a tu cuerpo respetando las bases del método clásico. Es una clase que te exige presencia, control, fluidez y una respiración consiente. ¡Utiliza el movimiento como forma de autoconocimiento!",
                category: "pilates", color: "#b5bf9c", emoji: "waves", duration_min: 50, sort_order: 1
            },
            {
                name: "Pilates Terapéutico",
                description: "Una clase con efectos terapéuticos en el cuerpo como la disminución de dolor, mejora en movilidad y fortalecimiento general. Ideal para quienes buscan ejercitarse por alguna condición médica, lesión o bien están buscando regresar a ejercitarse después de un proceso de sedentarismo o lesión. ¡Recupera la confianza en tu movimiento!",
                category: "pilates", color: "#ebede5", emoji: "heart", duration_min: 55, sort_order: 2
            },
            {
                name: "Flex & Flow",
                description: "Una clase que te invita a conectar mente y cuerpo por medio de movimientos naturales, fluidos y conscientes ayudando a sentirte más libre, ágil, flexible y sin limitación. Un entrenamiento que te ayudará a maximizar tus capacidades físicas. ¡Recupera el placer de un movimiento libre!",
                category: "mixto", color: "#b5bf9c", emoji: "activity", duration_min: 55, sort_order: 3
            },
            {
                name: "Body Strong",
                description: "Una clase de intensidad moderada, dinámica y retadora, que busca logra un funcionamiento integral y funcional del cuerpo sin dejar ejecución y cuidado de los movimientos. ¡Conoce y desafía tus propios límites!",
                category: "funcional", color: "#94867a", emoji: "flame", duration_min: 50, sort_order: 4
            }
        ];

        const insertedTypes = [];
        for (const c of clases) {
            const res = await pool.query(
                `INSERT INTO class_types (name, description, category, color, emoji, duration_min, is_active, sort_order, capacity)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, 10) RETURNING id`,
                [c.name, c.description, c.category, c.color, c.emoji, c.duration_min, c.sort_order]
            );
            insertedTypes.push({ ...c, id: res.rows[0].id });
        }
        console.log("Nuevas clases re-insertadas.");

        // Delete future
        await pool.query("DELETE FROM classes WHERE date >= CURRENT_DATE");

        // Get instructor from INSTRUCTORS table
        let instructorId = null;
        const instRes = await pool.query("SELECT id FROM instructors LIMIT 1");
        if (instRes.rows.length > 0) {
            instructorId = instRes.rows[0].id;
        } else {
            throw new Error("No hay instructores en la base de datos para asignar a la clase.");
        }

        const today = new Date();
        // Monday
        let nextMonday = startOfWeek(today, { weekStartsOn: 1 });
        if (today > nextMonday) nextMonday = addDays(nextMonday, 7);

        const scheduleTemplate = [
            { class: "Body Strong", h: 7, m: 15 },
            { class: "Pilates Matt Clásico", h: 8, m: 20 },
            { class: "Body Strong", h: 18, m: 15 }
        ];

        let classesToInsert = [];
        for (let week = 0; week < 4; week++) {
            const monday = addDays(nextMonday, week * 7);

            for (const t of scheduleTemplate) {
                const typeMatch = insertedTypes.find(ct => ct.name === t.class);
                if (!typeMatch) continue;

                const classDate = format(monday, "yyyy-MM-dd");
                const startTime = `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}:00`;
                const endD = new Date(monday);
                endD.setHours(t.h, t.m + 50, 0, 0);
                const endTimeStr = format(endD, "HH:mm:ss");

                classesToInsert.push([
                    typeMatch.id, instructorId, classDate, startTime, endTimeStr, 15, 'scheduled'
                ]);
            }
        }

        for (const c of classesToInsert) {
            await pool.query(
                `INSERT INTO classes (class_type_id, instructor_id, date, start_time, end_time, max_capacity, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                c
            );
        }
        console.log(`Insertadas ${classesToInsert.length} clases en el horario.`);

    } catch (err) {
        console.error("Error en el script:", err);
    } finally {
        await pool.end();
    }
}

run();
