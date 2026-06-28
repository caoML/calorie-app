import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  openid: string;

  @Column({ nullable: true })
  gender: string; // male | female

  @Column({ nullable: true })
  age: number;

  @Column({ type: 'real', nullable: true })
  height: number; // cm

  @Column({ type: 'real', nullable: true })
  weight: number; // kg

  @Column({ default: 'light' })
  activityLevel: string; // sedentary | light | moderate | active | veryActive

  @Column({ default: 'maintain' })
  goal: string; // lose | maintain | gain

  @Column({ default: 1800 })
  dailyTarget: number; // 每日目标热量（大卡）

  @Column({ nullable: true })
  isManualTarget: boolean; // 是否手动设置预算

  // 提醒设置
  @Column({ default: false })
  reminderEnabled: boolean; // 是否开启记录提醒

  @Column({ nullable: true })
  reminderTimes: string; // JSON: ["08:00","12:00","18:00"] 提醒时间点

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
