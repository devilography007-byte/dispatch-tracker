import crypto from "crypto";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "dispatch-team.db");

export type AppRole = "admin" | "manager" | "user";

export type AppUser = {
  id: number;
  username: string;
  role: AppRole;
};

export function normalizeRole(value: string): AppRole {
  if (value === "admin") return "admin";
  if (value === "manager") return "manager";
  return "user";
}

export function makePasswordHash(password: string, salt: string) {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
}

export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function randomSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function ensureSeedUsers(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );
  `);

  const defaultUsers = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "manager", password: "manager123", role: "manager" },
    { username: "user", password: "user123", role: "user" },
  ] as const;

  for (const user of defaultUsers) {
    const salt = generateSalt();
    const hash = makePasswordHash(user.password, salt);

    db.prepare(
      `
        INSERT OR IGNORE INTO users (username, password_hash, password_salt, role)
        VALUES (?, ?, ?, ?)
      `
    ).run(user.username, hash, salt, user.role);
  }
}

export function getDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      projects TEXT NOT NULL DEFAULT '[]',
      dispatches TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO app_state (id, projects, dispatches)
    VALUES (1, '[]', '[]');
  `);

  ensureSeedUsers(db);
  return db;
}

export function parseCookieValue(header: string | null, key: string) {
  if (!header) return null;

  for (const chunk of header.split(";")) {
    const [cookieKey, ...rest] = chunk.trim().split("=");
    if (cookieKey === key) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const token = parseCookieValue(cookieHeader, "dispatch_session");

  if (!token) return null;

  const db = getDatabase();
  const row = db
    .prepare(
      "SELECT sessions.username, users.role, sessions.expires_at FROM sessions LEFT JOIN users ON users.username = sessions.username WHERE sessions.id = ?"
    )
    .get(token) as
    | { username: string; role: string; expires_at: string }
    | undefined;

  db.close();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    const staleDb = getDatabase();
    staleDb.prepare("DELETE FROM sessions WHERE id = ?").run(token);
    staleDb.close();
    return null;
  }

  return {
    username: row.username,
    role: normalizeRole(row.role || "user"),
  };
}

export function getUserList() {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT id, username, role FROM users ORDER BY username ASC"
    )
    .all() as Array<{ id: number; username: string; role: string }>;

  db.close();
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role),
  }));
}

export function createUserRecord(username: string, password: string, role: AppRole) {
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const nextRole = normalizeRole(role);
  const db = getDatabase();
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(cleanUsername);

  if (existing) {
    db.close();
    throw new Error("That username already exists.");
  }

  const salt = generateSalt();
  const hash = makePasswordHash(password, salt);

  const result = db
    .prepare(
      `
        INSERT INTO users (username, password_hash, password_salt, role)
        VALUES (?, ?, ?, ?)
      `
    )
    .run(cleanUsername, hash, salt, nextRole);

  db.close();

  return {
    id: result.lastInsertRowid,
    username: cleanUsername,
    role: nextRole,
  };
}

export function addAuditLog(
  username: string,
  role: AppRole,
  action: string,
  details: Record<string, unknown> = {}
) {
  const db = getDatabase();

  db.prepare(
    `
      INSERT INTO audit_logs (username, role, action, details)
      VALUES (?, ?, ?, ?)
    `
  ).run(username, role, action, JSON.stringify(details));

  db.close();
}

export function getAuditLogs(username: string, role: AppRole) {
  const db = getDatabase();

  const rows = db
    .prepare(
      role === "admin"
        ? "SELECT username, role, action, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 200"
        : role === "manager"
          ? "SELECT username, role, action, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 200"
          : "SELECT username, role, action, details, created_at FROM audit_logs WHERE username = ? ORDER BY id DESC LIMIT 100"
    )
    .all(role === "user" ? username : undefined) as Array<{
      username: string;
      role: string;
      action: string;
      details: string;
      created_at: string;
    }>;

  db.close();

  return rows.map((row) => ({
    username: row.username,
    role: normalizeRole(row.role),
    action: row.action,
    details: JSON.parse(row.details || "{}"),
    createdAt: row.created_at,
  }));
}
