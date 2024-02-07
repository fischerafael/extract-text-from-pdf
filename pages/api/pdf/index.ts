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
      try {
        await uploadPDFTemp(req, res);
        const data = await parsePDFFile(req.file);
        const chunks = splitTo10kChunks(data.text);

        res.status(200).json({
          content: {
            chunks: chunks.length,
            split: chunks.map((ck) => ({
              chunk: ck,
              length: ck.length,
            })),
            full: data.text,
          },
          status: "Ok",
          numrender: data.numrender,
          length: {
            characters: data.text.length,
          },
          pages: data.numpages,

          meta: data.metadata,
        });
      } catch (error) {
        console.error("Error extracting text from PDF:", error);
        res.status(500).json({ error: "Error extracting text from PDF" });
      }

      return res.status(405).json({ message: "Method Not Allowed" });
    }
    return res.status(405).json({ text: "Not Allowed" });
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

const uploadPDFTemp = async (req: any, res: any) => {
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
};

const parsePDFFile = async (file: any) => {
  const fileBuffer = fs.readFileSync(file.path);
  const data = await pdfParse(fileBuffer);
  return data;
};

const splitTo10kChunks = (str: string): string[] => {
  const maxLength = 10000; // Comprimento máximo de cada pedaço
  const chunks: string[] = [];
  let currentChunk = "";

  const sentences = str.split("."); // Dividindo a string em frases
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (currentChunk.length + sentence.length <= maxLength) {
      currentChunk += sentence + "."; // Adiciona a frase ao pedaço atual
      if (i === sentences.length - 1) {
        chunks.push(currentChunk); // Se for a última frase, adiciona o pedaço atual
      }
    } else {
      chunks.push(currentChunk); // Adiciona o pedaço atual
      currentChunk = sentence + "."; // Inicia um novo pedaço com a frase atual
    }
  }

  return chunks;
};
