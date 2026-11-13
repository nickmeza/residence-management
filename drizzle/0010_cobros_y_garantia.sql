-- Fase 5: cobros y garantía. Generada con drizzle-kit desde src/db/schema.ts, más la parte escrita a mano
-- (funciones, triggers de la bitácora). Decisiones del dueño del 2026-11-12 en el README.
CREATE TYPE "public"."charge_concept" AS ENUM('rent', 'deposit', 'damages');--> statement-breakpoint
CREATE TYPE "public"."deposit_rule" AS ENUM('none', 'one_month', 'two_months', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('none', 'held', 'settling', 'returned');--> statement-breakpoint
CREATE TYPE "public"."discount_status" AS ENUM('active', 'disputed', 'adjusted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."inspection_area" AS ENUM('walls', 'door', 'window', 'furniture', 'keys', 'cleaning', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('in_review', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('draft', 'sent', 'closed');--> statement-breakpoint
CREATE TABLE "charge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"concept" charge_concept NOT NULL,
	"period" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_period_format" CHECK ("charge"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "charge_amount_not_negative" CHECK ("charge"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "charge" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deposit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"rule" "deposit_rule" NOT NULL,
	"status" "deposit_status" NOT NULL,
	"charge_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_contractId_unique" UNIQUE("contract_id"),
	CONSTRAINT "deposit_amount_not_negative" CHECK ("deposit"."amount" >= 0),
	CONSTRAINT "deposit_none_is_zero" CHECK (("deposit"."status" = 'none') = ("deposit"."amount" = 0))
);
--> statement-breakpoint
ALTER TABLE "deposit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deposit_refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"operation_code" text,
	"proof_path" text,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_refund_proofPath_unique" UNIQUE("proof_path"),
	CONSTRAINT "deposit_refund_amount_positive" CHECK ("deposit_refund"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "deposit_refund" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deposit_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"room_rule" "deposit_rule" DEFAULT 'none' NOT NULL,
	"room_fixed_amount" numeric(10, 2),
	"apartment_rule" "deposit_rule" DEFAULT 'none' NOT NULL,
	"apartment_fixed_amount" numeric(10, 2),
	"covers" "inspection_area"[] DEFAULT '{walls,door,window,furniture,keys,cleaning}' NOT NULL,
	"refund_days" smallint DEFAULT 7 NOT NULL,
	"refund_methods" "payment_method"[] DEFAULT '{yape,plin,transfer}' NOT NULL,
	"entry_report_days" smallint DEFAULT 7 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_settings_room_fixed" CHECK (("deposit_settings"."room_rule" = 'fixed') = ("deposit_settings"."room_fixed_amount" is not null) and coalesce("deposit_settings"."room_fixed_amount", 0) >= 0),
	CONSTRAINT "deposit_settings_apartment_fixed" CHECK (("deposit_settings"."apartment_rule" = 'fixed') = ("deposit_settings"."apartment_fixed_amount" is not null) and coalesce("deposit_settings"."apartment_fixed_amount", 0) >= 0),
	CONSTRAINT "deposit_settings_refund_days" CHECK ("deposit_settings"."refund_days" between 1 and 60),
	CONSTRAINT "deposit_settings_entry_days" CHECK ("deposit_settings"."entry_report_days" between 0 and 60)
);
--> statement-breakpoint
ALTER TABLE "deposit_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deposit_unit_exception" (
	"unit_id" uuid PRIMARY KEY NOT NULL,
	"rule" "deposit_rule" NOT NULL,
	"fixed_amount" numeric(10, 2),
	CONSTRAINT "deposit_unit_exception_fixed" CHECK (("deposit_unit_exception"."rule" = 'fixed') = ("deposit_unit_exception"."fixed_amount" is not null) and coalesce("deposit_unit_exception"."fixed_amount", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "deposit_unit_exception" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entry_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"area" "inspection_area" NOT NULL,
	"note" text NOT NULL,
	"photo_path" text NOT NULL,
	"reported_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_report_photoPath_unique" UNIQUE("photo_path")
);
--> statement-breakpoint
ALTER TABLE "entry_report" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "money_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "money_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"table_name" text NOT NULL,
	"row_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"old_row" jsonb,
	"new_row" jsonb,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "money_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"operation_code" text,
	"proof_path" text,
	"status" "payment_status" DEFAULT 'in_review' NOT NULL,
	"submitted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	CONSTRAINT "payment_proofPath_unique" UNIQUE("proof_path"),
	CONSTRAINT "payment_period_format" CHECK ("payment"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "payment_amount_positive" CHECK ("payment"."amount" > 0),
	CONSTRAINT "payment_rejection_reason" CHECK ("payment"."status" <> 'rejected' or coalesce(trim("payment"."rejection_reason"), '') <> '')
);
--> statement-breakpoint
ALTER TABLE "payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" uuid NOT NULL,
	"status" "settlement_status" DEFAULT 'draft' NOT NULL,
	"refund_method" "payment_method",
	"refund_account" text,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"excess_charge_id" uuid,
	"excess_waived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_depositId_unique" UNIQUE("deposit_id"),
	CONSTRAINT "settlement_sent_at" CHECK ("settlement"."status" = 'draft' or "settlement"."sent_at" is not null),
	CONSTRAINT "settlement_closed_at" CHECK ("settlement"."status" <> 'closed' or "settlement"."closed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "settlement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settlement_discount" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"area" "inspection_area" NOT NULL,
	"note" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"original_amount" numeric(10, 2),
	"photo_path" text,
	"worse_than_entry" boolean DEFAULT false NOT NULL,
	"status" "discount_status" DEFAULT 'active' NOT NULL,
	"dispute_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_discount_photoPath_unique" UNIQUE("photo_path"),
	CONSTRAINT "settlement_discount_amount_positive" CHECK ("settlement_discount"."amount" > 0),
	CONSTRAINT "settlement_discount_dispute_reason" CHECK ("settlement_discount"."status" <> 'disputed' or coalesce(trim("settlement_discount"."dispute_reason"), '') <> '')
);
--> statement-breakpoint
ALTER TABLE "settlement_discount" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business" ADD COLUMN "prorate_rent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "deposit_rule" "deposit_rule";--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "deposit_fixed_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "deposit_due_date" date;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_charge_id_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charge"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_refund" ADD CONSTRAINT "deposit_refund_settlement_id_settlement_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_refund" ADD CONSTRAINT "deposit_refund_registered_by_person_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_settings" ADD CONSTRAINT "deposit_settings_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_unit_exception" ADD CONSTRAINT "deposit_unit_exception_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_report" ADD CONSTRAINT "entry_report_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_report" ADD CONSTRAINT "entry_report_reported_by_person_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_submitted_by_person_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_reviewed_by_person_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_deposit_id_deposit_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_excess_charge_id_charge_id_fk" FOREIGN KEY ("excess_charge_id") REFERENCES "public"."charge"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_discount" ADD CONSTRAINT "settlement_discount_settlement_id_settlement_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_contract_id_idx" ON "charge" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "charge_period_idx" ON "charge" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "charge_rent_once_idx" ON "charge" USING btree ("contract_id","period") WHERE "charge"."concept" = 'rent';--> statement-breakpoint
CREATE INDEX "deposit_refund_settlement_id_idx" ON "deposit_refund" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "entry_report_contract_id_idx" ON "entry_report" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "payment_resident_period_idx" ON "payment" USING btree ("resident_id","period");--> statement-breakpoint
CREATE INDEX "settlement_discount_settlement_id_idx" ON "settlement_discount" USING btree ("settlement_id");--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_deposit_fixed" CHECK (("contract"."deposit_rule" is not distinct from 'fixed') = ("contract"."deposit_fixed_amount" is not null)
        and coalesce("contract"."deposit_fixed_amount", 0) >= 0);--> statement-breakpoint
-- Escrito a mano (drizzle-kit no crea funciones ni triggers). Va antes de las políticas porque
-- entry_report_insert_own usa entry_report_open.

-- ¿Puede el residente reportar todavía lo que ya estaba mal al ingresar? (regla 8, pregunta 10)
-- Sí mientras no pasen los días de Configuración › Garantía desde el inicio del contrato (7 si no hay configuración).
-- security definer: lee el contrato y la configuración del negocio sin pasar por su RLS.
CREATE FUNCTION public.entry_report_open(p_contract_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM public.contract c
    JOIN public.resident r ON r.id = c.resident_id
    LEFT JOIN public.deposit_settings s ON s.business_id = r.business_id
    WHERE c.id = p_contract_id
      AND c.status IN ('pending_signature', 'confirmed')
      AND (now() AT TIME ZONE 'America/Lima')::date <= c.start_date + coalesce(s.entry_report_days, 7)
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.entry_report_open(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.entry_report_open(uuid) TO authenticated;
--> statement-breakpoint

-- El residente responde su liquidación (GA-12, GA-14): dónde recibe la devolución y, si quiere, la acepta.
-- Va por una función y no por un permiso de escritura en settlement para que no pueda tocar montos ni estados.
CREATE FUNCTION public.respond_settlement(p_settlement_id uuid, p_method public.payment_method, p_account text, p_accept boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.settlement s
  SET refund_method = p_method,
      refund_account = nullif(trim(p_account), ''),
      accepted_at = CASE WHEN p_accept THEN now() ELSE s.accepted_at END
  FROM public.deposit d, public.contract c, public.resident r, public.person me
  WHERE s.id = p_settlement_id
    AND s.status = 'sent'
    AND d.id = s.deposit_id AND c.id = d.contract_id AND r.id = c.resident_id
    AND me.id = r.person_id AND me.user_id = (SELECT auth.uid());
  RETURN FOUND;
END;
$$;
--> statement-breakpoint

-- El residente disputa un descuento vigente (GA-13), con su motivo. Regla 7: deja de restarse y no se paga.
CREATE FUNCTION public.dispute_discount(p_discount_id uuid, p_reason text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN
    RETURN false;
  END IF;
  UPDATE public.settlement_discount x
  SET status = 'disputed', dispute_reason = trim(p_reason)
  FROM public.settlement s, public.deposit d, public.contract c, public.resident r, public.person me
  WHERE x.id = p_discount_id AND x.status = 'active'
    AND s.id = x.settlement_id AND s.status = 'sent'
    AND d.id = s.deposit_id AND c.id = d.contract_id AND r.id = c.resident_id
    AND me.id = r.person_id AND me.user_id = (SELECT auth.uid());
  RETURN FOUND;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.respond_settlement(uuid, public.payment_method, text, boolean) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.dispute_discount(uuid, text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.respond_settlement(uuid, public.payment_method, text, boolean) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.dispute_discount(uuid, text) TO authenticated;
--> statement-breakpoint

-- Cómo pagarle a cada residencia donde vive quien inició sesión (nombre, RUC, teléfono y métodos que acepta),
-- sin darle permiso de leer business (ver la nota de my_resident_places, migración 0009).
CREATE FUNCTION public.my_payment_info()
RETURNS TABLE (business_id uuid, trade_name text, ruc text, phone text, payment_methods public.payment_method[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT b.id, b.trade_name, b.ruc, b.phone, b.payment_methods
  FROM public.resident r
  JOIN public.person me ON me.id = r.person_id AND me.user_id = (SELECT auth.uid())
  JOIN public.business b ON b.id = r.business_id;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.my_payment_info() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.my_payment_info() TO authenticated;
--> statement-breakpoint

-- Bitácora (CLAUDE.md, sección 10): cada cambio en las tablas de dinero queda anotado con la fila antes y después
-- y la cuenta que lo hizo. security definer: escribe en money_log aunque nadie tenga permiso sobre ella.
CREATE FUNCTION public.log_money_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.money_log (table_name, row_id, operation, old_row, new_row, actor_user_id)
  VALUES (
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    (SELECT auth.uid())
  );
  RETURN coalesce(NEW, OLD);
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.log_money_change() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER charge_money_log AFTER INSERT OR UPDATE OR DELETE ON public.charge FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
--> statement-breakpoint
CREATE TRIGGER payment_money_log AFTER INSERT OR UPDATE OR DELETE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
--> statement-breakpoint
CREATE TRIGGER deposit_money_log AFTER INSERT OR UPDATE OR DELETE ON public.deposit FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
--> statement-breakpoint
CREATE TRIGGER settlement_money_log AFTER INSERT OR UPDATE OR DELETE ON public.settlement FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
--> statement-breakpoint
CREATE TRIGGER settlement_discount_money_log AFTER INSERT OR UPDATE OR DELETE ON public.settlement_discount FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
--> statement-breakpoint
CREATE TRIGGER deposit_refund_money_log AFTER INSERT OR UPDATE OR DELETE ON public.deposit_refund FOR EACH ROW EXECUTE FUNCTION public.log_money_change();
--> statement-breakpoint
CREATE POLICY "charge_landlord_all" ON "charge" AS PERMISSIVE FOR ALL TO "authenticated" USING ("charge"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))) WITH CHECK ("charge"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "charge_select_own" ON "charge" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("charge"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "deposit_landlord_all" ON "deposit" AS PERMISSIVE FOR ALL TO "authenticated" USING ("deposit"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))) WITH CHECK ("deposit"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "deposit_select_own" ON "deposit" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("deposit"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "deposit_refund_landlord_all" ON "deposit_refund" AS PERMISSIVE FOR ALL TO "authenticated" USING ("deposit_refund"."settlement_id" in (select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))))) WITH CHECK ("deposit_refund"."settlement_id" in (select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))));--> statement-breakpoint
CREATE POLICY "deposit_refund_select_own" ON "deposit_refund" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("deposit_refund"."settlement_id" in (select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where s.status <> 'draft' and d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "deposit_settings_landlord_all" ON "deposit_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("deposit_settings"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("deposit_settings"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "deposit_settings_select_as_resident" ON "deposit_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("deposit_settings"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "deposit_unit_exception_landlord_all" ON "deposit_unit_exception" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from public.unit u join public.floor f on f.id = u.floor_id
        join public.property p on p.id = f.property_id where u.id = "deposit_unit_exception"."unit_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK (exists (select 1 from public.unit u join public.floor f on f.id = u.floor_id
        join public.property p on p.id = f.property_id where u.id = "deposit_unit_exception"."unit_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "entry_report_landlord_all" ON "entry_report" AS PERMISSIVE FOR ALL TO "authenticated" USING ("entry_report"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))) WITH CHECK ("entry_report"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "entry_report_select_own" ON "entry_report" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("entry_report"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "entry_report_insert_own" ON "entry_report" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("entry_report"."contract_id" in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))) and "entry_report"."reported_by" in (select id from public.person where user_id = (select auth.uid()))
        and public.entry_report_open("entry_report"."contract_id"));--> statement-breakpoint
CREATE POLICY "payment_landlord_all" ON "payment" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payment"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("payment"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "payment_select_own" ON "payment" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("payment"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "payment_insert_own" ON "payment" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("payment"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))) and "payment"."submitted_by" in (select id from public.person where user_id = (select auth.uid()))
        and "payment"."status" = 'in_review' and "payment"."reviewed_by" is null);--> statement-breakpoint
CREATE POLICY "settlement_landlord_all" ON "settlement" AS PERMISSIVE FOR ALL TO "authenticated" USING ("settlement"."deposit_id" in (select d.id from public.deposit d where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))))) WITH CHECK ("settlement"."deposit_id" in (select d.id from public.deposit d where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))));--> statement-breakpoint
CREATE POLICY "settlement_select_own" ON "settlement" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("settlement"."status" <> 'draft'
        and "settlement"."deposit_id" in (select d.id from public.deposit d where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))))));--> statement-breakpoint
CREATE POLICY "settlement_discount_landlord_all" ON "settlement_discount" AS PERMISSIVE FOR ALL TO "authenticated" USING ("settlement_discount"."settlement_id" in (select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))))) WITH CHECK ("settlement_discount"."settlement_id" in (select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))))));--> statement-breakpoint
CREATE POLICY "settlement_discount_select_own" ON "settlement_discount" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("settlement_discount"."settlement_id" in (select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where s.status <> 'draft' and d.contract_id in (select c.id from public.contract c where c.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))))));