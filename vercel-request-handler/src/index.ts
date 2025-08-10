import express from "express";
import { S3 } from "aws-sdk";
import AWS from "aws-sdk";

// const s3 = new AWS.S3({
//   accessKeyId: "4b1f168f49212cc0a0e956b03cfae594",
//   secretAccessKey:
//     "cb716b413d32f8ad2400fd0f0f5fa499b40b9aa4e190884cf979e3aeef316771",
//   endpoint:
//     "https://2899d5f1f59203653215295211a75db9.r2.cloudflarestorage.com/shipstack",
// });

const s3 = new AWS.S3({
  accessKeyId: "4b1f168f49212cc0a0e956b03cfae594",
  secretAccessKey:
    "cb716b413d32f8ad2400fd0f0f5fa499b40b9aa4e190884cf979e3aeef316771",
  endpoint: "https://2899d5f1f59203653215295211a75db9.r2.cloudflarestorage.com", // no bucket in URL
  s3ForcePathStyle: true, // needed for R2
  signatureVersion: "v4",
});

const app = express();

app.get("/*", async (req, res) => {
  // id.100xdevs.com
  const host = req.hostname;

  const id = host.split(".")[0];
  const filePath = req.path;

  const contents = await s3
    .getObject({
      Bucket: "shipstack",
      Key: `dist/${id}${filePath}`,
    })
    .promise();

  const type = filePath.endsWith("html")
    ? "text/html"
    : filePath.endsWith("css")
    ? "text/css"
    : "application/javascript";
  res.set("Content-Type", type);

  res.send(contents.Body);
});

app.listen(3001);
