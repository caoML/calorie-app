import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealTemplate } from './meal-template.entity';

@Injectable()
export class MealTemplateService {
  constructor(
    @InjectRepository(MealTemplate)
    private templateRepo: Repository<MealTemplate>,
  ) {}

  // 获取用户的所有餐食模板
  async getList(userId: number): Promise<MealTemplate[]> {
    const list = await this.templateRepo.find({
      where: { userId },
      order: { useCount: 'DESC', createdAt: 'DESC' },
    });
    // 解析 items JSON
    return list.map((t) => ({
      ...t,
      items: JSON.parse(t.items || '[]'),
    }));
  }

  // 创建餐食模板
  async create(userId: number, data: any) {
    const items = data.items || [];
    const totalKcal = items.reduce((sum: number, item: any) => sum + (item.kcal || 0), 0);

    const template = this.templateRepo.create({
      userId,
      name: data.name,
      icon: data.icon || '🍱',
      defaultMeal: data.defaultMeal || 'lunch',
      items: JSON.stringify(items),
      totalKcal,
    });
    return this.templateRepo.save(template);
  }

  // 更新餐食模板
  async update(userId: number, id: number, data: any) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.icon) updateData.icon = data.icon;
    if (data.defaultMeal) updateData.defaultMeal = data.defaultMeal;
    if (data.items) {
      updateData.items = JSON.stringify(data.items);
      updateData.totalKcal = data.items.reduce(
        (sum: number, item: any) => sum + (item.kcal || 0),
        0,
      );
    }

    await this.templateRepo.update({ id, userId }, updateData);
    return this.templateRepo.findOne({ where: { id, userId } });
  }

  // 使用模板（增加使用次数）
  async use(userId: number, id: number) {
    const template = await this.templateRepo.findOne({ where: { id, userId } });
    if (!template) return null;

    // 增加使用次数
    await this.templateRepo.update({ id }, { useCount: template.useCount + 1 });

    return {
      ...template,
      items: JSON.parse(template.items || '[]'),
    };
  }

  // 删除餐食模板
  async remove(userId: number, id: number) {
    await this.templateRepo.delete({ id, userId });
  }

  // 从今日某餐记录创建模板
  async createFromRecords(userId: number, data: { name: string; icon?: string; meal: string; records: any[] }) {
    const items = data.records.map((r) => ({
      foodName: r.foodName,
      foodId: r.foodId,
      amount: r.amount,
      unit: r.unit,
      kcal: r.kcal,
    }));

    return this.create(userId, {
      name: data.name,
      icon: data.icon || '🍱',
      defaultMeal: data.meal,
      items,
    });
  }
}
