import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { UsersService } from './users.service';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete account (GDPR)' })
  deleteMe(@CurrentUser() user: User) {
    return this.usersService.delete(user.id);
  }
}
