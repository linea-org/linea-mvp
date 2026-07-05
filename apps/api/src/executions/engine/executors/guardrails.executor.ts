import type { WorkflowState } from '../variable-substitution.js';

export interface GuardrailsNodeData {
  guardrailType?: string; // 'pii' | 'moderation' | 'jailbreak' | 'all'
  piiEnabled?: boolean;
  moderationEnabled?: boolean;
  jailbreakEnabled?: boolean;
  actionOnViolation?: 'block' | 'redact' | 'warn'; // default: 'block'
  inputField?: string; // variable name to check, default: lastOutput
}

// All patterns are defined as source strings and compiled fresh each call
// to avoid the stateful lastIndex problem with global-flag RegExp singletons.
const PII_PATTERN_SOURCES: Array<{
  name: string;
  source: string;
  flags: string;
}> = [
  {
    name: 'email',
    source: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    flags: 'g',
  },
  {
    name: 'phone_us',
    source: '(\\+1[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}',
    flags: 'g',
  },
  { name: 'ssn', source: '\\b\\d{3}-\\d{2}-\\d{4}\\b', flags: 'g' },
  {
    name: 'credit_card',
    source: '\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b',
    flags: 'g',
  },
  {
    name: 'ip_address',
    source: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
    flags: 'g',
  },
];

const JAILBREAK_PHRASES = [
  'ignore previous instructions',
  'disregard your instructions',
  'forget all previous',
  'new persona',
  'jailbreak',
  'dan mode',
];

const MODERATION_SOURCE = '\\b(hate|kill|murder|rape|bomb|terrorist)\\b';

export interface GuardrailResult {
  passed: boolean;
  violations: Array<{ type: string; detail: string }>;
  redactedText?: string;
  originalText?: string;
}

export function executeGuardrailsNode(
  nodeData: GuardrailsNodeData,
  state: WorkflowState,
): GuardrailResult {
  // Support both the panel's field names (checks[], action, inputKey) and the
  // executor's original field names (piiEnabled, actionOnViolation, inputField).
  const checksArray: string[] = Array.isArray((nodeData as any).checks)
    ? (nodeData as any).checks
    : [];
  const action: string =
    nodeData.actionOnViolation ?? (nodeData as any).action ?? 'block';

  // Map panel inputKey values to actual variable names
  const rawInputKey: string =
    nodeData.inputField ?? (nodeData as any).inputKey ?? 'lastOutput';
  const inputField =
    rawInputKey === 'last_message' || rawInputKey === 'output'
      ? 'lastOutput'
      : rawInputKey === 'input'
        ? 'input'
        : rawInputKey;

  const raw =
    state.variables[inputField] ?? state.variables['lastOutput'] ?? '';
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);

  const enablePii =
    nodeData.piiEnabled ??
    checksArray.includes('pii') ??
    (nodeData.guardrailType === 'pii' || nodeData.guardrailType === 'all');
  const enableMod =
    nodeData.moderationEnabled ??
    checksArray.includes('moderation') ??
    (nodeData.guardrailType === 'moderation' ||
      nodeData.guardrailType === 'all');
  const enableJail =
    nodeData.jailbreakEnabled ??
    checksArray.includes('jailbreak') ??
    (nodeData.guardrailType === 'jailbreak' ||
      nodeData.guardrailType === 'all');

  const violations: Array<{ type: string; detail: string }> = [];
  let redacted = text;

  if (enablePii) {
    for (const { name, source, flags } of PII_PATTERN_SOURCES) {
      const pattern = new RegExp(source, flags);
      const matches = text.match(pattern);
      if (matches) {
        violations.push({
          type: 'pii',
          detail: `Detected ${name}: ${matches.length} instance(s)`,
        });
        if (action === 'redact') {
          redacted = redacted.replace(
            new RegExp(source, flags),
            `[${name.toUpperCase()}_REDACTED]`,
          );
        }
      }
    }
  }

  if (enableJail) {
    const lower = text.toLowerCase();
    for (const phrase of JAILBREAK_PHRASES) {
      if (lower.includes(phrase)) {
        violations.push({
          type: 'jailbreak',
          detail: `Detected jailbreak attempt: "${phrase}"`,
        });
      }
    }
  }

  if (enableMod) {
    if (new RegExp(MODERATION_SOURCE, 'i').test(text)) {
      violations.push({
        type: 'moderation',
        detail: 'Detected potentially harmful content',
      });
    }
  }

  const passed = violations.length === 0;
  const hasNonPiiViolation = violations.some((v) => v.type !== 'pii');

  // Redact can only replace PII patterns — jailbreak/moderation violations have no text
  // to substitute, so escalate redact to block when non-PII violations are present.
  if (
    !passed &&
    (action === 'block' || (action === 'redact' && hasNonPiiViolation))
  ) {
    throw new Error(
      `Guardrails blocked execution — violations: ${violations.map((v) => v.detail).join(', ')}`,
    );
  }

  return {
    passed,
    violations,
    ...(action === 'redact' && !passed
      ? { redactedText: redacted, originalText: text }
      : {}),
  };
}
