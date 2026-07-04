import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProviderConfigMap,
  AIProviderType,
} from 'src/common/utils/config-types';
import { ConnectionsService } from 'src/connections/connections.service';
import { ModelClient } from './clients/interface';
import { OpenAIClient } from './clients/openai.client';
import { AnthropicClient } from './clients/anthropic.client';
import { OllamaClient } from './clients/ollama.client';
import { XAIClient } from './clients/xai.client';
import { GoogleClient } from './clients/google.client';
import { GroqClient } from './clients/groq.client';

@Injectable()
export class AIService {
  private systemDefault: AIProviderConfigMap;

  constructor(
    private readonly config: ConfigService,
    private readonly connectionsService: ConnectionsService,
  ) {
    const apiKeys = {
      ANTHROPIC_API_KEY: this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
      OPENAI_API_KEY: this.config.get<string>('OPENAI_API_KEY') ?? '',
      GROQ_API_KEY: this.config.get<string>('GROQ_API_KEY') ?? '',
      GOOGLE_API_KEY: this.config.get<string>('GOOGLE_API_KEY') ?? '',
      XAI_API_KEY: this.config.get<string>('XAI_API_KEY') ?? '',
    };

    this.systemDefault = {
      anthropic: {
        apiKey: apiKeys.ANTHROPIC_API_KEY,
      },
      google: {
        apiKey: apiKeys.GOOGLE_API_KEY,
      },
      groq: {
        apiKey: apiKeys.GROQ_API_KEY,
      },
      ollama: {
        host: 'http://localhost:1431/v1',
      },
      openai: {
        apiKey: apiKeys.OPENAI_API_KEY,
      },
      xai: {
        apiKey: apiKeys.XAI_API_KEY,
      },
    };
  }

  async initialize(
    workspaceId: string,
    provider: AIProviderType,
  ): Promise<ModelClient> {
    try {
      switch (provider) {
        case 'openai': {
          let config = await this.connectionsService.resolve<'openai'>(
            workspaceId,
            provider,
          );

          if (config == null) {
            config = this.systemDefault.openai;
          }

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get OpenAI API in workplace config and system defaults.',
            );
          }

          return new OpenAIClient(config.apiKey);
        }

        case 'anthropic': {
          let config = await this.connectionsService.resolve<'anthropic'>(
            workspaceId,
            provider,
          );

          if (config == null) {
            config = this.systemDefault.anthropic;
          }

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get Anthropic API in workplace config and system defaults.',
            );
          }

          return new AnthropicClient(config.apiKey);
        }

        case 'groq': {
          let config = await this.connectionsService.resolve<'groq'>(
            workspaceId,
            provider,
          );

          if (config == null) {
            config = this.systemDefault.groq;
          }

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get Groq API in workplace config and system defaults.',
            );
          }

          return new GroqClient(config.apiKey);
        }
        case 'google': {
          let config = await this.connectionsService.resolve<'google'>(
            workspaceId,
            provider,
          );

          if (config == null) {
            config = this.systemDefault.google;
          }

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get Google Gemini API in workplace config and system defaults.',
            );
          }

          return new GoogleClient(config.apiKey);
        }
        case 'xai': {
          let config = await this.connectionsService.resolve<'xai'>(
            workspaceId,
            provider,
          );

          if (config == null) {
            config = this.systemDefault.xai;
          }

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get xAI API in workplace config and system defaults.',
            );
          }

          return new XAIClient(config.apiKey);
        }
        case 'ollama': {
          let config = await this.connectionsService.resolve<'ollama'>(
            workspaceId,
            provider,
          );

          if (config == null) {
            config = this.systemDefault.ollama;
          }

          if (config.host.length == 0) {
            throw new Error(
              'Unable to get Ollama host in workplace config and system defaults.',
            );
          }

          return new OllamaClient('ollama', config.host);
        }
        default: {
          throw new Error('Unsupported Provider');
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize ai service: ${error}`);
    }
  }

  initializeWithSys(provider: AIProviderType): ModelClient {
    try {
      switch (provider) {
        case 'openai': {
          const config = this.systemDefault.openai;
          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get OpenAI API in workplace config and system defaults.',
            );
          }

          return new OpenAIClient(config.apiKey);
        }

        case 'anthropic': {
          const config = this.systemDefault.anthropic;

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get Anthropic API in workplace config and system defaults.',
            );
          }

          return new AnthropicClient(config.apiKey);
        }

        case 'groq': {
          const config = this.systemDefault.groq;

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get Groq API in workplace config and system defaults.',
            );
          }

          return new GroqClient(config.apiKey);
        }
        case 'google': {
          const config = this.systemDefault.google;

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get Google Gemini API in workplace config and system defaults.',
            );
          }

          return new GoogleClient(config.apiKey);
        }
        case 'xai': {
          const config = this.systemDefault.xai;

          if (config.apiKey.length == 0) {
            throw new Error(
              'Unable to get xAI API in workplace config and system defaults.',
            );
          }

          return new XAIClient(config.apiKey);
        }
        case 'ollama': {
          const config = this.systemDefault.ollama;

          if (config.host.length == 0) {
            throw new Error(
              'Unable to get Ollama host in workplace config and system defaults.',
            );
          }

          return new OllamaClient('ollama', config.host);
        }
        default: {
          throw new Error('Unsupported Provider');
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize ai service: ${error}`);
    }
  }
}
