import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MealTemplateService } from './meal-template.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('meal-templates')
@UseGuards(AuthGuard)
export class MealTemplateController {
  constructor(private mealTemplateService: MealTemplateService) {}

  @Get()
  async getList(@CurrentUser('id') userId: number) {
    const data = await this.mealTemplateService.getList(userId);
    return { code: 0, data };
  }

  @Post()
  async create(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.mealTemplateService.create(userId, body);
    return { code: 0, data };
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.mealTemplateService.update(userId, Number(id), body);
    return { code: 0, data };
  }

  // 使用模板（返回模板内容用于批量记录）
  @Post(':id/use')
  async use(@CurrentUser('id') userId: number, @Param('id') id: string) {
    const data = await this.mealTemplateService.use(userId, Number(id));
    return { code: 0, data };
  }

  // 从已有记录创建模板
  @Post('from-records')
  async createFromRecords(@CurrentUser('id') userId: number, @Body() body: any) {
    const data = await this.mealTemplateService.createFromRecords(userId, body);
    return { code: 0, data };
  }

  @Delete(':id')
  async remove(@CurrentUser('id') userId: number, @Param('id') id: string) {
    await this.mealTemplateService.remove(userId, Number(id));
    return { code: 0, message: '删除成功' };
  }
}
