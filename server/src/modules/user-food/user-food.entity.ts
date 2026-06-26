import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_foods')
export class UserFood {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  category: string; // staple | meat | vegetable | fruit | drink | snack | dish

  @Column({ type: 'real' })
  kcalPer100g: number;

  @Column({ nullable: true })
  tip: string;

  @Column({ nullable: true })
  servings: string; // JSON: [{label, grams}]

  @Column({ default: 'user' })
  source: string; // user(手动添加) | ai(AI估算)

  @Column({ default: 0 })
  useCount: number; // 使用次数（排序用）

  @CreateDateColumn()
  createdAt: Date;
}
