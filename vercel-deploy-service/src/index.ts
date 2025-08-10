// import { createClient, commandOptions } from "redis";
// import { copyFinalDist, downloadS3Folder } from "./aws";
// import { buildProject } from "./utils";
// const publisher = createClient({
//   url: "redis://default:Dv6pmIkfwja9fHD15D0Y2wAznKP3kBBe@redis-18797.c99.us-east-1-4.ec2.redns.redis-cloud.com:18797",
// });
// publisher.connect();
// publisher.on("error", (err) => console.error("❌ pub error:", err));

// const subscriber = createClient({
//   url: "redis://default:Dv6pmIkfwja9fHD15D0Y2wAznKP3kBBe@redis-18797.c99.us-east-1-4.ec2.redns.redis-cloud.com:18797",
// });
// subscriber.connect();
// subscriber.on("error", (err) => console.error("❌ sub error:", err));

// async function main() {
//   while (1) {
//     const res = await subscriber.brPop(
//       commandOptions({ isolated: true }),
//       "build-queue",
//       0
//     );
//     // @ts-ignore;
//     const id = res.element;

//     await downloadS3Folder(`output/${id}`);
//     await buildProject(id);
//     copyFinalDist(id);
//     publisher.hSet("status", id, "deployed");
//   }
// }
// main();

import express from "express";
import path from "path";
import AWS from "aws-sdk";
import { createClient, commandOptions } from "redis";
import { copyFinalDist, downloadS3Folder } from "./aws";
import { buildProject } from "./utils";

const publisher = createClient({
  url: "redis://default:Dv6pmIkfwja9fHD15D0Y2wAznKP3kBBe@redis-18797.c99.us-east-1-4.ec2.redns.redis-cloud.com:18797",
});
publisher.connect();
publisher.on("error", (err) => console.error("❌ pub error:", err));

const subscriber = createClient({
  url: "redis://default:Dv6pmIkfwja9fHD15D0Y2wAznKP3kBBe@redis-18797.c99.us-east-1-4.ec2.redns.redis-cloud.com:18797",
});
subscriber.connect();
subscriber.on("error", (err) => console.error("❌ sub error:", err));

// === Setup R2 / S3 ===
const BUCKET = "shipstack"; // must match copyFinalDist upload target!

const s3 = new AWS.S3({
  accessKeyId: "4b1f168f49212cc0a0e956b03cfae594",
  secretAccessKey:
    "cb716b413d32f8ad2400fd0f0f5fa499b40b9aa4e190884cf979e3aeef316771",
  endpoint: "https://2899d5f1f59203653215295211a75db9.r2.cloudflarestorage.com", // no bucket in URL
  s3ForcePathStyle: true, // needed for R2
  signatureVersion: "v4",
});

// === Setup Express ===
const app = express();

app.get("/*", async (req, res) => {
  try {
    const host = req.hostname || "";
    const pathUrl = req.path;

    // Support nip.io or xip.io domains
    if (!host.includes(".127.0.0.1.nip.io")) {
      return res.status(400).send("invalid or unsupported hostname");
    }

    const id = host.split(".")[0]; // example: abc123.127.0.0.1.nip.io
    const reqPath = pathUrl === "/" ? "/index.html" : pathUrl;
    const key = path.posix.join("dist", id, reqPath.replace(/^\/+/, ""));

    const obj = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();

    // MIME guess
    const mime = (p: string) => {
      if (p.endsWith(".html")) return "text/html; charset=utf-8";
      if (p.endsWith(".css")) return "text/css; charset=utf-8";
      if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
      if (p.endsWith(".svg")) return "image/svg+xml";
      if (p.endsWith(".png")) return "image/png";
      if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
      if (p.endsWith(".ico")) return "image/x-icon";
      if (p.endsWith(".json")) return "application/json; charset=utf-8";
      return "application/octet-stream";
    };

    res.setHeader("Content-Type", mime(reqPath));
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(obj.Body);
  } catch (err: any) {
    if (err?.code === "NoSuchKey")
      return res.status(404).send("file not found");
    console.error("❌ Serve error:", err);
    res.status(500).send("server error");
  }
});

app.listen(3005, () => {
  console.log("✅ Express listening on http://localhost:3005");
  startWorker(); // just calling the loop function
});

async function startWorker() {
  while (true) {
    try {
      const res = await subscriber.brPop(
        commandOptions({ isolated: true }),
        "build-queue",
        0
      );
      const id = res.element;

      await downloadS3Folder(`output/${id}`);
      await buildProject(id);
      await copyFinalDist(id);
      await publisher.hSet("status", id, "deployed");

      console.log(`✅ Finished deployment for ${id}`);
    } catch (err) {
      console.error("❌ Error in worker loop:", err);
    }
  }
}
