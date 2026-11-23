CREATE TYPE "public"."saved_pdf_file_kind" AS ENUM('letterhead', 'seal', 'template', 'image');--> statement-breakpoint
CREATE TABLE "saved_pdf_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_pdf_id" uuid NOT NULL,
	"kind" "saved_pdf_file_kind" NOT NULL,
	"image_id" uuid,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	CONSTRAINT "saved_pdf_file_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "saved_pdf" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "saved_pdf" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "editing_pdf_id" uuid;--> statement-breakpoint
ALTER TABLE "saved_pdf_file" ADD CONSTRAINT "saved_pdf_file_saved_pdf_id_saved_pdf_id_fk" FOREIGN KEY ("saved_pdf_id") REFERENCES "public"."saved_pdf"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_pdf_file_pdf_idx" ON "saved_pdf_file" USING btree ("saved_pdf_id");--> statement-breakpoint
ALTER TABLE "tender" ADD CONSTRAINT "tender_editing_pdf_id_saved_pdf_id_fk" FOREIGN KEY ("editing_pdf_id") REFERENCES "public"."saved_pdf"("id") ON DELETE set null ON UPDATE no action;