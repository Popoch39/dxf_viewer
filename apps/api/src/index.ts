import { app } from "./app";
import { env } from "./env";

app.listen(env.port);

console.info(`API listening on http://localhost:${env.port} (docs: /openapi)`);
