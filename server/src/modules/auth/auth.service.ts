import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { User } from '../user/user.entity';
import { JWT_SECRET } from '../../common/guards/auth.guard';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async login(code: string) {
    if (!code) {
      throw new UnauthorizedException('登录 code 不能为空');
    }

    const openid = await this.getOpenid(code);

    // 查找或创建用户
    let user = await this.userRepo.findOne({ where: { openid } });
    if (!user) {
      user = this.userRepo.create({ openid });
      await this.userRepo.save(user);
    }

    // 生成 token
    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      JWT_SECRET,
      { expiresIn: '30d' },
    );

    return { token, isNew: !user.age };
  }

  private async getOpenid(code: string): Promise<string> {
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;

    // 未配置微信密钥时走开发模式
    if (!appid || !secret) {
      this.logger.warn('WX_APPID 或 WX_SECRET 未配置，使用开发模式（code 直接作为 openid）');
      return `dev_${code}`;
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.errcode) {
        this.logger.error(`微信登录失败: errcode=${data.errcode}, errmsg=${data.errmsg}`);
        throw new UnauthorizedException(`微信登录失败: ${data.errmsg}`);
      }

      if (!data.openid) {
        this.logger.error('微信接口返回数据异常，缺少 openid');
        throw new UnauthorizedException('微信登录异常，请重试');
      }

      return data.openid;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`请求微信接口失败: ${error.message}`);
      throw new UnauthorizedException('微信登录服务暂时不可用，请稍后重试');
    }
  }
}
