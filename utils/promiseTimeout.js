const createTimeoutError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const withTimeout = (operation, timeoutMs, options = {}) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.resolve(operation);
  }

  const { code = "OPERATION_TIMEOUT", message = "Operation timed out.", onTimeout } = options;
  let timeoutHandle;

  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        // Timeout cleanup is best effort and must not hide the timeout error.
      }
      reject(createTimeoutError(code, message));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(operation), timeout]).finally(() => {
    clearTimeout(timeoutHandle);
  });
};

module.exports = { withTimeout };