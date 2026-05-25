import { Controller, Post, Body, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';

class RegisterDto {
  fullName!: string;
  email!: string;
  password!: string;
}

class LoginDto {
  email!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  // @Inject(AuthService) ensures NestJS uses the class as the DI token directly,
  // bypassing design:paramtypes metadata (which esbuild may emit as Object for class deps).
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.fullName, body.email, body.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }
}
