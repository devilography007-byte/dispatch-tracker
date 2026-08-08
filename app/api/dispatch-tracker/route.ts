import { getDatabase } from "@/lib/team-db";

export async function GET() {
  const db = await getDatabase();

  const result = await db.execute(
    "SELECT projects, dispatches FROM app_state WHERE id = 1"
  );

  const row = result.rows[0] as unknown as
    | { projects: string; dispatches: string }
    | undefined;

  return Response.json({
    projects: row ? JSON.parse(row.projects) : [],
    dispatches: row ? JSON.parse(row.dispatches) : [],
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const payload = {
    projects: Array.isArray(body?.projects) ? body.projects : [],
    dispatches: Array.isArray(body?.dispatches) ? body.dispatches : [],
  };

  const db = await getDatabase();

  await db.execute({
    sql: "UPDATE app_state SET projects = ?, dispatches = ? WHERE id = 1",
    args: [JSON.stringify(payload.projects), JSON.stringify(payload.dispatches)],
  });

  return Response.json({ success: true, ...payload });
}