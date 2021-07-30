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
