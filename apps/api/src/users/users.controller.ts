import { Controller, Put, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put('me')
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: any) {
    if (!userId) {
      throw new Error("User ID is missing from request. Ensure you are logged in.");
    }
    return this.usersService.updateProfile(userId, dto);
  }
}
