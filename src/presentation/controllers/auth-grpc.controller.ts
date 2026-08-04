import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from '@application/services/auth.service';

@Controller()
export class AuthGrpcController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'VerifyToken')
  async verifyToken(data: { token: string }) {
    return this.authService.verifyToken(data.token);
  }
}
