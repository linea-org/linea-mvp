import { TransformNodeConfig, VariableMap } from '@linea/shared/contracts';

export class TransformNodeConfigDto implements TransformNodeConfig {
  variables!: VariableMap;
}
