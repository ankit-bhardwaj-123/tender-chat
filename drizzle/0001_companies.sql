CREATE TYPE "public"."company_file_kind" AS ENUM('letterhead', 'seal');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('active', 'void');--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "company_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_file" (
	"company_id" uuid NOT NULL,
	"kind" "company_file_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_file_company_id_kind_pk" PRIMARY KEY("company_id","kind"),
	CONSTRAINT "company_file_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_file" ADD CONSTRAINT "company_file_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_user_created_idx" ON "company" USING btree ("user_id","created_at");