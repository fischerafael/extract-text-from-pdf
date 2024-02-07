import type { NextApiRequest, NextApiResponse } from "next";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";

const upload = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: 20 * 1024 * 1024 }, // Limit file size to 1MB
});

export const config = {
  api: {
    bodyParser: false,
  },
};

interface Request extends NextApiRequest {
  file: any;
}

export default async function handler(req: Request, res: NextApiResponse) {
  try {
    if (req.method === "POST") {
      await new Promise((resolve, reject) => {
        upload.single("file")(req as any, res as any, (err) => {
          if (err instanceof multer.MulterError) {
            console.error(err);
            return reject({ status: 400, message: "File upload error" });
          }
          if (err) {
            console.error(err);
            return reject({ status: 500, message: "Internal server error" });
          }
          resolve("");
        });
      });

      const file = req.file!;

      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const data = await pdfParse(fileBuffer);
        const text = data.text;
        console.log("Number of pages:", data.numpages);
        console.log("Number of rendered pages:", data.numrender);
        console.log("PDF info:", data.info);
        console.log("PDF metadata:", data.metadata);
        console.log("PDF.js version:", data.version);
        console.log("PDF text:", data.text);

        res.status(200).json({ message: "Text extracted successfully", text });
      } catch (error) {
        console.error("Error extracting text from PDF:", error);
        res.status(500).json({ error: "Error extracting text from PDF" });
      }

      console.log("File uploaded:", file);
      return res.status(200).json({ message: "File uploaded successfully" });
    }
    return res.status(405).json({ text: "Not Allowed" });
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
