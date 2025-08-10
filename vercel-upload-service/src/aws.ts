import { S3 } from "aws-sdk";
import fs from "fs";
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

// fileName => output/12312/src/App.jsx
// filePath => /Users/harkiratsingh/vercel/dist/output/12312/src/App.jsx
export const uploadFile = async (fileName: string, localFilePath: string) => {
  const fileContent = fs.readFileSync(localFilePath);
  const response = await s3
    .upload({
      Body: fileContent,
      Bucket: "shipstack",
      Key: fileName,
    })
    .promise();
  console.log(response);
};
