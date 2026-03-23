-- ============================================================
-- PUNTO NEUTRO — SEED COMPLETO
-- Fecha: 2026-03-17
-- ============================================================

BEGIN;

-- ============================================================
-- 1. LIMPIAR DATOS VIEJOS
-- ============================================================
DELETE FROM classes;
DELETE FROM schedules;
DELETE FROM class_types;
UPDATE plans SET is_active = false;
DELETE FROM plans;

-- ============================================================
-- 2. SYSTEM SETTINGS — Punto Neutro
-- ============================================================
UPDATE system_settings SET value = '{
  "name": "Punto Neutro",
  "address": "",
  "phone": "",
  "email": "",
  "social_media": {}
}'::jsonb WHERE key = 'studio_info';

UPDATE system_settings SET value = '{
  "bank": "BBVA",
  "bank_name": "BBVA",
  "account_holder": "Angelina Salas Huante",
  "card_number": "4152 3139 4571 6699",
  "account_number": "151 128 2689",
  "clabe": "012 680 01511282689 2",
  "reference_instructions": "Incluye tu nombre en el concepto"
}'::jsonb WHERE key = 'bank_info';

UPDATE system_settings SET value = '{
  "cancellation_hours": 2,
  "no_show_penalty": true,
  "max_advance_days": 14,
  "tolerance_minutes": 10
}'::jsonb WHERE key = 'booking_policies';

-- ============================================================
-- 3. CLASS TYPES — Las 4 clases de Punto Neutro
-- ============================================================
INSERT INTO class_types (id, name, description, level, duration_minutes, max_capacity, icon, color, is_active)
VALUES
  ('a1000001-0001-4000-8000-000000000001',
   'Pilates Matt Clásico',
   'Fortalece la musculatura que le da sostén a tu cuerpo respetando las bases del método clásico. Es una clase que te exige presencia, control, fluidez y una respiración consiente. ¡Utiliza el movimiento como forma de autoconocimiento!',
   'all', 55, 10, 'waves', '#b5bf9c', true),

  ('a1000001-0001-4000-8000-000000000002',
   'Pilates Terapéutico',
   'Una clase con efectos terapéuticos en el cuerpo como la disminución de dolor, mejora en movilidad y fortalecimiento general. Ideal para quienes buscan ejercitarse por alguna condición médica, lesión o bien están buscando regresar a ejercitarse después de un proceso de sedentarismo o lesión. ¡Recupera la confianza en tu movimiento!',
   'all', 55, 10, 'heart', '#ebede5', true),

  ('a1000001-0001-4000-8000-000000000003',
   'Flex & Flow',
   'Una clase que te invita a conectar mente y cuerpo por medio de movimientos naturales, fluidos y consientes ayudando a sentirte más libre, ágil, flexible y sin limitación. Un entrenamiento que te ayudará a maximizar tus capacidades físicas. ¡Recupera el placer de un movimiento libre!',
   'all', 55, 10, 'activity', '#b5bf9c', true),

  ('a1000001-0001-4000-8000-000000000004',
   'Body Strong',
   'Una clase de intensidad moderada, dinámica y retadora, que busca lograr un funcionamiento integral y funcional del cuerpo sin dejar ejecución y cuidado de los movimientos. ¡Conoce y desafía tus propios límites!',
   'intermediate', 50, 10, 'flame', '#94867a', true);

