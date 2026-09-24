import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { reindexAllSites } from './sites.js';

// Las colas separan tareas secundarias de la respuesta HTTP: notificar o reindexar
// puede tardar sin hacer que la acción principal se sienta lenta para la persona.
export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const notificationsQueue = new Queue('notifications', { connection: redis });
export const searchQueue = new Queue('search-index', { connection: redis });

export function startWorkers(io) {
  new Worker(
    'notifications',
    async (job) => {
      io.emit(job.name, job.data);
      return { delivered: true };
    },
    { connection: redis }
  );

  new Worker(
    'search-index',
    async () => {
      await reindexAllSites();
      return { indexed: true };
    },
    { connection: redis }
  );
}
