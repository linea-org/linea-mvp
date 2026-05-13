import type { WorkflowState } from '../variable-substitution';

export interface GuardrailsNodeData {
  guardrailType?: string;       // 'pii' | 'moderation' | 'jailbreak' | 'all'
  piiEnabled?: boolean;
  moderationEnabled?: boolean;
  jailbreakEnabled?: boolean;
  actionOnViolation?: 'block' | 'redact' | 'warn'; // default: 'block'
  inputField?: string;          // variable name to check, default: lastOutput
}

const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'email',       pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone_us',    pattern: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { name: 'ssn',         pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'credit_card', pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g },
  { name: 'ip_address',  pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
];

const JAILBREAK_PHRASES = [
  'ignore previous instructions',
  'disregard your instructions',
  'pretend you are',
  'act as if',
  'you are now',
  'forget all previous',
  'new persona',
  'jailbreak',
  'dan mode',
];

const MODERATION_PATTERNS = [
  /\b(hate|kill|murder|rape|bomb|terrorist)\b/gi,
];

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
  const action = nodeData.actionOnViolation ?? 'block';
  const inputField = nodeData.inputField ?? 'lastOutput';
  const raw = state.variables[inputField] ?? state.variables['lastOutput'] ?? '';
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);

  const enablePii = nodeData.piiEnabled ?? (nodeData.guardrailType === 'pii' || nodeData.guardrailType === 'all');
  const enableMod = nodeData.moderationEnabled ?? (nodeData.guardrailType === 'moderation' || nodeData.guardrailType === 'all');
  const enableJail = nodeData.jailbreakEnabled ?? (nodeData.guardrailType === 'jailbreak' || nodeData.guardrailType === 'all');

  const violations: Array<{ type: string; detail: string }> = [];
  let redacted = text;

  if (enablePii) {
    for (const { name, pattern } of PII_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push({ type: 'pii', detail: `Detected ${name}: ${matches.length} instance(s)` });
        if (action === 'redact') {
          redacted = redacted.replace(pattern, `[${name.toUpperCase()}_REDACTED]`);
        }
      }
    }
  }

  if (enableJail) {
    const lower = text.toLowerCase();
    for (const phrase of JAILBREAK_PHRASES) {
      if (lower.includes(phrase)) {
        violations.push({ type: 'jailbreak', detail: `Detected jailbreak attempt: "${phrase}"` });
      }
    }
  }

  if (enableMod) {
    for (const pattern of MODERATION_PATTERNS) {
      if (pattern.test(text)) {
        violations.push({ type: 'moderation', detail: 'Detected potentially harmful content' });
      }
    }
  }

  const passed = violations.length === 0;

  if (!passed && action === 'block') {
    throw new Error(
      `Guardrails blocked execution — violations: ${violations.map((v) => v.detail).join(', ')}`,
    );
  }

  return {
    passed,
    violations,
    ...(action === 'redact' && !passed ? { redactedText: redacted, originalText: text } : {}),
  };
}
