CREATE TYPE "public"."template_language" AS ENUM('hi', 'en');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('active', 'void');--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"language" "template_language" DEFAULT 'hi' NOT NULL,
	"status" "template_status" DEFAULT 'active' NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"placeholders" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_user_created_idx" ON "template" USING btree ("user_id","created_at");