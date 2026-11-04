CREATE TYPE "public"."space_type" AS ENUM('bedroom', 'studio', 'office', 'storage', 'other');--> statement-breakpoint
ALTER TABLE "unit" ADD COLUMN "space_type" "space_type";