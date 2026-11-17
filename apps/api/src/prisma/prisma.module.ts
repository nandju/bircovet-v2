// Module NestJS qui rend PrismaService injectable partout dans l'API.
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global() // global : pas besoin de le ré-importer dans chaque module métier
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
