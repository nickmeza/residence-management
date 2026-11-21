ALTER TYPE "public"."document_kind" ADD VALUE 'contract_file';--> statement-breakpoint
ALTER TABLE "contract" DROP CONSTRAINT "contract_none_without_signature";--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_confirmed_by_person_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_contract_file_has_contract" CHECK ("document"."kind"::text <> 'contract_file' or "document"."contract_id" is not null);--> statement-breakpoint
ALTER POLICY "document_insert_own" ON "document" TO authenticated WITH CHECK ("document"."resident_id" in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid()))) and "document"."uploaded_by" in (select id from public.person where user_id = (select auth.uid()))
        and "document"."status" = 'in_review' and "document"."reviewed_by" is null and "document"."kind"::text <> 'contract_file');