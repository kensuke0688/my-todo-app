import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase/server";
import type { ErrorResponse, TodoDTO } from "../route";

// PATCH /api/todos/[id]
export type UpdateTodoRequest = { isCompleted: boolean };
export type UpdateTodoResponse = { todo: TodoDTO };

// DELETE /api/todos/[id]
export type DeleteTodoResponse = { success: true };

type RouteContext = { params: Promise<{ id: string }> };

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

  if (typeof body.isCompleted !== "boolean") {
    return NextResponse.json<ErrorResponse>(
      { error: "isCompleted (boolean) is required" },
      { status: 400 },
    );
  }

  // Scope the write to this user's rows so one user cannot touch another's todo.
  const { count } = await prisma.todo.updateMany({
    where: { id, userId: user.id },
    data: { isCompleted: body.isCompleted },
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

  return NextResponse.json<UpdateTodoResponse>({
    todo: {
      id: todo.id,
      title: todo.title,
      isCompleted: todo.isCompleted,
      createdAt: todo.createdAt.toISOString(),
    },
  });
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
}
