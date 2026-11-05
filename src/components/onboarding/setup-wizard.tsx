"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { decideMode, readDeviceInfo, saveViewMode, type ViewMode } from "@/lib/view-mode";
import { createAccountWithSetup, saveSetupForCurrentUser } from "@/server/onboarding/actions";
import {
  initialSetupForm,
  stepPosition,
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
import { OfferFooter, StepOffer } from "./step-offer";
import { ServicesFooter, StepServices } from "./step-services";

type Mode = "signup" | "existing";

// Títulos y textos de apoyo de cada paso, como el prototipo.
const TITLES: Record<StepId, { title: string; description: string }> = {
  services: {
    title: "¿Qué servicios ofreces?",
    description: "Elige uno o ambos. Armaremos tu sistema con las vistas que necesitas.",
  },
  business: {
    title: "Cuéntanos sobre tu negocio",
    description: "Estos datos aparecerán en los contratos y recibos, y nos ayudan a configurar tus cobros.",
  },
  offer: {
    title: "¿Qué ofreces?",
    description:
      "Elige el tamaño de lo que alquilas. Después definimos las unidades: departamentos, cuartos o ambos.",
  },
  building: {
    title: "Arma tu edificio",
    description: "Agrega los pisos y lo que alquilas en cada uno: departamentos, cuartos o ambos.",
  },
  account: {
    title: "Crea tu cuenta",
    description: "Último paso. Con tu cuenta podrás entrar a tu edificio y empezar a registrar residentes.",
  },
};

// Texto de la izquierda de la barra inferior, distinto en cada paso.
const FOOTER_NOTE: Record<StepId, ReactNode> = {
  services: <ServicesFooter />,
  business: "Podrás editar estos datos después desde Configuración.",
  offer: <OfferFooter />,
  building: "Podrás editar pisos y unidades después desde el edificio.",
  account: "Tus datos se guardan de forma segura.",
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
  // Modo de vista (3D o Simple): la misma preferencia guardada que la pantalla Edificio.
  const [device] = useState(() => decideMode(readDeviceInfo()));
  const [viewMode, setViewMode] = useState<ViewMode>(device.mode);
  const changeViewMode = (next: ViewMode) => {
    setViewMode(next);
    saveViewMode(next);
  };
  const can3d = device.notice !== "no_webgl";
  const toggle = (
    <ViewModeToggle
      mode={viewMode}
      onChange={changeViewMode}
      disable3d={can3d ? undefined : "Este navegador no puede mostrar 3D"}
    />
  );
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
      <Shell mode={mode} toggle={toggle}>
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
  const position = stepPosition(steps, step);

  return (
    <Shell mode={mode} toggle={toggle}>
      <div ref={topRef} className="flex flex-col gap-7">
        <Stepper groups={position.groups} current={position.index} />
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
          <p className="text-sm font-bold tracking-wide text-primary-text uppercase">
            Paso {position.index + 1} de {position.total}
            {position.part ? ` · Parte ${position.part.index + 1} de ${position.part.total}` : ""}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={submit} noValidate className="flex flex-col gap-7">
            {step === "services" ? <StepServices /> : null}
            {step === "business" ? <StepBusiness goTo={goTo} /> : null}
            {step === "offer" ? <StepOffer /> : null}
            {step === "building" ? (
              <StepBuilding mode={viewMode} onModeChange={changeViewMode} can3d={can3d} />
            ) : null}
            {step === "account" ? <StepAccount goTo={goTo} /> : null}

            <FormMessage message={message} />
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-4 shadow-card sm:px-6">
              <span className="text-sm text-muted-foreground">{FOOTER_NOTE[step]}</span>
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

// Encabezado del prototipo: marca a la izquierda, interruptor 3D/Simple al centro, acceso a la derecha.
function Shell({ mode, toggle, children }: { mode: Mode; toggle: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="font-bold">Gestión de residencias</div>
            <div className="text-sm text-muted-foreground">
              {mode === "signup" ? "Crea tu cuenta" : "Configura tu negocio"}
            </div>
          </div>
        </div>
        <div className="order-3 flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto">
          {toggle}
          <ThemeToggle />
        </div>
        {mode === "signup" ? (
          <p className="text-sm text-muted-foreground">
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
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-8 sm:py-9">{children}</main>
    </div>
  );
}
