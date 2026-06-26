import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: number) {
    const data = await this.userService.getProfile(userId);
    return { code: 0, data };
  }

  @Put('profile')
  async updateProfile(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.userService.updateProfile(userId, body);
    return { code: 0, data };
  }

  @Get('stats')
  async getStats(@CurrentUser('id') userId: number) {
    const data = await this.userService.getStats(userId);
    return { code: 0, data };
  }
}
