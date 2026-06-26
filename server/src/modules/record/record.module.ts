import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordController } from './record.controller';
import { RecordService } from './record.service';
import { FoodRecord } from './record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FoodRecord])],
  controllers: [RecordController],
  providers: [RecordService],
})
export class RecordModule {}
