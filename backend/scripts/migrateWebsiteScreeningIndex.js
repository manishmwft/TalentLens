import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import { Screening } from '../src/models/Screening.js';

const OLD_INDEX = 'organization_1_jobDescriptionRef_1_source_1';
const NEW_INDEX = 'organization_1_websiteApplication_1_source_1';

async function run() {
  await connectDatabase();

  const indexes = await Screening.collection.indexes();
  if (indexes.some((index) => index.name === OLD_INDEX)) {
    await Screening.collection.dropIndex(OLD_INDEX);
    console.log(`Dropped old website screening index: ${OLD_INDEX}`);
  } else {
    console.log('Old website screening index is already absent.');
  }

  const refreshed = await Screening.collection.indexes();
  if (!refreshed.some((index) => index.name === NEW_INDEX)) {
    await Screening.collection.createIndex(
      { organization: 1, websiteApplication: 1, source: 1 },
      {
        name: NEW_INDEX,
        unique: true,
        partialFilterExpression: {
          source: 'website',
          websiteApplication: { $type: 'objectId' },
        },
      },
    );
    console.log(`Created per-application website screening index: ${NEW_INDEX}`);
  } else {
    console.log('Per-application website screening index already exists.');
  }
}

run()
  .catch((error) => {
    console.error('Website screening index migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
