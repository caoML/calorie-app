import { Injectable } from '@nestjs/common';

@Injectable()
export class AiEstimateService {
  // 多食物解析：用户输入一句话，AI 解析出所有食物及热量
  async parseMultiFoods(text: string): Promise<{
    foods: {
      name: string;
      amount: number;
      unit: string;
      kcal: number;
      kcalPer100g: number;
      category: string;
    }[];
  }> {
    const prompt = `你是一个专业的营养师。请从用户的饮食描述中，识别出所有食物，并估算每种食物的份量和热量。

用户描述："${text}"

请严格按照以下JSON格式返回（不要添加任何其他文字）：
{
  "foods": [
    {
      "name": "食物名称",
      "amount": 重量(克,数字),
      "unit": "g",
      "kcal": 该份量的总热量(大卡,数字),
      "kcalPer100g": 每100克热量(大卡,数字),
      "category": "分类(staple/meat/vegetable/fruit/drink/snack/dish)"
    }
  ]
}

注意：
1. 识别出描述中所有食物，每种一条
2. 根据用户描述的份量估算克数（一碗≈200g，一盘≈250g，一杯≈350ml，一个包子≈80g，一个鸡蛋≈50g）
3. 如果用户没说份量，使用常见一份的量
4. 热量基于中国常见做法估算
5. kcal = kcalPer100g × amount / 100
6. 如果识别不出任何食物，返回 {"foods": []}`;

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
          temperature: 0.3,
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
      return {
        foods: (result.foods || []).map((f: any) => ({
          name: f.name || '未知食物',
          amount: Number(f.amount) || 200,
          unit: f.unit || 'g',
          kcal: Number(f.kcal) || Math.round((Number(f.kcalPer100g) || 100) * (Number(f.amount) || 200) / 100),
          kcalPer100g: Number(f.kcalPer100g) || 100,
          category: f.category || 'dish',
        })),
      };
    } catch (error) {
      console.error('多食物解析失败:', error.message);
      return { foods: [] };
    }
  }

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
        kcalPer100g: result.kcalPer100g != null ? Number(result.kcalPer100g) : 150,
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

  // ====== 语音录音识别 + 解析（一站式） ======
  async recognizeAndParse(audioBuffer: Buffer, filename: string): Promise<{
    text: string;
    foods: {
      name: string;
      amount: number;
      unit: string;
      kcal: number;
      kcalPer100g: number;
      category: string;
    }[];
    summary: string;
  }> {
    const apiKey = process.env.AI_API_KEY || '';
    const apiUrl = process.env.AI_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const voiceModel = process.env.AI_VOICE_MODEL || process.env.AI_MODEL || 'glm-4-plus';

    // 将音频转为 base64
    const audioBase64 = audioBuffer.toString('base64');
    const ext = filename.split('.').pop() || 'mp3';

    // 尝试使用支持音频输入的模型做一站式处理（语音识别+食物解析）
    const prompt = `请完成以下两步任务：
1. 先将这段语音内容转为文字
2. 然后从文字中识别出所有食物及其份量和热量

请严格按照以下JSON格式返回（不要添加任何其他文字）：
{
  "text": "语音转写的文字内容",
  "foods": [
    {
      "name": "食物名称",
      "amount": 重量(克,数字),
      "unit": "g",
      "kcal": 该份量的热量(大卡,数字),
      "kcalPer100g": 每100克热量(大卡,数字),
      "category": "分类(staple/meat/vegetable/fruit/drink/snack/dish)"
    }
  ],
  "summary": "一句话总结，如：共2种食物，约650大卡"
}

注意：
- 份量参考：一碗米饭约200g、一盘菜约200-250g、一杯奶茶约350ml、一个苹果约200g
- 如果没说份量就使用常见的一份量
- 热量基于中国常见做法估算`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: voiceModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'audio',
                  audio: {
                    data: audioBase64,
                    format: ext,
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            text: result.text || '',
            foods: (result.foods || []).map((f: any) => ({
              name: f.name || '未知食物',
              amount: Number(f.amount) || 200,
              unit: f.unit || 'g',
              kcal: Number(f.kcal) || 150,
              kcalPer100g: Number(f.kcalPer100g) || 100,
              category: f.category || 'dish',
            })),
            summary: result.summary || '解析完成',
          };
        }
      }

      // 如果多模态模型不支持音频，降级用语音识别API再调文本解析
      console.log('多模态音频模型不可用，尝试降级方案...');
      return await this.fallbackRecognizeAndParse(audioBuffer, ext);
    } catch (error) {
      console.error('语音一站式识别失败:', error.message);
      return await this.fallbackRecognizeAndParse(audioBuffer, ext);
    }
  }

  // 降级方案：使用讯飞/百度等语音识别API，或直接返回提示
  private async fallbackRecognizeAndParse(audioBuffer: Buffer, ext: string): Promise<{
    text: string;
    foods: any[];
    summary: string;
  }> {
    // 尝试使用第二个语音识别服务（可配置）
    const sttUrl = process.env.STT_API_URL || '';
    const sttKey = process.env.STT_API_KEY || '';

    if (sttUrl && sttKey) {
      try {
        const audioBase64 = audioBuffer.toString('base64');
        const response = await fetch(sttUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sttKey}`,
          },
          body: JSON.stringify({
            audio: audioBase64,
            format: ext,
            language: 'zh',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.text || data.result || '';
          if (text) {
            // 拿到文字后走文本解析流程
            return {
              text,
              ...(await this.parseVoiceText(text)),
            };
          }
        }
      } catch (e) {
        console.error('STT 降级识别失败:', e.message);
      }
    }

    // 最终降级：返回失败让前端提示用户用文字输入
    return {
      text: '',
      foods: [],
      summary: '语音识别暂不可用，请点击输入文字描述',
    };
  }

  // ====== 语音文本解析 ======
  async parseVoiceText(text: string): Promise<{
    foods: {
      name: string;
      amount: number;
      unit: string;
      kcal: number;
      kcalPer100g: number;
      category: string;
    }[];
    summary: string;
  }> {
    const prompt = `你是一个专业的营养师和自然语言理解专家。请将用户的饮食描述解析为具体的食物列表和热量信息。

用户说："${text}"

请严格按照以下JSON格式返回（不要添加任何其他文字）：
{
  "foods": [
    {
      "name": "食物名称",
      "amount": 重量(克,数字),
      "unit": "g",
      "kcal": 该份量的热量(大卡,数字),
      "kcalPer100g": 每100克的热量(大卡,数字),
      "category": "分类(staple/meat/vegetable/fruit/drink/snack/dish)"
    }
  ],
  "summary": "一句话总结，如：共2种食物，约650大卡"
}

注意：
1. 尽量准确识别食物名称和份量（如"一碗米饭"→约200g，"一份红烧肉"→约150g）
2. 如果用户没有说明份量，使用常见的一份/一碗/一杯的标准量
3. 如果用户说了多种食物，全部解析出来
4. 热量估算基于中国常见做法
5. 常见份量参考：一碗米饭200g、一盘菜200-250g、一杯饮品350ml、一个水果150-200g
6. 如果用户描述的不是食物（如乱语），返回空的foods数组，summary写"未识别到食物"`;

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
          temperature: 0.3,
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

      return {
        foods: (result.foods || []).map((f: any) => ({
          name: f.name || '未知食物',
          amount: Number(f.amount) || 200,
          unit: f.unit || 'g',
          kcal: Number(f.kcal) || 150,
          kcalPer100g: Number(f.kcalPer100g) || 100,
          category: f.category || 'dish',
        })),
        summary: result.summary || '解析完成',
      };
    } catch (error) {
      console.error('语音文本解析失败:', error.message);
      return {
        foods: [],
        summary: '解析失败，请重试',
      };
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
