CREATE TYPE "public"."tender_type" AS ENUM('quotation');--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "type" "tender_type" DEFAULT 'quotation' NOT NULL;--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "values" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tender" ADD CONSTRAINT "tender_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender" ADD CONSTRAINT "tender_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;