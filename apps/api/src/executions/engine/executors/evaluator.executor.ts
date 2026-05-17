import Anthropic from '@anthropic-ai/sdk';
import type { WorkflowState } from '../variable-substitution';

export interface EvaluatorNodeData {
  model?: string;
  criteria?: string;
  input?: string;
  scoreMin?: number;
  scoreMax?: number;
}

export interface EvaluatorResult {
  score: number;
  scoreMin: number;
  scoreMax: number;
  passed: boolean;
  reasoning: string;
  input: string;
}

export async function executeEvaluatorNode(
  nodeData: EvaluatorNodeData,
  state: WorkflowState,
  anthropicKey?: string,
): Promise<EvaluatorResult> {
  const scoreMin = nodeData.scoreMin ?? 0;
  const scoreMax = nodeData.scoreMax ?? 10;
  const passThreshold = scoreMin + (scoreMax - scoreMin) * 0.6;

  const rawInput = nodeData.input
    ? String(nodeData.input)
    : JSON.stringify(state.variables['lastOutput'] ?? '');

  if (!anthropicKey) {
    return {
      score: 0,
      scoreMin,
      scoreMax,
      passed: false,
      reasoning: 'No ANTHROPIC_API_KEY configured — evaluator cannot run.',
      input: rawInput,
    };
  }

  if (!nodeData.criteria) {
    return {
      score: 0,
      scoreMin,
      scoreMax,
      passed: false,
      reasoning: 'No evaluation criteria configured.',
      input: rawInput,
    };
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  const prompt = `You are an objective evaluator. Score the following output on a scale from ${scoreMin} to ${scoreMax} based on the criteria provided.

CRITERIA:
${nodeData.criteria}

OUTPUT TO EVALUATE:
${rawInput}

Respond with a JSON object in this exact format (no markdown, just JSON):
{"score": <number between ${scoreMin} and ${scoreMax}>, "reasoning": "<brief explanation>"}`;

  const response = await client.messages.create({
    model: nodeData.model ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === 'text')?.text?.trim() ?? '{}';

  let score = scoreMin;
  let reasoning = 'Could not parse evaluation response.';
  try {
    const parsed = JSON.parse(text) as { score?: number; reasoning?: string };
    score = Math.min(scoreMax, Math.max(scoreMin, Number(parsed.score ?? scoreMin)));
    reasoning = String(parsed.reasoning ?? '');
  } catch {
    // keep defaults
  }

  return {
    score,
    scoreMin,
    scoreMax,
    passed: score >= passThreshold,
    reasoning,
    input: rawInput,
  };
}
