import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer'; // 引入 multer 类型声明
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

  // AI 估算食物热量（支持 mode:'multi' 多食物解析）
  @Post()
  async estimate(@Body() body: { foodName: string; mode?: string }) {
    if (!body.foodName) {
      return { code: -1, message: '请提供食物名称' };
    }

    if (body.mode === 'multi') {
      const result = await this.aiEstimateService.parseMultiFoods(body.foodName);
      return { code: 0, data: result };
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

  // AI 语音文本解析：将自然语言解析为食物列表
  @Post('voice-parse')
  async voiceParse(
    @CurrentUser('id') userId: number,
    @Body() body: { text: string },
  ) {
    if (!body.text) {
      return { code: -1, message: '请提供语音文本' };
    }

    const result = await this.aiEstimateService.parseVoiceText(body.text);
    return { code: 0, data: result };
  }

  // 语音录音文件上传：语音转文字 + AI解析食物（一站式）
  @Post('voice-record')
  @UseInterceptors(FileInterceptor('file'))
  async voiceRecord(
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { code: -1, message: '请上传录音文件' };
    }

    try {
      const result = await this.aiEstimateService.recognizeAndParse(file.buffer, file.originalname);
      return { code: 0, data: result };
    } catch (error) {
      return { code: -1, message: '语音识别失败，请重试' };
    }
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
