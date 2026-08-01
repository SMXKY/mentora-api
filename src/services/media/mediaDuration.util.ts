import ffmpeg from "fluent-ffmpeg";

/** ffprobe reads a local file's technical metadata — used here to validate
 * a video's length synchronously, before it's handed off to MediaService's
 * (async, queued) transcode pipeline. */
export function probeDurationSeconds(tempFilePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(tempFilePath, (err, data) => {
      if (err) return reject(err);
      resolve(Math.round(data.format?.duration ?? 0));
    });
  });
}
