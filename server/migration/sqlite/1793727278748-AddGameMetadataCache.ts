import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameMetadataCache1793727278748 implements MigrationInterface {
  name = 'AddGameMetadataCache1793727278748';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "game_metadata_cache" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "key" varchar NOT NULL, "kind" varchar NOT NULL, "payload" text NOT NULL, "expiresAt" datetime NOT NULL, "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_b5b800acc9e33b874d4c95a4569" UNIQUE ("key"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74b51fca2e28d82af6dafa578c" ON "game_metadata_cache" ("kind") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2997c41435be6d35608df804c3" ON "game_metadata_cache" ("expiresAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_2997c41435be6d35608df804c3"`);
    await queryRunner.query(`DROP INDEX "IDX_74b51fca2e28d82af6dafa578c"`);
    await queryRunner.query(`DROP TABLE "game_metadata_cache"`);
  }
}
