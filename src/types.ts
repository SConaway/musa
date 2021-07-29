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
