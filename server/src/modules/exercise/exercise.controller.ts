import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ExerciseService } from './exercise.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('exercises')
@UseGuards(AuthGuard)
export class ExerciseController {
  constructor(private exerciseService: ExerciseService) {}

  // AI 估算运动消耗热量
  @Post('ai-estimate')
  async aiEstimate(@Body() body: { exerciseName: string; duration: number }) {
    if (!body.exerciseName) {
      return { code: -1, message: '请描述你的运动' };
    }
    const duration = body.duration || 30;
    const result = await this.exerciseService.aiEstimateExercise(body.exerciseName, duration);
    return { code: 0, data: result };
  }

  @Post()
  async create(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.exerciseService.create(userId, body);
    return { code: 0, data };
  }

  @Get()
  async getByDate(@CurrentUser('id') userId: number, @Query('date') date: string) {
    const data = await this.exerciseService.getByDate(userId, date);
    return { code: 0, data };
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: number, @Param('id') id: string) {
    await this.exerciseService.delete(userId, Number(id));
    return { code: 0, message: '删除成功' };
  }

  // 历史运动汇总
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: number,
    @Query('days') days?: string,
  ) {
    const data = await this.exerciseService.getHistory(
      userId,
      days ? Number(days) : 30,
    );
    return { code: 0, data };
  }

  // 最近运动（去重，用于快捷选择）
  @Get('recent')
  async getRecentExercises(@CurrentUser('id') userId: number) {
    const data = await this.exerciseService.getRecentExercises(userId);
    return { code: 0, data };
  }
}
