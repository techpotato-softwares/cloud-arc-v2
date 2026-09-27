import { injectable } from "inversify";
import { getProvider } from "../providers";

export interface IAiService {
  chat(message: string): Record<string, unknown>;
}

@injectable()
export class AiService implements IAiService {
  chat(message: string): Record<string, unknown> {
    const result = getProvider().chat(message || "");
    return {
      ...result,
      hint: "Set AI_PROVIDER=openai|bedrock and provider credentials for live calls.",
    };
  }
}
