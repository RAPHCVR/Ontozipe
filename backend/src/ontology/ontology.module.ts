import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { OntologyController } from "./ontology.controller";
import { OntologyService } from "./ontology.service";

@Module({
	imports: [HttpModule],
	controllers: [OntologyController],
	providers: [OntologyService],
})
export class OntologyModule {}
