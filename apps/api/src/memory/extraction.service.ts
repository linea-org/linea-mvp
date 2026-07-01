import { Injectable, Logger } from '@nestjs/common';
import { AIService } from 'src/services/ai/ai.service';

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
- Given confidence 0.0-1.0
- Given eventDate (ISO 8601) if applicable, otherwise omit the field

Return ONLY a JSON array (no markdown, no explanation):
[{ "content": "...", "factType": "...", "confidence": 0.95, "eventDate": "2024-01-01" }]`;

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(private ai: AIService) {}

  async extract(content: string): Promise<ExtractedFact[]> {
    try {
      // default
      const client = await this.ai.initializeWithSys('google');
      const response = await client.chat('gemini-2.0-flash-lite', {
        maxTokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
        jsonMode: true,
      });

      const parsed = JSON.parse(response.text) as unknown;
      if (!Array.isArray(parsed))
        return [{ content, factType: 'fact', confidence: 1.0 }];

      return (parsed as ExtractedFact[]).filter(
        (f) => typeof f.content === 'string' && f.content.length > 0,
      );
    } catch (err) {
      this.logger.error('Extraction failed, storing as single fact', err);
      return [{ content, factType: 'fact', confidence: 1.0 }];
    }
  }
}
