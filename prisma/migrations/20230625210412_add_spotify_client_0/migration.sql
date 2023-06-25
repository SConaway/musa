-- AlterTable
ALTER TABLE "User" ADD COLUMN     "spotifyClient" INTEGER NOT NULL DEFAULT 0;

-- RenameIndex
ALTER INDEX "User.slackID_unique" RENAME TO "User_slackID_key";
