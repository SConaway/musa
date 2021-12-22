import chalk from "chalk";

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
    console.error(chalk.red(`Please define ${env}`));
    process.exit(1);
  }
}

import express from "express";
import handlebars from "express-handlebars";
import {urlencoded} from "body-parser";
import fetch from "node-fetch";
import {ToadScheduler, SimpleIntervalJob, AsyncTask} from "toad-scheduler";

import prisma from "./prisma";
import {
  SlackAuthResponse,
  SlackProfileSetResponse,
  SpotifyAuthResponse,
  SpotifyPlayerResponse,
} from "./types";

// const prisma = new PrismaClient({log: ["query", "info", `warn`, `error`]});

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.use(urlencoded({extended: true}));

app.set("view engine", "html");
app.engine(
  "html",
  handlebars({
    layoutsDir: __dirname + "/views",
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

app.get("/slack", async (req, res) => {
  if (req.query.error) {
    console.log(chalk.red.bgWhiteBright(`error authing slack: ${req.query}`));
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
          enabled: false,
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
      console.log(
        chalk.red.bgWhiteBright(`error fetching slack token: ${json.error}`),
      );
      res.send(`Error: ${json.error}`);
      return;
    }
  }
});

app.get("/spotify", async (req, res) => {
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

    res.send("done!");
  }
});

app.post("/musa-toggle", async (req, res) => {
  let text = "";

  let user = await prisma.user.findUnique({
    where: {
      slackID: req.body.user_id as string,
    },
  });

  if (!user) {
    console.log(
      chalk.red.bgWhiteBright(
        `error toggling: missing SlackID=${req.body.user_id}`,
      ),
    );
    text = `You, ${req.body.user_id}, have not signed up for Musa. Check out <#C02A1GTH9TK> to join!`;
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
  }

  res.setHeader("Content-type", "application/json");
  res.status(200).send({text, response_type: "ephemeral"});
});

app.listen(3000, () =>
  console.log(
    chalk.green(
      `🚀 Server ready at: ${process.env.HOST ?? "http://localhost:3000"}`,
    ),
  ),
);

const updateStatuses = async () => {
  console.log(chalk.green("---"));
  console.log(chalk.green(new Date()));

  const users = await prisma.user.findMany();

  for await (let user of users) {
    if (!user.enabled) {
      console.log(chalk.gray(`${user.slackID}: disabled`));
      continue;
    }
    try {
      if (
        !user.spotifyTokenExpiration ||
        !user.spotifyRefresh ||
        !user.spotifyToken
      ) {
        console.log(
          chalk.gray(
            `${user.slackID}: user does not have a spotify token, skipping update`,
          ),
        );
        continue;
      }
      if (new Date() > user.spotifyTokenExpiration) {
        const f = await fetch(
          `https://accounts.spotify.com/api/token?grant_type=refresh_token&refresh_token=${user.spotifyRefresh}&client_id=${process.env.SPOTIFY_CLIENT_ID}&client_secret=${process.env.SPOTIFY_CLIENT_SECRET}`,
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
            chalk.red.bgWhiteBright(
              `Error renewing ${user.slackID}'s token: ${json.error} description=${json.error_description}`,
            ),
          );
          return;
        }

        user = await prisma.user.update({
          where: {
            slackID: user.slackID,
          },
          data: {
            spotifyToken: json.access_token,
            spotifyTokenExpiration: new Date(
              new Date().getTime() + (json.expires_in - 10) * 1000,
            ),
          },
        });
      }

      const f = await fetch(
        `https://api.spotify.com/v1/me/player?additional_types=track,episode`,
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json; charset=utf-8",
            Authorization: `Bearer ${user.spotifyToken}`,
          },
          method: "GET",
        },
      );
      const text = await f.text();

      if (!text.length) {
        console.log(chalk.gray(`${user.slackID}: no music, skipping update`));
        continue;
      } else if (text.startsWith("U")) {
        console.log(
          chalk.gray(
            `${user.slackID}: user is not allow-listed, skipping update`,
          ),
        );
        continue;
      } else if (!text.startsWith("{")) {
        console.log(chalk.yellow(text));
        console.log(
          chalk.gray(
            `${user.slackID}: other error, skipping update, status=${f.status}, text=${text}`,
          ),
        );
        continue;
      }

      const profileJSON = JSON.parse(text) as SpotifyPlayerResponse;

      if ("error" in profileJSON) {
        console.warn(
          chalk.red(
            `Error fetching ${user.slackID}'s player: status=${profileJSON.error.status} description=${profileJSON.error.message}`,
          ),
        );
        continue;
      }

      if (profileJSON.is_playing) {
        let statusString = "";
        let statusEmoji = "";

        if (profileJSON.currently_playing_type === "track") {
          statusString = profileJSON.item.name;
          statusString += " • ";
          for (let i = 0; i < profileJSON.item.artists.length; i++) {
            const artist = profileJSON.item.artists[i];
            statusString += artist.name;
            if (
              i !== profileJSON.item.artists.length - 1 &&
              profileJSON.item.artists.length > 1
            )
              statusString += ", ";
          }
          statusEmoji = ":new_spotify:";
        } else if (profileJSON.currently_playing_type === "episode") {
          statusString = `${profileJSON.item.name} • ${profileJSON.item.show.name}`;
          statusEmoji = ":microphone:";
        } else if (profileJSON.currently_playing_type === "ad") {
          console.log(chalk.gray(`${user.slackID}: listening to type=ad`));
        } else if (profileJSON.currently_playing_type === "unknown") {
          console.log(chalk.gray(`${user.slackID}: listening to type=unknown`));
        } else {
          console.log(
            chalk.yellow(
              `${user.slackID}: unknown type playing`,
              chalk.bgWhiteBright(JSON.stringify(profileJSON)),
            ),
          );
        }
        if (statusString.length >= 100)
          statusString = statusString.substr(0, 97) + "...";
        console.log(chalk.gray(`${user.slackID}: playing: ${statusString}`));

        const f = await fetch(`https://slack.com/api/users.profile.set`, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${user.slackToken}`,
          },
          method: "POST",
          body: JSON.stringify({
            profile: {
              status_text: statusString,
              status_emoji: statusEmoji,
              status_expiration: 90,
            },
          }),
        });

        const slackJSON = (await f.json()) as SlackProfileSetResponse;

        if (!slackJSON.ok) {
          console.warn(
            chalk.red.bgWhiteBright(
              `Error setting ${user.slackID}'s status: ${slackJSON.error}`,
            ),
          );
          continue;
        }
      } else {
        console.log(
          chalk.gray(`${user.slackID}: not playing, skipping update`),
        );
      }
    } catch (error) {
      console.error(
        chalk.red.bgWhite(
          `error: other error, user=${user.slackID}, error=${JSON.stringify(
            error,
          )}`,
        ),
      );
    }
  }
};
updateStatuses();

const scheduler = new ToadScheduler();
const task = new AsyncTask("update statuses", updateStatuses, (err: Error) => {
  console.error(`Error in task: ${err}`);
});
const job = new SimpleIntervalJob({seconds: 30}, task);
scheduler.addSimpleIntervalJob(job);
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
