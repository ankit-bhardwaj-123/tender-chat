CREATE TABLE "tender_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tender_image_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "custom_html" text;--> statement-breakpoint
ALTER TABLE "tender" ADD COLUMN "canvas" jsonb DEFAULT '{"items":[],"seal":{"shown":true,"x":null,"y":null,"width":35}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tender_image" ADD CONSTRAINT "tender_image_tender_id_tender_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tender"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tender_image_tender_idx" ON "tender_image" USING btree ("tender_id");