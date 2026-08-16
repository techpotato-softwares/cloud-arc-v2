export class AIProvider {
  chat(_message: string): { provider: string; reply: string; model?: string } {
    throw new Error('not implemented');
  }
}

export class StubProvider extends AIProvider {
  chat(message: string) {
    return { provider: 'stub', reply: `Echo: ${message}` };
  }
}

export class OpenAIProvider extends AIProvider {
  chat(message: string) {
    if (!process.env.OPENAI_API_KEY) return new StubProvider().chat(message);
    return {
      provider: 'openai',
      reply: `[openai-stub] ${message}`,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
}

export class BedrockProvider extends AIProvider {
  chat(message: string) {
    if (!process.env.AWS_REGION) return new StubProvider().chat(message);
    return {
      provider: 'bedrock',
      reply: `[bedrock-stub] ${message}`,
      model: process.env.BEDROCK_MODEL || 'anthropic.claude-3-haiku',
    };
  }
}

export function getProvider(): AIProvider {
  const name = (process.env.AI_PROVIDER || 'stub').toLowerCase();
  if (name === 'openai') return new OpenAIProvider();
  if (name === 'bedrock') return new BedrockProvider();
  return new StubProvider();
}
