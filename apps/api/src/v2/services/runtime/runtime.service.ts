import { Injectable } from '@nestjs/common';

import { Runtime } from '@linea/runtime';
import { AIClient } from '@linea/ai';

@Injectable()
export class RuntimeService extends Runtime {
  constructor(ai: AIClient) {
    super(ai);
  }
}
