import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { templates } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { BUILT_IN_TEMPLATES } from './templates.data';

@Injectable()
export class TemplatesSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplatesSeeder.name);

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async onApplicationBootstrap() {
    this.logger.log('Syncing built-in templates…');
    let inserted = 0;
    let updated = 0;

    for (const tpl of BUILT_IN_TEMPLATES) {
      const existing = await this.db
        .select({ id: templates.id })
        .from(templates)
        .where(eq(templates.name, tpl.name))
        .limit(1);

      if (existing.length > 0) {
        // Always sync source/prerequisites/featured/definition so that a
        // previously-inserted row that got the wrong source default is corrected.
        await this.db
          .update(templates)
          .set({
            source: 'internal',
            description: tpl.description,
            category: tpl.category,
            featured: tpl.featured,
            prerequisites: tpl.prerequisites ?? null,
            definition: tpl.definition as any,
          })
          .where(eq(templates.id, existing[0]!.id));
        updated++;
        continue;
      }

      await this.db.insert(templates).values({
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        featured: tpl.featured,
        source: 'internal',
        prerequisites: tpl.prerequisites ?? null,
        definition: tpl.definition as any,
        downloads: 0,
      });

      inserted++;
    }

    if (inserted > 0 || updated > 0) {
      this.logger.log(
        `Built-in templates: ${inserted} inserted, ${updated} updated`,
      );
    }
  }
}
