import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { IUserProfilePort } from '@domain/ports/user-profile.port';
import { firstValueFrom, Observable } from 'rxjs';

interface UserProfileGrpcServiceClient {
  createProfile(data: { accountId: string; email: string; name: string }): Observable<ProfileGrpcResponse>;
}

interface ProfileGrpcResponse {
  id: string;
  accountId: string;
  email: string;
  name: string;
}

@Injectable()
export class UserProfileGrpcAdapter implements IUserProfilePort, OnModuleInit {
  private userProfileServiceClient!: UserProfileGrpcServiceClient;

  constructor(@Inject('USER_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.userProfileServiceClient = this.client.getService<UserProfileGrpcServiceClient>('ProfileService');
  }

  async createProfile(accountId: string, email: string, name: string): Promise<{ id: string; name: string }> {
    const response = await firstValueFrom(
      this.userProfileServiceClient.createProfile({ accountId, email, name }),
    );
    return {
      id: response.id,
      name: response.name,
    };
  }
}
