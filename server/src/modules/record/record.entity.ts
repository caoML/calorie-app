import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('food_records')
export class FoodRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  date: string; // YYYY-MM-DD

  @Column()
  meal: string; // breakfast | lunch | dinner | snack

  @Column()
  foodName: string;

  @Column({ nullable: true })
  foodId: number;

  @Column({ type: 'real' })
  amount: number;

  @Column({ default: 'g' })
  unit: string;

  @Column({ type: 'real' })
  kcal: number; // 该次记录的热量

  @Column({ default: 1 })
  sharePeople: number; // 分食人数（默认1=自己吃）

  @Column({ default: 'equal' })
  shareRatio: string; // 分食比例: less(少一些1/3) | equal(均分) | more(多一些2/3)

  @CreateDateColumn()
  createdAt: Date;
}
