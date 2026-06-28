import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
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

  // 获取提醒设置
  @Get('reminder')
  async getReminder(@CurrentUser('id') userId: number) {
    const data = await this.userService.getReminder(userId);
    return { code: 0, data };
  }

  // 更新提醒设置
  @Put('reminder')
  async updateReminder(
    @CurrentUser('id') userId: number,
    @Body() body: { enabled: boolean; times: string[] },
  ) {
    const data = await this.userService.updateReminder(userId, body);
    return { code: 0, data };
  }
}
