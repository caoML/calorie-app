import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiEstimateService } from './ai-estimate.service';
import { UserFoodService } from '../user-food/user-food.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('ai-estimate')
@UseGuards(AuthGuard)
export class AiEstimateController {
  constructor(
    private aiEstimateService: AiEstimateService,
    private userFoodService: UserFoodService,
  ) {}

  // AI 估算食物热量
  @Post()
  async estimate(@Body() body: { foodName: string }) {
    if (!body.foodName) {
      return { code: -1, message: '请提供食物名称' };
    }

    const result = await this.aiEstimateService.estimateCalories(body.foodName);
    return { code: 0, data: result };
  }

  // AI 营养均衡分析
  @Post('nutrition')
  async analyzeNutrition(
    @CurrentUser('id') userId: number,
    @Body() body: {
      meals: { name: string; kcal: number; foods: string[] }[];
      todayTotal: number;
      dailyTarget: number;
      exerciseBurned: number;
      hour: number;
    },
  ) {
    const result = await this.aiEstimateService.analyzeNutrition(userId, body);
    return { code: 0, data: result };
  }

  // AI 估算 + 自动保存到私人库
  @Post('save')
  async estimateAndSave(
    @CurrentUser('id') userId: number,
    @Body() body: { foodName: string },
  ) {
    if (!body.foodName) {
      return { code: -1, message: '请提供食物名称' };
    }

    const result = await this.aiEstimateService.estimateCalories(body.foodName);

    // 保存到用户私人食物库（同名食物更新，不重复创建）
    const saved = await this.userFoodService.upsertByName(userId, {
      name: result.name,
      category: result.category,
      kcalPer100g: result.kcalPer100g,
      tip: result.tip,
      servings: JSON.stringify(result.servings),
      source: 'ai',
    });

    return {
      code: 0,
      data: {
        ...result,
        id: saved.id,
        isUserFood: true,
        source: 'ai',
      },
    };
  }
}
