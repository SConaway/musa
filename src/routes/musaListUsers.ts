import {Request, Response} from "express";
import chalk from "chalk";

import prisma from "../prisma.js";

export default async function musaListUsersHandler(
  req: Request,
  res: Response,
) {
  if (req.body.user_id !== process.env.ADMIN_USER_ID) {
    res.setHeader("Content-type", "application/json");
    res.status(200).send({
      text: "You cannot list Musa users.",
      response_type: "ephemeral",
    });
    return;
  }

  let text = "Musa users are: \n";
  text +=
    "index, @slackName (slackID), enabled, spotifyTokenExpiration, spotify client \n";

  const users = await prisma.user.findMany();

  users.forEach(
    (user, index) =>
      (text = text.concat(
        `${index + 1}. <@${user.slackID}> (\`${user.slackID}\`), ${
          user.enabled
        }, ${user.spotifyTokenExpiration}, ${user.spotifyClient} \n`,
      )),
  );
  text = text.trim();

  console.log(chalk.gray(`Users: ${text}`));

  res.setHeader("Content-type", "application/json");
  res.status(200).send({text, response_type: "ephemeral"});
}
