import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AI_MODEL_CATALOG } from '../services/ai/model-catalog';

@ApiTags('Models')
@Controller('models')
export class ModelsController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List all available AI models and their capabilities',
  })
  list() {
    return AI_MODEL_CATALOG;
  }
}
