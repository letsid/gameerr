import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1793652183374 implements MigrationInterface {
  name = 'InitialMigration1793652183374';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL DEFAULT ('game'), "platform" integer NOT NULL, "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer)`
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
      `CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), "userId" integer, CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "locale" varchar NOT NULL DEFAULT (''), "preferredPlatforms" text, "pgpKey" varchar, "discordIds" text, "pushbulletAccessToken" varchar, "pushoverApplicationToken" varchar, "pushoverUserKey" varchar, "pushoverSound" varchar, "telegramChatId" varchar, "telegramMessageThreadId" varchar, "telegramSendSilently" boolean, "notificationTypes" text, "userId" integer, CONSTRAINT "REL_986a2b6d3c05eb4091bb8066f7" UNIQUE ("userId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "plexUsername" varchar, "jellyfinUsername" varchar, "username" varchar, "password" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" datetime, "userType" integer NOT NULL DEFAULT (1), "plexId" integer, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "jellyfinAuthToken" varchar, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "avatarETag" varchar, "avatarVersion" varchar, "gameQuotaLimit" integer, "gameQuotaDays" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "title" varchar NOT NULL, "igdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "requestedById" integer, "mediaId" integer, CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("igdbId", "requestedById"))`
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
      `CREATE TABLE "media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "igdbId" integer NOT NULL, "steamAppId" integer, "title" varchar, "coverImageId" varchar, "platforms" text, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime, CONSTRAINT "UQ_d7ac78c69d2f3092b4440808a45" UNIQUE ("igdbId"))`
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
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "title" varchar, "igdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_2e0a6ec7f304c70d0a7ef5a55de" UNIQUE ("igdbId"), CONSTRAINT "REL_5c8af2d0e83b3be6d250eccc19" UNIQUE ("mediaId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d" ON "blocklist" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "discover_slider" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" integer NOT NULL, "order" integer NOT NULL, "isBuiltIn" boolean NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "title" varchar, "data" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("expiredAt" bigint NOT NULL, "id" varchar(255) PRIMARY KEY NOT NULL, "json" text NOT NULL, "destroyedAt" datetime)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28c5d1d16da7908c97c9bc2f74" ON "session" ("expiredAt") `
    );
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(`DROP INDEX "IDX_83ef6b154f70c504fe88554f9f"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL DEFAULT ('game'), "platform" integer NOT NULL, "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
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
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), "userId" integer, CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userAgent", "createdAt", "userId") SELECT "id", "endpoint", "p256dh", "auth", "userAgent", "createdAt", "userId" FROM "user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "locale" varchar NOT NULL DEFAULT (''), "preferredPlatforms" text, "pgpKey" varchar, "discordIds" text, "pushbulletAccessToken" varchar, "pushoverApplicationToken" varchar, "pushoverUserKey" varchar, "pushoverSound" varchar, "telegramChatId" varchar, "telegramMessageThreadId" varchar, "telegramSendSilently" boolean, "notificationTypes" text, "userId" integer, CONSTRAINT "REL_986a2b6d3c05eb4091bb8066f7" UNIQUE ("userId"), CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_settings"("id", "locale", "preferredPlatforms", "pgpKey", "discordIds", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "pushoverSound", "telegramChatId", "telegramMessageThreadId", "telegramSendSilently", "notificationTypes", "userId") SELECT "id", "locale", "preferredPlatforms", "pgpKey", "discordIds", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "pushoverSound", "telegramChatId", "telegramMessageThreadId", "telegramSendSilently", "notificationTypes", "userId" FROM "user_settings"`
    );
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_settings" RENAME TO "user_settings"`
    );
    await queryRunner.query(`DROP INDEX "IDX_1f5f16b7dc67bf1aba66dd25fb"`);
    await queryRunner.query(`DROP INDEX "IDX_ae34e6b153a90672eb9dc4857d"`);
    await queryRunner.query(`DROP INDEX "IDX_6641da8d831b93dfcb429f8b8b"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_watchlist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "title" varchar NOT NULL, "igdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "requestedById" integer, "mediaId" integer, CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("igdbId", "requestedById"), CONSTRAINT "FK_ae34e6b153a90672eb9dc4857d7" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_watchlist"("id", "mediaType", "title", "igdbId", "createdAt", "updatedAt", "requestedById", "mediaId") SELECT "id", "mediaType", "title", "igdbId", "createdAt", "updatedAt", "requestedById", "mediaId" FROM "watchlist"`
    );
    await queryRunner.query(`DROP TABLE "watchlist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_watchlist" RENAME TO "watchlist"`
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
    await queryRunner.query(`DROP INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d"`);
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "title" varchar, "igdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_2e0a6ec7f304c70d0a7ef5a55de" UNIQUE ("igdbId"), CONSTRAINT "REL_5c8af2d0e83b3be6d250eccc19" UNIQUE ("mediaId"), CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "igdbId", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "igdbId", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d" ON "blocklist" ("igdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(`DROP INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "title" varchar, "igdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_2e0a6ec7f304c70d0a7ef5a55de" UNIQUE ("igdbId"), CONSTRAINT "REL_5c8af2d0e83b3be6d250eccc19" UNIQUE ("mediaId"))`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "igdbId", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "igdbId", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d" ON "blocklist" ("igdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_6641da8d831b93dfcb429f8b8b"`);
    await queryRunner.query(`DROP INDEX "IDX_ae34e6b153a90672eb9dc4857d"`);
    await queryRunner.query(`DROP INDEX "IDX_1f5f16b7dc67bf1aba66dd25fb"`);
    await queryRunner.query(
      `ALTER TABLE "watchlist" RENAME TO "temporary_watchlist"`
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL DEFAULT ('game'), "title" varchar NOT NULL, "igdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "requestedById" integer, "mediaId" integer, CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("igdbId", "requestedById"))`
    );
    await queryRunner.query(
      `INSERT INTO "watchlist"("id", "mediaType", "title", "igdbId", "createdAt", "updatedAt", "requestedById", "mediaId") SELECT "id", "mediaType", "title", "igdbId", "createdAt", "updatedAt", "requestedById", "mediaId" FROM "temporary_watchlist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_watchlist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6641da8d831b93dfcb429f8b8b" ON "watchlist" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae34e6b153a90672eb9dc4857d" ON "watchlist" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1f5f16b7dc67bf1aba66dd25fb" ON "watchlist" ("igdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" RENAME TO "temporary_user_settings"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "locale" varchar NOT NULL DEFAULT (''), "preferredPlatforms" text, "pgpKey" varchar, "discordIds" text, "pushbulletAccessToken" varchar, "pushoverApplicationToken" varchar, "pushoverUserKey" varchar, "pushoverSound" varchar, "telegramChatId" varchar, "telegramMessageThreadId" varchar, "telegramSendSilently" boolean, "notificationTypes" text, "userId" integer, CONSTRAINT "REL_986a2b6d3c05eb4091bb8066f7" UNIQUE ("userId"))`
    );
    await queryRunner.query(
      `INSERT INTO "user_settings"("id", "locale", "preferredPlatforms", "pgpKey", "discordIds", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "pushoverSound", "telegramChatId", "telegramMessageThreadId", "telegramSendSilently", "notificationTypes", "userId") SELECT "id", "locale", "preferredPlatforms", "pgpKey", "discordIds", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "pushoverSound", "telegramChatId", "telegramMessageThreadId", "telegramSendSilently", "notificationTypes", "userId" FROM "temporary_user_settings"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_settings"`);
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), "userId" integer, CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"))`
    );
    await queryRunner.query(
      `INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userAgent", "createdAt", "userId") SELECT "id", "endpoint", "p256dh", "auth", "userAgent", "createdAt", "userId" FROM "temporary_user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_83ef6b154f70c504fe88554f9f"`);
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL DEFAULT ('game'), "platform" integer NOT NULL, "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "platform", "ignoreQuota", "mediaId", "requestedById", "modifiedById" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
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
    await queryRunner.query(`DROP INDEX "IDX_28c5d1d16da7908c97c9bc2f74"`);
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TABLE "discover_slider"`);
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(`DROP INDEX "IDX_2e0a6ec7f304c70d0a7ef5a55d"`);
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(`DROP INDEX "IDX_c730c2d67f271a372c39a07b7e"`);
    await queryRunner.query(`DROP INDEX "IDX_a7eff4163e457c8ff645a41368"`);
    await queryRunner.query(`DROP INDEX "IDX_d7ac78c69d2f3092b4440808a4"`);
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`DROP INDEX "IDX_6641da8d831b93dfcb429f8b8b"`);
    await queryRunner.query(`DROP INDEX "IDX_ae34e6b153a90672eb9dc4857d"`);
    await queryRunner.query(`DROP INDEX "IDX_1f5f16b7dc67bf1aba66dd25fb"`);
    await queryRunner.query(`DROP TABLE "watchlist"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(`DROP INDEX "IDX_83ef6b154f70c504fe88554f9f"`);
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(`DROP TABLE "media_request"`);
  }
}
