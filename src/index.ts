import dotenv from "dotenv";
dotenv.config();

const environmentVariables = [
  "DATABASE_URL",
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
];
for (const env of environmentVariables) {
  if (!process.env[env]) {
    console.error(`Please define ${env}`);
    process.exit(1);
  }
}

// import {Prisma, PrismaClient} from "@prisma/client";
import express from "express";
import handlebars from "express-handlebars";
import fetch from "node-fetch";
import FormData from "form-data";

import prisma from "./prisma";
import {
  SlackAuthResponse,
  SlackProfileSetResponse,
  SpotifyAuthResponse,
} from "./types";

// import {ToadScheduler, SimpleIntervalJob, AsyncTask} from 'toad-scheduler';

// const prisma = new PrismaClient({log: ["query", "info", `warn`, `error`]});

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "handlebars");
app.engine(
  "handlebars",
  handlebars({
    layoutsDir: __dirname + "/views",
  }),
);

app.get("/", (_req, res) =>
  res.render("main", {
    layout: false,
    slackClientID: process.env.SLACK_CLIENT_ID,
    host: process.env.HOST ?? "http://localhost:3000",
  }),
);

app.get("/slack", async (req, res) => {
  if (req.query.error) {
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
        },
      });

    res.render("slack-success", {
      layout: false,
      spotifyClientID: process.env.SPOTIFY_CLIENT_ID,
      host: process.env.HOST ?? "http://localhost:3000",
      userID: json.authed_user.id,
    });
    return;
  } else {
    if (json.error) {
      res.send(`Error: ${json.error}`);
      return;
    }
  }
});

app.get("/spotify", async (req, res) => {
  console.log(req.query);

  if (req.query.error) {
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
    res.send("SlackID missing. Please try again.");
    return;
  }

  if (req.query.code) {
    const f = await fetch(
      `https://accounts.spotify.com/api/token?code=${
        req.query.code
      }&grant_type=authorization_code&client_id=${
        process.env.SPOTIFY_CLIENT_ID
      }&client_secret=${process.env.SPOTIFY_CLIENT_SECRET}&redirect_uri=${
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
          new Date().getTime() + (json.expires_in - 10),
        ),
      },
    });

    res.send("done!");
  }
});

app.listen(3000, () =>
  console.log(`
🚀 Server ready at: ${process.env.HOST ?? "http://localhost:3000"}`),
);

// const scheduler = new ToadScheduler();
// const task = new AsyncTask(
//     'simple task',
//     async () => {
//         return console.log('hey');
//     },
//     (err: Error) => {
//         /* handle error here */
//     },
// );
// const job = new SimpleIntervalJob({seconds: 2}, task);
// scheduler.addSimpleIntervalJob(job);
// when stopping your app
// scheduler.stop();

// const f = await fetch(`https://slack.com/api/users.profile.set`, {
//   headers: {
//     "Content-Type": "application/json; charset=utf-8",
//     Authorization: `Bearer ${user.slackToken}`,
//   },
//   method: "POST",
//   body: JSON.stringify({
//     profile: {
//       status_text: "making some bots...",
//       // status_emoji: ":mountain_railway:",
//       status_expiration: 0,
//     },
//   }),
// });
// const json = (await f.json()) as SlackProfileSetResponse;
