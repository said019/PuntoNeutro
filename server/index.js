import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import multer from "multer";
import axios from "axios";
import crypto from "crypto";
import {
  sendMembershipActivated,
  sendBookingConfirmed,
  sendBookingCancelled,
  sendWeeklyReminder,
  sendRenewalReminder,
  sendPasswordResetEmail,
} from "./emailService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "ophelia_secret_2026";

// ─── Evolution API (WhatsApp) config ────────────────────────────────────────
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://evolution-api-production-c1cb.up.railway.app";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "xoL0b1t0s-2026";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || "ophelia-jump-studio";
const evolutionApi = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: { apikey: EVOLUTION_API_KEY },
  timeout: 20000,
});

// ─── File upload (memory storage, max 10 MB) ────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── File upload for videos (disk storage, max 500 MB) ─────────────────────
// Use disk storage so large videos don't fill Node.js RAM
const VIDEO_MAX_MB = 500;
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `ophelia_vid_${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: VIDEO_MAX_MB * 1024 * 1024 },
});

// ─── Google Drive helpers ────────────────────────────────────────────────────
async function getGoogleDriveAccessToken() {
  const resp = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
    grant_type: "refresh_token",
  }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  return resp.data.access_token;
}

async function makeGoogleDriveFilePublic(fileId, accessToken) {
  await axios.post(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    { role: "reader", type: "anyone" },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  ).catch(() => { }); // best-effort
}

/** Upload a Buffer to Google Drive using simple multipart (for small files like thumbnails) */
async function uploadBufferToDrive(buffer, fileName, mimeType, accessToken) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
  const metadata = { name: fileName, ...(folderId ? { parents: [folderId] } : {}) };
  // Build multipart body manually
  const boundary = "ophelia_boundary_" + Date.now();
  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const filePart = Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const endPart = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([metaPart, filePart, buffer, endPart]);

  const resp = await axios.post(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    body,
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary="${boundary}"` }, maxBodyLength: Infinity, maxContentLength: Infinity }
  );
  return resp.data; // { id, webViewLink }
}

/**
 * Upload a file from disk to Google Drive using Resumable Upload (streams in 5 MB chunks).
 * Works for files of any size without loading them entirely into memory.
 * @param {string} filePath  - absolute path to the temp file on disk
 * @param {string} fileName  - desired file name in Drive
 * @param {string} mimeType  - e.g. "video/mp4"
 * @param {string} accessToken - Google OAuth2 access token
 * @returns {{ id: string, webViewLink?: string }}
 */
