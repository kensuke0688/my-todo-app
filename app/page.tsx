"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  CreateTodoRequest,
  CreateTodoResponse,
  ListTodosResponse,
  TodoDTO,
} from "@/app/api/todos/route";
import type {
  UpdateTodoRequest,
  UpdateTodoResponse,
} from "@/app/api/todos/[id]/route";

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadTodos = useCallback(async () => {
    const res = await fetch("/api/todos");
    if (!res.ok) {
      setError("TODO の取得に失敗しました");
      return;
    }
    const data: ListTodosResponse = await res.json();
    setTodos(data.todos);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(data.user?.email ?? null);

      await loadTodos();
      if (cancelled) return;
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [supabase, loadTodos]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || adding) return;

    setAdding(true);
    setError(null);
    try {
      const body: CreateTodoRequest = { title: trimmed };
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("追加に失敗しました");
        return;
      }
      const data: CreateTodoResponse = await res.json();
      setTodos((prev) => [data.todo, ...prev]);
      setTitle("");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(todo: TodoDTO) {
    setBusyId(todo.id);
    setError(null);
    try {
      const body: UpdateTodoRequest = { isCompleted: !todo.isCompleted };
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("更新に失敗しました");
        return;
      }
      const data: UpdateTodoResponse = await res.json();
      setTodos((prev) =>
        prev.map((t) => (t.id === data.todo.id ? data.todo : t)),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg font-semibold">My TODO App</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="truncate text-zinc-400">{email}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "ログアウト中..." : "ログアウト"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-6">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="新しい TODO を入力"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
            <button
              type="submit"
              disabled={adding || !title.trim()}
              className="shrink-0 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              追加
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <ul className="mt-5 space-y-2">
            {loading ? (
              <li className="py-6 text-center text-sm text-zinc-500">
                読み込み中...
              </li>
            ) : todos.length === 0 ? (
              <li className="py-6 text-center text-sm text-zinc-500">
                TODO はまだありません
              </li>
            ) : (
              todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={todo.isCompleted}
                    disabled={busyId === todo.id}
                    onChange={() => handleToggle(todo)}
                    className="size-4 shrink-0 accent-zinc-100"
                  />
                  <span
                    className={`min-w-0 flex-1 break-words text-sm ${
                      todo.isCompleted
                        ? "text-zinc-500 line-through"
                        : "text-zinc-100"
                    }`}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    disabled={busyId === todo.id}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    削除
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
