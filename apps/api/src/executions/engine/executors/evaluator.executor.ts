import type { WorkflowState } from '../variable-substitution.js';
import type { AIService } from '../../../services/ai/ai.service.js';

export interface EvaluatorNodeData {
  model?: string;
  criteria?: string;
  input?: string;
  scoreMin?: number;
  scoreMax?: number;
  passThreshold?: number; // 0–1 fraction, default 0.6
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
  aiService: AIService,
  workspaceId: string,
): Promise<EvaluatorResult> {
  const scoreMin = nodeData.scoreMin ?? 0;
  const scoreMax = nodeData.scoreMax ?? 10;
  const thresholdFraction = nodeData.passThreshold ?? 0.6;
  const passThreshold = scoreMin + (scoreMax - scoreMin) * thresholdFraction;

  const rawInput = nodeData.input
    ? String(nodeData.input)
    : JSON.stringify(state.variables['lastOutput'] ?? '');

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

  const modelId = nodeData.model ?? 'claude-haiku-4-5';
  let client: Awaited<ReturnType<AIService['initialize']>>;
  try {
    client = await aiService.initialize(workspaceId, 'anthropic');
  } catch {
    return {
      score: 0,
      scoreMin,
      scoreMax,
      passed: false,
      reasoning: 'No Anthropic API key configured — evaluator cannot run.',
      input: rawInput,
    };
  }

  const prompt = `You are an objective evaluator. Score the following output on a scale from ${scoreMin} to ${scoreMax} based on the criteria provided.

CRITERIA:
${nodeData.criteria}

OUTPUT TO EVALUATE:
${rawInput}

Respond with a JSON object in this exact format (no markdown, just JSON):
{"score": <number between ${scoreMin} and ${scoreMax}>, "reasoning": "<brief explanation>"}`;

  const response = await client.chat(modelId, {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 256,
  });

  const text = response.text.trim() || '{}';

  let score = scoreMin;
  let reasoning = 'Could not parse evaluation response.';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? text) as {
      score?: number;
      reasoning?: string;
    };
    score = Math.min(
      scoreMax,
      Math.max(scoreMin, Number(parsed.score ?? scoreMin)),
    );
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
