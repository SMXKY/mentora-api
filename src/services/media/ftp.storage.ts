import Client from "ftp";
import fs from "fs";
import path from "path";
import { StorageAdapter } from "./storage.adapter";

interface FtpConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  remoteDir: string;
  remoteUrlBase: string;
}

function loadConfig(): FtpConfig {
  const required = [
    "FTP_USER",
    "FTP_PASSWORD",
    "FTP_HOST",
    "FTP_PORT",
    "FTP_UPLOAD_DIR",
    "FTP_BASE_URL",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Invalid FTP server configuration: missing ${key}`);
    }
  }
  return {
    user: process.env.FTP_USER!,
    password: process.env.FTP_PASSWORD!,
    host: process.env.FTP_HOST!,
    port: Number(process.env.FTP_PORT),
    remoteDir: process.env.FTP_UPLOAD_DIR!,
    remoteUrlBase: process.env.FTP_BASE_URL!,
  };
}

function buildRemotePath(remoteDir: string, relativePath: string): string {
  if (remoteDir === "./" || remoteDir === "." || remoteDir === "") {
    return relativePath;
  }
  return path.posix.join(remoteDir, relativePath);
}

function ensureRemoteDir(client: Client, dir: string): Promise<void> {
  const parts = dir
    .split("/")
    .filter(Boolean)
    .filter((p) => p !== ".");
  if (parts.length === 0) return Promise.resolve();

  return parts.reduce((promise: Promise<void>, _part, idx) => {
    const segment = parts.slice(0, idx + 1).join("/");
    return promise.then(
      () =>
        new Promise<void>((resolve, reject) => {
          client.list(segment, (err: any) => {
            if (err) {
              client.mkdir(segment, true, (mkErr: any) => {
                if (mkErr) return reject(mkErr);
                resolve();
              });
            } else {
              resolve();
            }
          });
        })
    );
  }, Promise.resolve());
}

function withConnection<T>(
  config: FtpConfig,
  work: (client: Client) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = new Client();

    client.on("error", (err: any) => reject(err));

    client.on("ready", () => {
      work(client)
        .then((result) => {
          client.end();
          resolve(result);
        })
        .catch((err) => {
          client.end();
          reject(err);
        });
    });

    client.connect({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
    });
  });
}

export class FtpStorageAdapter implements StorageAdapter {
  private config: FtpConfig;

  constructor() {
    this.config = loadConfig();
  }

  async put(tempFilePath: string, relativePath: string): Promise<void> {
    const remotePath = buildRemotePath(this.config.remoteDir, relativePath);
    const remoteFolder = path.posix.dirname(remotePath);

    await withConnection(this.config, async (client) => {
      await ensureRemoteDir(client, remoteFolder);
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(tempFilePath);
        readStream.on("error", reject);
        client.put(readStream, remotePath, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
      await new Promise<void>((resolve) => {
        client.site(`CHMOD 644 ${remotePath}`, () => resolve());
      });
    });
  }

  async remove(relativePath: string): Promise<void> {
    const remotePath = buildRemotePath(this.config.remoteDir, relativePath);
    try {
      await withConnection(this.config, (client) => {
        return new Promise<void>((resolve) => {
          client.delete(remotePath, () => resolve()); // non-fatal either way
        });
      });
    } catch {
      // Swallow — deletion failures on the remote side shouldn't block app flow.
    }
  }

  resolveUrl(relativePath: string): string {
    const cleanPath = relativePath.replace(/^\/+/, "");
    return `${this.config.remoteUrlBase.replace(/\/+$/, "")}/${cleanPath}`;
  }

  async fetchToTemp(relativePath: string, destTempPath: string): Promise<void> {
    const remotePath = buildRemotePath(this.config.remoteDir, relativePath);
    fs.mkdirSync(path.dirname(destTempPath), { recursive: true });

    await withConnection(this.config, async (client) => {
      await new Promise<void>((resolve, reject) => {
        client.get(remotePath, (err: any, stream: any) => {
          if (err) return reject(err);
          const writeStream = fs.createWriteStream(destTempPath);
          stream.on("error", reject);
          writeStream.on("error", reject);
          writeStream.on("close", resolve);
          stream.pipe(writeStream);
        });
      });
    });
  }
}
