import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserFoodService } from './user-food.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('user-foods')
@UseGuards(AuthGuard)
export class UserFoodController {
  constructor(private userFoodService: UserFoodService) {}

  // 搜索私人食物库
  @Get('search')
  async search(@CurrentUser('id') userId: number, @Query('keyword') keyword: string) {
    if (!keyword) return { code: 0, data: [] };
    const data = await this.userFoodService.search(userId, keyword);
    return { code: 0, data };
  }

  // 获取所有私人食物
  @Get()
  async getAll(@CurrentUser('id') userId: number) {
    const data = await this.userFoodService.getAll(userId);
    return { code: 0, data };
  }

  // 添加食物到私人库
  @Post()
  async create(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.userFoodService.create(userId, body);
    return { code: 0, data, message: '添加成功' };
  }

  // 更新私人食物
  @Put(':id')
  async update(@CurrentUser('id') userId: number, @Param('id') id: string, @Body() body: any) {
    const data = await this.userFoodService.update(userId, Number(id), body);
    return { code: 0, data, message: '更新成功' };
  }

  // 删除私人食物
  @Delete(':id')
  async delete(@CurrentUser('id') userId: number, @Param('id') id: string) {
    await this.userFoodService.delete(userId, Number(id));
    return { code: 0, message: '删除成功' };
  }
}
