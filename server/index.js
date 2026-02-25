import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "ophelia_secret_2026";

// ─── Database ───────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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

// ─── Routes: /api/auth ───────────────────────────────────────────────────────

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName, phone, acceptsTerms, acceptsCommunications, referralCode } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
  }

  try {
    // Check duplicate email
    const exists = await pool.query("SELECT id FROM usuarios WHERE email = $1", [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Este email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO usuarios
         (nombre_completo, email, telefono, password_hash, acepta_terminos, acepta_comunicaciones, rol)
       VALUES ($1, $2, $3, $4, $5, $6, 'cliente')
       RETURNING id, nombre_completo, email, telefono, rol, created_at`,
      [
        displayName.trim(),
        email.toLowerCase().trim(),
        phone || null,
        passwordHash,
        acceptsTerms ?? false,
        acceptsCommunications ?? false,
      ]
    );

    const user = result.rows[0];
    const token = signToken(user.id);

    return res.status(201).json({
      user: {
        id: user.id,
        displayName: user.nombre_completo,
        email: user.email,
        phone: user.telefono,
        role: user.rol,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email y contraseña requeridos" });
  }

  try {
    const result = await pool.query(
      "SELECT id, nombre_completo, email, telefono, password_hash, rol FROM usuarios WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Credenciales incorrectas" });

    const token = signToken(user.id);

    return res.json({
      user: {
        id: user.id,
        displayName: user.nombre_completo,
        email: user.email,
        phone: user.telefono,
        role: user.rol,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre_completo, email, telefono, rol, created_at FROM usuarios WHERE id = $1",
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    const u = result.rows[0];
    return res.json({
      user: {
        id: u.id,
        displayName: u.nombre_completo,
        email: u.email,
        phone: u.telefono,
        role: u.rol,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ─── Serve React SPA (static) ────────────────────────────────────────────────
const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Ophelia API + Frontend → http://localhost:${PORT}`);
});