async function uploadFileToDriveResumable(filePath, fileName, mimeType, accessToken) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
  const metadata = { name: fileName, ...(folderId ? { parents: [folderId] } : {}) };
  const fileSize = fs.statSync(filePath).size;

  // Step 1: Initiate resumable upload session
  const initResp = await axios.post(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
    metadata,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(fileSize),
      },
    }
  );
  const uploadUri = initResp.headers.location; // resumable session URI

  // Step 2: Upload file in chunks of 5 MB (must be multiples of 256 KB)
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
  let offset = 0;
  const fd = fs.openSync(filePath, "r");

  try {
    while (offset < fileSize) {
      const bytesToRead = Math.min(CHUNK_SIZE, fileSize - offset);
      const chunk = Buffer.alloc(bytesToRead);
      fs.readSync(fd, chunk, 0, bytesToRead, offset);

      const endByte = offset + bytesToRead - 1;
      const contentRange = `bytes ${offset}-${endByte}/${fileSize}`;

      const resp = await axios.put(uploadUri, chunk, {
        headers: {
          "Content-Length": String(bytesToRead),
          "Content-Range": contentRange,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        // 308 Resume Incomplete is expected for intermediate chunks
        validateStatus: (status) => status === 200 || status === 201 || status === 308,
      });

      if (resp.status === 200 || resp.status === 201) {
        // Final chunk — upload complete
        return resp.data; // { id, webViewLink }
      }

      // 308: read next range from Range header
      const rangeHeader = resp.headers.range; // e.g. "bytes=0-5242879"
      if (rangeHeader) {
        offset = parseInt(rangeHeader.split("-")[1], 10) + 1;
      } else {
        offset += bytesToRead;
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  throw new Error("Resumable upload ended without a final 200/201 response");
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

// Ensure users table has password_hash column (idempotent migration)
async function ensureSchema() {
  try {
    // ── Ensure all users columns the app needs ────────────────────────────
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepts_terms BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepts_communications BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20)`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS health_notes TEXT`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_reminders BOOLEAN DEFAULT true`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_promotions BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_weekly_summary BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => { });
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`).catch(() => { });
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
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code)`).catch(() => { });
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
        category     VARCHAR(20)  NOT NULL DEFAULT 'jumping' CHECK (category IN ('jumping','pilates')),
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
    `);
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS subtitle VARCHAR(150)`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'jumping'`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS intensity VARCHAR(20) DEFAULT 'media'`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS level VARCHAR(50) DEFAULT 'Todos los niveles'`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 50`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 15`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT '#c026d3'`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) DEFAULT '🏃'`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`).catch(() => { });
    await pool.query(`ALTER TABLE class_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
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
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_schedule_slots_day ON schedule_slots(day_of_week)`).catch(() => { });
    await pool.query(`ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS class_type_id UUID`).catch(() => { });
    await pool.query(`ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS class_type_name VARCHAR(100)`).catch(() => { });
    await pool.query(`ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS instructor_name VARCHAR(100)`).catch(() => { });
    await pool.query(`ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => { });
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_slots_slot ON schedule_slots(time_slot, day_of_week) WHERE is_active = true`).catch(() => { });
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
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category)`).catch(() => { });
    // ── Seed packages si la tabla está vacía ──────────────────────────────
    const pkgCount = await pool.query("SELECT COUNT(*) FROM packages");
    if (parseInt(pkgCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO packages (name, num_classes, price, category, validity_days, is_active, sort_order) VALUES
          ('4 Clases Jumping',  '4',         300,  'jumping', 30, true, 1),
          ('8 Clases Jumping',  '8',         560,  'jumping', 30, true, 2),
          ('12 Clases Jumping', '12',        780,  'jumping', 30, true, 3),
          ('16 Clases Jumping', '16',        960,  'jumping', 30, true, 4),
          ('20 Clases Jumping', '20',        1100, 'jumping', 30, true, 5),
          ('Ilimitado Jumping', 'ILIMITADO', 1000, 'jumping', 30, true, 6),
          ('4 Clases Pilates',  '4',         300,  'pilates', 30, true, 1),
          ('8 Clases Pilates',  '8',         600,  'pilates', 30, true, 2),
          ('12 Clases Pilates', '12',        840,  'pilates', 30, true, 3),
          ('16 Clases Pilates', '16',        1120, 'pilates', 30, true, 4),
          ('Ilimitado Pilates', 'ILIMITADO', 1000, 'pilates', 30, true, 5),
          ('8 Clases Mixto',    '8',         600,  'mixtos',  30, true, 1),
          ('12 Clases Mixto',   '12',        860,  'mixtos',  30, true, 2),
          ('16 Clases Mixto',   '16',        1120, 'mixtos',  30, true, 3),
          ('20 Clases Mixto',   '20',        1300, 'mixtos',  30, true, 4),
          ('Ilimitado Mixto',   'ILIMITADO', 1000, 'mixtos',  30, true, 5)
        ON CONFLICT DO NOTHING;
      `);
      console.log("✅ Seeded 16 Ophelia packages");
    }
    // ── Seed class_types – ensure 8 real Ophelia types exist ──────────────
    const hasOpheliaTypes = await pool.query("SELECT 1 FROM class_types WHERE name = 'Jumping Fitness' LIMIT 1");
    if (hasOpheliaTypes.rows.length === 0) {
      // Remove any old / placeholder class types
      const opheliaNames = ['Jumping Fitness', 'Jumping Dance', 'Jump & Tone', 'Strong Jump', 'Mindful Jump', 'Hot Pilates', 'Flow Pilates', 'Pilates Mat'];
      await pool.query("DELETE FROM class_types WHERE name != ALL($1::text[])", [opheliaNames]);
      await pool.query(`
        INSERT INTO class_types (name, subtitle, description, category, intensity, level, duration_min, capacity, color, emoji, sort_order, is_active) VALUES
          ('Jumping Fitness',  'Full Body',                  'Clase de jumping fitness de cuerpo completo con música motivadora.',                   'jumping',  'Alta',  'all',          50, 10, '#E15CB8', '🏋️', 1, true),
          ('Jumping Dance',    'Coreografías',               'Coreografías dinámicas sobre el trampolín con ritmos contagiosos.',                    'jumping',  'Media', 'all',          50, 10, '#CA71E1', '💃',  2, true),
          ('Jump & Tone',      'Tonificación y resistencia', 'Combina jumping con ejercicios de tonificación y resistencia muscular.',              'jumping',  'Alta',  'intermediate', 55, 10, '#E7EB6E', '💪',  3, true),
          ('Strong Jump',      'Fuerza y glúteo',            'Enfocada en fuerza de tren inferior y glúteo con intervalos de alta intensidad.',      'jumping',  'Alta',  'intermediate', 55, 10, '#8B5CF6', '🔥',  4, true),
          ('Mindful Jump',     'Pilates en trampolín',       'Pilates sobre trampolín para mejorar equilibrio, flexibilidad y conciencia corporal.', 'jumping',  'Baja',  'all',          60, 10, '#c026d3', '🧘',  5, true),
          ('Hot Pilates',      'Pesada',                     'Clase de pilates de alta intensidad enfocada en fuerza y control.',                    'pilates',  'Alta',  'intermediate', 55, 10, '#E15CB8', '🔥',  6, true),
          ('Flow Pilates',     'Media',                      'Pilates fluido de intensidad media para fortalecer y elongar.',                       'pilates',  'Media', 'all',          55, 10, '#CA71E1', '🌊',  7, true),
          ('Pilates Mat',      'Ligera',                     'Pilates en mat de baja intensidad enfocado en técnica y control corporal.',            'pilates',  'Baja',  'beginner',     50, 10, '#E7EB6E', '🌸',  8, true)
        ON CONFLICT DO NOTHING;
      `);
      console.log("✅ Seeded 8 Ophelia class types");
    }
    // ── Seed schedule_slots si la tabla está vacía ─────────────────────────
    const ssCount = await pool.query("SELECT COUNT(*) FROM schedule_slots");
    if (parseInt(ssCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO schedule_slots (time_slot, day_of_week, class_type_name) VALUES
          ('7:00 am', 1, 'Jumping Fitness'), ('7:00 am', 2, 'Jumping Dance'),
          ('7:00 am', 3, 'Jump & Tone'),     ('7:00 am', 4, 'Strong Jump'),
          ('7:00 am', 5, 'Mindful Jump'),    ('7:00 am', 6, 'Jumping Fitness'),
          ('9:00 am', 1, 'Jumping Dance'),   ('9:00 am', 2, 'Jump & Tone'),
          ('9:00 am', 3, 'Strong Jump'),     ('9:00 am', 4, 'Jumping Fitness'),
          ('9:00 am', 5, 'Jumping Dance'),   ('9:00 am', 6, 'Hot Pilates'),
          ('11:00 am',1, 'Flow Pilates'),    ('11:00 am',3, 'Pilates Mat'),
          ('11:00 am',5, 'Hot Pilates'),     ('11:00 am',6, 'Flow Pilates'),
          ('6:00 pm', 1, 'Jumping Fitness'), ('6:00 pm', 2, 'Strong Jump'),
          ('6:00 pm', 3, 'Jumping Dance'),   ('6:00 pm', 4, 'Jump & Tone'),
          ('6:00 pm', 5, 'Mindful Jump'),
          ('7:30 pm', 1, 'Jump & Tone'),     ('7:30 pm', 2, 'Pilates Mat'),
          ('7:30 pm', 3, 'Strong Jump'),     ('7:30 pm', 4, 'Flow Pilates')
        ON CONFLICT DO NOTHING;
      `);
    }
    // ── Ensure plans columns exist ───────────────────────────────────────
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'MXN'`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS class_limit INTEGER`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS class_category VARCHAR(20) DEFAULT 'all'`).catch(() => { });
    // ── Migrate class_types: remove 'mixto' category (now only jumping/pilates) ──
    await pool.query(`
      UPDATE class_types SET category = 'jumping' WHERE category NOT IN ('jumping','pilates');
    `).catch(() => { });
    // ── Migrate plans: 'mixto' class_category means both, keep as 'mixto' for logic ──
    // (mixto plans are still valid — the booking endpoint allows them on both categories)
    // ── Seed plans: deactivate old schema_complete.sql plans & ensure only correct ones ──
    // Soft-delete (deactivate) old plans that came from the migration seed (wrong data)
    // Using UPDATE instead of DELETE to avoid FK constraint from orders table
    await pool.query(`
      UPDATE plans SET is_active = false WHERE name IN (
        'Inscripción (Pago Anual)',
        'Sesión Muestra o Individual',
        'Sesión Extra (Socias o Inscritas)',
        'Una Sesión (4 al Mes)',
        'Dos Sesiones (8 al Mes)',
        'Tres Sesiones (12 al Mes)',
        'Cuatro Sesiones (16 al Mes)',
        'Cinco Sesiones (20 al Mes)',
        'Seis Sesiones (24 al Mes)',
        'Siete Sesiones (28 al Mes)'
      );
    `).catch(() => { });
    const plCount = await pool.query("SELECT COUNT(*) FROM plans WHERE is_active = true");
    if (parseInt(plCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO plans (name, price, currency, duration_days, class_limit, class_category, is_active, sort_order) VALUES
          ('Jumping — 4 Clases',    380,  'MXN', 30, 4,    'jumping', true, 1),
          ('Jumping — 8 Clases',    700,  'MXN', 30, 8,    'jumping', true, 2),
          ('Jumping — 12 Clases',   980,  'MXN', 30, 12,   'jumping', true, 3),
          ('Jumping — Ilimitado',   1350, 'MXN', 30, NULL, 'jumping', true, 4),
          ('Pilates — 4 Clases',    380,  'MXN', 30, 4,    'pilates', true, 5),
          ('Pilates — 8 Clases',    700,  'MXN', 30, 8,    'pilates', true, 6),
          ('Pilates — 12 Clases',   980,  'MXN', 30, 12,   'pilates', true, 7),
          ('Pilates — Ilimitado',   1350, 'MXN', 30, NULL, 'pilates', true, 8),
          ('Mixto — 8 Clases',      800,  'MXN', 30, 8,    'mixto',   true, 9),
          ('Mixto — 12 Clases',     1100, 'MXN', 30, 12,   'mixto',   true, 10),
          ('Mixto — Ilimitado',     1500, 'MXN', 30, NULL, 'mixto',   true, 11)
        ON CONFLICT DO NOTHING;
      `);
    }
    // ── Backfill class_category on existing plans that have no category set ──
    await pool.query(`UPDATE plans SET class_category = 'jumping' WHERE (class_category IS NULL OR class_category = 'all') AND (name ILIKE '%jumping%' OR name ILIKE '%jump%' OR name ILIKE '%strong%' OR name ILIKE '%dance%' OR name ILIKE '%tone%' OR name ILIKE '%mindful jump%')`).catch(() => { });
    await pool.query(`UPDATE plans SET class_category = 'pilates' WHERE (class_category IS NULL OR class_category = 'all') AND (name ILIKE '%pilates%' OR name ILIKE '%mat%' OR name ILIKE '%flow%' OR name ILIKE '%hot%')`).catch(() => { });
    await pool.query(`UPDATE plans SET class_category = 'mixto'   WHERE (class_category IS NULL OR class_category = 'all') AND name ILIKE '%mixto%'`).catch(() => { });
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
    // ── Payment proofs table ────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_proofs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        file_url    TEXT NOT NULL,
        file_name   VARCHAR(255),
        mime_type   VARCHAR(100),
        status      VARCHAR(30) NOT NULL DEFAULT 'pending',
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_payment_proofs_order UNIQUE (order_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON payment_proofs(order_id);
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
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transactions(user_id)`).catch(() => { });
    // ── referrals table (tracks which users were referred) ─────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referral_code_id UUID REFERENCES referral_codes(id) ON DELETE CASCADE,
        referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rewarded         BOOLEAN DEFAULT false,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code_id)`).catch(() => { });
    // ── orders: add missing columns if needed ─────────────────────────────
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0`).catch(() => { });
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR(30) DEFAULT 'web'`).catch(() => { });
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan_id UUID`).catch(() => { });
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE`).catch(() => { });
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_by UUID`).catch(() => { });
    // Make plan_id nullable (POS orders don't always have a plan)
    await pool.query(`ALTER TABLE orders ALTER COLUMN plan_id DROP NOT NULL`).catch(() => { });
    // Make user_id nullable (walk-in POS sales may not have a user)
    await pool.query(`ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL`).catch(() => { });
    // ── memberships: add order_id column ─────────────────────────────────
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS order_id UUID`).catch(() => { });
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_order ON memberships(order_id) WHERE order_id IS NOT NULL`).catch(() => { });
    // ── memberships: add fallback name/limit override columns ─────────────
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS plan_name_override VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS class_limit_override INTEGER`).catch(() => { });
    // Fix existing 9999 unlimited sentinel values → NULL
    await pool.query(`
      UPDATE memberships SET classes_remaining = NULL WHERE classes_remaining >= 9999;
    `).catch(() => { });
    // ── memberships: track how many times a user has cancelled ────────────
    await pool.query(`
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS cancellations_used INTEGER NOT NULL DEFAULT 0;
    `).catch(() => { });
    // ── Reconcile cancellations_used with actual cancelled bookings ────────
    await pool.query(`
      UPDATE memberships m
      SET cancellations_used = sub.cnt
      FROM (
        SELECT b.membership_id, COUNT(*) AS cnt
        FROM bookings b
        WHERE b.status = 'cancelled' AND b.membership_id IS NOT NULL
        GROUP BY b.membership_id
      ) sub
      WHERE m.id = sub.membership_id AND m.cancellations_used != sub.cnt;
    `).catch(() => { });
    // ── homepage_video_cards: editable 3-card section on landing page ──────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS homepage_video_cards (
        id          SERIAL PRIMARY KEY,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        title       VARCHAR(120) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        emoji       VARCHAR(10)  NOT NULL DEFAULT '🎬',
        video_url   TEXT,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => { });
    // Add video_url column if table already existed
    await pool.query(`ALTER TABLE homepage_video_cards ADD COLUMN IF NOT EXISTS video_url TEXT`).catch(() => { });
    // seed default cards only when table is empty
    await pool.query(`
      INSERT INTO homepage_video_cards (sort_order, title, description, emoji)
      SELECT * FROM (VALUES
        (1, 'Jumping Fitness', 'Cardio de alta intensidad en trampolín con música que te hará volar.', '🏋️'),
        (2, 'Jumping Dance',   'Coreografías sobre el trampolín que combinan ritmo y diversión.',     '💃'),
        (3, 'Pilates Flow',    'Secuencias fluidas para fortalecer tu core y mejorar postura.',        '🧘')
      ) AS v(sort_order, title, description, emoji)
      WHERE NOT EXISTS (SELECT 1 FROM homepage_video_cards LIMIT 1);
    `).catch(() => { });
    // ── discount_codes: normalise discount_type values ────────────────────
    await pool.query(`ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2) DEFAULT 0`).catch(() => { });
    await pool.query(`ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    // ── bookings: add checked_in_at column ────────────────────────────────
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE`).catch(() => { });
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
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         VARCHAR(150) NOT NULL,
        description  TEXT,
        points_cost  INTEGER NOT NULL,
        reward_type  VARCHAR(30) NOT NULL DEFAULT 'custom',
        reward_value VARCHAR(150),
        stock        INTEGER,
        is_active    BOOLEAN DEFAULT true,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // ── Loyalty rewards: add new columns if table already exists ───────────
    await pool.query(`ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS reward_type  VARCHAR(30) NOT NULL DEFAULT 'custom'`).catch(() => { });
    await pool.query(`ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS reward_value VARCHAR(150)`).catch(() => { });
    await pool.query(`ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS stock        INTEGER`).catch(() => { });
    // ── Apple Wallet device registration table ────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS apple_wallet_devices (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id      VARCHAR(255) NOT NULL,
        push_token     VARCHAR(255) NOT NULL DEFAULT '',
        pass_type_id   VARCHAR(255) NOT NULL,
        serial_number  VARCHAR(255) NOT NULL,
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, pass_type_id, serial_number)
      );
    `).catch(() => { });
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
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(500)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS cloudinary_id VARCHAR(500)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_drive_id VARCHAR(500)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS tagline VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS days VARCHAR(100)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS sales_enabled BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS sales_unlocks_video BOOLEAN DEFAULT false`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS sales_price_mxn DECIMAL(10,2)`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS sales_class_credits INTEGER`).catch(() => { });
    await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS sales_cta_text VARCHAR(100)`).catch(() => { });
    // ── Video purchases: add admin_notes and verified_at ──────────────────
    await pool.query(`ALTER TABLE video_purchases ADD COLUMN IF NOT EXISTS admin_notes TEXT`).catch(() => { });
    await pool.query(`ALTER TABLE video_purchases ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE`).catch(() => { });

    // ── Módulo de Eventos ────────────────────────────────────────────────
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE event_type AS ENUM (
          'masterclass','workshop','retreat','challenge','openhouse','special'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type                event_type NOT NULL,
        title               VARCHAR(200) NOT NULL,
        description         TEXT NOT NULL,
        instructor_name     VARCHAR(100) NOT NULL,
        instructor_photo    TEXT,
        date                DATE NOT NULL,
        start_time          TIME NOT NULL,
        end_time            TIME NOT NULL,
        location            VARCHAR(200) NOT NULL,
        capacity            INTEGER NOT NULL DEFAULT 1,
        registered          INTEGER DEFAULT 0,
        price               NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency            VARCHAR(3) DEFAULT 'MXN',
        early_bird_price    NUMERIC(10,2),
        early_bird_deadline DATE,
        member_discount     NUMERIC(5,2) DEFAULT 0,
        image               TEXT,
        requirements        VARCHAR(500) DEFAULT '',
        includes            JSONB DEFAULT '[]',
        tags                JSONB DEFAULT '[]',
        status              VARCHAR(20) DEFAULT 'draft',
        created_by          UUID,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      );
    `).catch(() => { });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id                 UUID,
        name                    VARCHAR(100) NOT NULL,
        email                   VARCHAR(255) NOT NULL,
        phone                   VARCHAR(20) DEFAULT '',
        status                  VARCHAR(20) DEFAULT 'pending',
        amount                  NUMERIC(10,2) DEFAULT 0,
        payment_method          VARCHAR(20),
        payment_reference       VARCHAR(200),
        payment_proof_url       TEXT,
        payment_proof_file_name VARCHAR(255),
        transfer_date           DATE,
        paid_at                 TIMESTAMPTZ,
        checked_in              BOOLEAN DEFAULT false,
        checked_in_at           TIMESTAMPTZ,
        checked_in_by           UUID,
        waitlist_position       INTEGER,
        notes                   TEXT,
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        updated_at              TIMESTAMPTZ DEFAULT NOW()
      );
    `).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_status    ON events(status)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_date       ON events(date)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_type       ON events(type)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_regs_event  ON event_registrations(event_id)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_regs_user   ON event_registrations(user_id)`).catch(() => { });
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_regs_status ON event_registrations(status)`).catch(() => { });

    console.log("✅ Schema ensured");
  } catch (err) {
    console.error("Schema migration warning:", err.message);
  }

  // ── Seed demo classes for the next 4 weeks (only if classes table is empty) ──
  try {
    // First ensure at least one instructor exists
    const instCount = await pool.query("SELECT COUNT(*) FROM instructors");
    if (parseInt(instCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO instructors (display_name, email, bio, specialties, is_active) VALUES
          ('Valeria Mendoza',  'valeria@opheliajumping.mx',  'Instructora certificada de Jumping Fitness con 5 años de experiencia.', 'Jumping Fitness,Jumping Dance,Strong Jump', true),
          ('Daniela Reyes',    'daniela@opheliajumping.mx',  'Especialista en Pilates y movimiento consciente.', 'Hot Pilates,Flow Pilates,Pilates Mat,Mindful Jump', true),
          ('Sofía Torres',     'sofia@opheliajumping.mx',    'Instructora de Jump & Tone y entrenamientos funcionales.', 'Jump & Tone,Strong Jump,Jumping Fitness', true),
          ('Camila Vargas',    'camila@opheliajumping.mx',   'Certificada en Pilates mat y reformer.', 'Pilates Mat,Flow Pilates,Hot Pilates', true)
        ON CONFLICT DO NOTHING;
      `);
      console.log("✅ Seeded 4 demo instructors");
    }

    const classCount = await pool.query("SELECT COUNT(*) FROM classes");
    if (parseInt(classCount.rows[0].count) === 0) {
      // Fetch real class_type ids and instructor ids from DB
      const typesRes = await pool.query(
        "SELECT id, name FROM class_types WHERE is_active = true ORDER BY sort_order ASC LIMIT 8"
      );
      const instRes = await pool.query(
        "SELECT id FROM instructors WHERE is_active = true ORDER BY created_at ASC LIMIT 4"
      );

      if (typesRes.rows.length > 0 && instRes.rows.length > 0) {
        const types = typesRes.rows;       // [{id, name}, ...]
        const insts = instRes.rows;        // [{id}, ...]
        const getType = (i) => types[i % types.length].id;
        const getInst = (i) => insts[i % insts.length].id;

        // Build classes for Mon–Sat for the next 4 weeks
        const today = new Date();
        // Find Monday of current week
        const dayOfWeek = today.getDay(); // 0=Sun
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMon);

        // Time slots: morning + evening
        const SLOTS = [
          { hour: 7, min: 0, dur: 55 },
          { hour: 9, min: 0, dur: 55 },
          { hour: 11, min: 0, dur: 60 },
          { hour: 18, min: 0, dur: 55 },
          { hour: 19, min: 30, dur: 55 },
        ];
        // Days: Mon(1)–Sat(6), no Sunday
        const DAYS = [0, 1, 2, 3, 4, 5]; // offset from monday

        let typeIdx = 0;
        let instIdx = 0;
        const inserts = [];

        for (let week = 0; week < 4; week++) {
          for (const dayOffset of DAYS) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + week * 7 + dayOffset);
            const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

            // Not every slot on every day — skip some to feel realistic
            const slotsToday = SLOTS.filter((_, si) => {
              // Weekends (Sat = offset 5) only morning slots
              if (dayOffset === 5 && si > 2) return false;
              // Some variety: skip slot if typeIdx+dayOffset+si is divisible by 7
              if ((typeIdx + dayOffset + si) % 7 === 0) return false;
              return true;
            });

            for (const slot of slotsToday) {
              const startH = String(slot.hour).padStart(2, "0");
              const startM = String(slot.min).padStart(2, "0");
              const totalMin = slot.hour * 60 + slot.min + slot.dur;
              const endH = String(Math.floor(totalMin / 60)).padStart(2, "0");
              const endM = String(totalMin % 60).padStart(2, "0");
              inserts.push({
                classTypeId: getType(typeIdx),
                instructorId: getInst(instIdx),
                date: dateStr,
                startTime: `${startH}:${startM}`,
                endTime: `${endH}:${endM}`,
                maxCapacity: 10,
              });
              typeIdx++;
              instIdx++;
            }
          }
        }

        for (const c of inserts) {
          await pool.query(
            `INSERT INTO classes (class_type_id, instructor_id, date, start_time, end_time, max_capacity, status)
             VALUES ($1,$2,$3,$4,$5,$6,'scheduled') ON CONFLICT DO NOTHING`,
            [c.classTypeId, c.instructorId, c.date, c.startTime, c.endTime, c.maxCapacity]
          );
        }
        console.log(`✅ Seeded ${inserts.length} demo classes for the next 4 weeks`);
      }
    }
  } catch (err) {
    console.error("Demo classes seed warning:", err.message);
  }


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
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

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
    gender: u.gender ?? null,
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
  const { email, password, displayName, phone, gender, acceptsTerms, acceptsCommunications } = req.body;
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
      `INSERT INTO users (display_name, email, phone, gender, password_hash, accepts_terms, accepts_communications, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'client')
       RETURNING *`,
      [displayName.trim(), email.toLowerCase().trim(), phone || null, gender || null, passwordHash, acceptsTerms ?? false, acceptsCommunications ?? false]
    );
    const user = result.rows[0];
    // Auto-create referral code
    const code = "OPH" + Math.random().toString(36).slice(2, 8).toUpperCase();
    await pool.query(
      "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, code]
    );
    // Award welcome bonus loyalty points
    try {
      const cfgRes = await pool.query("SELECT value FROM settings WHERE key='loyalty_config' LIMIT 1");
      const cfg = cfgRes.rows.length ? cfgRes.rows[0].value : {};
      const pts = cfg.welcome_bonus ?? 50;
      if (cfg.enabled !== false && pts > 0) {
        await pool.query(
          "INSERT INTO loyalty_transactions (user_id, type, points, description) VALUES ($1, 'earn', $2, 'Bono de bienvenida')",
          [user.id, pts]
        );
      }
    } catch (e) { /* loyalty earn error shouldn't fail register */ }
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

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email es requerido" });

  try {
    const user = await pool.query("SELECT id, display_name FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      // Return 200 to prevent user enumeration
      return res.json({ message: "Si el correo existe, recibirás un enlace de recuperación." });
    }

    const token = crypto.randomUUID();
    // Expiration set to 2 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.rows[0].id, token, expiresAt]
    );

    await sendPasswordResetEmail({
      to: email,
      name: user.rows[0].display_name,
      token,
    });

    return res.json({ message: "Si el correo existe, recibirás un enlace de recuperación." });
  } catch (err) {
    console.error("Auth /forgot-password error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: "Datos incompletos" });

  try {
    // Check token validity
    const t = await pool.query(
      `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    );
    if (t.rows.length === 0) return res.status(400).json({ message: "El enlace es inválido o ha expirado." });

    const dbToken = t.rows[0];
    if (dbToken.used) return res.status(400).json({ message: "Este enlace ya fue utilizado. Solicita uno nuevo." });
    if (new Date() > new Date(dbToken.expires_at)) return res.status(400).json({ message: "Este enlace ha expirado." });

    // Hash new password and update
    const hash = await bcrypt.hash(password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, dbToken.user_id]);

    // Mark token as used
    await pool.query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [token]);

    return res.json({ message: "Contraseña restablecida con éxito." });
  } catch (err) {
    console.error("Auth /reset-password error:", err);
    return res.status(500).json({ message: "Error al actualizar la contraseña." });
  }
});

// ─── Routes: /api/plans ─────────────────────────────────────────────────────

// GET /api/plans
app.get("/api/plans", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM plans ORDER BY sort_order ASC, price ASC"
    );
    return res.json({ data: camelRows(r.rows) });
  } catch (err) {
    console.error("Plans error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Routes: /api/memberships ───────────────────────────────────────────────

// GET /api/memberships/my
app.get("/api/memberships/my", authMiddleware, async (req, res) => {
  try {
    // Ensure optional columns exist (idempotent, safe to run on every request)
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS plan_name_override VARCHAR(255)`).catch(() => { });
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS class_limit_override INTEGER`).catch(() => { });
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS cancellations_used INTEGER NOT NULL DEFAULT 0`).catch(() => { });
    await pool.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS order_id UUID`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS class_category VARCHAR(20) DEFAULT 'all'`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS class_limit INTEGER`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30`).catch(() => { });
    await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb`).catch(() => { });

    const r = await pool.query(
      `SELECT m.id, m.user_id, m.plan_id, m.status, m.start_date, m.end_date,
              m.classes_remaining, m.payment_method, m.created_at, m.updated_at,
              m.order_id, m.cancellations_used,
              COALESCE(m.plan_name_override, '') AS plan_name_override,
              m.class_limit_override,
              COALESCE(p.name, m.plan_name_override, 'Membresía') AS plan_name,
              COALESCE(p.class_limit, m.class_limit_override)      AS class_limit,
              COALESCE(p.duration_days, 30)                        AS duration_days,
              p.features,
              COALESCE(p.class_category, 'all')                    AS class_category
       FROM memberships m
       LEFT JOIN plans p ON m.plan_id = p.id
       WHERE m.user_id = $1
       ORDER BY CASE m.status
         WHEN 'active'              THEN 1
         WHEN 'pending_activation'  THEN 2
         WHEN 'pending_payment'     THEN 3
         ELSE 4 END,
         m.created_at DESC
       LIMIT 1`,
      [req.userId]
    );
    if (!r.rows[0]) return res.json({ data: null });
    const row = camelRows([r.rows[0]])[0];
    // Treat 9999 or very large numbers as unlimited (null)
    if (row.classesRemaining >= 9999) row.classesRemaining = null;
    if (row.classLimit >= 9999) row.classLimit = null;
    return res.json({ data: row });
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
             c.max_capacity                         AS capacity,
             (c.date || 'T' || c.start_time)        AS start_time_full,
             (c.date || 'T' || c.end_time)          AS end_time_full,
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
    if (end) { params.push(end); query += ` AND c.date <= $${params.length}`; }
    query += " ORDER BY c.date ASC, c.start_time ASC";
    if (limit) { params.push(parseInt(limit)); query += ` LIMIT $${params.length}`; }
    const r = await pool.query(query, params);
    // Normalise: expose start_time / end_time as full ISO strings for front-end consumers
    const rows = r.rows.map((row) => ({
      ...row,
      start_time: row.start_time_full ?? row.start_time,
      end_time: row.end_time_full ?? row.end_time,
    }));
    return res.json({ data: rows });
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
              (c.date || 'T' || c.start_time) AS start_time,
              (c.date || 'T' || c.end_time)   AS end_time,
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
              c.date,
              (c.date || 'T' || c.start_time) AS start_time,
              (c.date || 'T' || c.end_time)   AS end_time,
              c.status AS class_status,
              ct.name  AS class_type_name,
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
    // Check membership (get class_category from the joined plan)
    const memRes = await pool.query(
      `SELECT m.id, m.classes_remaining, COALESCE(p.class_category, 'all') AS class_category
       FROM memberships m
       LEFT JOIN plans p ON m.plan_id = p.id
       WHERE m.user_id = $1 AND m.status = 'active' AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
       LIMIT 1`,
      [req.userId]
    );
    if (memRes.rows.length === 0) return res.status(403).json({ message: "No tienes membresía activa" });
    const membership = memRes.rows[0];

    // Check if class exists, has capacity, and get its category
    const classRes = await pool.query(
      `SELECT c.id, c.max_capacity, c.current_bookings, c.status, ct.category AS class_category
       FROM classes c
       JOIN class_types ct ON c.class_type_id = ct.id
       WHERE c.id = $1`,
      [classId]
    );
    if (classRes.rows.length === 0) return res.status(404).json({ message: "Clase no encontrada" });
    const cls = classRes.rows[0];
    if (cls.status === "cancelled") return res.status(400).json({ message: "Esta clase fue cancelada" });

    // ── Category validation ────────────────────────────────────────────────
    // mixto/all memberships can book any category (jumping or pilates)
    // jumping memberships can only book jumping classes
    // pilates memberships can only book pilates classes
    const memCategory = membership.class_category ?? "all"; // 'jumping' | 'pilates' | 'mixto' | 'all'
    const clsCategory = cls.class_category;                  // 'jumping' | 'pilates' | null
    if (clsCategory && memCategory !== "mixto" && memCategory !== "all" && memCategory !== clsCategory) {
      const label = clsCategory === "jumping" ? "Jumping" : "Pilates";
      return res.status(403).json({
        message: `Tu membresía no incluye clases de ${label}. Necesitas una membresía ${label} o Mixta.`,
      });
    }

    // ── Check classes remaining (skip for unlimited plans where remaining is null or >= 9999) ──
    if (
      membership.classes_remaining !== null &&
      membership.classes_remaining < 9999 &&
      membership.classes_remaining <= 0
    ) {
      return res.status(403).json({
        message: "Ya no tienes clases disponibles en tu paquete. Renueva o adquiere un nuevo plan.",
      });
    }

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
      // Deduct class credit only if membership has a real limit (not null and not 9999+)
      if (membership.classes_remaining !== null && membership.classes_remaining < 9999) {
        await pool.query(
          "UPDATE memberships SET classes_remaining = classes_remaining - 1 WHERE id = $1",
          [membership.id]
        );
      }
    }

    // ── Email: booking confirmed / waitlist ────────────────────────────────
    try {
      const userRes = await pool.query("SELECT email, full_name, display_name FROM users WHERE id = $1", [req.userId]);
      const classFullRes = await pool.query(
        `SELECT c.date, c.start_time, ct.name AS class_type_name,
                COALESCE(i.full_name, i.display_name) AS instructor_name
         FROM classes c
         JOIN class_types ct ON c.class_type_id = ct.id
         LEFT JOIN instructors i ON c.instructor_id = i.id
         WHERE c.id = $1`,
        [classId]
      );
      // Recalculate remaining after deduction
      const memAfter = await pool.query("SELECT classes_remaining FROM memberships WHERE id = $1", [membership.id]);
      const classesLeft = memAfter.rows[0]?.classes_remaining ?? null;

      if (userRes.rows[0] && classFullRes.rows[0]) {
        const u = userRes.rows[0];
        const cl = classFullRes.rows[0];
        sendBookingConfirmed({
          to: u.email,
          name: u.full_name || u.display_name || "Alumna",
          className: cl.class_type_name,
          date: cl.date,
          startTime: cl.start_time,
          instructor: cl.instructor_name,
          classesLeft,
          isWaitlist,
        }).catch((e) => console.error("[Email] booking confirmed:", e.message));
      }
    } catch (emailErr) {
      console.error("[Email] booking confirmed query error:", emailErr.message);
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
    // Load booking
    const r = await pool.query(
      `SELECT b.*, c.date, c.start_time, ct.name AS class_type_name
       FROM bookings b
       JOIN classes c ON b.class_id = c.id
       JOIN class_types ct ON c.class_type_id = ct.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Reserva no encontrada" });
    const booking = r.rows[0];

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Esta reserva ya fue cancelada" });
    }

    // ── Check membership cancellation limit (max 2 per membership period) ──
    let membership = null;
    if (booking.membership_id) {
      const memRes = await pool.query(
        "SELECT id, classes_remaining, cancellations_used, plan_id FROM memberships WHERE id = $1",
        [booking.membership_id]
      );
      membership = memRes.rows[0] ?? null;
    }

    if (membership && (membership.cancellations_used ?? 0) >= 2) {
      return res.status(403).json({
        message: "Has alcanzado el límite de 2 cancelaciones permitidas en tu membresía actual. Contacta con el studio si necesitas ayuda.",
      });
    }

    // ── Check 2-hour advance notice window ─────────────────────────────────
    // Classes are in Mexico City time; use the DB's start_time timestamp directly
    // booking.date comes from the classes table (type DATE) and start_time is TIMESTAMPTZ
    // We read the class start as Mexico City local time to compare correctly
    const classStartRes = await pool.query(
      `SELECT (c.date + c.start_time::time) AT TIME ZONE 'America/Mexico_City' AS class_start_utc
       FROM classes c WHERE c.id = $1`,
      [booking.class_id]
    );
    const classStartUTC = classStartRes.rows[0]?.class_start_utc
      ? new Date(classStartRes.rows[0].class_start_utc)
      : null;
    const now = new Date();
    const minutesUntilClass = classStartUTC
      ? (classStartUTC.getTime() - now.getTime()) / 60_000
      : 999; // if we can't determine, assume on-time
    const isLate = minutesUntilClass < 120; // less than 2 hours

    // Cancel the booking
    await pool.query(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    if (booking.status === "confirmed") {
      // Always free the class spot
      await pool.query(
        "UPDATE classes SET current_bookings = GREATEST(current_bookings - 1, 0) WHERE id = $1",
        [booking.class_id]
      );

      if (membership) {
        // Increment cancellations_used regardless of timing
        await pool.query(
          "UPDATE memberships SET cancellations_used = COALESCE(cancellations_used, 0) + 1 WHERE id = $1",
          [membership.id]
        );

        if (isLate) {
          // Late cancellation: credit is LOST — do not restore
          // Email: cancelled, no credit restored
          try {
            const uRes = await pool.query("SELECT email, full_name, display_name FROM users WHERE id = $1", [req.userId]);
            const memAfter = await pool.query("SELECT classes_remaining FROM memberships WHERE id = $1", [membership.id]);
            if (uRes.rows[0]) {
              const u = uRes.rows[0];
              sendBookingCancelled({
                to: u.email,
                name: u.full_name || u.display_name || "Alumna",
                className: booking.class_type_name || "tu clase",
                date: booking.date,
                startTime: booking.start_time,
                creditRestored: false,
                isLate: true,
                classesLeft: memAfter.rows[0]?.classes_remaining ?? null,
              }).catch((e) => console.error("[Email] booking cancelled late:", e.message));
            }
          } catch (emailErr) {
            console.error("[Email] cancelled late query:", emailErr.message);
          }
          return res.json({
            message: "Reserva cancelada. Por ser con menos de 2 horas de anticipación, la clase NO se devuelve a tu paquete.",
            creditRestored: false,
          });
        }

        // On-time cancellation: restore credit only if membership has a counted limit
        if (membership.classes_remaining !== null && membership.classes_remaining < 9999) {
          await pool.query(
            "UPDATE memberships SET classes_remaining = classes_remaining + 1 WHERE id = $1",
            [membership.id]
          );
        }
      }
    }

    // ── Email: booking cancelled ───────────────────────────────────────────
    try {
      const uRes = await pool.query("SELECT email, full_name, display_name FROM users WHERE id = $1", [req.userId]);
      const memAfter = membership
        ? await pool.query("SELECT classes_remaining FROM memberships WHERE id = $1", [membership.id])
        : null;
      if (uRes.rows[0]) {
        const u = uRes.rows[0];
        sendBookingCancelled({
          to: u.email,
          name: u.full_name || u.display_name || "Alumna",
          className: booking.class_type_name || "tu clase",
          date: booking.date,
          startTime: booking.start_time,
          creditRestored: !isLate,
          isLate,
          classesLeft: memAfter?.rows[0]?.classes_remaining ?? null,
        }).catch((e) => console.error("[Email] booking cancelled:", e.message));
      }
    } catch (emailErr) {
      console.error("[Email] cancelled query:", emailErr.message);
    }

    return res.json({
      message: isLate
        ? "Reserva cancelada. La clase no se devolvió al paquete (cancelación tardía)."
        : "Reserva cancelada. Se devolvió el crédito a tu paquete.",
      creditRestored: !isLate,
    });
  } catch (err) {
    console.error("DELETE bookings error:", err.message, err.stack);
    return res.status(500).json({ message: "Error interno", detail: err.message });
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
app.post("/api/orders/:id/proof", authMiddleware, upload.any(), async (req, res) => {
  try {
    const orderRes = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ message: "Orden no encontrada" });

    // Accept any uploaded field name ("proof", "file", etc.)
    const uploadedFile = req.files?.[0] ?? req.file ?? null;

    let fileUrl, fileName, mimeType;
    if (uploadedFile) {
      mimeType = uploadedFile.mimetype;
      fileName = uploadedFile.originalname;
      fileUrl = `data:${mimeType};base64,${uploadedFile.buffer.toString("base64")}`;
    } else if (req.body.fileUrl) {
      fileUrl = req.body.fileUrl;
      fileName = req.body.fileName || "comprobante";
      mimeType = req.body.mimeType || "application/octet-stream";
    } else {
      return res.status(400).json({ message: "No se recibió ningún archivo" });
    }

    const updateRes = await pool.query(
      `UPDATE payment_proofs 
       SET file_url = $2, file_name = $3, mime_type = $4, status = 'pending', uploaded_at = NOW()
       WHERE order_id = $1 RETURNING id`,
      [req.params.id, fileUrl, fileName, mimeType]
    );

    if (updateRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO payment_proofs (order_id, file_url, file_name, mime_type, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [req.params.id, fileUrl, fileName, mimeType]
      );
    }
    await pool.query(
      "UPDATE orders SET status = 'pending_verification', paid_at = COALESCE(paid_at, NOW()) WHERE id = $1",
      [req.params.id]
    );
    return res.json({ message: "Comprobante recibido — estamos verificando tu pago" });
  } catch (err) {
    console.error("POST orders/proof error:", err.message, err.stack);
    return res.status(500).json({ message: "Error interno", detail: err.message });
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
      "SELECT COALESCE(SUM(CASE WHEN type='earn' THEN points WHEN type='adjust' THEN points ELSE -points END), 0) AS total FROM loyalty_transactions WHERE user_id = $1",
      [req.userId]
    );
    const total = parseInt(pointsRes.rows[0].total);
    // QR data: user ID encoded
    const qrData = Buffer.from(req.userId).toString("base64");
    return res.json({ data: { points: total, qr_code: qrData } });
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
      `SELECT lt.*,
              CASE WHEN lt.type = 'earn' OR lt.points > 0 THEN 'earned' ELSE 'redeemed' END AS movement_type
       FROM loyalty_transactions lt
       WHERE lt.user_id = $1
       ORDER BY lt.created_at DESC
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
      "SELECT * FROM loyalty_rewards WHERE is_active = true ORDER BY points_cost ASC"
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
      "SELECT * FROM loyalty_rewards WHERE id = $1 AND is_active = true",
      [rewardId]
    );
    if (rewardRes.rows.length === 0) return res.status(404).json({ message: "Recompensa no encontrada" });
    const reward = rewardRes.rows[0];
    // Check user balance from loyalty_transactions
    const balanceRes = await pool.query(
      "SELECT COALESCE(SUM(CASE WHEN type='earn' THEN points WHEN type='adjust' THEN points ELSE -points END), 0) AS balance FROM loyalty_transactions WHERE user_id = $1",
      [req.userId]
    );
    const balance = parseInt(balanceRes.rows[0].balance);
    if (balance < reward.points_cost) {
      return res.status(400).json({ message: `Necesitas ${reward.points_cost} puntos. Tienes ${balance}.` });
    }
    // Deduct points via loyalty_transactions (type=redeem)
    await pool.query(
      "INSERT INTO loyalty_transactions (user_id, type, points, description) VALUES ($1, 'redeem', $2, $3)",
      [req.userId, reward.points_cost, `Canje: ${reward.name}`]
    );
    // Decrement stock if limited
    if (reward.stock !== null) {
      await pool.query("UPDATE loyalty_rewards SET stock = stock - 1 WHERE id = $1 AND stock > 0", [rewardId]);
    }
    return res.json({ message: `¡Recompensa canjeada! ${reward.name}` });
  } catch (err) {
    console.error("Loyalty/redeem error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Google Wallet helpers ──────────────────────────────────────────────────

const SITE_URL = process.env.SITE_URL || "https://ophelia-studio.com.mx";
const GW_ISSUER_ID = process.env.GOOGLE_ISSUER_ID || "";
const GW_SA_EMAIL = process.env.GOOGLE_SA_EMAIL || "";
const GW_SA_PRIVATE_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const GW_ISSUER_NAME = process.env.GOOGLE_ISSUER_NAME || "Ophelia Jump Studio";
const GW_PROGRAM_NAME = process.env.GOOGLE_PROGRAM_NAME || "Ophelia Club";
const GW_HEX_BG = process.env.GOOGLE_HEX_BACKGROUND_COLOR || "#1a0b26";
const GW_CLASS_ID = GW_ISSUER_ID ? `${GW_ISSUER_ID}.ophelia_loyalty_v1` : "";

function isGoogleWalletConfigured() {
  return !!(GW_ISSUER_ID && GW_SA_EMAIL && GW_SA_PRIVATE_KEY);
}

/** Get OAuth2 access token for Google Wallet API using service account */
async function getGoogleWalletAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: GW_SA_EMAIL,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const saJwt = jwt.sign(claim, GW_SA_PRIVATE_KEY, { algorithm: "RS256" });
  const resp = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: saJwt,
  }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  return resp.data.access_token;
}

/** Create or update the Google Wallet Loyalty Class (run once at startup) */
async function ensureGoogleWalletClass() {
  if (!isGoogleWalletConfigured()) return;
  try {
    const token = await getGoogleWalletAccessToken();
    const classObj = {
      id: GW_CLASS_ID,
      issuerName: GW_ISSUER_NAME,
      programName: GW_PROGRAM_NAME,
      programLogo: {
        sourceUri: { uri: `${SITE_URL}/ophelia-logo.png` },
        contentDescription: { defaultValue: { language: "es", value: "Ophelia Jump Studio" } },
      },
      heroImage: {
        sourceUri: { uri: `${SITE_URL}/ophelia-logo-full.png` },
        contentDescription: { defaultValue: { language: "es", value: "Ophelia Jump Studio" } },
      },
      hexBackgroundColor: GW_HEX_BG,
      reviewStatus: "UNDER_REVIEW",
      countryCode: "MX",
      multipleDevicesAndHoldersAllowedStatus: "MULTIPLE_HOLDERS",
      localizedIssuerName: { defaultValue: { language: "es", value: GW_ISSUER_NAME } },
      localizedProgramName: { defaultValue: { language: "es", value: GW_PROGRAM_NAME } },
    };
    // Try to GET the class first
    try {
      await axios.get(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${GW_CLASS_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // If exists, update it
      await axios.put(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${GW_CLASS_ID}`, classObj, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      console.log("✅ Google Wallet loyalty class updated:", GW_CLASS_ID);
    } catch (getErr) {
      if (getErr.response?.status === 404) {
        // Create new class
        await axios.post("https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass", classObj, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        console.log("✅ Google Wallet loyalty class created:", GW_CLASS_ID);
      } else {
        throw getErr;
      }
    }
  } catch (err) {
    console.error("⚠️  Google Wallet class setup error:", err.response?.data || err.message);
  }
}

