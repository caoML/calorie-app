import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseRecord } from './exercise.entity';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectRepository(ExerciseRecord)
    private exerciseRepo: Repository<ExerciseRecord>,
  ) {}

  // AI 估算运动消耗热量
  async aiEstimateExercise(
    exerciseName: string,
    duration: number,
  ): Promise<{
    exerciseName: string;
    duration: number;
    kcalBurned: number;
    intensity: string;
    tip: string;
    confidence: string;
  }> {
    const prompt = `你是一个专业的运动营养师。请估算以下运动的热量消耗。

运动内容：${exerciseName}
运动时长：${duration} 分钟

请严格按照以下JSON格式返回（不要添加任何其他文字）：
{
  "exerciseName": "运动名称(规范化)",
  "kcalBurned": 消耗的总热量(大卡,数字,基于${duration}分钟计算),
  "calPerMin": 每分钟消耗热量(大卡,数字),
  "intensity": "运动强度(low/medium/high)",
  "tip": "一句话提示或建议",
  "confidence": "high/medium/low"
}

注意：
1. 热量消耗要基于体重60-70kg的成年人中等强度估算
2. 如果运动描述模糊，按中等强度估算
3. 日常活动（如做家务、逛街）也要合理估算
4. calPerMin 通常在 2-15 之间`;

    try {
      const apiKey = process.env.AI_API_KEY || '';
      const apiUrl =
        process.env.AI_API_URL ||
        'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      const model = process.env.AI_MODEL || 'glm-4-plus';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // 解析 JSON 响应
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 返回格式异常');
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        exerciseName: result.exerciseName || exerciseName,
        duration,
        kcalBurned: Math.round(Number(result.kcalBurned) || duration * 5),
        intensity: result.intensity || 'medium',
        tip: result.tip || '',
        confidence: result.confidence || 'medium',
      };
    } catch (error) {
      console.error('AI 运动估算失败:', error.message);
      return this.fallbackExerciseEstimate(exerciseName, duration);
    }
  }

  // 降级估算（当 AI 不可用时）
  private fallbackExerciseEstimate(exerciseName: string, duration: number) {
    let calPerMin = 5; // 默认中等强度
    let intensity = 'medium';

    // 根据关键词粗略估算
    if (/跑|冲刺|跳绳|HIIT|hiit|高强度/.test(exerciseName)) {
      calPerMin = 10;
      intensity = 'high';
    } else if (/游泳|骑车|骑行|篮球|足球|羽毛球|网球|爬山|登山/.test(exerciseName)) {
      calPerMin = 7;
      intensity = 'medium';
    } else if (/走|散步|逛街|遛狗|太极|拉伸/.test(exerciseName)) {
      calPerMin = 3.5;
      intensity = 'low';
    } else if (/瑜伽|普拉提/.test(exerciseName)) {
      calPerMin = 3;
      intensity = 'low';
    } else if (/家务|打扫|拖地|擦|洗/.test(exerciseName)) {
      calPerMin = 3.5;
      intensity = 'low';
    } else if (/力量|举铁|哑铃|健身|深蹲|俯卧撑/.test(exerciseName)) {
      calPerMin = 6;
      intensity = 'medium';
    } else if (/跳舞|舞蹈|有氧操|健身操/.test(exerciseName)) {
      calPerMin = 6;
      intensity = 'medium';
    }

    return {
      exerciseName,
      duration,
      kcalBurned: Math.round(calPerMin * duration),
      intensity,
      tip: '⚠️ AI不可用，已使用粗略估算',
      confidence: 'low',
    };
  }

  // 创建运动记录
  async create(userId: number, data: Partial<ExerciseRecord>) {
    const record = this.exerciseRepo.create({ ...data, userId });
    return this.exerciseRepo.save(record);
  }

  // 获取某天的运动记录
  async getByDate(userId: number, date: string) {
    const records = await this.exerciseRepo.find({
      where: { userId, date },
      order: { createdAt: 'ASC' },
    });

    const totalBurned = records.reduce((sum, r) => sum + r.kcalBurned, 0);

    return { records, totalBurned: Math.round(totalBurned) };
  }

  // 删除单条运动记录
  async delete(userId: number, recordId: number) {
    await this.exerciseRepo.delete({ id: recordId, userId });
  }

  // 获取历史运动汇总（最近 N 天）
  async getHistory(userId: number, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startStr = startDate.toISOString().split('T')[0];

    const rows = await this.exerciseRepo
      .createQueryBuilder('exercise')
      .select('exercise.date', 'date')
      .addSelect('SUM(exercise.kcalBurned)', 'totalBurned')
      .addSelect('SUM(exercise.duration)', 'totalDuration')
      .addSelect('COUNT(*)', 'count')
      .where('exercise.userId = :userId', { userId })
      .andWhere('exercise.date >= :startStr', { startStr })
      .groupBy('exercise.date')
      .orderBy('exercise.date', 'DESC')
      .getRawMany();

    const list = rows.map((r) => ({
      date: r.date,
      totalBurned: Math.round(Number(r.totalBurned) || 0),
      totalDuration: Math.round(Number(r.totalDuration) || 0),
      count: Number(r.count) || 0,
    }));

    return { list };
  }

  // 获取最近的运动记录（去重，用于快捷选择）
  async getRecentExercises(userId: number) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 14);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const records = await this.exerciseRepo
      .createQueryBuilder('exercise')
      .select([
        'exercise.exerciseName as exerciseName',
        'exercise.icon as icon',
        'exercise.kcalBurned as kcalBurned',
        'exercise.duration as duration',
        'MAX(exercise.createdAt) as lastTime',
      ])
      .where('exercise.userId = :userId', { userId })
      .andWhere('exercise.date >= :dateStr', { dateStr })
      .groupBy('exercise.exerciseName')
      .orderBy('lastTime', 'DESC')
      .limit(8)
      .getRawMany();

    return records;
  }
}
