import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [ClerkAuthGuard],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
