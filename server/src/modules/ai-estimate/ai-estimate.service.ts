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
