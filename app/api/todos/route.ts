import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase/server";

// pg (via Prisma's driver adapter) needs the Node.js runtime, not Edge.
export const runtime = "nodejs";

/** A todo as sent to the client (dates serialized to ISO strings). */
export type TodoDTO = {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
};

/** Shared error response shape for every /api/todos endpoint. */
export type ErrorResponse = { error: string };

// GET /api/todos
export type ListTodosResponse = { todos: TodoDTO[] };

// POST /api/todos
export type CreateTodoRequest = { title: string };
export type CreateTodoResponse = { todo: TodoDTO };

export function toDTO(todo: {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
}): TodoDTO {
  return {
    id: todo.id,
    title: todo.title,
    isCompleted: todo.isCompleted,
    createdAt: todo.createdAt.toISOString(),
  };
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
      orderBy: { createdAt: "desc" },
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
    return NextResponse.json<ErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json<ErrorResponse>(
      { error: "title is required" },
      { status: 400 },
    );
  }

  try {
    const todo = await prisma.todo.create({
      data: { title, userId: user.id },
    });
    return NextResponse.json<CreateTodoResponse>(
      { todo: toDTO(todo) },
      { status: 201 },
    );
  } catch (err) {
    return serverError("POST /api/todos", err);
  }
}
