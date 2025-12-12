import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";

import { IndividualsController } from "./individuals/individuals.controller";
import { IndividualsService } from "./individuals/individuals.service";
import { GroupsController } from "./groups/groups.controller";
import { GroupsService } from "./groups/groups.service";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationsService } from "./organizations/organizations.service";
import { CommentsController } from "./comments/comments.controller";
import { CommentsService } from "./comments/comments.service";
import { OntologiesController } from "./ontologies/ontologies.controller";
import { OntologiesService } from "./ontologies/ontologies.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
    imports: [HttpModule, NotificationsModule],
    controllers: [
        IndividualsController,
        GroupsController,
        OrganizationsController,
        CommentsController,
        OntologiesController,
    ],
    providers: [
        IndividualsService,
        GroupsService,
        OrganizationsService,
        CommentsService,
        OntologiesService,
    ],
})
export class OntologyModule {}
