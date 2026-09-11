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

/**
 * Create a firm.
 *
 * A firm is the tenant boundary and therefore the whole workspace: signing up here opens a
 * private one that starts with the standing company database to search and no book at all.
 * Whatever this firm imports is visible to nobody else, which is the honest answer to "two
 * people, two sets of spreadsheets". The first user is its partner, because someone has to
 * be able to invite the rest and reset the book.
 */

const signupSchema = z.object({
  firm_name: z.string().min(2, "Firm name is required"),
  full_name: z.string().min(2, "Your name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupForm) {
    setServerError(null);
    try {
      await api.post("/auth/signup", data);
      // Signup issues the same cookies as login, so the new firm lands straight on its
      // (empty) desk rather than being bounced back to a sign-in form.
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(
          err.status === 409
            ? "That email already has an account. Sign in instead."
            : err.detail,
        );
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    }
  }

  const field = (
    id: keyof SignupForm,
    label: string,
    props: React.ComponentProps<typeof Input>,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-9" aria-invalid={!!errors[id] || undefined} {...props} {...register(id)} />
      {errors[id] && <p className="text-xs text-danger-ink">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <AuthShell
      title="Create your firm"
      description="A private workspace with the company database ready to search. Your deal book starts empty — import your spreadsheets and it fills."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={INK_LINK}>
            Sign in
          </Link>
        </>
      }
    >
      {/* POST for the same reason as the login form: a pre-hydration submit must not put
          the password in the URL. */}
      <form onSubmit={handleSubmit(onSubmit)} method="post" className="space-y-4" noValidate>
        {field("firm_name", "Firm", { placeholder: "Northgate Partners", autoComplete: "organization" })}
        {field("full_name", "Your name", { placeholder: "Rhea Kapoor", autoComplete: "name" })}
        {field("email", "Work email", { type: "email", placeholder: "you@firm.com", autoComplete: "email" })}
        {field("password", "Password", {
          type: "password",
          placeholder: "At least 8 characters",
          autoComplete: "new-password",
        })}

        {serverError && <FormAlert>{serverError}</FormAlert>}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create firm"}
        </Button>
      </form>
    </AuthShell>
  );
}
