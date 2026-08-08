import crypto from "crypto";
import { createClient, type Client } from "@libsql/client";

export type AppRole = "admin" | "manager" | "user";

export type AppUser = {
  id: number;
  username: string;
  role: AppRole;
};

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables."
      );
    }

    client = createClient({ url, authToken });
  }
  return client;
}

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

async function ensureSchema(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      projects TEXT NOT NULL DEFAULT '[]',
      dispatches TEXT NOT NULL DEFAULT '[]'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    INSERT OR IGNORE INTO app_state (id, projects, dispatches)
    VALUES (1, '[]', '[]')
  `);
}

async function ensureSeedUsers(db: Client) {
  const defaultUsers = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "manager", password: "manager123", role: "manager" },
    { username: "user", password: "user123", role: "user" },
  ] as const;

  for (const user of defaultUsers) {
    const salt = generateSalt();
    const hash = makePasswordHash(user.password, salt);

    await db.execute({
      sql: `
        INSERT OR IGNORE INTO users (username, password_hash, password_salt, role)
        VALUES (?, ?, ?, ?)
      `,
      args: [user.username, hash, salt, user.role],
    });
  }
}

// Ensures schema + seed users run only ONCE per warm serverless instance,
// instead of on every single request.
export async function getDatabase(): Promise<Client> {
  const db = getClient();

  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureSchema(db);
      await ensureSeedUsers(db);
    })();
  }

  await schemaReady;
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

export async function getSessionUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const token = parseCookieValue(cookieHeader, "dispatch_session");

  if (!token) return null;

  const db = await getDatabase();
  const result = await db.execute({
    sql: `
      SELECT sessions.username, users.role, sessions.expires_at
      FROM sessions
      LEFT JOIN users ON users.username = sessions.username
      WHERE sessions.id = ?
    `,
    args: [token],
  });

  const row = result.rows[0] as unknown as
    | { username: string; role: string; expires_at: string }
    | undefined;

  if (!row) return null;

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await db.execute({
      sql: "DELETE FROM sessions WHERE id = ?",
      args: [token],
    });
    return null;
  }

  return {
    username: row.username,
    role: normalizeRole((row.role as string) || "user"),
  };
}

export async function getUserList() {
  const db = await getDatabase();
  const result = await db.execute(
    "SELECT id, username, role FROM users ORDER BY username ASC"
  );

  return result.rows.map((row: any) => ({
    id: row.id as number,
    username: row.username as string,
    role: normalizeRole(row.role as string),
  }));
}

export async function createUserRecord(
  username: string,
  password: string,
  role: AppRole
) {
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const nextRole = normalizeRole(role);
  const db = await getDatabase();

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE username = ?",
    args: [cleanUsername],
  });

  if (existing.rows.length > 0) {
    throw new Error("That username already exists.");
  }

  const salt = generateSalt();
  const hash = makePasswordHash(password, salt);

  const result = await db.execute({
    sql: `
      INSERT INTO users (username, password_hash, password_salt, role)
      VALUES (?, ?, ?, ?)
    `,
    args: [cleanUsername, hash, salt, nextRole],
  });

  return {
    id: Number(result.lastInsertRowid),
    username: cleanUsername,
    role: nextRole,
  };
}

export async function addAuditLog(
  username: string,
  role: AppRole,
  action: string,
  details: Record<string, unknown> = {}
) {
  const db = await getDatabase();

  await db.execute({
    sql: `
      INSERT INTO audit_logs (username, role, action, details)
      VALUES (?, ?, ?, ?)
    `,
    args: [username, role, action, JSON.stringify(details)],
  });
}

export async function getAuditLogs(username: string, role: AppRole) {
  const db = await getDatabase();

  const sql =
    role === "admin" || role === "manager"
      ? "SELECT username, role, action, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 200"
      : "SELECT username, role, action, details, created_at FROM audit_logs WHERE username = ? ORDER BY id DESC LIMIT 100";

  const result = await db.execute({
    sql,
    args: role === "user" ? [username] : [],
  });

  return result.rows.map((row: any) => ({
    username: row.username as string,
    role: normalizeRole(row.role as string),
    action: row.action as string,
    details: JSON.parse((row.details as string) || "{}"),
    createdAt: row.created_at as string,
  }));
}