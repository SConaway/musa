import chalk from "chalk";

import {
  SpotifyAuthResponse,
  SpotifyPlayerResponse,
  SlackProfileSetResponse,
} from "./types.js";
import prisma from "./prisma.js";

export default async function updateStatuses(
  spotifyClients: {id: String; secret: String}[],
) {
  console.log(chalk.green("---"));
  console.log(chalk.green(new Date()));

  const users = await prisma.user.findMany();

  for await (let user of users) {
    const client = spotifyClients[user.spotifyClient];
    // console.log(client);
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
          `https://accounts.spotify.com/api/token?grant_type=refresh_token&refresh_token=${user.spotifyRefresh}&client_id=${client.id}&client_secret=${client.secret}`,
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
          continue;
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

      if (!user.enabled) {
        console.log(chalk.gray(`${user.slackID}: disabled`));
        continue;
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
        console.log(
          chalk.gray(
            `${user.slackID} (CID=${user.spotifyClient}): no music, skipping update`,
          ),
        );
        continue;
      } else if (text.startsWith("U")) {
        console.log(
          chalk.gray(
            `${user.slackID} (CID=${user.spotifyClient}): user is not allow-listed, skipping update`,
          ),
        );
        continue;
      } else if (!text.startsWith("{")) {
        console.log(chalk.yellow(text));
        console.log(
          chalk.gray(
            `${user.slackID} (CID=${user.spotifyClient}): other error, skipping update, status=${f.status}, text=${text}`,
          ),
        );
        continue;
      }

      const profileJSON = JSON.parse(text) as SpotifyPlayerResponse;

      if ("error" in profileJSON) {
        console.warn(
          chalk.red(
            `Error fetching ${user.slackID}'s player:  CID=${user.spotifyClient} status=${profileJSON.error.status} description=${profileJSON.error.message}`,
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
          profileJSON.item.artists.forEach((artist, index) => {
            statusString += artist.name;
            if (
              index !== profileJSON.item.artists.length - 1 &&
              profileJSON.item.artists.length > 1
            )
              statusString += ", ";
          });
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
              `${user.slackID} (CID=${user.spotifyClient}): unknown type playing`,
              chalk.bgWhiteBright(JSON.stringify(profileJSON)),
            ),
          );
        }
        if (statusString.length >= 100)
          statusString = statusString.substr(0, 97) + "...";
        console.log(
          chalk.gray(
            `${user.slackID} (CID=${user.spotifyClient}): playing: ${statusString}`,
          ),
        );

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
}
