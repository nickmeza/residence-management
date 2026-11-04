"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { createAccountWithSetup, saveSetupForCurrentUser } from "@/server/onboarding/actions";
import {
  initialSetupForm,
  stepsFor,
  toDraft,
  validateStep,
  type SetupForm,
  type StepId,
} from "@/server/onboarding/form";

import { Stepper } from "./stepper";
import { StepAccount } from "./step-account";
import { StepBuilding } from "./step-building";
import { StepBusiness } from "./step-business";
import { StepOffer } from "./step-offer";
import { StepServices } from "./step-services";

type Mode = "signup" | "existing";

const TITLES: Record<StepId, { title: string; description: string }> = {
  services: { title: "Arma tu sistema", description: "Empieza por los servicios que ofreces." },
  business: {
    title: "Cuéntanos sobre tu negocio",
    description: "Estos datos aparecerán en tus contratos y recibos.",
  },
  offer: { title: "¿Qué ofreces?", description: "El tamaño de lo que alquilas y quién lo atiende." },
  building: { title: "Arma tu propiedad", description: "Agrega los pisos y lo que alquilas en cada uno." },
  account: { title: "Crea tu cuenta", description: "Último paso. Revisa el resumen y crea tu cuenta." },
};

// A qué paso pertenece un campo con error, para llevar a la persona allí.
function stepOfField(path: string): StepId {
  if (path.startsWith("services")) return "services";
  if (path.startsWith("residenceBusiness") || path.startsWith("mealPlanBusiness")) return "business";
  if (path === "property.type" || path === "property.ownerLivesHere") return "offer";
  if (path.startsWith("property")) return "building";
  return "account";
}

const draftKey = (mode: Mode) => `configuracion-borrador-${mode}`;

// El borrador vive solo en este navegador. Si el navegador no deja guardar, se sigue sin borrador.
function readDraft(mode: Mode): { form: SetupForm; step: StepId } | null {
  try {
    const raw = localStorage.getItem(draftKey(mode));
    return raw ? (JSON.parse(raw) as { form: SetupForm; step: StepId }) : null;
  } catch {
    return null;
  }
}

function writeDraft(mode: Mode, form: SetupForm, step: StepId) {
  try {
    localStorage.setItem(draftKey(mode), JSON.stringify({ form: toDraft(form), step }));
  } catch {}
}

function clearDraft(mode: Mode) {
  try {
    localStorage.removeItem(draftKey(mode));
  } catch {}
}

