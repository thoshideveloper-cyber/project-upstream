"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

import { api, ApiError } from "@/lib/api";
import { AuthShell, FormAlert } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INK_LINK } from "@/lib/design";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setServerError(null);
    try {
      await api.post("/auth/login", data);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.status === 401 ? "Invalid email or password." : err.detail);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <AuthShell
      title="Sign in"
      description="Use your firm account to open the deal book."
      footer={
        <>
          New firm?{" "}
          <Link href="/signup" className={INK_LINK}>
            Create a workspace
          </Link>
        </>
      }
    >
      {/* `method="post"` matters even though JS handles the submit: a form with no method
          defaults to GET, so a submit landing in the gap before hydration navigates to
          /login?email=…&password=… — putting the password in the URL bar, browser history
          and any access log along the way. POST keeps it in a body that goes nowhere. */}
      <form onSubmit={handleSubmit(onSubmit)} method="post" className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@firm.com"
            autoComplete="email"
            className="h-9"
            aria-invalid={!!errors.email || undefined}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-danger-ink">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-9"
            aria-invalid={!!errors.password || undefined}
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-danger-ink">{errors.password.message}</p>}
        </div>

        {serverError && <FormAlert>{serverError}</FormAlert>}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
