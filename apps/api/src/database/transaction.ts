import type { ClientSession, Connection } from 'mongoose';

export async function withTransaction<T>(
  connection: Connection,
  work: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
