import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "ophelia_secret_2026";

// ─── File upload (memory storage, max 10 MB) ────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Database ───────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

// Ensure users table has password_hash column (idempotent migration)
async function ensureSchema() {
  try {
    // ── Ensure all users columns the app needs ────────────────────────────
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS accepts_terms BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS accepts_communications BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS health_notes TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_reminders BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_promotions BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_weekly_summary BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    // Ensure referrals table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL UNIQUE,
        uses_count INTEGER DEFAULT 0,
        reward_points INTEGER DEFAULT 200,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
    `);
    // Ensure discount_codes table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) NOT NULL UNIQUE,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
        discount_value DECIMAL(10,2) NOT NULL,
        max_uses INTEGER,
        uses_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── class_types (tipos de clase editables desde admin) ──────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_types (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         VARCHAR(100) NOT NULL,
        subtitle     VARCHAR(150),
        description  TEXT,
        category     VARCHAR(20)  NOT NULL DEFAULT 'jumping' CHECK (category IN ('jumping','pilates','mixto')),
        intensity    VARCHAR(20)  DEFAULT 'media' CHECK (intensity IN ('ligera','media','pesada','todas')),
        level        VARCHAR(50)  DEFAULT 'Todos los niveles',
        duration_min INTEGER      DEFAULT 50,
        capacity     INTEGER      DEFAULT 15,
        color        VARCHAR(50)  DEFAULT '#c026d3',
        emoji        VARCHAR(10)  DEFAULT '🏃',
        is_active    BOOLEAN      DEFAULT true,
        sort_order   INTEGER      DEFAULT 0,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS subtitle VARCHAR(150);
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'jumping';
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS intensity VARCHAR(20) DEFAULT 'media';
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS level VARCHAR(50) DEFAULT 'Todos los niveles';
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 50;
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 15;
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT '#c026d3';
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) DEFAULT '🏃';
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE class_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
    // ── schedule_slots (horario semanal editable desde admin) ───────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_slots (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        time_slot       VARCHAR(20) NOT NULL,
        day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        class_type_id   UUID REFERENCES class_types(id) ON DELETE SET NULL,
        class_type_name VARCHAR(100),
        instructor_name VARCHAR(100),
        is_active       BOOLEAN DEFAULT true,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_schedule_slots_day ON schedule_slots(day_of_week);
    `);
    await pool.query(`
      ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS class_type_id UUID;
      ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS class_type_name VARCHAR(100);
      ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS instructor_name VARCHAR(100);
      ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_slots_slot ON schedule_slots(time_slot, day_of_week)
        WHERE is_active = true;
    `);
    // ── schedule_templates (plantilla simple con class_label) ───────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_templates (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        time_slot   VARCHAR(10)  NOT NULL,
        day_of_week SMALLINT     NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
        class_label VARCHAR(50)  NOT NULL,
        shift       VARCHAR(10)  NOT NULL DEFAULT 'morning' CHECK (shift IN ('morning','evening')),
        is_active   BOOLEAN      DEFAULT true,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (time_slot, day_of_week)
      );
    `);
    // ── packages (paquetes de precios jumping/pilates/mixtos) ────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name          VARCHAR(100) NOT NULL,
        num_classes   VARCHAR(20)  NOT NULL,
        price         DECIMAL(10,2) NOT NULL,
        category      VARCHAR(20)  NOT NULL DEFAULT 'jumping' CHECK (category IN ('jumping','pilates','mixtos')),
        validity_days INTEGER      DEFAULT 30,
        is_active     BOOLEAN      DEFAULT true,
        sort_order    INTEGER      DEFAULT 0,
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category);
    `);
    // ── Seed class_types si la tabla está vacía ────────────────────────────
    const ctCount = await pool.query("SELECT COUNT(*) FROM class_types");
    if (parseInt(ctCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO class_types (name, description, level, duration_min, capacity, color, emoji, sort_order) VALUES
          ('Jumping Basics',  'La clase perfecta para comenzar. Aprende los fundamentos del jumping fitness con música motivadora y movimientos accesibles.', 'Principiante',       50, 15, 'primary',    '🚀', 1),
          ('Power Jump',      'Lleva tu entrenamiento al siguiente nivel con coreografías dinámicas, intervalos HIIT y música que no para.',                  'Intermedio',         55, 12, 'purple',     '⚡', 2),
          ('Jump & Stretch',  'Combina el jumping con yoga y stretching profundo. Ideal para relajar, ganar flexibilidad y recuperarte activamente.',         'Todos los niveles',  60, 10, 'yellow',     '🌸', 3)
        ON CONFLICT DO NOTHING;
      `);
    }
    // ── Seed schedule_slots si la tabla está vacía ─────────────────────────
    const ssCount = await pool.query("SELECT COUNT(*) FROM schedule_slots");
    if (parseInt(ssCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO schedule_slots (time_slot, day_of_week, class_type_name) VALUES
          ('7:00 am', 1, 'Jumping Basics'), ('7:00 am', 2, 'Power Jump'),
          ('7:00 am', 3, 'Jumping Basics'), ('7:00 am', 4, 'Power Jump'),
          ('7:00 am', 5, 'Jump & Stretch'),('7:00 am', 6, 'Jumping Basics'),
          ('9:00 am', 1, 'Power Jump'),     ('9:00 am', 2, 'Jumping Basics'),
          ('9:00 am', 3, 'Power Jump'),     ('9:00 am', 4, 'Jumping Basics'),
          ('9:00 am', 5, 'Power Jump'),     ('9:00 am', 6, 'Power Jump'),
          ('11:00 am',1, 'Jump & Stretch'), ('11:00 am',3, 'Jump & Stretch'),
          ('11:00 am',5, 'Jumping Basics'), ('11:00 am',6, 'Jump & Stretch'),
          ('6:00 pm', 1, 'Jumping Basics'), ('6:00 pm', 2, 'Power Jump'),
          ('6:00 pm', 3, 'Jumping Basics'), ('6:00 pm', 4, 'Power Jump'),
          ('6:00 pm', 5, 'Power Jump'),
          ('7:30 pm', 1, 'Power Jump'),     ('7:30 pm', 2, 'Jump & Stretch'),
          ('7:30 pm', 3, 'Power Jump'),     ('7:30 pm', 4, 'Jump & Stretch')
        ON CONFLICT DO NOTHING;
      `);
    }
    // ── Ensure plans columns exist ───────────────────────────────────────
    await pool.query(`
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'MXN';
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS class_limit INTEGER;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
    // ── Seed plans si la tabla está vacía ──────────────────────────────────
    const plCount = await pool.query("SELECT COUNT(*) FROM plans");
    if (parseInt(plCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO plans (name, price, currency, duration_days, class_limit, is_active, sort_order) VALUES
          ('4 Clases',   380,  'MXN', 30,   4,    true, 1),
          ('8 Clases',   700,  'MXN', 30,   8,    true, 2),
          ('12 Clases',  980,  'MXN', 30,   12,   true, 3),
          ('Ilimitado',  1350, 'MXN', 30,   NULL, true, 4)
        ON CONFLICT DO NOTHING;
      `);
    }
    // ── Products table ─────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(150) NOT NULL,
        price      DECIMAL(10,2) DEFAULT 0,
        category   VARCHAR(50) DEFAULT 'accesorios',
        stock      INTEGER DEFAULT 0,
        sku        VARCHAR(100),
        is_active  BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── Order items table ───────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        quantity   INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    `);
    // ── Instructors table ──────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instructors (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        display_name VARCHAR(150) NOT NULL,
        email        VARCHAR(255),
        phone        VARCHAR(30),
        bio          TEXT,
        specialties  TEXT,
        photo_url    TEXT,
        is_active    BOOLEAN DEFAULT true,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── Reviews table ──────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        class_id    UUID,
        is_approved BOOLEAN DEFAULT false,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
    `);
    // ── Loyalty transactions table ─────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        VARCHAR(10) NOT NULL CHECK (type IN ('earn','redeem','adjust')),
        points      INTEGER NOT NULL,
        description TEXT,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transactions(user_id);
    `);
    // ── referrals table (tracks which users were referred) ─────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referral_code_id UUID REFERENCES referral_codes(id) ON DELETE CASCADE,
        referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rewarded         BOOLEAN DEFAULT false,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code_id);
    `);
    // ── orders: add missing columns if needed ─────────────────────────────
    await pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR(30) DEFAULT 'web';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan_id UUID;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_by UUID;
    `);
    // ── memberships: add order_id column ─────────────────────────────────
    await pool.query(`
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS order_id UUID;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_order ON memberships(order_id) WHERE order_id IS NOT NULL;
    `);
    // ── discount_codes: normalise discount_type values ────────────────────
    await pool.query(`
      ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
    // ── bookings: add checked_in_at column ────────────────────────────────
    await pool.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE;
    `);
    // ── Settings table ─────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── Loyalty rewards table ──────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(150) NOT NULL,
        description TEXT,
        points_cost INTEGER NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── Review tags table ──────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS review_tags (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(100) NOT NULL,
        color      VARCHAR(20) DEFAULT '#c026d3',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── Videos: add price column (may fail if videos table not yet created) ─
    try {
      await pool.query(`
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
      `);
    } catch { /* videos table may not exist yet, that's ok */ }
    // ── Video purchases: add admin_notes and verified_at ──────────────────
    try {
      await pool.query(`
        ALTER TABLE video_purchases ADD COLUMN IF NOT EXISTS admin_notes TEXT;
        ALTER TABLE video_purchases ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
      `);
    } catch { /* video_purchases table may not exist yet */ }
    console.log("✅ Schema ensured");
  } catch (err) {
    console.error("Schema migration warning:", err.message);
  }

  // ── Admin user — always upsert (separate try/catch so it always runs) ──
  try {
    const adminHash = await bcrypt.hash("Ophelia2026!", 12);
    await pool.query(
      `INSERT INTO users (display_name, email, phone, password_hash, role, accepts_terms, accepts_communications)
       VALUES ('Admin Ophelia', 'admin@opheliajumping.mx', '0000000000', $1, 'admin', true, false)
       ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = $1`,
      [adminHash]
    );
    console.log("✅ Admin user ready: admin@opheliajumping.mx / Ophelia2026!");
  } catch (err) {
    console.error("Admin seed warning:", err.message);
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Helper: snake_case → camelCase row mapper ──────────────────────────────
function camelRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}
function camelRows(rows) { return rows.map(camelRow); }

// ─── Auth helpers ────────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "No autorizado" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
}

async function adminMiddleware(req, res, next) {
  authMiddleware(req, res, async () => {
    try {
      const r = await pool.query("SELECT role FROM users WHERE id = $1", [req.userId]);
      if (!r.rows.length || !["admin", "super_admin", "instructor", "reception"].includes(r.rows[0].role)) {
        return res.status(403).json({ message: "Acceso restringido" });
      }
      next();
    } catch { return res.status(500).json({ message: "Error interno" }); }
  });
}

function mapUser(u) {
  return {
    id: u.id,
    displayName: u.display_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    photoUrl: u.photo_url ?? null,
    dateOfBirth: u.date_of_birth ?? null,
    emergencyContactName: u.emergency_contact_name ?? null,
    emergencyContactPhone: u.emergency_contact_phone ?? null,
    healthNotes: u.health_notes ?? null,
    receiveReminders: u.receive_reminders ?? true,
    receivePromotions: u.receive_promotions ?? false,
    receiveWeeklySummary: u.receive_weekly_summary ?? false,
    createdAt: u.created_at,
  };
}

// ─── Routes: /api/auth ───────────────────────────────────────────────────────

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName, phone, acceptsTerms, acceptsCommunications } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
  }
  try {
    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Este email ya está registrado" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (display_name, email, phone, password_hash, accepts_terms, accepts_communications, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'client')
       RETURNING *`,
      [displayName.trim(), email.toLowerCase().trim(), phone || null, passwordHash, acceptsTerms ?? false, acceptsCommunications ?? false]
    );
    const user = result.rows[0];
    // Auto-create referral code
    const code = "OPH" + Math.random().toString(36).slice(2, 8).toUpperCase();
    await pool.query(
      "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, code]
    );
    const token = signToken(user.id);
    return res.status(201).json({ user: mapUser(user), token });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email y contraseña requeridos" });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (result.rows.length === 0) return res.status(401).json({ message: "Credenciales incorrectas" });
    const user = result.rows[0];
    if (!user.password_hash) return res.status(401).json({ message: "Credenciales incorrectas" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Credenciales incorrectas" });
    const token = signToken(user.id);
    return res.json({ user: mapUser(user), token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    return res.json({ user: mapUser(result.rows[0]) });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ─── Routes: /api/plans ─────────────────────────────────────────────────────

// GET /api/plans
app.get("/api/plans", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC, price ASC"
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("Plans error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/memberships ───────────────────────────────────────────────

// GET /api/memberships/my
app.get("/api/memberships/my", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT m.*, p.name AS plan_name, p.class_limit, p.duration_days, p.features
       FROM memberships m
       JOIN plans p ON m.plan_id = p.id
       WHERE m.user_id = $1
       ORDER BY CASE m.status
         WHEN 'active' THEN 1
         WHEN 'pending_activation' THEN 2
         WHEN 'pending_payment' THEN 3
         ELSE 4 END,
         m.created_at DESC
       LIMIT 1`,
      [req.userId]
    );
    return res.json({ data: r.rows[0] ?? null });
  } catch (err) {
    console.error("Memberships/my error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/classes ───────────────────────────────────────────────────

// GET /api/classes?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get("/api/classes", async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    let query = `
      SELECT c.*,
             ct.name  AS class_type_name,
             ct.color AS class_type_color,
             ct.icon  AS class_type_icon,
             ct.level AS class_type_level,
             i.display_name AS instructor_name,
             i.photo_url    AS instructor_photo,
             f.name         AS facility_name
      FROM classes c
      JOIN class_types ct   ON c.class_type_id  = ct.id
      JOIN instructors i    ON c.instructor_id   = i.id
      LEFT JOIN facilities f ON c.facility_id    = f.id
      WHERE c.status != 'cancelled'
    `;
    const params = [];
    if (start) { params.push(start); query += ` AND c.date >= $${params.length}`; }
    if (end)   { params.push(end);   query += ` AND c.date <= $${params.length}`; }
    query += " ORDER BY c.date ASC, c.start_time ASC";
    if (limit) { params.push(parseInt(limit)); query += ` LIMIT $${params.length}`; }
    const r = await pool.query(query, params);
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("Classes error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/classes/:id
app.get("/api/classes/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*,
              ct.name  AS class_type_name,
              ct.color AS class_type_color,
              ct.icon  AS class_type_icon,
              ct.level AS class_type_level,
              i.display_name AS instructor_name,
              i.photo_url    AS instructor_photo,
              i.bio          AS instructor_bio,
              f.name         AS facility_name
       FROM classes c
       JOIN class_types ct   ON c.class_type_id  = ct.id
       JOIN instructors i    ON c.instructor_id   = i.id
       LEFT JOIN facilities f ON c.facility_id    = f.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Clase no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("Class/:id error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/bookings ──────────────────────────────────────────────────

// GET /api/bookings/my-bookings
app.get("/api/bookings/my-bookings", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT b.*,
              c.date, c.start_time, c.end_time, c.status AS class_status,
              ct.name  AS class_name,
              ct.color AS class_color,
              i.display_name AS instructor_name,
              i.photo_url    AS instructor_photo,
              f.name         AS facility_name
       FROM bookings b
       JOIN classes c       ON b.class_id       = c.id
       JOIN class_types ct  ON c.class_type_id  = ct.id
       JOIN instructors i   ON c.instructor_id  = i.id
       LEFT JOIN facilities f ON c.facility_id  = f.id
       WHERE b.user_id = $1
       ORDER BY c.date DESC, c.start_time DESC`,
      [req.userId]
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("Bookings/my error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/bookings
app.post("/api/bookings", authMiddleware, async (req, res) => {
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ message: "classId requerido" });
  try {
    // Check membership
    const memRes = await pool.query(
      `SELECT id, classes_remaining FROM memberships
       WHERE user_id = $1 AND status = 'active' AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       LIMIT 1`,
      [req.userId]
    );
    if (memRes.rows.length === 0) return res.status(403).json({ message: "No tienes membresía activa" });
    const membership = memRes.rows[0];
    // Check if class exists and has capacity
    const classRes = await pool.query(
      "SELECT id, max_capacity, current_bookings, status FROM classes WHERE id = $1",
      [classId]
    );
    if (classRes.rows.length === 0) return res.status(404).json({ message: "Clase no encontrada" });
    const cls = classRes.rows[0];
    if (cls.status === "cancelled") return res.status(400).json({ message: "Esta clase fue cancelada" });
    // Check duplicate
    const dupRes = await pool.query(
      "SELECT id FROM bookings WHERE class_id = $1 AND user_id = $2 AND status != 'cancelled'",
      [classId, req.userId]
    );
    if (dupRes.rows.length > 0) return res.status(409).json({ message: "Ya tienes una reserva para esta clase" });
    // Determine if waitlist
    const isWaitlist = cls.current_bookings >= cls.max_capacity;
    const status = isWaitlist ? "waitlist" : "confirmed";
    const result = await pool.query(
      `INSERT INTO bookings (class_id, user_id, membership_id, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [classId, req.userId, membership.id, status]
    );
    if (!isWaitlist) {
      await pool.query(
        "UPDATE classes SET current_bookings = current_bookings + 1 WHERE id = $1",
        [classId]
      );
      // Deduct class credit if plan has limit
      if (membership.classes_remaining !== null) {
        await pool.query(
          "UPDATE memberships SET classes_remaining = classes_remaining - 1 WHERE id = $1",
          [membership.id]
        );
      }
    }
    const msg = isWaitlist ? "Añadido a lista de espera" : "Reserva confirmada";
    return res.status(201).json({ message: msg, booking: result.rows[0] });
  } catch (err) {
    console.error("POST bookings error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/bookings/:id
app.delete("/api/bookings/:id", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM bookings WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Reserva no encontrada" });
    const booking = r.rows[0];
    await pool.query(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    // Restore class slot if was confirmed
    if (booking.status === "confirmed") {
      await pool.query(
        "UPDATE classes SET current_bookings = GREATEST(current_bookings - 1, 0) WHERE id = $1",
        [booking.class_id]
      );
      // Restore class credit if membership had limit
      if (booking.membership_id) {
        const memRes = await pool.query(
          "SELECT classes_remaining, plan_id FROM memberships WHERE id = $1",
          [booking.membership_id]
        );
        if (memRes.rows.length > 0 && memRes.rows[0].classes_remaining !== null) {
          await pool.query(
            "UPDATE memberships SET classes_remaining = classes_remaining + 1 WHERE id = $1",
            [booking.membership_id]
          );
        }
      }
    }
    return res.json({ message: "Reserva cancelada" });
  } catch (err) {
    console.error("DELETE bookings error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/reviews
app.post("/api/reviews", authMiddleware, async (req, res) => {
  const { bookingId, rating, comment } = req.body;
  if (!bookingId || !rating) return res.status(400).json({ message: "bookingId y rating requeridos" });
  try {
    // Verify booking belongs to user
    const bRes = await pool.query(
      "SELECT b.*, c.id AS class_id FROM bookings b JOIN classes c ON b.class_id = c.id WHERE b.id = $1 AND b.user_id = $2",
      [bookingId, req.userId]
    );
    if (bRes.rows.length === 0) return res.status(404).json({ message: "Reserva no encontrada" });
    return res.json({ message: "Reseña enviada — gracias por tu opinión" });
  } catch (err) {
    console.error("POST reviews error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/orders ────────────────────────────────────────────────────

// GET /api/orders
app.get("/api/orders", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT o.*, p.name AS plan_name, p.duration_days
       FROM orders o
       JOIN plans p ON o.plan_id = p.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.userId]
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("GET orders error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/orders/:id
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT o.*, p.name AS plan_name, p.duration_days, p.features,
              pp.file_url AS proof_url, pp.status AS proof_status, pp.uploaded_at AS proof_uploaded_at
       FROM orders o
       JOIN plans p ON o.plan_id = p.id
       LEFT JOIN payment_proofs pp ON pp.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Orden no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("GET orders/:id error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/orders
app.post("/api/orders", authMiddleware, async (req, res) => {
  const { planId, discountCode, paymentMethod = "transfer" } = req.body;
  if (!planId) return res.status(400).json({ message: "planId requerido" });
  try {
    const planRes = await pool.query("SELECT * FROM plans WHERE id = $1 AND is_active = true", [planId]);
    if (planRes.rows.length === 0) return res.status(404).json({ message: "Plan no encontrado" });
    const plan = planRes.rows[0];
    let subtotal = parseFloat(plan.price);
    let discount = 0;
    // Apply discount code
    if (discountCode) {
      const dcRes = await pool.query(
        `SELECT * FROM discount_codes WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR uses_count < max_uses)`,
        [discountCode.toUpperCase()]
      );
      if (dcRes.rows.length > 0) {
        const dc = dcRes.rows[0];
        discount = dc.discount_type === "percent"
          ? subtotal * (parseFloat(dc.discount_value) / 100)
          : parseFloat(dc.discount_value);
        discount = Math.min(discount, subtotal);
      }
    }
    const total = subtotal - discount;
    // Bank info from system settings or defaults
    const settingsRes = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'bank_info'"
    );
    const bankInfo = settingsRes.rows.length > 0
      ? settingsRes.rows[0].value
      : { clabe: "710180000068980", bank: "Banorte", accountHolder: "Ophelia Studio" };
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
    const orderRes = await pool.query(
      `INSERT INTO orders (user_id, plan_id, status, payment_method, subtotal, tax_amount, total_amount, bank_info, expires_at)
       VALUES ($1, $2, 'pending_payment', $3, $4, 0, $5, $6, $7)
       RETURNING *`,
      [req.userId, planId, paymentMethod, subtotal, total, JSON.stringify(bankInfo), expires]
    );
    const order = orderRes.rows[0];
    return res.status(201).json({
      data: {
        ...order,
        plan_name: plan.name,
        bank_details: { ...bankInfo, amount: total },
      }
    });
  } catch (err) {
    console.error("POST orders error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/orders/:id/proof  (multipart)
app.post("/api/orders/:id/proof", authMiddleware, upload.single("proof"), async (req, res) => {
  try {
    const orderRes = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ message: "Orden no encontrada" });
    // In production you'd upload to cloud storage. For now, store a placeholder.
    const fileUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64").slice(0, 20)}...`
      : req.body.fileUrl || "uploaded";
    const fileName = req.file?.originalname || "comprobante";
    await pool.query(
      `INSERT INTO payment_proofs (order_id, file_url, file_name, mime_type, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT DO NOTHING`,
      [req.params.id, fileUrl, fileName, req.file?.mimetype || "application/octet-stream"]
    );
    await pool.query(
      "UPDATE orders SET status = 'pending_verification', paid_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    return res.json({ message: "Comprobante recibido — estamos verificando tu pago" });
  } catch (err) {
    console.error("POST orders/proof error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/discount-codes ────────────────────────────────────────────

// POST /api/discount-codes/validate
app.post("/api/discount-codes/validate", authMiddleware, async (req, res) => {
  const { code, planId } = req.body;
  if (!code) return res.status(400).json({ message: "Código requerido" });
  try {
    const planRes = await pool.query("SELECT price FROM plans WHERE id = $1", [planId]);
    const originalPrice = planRes.rows.length > 0 ? parseFloat(planRes.rows[0].price) : 0;
    const r = await pool.query(
      `SELECT * FROM discount_codes WHERE code = $1 AND is_active = true
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses IS NULL OR uses_count < max_uses)`,
      [code.toUpperCase()]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Código no válido o expirado" });
    const dc = r.rows[0];
    const discount = dc.discount_type === "percent"
      ? originalPrice * (parseFloat(dc.discount_value) / 100)
      : parseFloat(dc.discount_value);
    return res.json({
      data: {
        code: dc.code,
        discount_type: dc.discount_type,
        discount_value: parseFloat(dc.discount_value),
        discount_amount: Math.min(discount, originalPrice),
        final_price: Math.max(originalPrice - discount, 0),
      }
    });
  } catch (err) {
    console.error("Discount validate error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/wallet ────────────────────────────────────────────────────

// GET /api/wallet/pass
app.get("/api/wallet/pass", authMiddleware, async (req, res) => {
  try {
    const pointsRes = await pool.query(
      "SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_points WHERE user_id = $1",
      [req.userId]
    );
    const total = parseInt(pointsRes.rows[0].total);
    // QR data: user ID encoded
    const qrData = Buffer.from(req.userId).toString("base64");
    // Simple level system
    let level = "Jade";
    if (total >= 5000) level = "Diamante";
    else if (total >= 2000) level = "Oro";
    else if (total >= 500) level = "Plata";
    return res.json({ data: { points: total, qr_code: qrData, level } });
  } catch (err) {
    console.error("Wallet/pass error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/loyalty ───────────────────────────────────────────────────

// GET /api/loyalty/my-history
app.get("/api/loyalty/my-history", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT lp.*,
              CASE WHEN lp.points > 0 THEN 'earned' ELSE 'redeemed' END AS movement_type
       FROM loyalty_points lp
       WHERE lp.user_id = $1
       ORDER BY lp.created_at DESC
       LIMIT 100`,
      [req.userId]
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("Loyalty/my-history error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/loyalty/rewards
app.get("/api/loyalty/rewards", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM rewards WHERE is_active = true ORDER BY points_cost ASC"
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("Loyalty/rewards error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/loyalty/redeem
app.post("/api/loyalty/redeem", authMiddleware, async (req, res) => {
  const { rewardId } = req.body;
  if (!rewardId) return res.status(400).json({ message: "rewardId requerido" });
  try {
    const rewardRes = await pool.query(
      "SELECT * FROM rewards WHERE id = $1 AND is_active = true",
      [rewardId]
    );
    if (rewardRes.rows.length === 0) return res.status(404).json({ message: "Recompensa no encontrada" });
    const reward = rewardRes.rows[0];
    // Check user points
    const pointsRes = await pool.query(
      "SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_points WHERE user_id = $1",
      [req.userId]
    );
    const total = parseInt(pointsRes.rows[0].total);
    if (total < reward.points_cost) {
      return res.status(400).json({ message: `Necesitas ${reward.points_cost} puntos. Tienes ${total}.` });
    }
    // Deduct points
    await pool.query(
      `INSERT INTO loyalty_points (user_id, points, type, description, related_reward_id)
       VALUES ($1, $2, 'redemption', $3, $4)`,
      [req.userId, -reward.points_cost, `Canje: ${reward.name}`, rewardId]
    );
    // Create redemption record
    await pool.query(
      "INSERT INTO redemptions (user_id, reward_id, points_spent, status) VALUES ($1, $2, $3, 'pending')",
      [req.userId, rewardId, reward.points_cost]
    );
    return res.json({ message: `¡Recompensa canjeada! ${reward.name}` });
  } catch (err) {
    console.error("Loyalty/redeem error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/videos ────────────────────────────────────────────────────

// GET /api/videos/categories
app.get("/api/videos/categories", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ct.id, ct.name, COUNT(v.id) AS video_count
       FROM class_types ct
       JOIN videos v ON v.class_type_id = ct.id AND v.is_published = true
       GROUP BY ct.id, ct.name
       ORDER BY ct.name`
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("Videos/categories error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/videos?search=&category=&limit=
app.get("/api/videos", authMiddleware, async (req, res) => {
  try {
    const { search = "", category = "", limit } = req.query;
    let query = `
      SELECT v.*,
             ct.name AS category_name,
             i.display_name AS instructor_name
      FROM videos v
      LEFT JOIN class_types ct ON v.class_type_id = ct.id
      LEFT JOIN instructors i ON v.instructor_id = i.id
      WHERE v.is_published = true
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (v.title ILIKE $${params.length} OR v.description ILIKE $${params.length})`;
    }
    if (category) {
      params.push(category);
      query += ` AND ct.id = $${params.length}`;
    }
    query += " ORDER BY v.is_featured DESC, v.sort_order ASC, v.created_at DESC";
    if (limit) { params.push(parseInt(limit)); query += ` LIMIT $${params.length}`; }
    const r = await pool.query(query, params);
    // Check membership access
    const memRes = await pool.query(
      "SELECT id FROM memberships WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [req.userId]
    );
    const hasMembership = memRes.rows.length > 0;
    const rows = r.rows.map(v => ({
      ...v,
      has_access: v.access_type === "free" || v.access_type === "gratuito" || hasMembership,
    }));
    return res.json({ data: rows });
  } catch (err) {
    console.error("Videos error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/videos/:id
app.get("/api/videos/:id", authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.*,
              ct.name AS category_name,
              i.display_name AS instructor_name, i.bio AS instructor_bio
       FROM videos v
       LEFT JOIN class_types ct ON v.class_type_id = ct.id
       LEFT JOIN instructors i ON v.instructor_id = i.id
       WHERE v.id = $1 AND v.is_published = true`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Video no encontrado" });
    const video = r.rows[0];
    const memRes = await pool.query(
      "SELECT id FROM memberships WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [req.userId]
    );
    const hasMembership = memRes.rows.length > 0;
    video.has_access = video.access_type === "free" || video.access_type === "gratuito" || hasMembership;
    // Log view
    await pool.query("UPDATE videos SET view_count = view_count + 1 WHERE id = $1", [req.params.id]);
    return res.json({ data: video });
  } catch (err) {
    console.error("Videos/:id error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/videos/:id/view
app.post("/api/videos/:id/view", authMiddleware, async (req, res) => {
  try {
    await pool.query("UPDATE videos SET view_count = view_count + 1 WHERE id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch { return res.json({ ok: true }); }
});

// POST /api/videos/:id/purchase
app.post("/api/videos/:id/purchase", authMiddleware, async (req, res) => {
  try {
    const vRes = await pool.query(
      "SELECT * FROM videos WHERE id = $1 AND is_published = true AND sales_enabled = true",
      [req.params.id]
    );
    if (vRes.rows.length === 0) return res.status(404).json({ message: "Video no disponible para compra" });
    const video = vRes.rows[0];
    const r = await pool.query(
      `INSERT INTO video_purchases (video_id, user_id, status, amount_mxn, payment_method)
       VALUES ($1, $2, 'pending_payment', $3, 'transfer')
       ON CONFLICT (video_id, user_id) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [req.params.id, req.userId, video.sales_price_mxn]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("Video/purchase error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/videos/purchases/:id/proof  (multipart)
app.post("/api/videos/purchases/:id/proof", authMiddleware, upload.single("proof"), async (req, res) => {
  try {
    await pool.query(
      "UPDATE video_purchases SET status = 'pending_verification', proof_uploaded_at = NOW() WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    return res.json({ message: "Comprobante recibido" });
  } catch (err) {
    console.error("Video/purchase proof error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/users ─────────────────────────────────────────────────────

// PUT /api/users/:id
app.put("/api/users/:id", authMiddleware, async (req, res) => {
  // Allow own profile edit OR admin editing any user
  try {
    const selfRes = await pool.query("SELECT role FROM users WHERE id = $1", [req.userId]);
    const callerRole = selfRes.rows[0]?.role || "client";
    const isAdminCaller = ["admin", "super_admin"].includes(callerRole);
    if (req.params.id !== req.userId && !isAdminCaller) {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    const {
      displayName, phone, dateOfBirth,
      emergencyContactName, emergencyContactPhone, healthNotes,
      receiveReminders, receivePromotions, receiveWeeklySummary,
      acceptsCommunications,
      role,
    } = req.body;
    // Non-admins cannot change role
    const newRole = isAdminCaller && role ? role : null;
    const targetId = req.params.id;
    const r = await pool.query(
      `UPDATE users SET
         display_name              = COALESCE($1, display_name),
         phone                     = COALESCE($2, phone),
         date_of_birth             = COALESCE($3, date_of_birth),
         emergency_contact_name    = COALESCE($4, emergency_contact_name),
         emergency_contact_phone   = COALESCE($5, emergency_contact_phone),
         health_notes              = COALESCE($6, health_notes),
         receive_reminders         = COALESCE($7, receive_reminders),
         receive_promotions        = COALESCE($8, receive_promotions),
         receive_weekly_summary    = COALESCE($9, receive_weekly_summary),
         accepts_communications    = COALESCE($10, accepts_communications),
         role                      = COALESCE($11, role),
         updated_at                = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        displayName || null, phone || null, dateOfBirth || null,
        emergencyContactName || null, emergencyContactPhone || null, healthNotes || null,
        receiveReminders ?? null, receivePromotions ?? null, receiveWeeklySummary ?? null,
        acceptsCommunications ?? null,
        newRole,
        targetId,
      ]
    );
    return res.json({ user: mapUser(r.rows[0]) });
  } catch (err) {
    console.error("PUT users/:id error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/referrals ─────────────────────────────────────────────────

// GET /api/referrals/code
app.get("/api/referrals/code", authMiddleware, async (req, res) => {
  try {
    let r = await pool.query(
      "SELECT * FROM referral_codes WHERE user_id = $1 LIMIT 1",
      [req.userId]
    );
    if (r.rows.length === 0) {
      const code = "OPH" + Math.random().toString(36).slice(2, 8).toUpperCase();
      r = await pool.query(
        "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) RETURNING *",
        [req.userId, code]
      );
    }
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("Referrals/code error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/admin/class-types ─────────────────────────────────────────

// GET /api/admin/class-types
app.get("/api/admin/class-types", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM class_types ORDER BY sort_order, name");
    return res.json({ data: camelRows(r.rows) });
  } catch (err) {
    console.error("GET admin/class-types error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/class-types
app.post("/api/admin/class-types", async (req, res) => {
  const { name, subtitle, description, category, intensity, level, duration_min, capacity, color, emoji, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name requerido" });
  try {
    const r = await pool.query(
      `INSERT INTO class_types (name, subtitle, description, category, intensity, level, duration_min, capacity, color, emoji, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name.trim(), subtitle || null, description || null,
       category || "jumping", intensity || "media",
       level || "Todos los niveles", duration_min || 50, capacity || 15,
       color || "#c026d3", emoji || "🏃", sort_order ?? 0]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST admin/class-types error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/class-types/:id
app.put("/api/admin/class-types/:id", async (req, res) => {
  const { name, subtitle, description, category, intensity, level, duration_min, capacity, color, emoji, is_active, sort_order } = req.body;
  try {
    const r = await pool.query(
      `UPDATE class_types SET
         name         = COALESCE($1, name),
         subtitle     = COALESCE($2, subtitle),
         description  = COALESCE($3, description),
         category     = COALESCE($4, category),
         intensity    = COALESCE($5, intensity),
         level        = COALESCE($6, level),
         duration_min = COALESCE($7, duration_min),
         capacity     = COALESCE($8, capacity),
         color        = COALESCE($9, color),
         emoji        = COALESCE($10, emoji),
         is_active    = COALESCE($11, is_active),
         sort_order   = COALESCE($12, sort_order),
         updated_at   = NOW()
       WHERE id = $13 RETURNING *`,
      [name || null, subtitle || null, description || null,
       category || null, intensity || null, level || null,
       duration_min || null, capacity || null, color || null,
       emoji || null, is_active ?? null, sort_order ?? null,
       req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "No encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT admin/class-types error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/class-types/:id
app.delete("/api/admin/class-types/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM class_types WHERE id = $1", [req.params.id]);
    return res.json({ message: "Eliminado" });
  } catch (err) {
    console.error("DELETE admin/class-types error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/admin/schedule-slots ──────────────────────────────────────

// GET /api/admin/schedule-slots
app.get("/api/admin/schedule-slots", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ss.*, ct.color as class_color, ct.emoji as class_emoji
       FROM schedule_slots ss
       LEFT JOIN class_types ct ON ss.class_type_id = ct.id
       WHERE ss.is_active = true
       ORDER BY ss.time_slot, ss.day_of_week`
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("GET admin/schedule-slots error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/schedule-slots
app.post("/api/admin/schedule-slots", async (req, res) => {
  const { time_slot, day_of_week, class_type_id, class_type_name, instructor_name } = req.body;
  if (!time_slot?.trim() || !day_of_week) return res.status(400).json({ message: "time_slot y day_of_week requeridos" });
  try {
    // Resolve name from class_type_id if provided
    let ctName = class_type_name || null;
    if (class_type_id && !ctName) {
      const ct = await pool.query("SELECT name FROM class_types WHERE id = $1", [class_type_id]);
      ctName = ct.rows[0]?.name || null;
    }
    const r = await pool.query(
      `INSERT INTO schedule_slots (time_slot, day_of_week, class_type_id, class_type_name, instructor_name)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ON CONSTRAINT idx_schedule_slots_slot DO UPDATE
         SET class_type_id = EXCLUDED.class_type_id,
             class_type_name = EXCLUDED.class_type_name,
             instructor_name = EXCLUDED.instructor_name
       RETURNING *`,
      [time_slot.trim(), parseInt(day_of_week), class_type_id || null, ctName, instructor_name || null]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST admin/schedule-slots error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/schedule-slots/:id
app.put("/api/admin/schedule-slots/:id", async (req, res) => {
  const { time_slot, day_of_week, class_type_id, class_type_name, instructor_name, is_active } = req.body;
  try {
    let ctName = class_type_name || null;
    if (class_type_id && !ctName) {
      const ct = await pool.query("SELECT name FROM class_types WHERE id = $1", [class_type_id]);
      ctName = ct.rows[0]?.name || null;
    }
    const r = await pool.query(
      `UPDATE schedule_slots SET
         time_slot       = COALESCE($1, time_slot),
         day_of_week     = COALESCE($2, day_of_week),
         class_type_id   = COALESCE($3, class_type_id),
         class_type_name = COALESCE($4, class_type_name),
         instructor_name = COALESCE($5, instructor_name),
         is_active       = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [time_slot || null, day_of_week ? parseInt(day_of_week) : null,
       class_type_id || null, ctName, instructor_name || null, is_active ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "No encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT admin/schedule-slots error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/schedule-slots/:id
app.delete("/api/admin/schedule-slots/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM schedule_slots WHERE id = $1", [req.params.id]);
    return res.json({ message: "Eliminado" });
  } catch (err) {
    console.error("DELETE admin/schedule-slots error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/admin/plans (CRUD) ────────────────────────────────────────

// POST /api/admin/plans
app.post("/api/admin/plans", async (req, res) => {
  const { name, description, price, currency, duration_days, class_limit, features, is_active, sort_order } = req.body;
  if (!name?.trim() || price === undefined) return res.status(400).json({ message: "name y price requeridos" });
  try {
    const r = await pool.query(
      `INSERT INTO plans (name, description, price, currency, duration_days, class_limit, features, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name.trim(), description || null, price, currency || "MXN",
       duration_days || 30, class_limit || null,
       JSON.stringify(features || []), is_active ?? true, sort_order ?? 0]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST admin/plans error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/plans/:id
app.put("/api/admin/plans/:id", async (req, res) => {
  const { name, description, price, currency, duration_days, class_limit, features, is_active, sort_order } = req.body;
  try {
    const r = await pool.query(
      `UPDATE plans SET
         name          = COALESCE($1, name),
         description   = COALESCE($2, description),
         price         = COALESCE($3, price),
         currency      = COALESCE($4, currency),
         duration_days = COALESCE($5, duration_days),
         class_limit   = $6,
         features      = COALESCE($7, features),
         is_active     = COALESCE($8, is_active),
         sort_order    = COALESCE($9, sort_order),
         updated_at    = NOW()
       WHERE id = $10 RETURNING *`,
      [name || null, description || null, price ?? null, currency || null,
       duration_days || null, class_limit ?? null,
       features ? JSON.stringify(features) : null,
       is_active ?? null, sort_order ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "No encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT admin/plans error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/plans/:id
app.delete("/api/admin/plans/:id", async (req, res) => {
  try {
    await pool.query("UPDATE plans SET is_active = false WHERE id = $1", [req.params.id]);
    return res.json({ message: "Plan desactivado" });
  } catch (err) {
    console.error("DELETE admin/plans error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/admin/schedule (schedule_templates) ───────────────────────

// GET /api/admin/schedule
app.get("/api/admin/schedule", async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM schedule_templates ORDER BY time_slot ASC, day_of_week ASC"
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("GET admin/schedule error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/schedule
app.post("/api/admin/schedule", async (req, res) => {
  const { time_slot, day_of_week, class_label, shift } = req.body;
  if (!time_slot || !day_of_week || !class_label) {
    return res.status(400).json({ message: "time_slot, day_of_week y class_label requeridos" });
  }
  try {
    const r = await pool.query(
      `INSERT INTO schedule_templates (time_slot, day_of_week, class_label, shift)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (time_slot, day_of_week) DO UPDATE
         SET class_label = EXCLUDED.class_label, shift = EXCLUDED.shift, updated_at = NOW()
       RETURNING *`,
      [time_slot, Number(day_of_week), class_label.toUpperCase(), shift || "morning"]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST admin/schedule error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/schedule/:id
app.put("/api/admin/schedule/:id", async (req, res) => {
  const { time_slot, day_of_week, class_label, shift, is_active } = req.body;
  try {
    const r = await pool.query(
      `UPDATE schedule_templates SET
         time_slot   = COALESCE($1, time_slot),
         day_of_week = COALESCE($2, day_of_week),
         class_label = COALESCE($3, class_label),
         shift       = COALESCE($4, shift),
         is_active   = COALESCE($5, is_active),
         updated_at  = NOW()
       WHERE id = $6 RETURNING *`,
      [time_slot || null, day_of_week ? Number(day_of_week) : null,
       class_label ? class_label.toUpperCase() : null,
       shift || null, is_active ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "No encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT admin/schedule error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/schedule/:id
app.delete("/api/admin/schedule/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM schedule_templates WHERE id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE admin/schedule error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/packages ──────────────────────────────────────────────────

// GET /api/packages  (público — landing + checkout)
app.get("/api/packages", async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM packages WHERE is_active = true ORDER BY category ASC, sort_order ASC"
    );
    return res.json({ data: r.rows });
  } catch (err) {
    console.error("GET packages error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/packages
app.post("/api/admin/packages", async (req, res) => {
  const { name, num_classes, price, category, validity_days, sort_order } = req.body;
  if (!name?.trim() || !num_classes || price === undefined || !category) {
    return res.status(400).json({ message: "name, num_classes, price y category requeridos" });
  }
  try {
    const r = await pool.query(
      `INSERT INTO packages (name, num_classes, price, category, validity_days, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), num_classes, Number(price), category, validity_days || 30, sort_order || 0]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST admin/packages error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/packages/:id
app.put("/api/admin/packages/:id", async (req, res) => {
  const { name, num_classes, price, category, validity_days, is_active, sort_order } = req.body;
  try {
    const r = await pool.query(
      `UPDATE packages SET
         name          = COALESCE($1, name),
         num_classes   = COALESCE($2, num_classes),
         price         = COALESCE($3, price),
         category      = COALESCE($4, category),
         validity_days = COALESCE($5, validity_days),
         is_active     = COALESCE($6, is_active),
         sort_order    = COALESCE($7, sort_order),
         updated_at    = NOW()
       WHERE id = $8 RETURNING *`,
      [name || null, num_classes || null,
       price !== undefined ? Number(price) : null,
       category || null, validity_days ?? null,
       is_active ?? null, sort_order ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "No encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT admin/packages error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/packages/:id
app.delete("/api/admin/packages/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM packages WHERE id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE admin/packages error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/admin (protected admin routes) ────────────────────────────

// GET /api/users/:id — get single user (admin)
app.get("/api/users/:id", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ message: "Usuario no encontrado" });
    return res.json({ data: mapUser(r.rows[0]) });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/class-types — public alias for admin/class-types
app.get("/api/class-types", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM class_types WHERE is_active = true ORDER BY sort_order ASC");
    return res.json({ data: camelRows(r.rows) });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/class-types — alias CRUD (admin)
app.post("/api/class-types", adminMiddleware, async (req, res) => {
  const { name, color, defaultDuration, maxCapacity, isActive } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name requerido" });
  try {
    const r = await pool.query(
      `INSERT INTO class_types (name, color, duration_min, capacity, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,0) RETURNING *`,
      [name.trim(), color || "#c026d3", defaultDuration || 60, maxCapacity || 20, isActive !== false]
    );
    return res.status(201).json({ data: camelRow(r.rows[0]) });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// PUT /api/class-types/:id — alias CRUD (admin)
app.put("/api/class-types/:id", adminMiddleware, async (req, res) => {
  const { name, color, defaultDuration, maxCapacity, isActive } = req.body;
  try {
    const r = await pool.query(
      `UPDATE class_types SET name=COALESCE($1,name), color=COALESCE($2,color),
       duration_min=COALESCE($3,duration_min), capacity=COALESCE($4,capacity),
       is_active=COALESCE($5,is_active), updated_at=NOW() WHERE id=$6 RETURNING *`,
      [name || null, color || null, defaultDuration || null, maxCapacity || null, isActive ?? null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "No encontrado" });
    return res.json({ data: camelRow(r.rows[0]) });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// DELETE /api/class-types/:id — alias CRUD (admin)
app.delete("/api/class-types/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM class_types WHERE id = $1", [req.params.id]);
    return res.json({ message: "Eliminado" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/classes — admin creates a class (alias)
app.post("/api/classes", adminMiddleware, async (req, res) => {
  try {
    const { classTypeId, instructorId, startTime, endTime, capacity = 10, location, notes } = req.body;
    if (!classTypeId) return res.status(400).json({ message: "classTypeId requerido" });
    const r = await pool.query(
      `INSERT INTO classes (class_type_id, instructor_id, start_time, end_time, capacity, location, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled') RETURNING *`,
      [classTypeId, instructorId || null, startTime, endTime || null, capacity, location || null, notes || null]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// PUT /api/classes/:id/cancel
app.put("/api/classes/:id/cancel", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("UPDATE classes SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ message: "Clase no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/classes/generate — bulk generate
app.post("/api/classes/generate", adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, classTypeId, instructorId, daysOfWeek, startTime, endTime, maxCapacity = 10 } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: "startDate y endDate requeridos" });

    const created = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // If classTypeId + daysOfWeek provided → generate from form data
    if (classTypeId && Array.isArray(daysOfWeek) && daysOfWeek.length && startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay(); // 0=Sun,1=Mon...
        if (!daysOfWeek.includes(jsDay)) continue;
        const classStart = new Date(d); classStart.setHours(sh, sm, 0, 0);
        const classEnd = new Date(d); classEnd.setHours(eh, em, 0, 0);
        const exists = await pool.query("SELECT id FROM classes WHERE start_time=$1 AND class_type_id=$2", [classStart.toISOString(), classTypeId]);
        if (exists.rows.length) continue;
        const r = await pool.query(
          "INSERT INTO classes (class_type_id, instructor_id, start_time, end_time, capacity, status) VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING *",
          [classTypeId, instructorId || null, classStart.toISOString(), classEnd.toISOString(), maxCapacity]
        );
        created.push(r.rows[0]);
      }
      return res.json({ created: created.length, data: created });
    }

    // Fallback: generate from schedule_templates
    const slotsRes = await pool.query("SELECT * FROM schedule_templates WHERE is_active = true");
    const classTypeRes = await pool.query("SELECT id, name, category FROM class_types WHERE is_active = true");
    const classTypes = classTypeRes.rows;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
      const daySlots = slotsRes.rows.filter(s => s.day_of_week === dayOfWeek);
      for (const slot of daySlots) {
        const timeStr = slot.time_slot.toLowerCase();
        const isPM = timeStr.includes("pm");
        const cleanTime = timeStr.replace(/[apm\s]/g, "");
        const [h, m = 0] = cleanTime.split(":").map(Number);
        const hour = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
        const classDate = new Date(d); classDate.setHours(hour, m, 0, 0);
        const endDate2 = new Date(classDate); endDate2.setMinutes(endDate2.getMinutes() + 55);
        const label = slot.class_label?.toLowerCase();
        let ct = classTypes.find(c => c.category?.toLowerCase() === label || c.name?.toLowerCase().includes(label));
        if (!ct) ct = classTypes[0];
        if (!ct) continue;
        const exists = await pool.query("SELECT id FROM classes WHERE start_time=$1 AND class_type_id=$2", [classDate.toISOString(), ct.id]);
        if (exists.rows.length) continue;
        const r = await pool.query(
          "INSERT INTO classes (class_type_id, instructor_id, start_time, end_time, capacity, status) VALUES ($1,$2,$3,$4,10,'scheduled') RETURNING *",
          [ct.id, instructorId || null, classDate.toISOString(), endDate2.toISOString()]
        );
        created.push(r.rows[0]);
      }
    }
    return res.json({ created: created.length, data: created });
  } catch (err) { console.error("generate classes error:", err); return res.status(500).json({ message: "Error interno" }); }
});

// ─── Schedules (schedule_slots) CRUD ────────────────────────────────────────

// GET /api/schedules
app.get("/api/schedules", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM schedule_slots ORDER BY day_of_week, time_slot");
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/schedules
app.post("/api/schedules", adminMiddleware, async (req, res) => {
  try {
    const { timeSlot, dayOfWeek, classTypeName, classTypeId, instructorName, isActive = true } = req.body;
    if (!timeSlot || !dayOfWeek) return res.status(400).json({ message: "timeSlot y dayOfWeek requeridos" });
    const r = await pool.query(
      `INSERT INTO schedule_slots (time_slot, day_of_week, class_type_id, class_type_name, instructor_name, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [timeSlot, dayOfWeek, classTypeId || null, classTypeName || null, instructorName || null, isActive]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// PUT /api/schedules/:id
app.put("/api/schedules/:id", adminMiddleware, async (req, res) => {
  try {
    const { timeSlot, dayOfWeek, classTypeName, classTypeId, instructorName, isActive } = req.body;
    const r = await pool.query(
      `UPDATE schedule_slots SET time_slot=$1, day_of_week=$2, class_type_id=$3, class_type_name=$4, instructor_name=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [timeSlot, dayOfWeek, classTypeId || null, classTypeName || null, instructorName || null, isActive !== false, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Slot no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// DELETE /api/schedules/:id
app.delete("/api/schedules/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM schedule_slots WHERE id = $1", [req.params.id]);
    return res.json({ message: "Slot eliminado" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Orders verify/reject ────────────────────────────────────────────────────

// PUT /api/orders/:id/verify
app.put("/api/orders/:id/verify", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE orders SET status='verified', verified_at=NOW(), verified_by=$1 WHERE id=$2 RETURNING *",
      [req.userId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Orden no encontrada" });
    const order = r.rows[0];
    if (order.plan_id) {
      const planRes = await pool.query("SELECT * FROM plans WHERE id = $1", [order.plan_id]);
      if (planRes.rows.length) {
        const plan = planRes.rows[0];
        const end = new Date(); end.setDate(end.getDate() + (plan.duration_days || 30));
        await pool.query(
          `INSERT INTO memberships (user_id, plan_id, status, payment_method, start_date, end_date, classes_remaining, order_id)
           VALUES ($1,$2,'active',$3,NOW(),$4,$5,$6)
           ON CONFLICT (order_id) DO UPDATE SET status='active'`,
          [order.user_id, order.plan_id, order.payment_method || "transfer", end.toISOString(), plan.class_limit ?? 9999, order.id]
        ).catch(() => {}); // ignore if order_id unique constraint not in place
      }
    }
    return res.json({ data: order });
  } catch (err) { console.error("orders/:id/verify error:", err); return res.status(500).json({ message: "Error interno" }); }
});

// PUT /api/orders/:id/reject
app.put("/api/orders/:id/reject", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("UPDATE orders SET status='rejected', verified_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ message: "Orden no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/pos/checkout — alias for /pos/sale
app.post("/api/pos/checkout", adminMiddleware, async (req, res) => {
  req.url = "/api/pos/sale";
  const { userId, items, paymentMethod = "efectivo", discountCode } = req.body;
  try {
    if (!items?.length) return res.status(400).json({ message: "Se requieren artículos" });
    let subtotal = 0; let discountAmount = 0;
    for (const item of items) {
      const pRes = await pool.query("SELECT * FROM products WHERE id = $1", [item.productId]);
      if (!pRes.rows.length) return res.status(404).json({ message: `Producto ${item.productId} no encontrado` });
      subtotal += parseFloat(pRes.rows[0].price) * item.qty;
    }
    if (discountCode) {
      const dcRes = await pool.query("SELECT * FROM discount_codes WHERE code=$1 AND is_active=true", [discountCode.toUpperCase()]);
      if (dcRes.rows.length) {
        const dc = dcRes.rows[0];
        discountAmount = dc.discount_type === "percentage" || dc.discount_type === "percent"
          ? subtotal * (parseFloat(dc.discount_value) / 100)
          : parseFloat(dc.discount_value);
      }
    }
    const total = Math.max(0, subtotal - discountAmount);
    const orderRes = await pool.query(
      "INSERT INTO orders (user_id, amount, payment_method, status, discount_amount, channel) VALUES ($1,$2,$3,'verified',$4,'pos') RETURNING *",
      [userId || null, total, paymentMethod, discountAmount]
    );
    const order = orderRes.rows[0];
    for (const item of items) {
      const pRes = await pool.query("SELECT price FROM products WHERE id=$1", [item.productId]);
      await pool.query("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)", [order.id, item.productId, item.qty, pRes.rows[0].price]);
      await pool.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.qty, item.productId]);
    }
    return res.status(201).json({ data: order });
  } catch (err) { console.error("pos/checkout error:", err); return res.status(500).json({ message: "Error interno" }); }
});

// ─── Loyalty config & rewards admin ─────────────────────────────────────────

// GET/PUT /api/loyalty/config
app.get("/api/loyalty/config", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key='loyalty_config' LIMIT 1");
    const defaults = { pointsPerClass: 10, pointsPerReferral: 200, pointsPerReview: 50, expirationDays: 365 };
    return res.json({ data: r.rows.length ? r.rows[0].value : defaults });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/loyalty/config", adminMiddleware, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('loyalty_config', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(req.body)]
    );
    return res.json({ data: req.body });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/loyalty/rewards — admin CRUD for loyalty rewards
app.post("/api/loyalty/rewards", adminMiddleware, async (req, res) => {
  try {
    const { name, description, pointsCost, isActive = true } = req.body;
    if (!name || !pointsCost) return res.status(400).json({ message: "name y pointsCost requeridos" });
    const r = await pool.query(
      "INSERT INTO loyalty_rewards (name, description, points_cost, is_active) VALUES ($1,$2,$3,$4) RETURNING *",
      [name, description || null, pointsCost, isActive]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/loyalty/rewards/:id", adminMiddleware, async (req, res) => {
  try {
    const { name, description, pointsCost, isActive } = req.body;
    const r = await pool.query(
      "UPDATE loyalty_rewards SET name=$1, description=$2, points_cost=$3, is_active=$4 WHERE id=$5 RETURNING *",
      [name, description || null, pointsCost, isActive !== false, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Recompensa no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.delete("/api/loyalty/rewards/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM loyalty_rewards WHERE id=$1", [req.params.id]);
    return res.json({ message: "Recompensa eliminada" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/loyalty/points/:userId
app.get("/api/loyalty/points/:userId", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT COALESCE(SUM(CASE WHEN type='earn' OR type='adjust' THEN points ELSE -points END),0) AS balance FROM loyalty_transactions WHERE user_id=$1",
      [req.params.userId]
    );
    return res.json({ data: { balance: parseInt(r.rows[0].balance) } });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Reports sub-routes ──────────────────────────────────────────────────────

app.get("/api/reports/overview", adminMiddleware, async (req, res) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const [members, revenue, bookings, classes] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM memberships WHERE status='active'"),
      pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM orders WHERE status='verified' AND created_at>=$1", [monthStart]),
      pool.query("SELECT COUNT(*) FROM bookings WHERE created_at>=$1", [monthStart]),
      pool.query("SELECT COUNT(*) FROM classes WHERE status='scheduled' AND start_time>=$1", [monthStart]),
    ]);
    return res.json({ data: {
      activeMembers: parseInt(members.rows[0].count),
      monthlyRevenue: parseFloat(revenue.rows[0].total),
      monthlyBookings: parseInt(bookings.rows[0].count),
      upcomingClasses: parseInt(classes.rows[0].count),
    }});
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.get("/api/reports/revenue", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS total, COUNT(*) AS count
       FROM orders WHERE status='verified'
       GROUP BY month ORDER BY month DESC LIMIT 12`
    );
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.get("/api/reports/classes", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ct.name, COUNT(b.id) AS bookings, COUNT(CASE WHEN b.status='checked_in' THEN 1 END) AS attended
       FROM classes c
       JOIN class_types ct ON c.class_type_id=ct.id
       LEFT JOIN bookings b ON b.class_id=c.id
       GROUP BY ct.name ORDER BY bookings DESC LIMIT 10`
    );
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.get("/api/reports/retention", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS new_this_month
       FROM users WHERE role='client'`
    );
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.get("/api/reports/instructors", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT i.display_name, COUNT(c.id) AS classes_taught, COUNT(b.id) AS total_students
       FROM instructors i
       LEFT JOIN classes c ON c.instructor_id=i.id
       LEFT JOIN bookings b ON b.class_id=c.id
       GROUP BY i.id, i.display_name ORDER BY classes_taught DESC`
    );
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Reviews public endpoints & admin ───────────────────────────────────────

// GET /api/reviews (public, approved only; admin sees all via /api/admin/reviews)
app.get("/api/reviews", async (req, res) => {
  try {
    const { limit = 50, approved } = req.query;
    let q = `SELECT rv.*, u.display_name AS user_name FROM reviews rv LEFT JOIN users u ON rv.user_id=u.id WHERE 1=1`;
    const params = [];
    if (approved !== "false") { q += ` AND rv.is_approved=true`; }
    params.push(parseInt(limit)); q += ` ORDER BY rv.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/reviews/stats
app.get("/api/reviews/stats", async (req, res) => {
  try {
    const r = await pool.query("SELECT AVG(rating) AS average, COUNT(*) AS total FROM reviews WHERE is_approved=true");
    const dist = await pool.query("SELECT rating, COUNT(*) FROM reviews WHERE is_approved=true GROUP BY rating ORDER BY rating DESC");
    return res.json({ data: { average: parseFloat(r.rows[0].average || 0).toFixed(1), total: parseInt(r.rows[0].total), distribution: dist.rows } });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// Review tags (admin)
app.get("/api/review-tags", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM review_tags ORDER BY name").catch(() => ({ rows: [] }));
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.post("/api/review-tags", adminMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    const r = await pool.query(
      "INSERT INTO review_tags (name, color) VALUES ($1,$2) RETURNING *",
      [name, color || "#c026d3"]
    ).catch(() => ({ rows: [{ id: "1", name, color }] }));
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/review-tags/:id", adminMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    const r = await pool.query(
      "UPDATE review_tags SET name=$1, color=$2 WHERE id=$3 RETURNING *",
      [name, color || "#c026d3", req.params.id]
    ).catch(() => ({ rows: [{ id: req.params.id, name, color }] }));
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.delete("/api/review-tags/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM review_tags WHERE id=$1", [req.params.id]).catch(() => {});
    return res.json({ message: "Tag eliminado" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Referrals admin ─────────────────────────────────────────────────────────

// GET /api/referrals/codes — all codes (admin)
app.get("/api/referrals/codes", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT rc.*, u.display_name AS user_name, u.email, rc.uses_count
       FROM referral_codes rc LEFT JOIN users u ON rc.user_id=u.id
       ORDER BY rc.uses_count DESC`
    );
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/referrals — referral history
app.get("/api/referrals", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.*, rc.code, u.display_name AS referred_name
       FROM referrals r
       JOIN referral_codes rc ON r.referral_code_id=rc.id
       LEFT JOIN users u ON r.referred_user_id=u.id
       ORDER BY r.created_at DESC LIMIT 100`
    );
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/referrals/stats
app.get("/api/referrals/stats", adminMiddleware, async (req, res) => {
  try {
    const [total, rewarded] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM referrals"),
      pool.query("SELECT COUNT(*) FROM referrals WHERE rewarded=true"),
    ]);
    return res.json({ data: { total: parseInt(total.rows[0].count), rewarded: parseInt(rewarded.rows[0].count) } });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Settings ────────────────────────────────────────────────────────────────

app.get("/api/settings/:key", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key=$1", [req.params.key]);
    return res.json({ data: r.rows.length ? r.rows[0].value : null });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/settings/:key", adminMiddleware, async (req, res) => {
  try {
    const { value } = req.body;
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()",
      [req.params.key, JSON.stringify(value)]
    );
    return res.json({ data: { key: req.params.key, value } });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Evolution (WhatsApp) stubs ───────────────────────────────────────────────

app.get("/api/evolution/status", adminMiddleware, async (req, res) => {
  return res.json({ data: { connected: false, status: "not_configured" } });
});

app.post("/api/evolution/connect", adminMiddleware, async (req, res) => {
  return res.json({ data: { message: "Integración WhatsApp no configurada" } });
});

app.post("/api/evolution/disconnect", adminMiddleware, async (req, res) => {
  return res.json({ data: { message: "Desconectado" } });
});

app.post("/api/evolution/send-test", adminMiddleware, async (req, res) => {
  return res.json({ data: { message: "Función no disponible aún" } });
});

// ─── Videos purchases approve/reject ────────────────────────────────────────

app.post("/api/videos/purchases/:id/approve", adminMiddleware, async (req, res) => {
  try {
    const { admin_notes } = req.body;
    const r = await pool.query(
      "UPDATE video_purchases SET status='active', admin_notes=$1, verified_at=NOW() WHERE id=$2 RETURNING *",
      [admin_notes || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Compra no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.post("/api/videos/purchases/:id/reject", adminMiddleware, async (req, res) => {
  try {
    const { admin_notes } = req.body;
    const r = await pool.query(
      "UPDATE video_purchases SET status='rejected', admin_notes=$1, verified_at=NOW() WHERE id=$2 RETURNING *",
      [admin_notes || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Compra no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// Admin Videos — also available at /api/videos (CRUD) for admin use
app.post("/api/videos", adminMiddleware, async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnailUrl, classTypeId, instructorId, durationMinutes, accessType = "membership", isPublished = false, isFeatured = false, sortOrder = 0, price } = req.body;
    if (!title || !videoUrl) return res.status(400).json({ message: "title y videoUrl requeridos" });
    const r = await pool.query(
      `INSERT INTO videos (title, description, video_url, thumbnail_url, class_type_id, instructor_id, duration_minutes, access_type, is_published, is_featured, sort_order, price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [title, description || null, videoUrl, thumbnailUrl || null, classTypeId || null, instructorId || null, durationMinutes || null, accessType, isPublished, isFeatured, sortOrder, price || null]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/videos/:id", adminMiddleware, async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnailUrl, classTypeId, instructorId, durationMinutes, accessType, isPublished, isFeatured, sortOrder, price } = req.body;
    const r = await pool.query(
      `UPDATE videos SET title=$1, description=$2, video_url=$3, thumbnail_url=$4, class_type_id=$5,
       instructor_id=$6, duration_minutes=$7, access_type=$8, is_published=$9, is_featured=$10,
       sort_order=$11, price=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [title, description || null, videoUrl, thumbnailUrl || null, classTypeId || null, instructorId || null, durationMinutes || null, accessType || "membership", isPublished !== false, isFeatured === true, sortOrder || 0, price || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Video no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.delete("/api/videos/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM videos WHERE id=$1", [req.params.id]);
    return res.json({ message: "Video eliminado" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/admin/stats
app.get("/api/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const [classesToday, activeMembers, monthlyRevenue, pendingAlerts] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM classes WHERE DATE(start_time) = $1", [today]),
      pool.query("SELECT COUNT(*) FROM memberships WHERE status = 'active'"),
      pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM orders WHERE status = 'verified' AND created_at >= $1", [monthStart]),
      pool.query("SELECT COUNT(*) FROM orders WHERE status = 'pending_verification'"),
    ]);

    return res.json({
      classesToday: parseInt(classesToday.rows[0].count),
      activeMembers: parseInt(activeMembers.rows[0].count),
      monthlyRevenue: parseFloat(monthlyRevenue.rows[0].total),
      pendingAlerts: parseInt(pendingAlerts.rows[0].count),
    });
  } catch (err) {
    console.error("admin/stats error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/users?role=&search=
app.get("/api/users", adminMiddleware, async (req, res) => {
  try {
    const { role, search = "" } = req.query;
    let q = `SELECT id, display_name, email, phone, role, created_at FROM users WHERE 1=1`;
    const params = [];
    if (role) { params.push(role); q += ` AND role = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (display_name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    q += " ORDER BY created_at DESC LIMIT 100";
    const r = await pool.query(q, params);
    return res.json({ data: camelRows(r.rows) });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/users — admin creates a client
app.post("/api/users", adminMiddleware, async (req, res) => {
  try {
    const { email, displayName, phone, role = "client", dateOfBirth, emergencyContactName, emergencyContactPhone, healthNotes } = req.body;
    if (!email || !displayName) return res.status(400).json({ message: "Email y nombre requeridos" });
    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length) return res.status(409).json({ message: "Email ya registrado" });
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.default.hash(tempPassword, 10);
    const r = await pool.query(
      `INSERT INTO users (display_name, email, phone, role, password_hash, date_of_birth, emergency_contact_name, emergency_contact_phone, health_notes, accepts_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
      [displayName, email, phone || null, role, hash, dateOfBirth || null, emergencyContactName || null, emergencyContactPhone || null, healthNotes || null]
    );
    return res.status(201).json({ user: mapUser(r.rows[0]), tempPassword });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/users/:id
app.delete("/api/users/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    return res.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error("DELETE /api/users/:id error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Memberships admin CRUD ──────────────────────────────────────────────────

// GET /api/memberships — admin list all
app.get("/api/memberships", adminMiddleware, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let q = `SELECT m.*, u.display_name AS user_name, p.name AS plan_name
             FROM memberships m
             LEFT JOIN users u ON m.user_id = u.id
             LEFT JOIN plans p ON m.plan_id = p.id
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND m.status = $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    return res.json({ data: r.rows.map(m => ({ ...m, userName: m.user_name, planName: m.plan_name })) });
  } catch (err) {
    console.error("GET /memberships error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/memberships — admin assigns membership to a user
app.post("/api/memberships", adminMiddleware, async (req, res) => {
  try {
    const { userId, planId, paymentMethod = "efectivo", startDate } = req.body;
    if (!userId || !planId) return res.status(400).json({ message: "userId y planId requeridos" });
    const planRes = await pool.query("SELECT * FROM plans WHERE id = $1", [planId]);
    if (!planRes.rows.length) return res.status(404).json({ message: "Plan no encontrado" });
    const plan = planRes.rows[0];
    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + (plan.duration_days || 30));
    const r = await pool.query(
      `INSERT INTO memberships (user_id, plan_id, status, payment_method, start_date, end_date, classes_remaining)
       VALUES ($1,$2,'active',$3,$4,$5,$6) RETURNING *`,
      [userId, planId, paymentMethod, start.toISOString(), end.toISOString(), plan.class_limit ?? 9999]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST /memberships error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/memberships/:id/activate
app.put("/api/memberships/:id/activate", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE memberships SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Membresía no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/memberships/:id/cancel
app.put("/api/memberships/:id/cancel", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE memberships SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Membresía no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/memberships/:id — update any field
app.put("/api/memberships/:id", adminMiddleware, async (req, res) => {
  try {
    const { status, classesRemaining, endDate, paymentMethod } = req.body;
    const r = await pool.query(
      `UPDATE memberships SET
         status = COALESCE($1, status),
         classes_remaining = COALESCE($2, classes_remaining),
         end_date = COALESCE($3, end_date),
         payment_method = COALESCE($4, payment_method),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status || null, classesRemaining ?? null, endDate || null, paymentMethod || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Membresía no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Plans admin CRUD ────────────────────────────────────────────────────────

// GET /api/plans — public
// (Already exists above as GET /api/plans)

// POST /api/plans — admin (mirror of /api/admin/plans)
// PUT /api/plans/:id
app.put("/api/plans/:id", adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, currency, durationDays, classLimit, features, isActive, sortOrder } = req.body;
    const r = await pool.query(
      `UPDATE plans SET name=$1, description=$2, price=$3, currency=$4, duration_days=$5,
       class_limit=$6, features=$7, is_active=$8, sort_order=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, description || null, price, currency || "MXN", durationDays || 30, classLimit ?? null, features || null, isActive !== false, sortOrder || 0, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Plan no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/plans/:id
app.delete("/api/plans/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM plans WHERE id = $1", [req.params.id]);
    return res.json({ message: "Plan eliminado" });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/plans
app.post("/api/plans", adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, currency = "MXN", durationDays = 30, classLimit, features, isActive = true, sortOrder = 0 } = req.body;
    if (!name) return res.status(400).json({ message: "Nombre requerido" });
    const r = await pool.query(
      `INSERT INTO plans (name, description, price, currency, duration_days, class_limit, features, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, description || null, price || 0, currency, durationDays, classLimit ?? null, features || null, isActive, sortOrder]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Bookings admin ──────────────────────────────────────────────────────────

// GET /api/bookings — admin sees all
app.get("/api/bookings", adminMiddleware, async (req, res) => {
  try {
    const { status, classId, limit = 100 } = req.query;
    let q = `SELECT b.*, u.display_name AS user_name, c.start_time, ct.name AS class_name
             FROM bookings b
             LEFT JOIN users u ON b.user_id = u.id
             LEFT JOIN classes c ON b.class_id = c.id
             LEFT JOIN class_types ct ON c.class_type_id = ct.id
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND b.status = $${params.length}`; }
    if (classId) { params.push(classId); q += ` AND b.class_id = $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY b.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    return res.json({ data: r.rows.map(b => ({ ...b, userName: b.user_name, className: b.class_name, startTime: b.start_time })) });
  } catch (err) {
    console.error("GET /bookings error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/bookings/:id/check-in
app.put("/api/bookings/:id/check-in", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE bookings SET status = 'checked_in', checked_in_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Reserva no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/orders/pending
app.get("/api/orders/pending", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT o.*, u.display_name AS user_name
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       WHERE o.status = 'pending_verification'
       ORDER BY o.created_at DESC LIMIT 20`
    );
    return res.json({ data: r.rows.map(o => ({ ...o, userName: o.user_name })) });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/admin/orders — all orders
app.get("/api/admin/orders", adminMiddleware, async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    let q = `SELECT o.*, u.display_name AS user_name
             FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND o.status = $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY o.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    return res.json({ data: r.rows.map(o => ({ ...o, userName: o.user_name })) });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/orders/:id/verify
app.put("/api/admin/orders/:id/verify", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE orders SET status = 'verified', verified_at = NOW(), verified_by = $1 WHERE id = $2 RETURNING *",
      [req.userId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Orden no encontrada" });
    // Activate membership if this order is for a plan
    const order = r.rows[0];
    if (order.plan_id) {
      const planRes = await pool.query("SELECT * FROM plans WHERE id = $1", [order.plan_id]);
      if (planRes.rows.length) {
        const plan = planRes.rows[0];
        const end = new Date();
        end.setDate(end.getDate() + (plan.duration_days || 30));
        await pool.query(
          `INSERT INTO memberships (user_id, plan_id, status, payment_method, start_date, end_date, classes_remaining, order_id)
           VALUES ($1,$2,'active',$3,NOW(),$4,$5,$6)
           ON CONFLICT (order_id) DO UPDATE SET status='active'`,
          [order.user_id, order.plan_id, order.payment_method || "transfer", end.toISOString(), plan.class_limit ?? 9999, order.id]
        );
      }
    }
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT /admin/orders/:id/verify error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/orders/:id/reject
app.put("/api/admin/orders/:id/reject", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE orders SET status = 'rejected', verified_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Orden no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Payments admin ──────────────────────────────────────────────────────────

// GET /api/payments
app.get("/api/payments", adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    let q = `SELECT o.*, u.display_name AS user_name, p.name AS plan_name
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN plans p ON o.plan_id = p.id
             WHERE o.status = 'verified'`;
    const params = [];
    if (startDate) { params.push(startDate); q += ` AND o.created_at >= $${params.length}`; }
    if (endDate) { params.push(endDate); q += ` AND o.created_at <= $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY o.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    const total = r.rows.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
    return res.json({ data: r.rows.map(o => ({ ...o, userName: o.user_name, planName: o.plan_name })), total });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Discount codes admin CRUD ───────────────────────────────────────────────

// GET /api/discount-codes
app.get("/api/discount-codes", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM discount_codes ORDER BY created_at DESC");
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/discount-codes
app.post("/api/discount-codes", adminMiddleware, async (req, res) => {
  try {
    const { code, discountType = "percentage", discountValue, maxUses, expiresAt, minOrderAmount = 0, isActive = true } = req.body;
    if (!code || !discountValue) return res.status(400).json({ message: "Código y valor requeridos" });
    const r = await pool.query(
      `INSERT INTO discount_codes (code, discount_type, discount_value, max_uses, expires_at, min_order_amount, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code.toUpperCase(), discountType, discountValue, maxUses || null, expiresAt || null, minOrderAmount, isActive]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Código ya existe" });
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/discount-codes/:id
app.put("/api/discount-codes/:id", adminMiddleware, async (req, res) => {
  try {
    const { code, discountType, discountValue, maxUses, expiresAt, minOrderAmount, isActive } = req.body;
    const r = await pool.query(
      `UPDATE discount_codes SET code=$1, discount_type=$2, discount_value=$3, max_uses=$4,
       expires_at=$5, min_order_amount=$6, is_active=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [code?.toUpperCase(), discountType, discountValue, maxUses || null, expiresAt || null, minOrderAmount || 0, isActive !== false, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Código no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/discount-codes/:id
app.delete("/api/discount-codes/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM discount_codes WHERE id = $1", [req.params.id]);
    return res.json({ message: "Código eliminado" });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Products CRUD (POS) ─────────────────────────────────────────────────────

// GET /api/products
app.get("/api/products", adminMiddleware, async (req, res) => {
  try {
    const { search = "" } = req.query;
    let q = "SELECT * FROM products WHERE 1=1";
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` AND name ILIKE $${params.length}`; }
    q += " ORDER BY created_at DESC";
    const r = await pool.query(q, params);
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/products
app.post("/api/products", adminMiddleware, async (req, res) => {
  try {
    const { name, price, category, stock = 0, sku, isActive = true } = req.body;
    if (!name) return res.status(400).json({ message: "Nombre requerido" });
    const r = await pool.query(
      "INSERT INTO products (name, price, category, stock, sku, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, price || 0, category || "accesorios", stock, sku || null, isActive]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/products/:id
app.put("/api/products/:id", adminMiddleware, async (req, res) => {
  try {
    const { name, price, category, stock, sku, isActive } = req.body;
    const r = await pool.query(
      "UPDATE products SET name=$1, price=$2, category=$3, stock=$4, sku=$5, is_active=$6, updated_at=NOW() WHERE id=$7 RETURNING *",
      [name, price, category, stock, sku || null, isActive !== false, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Producto no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/products/:id
app.delete("/api/products/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    return res.json({ message: "Producto eliminado" });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/pos/sale — POS transaction
app.post("/api/pos/sale", adminMiddleware, async (req, res) => {
  try {
    const { userId, items, paymentMethod = "efectivo", discountCode } = req.body;
    if (!items?.length) return res.status(400).json({ message: "Se requieren artículos" });
    let subtotal = 0;
    let discountAmount = 0;
    // Validate items & compute subtotal
    for (const item of items) {
      const pRes = await pool.query("SELECT * FROM products WHERE id = $1", [item.productId]);
      if (!pRes.rows.length) return res.status(404).json({ message: `Producto ${item.productId} no encontrado` });
      const product = pRes.rows[0];
      if (product.stock < item.qty) return res.status(400).json({ message: `Stock insuficiente para ${product.name}` });
      subtotal += parseFloat(product.price) * item.qty;
    }
    // Apply discount code
    if (discountCode) {
      const dcRes = await pool.query("SELECT * FROM discount_codes WHERE code = $1 AND is_active = true", [discountCode.toUpperCase()]);
      if (dcRes.rows.length) {
        const dc = dcRes.rows[0];
        if (dc.discount_type === "percentage") discountAmount = subtotal * (parseFloat(dc.discount_value) / 100);
        else discountAmount = parseFloat(dc.discount_value);
      }
    }
    const total = Math.max(0, subtotal - discountAmount);
    // Create order
    const orderRes = await pool.query(
      "INSERT INTO orders (user_id, amount, payment_method, status, discount_amount, channel) VALUES ($1,$2,$3,'verified',$4,'pos') RETURNING *",
      [userId || null, total, paymentMethod, discountAmount]
    );
    const order = orderRes.rows[0];
    // Create order items & update stock
    for (const item of items) {
      const pRes = await pool.query("SELECT * FROM products WHERE id = $1", [item.productId]);
      const product = pRes.rows[0];
      await pool.query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)",
        [order.id, item.productId, item.qty, product.price]
      );
      await pool.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.qty, item.productId]);
    }
    return res.status(201).json({ data: order });
  } catch (err) {
    console.error("POST /pos/sale error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Loyalty admin ───────────────────────────────────────────────────────────

// GET /api/admin/loyalty/users — list users with points
app.get("/api/admin/loyalty/users", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.display_name, u.email,
              COALESCE(SUM(CASE WHEN lt.type='earn' THEN lt.points ELSE -lt.points END), 0) AS balance
       FROM users u
       LEFT JOIN loyalty_transactions lt ON lt.user_id = u.id
       WHERE u.role = 'client'
       GROUP BY u.id ORDER BY balance DESC LIMIT 50`
    );
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/loyalty/adjust — manual points adjustment
app.post("/api/admin/loyalty/adjust", adminMiddleware, async (req, res) => {
  try {
    const { userId, points, reason, type = "earn" } = req.body;
    if (!userId || !points) return res.status(400).json({ message: "userId y points requeridos" });
    const r = await pool.query(
      "INSERT INTO loyalty_transactions (user_id, type, points, description, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [userId, type, Math.abs(points), reason || "Ajuste manual", req.userId]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Instructors / Staff ─────────────────────────────────────────────────────

// GET /api/instructors
app.get("/api/instructors", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM instructors ORDER BY created_at DESC");
    return res.json({ data: camelRows(r.rows) });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/instructors
app.post("/api/instructors", adminMiddleware, async (req, res) => {
  try {
    const { displayName, email, phone, bio, specialties, isActive = true } = req.body;
    if (!displayName) return res.status(400).json({ message: "Nombre requerido" });
    const r = await pool.query(
      "INSERT INTO instructors (display_name, email, phone, bio, specialties, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [displayName, email || null, phone || null, bio || null, specialties || null, isActive]
    );
    return res.status(201).json({ data: camelRow(r.rows[0]) });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/instructors/:id
app.put("/api/instructors/:id", adminMiddleware, async (req, res) => {
  try {
    const { displayName, email, phone, bio, specialties, isActive } = req.body;
    const r = await pool.query(
      "UPDATE instructors SET display_name=$1, email=$2, phone=$3, bio=$4, specialties=$5, is_active=$6, updated_at=NOW() WHERE id=$7 RETURNING *",
      [displayName, email || null, phone || null, bio || null, specialties || null, isActive !== false, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Instructor no encontrado" });
    return res.json({ data: camelRow(r.rows[0]) });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/instructors/:id
app.delete("/api/instructors/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM instructors WHERE id = $1", [req.params.id]);
    return res.json({ message: "Instructor eliminado" });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Reports ─────────────────────────────────────────────────────────────────

// GET /api/admin/reports?startDate=&endDate=
app.get("/api/admin/reports", adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    const [revenue, newClients, bookings, topPlans] = await Promise.all([
      pool.query(
        "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM orders WHERE status='verified' AND created_at BETWEEN $1 AND $2",
        [start, end]
      ),
      pool.query(
        "SELECT COUNT(*) FROM users WHERE role='client' AND created_at BETWEEN $1 AND $2",
        [start, end]
      ),
      pool.query(
        "SELECT COUNT(*) AS total, COUNT(CASE WHEN status='checked_in' THEN 1 END) AS attended FROM bookings WHERE created_at BETWEEN $1 AND $2",
        [start, end]
      ),
      pool.query(
        `SELECT p.name, COUNT(m.id) AS sales, SUM(o.amount) AS revenue
         FROM memberships m
         JOIN plans p ON m.plan_id = p.id
         LEFT JOIN orders o ON o.plan_id = p.id AND o.status = 'verified'
         WHERE m.created_at BETWEEN $1 AND $2
         GROUP BY p.name ORDER BY sales DESC LIMIT 5`,
        [start, end]
      ),
    ]);

    return res.json({
      period: { start, end },
      revenue: { total: parseFloat(revenue.rows[0].total), count: parseInt(revenue.rows[0].count) },
      newClients: parseInt(newClients.rows[0].count),
      bookings: { total: parseInt(bookings.rows[0].total), attended: parseInt(bookings.rows[0].attended) },
      topPlans: topPlans.rows,
    });
  } catch (err) {
    console.error("GET /admin/reports error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Classes admin ──────────────────────────────────────────────────────────

// GET /api/admin/classes — all scheduled classes
app.get("/api/admin/classes", adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, instructorId } = req.query;
    let q = `SELECT c.*, ct.name AS class_type_name, i.display_name AS instructor_name
             FROM classes c
             LEFT JOIN class_types ct ON c.class_type_id = ct.id
             LEFT JOIN instructors i ON c.instructor_id = i.id
             WHERE 1=1`;
    const params = [];
    if (startDate) { params.push(startDate); q += ` AND c.start_time >= $${params.length}`; }
    if (endDate) { params.push(endDate); q += ` AND c.start_time <= $${params.length}`; }
    if (instructorId) { params.push(instructorId); q += ` AND c.instructor_id = $${params.length}`; }
    q += " ORDER BY c.start_time ASC LIMIT 200";
    const r = await pool.query(q, params);
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/classes — create a class
app.post("/api/admin/classes", adminMiddleware, async (req, res) => {
  try {
    const { classTypeId, instructorId, startTime, endTime, capacity = 10, location, notes } = req.body;
    if (!classTypeId || !startTime) return res.status(400).json({ message: "classTypeId y startTime requeridos" });
    const r = await pool.query(
      `INSERT INTO classes (class_type_id, instructor_id, start_time, end_time, capacity, location, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled') RETURNING *`,
      [classTypeId, instructorId || null, startTime, endTime || null, capacity, location || null, notes || null]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/classes/:id
app.put("/api/admin/classes/:id", adminMiddleware, async (req, res) => {
  try {
    const { classTypeId, instructorId, startTime, endTime, capacity, status, notes } = req.body;
    const r = await pool.query(
      `UPDATE classes SET class_type_id=COALESCE($1,class_type_id), instructor_id=COALESCE($2,instructor_id),
       start_time=COALESCE($3,start_time), end_time=COALESCE($4,end_time),
       capacity=COALESCE($5,capacity), status=COALESCE($6,status), notes=COALESCE($7,notes), updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [classTypeId || null, instructorId || null, startTime || null, endTime || null, capacity || null, status || null, notes || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Clase no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/classes/:id
app.delete("/api/admin/classes/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM classes WHERE id = $1", [req.params.id]);
    return res.json({ message: "Clase eliminada" });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/classes/generate — bulk generate from schedule templates
app.post("/api/admin/classes/generate", adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, instructorId } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: "startDate y endDate requeridos" });
    // Get schedule slots
    const slotsRes = await pool.query("SELECT * FROM schedule_templates WHERE is_active = true");
    const slots = slotsRes.rows;
    if (!slots.length) return res.status(400).json({ message: "No hay horarios configurados" });
    // Get a default class type for each label
    const classTypeRes = await pool.query("SELECT id, name, category FROM class_types WHERE is_active = true");
    const classTypes = classTypeRes.rows;
    const created = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1..Sun=7
      const daySlots = slots.filter(s => s.day_of_week === dayOfWeek);
      for (const slot of daySlots) {
        const [hour, min] = slot.time_slot.replace(/[ap]m/i, "").split(":").map(Number);
        const isPM = slot.time_slot.toLowerCase().includes("pm") && hour !== 12;
        const classDate = new Date(d);
        classDate.setHours(isPM ? hour + 12 : hour, min || 0, 0, 0);
        const endDate2 = new Date(classDate);
        endDate2.setMinutes(endDate2.getMinutes() + 55);
        // Pick class type by label
        const label = slot.class_label?.toUpperCase();
        let ct = classTypes.find(ct => ct.category?.toLowerCase() === label?.toLowerCase());
        if (!ct) ct = classTypes[0];
        if (!ct) continue;
        // Check no duplicate
        const exists = await pool.query("SELECT id FROM classes WHERE start_time = $1 AND class_type_id = $2", [classDate.toISOString(), ct.id]);
        if (exists.rows.length) continue;
        const r = await pool.query(
          "INSERT INTO classes (class_type_id, instructor_id, start_time, end_time, capacity, status) VALUES ($1,$2,$3,$4,10,'scheduled') RETURNING *",
          [ct.id, instructorId || null, classDate.toISOString(), endDate2.toISOString()]
        );
        created.push(r.rows[0]);
      }
    }
    return res.json({ created: created.length, data: created });
  } catch (err) {
    console.error("POST /admin/classes/generate error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/admin/referrals
app.get("/api/admin/referrals", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT rc.*, u.display_name AS user_name, u.email,
              COUNT(r2.id) AS referral_count
       FROM referral_codes rc
       LEFT JOIN users u ON rc.user_id = u.id
       LEFT JOIN referrals r2 ON r2.referral_code_id = rc.id
       GROUP BY rc.id, u.display_name, u.email
       ORDER BY referral_count DESC`
    );
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/admin/videos — video list for admin
app.get("/api/admin/videos", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.*, ct.name AS class_type_name, i.display_name AS instructor_name
       FROM videos v
       LEFT JOIN class_types ct ON v.class_type_id = ct.id
       LEFT JOIN instructors i ON v.instructor_id = i.id
       ORDER BY v.created_at DESC`
    );
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/videos
app.post("/api/admin/videos", adminMiddleware, async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnailUrl, classTypeId, instructorId, durationMinutes, accessType = "membership", isPublished = false, isFeatured = false, sortOrder = 0 } = req.body;
    if (!title || !videoUrl) return res.status(400).json({ message: "title y videoUrl requeridos" });
    const r = await pool.query(
      `INSERT INTO videos (title, description, video_url, thumbnail_url, class_type_id, instructor_id, duration_minutes, access_type, is_published, is_featured, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title, description || null, videoUrl, thumbnailUrl || null, classTypeId || null, instructorId || null, durationMinutes || null, accessType, isPublished, isFeatured, sortOrder]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/videos/:id
app.put("/api/admin/videos/:id", adminMiddleware, async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnailUrl, classTypeId, instructorId, durationMinutes, accessType, isPublished, isFeatured, sortOrder } = req.body;
    const r = await pool.query(
      `UPDATE videos SET title=$1, description=$2, video_url=$3, thumbnail_url=$4, class_type_id=$5,
       instructor_id=$6, duration_minutes=$7, access_type=$8, is_published=$9, is_featured=$10, sort_order=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [title, description || null, videoUrl, thumbnailUrl || null, classTypeId || null, instructorId || null, durationMinutes || null, accessType || "membership", isPublished !== false, isFeatured === true, sortOrder || 0, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Video no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/admin/videos/:id
app.delete("/api/admin/videos/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM videos WHERE id = $1", [req.params.id]);
    return res.json({ message: "Video eliminado" });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/admin/reviews
app.get("/api/admin/reviews", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT rv.*, u.display_name AS user_name, u.email
       FROM reviews rv LEFT JOIN users u ON rv.user_id = u.id
       ORDER BY rv.created_at DESC LIMIT 100`
    );
    return res.json({ data: r.rows });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/reviews/:id/approve
app.put("/api/admin/reviews/:id/approve", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("UPDATE reviews SET is_approved=true WHERE id=$1 RETURNING *", [req.params.id]);
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// DELETE /api/admin/reviews/:id
app.delete("/api/admin/reviews/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM reviews WHERE id = $1", [req.params.id]);
    return res.json({ message: "Reseña eliminada" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Serve React SPA (static) ────────────────────────────────────────────────
const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await ensureSchema();
  console.log(`🚀 Ophelia API + Frontend → http://localhost:${PORT}`);
});
