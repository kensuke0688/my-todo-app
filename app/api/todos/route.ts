import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase/server";

// pg (via Prisma's driver adapter) needs the Node.js runtime, not Edge.
export const runtime = "nodejs";

/** A todo as sent to the client (dates serialized to strings). */
export type TodoDTO = {
  id: string;
  title: string;
  /** Free-form note, or null when none is set. */
  note: string | null;
  isCompleted: boolean;
  /** Due date as "YYYY-MM-DD", or null when none is set. */
  dueDate: string | null;
  /** Creation timestamp as an ISO string. */
  createdAt: string;
};

/** Shared error response shape for every /api/todos endpoint. */
export type ErrorResponse = { error: string };

// GET /api/todos
export type ListTodosResponse = { todos: TodoDTO[] };

// POST /api/todos
export type CreateTodoRequest = {
  title: string;
  note?: string | null;
  dueDate?: string | null;
};
export type CreateTodoResponse = { todo: TodoDTO };

export function toDTO(todo: {
  id: string;
  title: string;
  note: string | null;
  isCompleted: boolean;
  dueDate: Date | null;
  createdAt: Date;
}): TodoDTO {
  return {
    id: todo.id,
    title: todo.title,
    note: todo.note,
    isCompleted: todo.isCompleted,
    dueDate: todo.dueDate ? todo.dueDate.toISOString().slice(0, 10) : null,
    createdAt: todo.createdAt.toISOString(),
  };
}

const NOTE_MAX_LENGTH = 2000;

/**
 * Normalize a client-supplied note.
 * Returns `undefined` when the field was omitted (leave unchanged),
 * `null` when it is empty/cleared, or the trimmed string to store.
 * Throws when it is the wrong type or too long.
 */
export function parseNote(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("note must be a string or null");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > NOTE_MAX_LENGTH) {
    throw new Error(`note must be ${NOTE_MAX_LENGTH} characters or fewer`);
  }
  return trimmed;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize a client-supplied due date.
 * Returns `undefined` when the field was omitted (leave unchanged),
 * `null` when it should be cleared, or a `Date` (UTC midnight) to store.
 * Throws on a malformed value.
 */
export function parseDueDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    throw new Error("dueDate must be a 'YYYY-MM-DD' string or null");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("dueDate is not a valid date");
  }
  return date;
}

function badRequest(message: string) {
  return NextResponse.json<ErrorResponse>({ error: message }, { status: 400 });
}

function serverError(where: string, err: unknown) {
  console.error(`${where} failed:`, err);
  return NextResponse.json<ErrorResponse>(
    { error: err instanceof Error ? err.message : "Internal Server Error" },
    { status: 500 },
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const todos = await prisma.todo.findMany({
      where: { userId: user.id },
      // Earliest due date first; todos without a due date fall to the bottom,
      // then newest-created wins the tie.
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });
    return NextResponse.json<ListTodosResponse>({ todos: todos.map(toDTO) });
  } catch (err) {
    return serverError("GET /api/todos", err);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: CreateTodoRequest;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return badRequest("title is required");
  }

  let dueDate: Date | null | undefined;
  let note: string | null | undefined;
  try {
    dueDate = parseDueDate(body.dueDate);
    note = parseNote(body.note);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Invalid request");
  }

  try {
    const todo = await prisma.todo.create({
      data: {
        title,
        note: note ?? null,
        userId: user.id,
        dueDate: dueDate ?? null,
      },
    });
    return NextResponse.json<CreateTodoResponse>(
      { todo: toDTO(todo) },
      { status: 201 },
    );
  } catch (err) {
    return serverError("POST /api/todos", err);
  }
}
