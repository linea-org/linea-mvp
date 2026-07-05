import { AgentNodeConfigDto } from './agent-node-config.dto.js';
import { TransformNodeConfigDto } from './transform-node-config.dto.js';
import { HttpNodeConfigDto } from './http-node-config,dto.js';

export const WORKFLOW_NODE_CONFIG_DTOS = {
  agent: AgentNodeConfigDto,
  transform: TransformNodeConfigDto,
  http: HttpNodeConfigDto,
} as const;
