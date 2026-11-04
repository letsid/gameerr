import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLibraryAndFulfillment1793776287151 implements MigrationInterface {
  name = 'AddLibraryAndFulfillment1793776287151';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "library_item" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "igdbId" integer NOT NULL, "platform" integer NOT NULL, "source" varchar NOT NULL, "externalId" varchar, "sourceStatus" varchar, "syncedAt" datetime NOT NULL, CONSTRAINT "UNIQUE_LIBRARY_ITEM" UNIQUE ("igdbId", "platform", "source"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_261709fcfbf66bf4970b70ed62" ON "library_item" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_551c6fcba50bb493613eb13997" ON "library_item" ("source") `
    );
    await queryRunner.query(`DROP INDEX "IDX_83ef6b154f70c504fe88554f9f"`);
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL DEFAULT ('game'), "platform" integer NOT NULL, "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer, "fulfillmentProvider" varchar, "fulfillmentState" varchar, "fulfillmentMessage" varchar, "fulfillmentCheckedAt" datetime, CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_83ef6b154f70c504fe88554f9f" ON "media_request" ("platform") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1" ON "media_request" ("modifiedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6997bee94720f1ecb7f3113709" ON "media_request" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1aa713f41c99e9d10c48da75a" ON "media_request" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4c696e8ed36ae34fe18abe59d2" ON "media_request" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_42adfa7313ce1fa661dab29bcb" ON "media_request" ("fulfillmentProvider") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_42adfa7313ce1fa661dab29bcb"`);
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(`DROP INDEX "IDX_83ef6b154f70c504fe88554f9f"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL DEFAULT ('game'), "platform" integer NOT NULL, "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_4c696e8ed36ae34fe18abe59d2" ON "media_request" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1aa713f41c99e9d10c48da75a" ON "media_request" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6997bee94720f1ecb7f3113709" ON "media_request" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1" ON "media_request" ("modifiedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_83ef6b154f70c504fe88554f9f" ON "media_request" ("platform") `
    );
    await queryRunner.query(`DROP INDEX "IDX_551c6fcba50bb493613eb13997"`);
    await queryRunner.query(`DROP INDEX "IDX_261709fcfbf66bf4970b70ed62"`);
    await queryRunner.query(`DROP TABLE "library_item"`);
  }
}
