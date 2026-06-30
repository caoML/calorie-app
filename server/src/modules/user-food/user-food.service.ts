import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { UserFood } from './user-food.entity';

@Injectable()
export class UserFoodService {
  constructor(
    @InjectRepository(UserFood)
    private userFoodRepo: Repository<UserFood>,
  ) {}

  // 搜索用户私人食物库
  async search(userId: number, keyword: string) {
    const results = await this.userFoodRepo.find({
      where: [
        { userId, name: Like(`%${keyword}%`) },
      ],
      order: { useCount: 'DESC', createdAt: 'DESC' },
      take: 10,
    });

    return results.map(f => ({
      ...f,
      servings: f.servings ? JSON.parse(f.servings) : null,
      isUserFood: true, // 标记为用户私人食物
    }));
  }

  // 获取用户所有私人食物
  async getAll(userId: number) {
    const results = await this.userFoodRepo.find({
      where: { userId },
      order: { useCount: 'DESC', createdAt: 'DESC' },
    });

    return results.map(f => ({
      ...f,
      servings: f.servings ? JSON.parse(f.servings) : null,
      isUserFood: true,
    }));
  }

  // 添加食物到私人库
  async create(userId: number, data: Partial<UserFood>) {
    const food = this.userFoodRepo.create({
      ...data,
      userId,
      servings: data.servings ? (typeof data.servings === 'string' ? data.servings : JSON.stringify(data.servings)) : null,
    });
    return this.userFoodRepo.save(food);
  }

  // 按名称 upsert：同名食物更新，不存在则创建（避免私人库重复）
  async upsertByName(userId: number, data: Partial<UserFood>) {
    const existing = await this.userFoodRepo.findOne({
      where: { userId, name: data.name },
    });

    if (existing) {
      // 已存在同名食物，更新数据
      if (data.servings && typeof data.servings !== 'string') {
        data.servings = JSON.stringify(data.servings);
      }
      Object.assign(existing, data);
      return this.userFoodRepo.save(existing);
    }

    // 不存在，创建新记录
    return this.create(userId, data);
  }

  // 更新食物
  async update(userId: number, id: number, data: Partial<UserFood>) {
    const food = await this.userFoodRepo.findOne({ where: { id, userId } });
    if (!food) throw new Error('食物不存在');

    if (data.servings && typeof data.servings !== 'string') {
      data.servings = JSON.stringify(data.servings);
    }

    Object.assign(food, data);
    return this.userFoodRepo.save(food);
  }

  // 删除食物
  async delete(userId: number, id: number) {
    return this.userFoodRepo.delete({ id, userId });
  }

  // 增加使用次数
  async incrementUseCount(userId: number, id: number) {
    await this.userFoodRepo.increment({ id, userId }, 'useCount', 1);
  }
}