-- ============================================================
-- 4. PLANS — Paquetes y precios de Punto Neutro
-- ============================================================
INSERT INTO plans (id, name, description, price, currency, duration_days, class_limit, features, is_active, sort_order)
VALUES
  -- Clase suelta
  ('b2000001-0001-4000-8000-000000000001',
   'Clase Suelta',
   'Acceso a una clase individual. Ideal para probar o asistir esporádicamente.',
   120.00, 'MXN', 7, 1,
   '["1 clase", "Válido por 7 días", "Costo con descuento: $110 (efectivo/transferencia)"]'::jsonb,
   true, 0),

  -- 4 clases
  ('b2000001-0001-4000-8000-000000000002',
   '4 Clases',
   'Paquete de 4 sesiones al mes.',
   400.00, 'MXN', 30, 4,
   '["4 clases al mes", "1 clase por semana", "Válido por 30 días", "Costo con descuento: $380 (efectivo/transferencia)"]'::jsonb,
   true, 1),

  -- 8 clases
  ('b2000001-0001-4000-8000-000000000003',
   '8 Clases',
   'Paquete de 8 sesiones al mes.',
   680.00, 'MXN', 30, 8,
   '["8 clases al mes", "2 clases por semana", "Válido por 30 días", "Costo con descuento: $640 (efectivo/transferencia)"]'::jsonb,
   true, 2),

  -- 12 clases
  ('b2000001-0001-4000-8000-000000000004',
   '12 Clases',
   'Paquete de 12 sesiones al mes.',
   900.00, 'MXN', 30, 12,
   '["12 clases al mes", "3 clases por semana", "Válido por 30 días", "Costo con descuento: $840 (efectivo/transferencia)"]'::jsonb,
   true, 3),

  -- 16 clases
  ('b2000001-0001-4000-8000-000000000005',
   '16 Clases',
   'Paquete de 16 sesiones al mes.',
   1100.00, 'MXN', 30, 16,
   '["16 clases al mes", "4 clases por semana", "Válido por 30 días"]'::jsonb,
   true, 4),

  -- Clase muestra
  ('b2000001-0001-4000-8000-000000000006',
   'Clase Muestra',
   'Sesión de prueba para nuevas alumnas. Pago total de $110 requerido. No reembolsable.',
   110.00, 'MXN', 7, 1,
   '["1 clase de prueba", "Confirmar disponibilidad antes de pagar", "2 hrs para realizar pago después de confirmar", "No reembolsable ni transferible"]'::jsonb,
   true, 5);

-- ============================================================
-- 5. ADMIN USER + INSTRUCTOR
-- ============================================================

-- Admin user (contraseña: admin123 — bcrypt hash)
INSERT INTO users (id, email, phone, display_name, role, is_active)
VALUES (
  'c3000001-0001-4000-8000-000000000001',
  'admin@puntoneutro.com',
  '0000000000',
  'Administrador Punto Neutro',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;

-- Instructor principal
INSERT INTO users (id, email, phone, display_name, role, is_active)
VALUES (
  'c3000001-0001-4000-8000-000000000002',
  'instructora@puntoneutro.com',
  '0000000001',
  'Instructora Punto Neutro',
  'instructor',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO instructors (id, user_id, display_name, bio, specialties, is_active)
VALUES (
  'd4000001-0001-4000-8000-000000000001',
  'c3000001-0001-4000-8000-000000000002',
  'Instructora Punto Neutro',
  'Instructora certificada en Pilates y entrenamiento funcional.',
  '["Pilates", "Terapéutico", "Funcional"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. SCHEDULES — Horario semanal recurrente
-- ============================================================
-- day_of_week: 1=Lunes, 2=Martes, ..., 6=Sábado, 0=Domingo

-- Alias para class_type_ids
-- Body Strong:          a1000001-0001-4000-8000-000000000004
-- Pilates Matt Clásico: a1000001-0001-4000-8000-000000000001
-- Pilates Terapéutico:  a1000001-0001-4000-8000-000000000002
-- Flex & Flow:          a1000001-0001-4000-8000-000000000003
-- Instructor:           d4000001-0001-4000-8000-000000000001

-- ── LUNES (day_of_week = 1) ──
INSERT INTO schedules (class_type_id, instructor_id, day_of_week, start_time, end_time, max_capacity, is_recurring, is_active) VALUES
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 1, '07:15', '08:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 1, '08:20', '09:15', 10, true, true),
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 1, '18:15', '19:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 1, '19:20', '20:15', 10, true, true);

-- ── MARTES (day_of_week = 2) ──
INSERT INTO schedules (class_type_id, instructor_id, day_of_week, start_time, end_time, max_capacity, is_recurring, is_active) VALUES
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 2, '07:15', '08:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 2, '08:20', '09:15', 10, true, true),
('a1000001-0001-4000-8000-000000000002', 'd4000001-0001-4000-8000-000000000001', 2, '09:25', '10:20', 10, true, true),
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 2, '18:15', '19:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 2, '19:20', '20:15', 10, true, true);

-- ── MIÉRCOLES (day_of_week = 3) ──
INSERT INTO schedules (class_type_id, instructor_id, day_of_week, start_time, end_time, max_capacity, is_recurring, is_active) VALUES
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 3, '07:15', '08:05', 10, true, true),
('a1000001-0001-4000-8000-000000000003', 'd4000001-0001-4000-8000-000000000001', 3, '08:20', '09:15', 10, true, true),
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 3, '18:15', '19:05', 10, true, true),
('a1000001-0001-4000-8000-000000000003', 'd4000001-0001-4000-8000-000000000001', 3, '19:20', '20:15', 10, true, true);

-- ── JUEVES (day_of_week = 4) ──
INSERT INTO schedules (class_type_id, instructor_id, day_of_week, start_time, end_time, max_capacity, is_recurring, is_active) VALUES
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 4, '07:15', '08:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 4, '08:20', '09:15', 10, true, true),
('a1000001-0001-4000-8000-000000000002', 'd4000001-0001-4000-8000-000000000001', 4, '09:25', '10:20', 10, true, true),
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 4, '18:15', '19:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 4, '19:20', '20:15', 10, true, true);

-- ── VIERNES (day_of_week = 5) ──
INSERT INTO schedules (class_type_id, instructor_id, day_of_week, start_time, end_time, max_capacity, is_recurring, is_active) VALUES
('a1000001-0001-4000-8000-000000000004', 'd4000001-0001-4000-8000-000000000001', 5, '07:15', '08:05', 10, true, true),
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 5, '08:20', '09:15', 10, true, true);

