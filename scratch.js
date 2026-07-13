const fs = require("fs");
let content = fs.readFileSync("src/main/index.ts", "utf8");

if (!content.includes('import logger from "@/main/utils/logger";')) {
  content = content.replace(
    'import { OrderService } from "@/main/services/OrderService";',
    'import { OrderService } from "@/main/services/OrderService";\nimport logger from "@/main/utils/logger";'
  );
}

const targetCatch = `      } catch (error: unknown) {
        const err = error as Error;
        return { success: false, error: err.message };
      }`;

const replaceCatch = `      } catch (error: any) {
        const errStr = error.message + (error.odbcErrors ? ' | ODBC Errors: ' + JSON.stringify(error.odbcErrors) : '');
        logger.error(\`IPC Handler Error: \${errStr || JSON.stringify(error)}\`, { error });
        return { success: false, error: errStr || JSON.stringify(error) };
      }`;

content = content.split(targetCatch).join(replaceCatch);

const targetCatch2 = `      } catch (error: any) {
        const errStr = error.message + (error.odbcErrors ? ' | ODBC Errors: ' + JSON.stringify(error.odbcErrors) : '');
        return { success: false, error: errStr || JSON.stringify(error) };
      }`;

const replaceCatch2 = `      } catch (error: any) {
        const errStr = error.message + (error.odbcErrors ? ' | ODBC Errors: ' + JSON.stringify(error.odbcErrors) : '');
        logger.error(\`IPC Handler Error: \${errStr || JSON.stringify(error)}\`, { error });
        return { success: false, error: errStr || JSON.stringify(error) };
      }`;

content = content.split(targetCatch2).join(replaceCatch2);

const targetCatch3 = `    } catch (error: any) {
      const errStr = error.message + (error.odbcErrors ? ' | ODBC Errors: ' + JSON.stringify(error.odbcErrors) : '');
      return { success: false, error: errStr || JSON.stringify(error) };
    }`;

const replaceCatch3 = `    } catch (error: any) {
      const errStr = error.message + (error.odbcErrors ? ' | ODBC Errors: ' + JSON.stringify(error.odbcErrors) : '');
      logger.error(\`IPC Handler Error: \${errStr || JSON.stringify(error)}\`, { error });
      return { success: false, error: errStr || JSON.stringify(error) };
    }`;

content = content.split(targetCatch3).join(replaceCatch3);

fs.writeFileSync("src/main/index.ts", content);
