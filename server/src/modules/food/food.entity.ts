import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('foods')
export class Food {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string; // staple | meat | vegetable | fruit | drink | snack | dairy | nut

  @Column({ type: 'real' })
  kcalPer100g: number; // 每100g热量（大卡）

  @Column({ nullable: true })
  tip: string; // 提示信息，如"一个约50g≈24大卡"

  @Column({ nullable: true })
  pinyin: string; // 拼音（用于搜索）

  @Column({ nullable: true })
  pinyinInitial: string; // 拼音首字母（用于搜索）

  @Column({ nullable: true })
  tags: string; // 标签，如"高糖,高脂,糖油混合物"

  @Column({ nullable: true })
  servings: string; // 常用份量JSON, 如 [{"label":"1个(50g)","grams":50}]
}
