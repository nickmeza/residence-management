CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"business_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"urgent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_title" CHECK (length(trim("notification"."title")) between 1 and 200),
	CONSTRAINT "notification_body" CHECK ("notification"."body" is null or length("notification"."body") <= 2000),
	CONSTRAINT "notification_link" CHECK ("notification"."link" is null or "notification"."link" ~ '^/[^/]')
);
--> statement-breakpoint
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_person_created_idx" ON "notification" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE POLICY "notification_select_own" ON "notification" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notification"."person_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "notification_update_own" ON "notification" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notification"."person_id" in (select id from public.person where user_id = (select auth.uid()))) WITH CHECK ("notification"."person_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "notification_delete_own" ON "notification" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("notification"."person_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint

-- Parte 2 (escrita a mano): las dos únicas formas de crear una notificación. Nadie inserta en la tabla directo (no
-- tiene política de insert). Solo se avisa dentro de un mismo negocio:
-- - notify_owner: un residente (o comensal) avisa al dueño del negocio donde tiene ficha.
-- - notify_resident: el dueño del negocio avisa a una de sus fichas (residente o comensal).
-- El texto lo arma el servidor (src/server/notifications). Devuelven true si se creó.
CREATE FUNCTION public.notify_owner(
  p_business_id uuid, p_type text, p_title text, p_body text, p_link text, p_urgent boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT b.owner_id INTO v_owner
  FROM public.business b
  JOIN public.resident r ON r.business_id = b.id
  JOIN public.person me ON me.id = r.person_id
  WHERE b.id = p_business_id AND me.user_id = (SELECT auth.uid())
  LIMIT 1;
  -- Sin ficha en ese negocio, o el dueño avisándose a sí mismo: no se crea nada.
  IF v_owner IS NULL OR EXISTS (
    SELECT 1 FROM public.person me WHERE me.id = v_owner AND me.user_id = (SELECT auth.uid())
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.notification (person_id, business_id, type, title, body, link, urgent)
  VALUES (v_owner, p_business_id, p_type, p_title, p_body, p_link, coalesce(p_urgent, false));
  RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.notify_owner(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.notify_owner(uuid, text, text, text, text, boolean) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.notify_resident(
  p_resident_id uuid, p_type text, p_title text, p_body text, p_link text, p_urgent boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_person uuid;
  v_business uuid;
BEGIN
  SELECT r.person_id, r.business_id INTO v_person, v_business
  FROM public.resident r
  JOIN public.business b ON b.id = r.business_id
  JOIN public.person me ON me.id = b.owner_id
  WHERE r.id = p_resident_id AND me.user_id = (SELECT auth.uid());
  IF v_person IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.notification (person_id, business_id, type, title, body, link, urgent)
  VALUES (v_person, v_business, p_type, p_title, p_body, p_link, coalesce(p_urgent, false));
  RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.notify_resident(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.notify_resident(uuid, text, text, text, text, boolean) TO authenticated;
