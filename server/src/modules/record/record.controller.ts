import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { RecordService } from './record.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('records')
@UseGuards(AuthGuard)
export class RecordController {
  constructor(private recordService: RecordService) {}

  @Post()
  async create(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.recordService.create(userId, body);
    return { code: 0, data };
  }

  // 批量记录（用于餐食模板一键记录）
  @Post('batch')
  async batchCreate(@CurrentUser('id') userId: number, @Body() body: { records: any[] }) {
    const data = await this.recordService.batchCreate(userId, body.records);
    return { code: 0, data };
  }

  @Get()
  async getByDate(@CurrentUser('id') userId: number, @Query('date') date: string) {
    const data = await this.recordService.getByDate(userId, date);
    return { code: 0, data };
  }

  // 清空某天的全部记录
  @Delete('clear')
  async clearByDate(@CurrentUser('id') userId: number, @Query('date') date: string) {
    const count = await this.recordService.clearByDate(userId, date);
    return { code: 0, message: `已清空 ${count} 条记录`, data: { count } };
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: number, @Param('id') id: string) {
    await this.recordService.delete(userId, Number(id));
    return { code: 0, message: '删除成功' };
  }

  @Get('recent-foods')
  async getRecentFoods(@CurrentUser('id') userId: number) {
    const data = await this.recordService.getRecentFoods(userId);
    return { code: 0, data };
  }

  // 历史每日热量汇总（默认最近30天）
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: number,
    @Query('days') days?: string,
  ) {
    const data = await this.recordService.getHistory(
      userId,
      days ? Number(days) : 30,
    );
    return { code: 0, data };
  }
}
