import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameMetadataCache1793728469517 implements MigrationInterface {
  name = 'AddGameMetadataCache1793728469517';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "game_metadata_cache" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "kind" character varying NOT NULL, "payload" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b5b800acc9e33b874d4c95a4569" UNIQUE ("key"), CONSTRAINT "PK_74b95684d2d4ac6ac2f2a5e69ab" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74b51fca2e28d82af6dafa578c" ON "game_metadata_cache" ("kind") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2997c41435be6d35608df804c3" ON "game_metadata_cache" ("expiresAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2997c41435be6d35608df804c3"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_74b51fca2e28d82af6dafa578c"`
    );
    await queryRunner.query(`DROP TABLE "game_metadata_cache"`);
  }
}
