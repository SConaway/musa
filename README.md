# Musa

## Instructions

1. Create an app on Slack's [App Directory](https://api.slack.com/apps), set the App Manifest to the following:

```json
{
  "display_information": {
    "name": "Musa"
  },
  "features": {
    "bot_user": {
      "display_name": "Musa",
      "always_online": true
    },
    "slash_commands": [
      {
        "command": "/musa-toggle",
        "url": "https://<your domain>/musa-toggle",
        "description": "Toggles Musa for your user",
        "should_escape": true
      },
      {
        "command": "/musa-status",
        "url": "https://<your domain>/musa-status",
        "description": "Gets the status of Musa for your user",
        "should_escape": true
      },
      {
        "command": "/musa-list-users",
        "url": "https://<your domain>/musa-list-users",
        "description": "Gets Musa users",
        "should_escape": true
      }
    ]
  },
  "oauth_config": {
    "redirect_urls": ["https://<your domain>/slack"],
    "scopes": {
      "user": ["users.profile:write"],
      "bot": ["commands"]
    }
  },
  "settings": {
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
```

Here's my [portal page](https://app.slack.com/app-settings/T0266FRGM/A029BHJDY1L/app-manifest).

1. Create an app on Spotify's [Developer Dashboard](https://developer.spotify.com/dashboard/applications), set the Redirect URI to `https://<your domain>/spotify`. Add yourself to the Users allowlist.

   Again, here's [mine](https://developer.spotify.com/dashboard/applications/d0cd7594dd0c4d228b83b0807f23c271/users).

2. Create a `.env` file or populate the `docker-compose.yml` file with the following:

```bash
DATABASE_URL=""
SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""
SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""
ADMIN_USER_ID=""
```

4. Deploy the app using your favorite method. I'm using Docker Compose.

```bash
cd <project root>
docker-compose up -d
```

5. Go to `https://<your domain>/` and get started!
