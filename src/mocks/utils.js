/**
 * Simulates network latency between 200-1200ms
 * @returns {Promise<void>}
 */
export const simulateLatency = () => {
  const latency = Math.random() * 1000 + 200; // 200-1200ms
  return new Promise((resolve) => setTimeout(resolve, latency));
};

/**
 * Simulates random write errors (5-10% chance)
 * @returns {boolean}
 */
export const shouldSimulateError = () => {
  const errorRate = Math.random() * 0.05 + 0.05; // 5-10%
  return Math.random() < errorRate;
};

/**
 * Standard error response
 * @param {string} message
 * @returns {Response}
 */
export const errorResponse = (message) => {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
};
