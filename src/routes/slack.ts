import {Request, Response} from "express";
import chalk from "chalk";

import {SlackAuthResponse} from "../types.js";
import prisma from "../prisma.js";

export default async function slackHandler(req: Request, res: Response) {
  if (req.query.error) {
    console.log(
      chalk.red.bgWhiteBright(
        `error authing slack: ${JSON.stringify(req.query)}`,
      ),
    );
    res.send(`Error: ${req.query.error}`);
    return;
  }

  const f = await fetch(
    `https://slack.com/api/oauth.v2.access?code=${req.query.code}&client_id=${process.env.SLACK_CLIENT_ID}&client_secret=${process.env.SLACK_CLIENT_SECRET}`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  );

  const json = (await f.json()) as SlackAuthResponse;

  if (json.ok) {
    console.log(
      chalk.green.bgWhiteBright(`new slack id: ${json.authed_user.id}`),
    );
    if (
      !(await prisma.user.findUnique({
        where: {
          slackID: json.authed_user.id,
        },
      }))
    )
      await prisma.user.create({
        data: {
          slackID: json.authed_user.id,
          slackToken: json.authed_user.access_token,
          enabled: false,
        },
      });

    res.render("slack-success", {
      layout: false,
      spotifyClientID: process.env.SPOTIFY_CLIENT_1_ID, // change as needed
      host: process.env.HOST,
      userID: json.authed_user.id,
    });
    return;
  } else {
    if (json.error) {
      console.log(
        chalk.red.bgWhiteBright(`error fetching slack token: ${json.error}`),
      );
      res.send(`Error: ${json.error}`);
      return;
    }
  }
}