-- ── SÁBADO (day_of_week = 6) ──
INSERT INTO schedules (class_type_id, instructor_id, day_of_week, start_time, end_time, max_capacity, is_recurring, is_active) VALUES
('a1000001-0001-4000-8000-000000000001', 'd4000001-0001-4000-8000-000000000001', 6, '08:00', '08:55', 10, true, true),
('a1000001-0001-4000-8000-000000000003', 'd4000001-0001-4000-8000-000000000001', 6, '09:05', '10:00', 10, true, true);

-- ============================================================
-- 7. CLASSES — Generar clases para las próximas 4 semanas
-- ============================================================
-- Semana actual (17 marzo 2026 es martes) + 3 semanas más

DO $$
DECLARE
  rec RECORD;
  week_offset INT;
  target_date DATE;
  base_monday DATE;
BEGIN
  -- Encontrar el lunes de esta semana
  base_monday := date_trunc('week', CURRENT_DATE)::date;

  FOR week_offset IN 0..3 LOOP
    FOR rec IN SELECT * FROM schedules WHERE is_recurring = true AND is_active = true LOOP
      -- Calcular fecha: lunes de la semana + day_of_week - 1
      target_date := base_monday + (week_offset * 7) + (rec.day_of_week - 1);

      -- Solo insertar fechas de hoy en adelante
      IF target_date >= CURRENT_DATE THEN
        INSERT INTO classes (
          schedule_id, class_type_id, instructor_id,
          date, start_time, end_time,
          max_capacity, current_bookings, status
        ) VALUES (
          rec.id, rec.class_type_id, rec.instructor_id,
          target_date, rec.start_time, rec.end_time,
          rec.max_capacity, 0, 'scheduled'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Clases generadas para las próximas 4 semanas';
END $$;

COMMIT;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT '--- CLASS TYPES ---' AS info;
SELECT name, color, duration_minutes, max_capacity FROM class_types WHERE is_active = true ORDER BY name;

SELECT '--- PLANS ---' AS info;
SELECT name, price, class_limit, sort_order FROM plans WHERE is_active = true ORDER BY sort_order;

SELECT '--- SCHEDULES ---' AS info;
SELECT s.day_of_week, s.start_time, ct.name as class_name
FROM schedules s
JOIN class_types ct ON s.class_type_id = ct.id
WHERE s.is_active = true
ORDER BY s.day_of_week, s.start_time;

SELECT '--- CLASSES (upcoming) ---' AS info;
SELECT c.date, c.start_time, ct.name as class_name, c.status
FROM classes c
JOIN class_types ct ON c.class_type_id = ct.id
WHERE c.date >= CURRENT_DATE
ORDER BY c.date, c.start_time
LIMIT 30;

SELECT '--- SYSTEM SETTINGS ---' AS info;
SELECT key, value FROM system_settings WHERE key IN ('studio_info', 'bank_info');
