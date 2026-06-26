import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Food } from './food.entity';

@Injectable()
export class FoodService implements OnModuleInit {
  constructor(
    @InjectRepository(Food)
    private foodRepo: Repository<Food>,
  ) {}

  // 应用启动时，检查是否需要初始化食物库
  async onModuleInit() {
    const count = await this.foodRepo.count();
    if (count === 0) {
      await this.seedFoodDatabase();
    }
  }

  // 搜索食物（支持名称、拼音、拼音首字母）
  async search(keyword: string) {
    const results = await this.foodRepo
      .createQueryBuilder('food')
      .where('food.name LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('food.pinyin LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('food.pinyinInitial LIKE :keyword', { keyword: `%${keyword}%` })
      .limit(20)
      .getMany();

    return results.map(f => ({
      ...f,
      servings: f.servings ? JSON.parse(f.servings) : null,
    }));
  }

  // 模糊搜索（当精确搜索无结果时，推荐相似食物）
  async fuzzySearch(keyword: string) {
    // 提取关键字中的食材关键词进行分词匹配
    const chars = keyword.split('');
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    // 按单字匹配
    chars.forEach((char, i) => {
      if (char.trim()) {
        conditions.push(`food.name LIKE :char${i}`);
        params[`char${i}`] = `%${char}%`;
      }
    });

    if (conditions.length === 0) return [];

    // 至少匹配一个字
    const results = await this.foodRepo
      .createQueryBuilder('food')
      .where(conditions.join(' OR '), params)
      .limit(6)
      .getMany();

    return results.map(f => ({
      ...f,
      servings: f.servings ? JSON.parse(f.servings) : null,
    }));
  }

  // 按分类获取食物
  async getByCategory(category: string) {
    const results = await this.foodRepo.find({
      where: { category },
      order: { name: 'ASC' },
    });

    return results.map(f => ({
      ...f,
      servings: f.servings ? JSON.parse(f.servings) : null,
    }));
  }

  // 初始化食物数据库
  private async seedFoodDatabase() {
    const foods: Partial<Food>[] = [
      // === 主食 ===
      { name: '米饭', category: 'staple', kcalPer100g: 116, pinyin: 'mifan', pinyinInitial: 'mf', tip: '一碗约200g≈232大卡', servings: JSON.stringify([{label:'半碗(100g)',grams:100},{label:'一碗(200g)',grams:200},{label:'一碗半(300g)',grams:300}]) },
      { name: '面条(煮)', category: 'staple', kcalPer100g: 110, pinyin: 'miantiao', pinyinInitial: 'mt', tip: '一碗约250g≈275大卡', servings: JSON.stringify([{label:'一碗(250g)',grams:250},{label:'半碗(125g)',grams:125}]) },
      { name: '馒头', category: 'staple', kcalPer100g: 223, pinyin: 'mantou', pinyinInitial: 'mt', tip: '一个约100g', servings: JSON.stringify([{label:'1个(100g)',grams:100},{label:'半个(50g)',grams:50}]) },
      { name: '全麦面包', category: 'staple', kcalPer100g: 246, pinyin: 'quanmaimianbao', pinyinInitial: 'qmmb', tip: '一片约35g≈86大卡', servings: JSON.stringify([{label:'1片(35g)',grams:35},{label:'2片(70g)',grams:70}]) },
      { name: '白面包', category: 'staple', kcalPer100g: 265, pinyin: 'baimianbao', pinyinInitial: 'bmb', servings: JSON.stringify([{label:'1片(35g)',grams:35},{label:'2片(70g)',grams:70}]) },
      { name: '红薯', category: 'staple', kcalPer100g: 86, pinyin: 'hongshu', pinyinInitial: 'hs', tip: '一个中等约200g', servings: JSON.stringify([{label:'1个(200g)',grams:200},{label:'半个(100g)',grams:100}]) },
      { name: '玉米', category: 'staple', kcalPer100g: 112, pinyin: 'yumi', pinyinInitial: 'ym', tip: '一根可食用部分约200g', servings: JSON.stringify([{label:'1根(200g)',grams:200},{label:'半根(100g)',grams:100}]) },
      { name: '燕麦片', category: 'staple', kcalPer100g: 377, pinyin: 'yanmaipian', pinyinInitial: 'ymp', tip: '一份约40g≈150大卡', servings: JSON.stringify([{label:'1份(40g)',grams:40},{label:'2份(80g)',grams:80}]) },
      { name: '粥(白粥)', category: 'staple', kcalPer100g: 46, pinyin: 'zhou', pinyinInitial: 'z', tip: '一碗约300g≈138大卡', servings: JSON.stringify([{label:'一碗(300g)',grams:300},{label:'半碗(150g)',grams:150}]) },
      { name: '饺子', category: 'staple', kcalPer100g: 185, pinyin: 'jiaozi', pinyinInitial: 'jz', tip: '一个约25g', servings: JSON.stringify([{label:'5个(125g)',grams:125},{label:'10个(250g)',grams:250},{label:'15个(375g)',grams:375}]) },
      { name: '包子(肉)', category: 'staple', kcalPer100g: 227, pinyin: 'baozi', pinyinInitial: 'bz', tip: '一个约80g', servings: JSON.stringify([{label:'1个(80g)',grams:80},{label:'2个(160g)',grams:160}]) },
      { name: '油条', category: 'staple', kcalPer100g: 386, pinyin: 'youtiao', pinyinInitial: 'yt', tip: '一根约80g', tags: '高脂', servings: JSON.stringify([{label:'1根(80g)',grams:80},{label:'半根(40g)',grams:40}]) },

      // === 肉蛋 ===
      { name: '鸡胸肉', category: 'meat', kcalPer100g: 133, pinyin: 'jixiongrou', pinyinInitial: 'jxr', tip: '一块约150g', servings: JSON.stringify([{label:'1块(150g)',grams:150},{label:'半块(75g)',grams:75}]) },
      { name: '鸡蛋(煮)', category: 'meat', kcalPer100g: 144, pinyin: 'jidan', pinyinInitial: 'jd', tip: '一个约50g≈72大卡', servings: JSON.stringify([{label:'1个(50g)',grams:50},{label:'2个(100g)',grams:100}]) },
      { name: '牛肉(瘦)', category: 'meat', kcalPer100g: 106, pinyin: 'niurou', pinyinInitial: 'nr', servings: JSON.stringify([{label:'一份(100g)',grams:100},{label:'半份(50g)',grams:50}]) },
      { name: '猪肉(瘦)', category: 'meat', kcalPer100g: 143, pinyin: 'zhurou', pinyinInitial: 'zr', servings: JSON.stringify([{label:'一份(100g)',grams:100}]) },
      { name: '猪肉(五花)', category: 'meat', kcalPer100g: 349, pinyin: 'zhurouwuhua', pinyinInitial: 'zrwh', tags: '高脂', servings: JSON.stringify([{label:'一份(100g)',grams:100},{label:'半份(50g)',grams:50}]) },
      { name: '三文鱼', category: 'meat', kcalPer100g: 139, pinyin: 'sanwenyu', pinyinInitial: 'swy', servings: JSON.stringify([{label:'一块(100g)',grams:100},{label:'一份刺身(80g)',grams:80}]) },
      { name: '虾仁', category: 'meat', kcalPer100g: 48, pinyin: 'xiaren', pinyinInitial: 'xr', servings: JSON.stringify([{label:'一份(100g)',grams:100}]) },
      { name: '鸡腿', category: 'meat', kcalPer100g: 181, pinyin: 'jitui', pinyinInitial: 'jt', tip: '一个约100g可食用', servings: JSON.stringify([{label:'1个(100g)',grams:100},{label:'2个(200g)',grams:200}]) },
      { name: '鸭肉', category: 'meat', kcalPer100g: 240, pinyin: 'yarou', pinyinInitial: 'yr', servings: JSON.stringify([{label:'一份(100g)',grams:100}]) },
      { name: '豆腐', category: 'meat', kcalPer100g: 81, pinyin: 'doufu', pinyinInitial: 'df', servings: JSON.stringify([{label:'一块(150g)',grams:150},{label:'半块(75g)',grams:75}]) },

      // === 蔬菜 ===
      { name: '黄瓜', category: 'vegetable', kcalPer100g: 16, pinyin: 'huanggua', pinyinInitial: 'hg', tip: '一根约200g', servings: JSON.stringify([{label:'1根(200g)',grams:200},{label:'半根(100g)',grams:100}]) },
      { name: '西红柿', category: 'vegetable', kcalPer100g: 20, pinyin: 'xihongshi', pinyinInitial: 'xhs', tip: '一个约150g', servings: JSON.stringify([{label:'1个(150g)',grams:150}]) },
      { name: '生菜', category: 'vegetable', kcalPer100g: 13, pinyin: 'shengcai', pinyinInitial: 'sc', servings: JSON.stringify([{label:'一份(100g)',grams:100}]) },
      { name: '西兰花', category: 'vegetable', kcalPer100g: 36, pinyin: 'xilanhua', pinyinInitial: 'xlh', servings: JSON.stringify([{label:'一份(150g)',grams:150},{label:'半份(75g)',grams:75}]) },
      { name: '菠菜', category: 'vegetable', kcalPer100g: 28, pinyin: 'bocai', pinyinInitial: 'bc', servings: JSON.stringify([{label:'一份(100g)',grams:100}]) },
      { name: '胡萝卜', category: 'vegetable', kcalPer100g: 32, pinyin: 'huluobo', pinyinInitial: 'hlb', servings: JSON.stringify([{label:'1根(150g)',grams:150}]) },
      { name: '土豆', category: 'vegetable', kcalPer100g: 81, pinyin: 'tudou', pinyinInitial: 'td', tip: '一个中等约200g', servings: JSON.stringify([{label:'1个(200g)',grams:200},{label:'半个(100g)',grams:100}]) },
      { name: '白菜', category: 'vegetable', kcalPer100g: 20, pinyin: 'baicai', pinyinInitial: 'bc', servings: JSON.stringify([{label:'一份(150g)',grams:150}]) },
      { name: '茄子', category: 'vegetable', kcalPer100g: 23, pinyin: 'qiezi', pinyinInitial: 'qz', servings: JSON.stringify([{label:'一份(150g)',grams:150}]) },

      // === 水果 ===
      { name: '苹果', category: 'fruit', kcalPer100g: 52, pinyin: 'pingguo', pinyinInitial: 'pg', tip: '一个中等约200g≈104大卡', servings: JSON.stringify([{label:'1个(200g)',grams:200},{label:'半个(100g)',grams:100}]) },
      { name: '香蕉', category: 'fruit', kcalPer100g: 89, pinyin: 'xiangjiao', pinyinInitial: 'xj', tip: '一根可食用部分约100g', servings: JSON.stringify([{label:'1根(100g)',grams:100},{label:'2根(200g)',grams:200}]) },
      { name: '橙子', category: 'fruit', kcalPer100g: 47, pinyin: 'chengzi', pinyinInitial: 'cz', tip: '一个约200g可食用约150g', servings: JSON.stringify([{label:'1个(150g)',grams:150}]) },
      { name: '葡萄', category: 'fruit', kcalPer100g: 67, pinyin: 'putao', pinyinInitial: 'pt', servings: JSON.stringify([{label:'一小串(100g)',grams:100},{label:'一大串(200g)',grams:200}]) },
      { name: '西瓜', category: 'fruit', kcalPer100g: 31, pinyin: 'xigua', pinyinInitial: 'xg', tip: '一块约200g', servings: JSON.stringify([{label:'1块(200g)',grams:200},{label:'2块(400g)',grams:400}]) },
      { name: '杏子', category: 'fruit', kcalPer100g: 48, pinyin: 'xingzi', pinyinInitial: 'xz', tip: '一个中等约55g≈26大卡', servings: JSON.stringify([{label:'1个(55g)',grams:55},{label:'2个(110g)',grams:110},{label:'3个(165g)',grams:165}]) },
      { name: '桃子', category: 'fruit', kcalPer100g: 41, pinyin: 'taozi', pinyinInitial: 'tz', tip: '一个约200g', servings: JSON.stringify([{label:'1个(200g)',grams:200},{label:'半个(100g)',grams:100}]) },
      { name: '草莓', category: 'fruit', kcalPer100g: 32, pinyin: 'caomei', pinyinInitial: 'cm', servings: JSON.stringify([{label:'5个(100g)',grams:100},{label:'10个(200g)',grams:200}]) },
      { name: '猕猴桃', category: 'fruit', kcalPer100g: 56, pinyin: 'mihoutao', pinyinInitial: 'mht', tip: '一个约80g', servings: JSON.stringify([{label:'1个(80g)',grams:80},{label:'2个(160g)',grams:160}]) },
      { name: '芒果', category: 'fruit', kcalPer100g: 65, pinyin: 'mangguo', pinyinInitial: 'mg', tip: '一个可食用约150g', servings: JSON.stringify([{label:'1个(150g)',grams:150}]) },
      { name: '榴莲', category: 'fruit', kcalPer100g: 147, pinyin: 'liulian', pinyinInitial: 'll', tags: '高热量', servings: JSON.stringify([{label:'一块(100g)',grams:100},{label:'两块(200g)',grams:200}]) },

      // === 饮品 ===
      { name: '牛奶(全脂)', category: 'drink', kcalPer100g: 65, pinyin: 'niunai', pinyinInitial: 'nn', tip: '一盒约250ml', servings: JSON.stringify([{label:'1盒(250ml)',grams:250},{label:'半盒(125ml)',grams:125}]) },
      { name: '牛奶(脱脂)', category: 'drink', kcalPer100g: 35, pinyin: 'niunaituozhi', pinyinInitial: 'nntz', servings: JSON.stringify([{label:'1盒(250ml)',grams:250}]) },
      { name: '酸奶(原味)', category: 'drink', kcalPer100g: 72, pinyin: 'suannai', pinyinInitial: 'sn', servings: JSON.stringify([{label:'1杯(200g)',grams:200},{label:'1小杯(100g)',grams:100}]) },
      { name: '可乐', category: 'drink', kcalPer100g: 43, pinyin: 'kele', pinyinInitial: 'kl', tip: '一罐330ml≈142大卡', servings: JSON.stringify([{label:'1罐(330ml)',grams:330},{label:'1瓶(500ml)',grams:500}]) },
      { name: '豆浆(无糖)', category: 'drink', kcalPer100g: 31, pinyin: 'doujiang', pinyinInitial: 'dj', servings: JSON.stringify([{label:'1杯(300ml)',grams:300}]) },
      { name: '美式咖啡', category: 'drink', kcalPer100g: 2, pinyin: 'meishikafei', pinyinInitial: 'mskf', tip: '一杯约350ml≈7大卡', servings: JSON.stringify([{label:'1杯(350ml)',grams:350}]) },
      { name: '拿铁', category: 'drink', kcalPer100g: 40, pinyin: 'natie', pinyinInitial: 'nt', tip: '一杯约350ml≈140大卡', servings: JSON.stringify([{label:'1杯(350ml)',grams:350}]) },
      { name: '奶茶', category: 'drink', kcalPer100g: 52, pinyin: 'naicha', pinyinInitial: 'nc', tip: '一杯约500ml≈260大卡', tags: '高糖', servings: JSON.stringify([{label:'中杯(500ml)',grams:500},{label:'大杯(700ml)',grams:700}]) },
      { name: '橙汁', category: 'drink', kcalPer100g: 45, pinyin: 'chengzhi', pinyinInitial: 'cz', servings: JSON.stringify([{label:'1杯(250ml)',grams:250}]) },

      // === 零食 ===
      { name: '薯片', category: 'snack', kcalPer100g: 547, pinyin: 'shupian', pinyinInitial: 'sp', tags: '高脂,高热量', servings: JSON.stringify([{label:'小袋(45g)',grams:45},{label:'大袋(100g)',grams:100}]) },
      { name: '巧克力', category: 'snack', kcalPer100g: 544, pinyin: 'qiaokeli', pinyinInitial: 'qkl', tags: '高热量', servings: JSON.stringify([{label:'一小块(25g)',grams:25},{label:'一排(50g)',grams:50}]) },
      { name: '饼干(苏打)', category: 'snack', kcalPer100g: 408, pinyin: 'binggan', pinyinInitial: 'bg', servings: JSON.stringify([{label:'3片(30g)',grams:30},{label:'一包(100g)',grams:100}]) },
      { name: '曲奇饼干', category: 'snack', kcalPer100g: 502, pinyin: 'quqibinggan', pinyinInitial: 'qqbg', tags: '糖油混合物,高热量', servings: JSON.stringify([{label:'2块(30g)',grams:30},{label:'5块(75g)',grams:75}]) },
      { name: '蛋糕(奶油)', category: 'snack', kcalPer100g: 348, pinyin: 'dangao', pinyinInitial: 'dg', tags: '糖油混合物', servings: JSON.stringify([{label:'1块(80g)',grams:80},{label:'1小块(50g)',grams:50}]) },
      { name: '冰淇淋', category: 'snack', kcalPer100g: 207, pinyin: 'bingqilin', pinyinInitial: 'bql', servings: JSON.stringify([{label:'1个球(80g)',grams:80},{label:'1杯(150g)',grams:150}]) },
      { name: '核桃', category: 'snack', kcalPer100g: 654, pinyin: 'hetao', pinyinInitial: 'ht', tags: '高脂', tip: '一个约5g仁', servings: JSON.stringify([{label:'3个(15g仁)',grams:15},{label:'一把(30g)',grams:30}]) },
      { name: '花生', category: 'snack', kcalPer100g: 563, pinyin: 'huasheng', pinyinInitial: 'hs', tags: '高脂', servings: JSON.stringify([{label:'一小把(20g)',grams:20},{label:'一把(40g)',grams:40}]) },
      { name: '瓜子', category: 'snack', kcalPer100g: 578, pinyin: 'guazi', pinyinInitial: 'gz', tags: '高脂', tip: '一小包仁约50g', servings: JSON.stringify([{label:'一小把(25g仁)',grams:25},{label:'一把(50g仁)',grams:50}]) },
      { name: '可颂/牛角包', category: 'snack', kcalPer100g: 406, pinyin: 'kesong', pinyinInitial: 'ks', tags: '糖油混合物', servings: JSON.stringify([{label:'1个(60g)',grams:60}]) },
    ];

    await this.foodRepo.save(foods);
    console.log(`✅ 初始化食物库完成，共 ${foods.length} 条数据`);
  }
}
