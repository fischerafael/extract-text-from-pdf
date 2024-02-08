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
        console.log("[chunks]", chunks);

        const promises = chunks.map(async (chunk, index) => {
          const insight = await getInsights(chunk);
          console.log("[insight]", index);
          const parsedInsight: { ideas: string[] } = parseJson(insight);
          console.log("[parsedInsight]", parsedInsight);
          return parsedInsight.ideas;
        });

        const result = await Promise.all(promises);
        console.log("[result]", result);
        const insights: string[] = result.flat();

        res.status(200).json({
          insights: insights,
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

const parseJson = (insight: string | null): { ideas: string[] } => {
  try {
    return JSON.parse(insight || "");
  } catch (e: any) {
    console.log("[ERROR PARSING TO JSON]", e.message);
    return {
      ideas: ["ERROR", e.message],
    };
  }
};

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
  const maxLength = 6000; // Comprimento máximo de cada pedaço
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

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

const getInsights = async (content: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: `Analise o texto a seguir. Em seguida, extraia até 5 ideias ou afirmações importantes contidas nele. Finalmente, retorne essas afirmações no formato de JSON. Retorne as frases em PORTUGUÊS. Para cada afirmação, traga também seu autor e ano. Exemplo de retorno: {"ideas": ["Atmosferas é o mood de um lugar (Author, ano)", "Atmosferas é o mood de um lugar (Author, ano)", "Atmosferas é o mood de um lugar ({author}, {year})",...]}. Se não for possível identificar o autor, utilize o {autor} do artigo e {ano} do artigo como valores default. Garanta que o JSON está formatado corretamente. Se o texto for apenas uma lista de Referências Bibliográficas, não retorne elas. \n\n<text>${content}</text>`,
      },
    ],
    temperature: 0.7,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  return response.choices[0].message.content;
};
