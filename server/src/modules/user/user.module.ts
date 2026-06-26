import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { FoodRecord } from '../record/record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, FoodRecord])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
