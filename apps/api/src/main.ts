import 'reflect-metadata';

async function bootstrap() {
  return {
    name: 'customreport-api',
    status: 'bootstrapped',
  } as const;
}

void bootstrap();
