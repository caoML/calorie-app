import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body('code') code: string) {
    const result = await this.authService.login(code);
    return { code: 0, data: result };
  }
}
