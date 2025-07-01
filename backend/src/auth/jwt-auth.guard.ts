import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	/**
	 * Permet de récupérer la requête dans d’autres contextes (GraphQL, WS…)
	 * À adapter si nécessaire ; pour REST le comportement par défaut suffit.
	 */
	override getRequest(context: ExecutionContext) {
		if (context.getType() === "http") {
			return context.switchToHttp().getRequest();
		}
		return super.getRequest(context);
	}
}
