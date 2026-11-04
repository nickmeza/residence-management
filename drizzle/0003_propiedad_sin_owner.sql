ALTER TABLE "property" DROP CONSTRAINT "property_owner_id_person_id_fk";
--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "owner_id";