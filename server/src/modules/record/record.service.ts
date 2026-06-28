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

  // 删除单条记录
  async delete(userId: number, recordId: number) {
    await this.recordRepo.delete({ id: recordId, userId });
  }

  // 清空某天的全部记录
  async clearByDate(userId: number, date: string): Promise<number> {
    const result = await this.recordRepo.delete({ userId, date });
    return result.affected || 0;
  }

  // 获取历史每日热量汇总（最近 N 天）
  async getHistory(userId: number, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startStr = startDate.toISOString().split('T')[0];

    const rows = await this.recordRepo
      .createQueryBuilder('record')
      .select('record.date', 'date')
      .addSelect('SUM(record.kcal)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('record.userId = :userId', { userId })
      .andWhere('record.date >= :startStr', { startStr })
      .groupBy('record.date')
      .orderBy('record.date', 'DESC')
      .getRawMany();

    const list = rows.map((r) => ({
      date: r.date,
      total: Math.round(Number(r.total) || 0),
      count: Number(r.count) || 0,
    }));

    const totalKcal = list.reduce((sum, item) => sum + item.total, 0);
    const daysWithRecord = list.length;
    const avg = daysWithRecord ? Math.round(totalKcal / daysWithRecord) : 0;

    return {
      list,
      summary: { days: daysWithRecord, avg, total: totalKcal },
    };
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

  // 餐次分布统计 + 周对比
  async getMealStats(userId: number, days = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));
    const startStr = startDate.toISOString().split('T')[0];

    // 按餐次汇总
    const mealRows = await this.recordRepo
      .createQueryBuilder('record')
      .select('record.meal', 'meal')
      .addSelect('SUM(record.kcal)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('record.userId = :userId', { userId })
      .andWhere('record.date >= :startStr', { startStr })
      .groupBy('record.meal')
      .getRawMany();

    const mealDistribution = mealRows.map((r) => ({
      meal: r.meal,
      total: Math.round(Number(r.total) || 0),
      count: Number(r.count) || 0,
    }));

    // 本周 vs 上周日均对比
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dayOfWeek = todayStart.getDay() || 7; // 周日=7

    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(todayStart.getDate() - dayOfWeek + 1);
    const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
    const lastWeekEndStr = new Date(
      thisWeekStart.getTime() - 86400000,
    )
      .toISOString()
      .split('T')[0];

    // 本周数据
    const thisWeekRows = await this.recordRepo
      .createQueryBuilder('record')
      .select('record.date', 'date')
      .addSelect('SUM(record.kcal)', 'total')
      .where('record.userId = :userId', { userId })
      .andWhere('record.date >= :start', { start: thisWeekStartStr })
      .groupBy('record.date')
      .getRawMany();

    // 上周数据
    const lastWeekRows = await this.recordRepo
      .createQueryBuilder('record')
      .select('record.date', 'date')
      .addSelect('SUM(record.kcal)', 'total')
      .where('record.userId = :userId', { userId })
      .andWhere('record.date >= :start', { start: lastWeekStartStr })
      .andWhere('record.date <= :end', { end: lastWeekEndStr })
      .groupBy('record.date')
      .getRawMany();

    const thisWeekTotal = thisWeekRows.reduce(
      (sum, r) => sum + Math.round(Number(r.total) || 0),
      0,
    );
    const lastWeekTotal = lastWeekRows.reduce(
      (sum, r) => sum + Math.round(Number(r.total) || 0),
      0,
    );
    const thisWeekDays = thisWeekRows.length || 1;
    const lastWeekDays = lastWeekRows.length || 1;

    const weekCompare = {
      thisWeekAvg: Math.round(thisWeekTotal / thisWeekDays),
      lastWeekAvg: Math.round(lastWeekTotal / lastWeekDays),
      diff: Math.round(thisWeekTotal / thisWeekDays) - Math.round(lastWeekTotal / lastWeekDays),
    };

    return { mealDistribution, weekCompare };
  }

  // 成就系统数据
  async getAchievements(userId: number) {
    // 总记录条数
    const totalRecords = await this.recordRepo.count({ where: { userId } });

    // 总记录天数
    const daysResult = await this.recordRepo
      .createQueryBuilder('record')
      .select('COUNT(DISTINCT record.date)', 'days')
      .where('record.userId = :userId', { userId })
      .getRawOne();
    const totalDays = Number(daysResult?.days) || 0;

    // 连续天数
    const streak = await this.calculateStreak(userId);

    // 最高单日记录数
    const maxDayResult = await this.recordRepo
      .createQueryBuilder('record')
      .select('COUNT(*)', 'count')
      .where('record.userId = :userId', { userId })
      .groupBy('record.date')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();
    const maxDayRecords = Number(maxDayResult?.count) || 0;

    // 首次记录日期
    const firstRecord = await this.recordRepo.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    const firstRecordDate = firstRecord ? firstRecord.date : null;

    return {
      totalRecords,
      totalDays,
      streak,
      maxDayRecords,
      firstRecordDate,
    };
  }

  // 计算连续记录天数
  // 修复：如果今天还没记录，从昨天开始往回算（避免用户一大早还没记录就显示streak=0）
  private async calculateStreak(userId: number): Promise<number> {
    const dates = await this.recordRepo
      .createQueryBuilder('record')
      .select('DISTINCT record.date', 'date')
      .where('record.userId = :userId', { userId })
      .orderBy('record.date', 'DESC')
      .getRawMany();

    if (dates.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // 判断今天是否已有记录
    const hasTodayRecord = dates[0]?.date === todayStr;

    // 如果今天有记录，从今天开始算；否则从昨天开始算
    const startDate = new Date(today);
    if (!hasTodayRecord) {
      startDate.setDate(startDate.getDate() - 1);
    }

    let streak = 0;
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date(startDate);
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
