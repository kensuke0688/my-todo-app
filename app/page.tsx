"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  CreateTodoRequest,
  CreateTodoResponse,
  ErrorResponse,
  ListTodosResponse,
  TodoDTO,
} from "@/app/api/todos/route";
import type {
  UpdateTodoRequest,
  UpdateTodoResponse,
} from "@/app/api/todos/[id]/route";

/** Pull the server's error message out of a failed response, with a fallback. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data: ErrorResponse = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

/** Local calendar date as "YYYY-MM-DD" (matches an <input type="date"> value). */
function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** ISO timestamp -> "2026/9/5" in the viewer's locale. */
function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP");
}

/**
 * Same ordering as the API: earliest due date first, todos without one last,
 * then newest-created breaks the tie. Keeps the list correct after local edits.
 */
function sortTodos(todos: TodoDTO[]): TodoDTO[] {
  return [...todos].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/** Inline, editable note for a single todo. Persists on blur when changed. */
function NoteEditor({
  todo,
  disabled,
  onSave,
}: {
  todo: TodoDTO;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const current = todo.note ?? "";
  const [draft, setDraft] = useState(current);
  const [syncedWith, setSyncedWith] = useState(current);

  // Adjust state during render when the note changes elsewhere (a save, a
  // refetch) rather than in an effect — React's recommended pattern.
  if (current !== syncedWith) {
    setSyncedWith(current);
    setDraft(current);
  }

  function commit() {
    const next = draft.trim();
    if (next === current) return;
    onSave(next);
  }

  return (
    <textarea
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder="メモを追加..."
      rows={draft ? 2 : 1}
      aria-label="メモ"
      className="mt-1.5 w-full resize-y rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-60"
    />
  );
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const sortedTodos = useMemo(() => sortTodos(todos), [todos]);

  const loadTodos = useCallback(async () => {
    const res = await fetch("/api/todos");
    if (!res.ok) {
      setError(await readError(res, "TODO の取得に失敗しました"));
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
      const body: CreateTodoRequest = {
        title: trimmed,
        note: note.trim() || null,
        dueDate: dueDate || null,
      };
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readError(res, "追加に失敗しました"));
        return;
      }
      const data: CreateTodoResponse = await res.json();
      setTodos((prev) => [data.todo, ...prev]);
      setTitle("");
      setNote("");
      setDueDate("");
    } finally {
      setAdding(false);
    }
  }

  async function patchTodo(id: string, body: UpdateTodoRequest, fallback: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readError(res, fallback));
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

  function handleToggle(todo: TodoDTO) {
    return patchTodo(todo.id, { isCompleted: !todo.isCompleted }, "更新に失敗しました");
  }

  function handleDueDateChange(todo: TodoDTO, value: string) {
    return patchTodo(todo.id, { dueDate: value || null }, "期限の更新に失敗しました");
  }

  function handleNoteChange(todo: TodoDTO, value: string) {
    return patchTodo(todo.id, { note: value || null }, "メモの更新に失敗しました");
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await readError(res, "削除に失敗しました"));
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

  const today = todayStr();

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
          <form onSubmit={handleAdd} className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="新しい TODO を入力"
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="期限日"
                className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition [color-scheme:dark] focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <button
                type="submit"
                disabled={adding || !title.trim()}
                className="shrink-0 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                追加
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="メモ（任意）"
              rows={2}
              aria-label="メモ"
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </form>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <ul className="mt-5 space-y-2">
            {loading ? (
              <li className="py-6 text-center text-sm text-zinc-500">
                読み込み中...
              </li>
            ) : sortedTodos.length === 0 ? (
              <li className="py-6 text-center text-sm text-zinc-500">
                TODO はまだありません
              </li>
            ) : (
              sortedTodos.map((todo) => {
                const overdue =
                  todo.dueDate !== null &&
                  !todo.isCompleted &&
                  todo.dueDate < today;
                return (
                  <li
                    key={todo.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
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
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs text-zinc-500">
                      <span>作成: {formatCreatedAt(todo.createdAt)}</span>
                      <label className="flex items-center gap-1.5">
                        <span className={overdue ? "text-red-400" : undefined}>
                          期限:
                        </span>
                        <input
                          type="date"
                          value={todo.dueDate ?? ""}
                          disabled={busyId === todo.id}
                          onChange={(e) =>
                            handleDueDateChange(todo, e.target.value)
                          }
                          aria-label="期限日を変更"
                          className={`rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs outline-none transition [color-scheme:dark] focus:border-zinc-500 disabled:opacity-60 ${
                            overdue ? "text-red-400" : "text-zinc-300"
                          }`}
                        />
                      </label>
                      {overdue && (
                        <span className="font-medium text-red-400">期限切れ</span>
                      )}
                    </div>
                    <div className="pl-7">
                      <NoteEditor
                        todo={todo}
                        disabled={busyId === todo.id}
                        onSave={(value) => handleNoteChange(todo, value)}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
