import {
  BaseClient,
  BrowserStorage,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  type LogtoConfig,
} from "@logto/browser";

export class StarRailAuthStorage extends BrowserStorage {
  override getKey(item?: string): string {
    return `ggstarrail:auth:${this.appId}${item ? `:${item}` : ""}`;
  }
}

export class StarRailAuthClient extends BaseClient {
  constructor(config: LogtoConfig) {
    super(config, {
      navigate: (url) => window.location.assign(url),
      storage: new StarRailAuthStorage(config.appId),
      generateCodeChallenge,
      generateCodeVerifier,
      generateState,
    });
  }
}
