import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Iniciar sesión · CampusOps",
};

async function RedirectIfSignedIn() {
  if (await getSession()) {
    redirect("/reportes");
  }

  return null;
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <section className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">CampusOps</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Acceso para personal del campus.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
