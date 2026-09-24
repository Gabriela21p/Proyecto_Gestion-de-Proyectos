import { MongoClient } from 'mongodb';
import { config } from '../config.js';

let client;
let database;

// Mongo guarda el feed flexible; los índices se aseguran al conectar para que una
// base recién restaurada se comporte igual que la usada durante el desarrollo.
export async function initMongo() {
  client = new MongoClient(config.mongoUrl);
  await client.connect();
  database = client.db();
  await database.collection('feed_posts').createIndex({ createdAt: -1 });
  await database.collection('feed_posts').createIndex({ siteId: 1, createdAt: -1 });
  return database;
}

export function mongoDb() {
  if (!database) throw new Error('MongoDB no inicializado');
  return database;
}

export async function closeMongo() {
  if (client) await client.close();
}
