import dotenv from "dotenv";
dotenv.config();

// import {Prisma, PrismaClient} from "@prisma/client";
import express from "express";
import handlebars from "express-handlebars";
import fetch from "node-fetch";
import FormData from "form-data";

import prisma from "./prisma";
import {SlackAuthResponse, SlackProfileSetResponse} from "./types";

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
      slackClientID: process.env.SLACK_CLIENT_ID,
      host: process.env.HOST ?? "http://localhost:3000",
    });
    return;
  } else {
    if (json.error) {
      res.send(`Error: ${json.error}`);
      return;
    }
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
