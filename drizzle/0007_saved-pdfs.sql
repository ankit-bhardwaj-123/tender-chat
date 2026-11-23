CREATE TABLE "saved_pdf" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company_name" text NOT NULL,
	"template_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_pdf_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "saved_pdf" ADD CONSTRAINT "saved_pdf_tender_id_tender_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tender"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_pdf_tender_created_idx" ON "saved_pdf" USING btree ("tender_id","created_at");