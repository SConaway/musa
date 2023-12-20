import chalk from "chalk";

import dotenv from "dotenv";
dotenv.config();

const environmentVariables = [
  "DATABASE_URL",
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SPOTIFY_CLIENTS",
  "ADMIN_USER_ID",
  "HOST",
];
for (const env of environmentVariables) {
  if (!process.env[env]) {
    console.error(chalk.red(`Please define ${env}`));
    process.exit(1);
  }
}
// parse num clients and make sure they each have `SPOTIFY_CLIENT_x_{ID,SECRET}`
const numClients = parseInt(process.env.SPOTIFY_CLIENTS as string, 10);
let spotifyClients: {id: String; secret: String}[] = [];
if (isNaN(numClients)) {
  console.error(chalk.red(`SPOTIFY_CLIENTS must be a number`));
  process.exit(1);
}
for (let i = 0; i < numClients; i++) {
  if (
    !process.env[`SPOTIFY_CLIENT_${i}_ID`] ||
    !process.env[`SPOTIFY_CLIENT_${i}_SECRET`]
  ) {
    console.error(
      chalk.red(
        `Please define SPOTIFY_CLIENT_${i}_ID and SPOTIFY_CLIENT_${i}_SECRET`,
      ),
    );
    process.exit(1);
  } else {
    spotifyClients.push({
      id: process.env[`SPOTIFY_CLIENT_${i}_ID`] as string,
      secret: process.env[`SPOTIFY_CLIENT_${i}_SECRET`] as string,
    });
  }
}
// console.log(spotifyClients);
// console.log(spotifyClients[0]);

import express from "express";
import {engine as handlebars} from "express-handlebars";
import bodyparser from "body-parser";
import fetch from "node-fetch";
import {ToadScheduler, SimpleIntervalJob, AsyncTask} from "toad-scheduler";

import updateStatuses from "./updateStatuses.js";

import slackHandler from "./routes/slack.js";
import spotifyHandler from "./routes/spotify.js";
import musaToggleHandler from "./routes/musaToggle.js";
import musaStatusHandler from "./routes/musaStatus.js";
import musaListUsersHandler from "./routes/musaListUsers.js";

// const prisma = new PrismaClient({log: ["query", "info", `warn`, `error`]});

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.use(bodyparser.urlencoded({extended: true}));

app.set("view engine", "html");
app.engine(
  "html",
  handlebars({
    // layoutsDir: __dirname + "/../views",
    layoutsDir: import.meta.url.replace("file://", "") + "/../views",
    extname: ".html",
  }),
);

app.get("/", (_req, res) =>
  res.render("main", {
    layout: false,
    slackClientID: process.env.SLACK_CLIENT_ID,
    host: process.env.HOST ?? "http://localhost:3000",
  }),
);

app.get("/slack", slackHandler);

app.get("/spotify", spotifyHandler);

app.post("/musa-toggle", musaToggleHandler);

app.post("/musa-status", musaStatusHandler);

app.post("/musa-list-users", musaListUsersHandler);

app.listen(3000, () =>
  console.log(
    chalk.green(
      `🚀 Server ready at: ${process.env.HOST ?? "http://localhost:3000"}`,
    ),
  ),
);

updateStatuses(spotifyClients);

const scheduler = new ToadScheduler();
const task = new AsyncTask(
  "update statuses",
  () => updateStatuses(spotifyClients),
  (err: Error) => {
    console.error(`Error in task: ${err}`);
  },
);
const job = new SimpleIntervalJob({seconds: 30}, task);
scheduler.addSimpleIntervalJob(job);
// when stopping your app
// scheduler.stop();