/** Build a Google Wallet Save URL (JWT) for a user
 *  @param {Object} opts
 *  @param {string} opts.userId
 *  @param {string} opts.userName
 *  @param {number} opts.points
 *  @param {string} opts.qrCode
 *  @param {Object|null} opts.membership  - { plan_name, class_limit, classes_remaining, end_date, start_date }
 *  @param {Object|null} opts.nextBooking - { class_name, instructor_name, date, start_time }
 */
function buildGoogleWalletSaveUrl({ userId, userName, points, qrCode, membership, nextBooking }) {
  const objectId = `${GW_ISSUER_ID}.ophelia_${userId.replace(/-/g, "")}`;

  // ── Determine pass type and details based on membership ──────────────────
  const hasMembership = !!membership;
  const isUnlimited = hasMembership && (membership.class_limit === null || membership.class_limit >= 9999);
  const isPackage = hasMembership && !isUnlimited && membership.class_limit > 1;
  const isSingleClass = hasMembership && !isUnlimited && membership.class_limit === 1;

  // Header label
  let passHeader = "OPHELIA CLUB";
  if (hasMembership) {
    if (isUnlimited) passHeader = "MEMBRESÍA";
    else if (isPackage) passHeader = "PAQUETE";
    else if (isSingleClass) passHeader = "CLASE INDIVIDUAL";
  }

  // ── Build textModulesData rows ───────────────────────────────────────────
  const textModules = [];

  // Row 1: Plan Name
  if (hasMembership) {
    textModules.push({
      id: "plan",
      header: passHeader,
      body: membership.plan_name || "Plan Activo",
    });
  } else {
    textModules.push({
      id: "plan",
      header: "ESTADO",
      body: "Sin membresía activa",
    });
  }

  // Row 2: Vigencia (valid until)
  if (hasMembership && membership.end_date) {
    const endDate = new Date(membership.end_date);
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    const endFormatted = endDate.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
    textModules.push({
      id: "vigencia",
      header: "VIGENTE HASTA",
      body: `${endFormatted} (${daysLeft} días restantes)`,
    });
  }

  // Row 3: Classes info
  if (hasMembership) {
    if (isUnlimited) {
      textModules.push({
        id: "clases",
        header: "CLASES",
        body: "♾️ Ilimitadas",
      });
    } else if (membership.class_limit) {
      const used = Math.max(0, (membership.class_limit || 0) - (membership.classes_remaining || 0));
      textModules.push({
        id: "clases",
        header: "CLASES DISPONIBLES",
        body: `${membership.classes_remaining ?? 0} de ${membership.class_limit} restantes (${used} usadas)`,
      });
    }
  }

  // Row 4: Next class
  if (nextBooking) {
    const bookingDate = new Date(nextBooking.date);
    const dateStr = bookingDate.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = nextBooking.start_time ? String(nextBooking.start_time).substring(0, 5) : "";
    textModules.push({
      id: "next_class",
      header: "PRÓXIMA CLASE",
      body: `${nextBooking.class_name || "Clase"} — ${dateStr} ${timeStr}`,
    });
    if (nextBooking.instructor_name) {
      textModules.push({
        id: "instructor",
        header: "INSTRUCTORA",
        body: nextBooking.instructor_name,
      });
    }
  }

  // Row 5: Points
  textModules.push({
    id: "puntos",
    header: "PUNTOS OPHELIA CLUB",
    body: `${points.toLocaleString("es-MX")} pts`,
  });

  // ── Build loyaltyObject ──────────────────────────────────────────────────
  const loyaltyObject = {
    id: objectId,
    classId: GW_CLASS_ID,
    state: "ACTIVE",
    accountId: userId,
    accountName: userName,
    hexBackgroundColor: GW_HEX_BG,
    barcode: {
      type: "QR_CODE",
      value: qrCode,
      alternateText: "Escanea en recepción",
    },
    loyaltyPoints: {
      balance: { int: points },
      label: "PUNTOS",
    },
    header: {
      defaultValue: { language: "es", value: passHeader },
    },
    textModulesData: textModules,
    linksModuleData: {
      uris: [
        { uri: `${SITE_URL}/app/wallet`, description: "Mi Wallet", id: "wallet_link" },
        { uri: `${SITE_URL}/app/bookings`, description: "Reservar Clase", id: "book_link" },
      ],
    },
    infoModuleData: {
      showLastUpdateTime: true,
      labelValueRows: hasMembership ? [
        {
          columns: [
            { label: "Miembro", value: userName },
            { label: "Plan", value: membership.plan_name || "—" },
          ],
        },
      ] : [
        {
          columns: [
            { label: "Miembro", value: userName },
            { label: "Puntos", value: String(points) },
          ],
        },
      ],
    },
  };

  const payload = {
    iss: GW_SA_EMAIL,
    aud: "google",
    origins: [SITE_URL],
    typ: "savetowallet",
    payload: {
      loyaltyObjects: [loyaltyObject],
    },
  };
  const signedJwt = jwt.sign(payload, GW_SA_PRIVATE_KEY, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${signedJwt}`;
}

// ─── Routes: /api/wallet/google ─────────────────────────────────────────────

// GET /api/wallet/google/save-url — returns Save URL for logged-in user
app.get("/api/wallet/google/save-url", authMiddleware, async (req, res) => {
  if (!isGoogleWalletConfigured()) {
    return res.status(503).json({ message: "Google Wallet no configurado" });
  }
  try {
    // Ensure loyalty class exists (retries if startup creation failed)
    await ensureGoogleWalletClass();

    // Get user info
    const userRes = await pool.query("SELECT id, name, email, full_name, display_name FROM users WHERE id = $1", [req.userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    const user = userRes.rows[0];
    const userName = user.full_name || user.display_name || user.name || user.email;

    // Get points
    const pointsRes = await pool.query(
      "SELECT COALESCE(SUM(CASE WHEN type='earn' THEN points WHEN type='adjust' THEN points ELSE -points END), 0) AS total FROM loyalty_transactions WHERE user_id = $1",
      [req.userId]
    );
    const points = parseInt(pointsRes.rows[0].total);

    // Get active membership with plan info
    let membership = null;
    try {
      const memRes = await pool.query(
        `SELECT m.id, m.status, m.classes_remaining, m.start_date, m.end_date,
                m.plan_name_override, m.class_limit_override,
                p.name AS plan_name, p.class_limit AS plan_class_limit, p.duration_days
         FROM memberships m
         LEFT JOIN plans p ON m.plan_id = p.id
         WHERE m.user_id = $1 AND m.status = 'active' AND m.end_date >= CURRENT_DATE
         ORDER BY m.end_date DESC
         LIMIT 1`,
        [req.userId]
      );
      if (memRes.rows.length > 0) {
        const m = memRes.rows[0];
        membership = {
          plan_name: m.plan_name_override || m.plan_name || "Plan Activo",
          class_limit: m.class_limit_override ?? m.plan_class_limit,
          classes_remaining: m.classes_remaining,
          start_date: m.start_date,
          end_date: m.end_date,
        };
      }
    } catch (memErr) {
      console.error("Wallet: membership query error:", memErr.message);
    }

    // Get next confirmed booking
    let nextBooking = null;
    try {
      const bookRes = await pool.query(
        `SELECT c.date, c.start_time, ct.name AS class_name,
                COALESCE(i.display_name, i.full_name) AS instructor_name
         FROM bookings b
         JOIN classes c ON b.class_id = c.id
         JOIN class_types ct ON c.class_type_id = ct.id
         LEFT JOIN instructors i ON c.instructor_id = i.id
         WHERE b.user_id = $1
           AND b.status IN ('confirmed', 'waitlist')
           AND c.date >= CURRENT_DATE
         ORDER BY c.date ASC, c.start_time ASC
         LIMIT 1`,
        [req.userId]
      );
      if (bookRes.rows.length > 0) {
        nextBooking = bookRes.rows[0];
      }
    } catch (bookErr) {
      console.error("Wallet: booking query error:", bookErr.message);
    }

    const qrCode = Buffer.from(req.userId).toString("base64");
    const saveUrl = buildGoogleWalletSaveUrl({
      userId: req.userId,
      userName,
      points,
      qrCode,
      membership,
      nextBooking,
    });
    return res.json({ data: { saveUrl } });
  } catch (err) {
    console.error("Google Wallet save-url error:", err.response?.data || err.message);
    return res.status(500).json({ message: "Error generando pase de Google Wallet" });
  }
});

// GET /api/wallet/google/diagnostics — check env config
app.get("/api/wallet/google/diagnostics", async (_req, res) => {
  return res.json({
    configured: isGoogleWalletConfigured(),
    issuerId: GW_ISSUER_ID ? "✅ set" : "❌ missing",
    saEmail: GW_SA_EMAIL ? "✅ set" : "❌ missing",
    saPrivateKey: GW_SA_PRIVATE_KEY ? "✅ set" : "❌ missing",
    classId: GW_CLASS_ID || "N/A",
    issuerName: GW_ISSUER_NAME,
    programName: GW_PROGRAM_NAME,
  });
});

// ─── Apple Wallet config ────────────────────────────────────────────────────

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || "";
const APPLE_PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID || "";
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || "";
const APPLE_APNS_KEY_BASE64 = process.env.APPLE_APNS_KEY_BASE64 || "";
const APPLE_AUTH_TOKEN = process.env.APPLE_AUTH_TOKEN || "";

function isAppleWalletConfigured() {
  return !!(APPLE_TEAM_ID && APPLE_PASS_TYPE_ID && APPLE_KEY_ID && APPLE_APNS_KEY_BASE64 && APPLE_AUTH_TOKEN);
}

// Apple Wallet Web Service endpoints (protocol V1)
// These allow iOS to register devices, check for updates, and download updated passes
// Note: .pkpass generation requires a signing certificate (.p12) not provided yet

// POST /api/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serial
app.post("/api/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serial", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("ApplePass ") || authHeader.replace("ApplePass ", "") !== APPLE_AUTH_TOKEN) {
    return res.status(401).send("Unauthorized");
  }
  const { deviceId, serial } = req.params;
  const pushToken = req.body?.pushToken || "";
  try {
    await pool.query(`
      INSERT INTO apple_wallet_devices (device_id, push_token, pass_type_id, serial_number)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (device_id, pass_type_id, serial_number) DO UPDATE SET push_token = $2, updated_at = NOW()
    `, [deviceId, pushToken, APPLE_PASS_TYPE_ID, serial]);
    return res.status(201).send();
  } catch (err) {
    console.error("Apple register device error:", err);
    return res.status(500).send();
  }
});

// GET /api/wallet/v1/devices/:deviceId/registrations/:passTypeId
app.get("/api/wallet/v1/devices/:deviceId/registrations/:passTypeId", async (req, res) => {
  const { deviceId } = req.params;
  try {
    const r = await pool.query(
      "SELECT serial_number, updated_at FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2",
      [deviceId, APPLE_PASS_TYPE_ID]
    );
    if (r.rows.length === 0) return res.status(204).send();
    return res.json({
      serialNumbers: r.rows.map((d) => d.serial_number),
      lastUpdated: r.rows[0].updated_at?.toISOString() || new Date().toISOString(),
    });
  } catch (err) {
    console.error("Apple list passes error:", err);
    return res.status(500).send();
  }
});

// GET /api/wallet/v1/passes/:passTypeId/:serial — download updated pass
app.get("/api/wallet/v1/passes/:passTypeId/:serial", async (req, res) => {
  // .pkpass generation requires signing certificate - placeholder for now
  return res.status(501).json({ message: "Pass generation not yet configured — signing certificate needed" });
});

// DELETE /api/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serial
app.delete("/api/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serial", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("ApplePass ") || authHeader.replace("ApplePass ", "") !== APPLE_AUTH_TOKEN) {
    return res.status(401).send("Unauthorized");
  }
  const { deviceId, serial } = req.params;
  try {
    await pool.query(
      "DELETE FROM apple_wallet_devices WHERE device_id = $1 AND pass_type_id = $2 AND serial_number = $3",
      [deviceId, APPLE_PASS_TYPE_ID, serial]
    );
    return res.status(200).send();
  } catch (err) {
    console.error("Apple unregister device error:", err);
    return res.status(500).send();
  }
});

// POST /api/wallet/v1/log — Apple Wallet error log
app.post("/api/wallet/v1/log", (req, res) => {
  console.log("Apple Wallet log:", JSON.stringify(req.body));
  return res.status(200).send();
});

// GET /api/wallet/apple/status — check Apple Wallet config
app.get("/api/wallet/apple/status", async (_req, res) => {
  return res.json({
    configured: isAppleWalletConfigured(),
    teamId: APPLE_TEAM_ID ? "✅ set" : "❌ missing",
    passTypeId: APPLE_PASS_TYPE_ID || "N/A",
    keyId: APPLE_KEY_ID ? "✅ set" : "❌ missing",
    apnsKey: APPLE_APNS_KEY_BASE64 ? "✅ set" : "❌ missing",
    authToken: APPLE_AUTH_TOKEN ? "✅ set" : "❌ missing",
    note: "Para generar .pkpass se necesita el certificado de firma (.p12) del Pass Type ID",
  });
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
      displayName, phone, dateOfBirth, gender,
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
         gender                    = COALESCE($12, gender),
         updated_at                = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        displayName || null, phone || null, dateOfBirth || null,
        emergencyContactName || null, emergencyContactPhone || null, healthNotes || null,
        receiveReminders ?? null, receivePromotions ?? null, receiveWeeklySummary ?? null,
        acceptsCommunications ?? null,
        newRole,
        gender || null,
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
  const { name, color, category, defaultDuration, maxCapacity, isActive } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name requerido" });
  const validCategories = ["jumping", "pilates"];
  const cat = validCategories.includes(category) ? category : "jumping";
  try {
    const r = await pool.query(
      `INSERT INTO class_types (name, color, category, duration_min, capacity, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,0) RETURNING *`,
      [name.trim(), color || "#c026d3", cat, defaultDuration || 60, maxCapacity || 20, isActive !== false]
    );
    return res.status(201).json({ data: camelRow(r.rows[0]) });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// PUT /api/class-types/:id — alias CRUD (admin)
app.put("/api/class-types/:id", adminMiddleware, async (req, res) => {
  const { name, color, category, defaultDuration, maxCapacity, isActive } = req.body;
  const validCategories = ["jumping", "pilates"];
  const cat = validCategories.includes(category) ? category : null;
  try {
    const r = await pool.query(
      `UPDATE class_types SET name=COALESCE($1,name), color=COALESCE($2,color),
       category=COALESCE($3,category),
       duration_min=COALESCE($4,duration_min), capacity=COALESCE($5,capacity),
       is_active=COALESCE($6,is_active), updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name || null, color || null, cat, defaultDuration || null, maxCapacity || null, isActive ?? null, req.params.id]
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
    const { classTypeId, instructorId, startTime, endTime, maxCapacity, capacity, notes } = req.body;
    if (!classTypeId) return res.status(400).json({ message: "classTypeId requerido" });
    if (!instructorId) return res.status(400).json({ message: "instructorId requerido" });

    // startTime may come as a full ISO/datetime-local string "YYYY-MM-DDTHH:mm"
    // The classes table uses separate DATE and TIME columns
    let dateStr, startTimeStr, endTimeStr;
    if (startTime && startTime.includes("T")) {
      const [d, t] = startTime.split("T");
      dateStr = d;
      startTimeStr = t.slice(0, 5); // "HH:mm"
    } else {
      return res.status(400).json({ message: "startTime debe ser datetime (YYYY-MM-DDTHH:mm)" });
    }
    if (endTime && endTime.includes("T")) {
      endTimeStr = endTime.split("T")[1].slice(0, 5);
    } else if (endTime && endTime.length === 5) {
      endTimeStr = endTime; // already "HH:mm"
    } else {
      // default +55 min
      const [h, m] = startTimeStr.split(":").map(Number);
      const total = h * 60 + m + 55;
      endTimeStr = String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
    }
    const cap = maxCapacity ?? capacity ?? 10;
    const r = await pool.query(
      `INSERT INTO classes (class_type_id, instructor_id, date, start_time, end_time, max_capacity, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled') RETURNING *`,
      [classTypeId, instructorId, dateStr, startTimeStr, endTimeStr, cap, notes || null]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { console.error("POST /classes error:", err); return res.status(500).json({ message: "Error interno" }); }
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
      "INSERT INTO orders (user_id, subtotal, tax_amount, total_amount, payment_method, status, discount_amount, channel) VALUES ($1,$2,0,$3,$4,'approved',$5,'pos') RETURNING *",
      [userId || null, subtotal, total, paymentMethod, discountAmount]
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
    const defaults = { enabled: true, points_per_class: 10, points_per_peso: 1, welcome_bonus: 50, birthday_bonus: 100 };
    return res.json({ data: r.rows.length ? { ...defaults, ...r.rows[0].value } : defaults });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/loyalty/config", adminMiddleware, async (req, res) => {
  try {
    // Strip referral_bonus if accidentally sent
    const { referral_bonus, pointsPerReferral, ...clean } = req.body;
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('loyalty_config', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(clean)]
    );
    return res.json({ data: clean });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// POST /api/loyalty/rewards — admin CRUD for loyalty rewards
app.post("/api/loyalty/rewards", adminMiddleware, async (req, res) => {
  try {
    const { name, description, points_cost, reward_type = "custom", reward_value = "", is_active = true, stock = null } = req.body;
    if (!name || !points_cost) return res.status(400).json({ message: "name y points_cost requeridos" });
    const r = await pool.query(
      "INSERT INTO loyalty_rewards (name, description, points_cost, reward_type, reward_value, stock, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [name, description || null, points_cost, reward_type, reward_value || null, stock || null, is_active]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) { console.error("loyalty rewards POST:", err); return res.status(500).json({ message: "Error interno" }); }
});

app.put("/api/loyalty/rewards/:id", adminMiddleware, async (req, res) => {
  try {
    const { name, description, points_cost, reward_type, reward_value, stock, is_active } = req.body;
    const r = await pool.query(
      "UPDATE loyalty_rewards SET name=$1, description=$2, points_cost=$3, reward_type=$4, reward_value=$5, stock=$6, is_active=$7 WHERE id=$8 RETURNING *",
      [name, description || null, points_cost, reward_type || "custom", reward_value || null, stock || null, is_active !== false, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Recompensa no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { console.error("loyalty rewards PUT:", err); return res.status(500).json({ message: "Error interno" }); }
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
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status='approved' AND created_at>=$1", [monthStart]),
      pool.query("SELECT COUNT(*) FROM bookings WHERE created_at>=$1", [monthStart]),
      pool.query("SELECT COUNT(*) FROM classes WHERE status='scheduled' AND date>=$1", [monthStart]),
    ]);
    return res.json({
      data: {
        activeMembers: parseInt(members.rows[0].count),
        monthlyRevenue: parseFloat(revenue.rows[0].total),
        monthlyBookings: parseInt(bookings.rows[0].count),
        upcomingClasses: parseInt(classes.rows[0].count),
      }
    });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

app.get("/api/reports/revenue", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT DATE_TRUNC('month', created_at) AS month, SUM(total_amount) AS total, COUNT(*) AS count
       FROM orders WHERE status='approved'
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
    await pool.query("DELETE FROM review_tags WHERE id=$1", [req.params.id]).catch(() => { });
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

// ─── Evolution API (WhatsApp) ─────────────────────────────────────────────────

// Helper: normalise phone to WhatsApp format (521XXXXXXXXXX for MX)
function normalisePhone(raw) {
  let phone = String(raw).replace(/\D/g, "");
  if (phone.startsWith("52") && phone.length === 12) return phone; // already 521XXXXXXXXXX or 52XXXXXXXXXX
  if (phone.length === 10) return "52" + phone; // local MX 10 digits
  return phone;
}

// Webhook (no auth) — receives Evolution API events
app.post("/api/webhook/evolution", async (req, res) => {
  try {
    const body = req.body;
    console.log("[EVOLUTION WEBHOOK]", JSON.stringify(body).slice(0, 400));
    // TODO: handle inbound messages / delivery receipts
    return res.sendStatus(200);
  } catch (err) {
    console.error("[EVOLUTION WEBHOOK ERROR]", err.message);
    return res.sendStatus(200);
  }
});

// GET /api/evolution/status
app.get("/api/evolution/status", adminMiddleware, async (req, res) => {
  try {
    // Check if instance exists first
    let instanceExists = false;
    try {
      const listRes = await evolutionApi.get("/instance/fetchInstances");
      const instances = listRes.data?.data || listRes.data || [];
      instanceExists = Array.isArray(instances)
        ? instances.some((i) => i.instance?.instanceName === EVOLUTION_INSTANCE || i.name === EVOLUTION_INSTANCE)
        : false;
    } catch (_) { instanceExists = false; }

    if (!instanceExists) {
      return res.json({ data: { connected: false, state: "disconnected", instanceExists: false } });
    }

    const r = await evolutionApi.get(`/instance/connectionState/${EVOLUTION_INSTANCE}`);
    const state = r.data?.instance?.state || r.data?.state || "unknown";

    let qrCode = null;
    if (state === "connecting" || state === "qr") {
      try {
        const qrRes = await evolutionApi.get(`/instance/connect/${EVOLUTION_INSTANCE}`);
        qrCode = qrRes.data?.code || qrRes.data?.qrcode?.base64 || null;
      } catch (_) { }
    }

    return res.json({
      data: {
        connected: state === "open",
        state: state === "open" ? "connected" : state === "qr" || state === "connecting" ? "qr_pending" : "disconnected",
        number: r.data?.instance?.profileName || null,
        instanceExists: true,
        qrCode,
      },
    });
  } catch (err) {
    console.error("[EVOLUTION STATUS]", err.response?.data || err.message);
    return res.json({ data: { connected: false, state: "disconnected", instanceExists: false } });
  }
});

// POST /api/evolution/connect — create instance (or fetch QR if already exists)
app.post("/api/evolution/connect", adminMiddleware, async (req, res) => {
  try {
    // Try creating the instance
    try {
      await evolutionApi.post("/instance/create", {
        instanceName: EVOLUTION_INSTANCE,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      });
    } catch (createErr) {
      // 409 = already exists, ignore
      if (createErr.response?.status !== 409) {
        console.error("[EVOLUTION CREATE]", createErr.response?.data || createErr.message);
      }
    }

    // Get QR
    const qrRes = await evolutionApi.get(`/instance/connect/${EVOLUTION_INSTANCE}`);
    const qrCode = qrRes.data?.code || qrRes.data?.qrcode?.base64 || null;

    return res.json({ data: { qrCode, state: "qr_pending", message: "Escanea el código QR con WhatsApp" } });
  } catch (err) {
    console.error("[EVOLUTION CONNECT]", err.response?.data || err.message);
    return res.status(500).json({ message: "Error al conectar con Evolution API" });
  }
});

// POST /api/evolution/disconnect
app.post("/api/evolution/disconnect", adminMiddleware, async (req, res) => {
  try {
    await evolutionApi.delete(`/instance/logout/${EVOLUTION_INSTANCE}`);
    return res.json({ data: { message: "WhatsApp desconectado correctamente" } });
  } catch (err) {
    // If instance not found it's already disconnected
    if (err.response?.status === 404) {
      return res.json({ data: { message: "Ya estaba desconectado" } });
    }
    console.error("[EVOLUTION DISCONNECT]", err.response?.data || err.message);
    return res.status(500).json({ message: "Error al desconectar WhatsApp" });
  }
});

// POST /api/evolution/send-test  { phone: "5219XXXXXXXXX" }
app.post("/api/evolution/send-test", adminMiddleware, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Se requiere número de teléfono" });
    const number = normalisePhone(phone);
    await evolutionApi.post(`/message/sendText/${EVOLUTION_INSTANCE}`, {
      number,
      text: "✅ Mensaje de prueba desde Ophelia Jump Studio. ¡WhatsApp conectado correctamente!",
    });
    return res.json({ data: { message: "Mensaje de prueba enviado correctamente" } });
  } catch (err) {
    console.error("[EVOLUTION SEND-TEST]", err.response?.data || err.message);
    return res.status(500).json({ message: "Error al enviar mensaje de prueba" });
  }
});

// POST /api/evolution/send-message  { phone, message }
app.post("/api/evolution/send-message", adminMiddleware, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ message: "Se requieren teléfono y mensaje" });
    const number = normalisePhone(phone);
    await evolutionApi.post(`/message/sendText/${EVOLUTION_INSTANCE}`, { number, text: message });
    return res.json({ data: { message: "Mensaje enviado", number } });
  } catch (err) {
    console.error("[EVOLUTION SEND-MSG]", err.response?.data || err.message);
    return res.status(500).json({ message: "Error al enviar mensaje" });
  }
});

// POST /api/evolution/notify-clients  { filter: "all"|"members"|"active", message }
app.post("/api/evolution/notify-clients", adminMiddleware, async (req, res) => {
  try {
    const { filter = "all", message } = req.body;
    if (!message) return res.status(400).json({ message: "El mensaje es requerido" });

    let query;
    if (filter === "members") {
      query = `SELECT DISTINCT u.id, u.name, u.phone FROM users u
               JOIN memberships m ON m.user_id = u.id
               WHERE u.role = 'client' AND u.phone IS NOT NULL AND u.phone != ''
               AND m.status = 'active'`;
    } else if (filter === "active") {
      query = `SELECT DISTINCT u.id, u.name, u.phone FROM users u
               JOIN bookings b ON b.user_id = u.id
               WHERE u.role = 'client' AND u.phone IS NOT NULL AND u.phone != ''
               AND b.status IN ('confirmed','attended')
               AND b.created_at > NOW() - INTERVAL '60 days'`;
    } else {
      query = `SELECT id, name, phone FROM users
               WHERE role = 'client' AND phone IS NOT NULL AND phone != ''`;
    }

    const clients = (await pool.query(query)).rows;
    if (!clients.length) return res.json({ data: { sent: 0, failed: 0, total: 0, message: "No hay clientes con teléfono registrado" } });

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const client of clients) {
      try {
        const number = normalisePhone(client.phone);
        await evolutionApi.post(`/message/sendText/${EVOLUTION_INSTANCE}`, { number, text: message });
        sent++;
        // Small delay to avoid rate-limiting
        await new Promise((r) => setTimeout(r, 300));
      } catch (sendErr) {
        failed++;
        errors.push({ name: client.name, phone: client.phone, error: sendErr.response?.data?.message || sendErr.message });
      }
    }

    return res.json({ data: { sent, failed, total: clients.length, errors: errors.slice(0, 10) } });
  } catch (err) {
    console.error("[EVOLUTION NOTIFY-CLIENTS]", err.response?.data || err.message);
    return res.status(500).json({ message: "Error al enviar notificaciones" });
  }
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

// POST /api/videos/upload  — upload video file (+ optional thumbnail) to Google Drive
app.post("/api/videos/upload", adminMiddleware, uploadVideo.fields([{ name: "video", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), async (req, res) => {
  try {
    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];
    if (!videoFile) return res.status(400).json({ message: "Se requiere el archivo de video" });

    const isDriveConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
    );
    if (!isDriveConfigured) {
      return res.status(503).json({ message: "Google Drive no configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN en Railway." });
    }

    const accessToken = await getGoogleDriveAccessToken();

    // Upload video using resumable upload (streams from disk in 5 MB chunks)
    const videoResult = await uploadFileToDriveResumable(
      videoFile.path,
      videoFile.originalname,
      videoFile.mimetype,
      accessToken
    );
    // Clean up temp file
    fs.unlink(videoFile.path, () => {});
    await makeGoogleDriveFilePublic(videoResult.id, accessToken);

    // Upload thumbnail (optional) — small file, use buffer multipart
    let thumbnailUrl = `https://drive.google.com/thumbnail?id=${videoResult.id}&sz=w640`;
    let thumbnailDriveId = "";
    if (thumbnailFile) {
      const thumbBuffer = fs.readFileSync(thumbnailFile.path);
      const thumbResult = await uploadBufferToDrive(
        thumbBuffer,
        thumbnailFile.originalname,
        thumbnailFile.mimetype,
        accessToken
      );
      fs.unlink(thumbnailFile.path, () => {});
      await makeGoogleDriveFilePublic(thumbResult.id, accessToken);
      thumbnailUrl = `https://drive.google.com/thumbnail?id=${thumbResult.id}&sz=w640`;
      thumbnailDriveId = thumbResult.id;
    }

    return res.json({
      drive_file_id: videoResult.id,
      cloudinary_id: videoResult.id,           // same value for compat
      thumbnail_url: thumbnailUrl,
      thumbnail_drive_id: thumbnailDriveId,
      secure_url: `https://drive.google.com/file/d/${videoResult.id}/view`,
      embed_url: `https://drive.google.com/file/d/${videoResult.id}/preview`,
      duration_seconds: 0,
    });
  } catch (err) {
    // Clean up temp files on error
    if (req.files?.video?.[0]?.path) fs.unlink(req.files.video[0].path, () => {});
    if (req.files?.thumbnail?.[0]?.path) fs.unlink(req.files.thumbnail[0].path, () => {});
    console.error("Video upload error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Error al subir video: " + (err?.response?.data?.error?.message || err.message) });
  }
});

app.post("/api/videos", adminMiddleware, async (req, res) => {
  try {
    const {
      title, description, subtitle, tagline, days, brand_color,
      drive_file_id, cloudinary_id, thumbnail_url, thumbnail_drive_id,
      class_type_id, instructor_id, duration_seconds,
      access_type = "free", is_published = false, is_featured = false, sort_order = 0,
      sales_enabled = false, sales_unlocks_video = false, sales_price_mxn, sales_class_credits, sales_cta_text,
      category_id,
    } = req.body;
    if (!title) return res.status(400).json({ message: "title es requerido" });
    const r = await pool.query(
      `INSERT INTO videos (
         title, description, subtitle, tagline, days, brand_color,
         drive_file_id, cloudinary_id, thumbnail_url, thumbnail_drive_id,
         class_type_id, instructor_id, duration_seconds,
         access_type, is_published, is_featured, sort_order,
         sales_enabled, sales_unlocks_video, sales_price_mxn, sales_class_credits, sales_cta_text
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        title, description || null, subtitle || null, tagline || null, days || null, brand_color || null,
        drive_file_id || null, cloudinary_id || drive_file_id || null, thumbnail_url || null, thumbnail_drive_id || null,
        class_type_id || category_id || null, instructor_id || null, duration_seconds || 0,
        access_type, is_published, is_featured, sort_order,
        sales_enabled, sales_unlocks_video, sales_price_mxn || null, sales_class_credits || null, sales_cta_text || null,
      ]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error("POST /videos error:", err.message);
    return res.status(500).json({ message: "Error interno" });
  }
});

app.put("/api/videos/:id", adminMiddleware, async (req, res) => {
  try {
    const {
      title, description, subtitle, tagline, days, brand_color,
      drive_file_id, cloudinary_id, thumbnail_url, thumbnail_drive_id,
      class_type_id, instructor_id, duration_seconds,
      access_type, is_published, is_featured, sort_order,
      sales_enabled, sales_unlocks_video, sales_price_mxn, sales_class_credits, sales_cta_text,
      category_id,
    } = req.body;
    const r = await pool.query(
      `UPDATE videos SET
         title=$1, description=$2, subtitle=$3, tagline=$4, days=$5, brand_color=$6,
         drive_file_id=COALESCE($7, drive_file_id),
         cloudinary_id=COALESCE($8, cloudinary_id),
         thumbnail_url=COALESCE($9, thumbnail_url),
         thumbnail_drive_id=COALESCE($10, thumbnail_drive_id),
         class_type_id=$11, instructor_id=$12,
         duration_seconds=COALESCE($13, duration_seconds),
         access_type=COALESCE($14, access_type),
         is_published=COALESCE($15, is_published),
         is_featured=COALESCE($16, is_featured),
         sort_order=COALESCE($17, sort_order),
         sales_enabled=COALESCE($18, sales_enabled),
         sales_unlocks_video=COALESCE($19, sales_unlocks_video),
         sales_price_mxn=$20, sales_class_credits=$21, sales_cta_text=$22,
         updated_at=NOW()
       WHERE id=$23 RETURNING *`,
      [
        title, description || null, subtitle || null, tagline || null, days || null, brand_color || null,
        drive_file_id || null, cloudinary_id || drive_file_id || null,
        thumbnail_url || null, thumbnail_drive_id || null,
        class_type_id || category_id || null, instructor_id || null,
        duration_seconds ?? null,
        access_type || null, is_published ?? null, is_featured ?? null, sort_order ?? null,
        sales_enabled ?? null, sales_unlocks_video ?? null,
        sales_price_mxn ?? null, sales_class_credits ?? null, sales_cta_text ?? null,
        req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Video no encontrado" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PUT /videos/:id error:", err.message);
    return res.status(500).json({ message: "Error interno" });
  }
});

app.delete("/api/videos/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM videos WHERE id=$1", [req.params.id]);
    return res.json({ message: "Video eliminado" });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Homepage Video Cards ────────────────────────────────────────────────────
// GET /api/homepage-video-cards  (public)
app.get("/api/homepage-video-cards", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM homepage_video_cards ORDER BY sort_order ASC");
    return res.json({ data: r.rows });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// PUT /api/homepage-video-cards/:id  (admin — text fields)
app.put("/api/homepage-video-cards/:id", adminMiddleware, async (req, res) => {
  try {
    const { title, description, emoji } = req.body;
    if (!title || !description) return res.status(400).json({ message: "title y description requeridos" });
    const r = await pool.query(
      `UPDATE homepage_video_cards
       SET title=$1, description=$2, emoji=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [title.trim(), description.trim(), (emoji || "🎬").trim(), req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Tarjeta no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// ─── Direct-to-Drive Upload (bypasses Railway proxy for large files) ────────

// POST /api/drive/init-upload — returns a Google Drive resumable session URL
// The browser then uploads the file directly to googleapis.com
app.post("/api/drive/init-upload", adminMiddleware, async (req, res) => {
  try {
    const { fileName, mimeType, fileSize } = req.body;
    if (!fileName || !mimeType) {
      return res.status(400).json({ message: "fileName y mimeType son requeridos" });
    }

    const isDriveConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
    );
    if (!isDriveConfigured) {
      return res.status(503).json({ message: "Google Drive no configurado" });
    }

    const accessToken = await getGoogleDriveAccessToken();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    const metadata = { name: fileName, ...(folderId ? { parents: [folderId] } : {}) };

    // Initiate a resumable upload session on Google Drive
    const initResp = await axios.post(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
      metadata,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          ...(fileSize ? { "X-Upload-Content-Length": String(fileSize) } : {}),
        },
      }
    );

    const uploadUrl = initResp.headers.location;
    if (!uploadUrl) {
      return res.status(500).json({ message: "No se obtuvo URL de subida de Google Drive" });
    }

    return res.json({
      data: {
        uploadUrl,          // browser sends PUT chunks here
        accessToken,        // browser needs this for the PUT requests
        folderId,
      },
    });
  } catch (err) {
    console.error("Drive init-upload error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Error al iniciar subida: " + (err?.response?.data?.error?.message || err.message) });
  }
});

// POST /api/drive/make-public/:fileId — make a Drive file publicly readable
app.post("/api/drive/make-public/:fileId", adminMiddleware, async (req, res) => {
  try {
    const accessToken = await getGoogleDriveAccessToken();
    await makeGoogleDriveFilePublic(req.params.fileId, accessToken);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Drive make-public error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Error al hacer público el archivo" });
  }
});

// POST /api/homepage-video-cards/:id/set-drive-video — save Drive file ID to card
app.post("/api/homepage-video-cards/:id/set-drive-video", adminMiddleware, async (req, res) => {
  try {
    const { driveFileId } = req.body;
    if (!driveFileId) return res.status(400).json({ message: "driveFileId requerido" });

    const videoUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
    const r = await pool.query(
      `UPDATE homepage_video_cards SET video_url=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [videoUrl, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Tarjeta no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/homepage-video-cards/:id/upload  (admin — upload video file, max 500 MB)
app.post("/api/homepage-video-cards/:id/upload", adminMiddleware, (req, res, next) => {
  uploadVideo.single("video")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: `El archivo es demasiado grande. Máximo ${VIDEO_MAX_MB} MB.` });
      }
      return res.status(400).json({ message: err.message || "Error al procesar archivo" });
    }
    next();
  });
}, async (req, res) => {
  try {
    const videoFile = req.file;
    if (!videoFile) return res.status(400).json({ message: "Se requiere un archivo de video" });

    const isDriveConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
    );

    let videoUrl;

    if (isDriveConfigured) {
      // Upload to Google Drive using resumable upload (streams in 5 MB chunks)
      const accessToken = await getGoogleDriveAccessToken();
      const result = await uploadFileToDriveResumable(
        videoFile.path,
        `homepage_card_${req.params.id}_${Date.now()}_${videoFile.originalname}`,
        videoFile.mimetype,
        accessToken
      );
      // Clean up temp file
      fs.unlink(videoFile.path, () => {});
      await makeGoogleDriveFilePublic(result.id, accessToken);
      videoUrl = `https://drive.google.com/file/d/${result.id}/preview`;
    } else {
      if (videoFile.path) fs.unlink(videoFile.path, () => {});
      return res.status(503).json({
        message: "Google Drive no está configurado. Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN para subir videos.",
      });
    }

    // Save video_url to DB
    const r = await pool.query(
      `UPDATE homepage_video_cards SET video_url=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [videoUrl, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Tarjeta no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    // Clean up temp file on error
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error("Homepage card video upload error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Error al subir video: " + (err?.response?.data?.error?.message || err.message) });
  }
});

// DELETE /api/homepage-video-cards/:id/video  (admin — remove video)
app.delete("/api/homepage-video-cards/:id/video", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE homepage_video_cards SET video_url=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Tarjeta no encontrada" });
    return res.json({ data: r.rows[0] });
  } catch (err) { return res.status(500).json({ message: "Error interno" }); }
});

// GET /api/admin/stats
app.get("/api/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const [classesToday, activeMembers, monthlyRevenue, pendingAlerts] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM classes WHERE date = $1", [today]),
      pool.query("SELECT COUNT(*) FROM memberships WHERE status = 'active'"),
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status = 'approved' AND created_at >= $1", [monthStart]),
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
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (display_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    q += " ORDER BY display_name ASC LIMIT 200";
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
    const { status, limit = 100 } = req.query;
    let q = `SELECT m.*, u.display_name AS user_name, p.name AS plan_name,
                    p.class_limit, p.duration_days, p.class_category
             FROM memberships m
             LEFT JOIN users u ON m.user_id = u.id
             LEFT JOIN plans p ON m.plan_id = p.id
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND m.status = $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    return res.json({
      data: r.rows.map(m => ({
        id: m.id,
        userId: m.user_id,
        userName: m.user_name ?? m.user_id,
        planId: m.plan_id,
        planName: m.plan_name ?? m.plan_id,
        classCategory: m.class_category ?? "all",
        status: m.status,
        paymentMethod: m.payment_method,
        startDate: m.start_date,
        endDate: m.end_date,
        classesRemaining: m.classes_remaining,
        classLimit: m.class_limit,
        createdAt: m.created_at,
      }))
    });
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
      [userId, planId, paymentMethod, start.toISOString(), end.toISOString(), plan.class_limit ?? null]
    );

    // ── Email: membership activated ──────────────────────────────────────
    try {
      const uRes = await pool.query("SELECT email, full_name, display_name FROM users WHERE id = $1", [userId]);
      if (uRes.rows[0]) {
        const u = uRes.rows[0];
        sendMembershipActivated({
          to: u.email,
          name: u.full_name || u.display_name || "Alumna",
          planName: plan.name,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          classLimit: plan.class_limit ?? null,
        }).catch((e) => console.error("[Email] membership activated:", e.message));
      }
    } catch (emailErr) {
      console.error("[Email] membership create query:", emailErr.message);
    }

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
      `UPDATE memberships SET status = 'active', updated_at = NOW() WHERE id = $1
       RETURNING *, (SELECT name FROM plans WHERE id = memberships.plan_id) AS plan_name,
                    (SELECT class_limit FROM plans WHERE id = memberships.plan_id) AS plan_class_limit`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Membresía no encontrada" });
    const mem = r.rows[0];

    // ── Email: membership activated ──────────────────────────────────────
    try {
      const uRes = await pool.query("SELECT email, full_name, display_name FROM users WHERE id = $1", [mem.user_id]);
      if (uRes.rows[0]) {
        const u = uRes.rows[0];
        sendMembershipActivated({
          to: u.email,
          name: u.full_name || u.display_name || "Alumna",
          planName: mem.plan_name || mem.plan_name_override || "Tu membresía",
          startDate: mem.start_date,
          endDate: mem.end_date,
          classLimit: mem.plan_class_limit ?? mem.class_limit_override ?? null,
        }).catch((e) => console.error("[Email] membership activate:", e.message));
      }
    } catch (emailErr) {
      console.error("[Email] activate query:", emailErr.message);
    }

    return res.json({ data: mem });
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
    const { name, description, price, currency, durationDays, classLimit, classCategory, features, isActive, sortOrder } = req.body;
    const validCats = ["jumping", "pilates", "mixto", "all"];
    const cat = validCats.includes(classCategory) ? classCategory : null;
    // features can be array or comma-string — always store as jsonb array
    const featuresArr = Array.isArray(features)
      ? features
      : typeof features === "string" && features.trim()
        ? features.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const r = await pool.query(
      `UPDATE plans SET name=$1, description=$2, price=$3, currency=$4, duration_days=$5,
       class_limit=$6, features=$7, is_active=$8, sort_order=$9,
       class_category=COALESCE($10, class_category), updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [name, description || null, price, currency || "MXN", durationDays || 30, classLimit ?? null, JSON.stringify(featuresArr), isActive !== false, sortOrder || 0, cat, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Plan no encontrado" });
    return res.json({ data: camelRow(r.rows[0]) });
  } catch (err) {
    console.error("[PUT /plans]", err.message);
    return res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/plans/:id
app.delete("/api/plans/:id", adminMiddleware, async (req, res) => {
  try {
    // Try hard-delete first; if FK constraint, soft-delete
    try {
      await pool.query("DELETE FROM plans WHERE id = $1", [req.params.id]);
    } catch (delErr) {
      if (delErr.code === '23503') {
        // Foreign key violation — soft delete
        await pool.query("UPDATE plans SET is_active = false, updated_at = NOW() WHERE id = $1", [req.params.id]);
        return res.json({ message: "Plan desactivado (tiene registros asociados)" });
      }
      throw delErr;
    }
    return res.json({ message: "Plan eliminado" });
  } catch (err) {
    console.error("[DELETE /plans]", err.message);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/plans
app.post("/api/plans", adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, currency = "MXN", durationDays = 30, classLimit, classCategory, features, isActive = true, sortOrder = 0 } = req.body;
    if (!name) return res.status(400).json({ message: "Nombre requerido" });
    const validCats = ["jumping", "pilates", "mixto", "all"];
    const cat = validCats.includes(classCategory) ? classCategory : "all";
    const featuresArr = Array.isArray(features)
      ? features
      : typeof features === "string" && features.trim()
        ? features.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const r = await pool.query(
      `INSERT INTO plans (name, description, price, currency, duration_days, class_limit, class_category, features, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, description || null, price || 0, currency, durationDays, classLimit ?? null, cat, JSON.stringify(featuresArr), isActive, sortOrder]
    );
    return res.status(201).json({ data: camelRow(r.rows[0]) });
  } catch (err) {
    console.error("[POST /plans]", err.message);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Bookings admin ──────────────────────────────────────────────────────────

// GET /api/bookings — admin sees all
app.get("/api/bookings", adminMiddleware, async (req, res) => {
  try {
    const { status, classId, limit = 100 } = req.query;
    let q = `SELECT b.*, u.display_name AS user_name, (c.date || 'T' || c.start_time) AS start_time, ct.name AS class_name
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
    const booking = r.rows[0];
    // Award loyalty points for attending a class
    if (booking.user_id) {
      try {
        const cfgRes = await pool.query("SELECT value FROM settings WHERE key='loyalty_config' LIMIT 1");
        const cfg = cfgRes.rows.length ? cfgRes.rows[0].value : {};
        const pts = cfg.points_per_class ?? 10;
        if (cfg.enabled !== false && pts > 0) {
          await pool.query(
            "INSERT INTO loyalty_transactions (user_id, type, points, description) VALUES ($1, 'earn', $2, 'Clase asistida')",
            [booking.user_id, pts]
          );
        }
      } catch (e) { /* loyalty earn error shouldn't fail check-in */ }
    }
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/bookings/:id/no-show
app.put("/api/bookings/:id/no-show", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE bookings SET status = 'no_show' WHERE id = $1 AND status NOT IN ('cancelled','no_show') RETURNING *",
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Reserva no encontrada o ya procesada" });
    return res.json({ data: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/classes/:id/roster — lista de alumnos reservados en una clase
app.get("/api/classes/:id/roster", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT b.id AS booking_id, b.status, b.checked_in_at,
              u.id AS user_id, u.display_name, u.email, u.phone,
              m.plan_id, p.name AS plan_name, m.classes_remaining
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       LEFT JOIN memberships m ON b.membership_id = m.id
       LEFT JOIN plans p ON m.plan_id = p.id
       WHERE b.class_id = $1 AND b.status != 'cancelled'
       ORDER BY CASE b.status
         WHEN 'confirmed'  THEN 1
         WHEN 'checked_in' THEN 2
         WHEN 'waitlist'   THEN 3
         WHEN 'no_show'    THEN 4
         ELSE 5 END,
         u.display_name ASC`,
      [req.params.id]
    );
    // Also get class info
    const cls = await pool.query(
      `SELECT c.*, ct.name AS class_type_name, ct.color,
              i.display_name AS instructor_name,
              (c.date || 'T' || c.start_time) AS starts_at
       FROM classes c
       JOIN class_types ct ON c.class_type_id = ct.id
       JOIN instructors i ON c.instructor_id = i.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    return res.json({ data: { class: camelRow(cls.rows[0] ?? {}), roster: r.rows.map(camelRow) } });
  } catch (err) {
    console.error("[GET /classes/:id/roster]", err.message);
    return res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/admin/clients/manual — crea clienta + membresía en un solo paso (sin que use la app)
app.post("/api/admin/clients/manual", adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      displayName, email, phone, dateOfBirth,
      emergencyContactName, emergencyContactPhone, healthNotes,
      planId, paymentMethod = "cash", startDate,
      notes,
    } = req.body;
    if (!displayName || !email) return res.status(400).json({ message: "Nombre y email son requeridos" });

    await client.query("BEGIN");

    // 1. Create user (random password — they can reset later)
    const tempPassword = Math.random().toString(36).slice(2, 10) + "Op1!";
    const hash = await bcrypt.hash(tempPassword, 10);
    const userRes = await client.query(
      `INSERT INTO users (display_name, email, phone, date_of_birth, emergency_contact_name,
        emergency_contact_phone, health_notes, role, password_hash, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'client',$8,true)
       ON CONFLICT (email) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         phone = EXCLUDED.phone,
         updated_at = NOW()
       RETURNING id, display_name, email`,
      [displayName, email.toLowerCase().trim(), phone || null, dateOfBirth || null,
        emergencyContactName || null, emergencyContactPhone || null, healthNotes || null, hash]
    );
    const user = userRes.rows[0];

    // 2. Assign membership if plan selected
    let membership = null;
    if (planId) {
      const planRes = await client.query("SELECT * FROM plans WHERE id = $1 AND is_active = true", [planId]);
      if (!planRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Plan no encontrado" }); }
      const plan = planRes.rows[0];
      const start = startDate ? new Date(startDate) : new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + plan.duration_days);
      const memRes = await client.query(
        `INSERT INTO memberships (user_id, plan_id, status, payment_method, start_date, end_date,
          classes_remaining, notes)
         VALUES ($1,$2,'active',$3,$4,$5,$6,$7) RETURNING *`,
        [user.id, plan.id, paymentMethod, start.toISOString().split("T")[0],
        end.toISOString().split("T")[0],
        plan.class_limit === 0 ? null : plan.class_limit,
        notes || `Alta manual por admin`]
      );
      membership = camelRow(memRes.rows[0]);
    }

    await client.query("COMMIT");
    return res.status(201).json({
      data: { user: camelRow(user), membership, tempPassword: planId ? undefined : tempPassword },
      message: planId ? "Clienta registrada y membresía activada" : "Clienta registrada",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /admin/clients/manual]", err.message);
    if (err.code === "23505") return res.status(409).json({ message: "Ya existe una clienta con ese email" });
    return res.status(500).json({ message: "Error interno" });
  } finally {
    client.release();
  }
});

// GET /api/admin/orders — all orders
app.get("/api/admin/orders", adminMiddleware, async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    let q = `SELECT o.*, u.display_name AS user_name, p.name AS plan_name,
                    pp.file_url AS proof_url, pp.status AS proof_status, pp.uploaded_at AS proof_uploaded_at
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN plans p ON o.plan_id = p.id
             LEFT JOIN payment_proofs pp ON pp.order_id = o.id
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND o.status = $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY o.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    return res.json({
      data: r.rows.map(o => ({
        ...o,
        userName: o.user_name,
        userId: o.user_id,
        planName: o.plan_name,
        proofUrl: o.proof_url,
        proofStatus: o.proof_status,
        proofUploadedAt: o.proof_uploaded_at,
        totalAmount: o.total_amount,
        createdAt: o.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/admin/orders/:id/verify
app.put("/api/admin/orders/:id/verify", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE orders SET status = 'approved', verified_at = NOW(), verified_by = $1 WHERE id = $2 RETURNING *",
      [req.userId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Orden no encontrada" });
    const order = r.rows[0];

    // Activate membership if this order is for a plan
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
        ).catch(() => { });

        // Email: membership activated
        if (order.user_id) {
          try {
            const uRes = await pool.query("SELECT email, full_name, display_name FROM users WHERE id = $1", [order.user_id]);
            if (uRes.rows[0]) {
              const u = uRes.rows[0];
              sendMembershipActivated({
                to: u.email,
                name: u.full_name || u.display_name || "Alumna",
                planName: plan.name,
                startDate: new Date().toISOString(),
                endDate: end.toISOString(),
                classLimit: plan.class_limit ?? null,
              }).catch((e) => console.error("[Email] admin order verify:", e.message));
            }
          } catch (emailErr) {
            console.error("[Email] admin order verify query:", emailErr.message);
          }
        }
      }
    }

    // Award loyalty points for purchase
    if (order.user_id && order.total_amount > 0) {
      try {
        const cfgRes = await pool.query("SELECT value FROM settings WHERE key='loyalty_config' LIMIT 1");
        const cfg = cfgRes.rows.length ? cfgRes.rows[0].value : {};
        const pts = Math.floor((order.total_amount || 0) * (cfg.points_per_peso ?? 1));
        if (cfg.enabled !== false && pts > 0) {
          await pool.query(
            "INSERT INTO loyalty_transactions (user_id, type, points, description) VALUES ($1, 'earn', $2, $3)",
            [order.user_id, pts, `Compra aprobada — $${order.total_amount}`]
          );
        }
      } catch (e) { /* loyalty earn error shouldn't fail verify */ }
    }

    return res.json({ data: order });
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
             WHERE o.status = 'approved'`;
    const params = [];
    if (startDate) { params.push(startDate); q += ` AND o.created_at >= $${params.length}`; }
    if (endDate) { params.push(endDate); q += ` AND o.created_at <= $${params.length}`; }
    params.push(parseInt(limit)); q += ` ORDER BY o.created_at DESC LIMIT $${params.length}`;
    const r = await pool.query(q, params);
    const total = r.rows.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
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
      "INSERT INTO orders (user_id, subtotal, tax_amount, total_amount, payment_method, status, discount_amount, channel) VALUES ($1,$2,0,$3,$4,'approved',$5,'pos') RETURNING *",
      [userId || null, subtotal, total, paymentMethod, discountAmount]
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
        "SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM orders WHERE status='approved' AND created_at BETWEEN $1 AND $2",
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
        `SELECT p.name, COUNT(m.id) AS sales, SUM(o.total_amount) AS revenue
         FROM memberships m
         JOIN plans p ON m.plan_id = p.id
         LEFT JOIN orders o ON o.plan_id = p.id AND o.status = 'approved'
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

// ─── MÓDULO DE EVENTOS ────────────────────────────────────────────────────────

/** Helper: normalize a DB row to camelCase API shape */
function mapEventRow(row) {
  const toYMD = (v) => {
    if (!v) return null;
    if (typeof v === "string") return v.slice(0, 10);
    return new Date(v).toISOString().slice(0, 10);
  };
  const toHM = (v) => {
    if (!v) return null;
    return String(v).slice(0, 5);
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    instructor: row.instructor_name,
    instructorPhoto: row.instructor_photo || null,
    date: toYMD(row.date),
    startTime: toHM(row.start_time),
    endTime: toHM(row.end_time),
    location: row.location,
    capacity: Number(row.capacity),
    registered: Number(row.registered || 0),
    price: Number(row.price || 0),
    currency: row.currency || "MXN",
    earlyBirdPrice: row.early_bird_price != null ? Number(row.early_bird_price) : null,
    earlyBirdDeadline: toYMD(row.early_bird_deadline),
    memberDiscount: Number(row.member_discount || 0),
    image: row.image || null,
    requirements: row.requirements || "",
    includes: Array.isArray(row.includes) ? row.includes : (row.includes ? JSON.parse(row.includes) : []),
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRegRow(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    status: row.status,
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || null,
    paymentReference: row.payment_reference || null,
    hasPaymentProof: !!row.payment_proof_url,
    paymentProofFileName: row.payment_proof_file_name || null,
    transferDate: row.transfer_date ? String(row.transfer_date).slice(0, 10) : null,
    paidAt: row.paid_at || null,
    checkedIn: !!row.checked_in,
    checkedInAt: row.checked_in_at || null,
    waitlistPosition: row.waitlist_position || null,
    notes: row.notes || null,
    createdAt: row.created_at,
  };
}

// ── GET /api/events — Lista pública (solo published) ──────────────────────────
app.get("/api/events", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    let userId = null;
    if (token) {
      try { userId = jwt.verify(token, JWT_SECRET).userId; } catch { }
    }
    const { type, upcoming } = req.query;
    const conditions = ["e.status = 'published'"];
    const params = [];
    if (type) { conditions.push(`e.type = $${params.length + 1}`); params.push(type); }
    if (upcoming === "true") { conditions.push(`e.date >= CURRENT_DATE`); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const rows = await pool.query(
      `SELECT * FROM events e ${where} ORDER BY e.date ASC, e.start_time ASC`,
      params
    );
    return res.json(rows.rows.map(mapEventRow));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── GET /api/events/admin/all — Todos los eventos con inscripciones ──────────
app.get("/api/events/admin/all", adminMiddleware, async (req, res) => {
  try {
    const evRows = await pool.query(
      `SELECT * FROM events ORDER BY date DESC, start_time DESC`
    );
    const regRows = await pool.query(
      `SELECT er.*, u.display_name FROM event_registrations er
       LEFT JOIN users u ON er.user_id = u.id
       ORDER BY er.created_at ASC`
    );
    const regsByEvent = {};
    for (const r of regRows.rows) {
      if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
      regsByEvent[r.event_id].push(mapRegRow(r));
    }
    const events = evRows.rows.map((e) => ({
      ...mapEventRow(e),
      registrations: regsByEvent[e.id] || [],
    }));
    return res.json(events);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── GET /api/events/:id — Detalle de evento ───────────────────────────────────
app.get("/api/events/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    let userId = null;
    let isAdmin = false;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
        isAdmin = decoded.role === "admin" || decoded.role === "super_admin";
      } catch { }
    }
    const evRes = await pool.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (!evRes.rows.length) return res.status(404).json({ message: "Evento no encontrado" });
    const ev = evRes.rows[0];
    if (!isAdmin && ev.status !== "published") return res.status(404).json({ message: "Evento no disponible" });
    const result = mapEventRow(ev);
    if (userId) {
      const regRes = await pool.query(
        `SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status != 'cancelled' LIMIT 1`,
        [req.params.id, userId]
      );
      result.myRegistration = regRes.rows.length ? mapRegRow(regRes.rows[0]) : null;
    }
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── POST /api/events — Crear evento ──────────────────────────────────────────
app.post("/api/events", adminMiddleware, async (req, res) => {
  try {
    const {
      type, title, description, instructor_name, instructor_photo,
      date, start_time, end_time, location, capacity = 12, price = 0,
      early_bird_price, early_bird_deadline, member_discount = 0,
      image, requirements = "", includes = [], tags = [],
      status = "draft",
    } = req.body;
    if (!type || !title || !description || !instructor_name || !date || !start_time || !end_time || !location) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }
    const r = await pool.query(
      `INSERT INTO events (type, title, description, instructor_name, instructor_photo,
        date, start_time, end_time, location, capacity, price, early_bird_price,
        early_bird_deadline, member_discount, image, requirements, includes, tags,
        status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        type, title, description, instructor_name, instructor_photo || null,
        date, start_time, end_time, location, capacity, price,
        early_bird_price || null, early_bird_deadline || null, member_discount,
        image || null, requirements,
        JSON.stringify(Array.isArray(includes) ? includes.filter(Boolean) : []),
        JSON.stringify(Array.isArray(tags) ? tags.filter(Boolean) : []),
        status, req.user.userId,
      ]
    );
    return res.status(201).json(mapEventRow(r.rows[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── PUT /api/events/:id — Actualizar evento ───────────────────────────────────
app.put("/api/events/:id", adminMiddleware, async (req, res) => {
  try {
    const allowed = [
      "type", "title", "description", "instructor_name", "instructor_photo",
      "date", "start_time", "end_time", "location", "capacity", "price",
      "early_bird_price", "early_bird_deadline", "member_discount", "image",
      "requirements", "includes", "tags", "status",
    ];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        vals.push(["includes", "tags"].includes(key) ? JSON.stringify(req.body[key]) : req.body[key]);
        sets.push(`${key} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ message: "Nada que actualizar" });
    vals.push(req.params.id);
    sets.push("updated_at = NOW()");
    const r = await pool.query(
      `UPDATE events SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ message: "Evento no encontrado" });
    return res.json(mapEventRow(r.rows[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── DELETE /api/events/:id — Eliminar evento ──────────────────────────────────
app.delete("/api/events/:id", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM events WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ message: "Evento no encontrado" });
    return res.json({ message: "Evento eliminado" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── POST /api/events/:id/register — Inscribirse ───────────────────────────────
app.post("/api/events/:id/register", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, phone = "", payment_method } = req.body;
    if (!name || !email) return res.status(400).json({ message: "name y email son requeridos" });
    const evRes = await pool.query("SELECT * FROM events WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!evRes.rows.length) return res.status(404).json({ message: "Evento no disponible" });
    const ev = evRes.rows[0];

    // Check existing registration
    const existingRes = await pool.query(
      "SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1",
      [req.params.id, userId]
    );
    const existing = existingRes.rows[0];
    if (existing && existing.status !== "cancelled") {
      return res.status(400).json({ message: "Ya estás inscrito en este evento" });
    }

    // Calculate price
    let amount = Number(ev.price);
    const now = new Date();
    if (ev.early_bird_price != null && ev.early_bird_deadline) {
      const deadline = new Date(ev.early_bird_deadline);
      if (now <= deadline) amount = Number(ev.early_bird_price);
    }
    if (Number(ev.member_discount) > 0) {
      const memRes = await pool.query(
        `SELECT id FROM memberships WHERE user_id = $1 AND status = 'active' AND end_date >= CURRENT_DATE LIMIT 1`,
        [userId]
      );
      if (memRes.rows.length) {
        amount = Math.round(amount * (1 - Number(ev.member_discount) / 100));
      }
    }

    // Determine status
    const regCount = await pool.query(
      "SELECT COUNT(*) FROM event_registrations WHERE event_id = $1 AND status = 'confirmed'",
      [req.params.id]
    );
    const confirmedCount = Number(regCount.rows[0].count);
    let regStatus = "pending";
    let waitlistPosition = null;
    let paidAt = null;
    if (confirmedCount >= Number(ev.capacity)) {
      regStatus = "waitlist";
      const wlRes = await pool.query(
        "SELECT COALESCE(MAX(waitlist_position), 0) + 1 AS pos FROM event_registrations WHERE event_id = $1 AND status = 'waitlist'",
        [req.params.id]
      );
      waitlistPosition = wlRes.rows[0].pos;
    } else if (amount === 0) {
      regStatus = "confirmed";
      paidAt = new Date();
    }

    let reg;
    if (existing && existing.status === "cancelled") {
      const r = await pool.query(
        `UPDATE event_registrations SET name=$1, email=$2, phone=$3, status=$4, amount=$5,
         payment_method=$6, payment_reference=NULL, payment_proof_url=NULL,
         payment_proof_file_name=NULL, transfer_date=NULL,
         paid_at=$7, waitlist_position=$8, checked_in=false, checked_in_at=NULL, updated_at=NOW()
         WHERE id=$9 RETURNING *`,
        [name, email, phone, regStatus, amount, payment_method || null, paidAt, waitlistPosition, existing.id]
      );
      reg = r.rows[0];
    } else {
      const r = await pool.query(
        `INSERT INTO event_registrations (event_id, user_id, name, email, phone, status, amount, payment_method, paid_at, waitlist_position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.params.id, userId, name, email, phone, regStatus, amount, payment_method || null, paidAt, waitlistPosition]
      );
      reg = r.rows[0];
    }

    // Update registered count if confirmed
    if (regStatus === "confirmed") {
      await pool.query(
        "UPDATE events SET registered = (SELECT COUNT(*) FROM event_registrations WHERE event_id=$1 AND status='confirmed') WHERE id=$1",
        [req.params.id]
      );
    }

    let message;
    if (regStatus === "waitlist") message = `Te agregamos a la lista de espera (posición ${waitlistPosition})`;
    else if (amount === 0) message = "¡Registro confirmado! Te esperamos en el evento.";
    else if (payment_method === "cash") message = "Registro pendiente. Puedes pagar en recepción del studio para confirmar tu lugar.";
    else message = "Registro pendiente de pago. Una vez confirmado tu pago, recibirás la confirmación.";

    return res.status(201).json({
      id: reg.id,
      status: reg.status,
      amount: Number(reg.amount),
      isFree: amount === 0,
      waitlistPosition,
      message,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── DELETE /api/events/:id/register — Cancelar inscripción ───────────────────
app.delete("/api/events/:id/register", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const regRes = await pool.query(
      "SELECT * FROM event_registrations WHERE event_id=$1 AND user_id=$2 LIMIT 1",
      [req.params.id, userId]
    );
    if (!regRes.rows.length) return res.status(404).json({ message: "No tienes inscripción en este evento" });
    const reg = regRes.rows[0];
    if (!["confirmed", "pending", "waitlist"].includes(reg.status)) {
      return res.status(400).json({ message: "No puedes cancelar este registro" });
    }
    await pool.query(
      "UPDATE event_registrations SET status='cancelled', updated_at=NOW() WHERE id=$1",
      [reg.id]
    );
    await pool.query(
      "UPDATE events SET registered = GREATEST(0, (SELECT COUNT(*) FROM event_registrations WHERE event_id=$1 AND status='confirmed')) WHERE id=$1",
      [req.params.id]
    );
    return res.json({ message: "Registro cancelado exitosamente" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── GET /api/events/:id/registrations — Inscripciones admin ──────────────────
app.get("/api/events/:id/registrations", adminMiddleware, async (req, res) => {
  try {
    const rows = await pool.query(
      `SELECT er.*, u.display_name FROM event_registrations er
       LEFT JOIN users u ON er.user_id = u.id
       WHERE er.event_id = $1 ORDER BY er.created_at ASC`,
      [req.params.id]
    );
    return res.json(rows.rows.map(mapRegRow));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── PUT /api/events/:eventId/registrations/:regId — Actualizar status ─────────
app.put("/api/events/:eventId/registrations/:regId", adminMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const valid = ["confirmed", "pending", "waitlist", "cancelled", "no_show"];
    if (status && !valid.includes(status)) {
      return res.status(400).json({ message: "Status inválido" });
    }
    const sets = ["updated_at=NOW()"];
    const vals = [];
    if (status) {
      vals.push(status);
      sets.push(`status=$${vals.length}`);
      if (status === "confirmed") {
        sets.push("paid_at = COALESCE(paid_at, NOW())");
      }
    }
    if (notes !== undefined) {
      vals.push(notes);
      sets.push(`notes=$${vals.length}`);
    }
    vals.push(req.params.regId);
    const r = await pool.query(
      `UPDATE event_registrations SET ${sets.join(",")} WHERE id=$${vals.length} AND event_id=$${vals.length + 1} RETURNING *`,
      [...vals, req.params.eventId]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Inscripción no encontrada" });
    // Refresh registered count
    await pool.query(
      "UPDATE events SET registered = (SELECT COUNT(*) FROM event_registrations WHERE event_id=$1 AND status='confirmed') WHERE id=$1",
      [req.params.eventId]
    );
    return res.json({ message: "Inscripción actualizada", status: r.rows[0].status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── POST /api/events/:eventId/checkin/:regId — Check-in ───────────────────────
app.post("/api/events/:eventId/checkin/:regId", adminMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE event_registrations
       SET checked_in=true, checked_in_at=NOW(), checked_in_by=$1, updated_at=NOW()
       WHERE id=$2 AND event_id=$3 RETURNING *`,
      [req.userId, req.params.regId, req.params.eventId]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Inscripción no encontrada" });
    return res.json({ message: "Check-in exitoso", checkedIn: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ── PUT /api/events/:id/register/payment — Enviar comprobante ─────────────────
app.put("/api/events/:id/register/payment", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { payment_method, transfer_reference, transfer_date, file_data, file_name, notes } = req.body;

    const regRes = await pool.query(
      "SELECT * FROM event_registrations WHERE event_id=$1 AND user_id=$2 AND status='pending' LIMIT 1",
      [req.params.id, userId]
    );
    if (!regRes.rows.length)
      return res.status(404).json({ message: "No tienes una inscripción pendiente en este evento" });
    const reg = regRes.rows[0];

    if (payment_method === "transfer" && !transfer_reference && !file_data) {
      return res.status(400).json({ message: "Debes proporcionar una referencia o comprobante de transferencia" });
    }

    let r;
    if (payment_method === "cash") {
      r = await pool.query(
        `UPDATE event_registrations
         SET payment_method='cash',
             payment_reference=NULL,
             payment_proof_url=NULL,
             payment_proof_file_name=NULL,
             transfer_date=NULL,
             updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [reg.id]
      );
    } else {
      r = await pool.query(
        `UPDATE event_registrations
         SET payment_method='transfer',
             payment_reference=$1,
             transfer_date=$2,
             payment_proof_url=$3,
             payment_proof_file_name=$4,
             updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [transfer_reference || null, transfer_date || null, file_data || null, file_name || null, reg.id]
      );
    }

    return res.json({
      message: payment_method === "cash"
        ? "Seleccionado pago en studio. El admin confirmará tu lugar cuando pagues en recepción."
        : "Comprobante enviado exitosamente. Tu pago será verificado pronto.",
      registration: {
        id: r.rows[0].id,
        status: r.rows[0].status,
        paymentReference: r.rows[0].payment_reference,
        hasPaymentProof: !!r.rows[0].payment_proof_url,
      },
    });
  } catch (err) {
    console.error("PUT events/register/payment error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

// ─── Email test endpoint (admin only) ─────────────────────────────────────────
app.post("/api/admin/test-emails", adminMiddleware, async (req, res) => {
  const testTo = req.body.to || "saidromero19@gmail.com";
  const testName = "Said (Test)";
  const results = [];
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const jobs = [
    { label: "Membresía activada", fn: () => sendMembershipActivated({ to: testTo, name: testName, planName: "Jumping — 4 Clases", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 30 * 86400000).toISOString(), classLimit: 4 }) },
    { label: "Reserva confirmada", fn: () => sendBookingConfirmed({ to: testTo, name: testName, className: "Jumping Fitness", date: new Date().toISOString(), startTime: "09:00", instructor: "Instructora Diana", classesLeft: 3, isWaitlist: false }) },
    { label: "Reserva cancelada (a tiempo)", fn: () => sendBookingCancelled({ to: testTo, name: testName, className: "Jumping Dance", date: new Date().toISOString(), startTime: "11:00", creditRestored: true, isLate: false, classesLeft: 4 }) },
    { label: "Reserva cancelada (tardía)", fn: () => sendBookingCancelled({ to: testTo, name: testName, className: "Strong Jump", date: new Date().toISOString(), startTime: "18:00", creditRestored: false, isLate: true, classesLeft: 3 }) },
    { label: "Recordatorio semanal", fn: () => sendWeeklyReminder({ to: testTo, name: testName, classesLeft: 2, endDate: new Date(Date.now() + 15 * 86400000).toISOString() }) },
    { label: "Renovación (última clase)", fn: () => sendRenewalReminder({ to: testTo, name: testName, planName: "Jumping — 4 Clases", classesLeft: 1, endDate: new Date(Date.now() + 5 * 86400000).toISOString(), reason: "last_class" }) },
    { label: "Renovación (por vencer)", fn: () => sendRenewalReminder({ to: testTo, name: testName, planName: "Pilates — Mensual Ilimitado", classesLeft: null, endDate: new Date(Date.now() + 3 * 86400000).toISOString(), reason: "expiring_soon" }) },
    { label: "Reset de contraseña", fn: () => sendPasswordResetEmail({ to: testTo, name: testName, token: "test-token-123456" }) },
  ];

  // Send one at a time with 700ms delay to respect Resend's 2 req/s limit
  for (const job of jobs) {
    try {
      await job.fn();
      results.push(`✅ ${job.label}`);
    } catch (e) {
      results.push(`❌ ${job.label}: ${e.message}`);
    }
    await delay(700);
  }

  const hasResendKey = !!process.env.RESEND_API_KEY;
  return res.json({
    message: hasResendKey
      ? `Se enviaron ${results.filter(r => r.startsWith("✅")).length} emails de prueba a ${testTo}`
      : "⚠️ RESEND_API_KEY no está configurada. Los emails NO se enviaron.",
    resendKeySet: hasResendKey,
    fromEmail: process.env.EMAIL_FROM || "onboarding@resend.dev (default)",
    results,
  });
});

// ─── Serve React SPA (static) ────────────────────────────────────────────────
const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// ─── Email Cron Jobs ─────────────────────────────────────────────────────────

/**
 * Runs every Sunday at 8:00 AM Mexico City time (UTC-6 = 14:00 UTC).
 * Sends weekly reminder to all users with an active membership.
 */
async function runWeeklyReminderCron() {
  try {
    const res = await pool.query(`
      SELECT u.email, COALESCE(u.full_name, u.display_name, 'Alumna') AS name,
             m.classes_remaining, m.end_date
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.status = 'active'
        AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    `);
    console.log(`[Cron] Weekly reminder — ${res.rows.length} members`);
    for (const row of res.rows) {
      await sendWeeklyReminder({
        to: row.email,
        name: row.name,
        classesLeft: row.classes_remaining,
        endDate: row.end_date,
      }).catch((e) => console.error("[Email] weekly cron:", e.message));
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (err) {
    console.error("[Cron] Weekly reminder error:", err.message);
  }
}

/**
 * Runs every day at 9:00 AM.
 * Sends renewal reminder to members with 1 class left OR expiring in ≤7 days.
 */
async function runRenewalReminderCron() {
  try {
    const res = await pool.query(`
      SELECT u.email, COALESCE(u.full_name, u.display_name, 'Alumna') AS name,
             m.classes_remaining, m.end_date,
             COALESCE(p.name, m.plan_name_override, 'Tu membresía') AS plan_name
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN plans p ON m.plan_id = p.id
      WHERE m.status = 'active'
        AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
        AND (
          m.classes_remaining = 1
          OR (m.end_date IS NOT NULL AND m.end_date <= CURRENT_DATE + INTERVAL '7 days')
        )
    `);
    console.log(`[Cron] Renewal reminder — ${res.rows.length} members`);
    for (const row of res.rows) {
      const reason = row.classes_remaining === 1 ? "last_class" : "expiring_soon";
      await sendRenewalReminder({
        to: row.email,
        name: row.name,
        planName: row.plan_name,
        classesLeft: row.classes_remaining,
        endDate: row.end_date,
        reason,
      }).catch((e) => console.error("[Email] renewal cron:", e.message));
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (err) {
    console.error("[Cron] Renewal reminder error:", err.message);
  }
}

function scheduleEmailCrons() {
  // Check every hour if it's time to run
  setInterval(async () => {
    const now = new Date();
    // Mexico City = UTC-6 (adjust for daylight saving if needed)
    const mexicoHour = (now.getUTCHours() - 6 + 24) % 24;
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday

    // Weekly reminder: every Sunday at 8:00 AM Mexico time
    if (dayOfWeek === 0 && mexicoHour === 8 && now.getUTCMinutes() < 60) {
      console.log("[Cron] Triggering weekly reminder...");
      runWeeklyReminderCron();
    }

    // Renewal reminder: every day at 9:00 AM Mexico time
    if (mexicoHour === 9 && now.getUTCMinutes() < 60) {
      console.log("[Cron] Triggering renewal reminder...");
      runRenewalReminderCron();
    }
  }, 60 * 60 * 1000); // every 1 hour
}

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await ensureSchema();
  scheduleEmailCrons();
  // Initialize Google Wallet loyalty class if configured
  ensureGoogleWalletClass().catch(() => { });
  console.log(`🚀 Ophelia API + Frontend → http://localhost:${PORT}`);
});
