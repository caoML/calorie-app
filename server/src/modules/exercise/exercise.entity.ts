import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('exercise_records')
export class ExerciseRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  date: string; // YYYY-MM-DD

  @Column()
  exerciseName: string; // 运动名称（跑步、快走、骑车等）

  @Column({ type: 'real' })
  duration: number; // 时长（分钟）

  @Column({ type: 'real' })
  kcalBurned: number; // 消耗热量（大卡）

  @Column({ nullable: true })
  icon: string; // 运动图标 emoji

  @CreateDateColumn()
  createdAt: Date;
}