// Corre solo en el navegador (ver setup-wizard-loader.tsx), así el borrador se lee desde el inicio.
export function SetupWizard({ mode }: { mode: Mode }) {
  const [draft] = useState(() => readDraft(mode));
  const methods = useForm<SetupForm>({ defaultValues: draft?.form ?? initialSetupForm() });
  const { getValues, setError, clearErrors, reset, handleSubmit, subscribe } = methods;
  const services = useWatch({ control: methods.control, name: "services" });
  const steps = stepsFor({ services }, mode === "signup");
  const [step, setStep] = useState<StepId>(draft?.step ?? "services");
  const [restored, setRestored] = useState(Boolean(draft));
  const [message, setMessage] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  // El paso actual, para que el guardado del borrador siempre use el último.
  const stepRef = useRef(step);
  const current = Math.max(0, steps.indexOf(step));

  // Guarda el borrador en cada cambio. subscribe() avisa sin volver a dibujar la pantalla.
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => writeDraft(mode, values, stepRef.current),
      }),
    [mode, subscribe],
  );

  useEffect(() => {
    stepRef.current = step;
    writeDraft(mode, getValues(), step);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mode, step, getValues]);

  const showErrors = (errors: Record<string, string>) => {
    for (const [path, msg] of Object.entries(errors)) {
      setError(path as Parameters<typeof setError>[0], { type: "manual", message: msg });
    }
  };

  const goNext = () => {
    clearErrors();
    const errors = validateStep(step, getValues());
    if (Object.keys(errors).length) {
      showErrors(errors);
      setMessage("Revisa los campos marcados.");
      return;
    }
    setMessage(undefined);
    setStep(steps[current + 1]);
  };

  const goTo = (target: StepId) => {
    setMessage(undefined);
    setStep(target);
  };

  const submit = handleSubmit((values) => {
    clearErrors();
    // Vuelve a revisar todos los pasos antes de enviar.
    for (const s of steps) {
      const errors = validateStep(s, values);
      if (Object.keys(errors).length) {
        showErrors(errors);
        setMessage("Revisa los campos marcados.");
        setStep(s);
        return;
      }
    }
    const { account, ...setup } = values;
    startTransition(async () => {
      const result =
        mode === "signup"
          ? await createAccountWithSetup({ setup, account })
          : await saveSetupForCurrentUser({ setup });
      if (result.status === "check-email") {
        clearDraft(mode);
        setSentTo(result.email);
        return;
      }
      setMessage(result.message);
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
        showErrors(result.fieldErrors);
        setStep(stepOfField(Object.keys(result.fieldErrors)[0]));
      }
    });
  });

  if (sentTo) {
    return (
      <Shell mode={mode}>
        <div role="status" className="flex max-w-xl flex-col gap-3 rounded-xl border bg-card p-6 shadow-card">
          <p className="w-fit rounded-lg bg-ok-soft px-3 py-1 text-sm font-bold text-ok">Revisa tu correo</p>
          <p>
            Si <b>{sentTo}</b> no tenía cuenta, te enviamos un enlace para activarla. Ábrelo en este mismo
            navegador y entrarás a tu panel con todo lo que configuraste.
          </p>
          <Link href="/iniciar-sesion" className="text-link underline-offset-4 hover:underline">
            Ir a iniciar sesión
          </Link>
        </div>
      </Shell>
    );
  }

  const isLast = current === steps.length - 1;
  const { title, description } = TITLES[step];

  return (
    <Shell mode={mode}>
      <div ref={topRef} className="flex flex-col gap-6">
        <Stepper steps={steps} current={current} />
        {restored ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-text">
            <span>Recuperamos lo que dejaste a medias en este navegador.</span>
            <ConfirmButton
              trigger={
                <Button type="button" variant="link" className="h-9 px-1 text-link">
                  Empezar de nuevo
                </Button>
              }
              title="¿Empezar de nuevo?"
              description="Se borra todo lo que configuraste hasta ahora en este navegador."
              confirmLabel="Borrar y empezar"
              onConfirm={() => {
                clearDraft(mode);
                reset(initialSetupForm());
                setStep("services");
                setRestored(false);
              }}
            />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-bold text-primary-text uppercase">
            Paso {current + 1} de {steps.length}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            {step === "services" ? <StepServices /> : null}
            {step === "business" ? <StepBusiness /> : null}
            {step === "offer" ? <StepOffer /> : null}
            {step === "building" ? <StepBuilding /> : null}
            {step === "account" ? <StepAccount goTo={goTo} /> : null}

            <FormMessage message={message} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
              <span className="text-sm text-muted-foreground">Podrás editar todo esto después.</span>
              <div className="flex gap-3">
                {current > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => goTo(steps[current - 1])}
                  >
                    Atrás
                  </Button>
                ) : null}
                {isLast ? (
                  <Button type="submit" className="h-11" disabled={pending}>
                    {pending ? "Guardando…" : mode === "signup" ? "Crear cuenta" : "Guardar configuración"}
                  </Button>
                ) : (
                  <Button type="button" className="h-11" onClick={goNext}>
                    Continuar
                  </Button>
                )}
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </Shell>
  );
}

function Shell({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-8">
        <div>
          <div className="font-bold">Gestión de residencias</div>
          <div className="text-sm text-muted-foreground">
            {mode === "signup" ? "Crea tu cuenta" : "Configura tu negocio"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle />
          <ThemeToggle />
        </div>
        {mode === "signup" ? (
          <p className="w-full text-sm text-muted-foreground sm:w-auto">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="font-semibold text-link underline-offset-4 hover:underline"
            >
              Iniciar sesión
            </Link>
          </p>
        ) : (
          <Link href="/panel" className="text-sm font-semibold text-link underline-offset-4 hover:underline">
            Volver al panel
          </Link>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
