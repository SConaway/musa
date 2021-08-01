interface SlackAuthFailed {
  ok: false;
  error: string;
}
interface SlackAuthSuccess {
  ok: true;
  app_id: String;
  authed_user: {
    id: string;
    access_token: string;
  };
}

export type SlackAuthResponse = SlackAuthFailed | SlackAuthSuccess;

interface SlackProfileSetFailed {
  ok: false;
  error: string;
}
interface SlackProfileSetSuccess {
  ok: true;
}
export type SlackProfileSetResponse =
  | SlackProfileSetFailed
  | SlackProfileSetSuccess;

interface SpotifyAuthResponseFailure {
  error: string;
  error_description: string;
}
interface SpotifyAuthResponseSuccess {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}
export type SpotifyAuthResponse =
  | SpotifyAuthResponseFailure
  | SpotifyAuthResponseSuccess;

interface SpotifyPlayerResponseFailure {
  error: {
    status: number;
    message: string;
  };
}
interface SpotifyPlayerResponseTrack {
  item: {
    artists: [
      {
        name: string;
      },
    ];
    name: string;
  };
  currently_playing_type: "track";
  is_playing: boolean;
}
interface SpotifyPlayerResponseEpisode {
  item: {
    name: string;
    show: {
      name: string;
    };
  };
  currently_playing_type: "episode";
  is_playing: boolean;
}

interface SpotifyPlayerResponseAd {
  currently_playing_type: "ad";
  is_playing: boolean;
}

interface SpotifyPlayerResponseUnknown {
  currently_playing_type: "unknown";
  is_playing: boolean;
}

export type SpotifyPlayerResponse =
  | SpotifyPlayerResponseFailure
  | SpotifyPlayerResponseTrack
  | SpotifyPlayerResponseAd
  | SpotifyPlayerResponseUnknown
  | SpotifyPlayerResponseEpisode;
