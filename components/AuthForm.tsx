"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Email confirmation enabled: no session yet.
      if (!data.session) {
        setNotice(
          "確認メールを送信しました。メール内のリンクを開いて登録を完了してください。",
        );
        setLoading(false);
        return;
      }
    }

    // Session cookie is set - navigate home and let the proxy re-run.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-zinc-100">
          {isLogin ? "ログイン" : "新規登録"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isLogin
            ? "メールアドレスとパスワードでログイン"
            : "メールアドレスとパスワードでアカウントを作成"}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-300"
            >
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-300"
            >
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "処理中..." : isLogin ? "ログイン" : "登録する"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          {isLogin ? (
            <>
              アカウントをお持ちでない方は{" "}
              <Link
                href="/signup"
                className="font-medium text-zinc-100 underline underline-offset-4 hover:text-white"
              >
                新規登録
              </Link>
            </>
          ) : (
            <>
              すでにアカウントをお持ちの方は{" "}
              <Link
                href="/login"
                className="font-medium text-zinc-100 underline underline-offset-4 hover:text-white"
              >
                ログイン
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
