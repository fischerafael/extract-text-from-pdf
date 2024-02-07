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

        res.status(200).json({
          content: {
            full: data.text,
            split: splitToChunks(data.text, 10).map((ck) => ({
              length: ck.length,
              chunk: ck,
            })),
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

      console.log("File uploaded:", file);
      return res.status(200).json({ message: "File uploaded successfully" });
    }
    return res.status(405).json({ text: "Not Allowed" });
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

const splitToChunks = (text: string, numChunks: number = 1) => {
  // Dividir o texto em linhas
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let currentChunk = "";

  // Loop através de cada linha
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Verificar se adicionar a linha não vai ultrapassar o limite de tamanho do chunk
    if ((currentChunk + line).length <= Math.ceil(text.length / numChunks)) {
      currentChunk += line + "\n";
    } else {
      // Se adicionar a linha ultrapassar o limite, iniciar um novo chunk
      chunks.push(currentChunk.trim());
      currentChunk = line + "\n";
    }
  }

  // Adicionar o último chunk
  if (currentChunk.trim() !== "") {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};
