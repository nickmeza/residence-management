CREATE TYPE "public"."contract_paperwork" AS ENUM('none', 'paper', 'template');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'pending_signature', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."document_format" AS ENUM('pdf', 'image');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('requirement', 'signed_contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('in_review', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."identity_document_type" AS ENUM('dni', 'foreign_id', 'passport');--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"monthly_rent" numeric(10, 2) NOT NULL,
	"payment_day" smallint NOT NULL,
	"paperwork" "contract_paperwork" NOT NULL,
	"template_id" uuid,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"renewed_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_dates_order" CHECK ("contract"."end_date" is null or "contract"."end_date" >= "contract"."start_date"),
	CONSTRAINT "contract_rent_not_negative" CHECK ("contract"."monthly_rent" >= 0),
	CONSTRAINT "contract_payment_day_range" CHECK ("contract"."payment_day" between 1 and 31),
	CONSTRAINT "contract_template_matches_paperwork" CHECK (("contract"."paperwork" = 'template') = ("contract"."template_id" is not null)),
	CONSTRAINT "contract_none_without_signature" CHECK ("contract"."paperwork" <> 'none' or "contract"."status" <> 'pending_signature'),
	CONSTRAINT "contract_confirmed_at" CHECK ("contract"."status" <> 'confirmed' or "contract"."confirmed_at" is not null),
	CONSTRAINT "contract_cancelled_at" CHECK ("contract"."status" <> 'cancelled' or "contract"."cancelled_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "contract" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contract_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"requirement_id" uuid,
	"contract_id" uuid,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "document_status" DEFAULT 'in_review' NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	CONSTRAINT "document_storagePath_unique" UNIQUE("storage_path"),
	CONSTRAINT "document_size_positive" CHECK ("document"."size_bytes" > 0),
	CONSTRAINT "document_rejection_reason" CHECK ("document"."status" <> 'rejected' or coalesce(trim("document"."rejection_reason"), '') <> ''),
	CONSTRAINT "document_signed_contract_has_contract" CHECK ("document"."kind" <> 'signed_contract' or "document"."contract_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_requirement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"property_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"accepted_formats" "document_format"[] DEFAULT '{pdf,image}' NOT NULL,
	"max_size_mb" smallint DEFAULT 5 NOT NULL,
	CONSTRAINT "document_requirement_max_size" CHECK ("document_requirement"."max_size_mb" between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "document_requirement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"university" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resident_invitation_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "resident_invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "identity_document_type" "identity_document_type";--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "identity_document_number" text;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_template_id_contract_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_template"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_renewed_from_id_contract_id_fk" FOREIGN KEY ("renewed_from_id") REFERENCES "public"."contract"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_template" ADD CONSTRAINT "contract_template_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_requirement_id_document_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_person_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_reviewed_by_person_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement" ADD CONSTRAINT "document_requirement_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement" ADD CONSTRAINT "document_requirement_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident" ADD CONSTRAINT "resident_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident" ADD CONSTRAINT "resident_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_invitation" ADD CONSTRAINT "resident_invitation_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_invitation" ADD CONSTRAINT "resident_invitation_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_unit_id_idx" ON "contract" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "contract_resident_id_idx" ON "contract" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "contract_template_business_id_idx" ON "contract_template" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "document_resident_id_idx" ON "document" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "document_contract_id_idx" ON "document" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "document_requirement_business_id_idx" ON "document_requirement" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resident_business_person_idx" ON "resident" USING btree ("business_id","person_id");--> statement-breakpoint
CREATE INDEX "resident_person_id_idx" ON "resident" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "resident_invitation_resident_id_idx" ON "resident_invitation" USING btree ("resident_id");--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_identity_document_pair" CHECK (("person"."identity_document_type" is null) = ("person"."identity_document_number" is null));--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_dni_format" CHECK ("person"."identity_document_type" is distinct from 'dni' or "person"."identity_document_number" ~ '^[0-9]{8}$');--> statement-breakpoint
-- Escrita a mano (drizzle-kit no crea funciones). ¿La persona es residente de algún negocio de quien inició sesión?
-- security definer: consulta resident y business sin pasar por su RLS. Si la política de person consultara
-- resident directamente, el RLS de resident volvería a consultar person y la base entraría en un bucle.
-- search_path vacío: obliga a escribir public.… completo, igual que handle_new_user (migración 0001).
CREATE FUNCTION public.is_resident_of_my_business(p_person_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM public.resident r
    JOIN public.business b ON b.id = r.business_id
    JOIN public.person me ON me.id = b.owner_id
    WHERE r.person_id = p_person_id AND me.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint
-- Solo la usan las políticas, que corren como "authenticated".
REVOKE EXECUTE ON FUNCTION public.is_resident_of_my_business(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_resident_of_my_business(uuid) TO authenticated;
--> statement-breakpoint
CREATE POLICY "person_select_my_residents" ON "person" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_resident_of_my_business("person"."id"));--> statement-breakpoint
CREATE POLICY "person_update_my_residents_without_account" ON "person" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("person"."user_id" is null and public.is_resident_of_my_business("person"."id")) WITH CHECK ("person"."user_id" is null and public.is_resident_of_my_business("person"."id"));--> statement-breakpoint
CREATE POLICY "person_insert_without_account" ON "person" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("person"."user_id" is null);--> statement-breakpoint
CREATE POLICY "contract_landlord_all" ON "contract" AS PERMISSIVE FOR ALL TO "authenticated" USING ("contract"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("contract"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) and exists (
        select 1 from public.unit u join public.floor f on f.id = u.floor_id join public.property p on p.id = f.property_id
        where u.id = "contract"."unit_id" and p.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "contract_select_own" ON "contract" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("contract"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "contract_template_landlord_all" ON "contract_template" AS PERMISSIVE FOR ALL TO "authenticated" USING ("contract_template"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("contract_template"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "document_landlord_all" ON "document" AS PERMISSIVE FOR ALL TO "authenticated" USING ("document"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("document"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));--> statement-breakpoint
CREATE POLICY "document_select_own" ON "document" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("document"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "document_insert_own" ON "document" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("document"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))) and "document"."uploaded_by" in (select id from public.person where user_id = (select auth.uid()))
        and "document"."status" = 'in_review' and "document"."reviewed_by" is null);--> statement-breakpoint
CREATE POLICY "document_requirement_landlord_all" ON "document_requirement" AS PERMISSIVE FOR ALL TO "authenticated" USING ("document_requirement"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("document_requirement"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "document_requirement_select_as_resident" ON "document_requirement" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("document_requirement"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "resident_landlord_all" ON "resident" AS PERMISSIVE FOR ALL TO "authenticated" USING ("resident"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) WITH CHECK ("resident"."business_id" in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "resident_select_own" ON "resident" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("resident"."person_id" in (select id from public.person where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "resident_invitation_landlord_all" ON "resident_invitation" AS PERMISSIVE FOR ALL TO "authenticated" USING ("resident_invitation"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("resident_invitation"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))));