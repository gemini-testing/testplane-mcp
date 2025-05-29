import http from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import handler from "serve-handler";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function launchServer(port = 8090, rootDir = join(__dirname, "playground")): http.Server {
    const server = http.createServer((request, response) => {
        return handler(request, response, {
            public: rootDir,
        });
    });

    server.listen(port, () => {
        console.log(`Running at http://localhost:${port}`);
    });

    return server;
}
