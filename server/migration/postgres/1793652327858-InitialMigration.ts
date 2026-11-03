import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1793652327858 implements MigrationInterface {
  name = 'InitialMigration1793652327858';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" SERIAL NOT NULL, "status" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" character varying NOT NULL DEFAULT 'game', "platform" integer NOT NULL, "ignoreQuota" boolean NOT NULL DEFAULT false, "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "PK_f8334500e8e12db87536558c66c" PRIMARY KEY ("id"))`
    );
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
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" SERIAL NOT NULL, "endpoint" character varying NOT NULL, "p256dh" character varying NOT NULL, "auth" character varying NOT NULL, "userAgent" character varying, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(), "userId" integer, CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "PK_397020e7be9a4086cc798e0bb63" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("id" SERIAL NOT NULL, "locale" character varying NOT NULL DEFAULT '', "preferredPlatforms" text, "pgpKey" character varying, "discordIds" text, "pushbulletAccessToken" character varying, "pushoverApplicationToken" character varying, "pushoverUserKey" character varying, "pushoverSound" character varying, "telegramChatId" character varying, "telegramMessageThreadId" character varying, "telegramSendSilently" boolean, "notificationTypes" text, "userId" integer, CONSTRAINT "REL_986a2b6d3c05eb4091bb8066f7" UNIQUE ("userId"), CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "plexUsername" character varying, "jellyfinUsername" character varying, "username" character varying, "password" character varying, "resetPasswordGuid" character varying, "recoveryLinkExpirationDate" TIMESTAMP WITH TIME ZONE, "userType" integer NOT NULL DEFAULT '1', "plexId" integer, "jellyfinUserId" character varying, "jellyfinDeviceId" character varying, "jellyfinAuthToken" character varying, "plexToken" character varying, "permissions" integer NOT NULL DEFAULT '0', "avatar" character varying NOT NULL, "avatarETag" character varying, "avatarVersion" character varying, "gameQuotaLimit" integer, "gameQuotaDays" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL DEFAULT 'game', "title" character varying NOT NULL, "igdbId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestedById" integer, "mediaId" integer, CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("igdbId", "requestedById"), CONSTRAINT "PK_0c8c0dbcc8d379117138e71ad5b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1f5f16b7dc67bf1aba66dd25fb" ON "watchlist" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae34e6b153a90672eb9dc4857d" ON "watchlist" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6641da8d831b93dfcb429f8b8b" ON "watchlist" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE TABLE "media" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL DEFAULT 'game', "igdbId" integer NOT NULL, "steamAppId" integer, "title" character varying, "coverImageId" character varying, "platforms" text, "status" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mediaAddedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_d7ac78c69d2f3092b4440808a45" UNIQUE ("igdbId"), CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7ac78c69d2f3092b4440808a4" ON "media" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a7eff4163e457c8ff645a41368" ON "media" ("steamAppId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c730c2d67f271a372c39a07b7e" ON "media" ("status") `
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL DEFAULT 'game', "title" character varying, "igdbId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_2e0a6ec7f304c70d0a7ef5a55de" UNIQUE ("igdbId"), CONSTRAINT "REL_5c8af2d0e83b3be6d250eccc19" UNIQUE ("mediaId"), CONSTRAINT "PK_c3a1a2ea2ffda610496ce852572" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d" ON "blocklist" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "discover_slider" ("id" SERIAL NOT NULL, "type" integer NOT NULL, "order" integer NOT NULL, "isBuiltIn" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, "title" character varying, "data" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_20a71a098d04bae448e4d51db23" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("expiredAt" bigint NOT NULL, "id" character varying(255) NOT NULL, "json" text NOT NULL, "destroyedAt" TIMESTAMP, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28c5d1d16da7908c97c9bc2f74" ON "session" ("expiredAt") `
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "FK_ae34e6b153a90672eb9dc4857d7" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_356721a49f145aa439c16e6b999"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "FK_ae34e6b153a90672eb9dc4857d7"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP CONSTRAINT "FK_03f7958328e311761b0de675fbe"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP CONSTRAINT "FK_6997bee94720f1ecb7f31137095"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28c5d1d16da7908c97c9bc2f74"`
    );
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TABLE "discover_slider"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_356721a49f145aa439c16e6b99"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e0a6ec7f304c70d0a7ef5a55d"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c730c2d67f271a372c39a07b7e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7eff4163e457c8ff645a41368"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d7ac78c69d2f3092b4440808a4"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6641da8d831b93dfcb429f8b8b"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae34e6b153a90672eb9dc4857d"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1f5f16b7dc67bf1aba66dd25fb"`
    );
    await queryRunner.query(`DROP TABLE "watchlist"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03f7958328e311761b0de675fb"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_83ef6b154f70c504fe88554f9f"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f4fc4efa14c3ba2b29c4525fa1"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6997bee94720f1ecb7f3113709"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a1aa713f41c99e9d10c48da75a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4c696e8ed36ae34fe18abe59d2"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
  }
}
