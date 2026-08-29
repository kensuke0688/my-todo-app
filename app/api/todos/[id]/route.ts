import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase/server";
import {
  parseDueDate,
  parseNote,
  toDTO,
  type ErrorResponse,
  type TodoDTO,
} from "../route";

export const runtime = "nodejs";

// PATCH /api/todos/[id] — any subset of these fields may be sent.
export type UpdateTodoRequest = {
  isCompleted?: boolean;
  /** "YYYY-MM-DD" to set, or null to clear. */
  dueDate?: string | null;
  /** Note text to set, or null/"" to clear. */
  note?: string | null;
};
export type UpdateTodoResponse = { todo: TodoDTO };

// DELETE /api/todos/[id]
export type DeleteTodoResponse = { success: true };

type RouteContext = { params: Promise<{ id: string }> };

function serverError(where: string, err: unknown) {
  console.error(`${where} failed:`, err);
  return NextResponse.json<ErrorResponse>(
    { error: err instanceof Error ? err.message : "Internal Server Error" },
    { status: 500 },
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  let body: UpdateTodoRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const data: {
    isCompleted?: boolean;
    dueDate?: Date | null;
    note?: string | null;
  } = {};

  if (body.isCompleted !== undefined) {
    if (typeof body.isCompleted !== "boolean") {
      return NextResponse.json<ErrorResponse>(
        { error: "isCompleted must be a boolean" },
        { status: 400 },
      );
    }
    data.isCompleted = body.isCompleted;
  }

  if (body.dueDate !== undefined) {
    try {
      data.dueDate = parseDueDate(body.dueDate);
    } catch (err) {
      return NextResponse.json<ErrorResponse>(
        { error: err instanceof Error ? err.message : "Invalid dueDate" },
        { status: 400 },
      );
    }
  }

  if (body.note !== undefined) {
    try {
      data.note = parseNote(body.note);
    } catch (err) {
      return NextResponse.json<ErrorResponse>(
        { error: err instanceof Error ? err.message : "Invalid note" },
        { status: 400 },
      );
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json<ErrorResponse>(
      { error: "No updatable fields provided" },
      { status: 400 },
    );
  }

  try {
    // Scope the write to this user's rows so one user cannot touch another's todo.
    const { count } = await prisma.todo.updateMany({
      where: { id, userId: user.id },
      data,
    });

    if (count === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "Todo not found" },
        { status: 404 },
      );
    }

    const todo = await prisma.todo.findFirstOrThrow({
      where: { id, userId: user.id },
    });
    return NextResponse.json<UpdateTodoResponse>({ todo: toDTO(todo) });
  } catch (err) {
    return serverError(`PATCH /api/todos/${id}`, err);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const { count } = await prisma.todo.deleteMany({
      where: { id, userId: user.id },
    });

    if (count === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "Todo not found" },
        { status: 404 },
      );
    }

    return NextResponse.json<DeleteTodoResponse>({ success: true });
  } catch (err) {
    return serverError(`DELETE /api/todos/${id}`, err);
  }
}
