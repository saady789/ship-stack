import { S3 } from "aws-sdk";
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
  accessKeyId: "4b1f168f49212cc0a0e956b03cfae594",
  secretAccessKey:
    "cb716b413d32f8ad2400fd0f0f5fa499b40b9aa4e190884cf979e3aeef316771",
  endpoint: "https://2899d5f1f59203653215295211a75db9.r2.cloudflarestorage.com", // no bucket in URL
  s3ForcePathStyle: true, // needed for R2
  signatureVersion: "v4",
});

// output/asdasd
// export async function downloadS3Folder(prefix: string) {
//   const allFiles = await s3
//     .listObjectsV2({
//       Bucket: "shipstack",
//       Prefix: prefix,
//     })
//     .promise();

//   //
//   const allPromises =
//     allFiles.Contents?.map(async ({ Key }) => {
//       return new Promise(async (resolve) => {
//         if (!Key) {
//           resolve("");
//           return;
//         }
//         const finalOutputPath = path.join(__dirname, Key);
//         const outputFile = fs.createWriteStream(finalOutputPath);
//         const dirName = path.dirname(finalOutputPath);
//         if (!fs.existsSync(dirName)) {
//           fs.mkdirSync(dirName, { recursive: true });
//         }
//         s3.getObject({
//           Bucket: "shipstack",
//           Key,
//         })
//           .createReadStream()
//           .pipe(outputFile)
//           .on("finish", () => {
//             resolve("");
//           });
//       });
//     }) || [];
//   console.log("awaiting");

//   await Promise.all(allPromises?.filter((x) => x !== undefined));
// }

export async function downloadS3Folder(prefix: string) {
  const normPrefix = prefix.replace(/\/+$/, ""); // 'output/2vwhf'
  const id = normPrefix.split("/")[1];
  const baseLocal = path.join(__dirname, "output", id);

  // Try forward-slash prefix first
  const fwdPrefix = normPrefix + "/";
  let listed = await s3
    .listObjectsV2({ Bucket: "shipstack", Prefix: fwdPrefix })
    .promise();

  // If empty, try backslash prefix (legacy uploads from Windows)
  if (!listed.Contents || listed.Contents.length === 0) {
    const backPrefix = normPrefix.replace(/\//g, "\\") + "\\";
    listed = await s3
      .listObjectsV2({ Bucket: "shipstack", Prefix: backPrefix })
      .promise();
  }

  if (!listed.Contents || listed.Contents.length === 0) {
    console.error("No objects found at prefix:", normPrefix);
    throw new Error(`Nothing to download for ${normPrefix}`);
  }

  const tasks = listed.Contents.map(({ Key }) => {
    if (!Key) return Promise.resolve();

    // Normalize any backslashes to forward slashes before computing relative
    const keyUnix = Key.replace(/\\/g, "/"); // e.g. output/2vwhf/...
    const relative = keyUnix.replace(new RegExp(`^${normPrefix}/`), "");
    const finalPath = path.join(baseLocal, relative); // correct local path

    return new Promise<void>((resolve, reject) => {
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const out = fs.createWriteStream(finalPath);
      s3.getObject({ Bucket: "shipstack", Key })
        .createReadStream()
        .on("error", reject)
        .pipe(out)
        .on("finish", () => resolve())
        .on("error", reject);
    });
  });

  console.log("Downloading to:", baseLocal);
  await Promise.all(tasks);
}

export function copyFinalDist(id: string) {
  const folderPath = path.join(__dirname, `output/${id}/dist`);
  const allFiles = getAllFiles(folderPath);
  allFiles.forEach((file) => {
    uploadFile(`dist/${id}/` + file.slice(folderPath.length + 1), file);
  });
}

const getAllFiles = (folderPath: string) => {
  let response: string[] = [];

  const allFilesAndFolders = fs.readdirSync(folderPath);
  allFilesAndFolders.forEach((file) => {
    const fullFilePath = path.join(folderPath, file);
    if (fs.statSync(fullFilePath).isDirectory()) {
      response = response.concat(getAllFiles(fullFilePath));
    } else {
      response.push(fullFilePath);
    }
  });
  return response;
};

const uploadFile = async (fileName: string, localFilePath: string) => {
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
