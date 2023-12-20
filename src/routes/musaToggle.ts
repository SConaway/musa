import {Request, Response} from "express";
import chalk from "chalk";

import prisma from "../prisma.js";

export default async function musaToggleHandler(req: Request, res: Response) {
  let text = "";

  let userID = req.body.user_id as string;
  let type: "requester" | "specified" = "requester";

  if ((req.body.text as string).length > 1) {
    if (req.body.user_id !== process.env.ADMIN_USER_ID) {
      res.setHeader("Content-type", "application/json");
      res.status(200).send({
        text: "You cannot change Musa status for other users.",
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

  if (!user) {
    console.log(
      chalk.red.bgWhiteBright(
        `error toggling: missing SlackID=${req.body.user_id}`,
      ),
    );
    if (type === "specified")
      text = `<@${userID}> (\`${userID}\`) does not exist in Musa.`;
    else
      text = `You, <@${userID}> (\`${userID}\`), have not signed up for Musa. Check out <#C02A1GTH9TK> to join!`;
  } else {
    console.log(chalk.green(`${user.slackID}: toggling`));
    user = await prisma.user.update({
      where: {
        slackID: user.slackID,
      },
      data: {
        enabled: !user.enabled,
      },
    });
    text = `${
      user.enabled ? "Enabled" : "Disabled"
    }! Re-run this command to toggle. `;
    console.log(
      chalk.gray(
        `toggle requested for ${req.body.user_id as string}, enabled=${
          user.enabled
        }`,
      ),
    );
  }

  res.setHeader("Content-type", "application/json");
  res.status(200).send({text, response_type: "ephemeral"});
}
