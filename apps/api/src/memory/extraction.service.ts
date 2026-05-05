import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ExtractedFact {
  content: string;
  factType: 'fact' | 'preference' | 'event' | 'profile' | 'system';
  confidence: number;
  eventDate?: string;
}

const SYSTEM_PROMPT = `Extract atomic facts from the text. Each fact must be:
- A single self-contained statement
- Pronouns resolved using context
- Classified: fact | preference | event | profile | system
- Given confidence 0.0–1.0
- Given eventDate (ISO 8601) if applicable, otherwise omit the field

Return ONLY a JSON array (no markdown, no explanation):
[{ "content": "...", "factType": "...", "confidence": 0.95, "eventDate": "2024-01-01" }]`;

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — extraction will return content as single fact');
    }
  }

  async extract(content: string): Promise<ExtractedFact[]> {
    if (!this.apiKey) {
      return [{ content, factType: 'fact', confidence: 1.0 }];
    }

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: this.apiKey });

      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      });

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return [{ content, factType: 'fact', confidence: 1.0 }];

      return (parsed as ExtractedFact[]).filter(
        (f) => typeof f.content === 'string' && f.content.length > 0,
      );
    } catch (err) {
      this.logger.error('Extraction failed, storing as single fact', err);
      return [{ content, factType: 'fact', confidence: 1.0 }];
    }
  }
}
