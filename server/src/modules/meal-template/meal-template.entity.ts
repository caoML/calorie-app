import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('meal_templates')
export class MealTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  name: string; // 模板名称，如 "工作日午餐"、"早餐标配"

  @Column({ default: '🍱' })
  icon: string;

  @Column({ default: 'lunch' })
  defaultMeal: string; // 默认餐次 breakfast|lunch|dinner|snack

  @Column({ type: 'text' })
  items: string; // JSON字符串，食物列表 [{foodName, foodId, amount, unit, kcal}]

  @Column({ type: 'real', default: 0 })
  totalKcal: number; // 总热量（冗余字段，方便展示）

  @Column({ default: 0 })
  useCount: number; // 使用次数

  @CreateDateColumn()
  createdAt: Date;
}
