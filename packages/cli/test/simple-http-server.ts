import http from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import handler from "serve-handler";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function launchServer(port: number, rootDir = join(__dirname, "playground")): Promise<http.Server> {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            return handler(req, res, { public: rootDir });
        });
        server.once("error", reject);
        server.listen(port, () => resolve(server));
    });
}
