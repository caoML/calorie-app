import { Injectable } from '@nestjs/common';

@Injectable()
export class AiEstimateService {
  // 调用大模型估算食物热量
  async estimateCalories(foodName: string): Promise<{
    name: string;
    kcalPer100g: number;
    category: string;
    tip: string;
    servings: { label: string; grams: number }[];
    confidence: string;
  }> {
    const prompt = `你是一个专业的营养师。请估算以下中国菜品/食物的热量信息。

食物名称：${foodName}

请严格按照以下JSON格式返回（不要添加任何其他文字）：
{
  "name": "食物名称",
  "kcalPer100g": 每100克的热量(大卡,数字),
  "category": "分类(staple/meat/vegetable/fruit/drink/snack/dish)",
  "tip": "一句话提示,如份量参考",
  "servings": [
    {"label": "小份(约Xg)", "grams": 数字},
    {"label": "中份(约Xg)", "grams": 数字},
    {"label": "大份(约Xg)", "grams": 数字}
  ],
  "confidence": "high/medium/low"
}

注意：
1. 如果是一道菜（如小炒黄牛肉），估算整道菜的平均每100g热量
2. servings 要给出餐厅常见的小/中/大份重量
3. 热量要基于中国常见做法估算
4. confidence 表示估算的可信度`;

    try {
      // 调用大模型 API（这里用通用的 fetch 调用，支持 OpenAI 兼容接口）
      const apiKey = process.env.AI_API_KEY || '';
      const apiUrl = process.env.AI_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      const model = process.env.AI_MODEL || 'glm-4-plus';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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
        name: result.name || foodName,
        kcalPer100g: Number(result.kcalPer100g) || 150,
        category: result.category || 'dish',
        tip: result.tip || '',
        servings: result.servings || [
          { label: '小份(约200g)', grams: 200 },
          { label: '中份(约300g)', grams: 300 },
          { label: '大份(约400g)', grams: 400 },
        ],
        confidence: result.confidence || 'medium',
      };
    } catch (error) {
      console.error('AI 估算失败:', error.message);
      // 降级方案：返回一个基于分类的默认估算
      return this.fallbackEstimate(foodName);
    }
  }

  // ====== AI 营养均衡分析 ======
  // 内存缓存：userId -> { hash, result, timestamp }
  private nutritionCache = new Map<number, { hash: string; result: any; timestamp: number }>();

  async analyzeNutrition(userId: number, dietData: {
    meals: { name: string; kcal: number; foods: string[] }[];
    todayTotal: number;
    dailyTarget: number;
    exerciseBurned: number;
    hour: number;
  }): Promise<{
    icon: string;
    title: string;
    desc: string;
    tag?: string;
  } | null> {
    // 没有饮食数据就不分析
    const hasFoods = dietData.meals.some(m => m.foods.length > 0);
    if (!hasFoods || dietData.todayTotal === 0) return null;

    // 用饮食数据生成 hash，相同数据直接返回缓存
    const dataHash = JSON.stringify({
      meals: dietData.meals,
      total: dietData.todayTotal,
      target: dietData.dailyTarget,
      exercise: dietData.exerciseBurned,
    });

    const cached = this.nutritionCache.get(userId);
    if (cached && cached.hash === dataHash) {
      return cached.result;
    }

    const mealsDesc = dietData.meals
      .filter(m => m.foods.length > 0)
      .map(m => `${m.name}(${m.kcal}大卡): ${m.foods.join('、')}`)
      .join('\n');

    const prompt = `你是一个温暖、专业的营养顾问。根据用户今天的饮食记录，给出一条简短的营养建议。

用户信息：
- 每日目标热量：${dietData.dailyTarget} 大卡
- 今日已摄入：${dietData.todayTotal} 大卡
- 今日运动消耗：${dietData.exerciseBurned} 大卡
- 当前时间：${dietData.hour}点

今日饮食：
${mealsDesc}

请分析用户的饮食结构，从以下角度选择最值得提醒的一点：
1. 营养素均衡性（是否蛋白质/蔬菜/碳水偏少或过多）
2. 各餐热量分配（是否某餐占比过重）
3. 食物多样性（是否太单一）
4. 正向鼓励（如果整体还不错的话）

请严格按以下JSON格式返回（不要添加任何其他文字）：
{
  "icon": "一个最合适的emoji",
  "title": "2-4字标题",
  "desc": "15-30字的建议，要口语化、温暖，不要太教条",
  "tag": "positive/suggestion/warning 三选一"
}

注意：
- 只给一条最重要的建议，不要面面俱到
- 语气要像朋友聊天，不要像医生说教
- 如果整体还不错就给正向反馈，不要硬挑毛病`;

    try {
      const apiKey = process.env.AI_API_KEY || '';
      const apiUrl = process.env.AI_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      const model = process.env.AI_MODEL || 'glm-4-plus';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 返回格式异常');
      }

      const result = JSON.parse(jsonMatch[0]);
      const tip = {
        icon: result.icon || '💡',
        title: result.title || '饮食建议',
        desc: result.desc || '注意营养均衡哦~',
        tag: result.tag || 'suggestion',
      };

      // 写入缓存
      this.nutritionCache.set(userId, { hash: dataHash, result: tip, timestamp: Date.now() });

      return tip;
    } catch (error) {
      console.error('AI 营养分析失败:', error.message);
      // AI 失败时返回 null，前端会 fallback 到本地规则
      return null;
    }
  }

  // 降级估算（当AI不可用时）
  private fallbackEstimate(foodName: string) {
    // 根据常见关键词粗略估算
    let kcalPer100g = 150;
    let category = 'dish';

    if (/汤|羹/.test(foodName)) {
      kcalPer100g = 40;
      category = 'dish';
    } else if (/炸|煎|炒/.test(foodName)) {
      kcalPer100g = 180;
      category = 'dish';
    } else if (/蒸|煮|拌/.test(foodName)) {
      kcalPer100g = 100;
      category = 'dish';
    } else if (/饭|面|粉|饼/.test(foodName)) {
      kcalPer100g = 130;
      category = 'staple';
    } else if (/鸡|鸭|鱼|肉|虾|蛋/.test(foodName)) {
      kcalPer100g = 160;
      category = 'meat';
    } else if (/奶|咖啡|茶|汁/.test(foodName)) {
      kcalPer100g = 50;
      category = 'drink';
    }

    return {
      name: foodName,
      kcalPer100g,
      category,
      tip: `⚠️ AI不可用，已使用粗略估算`,
      servings: [
        { label: '小份(约200g)', grams: 200 },
        { label: '中份(约300g)', grams: 300 },
        { label: '大份(约400g)', grams: 400 },
      ],
      confidence: 'low' as const,
    };
  }
}
