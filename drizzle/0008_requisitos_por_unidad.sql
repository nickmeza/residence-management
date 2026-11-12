-- Requisitos de documentos: una lista para cuarto y otra para departamento (unit_type), interruptor "activo",
-- y excepciones por residente ("a esta persona no se lo pido"). Se quita "Para: propiedad" (property_id).
-- unit_type no tiene valor por defecto: la tabla está vacía al escribir esto (2026-11-11).

CREATE TABLE "document_requirement_exemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_requirement_exemption" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_requirement" ADD COLUMN "unit_type" "unit_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "document_requirement" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_requirement_exemption" ADD CONSTRAINT "document_requirement_exemption_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement_exemption" ADD CONSTRAINT "document_requirement_exemption_requirement_id_document_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement_exemption" ADD CONSTRAINT "document_requirement_exemption_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_requirement_exemption_pair_idx" ON "document_requirement_exemption" USING btree ("resident_id","requirement_id");--> statement-breakpoint
CREATE INDEX "document_requirement_exemption_requirement_id_idx" ON "document_requirement_exemption" USING btree ("requirement_id");--> statement-breakpoint
CREATE POLICY "document_requirement_exemption_landlord_all" ON "document_requirement_exemption" AS PERMISSIVE FOR ALL TO "authenticated" USING ("document_requirement_exemption"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid()))))) WITH CHECK ("document_requirement_exemption"."resident_id" in (select r.id from public.resident r where r.business_id in (select b.id from public.business b where b.owner_id in (select id from public.person where user_id = (select auth.uid())))) and exists (
        select 1 from public.document_requirement q join public.resident r on r.business_id = q.business_id
        where q.id = "document_requirement_exemption"."requirement_id" and r.id = "document_requirement_exemption"."resident_id"));--> statement-breakpoint
CREATE POLICY "document_requirement_exemption_select_own" ON "document_requirement_exemption" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("document_requirement_exemption"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
ALTER POLICY "document_requirement_select_as_resident" ON "document_requirement" TO authenticated USING ("document_requirement"."required" and "document_requirement"."active"
        and "document_requirement"."business_id" in (select r.business_id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))));--> statement-breakpoint
ALTER TABLE "document_requirement" DROP CONSTRAINT "document_requirement_property_id_property_id_fk";
--> statement-breakpoint
ALTER TABLE "document_requirement" DROP COLUMN "property_id";