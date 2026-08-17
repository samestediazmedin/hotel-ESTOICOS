import 'dotenv/config';
import { CommandFactory } from 'nest-commander';
import { SeedModule } from '../src/seed/seed.module';

async function bootstrap() {
  await CommandFactory.run(SeedModule, { logger: ['log', 'warn', 'error'] });
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
