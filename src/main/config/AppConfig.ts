import { app } from "electron";
import fs from "fs";
import path from "path";

export interface AppConfig {
  hoangVanURL: string;
  hoangVanUser: string;
  hoangVanPass: string;
}

const DEFAULT_CONFIG: AppConfig = {
  hoangVanURL: "https://demobtctct.soatvetudong.vn/api/speedpos",
  hoangVanUser: "speedpos",
  hoangVanPass: "SpeedHoangVan",
};

export class ConfigManager {
  static getConfig(): AppConfig | null {
    try {
      const configPath = app.isPackaged
        ? path.join(path.dirname(app.getPath("exe")), "config.json")
        : path.join(process.cwd(), "config.json");

      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(
          configPath,
          JSON.stringify(DEFAULT_CONFIG, null, 2),
          "utf8",
        );
      }

      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(data);

        if (!parsed.hoangVanURL || !parsed.hoangVanUser || !parsed.hoangVanPass)
          return null;
        return parsed as AppConfig;
      } else return null;
    } catch {
      return null;
    }
  }
}
