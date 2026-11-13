ALTER TABLE "meal_settings" ADD COLUMN "accepts_payment_proofs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD COLUMN "operation_code" text;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD COLUMN "proof_path" text;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD COLUMN "status" "payment_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD CONSTRAINT "pension_payment_reviewed_by_person_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_payment" ADD CONSTRAINT "pension_payment_proofPath_unique" UNIQUE("proof_path");--> statement-breakpoint
ALTER TABLE "pension_payment" ADD CONSTRAINT "pension_payment_rejection_reason" CHECK ("pension_payment"."status" <> 'rejected' or coalesce(trim("pension_payment"."rejection_reason"), '') <> '');--> statement-breakpoint
CREATE POLICY "pension_payment_insert_own" ON "pension_payment" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("pension_payment"."subscription_id" in (select s.id from public.pension_subscription s where s.resident_id in (select r.id from public.resident r where r.person_id in (select id from public.person where user_id = (select auth.uid())))) and "pension_payment"."registered_by" in (select id from public.person where user_id = (select auth.uid()))
        and "pension_payment"."status" = 'in_review' and "pension_payment"."reviewed_by" is null and "pension_payment"."proof_path" is not null
        and exists (select 1 from public.pension_subscription s
          join public.pension_plan p on p.id = s.plan_id
          join public.meal_settings ms on ms.business_id = p.business_id
          where s.id = "pension_payment"."subscription_id" and ms.accepts_payment_proofs));