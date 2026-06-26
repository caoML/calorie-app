import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { QuickFoodService } from './quick-food.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('quick-foods')
@UseGuards(AuthGuard)
export class QuickFoodController {
  constructor(private quickFoodService: QuickFoodService) {}

  @Get()
  async getList(@CurrentUser('id') userId: number) {
    const data = await this.quickFoodService.getList(userId);
    return { code: 0, data };
  }

  @Post()
  async create(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.quickFoodService.create(userId, body);
    return { code: 0, data };
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.quickFoodService.update(userId, Number(id), body);
    return { code: 0, data };
  }

  @Delete(':id')
  async remove(@CurrentUser('id') userId: number, @Param('id') id: string) {
    await this.quickFoodService.remove(userId, Number(id));
    return { code: 0, message: '删除成功' };
  }

  @Post('reorder')
  async reorder(@CurrentUser('id') userId: number, @Body() body: { ids: number[] }) {
    await this.quickFoodService.reorder(userId, body.ids);
    return { code: 0, message: '排序成功' };
  }
}
