import { Database } from '@linea/db';
import { Injectable } from '@nestjs/common';
import {
  CreateWorkflowDto,
  WorkflowDefinitionDto,
} from './dto/create-workflow.dto.js';
import { ListWorkflowsDto } from './dto/list-workflows.dto.js';
import { UpdateWorkflowDto } from './dto/update-workflow.dto.js';
import { DBWorkflowDefinition } from '@linea/shared/contracts';

@Injectable()
export class WorkflowService {
  constructor(private readonly db: Database) {}

  async create(
    _workspaceId: string,
    podId: string,
    userId: string,
    dto: CreateWorkflowDto,
  ) {
    const def: DBWorkflowDefinition = this.toWorkflowDefinition(dto.definition);

    // todo! add workspaceId also
    const workflow = await this.db.workflow.create({
      name: dto.name,
      podId: podId,
      description: dto.description ?? null,
      definition: def,
      isTemplate: dto.isTemplate ?? false,
      isPublic: dto.isPublic ?? false,
      createdBy: userId,
      apiEnabled: undefined,
      apiVisibility: undefined,
      apiKey: undefined,
      clonedFromTemplateId: undefined,
    });

    return workflow;
  }

  async findAll(
    podId: string,
    query: ListWorkflowsDto,
    userId: string,
  ): Promise<any> {
    return await this.db.workflow.findAll(podId, userId, {
      ...query,
    });
  }

  async findById(id: string) {
    return await this.db.workflow.findById(id);
  }

  async remove(id: string, userId: string) {
    const res = await this.db.workflow.delete(id, userId);
    if (!res) {
      throw Error("You don't have permission to do this action");
    }
  }

  async update(id: string, userId: string, dto: UpdateWorkflowDto) {
    const w = await this.db.workflow.findById(id);

    if (w == null) throw new Error('Workflow not found');

    const def: DBWorkflowDefinition | undefined = dto.definition
      ? this.toWorkflowDefinition(dto.definition)
      : undefined;

    return await this.db.workflow.update(id, userId, {
      definition: def,
      name: dto.name,
      description: dto.description,
      isPublic: dto.isPublic,
    });
  }

  toWorkflowDefinition(
    definition: WorkflowDefinitionDto,
  ): DBWorkflowDefinition {
    return {
      startNode: definition.startNode,

      nodes: definition.nodes.map((node) => ({
        id: node.id,
        name: node.label ?? node.id,
        type: node.type,
        config: node.data as any, // limitation, I hate typescript
        metadata: {
          position: node.position,
          label: node.label,
          style: node.style,
          parentId: node.parentId,
          extent: node.extent,
          zIndex: node.zIndex,
        },
      })),

      edges: definition.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
    };
  }
}
