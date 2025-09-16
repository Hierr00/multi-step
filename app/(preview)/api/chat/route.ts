// app/api/chat/route.ts
import { streamText, tool, stepCountIs, toolCallCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// Esquemas para validación
const MaterialSelectionSchema = z.object({
  nombre: z.string(),
  categoria: z.enum(['madera', 'plastico', 'papel']),
  grosor: z.string(),
  color: z.string(),
  cantidad_planchas: z.number().min(1)
})

const DXFAnalysisSchema = z.object({
  file_content: z.string().describe('Contenido del archivo DXF en base64 o texto'),
  filename: z.string().describe('Nombre del archivo DXF')
})

const PromptToDXFSchema = z.object({
  prompt: z.string().min(3).max(500),
  width: z.number().min(0).max(3000).optional(),
  height: z.number().min(0).max(3000).optional(),
  depth: z.number().min(0).max(3000).optional(),
  material: z.enum(['wood', 'acrylic', 'mdf', 'cardboard', 'metal', 'paper']).optional(),
  use_ai_enhancement: z.boolean().optional()
})

// Herramientas del agente
const arkCuttTools = {
  // 1. Análisis de archivo DXF
  analyzeDXF: tool({
    description: 'Analiza un archivo DXF subido por el usuario para extraer dimensiones, formas y calcular área de corte',
    parameters: DXFAnalysisSchema,
    execute: async ({ file_content, filename }) => {
      try {
        // Convertir el contenido base64 a un Blob para el FormData
        const binaryString = atob(file_content)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'application/dxf' })
        
        // Crear FormData para multipart/form-data
        const formData = new FormData()
        formData.append('file', blob, filename)

        const response = await fetch('https://dxf-analyzer-api.onrender.com/analyze-dxf', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const analysis = await response.json()

        if (!analysis.success) {
          return {
            success: false,
            error: 'Error en el análisis del DXF'
          }
        }

        return {
          success: true,
          data: {
            // Información de estadísticas
            total_entities: analysis.statistics.total_entities,
            valid_entities: analysis.statistics.valid_entities,
            phantom_entities: analysis.statistics.phantom_entities,
            design_center: analysis.statistics.design_center,
            max_design_dimension: analysis.statistics.max_design_dimension,
            
            // Información del bounding box (área de corte)
            dimensions: {
              width: analysis.bounding_box.width,
              height: analysis.bounding_box.height,
              area_mm2: analysis.bounding_box.area,
              area_cm2: analysis.bounding_box.area / 100 // Convertir a cm²
            },
            
            // Longitud de corte
            cut_length: {
              total_mm: analysis.cut_length.total_mm,
              total_m: analysis.cut_length.total_m
            },
            
            // Información adicional para cálculos
            complexity: analysis.statistics.phantom_entities > 0 ? 'alta' : 
                       analysis.statistics.total_entities > 100 ? 'media' : 'baja'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: 'Error analizando el archivo DXF',
          details: error.message
        }
      }
    }
  }),

  // 2. Consulta de materiales disponibles
  getMaterialOptions: tool({
    description: 'Consulta los materiales disponibles y sus precios basado en los datos de inventario',
    parameters: z.object({
      categoria: z.enum(['madera', 'plastico', 'papel', 'todos']).optional(),
      grosor_min: z.string().optional(),
      grosor_max: z.string().optional()
    }),
    execute: async ({ categoria, grosor_min, grosor_max }) => {
      // Aquí usarías los datos del CSV que proporcionaste
      const materiales = [
        {
          id: 6,
          nombre: "DM",
          categoria: "madera",
          grosores: ["2.5"],
          color: "Madera Natural",
          precio_por_cm2: 0.008,
          stock_actual: 0
        },
        {
          id: 19,
          nombre: "METACRILATO",
          categoria: "plastico", 
          grosores: ["2"],
          color: "Transparente",
          precio_por_cm2: 0.051,
          stock_actual: 0
        }
        // ... más materiales del CSV
      ]

      const filteredMaterials = materiales.filter(m => {
        if (categoria && categoria !== 'todos' && m.categoria !== categoria) return false
        // Lógica adicional de filtrado por grosor
        return true
      })

      return {
        success: true,
        materials: filteredMaterials,
        count: filteredMaterials.length
      }
    }
  }),

  // 3. Calcular presupuesto (REQUIERE análisis DXF previo)
  calculateQuote: tool({
    description: 'Calcula el presupuesto completo basado en el análisis DXF y datos del cliente. SOLO se puede usar después de analyzeDXF.',
    parameters: z.object({
      // Datos del cliente (obligatorios)
      cliente_nombre: z.string().describe('Nombre completo del cliente'),
      cliente_email: z.string().email().describe('Email del cliente'),
      cliente_telefono: z.string().describe('Teléfono del cliente'),
      
      // Datos del material seleccionado (obligatorios)
      material_nombre: z.string().describe('Nombre del material seleccionado'),
      material_grosor: z.string().describe('Grosor del material (ej: 4mm)'),
      material_color: z.string().describe('Color del material'),
      
      // Datos del análisis DXF (obligatorios - obtenidos de analyzeDXF)
      area_mm2: z.number().describe('Área total del material en mm² - DEBE venir del análisis DXF'),
      corte_exterior_m: z.number().describe('Longitud de corte exterior en metros - DEBE venir del análisis DXF'),
      corte_interior_m: z.number().optional().default(0).describe('Longitud de corte interior en metros - del análisis DXF'),
      
      // Datos adicionales del DXF
      total_entities: z.number().optional().describe('Total de entidades del DXF'),
      complexity: z.enum(['baja', 'media', 'alta']).optional().describe('Complejidad calculada del DXF')
    }),
    execute: async ({ 
      cliente_nombre, 
      cliente_email, 
      cliente_telefono, 
      material_nombre,
      material_grosor,
      material_color,
      area_mm2,
      corte_exterior_m,
      corte_interior_m = 0,
      total_entities,
      complexity
    }) => {
      try {
        const requestBody = {
          "Cliente": {
            "Nombre y Apellidos": cliente_nombre,
            "Mail": cliente_email,
            "Número de Teléfono": cliente_telefono
          },
          "Pedido": {
            "Material seleccionado": material_nombre,
            "Area material": `${area_mm2} mm²`,
            "¿Quién proporciona el material?": {
              "Material seleccionado": material_nombre,
              "Grosor": material_grosor,
              "Color": material_color
            },
            "Capas": [
              {
                "nombre": "Cortes exterior",
                "longitud_m": corte_exterior_m
              }
            ],
            // Datos adicionales del análisis DXF
            "dxf_analysis": {
              "total_entities": total_entities,
              "complexity": complexity,
              "area_mm2": area_mm2
            }
          }
        }

        // Agregar cortes interiores si existen
        if (corte_interior_m > 0) {
          requestBody.Pedido.Capas.push({
            "nombre": "Cortes interior", 
            "longitud_m": corte_interior_m
          })
        }

        const response = await fetch('https://calculadora-presupuestos-laser.onrender.com/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          return {
            success: false,
            error: 'Error calculando el presupuesto'
          }
        }

        return {
          success: true,
          data: {
            material: result.data.material,
            tiempo_corte_minutos: result.data.tiempo_corte_minutos,
            costos: {
              corte: result.data.coste_corte,
              material: result.data.coste_material,
              subtotal: result.data.subtotal,
              margen_beneficio: result.data.margen_beneficio,
              total: result.data.total
            },
            parametros_corte: result.data.parametros_corte,
            layers: result.data.layers,
            frontend_info: result.data.frontend_info,
            // Información adicional para el usuario
            dxf_info: {
              area_mm2,
              corte_exterior_m,
              corte_interior_m,
              total_entities,
              complexity
            }
          }
        }
      } catch (error) {
        return {
          success: false,
          error: 'Error calculando el presupuesto',
          details: error.message
        }
      }
    }
  }),

  // 6. Consultar materiales disponibles desde el backend
  getMaterialsFromBackend: tool({
    description: 'Consulta los materiales disponibles directamente desde el backend de presupuestos',
    parameters: z.object({}), // No requiere parámetros
    execute: async () => {
      try {
        const response = await fetch('https://calculadora-presupuestos-laser.onrender.com/materiales', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        return {
          success: true,
          data: {
            materiales: result.materiales,
            detalle: result.detalle,
            total: result.total
          }
        }
      } catch (error) {
        return {
          success: false,
          error: 'Error consultando materiales del backend',
          details: error.message
        }
      }
    }
  }),

  // 4. Generar DXF desde prompt
  generateDXFFromPrompt: tool({
    description: 'Genera un archivo DXF a partir de una descripción textual usando IA',
    parameters: z.object({
      prompt: z.string().min(3).max(500).describe('Descripción del objeto a crear'),
      width: z.number().min(0).max(3000).optional().describe('Ancho en milímetros'),
      height: z.number().min(0).max(3000).optional().describe('Alto en milímetros'), 
      depth: z.number().min(0).max(3000).optional().describe('Profundidad en milímetros'),
      material: z.enum(['wood', 'acrylic', 'mdf', 'cardboard', 'metal', 'paper']).optional().describe('Tipo de material'),
      use_ai_enhancement: z.boolean().optional().default(true).describe('Usar IA para mejorar interpretación')
    }),
    execute: async ({ prompt, width, height, depth, material, use_ai_enhancement = true }) => {
      try {
        const requestBody = {
          prompt,
          use_ai_enhancement
        }

        // Agregar dimensiones si se proporcionan
        if (width || height || depth) {
          requestBody.dimensions = {}
          if (width) requestBody.dimensions.width = width
          if (height) requestBody.dimensions.height = height  
          if (depth) requestBody.dimensions.depth = depth
        }

        // Agregar material si se proporciona
        if (material) {
          requestBody.material = material
        }

        const response = await fetch('https://backend-dxf.onrender.com/api/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          return {
            success: false,
            error: result.message || 'Error en la generación del DXF'
          }
        }

        return {
          success: true,
          data: {
            filename: result.filename,
            download_url: result.download_url,
            metadata: result.metadata,
            message: result.message
          }
        }
      } catch (error) {
        return {
          success: false,
          error: 'Error generando el archivo DXF',
          details: error.message
        }
      }
    }
  }),

  // 5. Obtener información de entrega
  getDeliveryInfo: tool({
    description: 'Consulta opciones y tiempos de entrega disponibles',
    parameters: z.object({
      codigo_postal: z.string().optional(),
      urgencia: z.enum(['normal', 'express', 'urgente']).optional()
    }),
    execute: async ({ codigo_postal, urgencia = 'normal' }) => {
      // Simulated delivery logic
      const deliveryOptions = [
        {
          type: 'normal',
          days: 3-5,
          cost: 5.99,
          description: 'Entrega estándar'
        },
        {
          type: 'express', 
          days: 1-2,
          cost: 12.99,
          description: 'Entrega express'
        }
      ]

      return {
        success: true,
        options: deliveryOptions,
        estimated_date: new Date(Date.now() + (urgencia === 'express' ? 2 : 5) * 24 * 60 * 60 * 1000)
      }
    }
  })
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: `
    Eres el asistente inteligente de ArkCutt, una empresa especializada en servicios de corte láser de precisión.

    TU MISIÓN:
    - Ayudar con consultas generales sobre corte láser y materiales
    - Generar presupuestos COMPLETOS para proyectos de corte láser
    - Facilitar la creación de archivos DXF desde descripciones

    REGLA FUNDAMENTAL PARA PRESUPUESTOS:
    🚨 OBLIGATORIO: Para cualquier presupuesto, el usuario DEBE subir un archivo DXF
    - Sin archivo DXF = Sin presupuesto posible
    - El análisis DXF proporciona datos críticos: área, longitud de corte, complejidad
    - Estos datos son OBLIGATORIOS para el backend de presupuestos

    WORKFLOW OBLIGATORIO PARA PRESUPUESTOS:
    1. Usuario sube archivo DXF → EJECUTAR analyzeDXF automáticamente
    2. Mostrar resultados del análisis (área, dimensiones, longitud de corte)
    3. Consultar materiales disponibles con getMaterialsFromBackend
    4. Pedir al usuario: material, grosor, color + datos personales (nombre, email, teléfono)
    5. EJECUTAR calculateQuote con TODOS los datos del análisis DXF + selección del usuario
    6. Mostrar presupuesto completo y detallado

    FLUJOS ALTERNATIVOS:
    - Si usuario describe un objeto → generateDXFFromPrompt (para generar DXF, NO para presupuesto)
    - Si consulta general → responder directamente sin herramientas
    - Si pregunta por materiales → getMaterialsFromBackend

    DATOS CRÍTICOS DEL ANÁLISIS DXF (para presupuestos):
    - area_mm2: Área total del proyecto
    - cut_length.total_m: Longitud de corte exterior
    - total_entities: Número de elementos
    - complexity: Calculada según entidades y phantoms

    IMPORTANTE:
    - NUNCA calcules presupuesto sin análisis DXF previo
    - SIEMPRE explica que el DXF es obligatorio para presupuestos
    - Si no hay DXF, ofrece generar uno o explicar el proceso
    - Sé claro sobre qué datos necesitas en cada paso

    PERSONALIDAD:
    - Profesional pero amigable
    - Claro sobre requisitos (especialmente DXF obligatorio)
    - Técnicamente preciso
    - Paciente al explicar el proceso paso a paso
    `,
    tools: arkCuttTools,
    stopWhen: [
      // Para cuando se complete un presupuesto completo (análisis DXF + presupuesto)
      (toolCalls, toolResults) => {
        const hasDXFAnalysis = toolResults.some(result => 
          result.toolName === 'analyzeDXF' && result.result.success
        )
        const hasQuote = toolResults.some(result => 
          result.toolName === 'calculateQuote' && result.result.success
        )
        // Solo se detiene cuando tiene AMBOS: análisis DXF Y presupuesto
        return hasDXFAnalysis && hasQuote
      },
      // Para evitar loops infinitos
      stepCountIs(6)
    ],
    maxSteps: 6,
    onFinish: ({ finishReason, totalUsage, steps }) => {
      console.log('Agent finished:', { finishReason, totalUsage, steps: steps.length })
    }
  })

  return result.toDataStreamResponse()
}

