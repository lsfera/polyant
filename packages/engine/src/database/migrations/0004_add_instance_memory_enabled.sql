ALTER TABLE "instances" ADD COLUMN "memory_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "instances" ADD COLUMN "langsmith_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "instances" ADD COLUMN "langsmith_project" varchar(255);
ALTER TABLE "instances" ADD COLUMN "auth_enabled" boolean NOT NULL DEFAULT false;