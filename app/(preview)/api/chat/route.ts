import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

const { text } = await generateText({
model: openai("o3-mini"),
prompt: `Eres el asistente inteligente de ArkCutt, una empresa especializada en servicios de corte láser de precisión.` + 
`Tu objetivo es proporcionar un servicio excepcional, eficiente y profesional.`,
})
