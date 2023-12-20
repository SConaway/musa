import {Request, Response} from "express";
import chalk from "chalk";

import {SpotifyAuthResponse} from "../types.js";
import prisma from "../prisma.js";

export default async function spotifyHandler(req: Request, res: Response) {
  if (req.query.error) {
    console.log(chalk.red.bgWhiteBright(`error authing spotify: ${req.query}`));
    res.send(`Error: ${req.query.error}`);
    return;
  }

  if (
    !req.query.state ||
    !(await prisma.user.findUnique({
      where: {
        slackID: req.query.state as string,
      },
    }))
  ) {
    console.log(
      chalk.red.bgWhiteBright(
        `error authing spotify: missing SlackID=${req.query.state}`,
      ),
    );
    res.send("SlackID missing. Please try again.");
    return;
  }

  if (req.query.code) {
    // change as needed
    const f = await fetch(
      `https://accounts.spotify.com/api/token?code=${
        req.query.code
      }&grant_type=authorization_code&client_id=${
        process.env.SPOTIFY_CLIENT_1_ID
      }&client_secret=${process.env.SPOTIFY_CLIENT_1_SECRET}&redirect_uri=${
        process.env.HOST ?? "http://localhost:3000"
      }/spotify`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    const json = (await f.json()) as SpotifyAuthResponse;

    if ("error" in json) {
      console.log(
        chalk.red.bgWhiteBright(`error fetching spotify token: ${json}`),
      );
      res.send(`Error: ${json.error} description=${json.error_description}`);
      return;
    }

    await prisma.user.update({
      where: {
        slackID: req.query.state as string,
      },
      data: {
        spotifyRefresh: json.refresh_token,
        spotifyToken: json.access_token,
        spotifyTokenExpiration: new Date(
          new Date().getTime() + (json.expires_in - 10) * 1000,
        ),
        enabled: true,
      },
    });

    res.render("done", {
      layout: false,
      // spotifyClientID: process.env.SPOTIFY_CLIENT_ID,
      // host: process.env.HOST ?? "http://localhost:3000",
      // userID: json.authed_user.id,
    });
  }
}
