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
          new Date().getTime() + (json.expires_in - 10) * 1000,
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

const updateStatuses = async () => {
  const users = await prisma.user.findMany();

  for await (let user of users) {
    // console.log(user);

    if (
      user.spotifyTokenExpiration &&
      user.spotifyRefresh &&
      new Date() > user.spotifyTokenExpiration
    ) {
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

      // console.log(json);

      if ("error" in json) {
        console.warn(
          `Error renewing ${user.slackID}'s token: ${json.error} description=${json.error_description}`,
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

    // curl -X "GET"
    // ""
    // H "Accept: application/json"
    // H  "Content-Type: "
    // H  "Authorization: Bearer BQAcsj5dziMJ8Qsb2sKm-Tsqw4AXQgEJKzxNv8bPXtVUCrqvS6LWet_fi1DBq4sBZu9BO3u6T2C7-qDPLSHVgkh5s9AZykfI3_JF38lbg4s-0sfGZ_93Z1p_p0BbxIbe7PSOgklpEXl_sqNC0gJuFd4I"
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

    const profileJSON = (await f.json()) as SpotifyPlayerResponse;
    // console.log(JSON.stringify(profileJSON));

    if ("error" in profileJSON) {
      console.warn(
        `Error fetching ${user.slackID}'s player: status=${profileJSON.error.status} description=${profileJSON.error.message}`,
      );
      return;
    }

    if (profileJSON.is_playing) {
      let statusString = "";
      let statusEmoji = "";

      if (profileJSON.currently_playing_type === "track") {
        statusString = `${profileJSON.item.name} • `;
        for (let i = 0; i < profileJSON.item.artists.length; i++) {
          const artist = profileJSON.item.artists[i];
          statusString += artist.name;
          if (i === profileJSON.item.artists.length - 1 && i > 0)
            statusString += ", ";
        }
        statusEmoji = ":musical_note:";
      } else if (profileJSON.currently_playing_type === "episode") {
        statusString = `${profileJSON.item.name} • ${profileJSON.item.show.name}`;
        statusEmoji = ":microphone:";
      }
      console.log(statusString);
      console.log(statusEmoji);
      console.log(new Date());

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
      // console.log(slackJSON);

      if (!slackJSON.ok) {
        console.warn(
          `Error setting ${user.slackID}'s status: ${slackJSON.error}`,
        );
        return;
      }
    }
  }
};
// updateStatuses();

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
