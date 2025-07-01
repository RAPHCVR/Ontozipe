import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
	imports: [PassportModule.register({ defaultStrategy: "jwt" }), HttpModule],
	providers: [AuthService, JwtStrategy],
	controllers: [AuthController],
	exports: [PassportModule, AuthService],
})
export class AuthModule {}
