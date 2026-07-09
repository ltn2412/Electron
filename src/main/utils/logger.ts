import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import os from "os";
import path from "path";

const isWindows = os.platform() === "win32";
const logDir = isWindows ? "C:\\BTCTCT" : path.join(os.homedir(), "BTCTCT");

const errorDir = isWindows ? "C:\\BTCTCT\\errors" : path.join(os.homedir(), "BTCTCT", "errors");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.printf((info) => {
      let msg = `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`;
      if (info.query) msg += `\nQuery: ${info.query}`;
      if (info.params) msg += `\nParams: ${JSON.stringify(info.params)}`;
      if (info.body) msg += `\nBody: ${JSON.stringify(info.body)}`;
      if (info.response) msg += `\nResponse: ${JSON.stringify(info.response)}`;
      if (info.error) {
        if (typeof info.error === 'object') {
            msg += `\nError Message: ${info.error.message || info.error}`;
            if (info.error.stack) msg += `\nStack Trace: ${info.error.stack}`;
            if (info.error.odbcErrors) msg += `\nODBC Details: ${JSON.stringify(info.error.odbcErrors)}`;
        } else {
            msg += `\nError: ${info.error}`;
        }
      }
      return msg;
    }),
  ),
  transports: [
    new DailyRotateFile({
      dirname: logDir,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "7d",
    }),
    new DailyRotateFile({
      level: "error",
      dirname: errorDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
    }),
    new winston.transports.Console(),
  ],
});

export default logger;
