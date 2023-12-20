import {Request, Response} from "express";
import chalk from "chalk";

import prisma from "../prisma.js";

export default async function musaStatusHandler(req: Request, res: Response) {
  let text = "";

  let userID = req.body.user_id as string;
  let type: "requester" | "specified" = "requester";

  if ((req.body.text as string).length > 1) {
    if (req.body.user_id !== process.env.ADMIN_USER_ID) {
      res.setHeader("Content-type", "application/json");
      res.status(200).send({
        text: "You cannot check Musa status for other users.",
        response_type: "ephemeral",
      });
      return;
    }
    const inputID = (
      (req.body.text as string).slice(2).split(">")[0] as string
    ).split("|")[0] as string;

    userID = inputID;
    type = "specified";
  }

  let user = await prisma.user.findUnique({
    where: {
      slackID: userID,
    },
  });

  if (!user || !user.slackToken) {
    if (type === "requester")
      text = `You, <@${userID}> (\`${userID}\`), have not signed up for Musa. Check out <#C02A1GTH9TK> to join!`;
    else text = `<@${userID}> (\`${userID}\`) has not signed up for Musa.`;
  } else if (
    !user.spotifyRefresh ||
    !user.spotifyToken ||
    !user.spotifyTokenExpiration
  ) {
    text = `Spotify authentication incomplete. Head to ${process.env.HOST} to continue.`;
  } else if (new Date() > user.spotifyTokenExpiration) {
    text = `Spotify authentication expired. Head to ${process.env.HOST} to fix.`;
  } else if (!user.enabled) {
    text = "Musa disabled. Run `/musa-toggle` to re-enable.";
  } else {
    text = "All good!";
  }

  console.log(chalk.gray(`status requested for ${userID}: ${text}`));

  res.setHeader("Content-type", "application/json");
  res.status(200).send({text, response_type: "ephemeral"});
}
