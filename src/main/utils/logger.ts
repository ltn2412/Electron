import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import os from "os";
import path from "path";

const isWindows = os.platform() === "win32";
const logDir = isWindows ? "C:\\BTCTCT" : path.join(os.homedir(), "BTCTCT");
const hvLogDir = isWindows ? "C:\\BTCTCT\\hoangvan" : path.join(os.homedir(), "BTCTCT", "hoangvan");

const errorDir = isWindows
  ? "C:\\BTCTCT\\errors"
  : path.join(os.homedir(), "BTCTCT", "errors");

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
      if (info.payload) msg += `\nPayload: ${JSON.stringify(info.payload)}`;
      if (info.response) msg += `\nResponse: ${JSON.stringify(info.response)}`;
      if (info.data) msg += `\nData: ${JSON.stringify(info.data)}`;
      if (info.error) {
        if (typeof info.error === "object") {
          const errObj = info.error as Error & { odbcErrors?: unknown };
          msg += `\nError Message: ${errObj.message || errObj}`;
          if (errObj.stack) msg += `\nStack Trace: ${errObj.stack}`;
          if (errObj.odbcErrors)
            msg += `\nODBC Details: ${JSON.stringify(errObj.odbcErrors)}`;
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


export const hvLogger = winston.createLogger({
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
      if (info.payload) msg += `\nPayload: ${JSON.stringify(info.payload)}`;
      if (info.response) msg += `\nResponse: ${JSON.stringify(info.response)}`;
      if (info.data) msg += `\nData: ${JSON.stringify(info.data)}`;
      if (info.error) {
        if (typeof info.error === "object") {
          const errObj = info.error as Error & { odbcErrors?: unknown };
          msg += `\nError Message: ${errObj.message || errObj}`;
          if (errObj.stack) msg += `\nStack Trace: ${errObj.stack}`;
          if (errObj.odbcErrors)
            msg += `\nODBC Details: ${JSON.stringify(errObj.odbcErrors)}`;
        } else {
          msg += `\nError: ${info.error}`;
        }
      }
      return msg;
    }),
  ),
  transports: [
    new DailyRotateFile({
      dirname: hvLogDir,
      filename: "hv-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
    }),
    new winston.transports.Console(),
  ],
});


export const hvPollLogger = winston.createLogger({
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
      if (info.payload) msg += `\nPayload: ${JSON.stringify(info.payload)}`;
      if (info.response) msg += `\nResponse: ${JSON.stringify(info.response)}`;
      if (info.data) msg += `\nData: ${JSON.stringify(info.data)}`;
      if (info.error) {
        if (typeof info.error === "object") {
          const errObj = info.error as Error & { odbcErrors?: unknown };
          msg += `\nError Message: ${errObj.message || errObj}`;
          if (errObj.stack) msg += `\nStack Trace: ${errObj.stack}`;
          if (errObj.odbcErrors)
            msg += `\nODBC Details: ${JSON.stringify(errObj.odbcErrors)}`;
        } else {
          msg += `\nError: ${info.error}`;
        }
      }
      return msg;
    }),
  ),
  transports: [
    new DailyRotateFile({
      dirname: hvLogDir,
      filename: "hv-poll-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d", // Less retention for high-frequency logs
    }),
    new winston.transports.Console(),
  ],
});

export default logger;
