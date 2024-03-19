import path from 'path';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import dotenv from 'dotenv';
import { logger } from '@/utils/logger.js';
dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID;

const scriptDirPath = path.dirname(new URL(import.meta.url).pathname);

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'APAC',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ''
  },
  endpoint: process.env.AWS_ENDPOINT_URL ?? ''
});

async function init (): Promise<void> {
  logger.info('Executing script.js');

  const outDirPath = path.join(scriptDirPath, 'output');

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  if (p.stdout != null) {
    p.stdout.on('data', function (data) {
      logger.info(data.toString());
    });

    p.stdout.on('error', function (data) {
      logger.info('Error', data.toString());
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  p.on('close', async function () {
    logger.info('Build Completed successfully');
    const distFolderPath = path.join(scriptDirPath, 'output', 'dist');
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true
    });

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file as string);
      if (fs.lstatSync(filePath).isDirectory()) continue;

      logger.info('uploading', filePath);

      const command = new PutObjectCommand({
        Bucket: process.env.VERCEL_BUCKET_NAME,
        Key: `__outputs/${PROJECT_ID}/${file as string}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath).toString()
      });

      await s3Client.send(command);

      logger.info('uploaded', filePath);
    }
  });

  logger.info('Done ...');
}

await init();