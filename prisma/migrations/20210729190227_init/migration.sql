-- CreateTable
CREATE TABLE "User" (
    "slackID" TEXT NOT NULL,
    "slackToken" TEXT NOT NULL,
    "spotifyRefresh" TEXT,
    "spotifyToken" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User.slackID_unique" ON "User"("slackID");
