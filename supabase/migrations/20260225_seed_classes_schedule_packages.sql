-- ============================================================
-- OPHELIA JUMPING STUDIO — SEED DATA
-- Clases, Horarios y Paquetes reales (basados en info oficial)
-- Fecha: 2026-02-25
-- ============================================================

-- ── 1. Tablas para catálogo de tipos de clase y plantilla de horarios ────────

-- Tipos/Modalidades de clase (lo que se muestra en "Clases Disponibles")
CREATE TABLE IF NOT EXISTS class_types (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,           -- "Jumping Fitness"
    subtitle    VARCHAR(150),                    -- "Full Body"
    description TEXT,
    category    VARCHAR(20)  NOT NULL DEFAULT 'jumping'
                CHECK (category IN ('jumping','pilates','mixto')),
    intensity   VARCHAR(20)  DEFAULT 'media'
                CHECK (intensity IN ('ligera','media','pesada','todas')),
    color       VARCHAR(30)  DEFAULT '#c026d3',  -- Tailwind / hex
    is_active   BOOLEAN      DEFAULT true,
    sort_order  INTEGER      DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_class_types_category ON class_types(category);
CREATE INDEX IF NOT EXISTS idx_class_types_active   ON class_types(is_active);

DROP TRIGGER IF EXISTS update_class_types_updated_at ON class_types;
CREATE TRIGGER update_class_types_updated_at
    BEFORE UPDATE ON class_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Plantilla semanal de horarios (fijos; clases reales se generan cada semana)
CREATE TABLE IF NOT EXISTS schedule_templates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_slot   VARCHAR(10)  NOT NULL,           -- "07:00", "08:15", "18:30"
    day_of_week SMALLINT     NOT NULL            -- 1=LUN … 6=SÁB
                CHECK (day_of_week BETWEEN 1 AND 6),
    class_label VARCHAR(50)  NOT NULL,           -- "JUMPING", "PILATES", "SORPRESA"
    shift       VARCHAR(10)  NOT NULL DEFAULT 'morning'
                CHECK (shift IN ('morning','evening')),
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (time_slot, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_sched_tpl_day   ON schedule_templates(day_of_week);
CREATE INDEX IF NOT EXISTS idx_sched_tpl_shift ON schedule_templates(shift);

DROP TRIGGER IF EXISTS update_sched_tpl_updated_at ON schedule_templates;
CREATE TRIGGER update_sched_tpl_updated_at
    BEFORE UPDATE ON schedule_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Paquetes / precios (separados de plans que es la membresía activa del usuario)
CREATE TABLE IF NOT EXISTS packages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,           -- "4 Clases"
    num_classes VARCHAR(20)  NOT NULL,           -- "4", "8", "ILIMITADO"
    price       DECIMAL(10,2) NOT NULL,
    category    VARCHAR(20)  NOT NULL DEFAULT 'jumping'
                CHECK (category IN ('jumping','pilates','mixtos')),
    validity_days INTEGER    DEFAULT 30,
    is_active   BOOLEAN      DEFAULT true,
    sort_order  INTEGER      DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category);
CREATE INDEX IF NOT EXISTS idx_packages_active   ON packages(is_active);

DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
CREATE TRIGGER update_packages_updated_at
    BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 2. Seed: Tipos de clase ──────────────────────────────────────────────────
INSERT INTO class_types (name, subtitle, description, category, intensity, color, sort_order) VALUES
  ('Jumping Fitness',  'Full Body',                         'Clase de jumping en trampolín enfocada en todo el cuerpo. Cardio de alto impacto de forma segura y divertida.',                         'jumping', 'todas',   '#c026d3', 1),
  ('Jumping Dance',    'Coreografías',                      'Jumping con coreografías de baile. Combina fitness y diversión para mejorar coordinación y quema de calorías.',                          'jumping', 'media',   '#a21caf', 2),
  ('Jump & Tone',      'Tonificación tren superior',        'Tonificación y resistencia en tren superior del cuerpo. Combina jumping con ejercicios de fuerza para brazos y core.',                  'jumping', 'media',   '#9333ea', 3),
  ('Strong Jump',      'Fuerza pierna y glúteo',            'Fuerza y resistencia en pierna y glúteo. La clase más intensa de jumping para quienes buscan definir la parte inferior.',               'jumping', 'pesada',  '#7c3aed', 4),
  ('Mindful Jump',     'Pilates en trampolín',              'Pilates en trampolín. Combina la conciencia corporal del pilates con el movimiento dinámico del jumping.',                               'mixto',   'ligera',  '#6d28d9', 5),
  ('Hot Pilates',      'Pilates con peso',                  'Pilates en esterilla con implementos de carga. Clase pesada enfocada en fuerza y tono muscular profundo.',                              'pilates', 'pesada',  '#ec4899', 6),
  ('Flow Pilates',     'Intensidad media',                  'Pilates fluido de intensidad media. Mejora flexibilidad, postura y equilibrio en un flujo constante de movimientos.',                   'pilates', 'media',   '#db2777', 7),
  ('Pilates Mat',      'Intensidad ligera',                 'Pilates en esterilla de intensidad ligera. Ideal para principiantes o como sesión de recuperación activa.',                             'pilates', 'ligera',  '#be185d', 8)
ON CONFLICT DO NOTHING;


-- ── 3. Seed: Plantilla semanal de horarios ───────────────────────────────────
-- TURNO MAÑANA
-- 7:00am: LUN-JUMPING, MAR-PILATES, MIÉ-JUMPING, JUE-PILATES, VIE-JUMPING
INSERT INTO schedule_templates (time_slot, day_of_week, class_label, shift) VALUES
  ('07:00', 1, 'JUMPING', 'morning'),
  ('07:00', 2, 'PILATES', 'morning'),
  ('07:00', 3, 'JUMPING', 'morning'),
  ('07:00', 4, 'PILATES', 'morning'),
  ('07:00', 5, 'JUMPING', 'morning')
ON CONFLICT (time_slot, day_of_week) DO UPDATE SET class_label = EXCLUDED.class_label;

-- 8:15am: LUN-PILATES, MAR-JUMPING, MIÉ-PILATES, JUE-JUMPING, VIE-PILATES, SÁB-SORPRESA
INSERT INTO schedule_templates (time_slot, day_of_week, class_label, shift) VALUES
  ('08:15', 1, 'PILATES',  'morning'),
  ('08:15', 2, 'JUMPING',  'morning'),
  ('08:15', 3, 'PILATES',  'morning'),
  ('08:15', 4, 'JUMPING',  'morning'),
  ('08:15', 5, 'PILATES',  'morning'),
  ('08:15', 6, 'SORPRESA', 'morning')
ON CONFLICT (time_slot, day_of_week) DO UPDATE SET class_label = EXCLUDED.class_label;

-- TURNO TARDE/NOCHE
-- 6:30pm: LUN-PILATES, MAR-JUMPING, MIÉ-PILATES, JUE-JUMPING
INSERT INTO schedule_templates (time_slot, day_of_week, class_label, shift) VALUES
  ('18:30', 1, 'PILATES', 'evening'),
  ('18:30', 2, 'JUMPING', 'evening'),
  ('18:30', 3, 'PILATES', 'evening'),
  ('18:30', 4, 'JUMPING', 'evening')
ON CONFLICT (time_slot, day_of_week) DO UPDATE SET class_label = EXCLUDED.class_label;

-- 7:00pm: VIE-JUMPING
INSERT INTO schedule_templates (time_slot, day_of_week, class_label, shift) VALUES
  ('19:00', 5, 'JUMPING', 'evening')
ON CONFLICT (time_slot, day_of_week) DO UPDATE SET class_label = EXCLUDED.class_label;

-- 7:45pm: LUN-JUMPING, MAR-JUMPING, MIÉ-JUMPING, JUE-PILATES
INSERT INTO schedule_templates (time_slot, day_of_week, class_label, shift) VALUES
  ('19:45', 1, 'JUMPING', 'evening'),
  ('19:45', 2, 'JUMPING', 'evening'),
  ('19:45', 3, 'JUMPING', 'evening'),
  ('19:45', 4, 'PILATES', 'evening')
ON CONFLICT (time_slot, day_of_week) DO UPDATE SET class_label = EXCLUDED.class_label;


-- ── 4. Seed: Paquetes de precios ─────────────────────────────────────────────
-- JUMPING
INSERT INTO packages (name, num_classes, price, category, sort_order) VALUES
  ('4 Clases Jumping',    '4',        300.00,  'jumping', 1),
  ('8 Clases Jumping',    '8',        560.00,  'jumping', 2),
  ('12 Clases Jumping',   '12',       780.00,  'jumping', 3),
  ('16 Clases Jumping',   '16',       960.00,  'jumping', 4),
  ('20 Clases Jumping',   '20',      1100.00,  'jumping', 5),
  ('Ilimitado Jumping',   'ILIMITADO',1000.00, 'jumping', 6)
ON CONFLICT DO NOTHING;

-- PILATES
INSERT INTO packages (name, num_classes, price, category, sort_order) VALUES
  ('4 Clases Pilates',    '4',         300.00, 'pilates', 1),
  ('8 Clases Pilates',    '8',         600.00, 'pilates', 2),
  ('12 Clases Pilates',   '12',        840.00, 'pilates', 3),
  ('16 Clases Pilates',   '16',       1120.00, 'pilates', 4),
  ('Ilimitado Pilates',   'ILIMITADO', 1000.00,'pilates', 5)
ON CONFLICT DO NOTHING;

-- MIXTOS (Jumping + Pilates)
INSERT INTO packages (name, num_classes, price, category, sort_order) VALUES
  ('8 Clases Mixtas',     '8',         600.00, 'mixtos', 1),
  ('12 Clases Mixtas',    '12',        860.00, 'mixtos', 2),
  ('16 Clases Mixtas',    '16',       1120.00, 'mixtos', 3),
  ('20 Clases Mixtas',    '20',       1300.00, 'mixtos', 4),
  ('Ilimitado Mixto',     'ILIMITADO', 1000.00,'mixtos', 5)
ON CONFLICT DO NOTHING;
