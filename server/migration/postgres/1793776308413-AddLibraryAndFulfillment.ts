import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLibraryAndFulfillment1793776308413 implements MigrationInterface {
  name = 'AddLibraryAndFulfillment1793776308413';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "library_item" ("id" SERIAL NOT NULL, "igdbId" integer NOT NULL, "platform" integer NOT NULL, "source" character varying NOT NULL, "externalId" character varying, "sourceStatus" character varying, "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UNIQUE_LIBRARY_ITEM" UNIQUE ("igdbId", "platform", "source"), CONSTRAINT "PK_50dce1705de49cc0ecee60fb09b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_261709fcfbf66bf4970b70ed62" ON "library_item" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_551c6fcba50bb493613eb13997" ON "library_item" ("source") `
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "fulfillmentProvider" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "fulfillmentState" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "fulfillmentMessage" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "fulfillmentCheckedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_42adfa7313ce1fa661dab29bcb" ON "media_request" ("fulfillmentProvider") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_42adfa7313ce1fa661dab29bcb"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "fulfillmentCheckedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "fulfillmentMessage"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "fulfillmentState"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "fulfillmentProvider"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_551c6fcba50bb493613eb13997"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_261709fcfbf66bf4970b70ed62"`
    );
    await queryRunner.query(`DROP TABLE "library_item"`);
  }
}
