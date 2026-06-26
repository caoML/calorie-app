import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { FoodService } from './food.service';
import { UserFoodService } from '../user-food/user-food.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('foods')
export class FoodController {
  constructor(
    private foodService: FoodService,
    private userFoodService: UserFoodService,
  ) {}

  // 联合搜索：公共库 + 用户私人库
  @Get('search')
  @UseGuards(AuthGuard)
  async search(
    @CurrentUser('id') userId: number,
    @Query('keyword') keyword: string,
  ) {
    if (!keyword) return { code: 0, data: [] };

    // 并行搜索公共库和私人库
    const [publicResults, userResults] = await Promise.all([
      this.foodService.search(keyword),
      this.userFoodService.search(userId, keyword),
    ]);

    // 合并结果：私人库优先展示在前面（标记来源）
    const combined = [
      ...userResults.map(f => ({ ...f, source: f.source || 'user' })),
      ...publicResults.map(f => ({ ...f, source: 'system', isUserFood: false })),
    ];

    // 如果公共库精确匹配为空，尝试模糊推荐
    let suggestions = [];
    if (publicResults.length === 0 && userResults.length === 0) {
      suggestions = await this.foodService.fuzzySearch(keyword);
    }

    return {
      code: 0,
      data: combined,
      suggestions, // 模糊推荐（当无精确结果时）
    };
  }

  @Get('category')
  async getByCategory(@Query('category') category: string) {
    if (!category) return { code: 0, data: [] };
    const data = await this.foodService.getByCategory(category);
    return { code: 0, data };
  }
}
