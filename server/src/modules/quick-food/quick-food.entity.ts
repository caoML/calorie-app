import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('quick_foods')
export class QuickFood {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  name: string; // 显示名称，如 "一碗米饭"

  @Column({ nullable: true })
  foodId: number; // 关联的食物ID

  @Column()
  foodName: string; // 食物原始名称

  @Column({ type: 'real' })
  amount: number; // 默认份量

  @Column({ default: 'g' })
  unit: string; // 份量单位

  @Column({ type: 'real' })
  kcal: number; // 该份量对应的热量

  @Column({ default: '🍚' })
  icon: string; // 显示图标

  @Column({ default: 0 })
  sortOrder: number; // 排序序号

  @Column({ default: true })
  isActive: boolean;
}
