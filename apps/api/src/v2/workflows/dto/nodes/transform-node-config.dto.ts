import { IsObject, IsString } from 'class-validator';

import { TransformNodeConfig, type VariableMap } from '@linea/shared/contracts';

export class TransformNodeConfigDto implements TransformNodeConfig {
  @IsObject()
  variables!: VariableMap;
}
