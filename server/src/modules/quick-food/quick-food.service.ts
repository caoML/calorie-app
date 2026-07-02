import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuickFood } from './quick-food.entity';

// 系统默认快捷食物（用户首次使用时自动初始化）
const DEFAULT_QUICK_FOODS = [
  { name: '一碗米饭', foodName: '米饭', amount: 200, unit: 'g', kcal: 232, icon: '🍚', sortOrder: 0, meal: 'lunch' },
  { name: '一碗粉/面', foodName: '米粉', amount: 300, unit: 'g', kcal: 348, icon: '🍜', sortOrder: 1, meal: 'lunch' },
  { name: '一个鸡蛋', foodName: '鸡蛋(煮)', amount: 50, unit: 'g', kcal: 72, icon: '🥚', sortOrder: 2, meal: 'breakfast' },
  { name: '一个蛋白', foodName: '鸡蛋白(去黄)', amount: 33, unit: 'g', kcal: 16, icon: '🍳', sortOrder: 3, meal: 'breakfast' },
  { name: '一杯牛奶', foodName: '牛奶', amount: 250, unit: 'ml', kcal: 162, icon: '🥛', sortOrder: 4, meal: 'breakfast' },
  { name: '一个苹果', foodName: '苹果', amount: 200, unit: 'g', kcal: 104, icon: '🍎', sortOrder: 5, meal: 'snack' },
  { name: '一份青菜', foodName: '青菜(炒)', amount: 200, unit: 'g', kcal: 60, icon: '🥬', sortOrder: 6, meal: 'dinner' },
  { name: '一杯咖啡', foodName: '黑咖啡', amount: 240, unit: 'ml', kcal: 5, icon: '☕', sortOrder: 7, meal: 'snack' },
  { name: '一片面包', foodName: '全麦面包', amount: 40, unit: 'g', kcal: 98, icon: '🍞', sortOrder: 8, meal: 'breakfast' },
];

@Injectable()
export class QuickFoodService {
  constructor(
    @InjectRepository(QuickFood)
    private quickFoodRepo: Repository<QuickFood>,
  ) {}

  // 获取用户的快捷食物列表
  async getList(userId: number): Promise<QuickFood[]> {
    let list = await this.quickFoodRepo.find({
      where: { userId, isActive: true },
      order: { sortOrder: 'ASC' },
    });

    // 首次使用，初始化默认数据
    if (list.length === 0) {
      await this.initDefaults(userId);
      list = await this.quickFoodRepo.find({
        where: { userId, isActive: true },
        order: { sortOrder: 'ASC' },
      });
    }

    return list;
  }

  // 初始化默认快捷食物
  private async initDefaults(userId: number) {
    const entities = DEFAULT_QUICK_FOODS.map((item) =>
      this.quickFoodRepo.create({ ...item, userId }),
    );
    await this.quickFoodRepo.save(entities);
  }

  // 新增快捷食物
  async create(userId: number, data: Partial<QuickFood>) {
    // 获取当前最大排序
    const maxOrder = await this.quickFoodRepo
      .createQueryBuilder('q')
      .select('MAX(q.sortOrder)', 'max')
      .where('q.userId = :userId', { userId })
      .getRawOne();

    const quickFood = this.quickFoodRepo.create({
      ...data,
      userId,
      sortOrder: (maxOrder?.max || 0) + 1,
    });
    return this.quickFoodRepo.save(quickFood);
  }

  // 更新快捷食物
  async update(userId: number, id: number, data: Partial<QuickFood>) {
    await this.quickFoodRepo.update({ id, userId }, data);
    return this.quickFoodRepo.findOne({ where: { id, userId } });
  }

  // 删除快捷食物（软删除）
  async remove(userId: number, id: number) {
    await this.quickFoodRepo.update({ id, userId }, { isActive: false });
  }

  // 重新排序
  async reorder(userId: number, ids: number[]) {
    const promises = ids.map((id, index) =>
      this.quickFoodRepo.update({ id, userId }, { sortOrder: index }),
    );
    await Promise.all(promises);
  }
}
