ALTER TABLE "tender" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "tender" ADD CONSTRAINT "tender_parent_id_tender_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tender"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tender_user_parent_idx" ON "tender" USING btree ("user_id","parent_id");