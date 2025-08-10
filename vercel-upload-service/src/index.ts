import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import { generate } from "./utils";
import { getAllFiles } from "./file";
import path from "path";
import { uploadFile } from "./aws";
import { createClient } from "redis";
import { fileURLToPath } from "url";

// Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const app = express();
app.use(cors());
app.use(express.json());

app.post("/deploy", async (req, res) => {
  const repoUrl = req.body.repoUrl;
  const id = generate(); // asd12
  await simpleGit().clone(repoUrl, path.join(__dirname, `output/${id}`));

  const files = getAllFiles(path.join(__dirname, `output/${id}`));

  files.forEach(async (file) => {
    await uploadFile(file.slice(__dirname.length + 1), file);
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));
  publisher.lPush("build-queue", id);
  // INSERT => SQL
  // .create =>
  publisher.hSet("status", id, "uploaded");

  res.json({
    id: id,
  });
});

app.get("/status", async (req, res) => {
  const id = req.query.id;
  const response = await subscriber.hGet("status", id as string);
  res.json({
    status: response,
  });
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running!" });
});
app.listen(3000);
