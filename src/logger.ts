type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export function logInfo(event: string, fields: LogFields = {}) {
  writeLog("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}) {
  writeLog("warn", event, fields);
}

export function logError(event: string, fields: LogFields = {}) {
  writeLog("error", event, fields);
}

function writeLog(level: LogLevel, event: string, fields: LogFields) {
  const payload = {
    time: new Date().toISOString(),
    level,
    event,
    service: "canvas",
    ...fields,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
