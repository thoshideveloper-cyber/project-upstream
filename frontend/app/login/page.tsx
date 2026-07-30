"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpstreamMark } from "@/components/brand/logo";

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
    <div className="dark login-bg flex min-h-screen flex-col items-center justify-center p-4" suppressHydrationWarning>
      {/* Above-card brand block */}
      <div className="mb-8 text-center">
        <UpstreamMark size={52} className="text-foreground mx-auto mb-4" />
        <h1
          className="text-5xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}
        >
          Upstream
        </h1>
        <p className="text-muted-foreground mt-2 text-sm tracking-wide">
          Deal intelligence, institutionalized.
        </p>
      </div>

      {/* Glassmorphism card */}
      <div className="login-card w-full max-w-sm p-8">
        <div className="mb-6">
          <h2 className="text-foreground text-base font-semibold">Sign in</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Access your firm&apos;s deal book
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@firm.com"
              autoComplete="email"
              className="focus:border-primary/50 focus:ring-primary/30 bg-white/[0.04]"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive-ink text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="focus:border-primary/50 focus:ring-primary/30 bg-white/[0.04]"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive-ink text-xs">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="bg-destructive/10 text-destructive-ink rounded-md px-3 py-2 text-sm">
              {serverError}
            </p>
          )}

          <Button type="submit" className="mt-2 w-full font-semibold" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
