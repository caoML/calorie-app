import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoodRecord } from './record.entity';

@Injectable()
export class RecordService {
  constructor(
    @InjectRepository(FoodRecord)
    private recordRepo: Repository<FoodRecord>,
  ) {}

  // 创建记录
  async create(userId: number, data: Partial<FoodRecord>) {
    const record = this.recordRepo.create({ ...data, userId });
    return this.recordRepo.save(record);
  }

  // 批量创建记录（用于餐食模板）
  async batchCreate(userId: number, records: Partial<FoodRecord>[]) {
    const entities = records.map((data) =>
      this.recordRepo.create({ ...data, userId }),
    );
    return this.recordRepo.save(entities);
  }

  // 获取某天的记录
  async getByDate(userId: number, date: string) {
    const records = await this.recordRepo.find({
      where: { userId, date },
      order: { createdAt: 'ASC' },
    });

    // 计算连续天数
    const streak = await this.calculateStreak(userId);

    return { records, streak };
  }

  // 删除记录
  async delete(userId: number, recordId: number) {
    await this.recordRepo.delete({ id: recordId, userId });
  }

  // 获取最近吃过的食物（去重，最近7天）
  async getRecentFoods(userId: number) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const records = await this.recordRepo
      .createQueryBuilder('record')
      .select([
        'record.foodName as name',
        'record.foodId as id',
        'record.kcal as kcal',
        'record.amount as lastAmount',
        'record.unit as unit',
        'MAX(record.createdAt) as lastTime',
      ])
      .where('record.userId = :userId', { userId })
      .andWhere('record.date >= :dateStr', { dateStr })
      .groupBy('record.foodName')
      .orderBy('lastTime', 'DESC')
      .limit(10)
      .getRawMany();

    return records;
  }

  // 计算连续记录天数
  private async calculateStreak(userId: number): Promise<number> {
    const dates = await this.recordRepo
      .createQueryBuilder('record')
      .select('DISTINCT record.date', 'date')
      .where('record.userId = :userId', { userId })
      .orderBy('record.date', 'DESC')
      .getRawMany();

    if (dates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedStr = expectedDate.toISOString().split('T')[0];

      if (dates[i].date === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
