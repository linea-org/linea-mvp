import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MODEL_REGISTRY } from '../executions/engine/models/registry';

@ApiTags('Models')
@Controller('models')
export class ModelsController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List all available AI models and their capabilities',
  })
  list() {
    return Object.values(MODEL_REGISTRY);
  }
}
