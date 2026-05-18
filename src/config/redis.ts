import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_URL,
});

redisClient.on("connect", () => {
    console.log("Redis Connected");
});

redisClient.on("error", (err) => {
    console.log("Redis Error:", err);
});
export const clearCache = async (prefix: string) => {
  const keys = await redisClient.keys(`${prefix}*`);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

export default redisClient;