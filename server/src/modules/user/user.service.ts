import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { FoodRecord } from '../record/record.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(FoodRecord)
    private recordRepo: Repository<FoodRecord>,
  ) {}

  async getProfile(userId: number) {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async updateProfile(userId: number, data: Partial<User>) {
    await this.userRepo.update(userId, data);
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async getStats(userId: number) {
    // 总记录条数
    const totalRecords = await this.recordRepo.count({ where: { userId } });

    // 有记录的不同日期数
    const result = await this.recordRepo
      .createQueryBuilder('record')
      .select('COUNT(DISTINCT record.date)', 'totalDays')
      .where('record.userId = :userId', { userId })
      .getRawOne();
    const totalDays = result?.totalDays || 0;

    // 连续记录天数
    const streak = await this.calculateStreak(userId);

    return { totalRecords, totalDays, streak };
  }

  // 获取提醒设置
  async getReminder(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      enabled: user?.reminderEnabled || false,
      times: user?.reminderTimes ? JSON.parse(user.reminderTimes) : ['08:00', '12:00', '18:00'],
    };
  }

  // 更新提醒设置
  async updateReminder(userId: number, data: { enabled: boolean; times: string[] }) {
    await this.userRepo.update(userId, {
      reminderEnabled: data.enabled,
      reminderTimes: JSON.stringify(data.times || ['08:00', '12:00', '18:00']),
    });
    return this.getReminder(userId);
  }

  private async calculateStreak(userId: number): Promise<number> {
    // 获取所有有记录的日期（倒序）
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
