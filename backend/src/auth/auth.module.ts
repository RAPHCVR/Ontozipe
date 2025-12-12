import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AdminUsersController } from "./admin.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
	imports: [
		PassportModule.register({ defaultStrategy: "jwt" }),
		HttpModule,
		NotificationsModule,
	],
	providers: [AuthService, JwtStrategy],
	controllers: [AuthController, AdminUsersController],
	exports: [PassportModule, AuthService],
})
export class AuthModule {}
