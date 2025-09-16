"use client";

import { useRef, useState, useCallback } from "react";
import { Message } from "@/components/message";
import { useScrollToBottom } from "@/components/use-scroll-to-bottom";
import { motion } from "framer-motion";
import { VercelIcon } from "@/components/icons";
import Link from "next/link";
import { useChat } from "ai/react";

// Icono personalizado para ArkCutt (corte láser)
const LaserIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export default function ArkCuttHome() {
  const { messages, handleSubmit, input, setInput, append } = useChat();
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  // Acciones sugeridas específicas para ArkCutt
  const suggestedActions = [
    {
      title: "¿Qué materiales",
      label: "tenéis disponibles?",
      action: "¿Qué materiales tenéis disponibles para corte láser?",
    },
    {
      title: "Necesito un",
      label: "presupuesto",
      action: "Necesito un presupuesto para mi proyecto de corte láser",
    },
    {
      title: "Genera un DXF de",
      label: "una caja organizadora",
      action: "Genera un archivo DXF de una caja organizadora de 150x100x60mm",
    },
    {
      title: "¿Cuáles son los",
      label: "tiempos de entrega?",
      action: "¿Cuáles son los tiempos de entrega disponibles?",
    },
  ];

  // Manejo de archivo DXF por drag & drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const dxfFile = files.find(file => 
      file.name.toLowerCase().endsWith('.dxf')
    );
    
    if (dxfFile) {
      // Convertir archivo a base64 para análisis
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (base64) {
          append({
            role: "user",
            content: `He subido el archivo DXF: ${dxfFile.name}. Por favor analízalo para generar un presupuesto.`,
          });
        }
      };
      reader.readAsDataURL(dxfFile);
    } else {
      append({
        role: "user",
        content: "He intentado subir un archivo, pero necesito que sea un archivo DXF para poder analizarlo.",
      });
    }
  }, [append]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="flex flex-row justify-center pb-20 h-dvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="flex flex-col justify-between gap-4">
        <div
          ref={messagesContainerRef}
          className="flex flex-col gap-6 h-full w-dvw items-center overflow-y-scroll"
        >
          {messages.length === 0 && (
            <motion.div className="h-[400px] px-4 w-full md:w-[600px] md:px-0 pt-20">
              <div className="border rounded-2xl p-8 flex flex-col gap-6 text-slate-600 text-sm bg-white/80 backdrop-blur-sm shadow-lg border-slate-200">
                {/* Header con logo */}
                <div className="flex flex-row justify-center gap-4 items-center text-slate-900 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
                    <LaserIcon size={24} color="white" />
                  </div>
                  <div className="text-left">
                    <h1 className="text-2xl font-bold text-slate-900">ArkCutt AI</h1>
                    <p className="text-slate-600">Asistente inteligente para corte láser</p>
                  </div>
                </div>

                {/* Descripción principal */}
                <div className="text-center space-y-3">
                  <p className="text-lg font-medium text-slate-800">
                    Especialistas en corte láser de precisión
                  </p>
                  <p>
                    Soy tu asistente de ArkCutt. Puedo ayudarte con presupuestos instantáneos, 
                    análisis de archivos DXF, consultas sobre materiales y generación de diseños.
                  </p>
                </div>

                {/* Características principales */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">💰</span>
                      <h3 className="font-semibold text-blue-900">Presupuestos</h3>
                    </div>
                    <p className="text-blue-700 text-sm">
                      Sube tu archivo DXF y obtén un presupuesto instantáneo
                    </p>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">📋</span>
                      <h3 className="font-semibold text-green-900">Materiales</h3>
                    </div>
                    <p className="text-green-700 text-sm">
                      Consulta nuestro catálogo actualizado de materiales
                    </p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🎯</span>
                      <h3 className="font-semibold text-purple-900">Análisis DXF</h3>
                    </div>
                    <p className="text-purple-700 text-sm">
                      Análisis automático de dimensiones y complejidad
                    </p>
                  </div>
                  
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">✨</span>
                      <h3 className="font-semibold text-amber-900">Generar DXF</h3>
                    </div>
                    <p className="text-amber-700 text-sm">
                      Crea archivos DXF desde descripciones de texto
                    </p>
                  </div>
                </div>

                {/* Zona de arrastrar archivo */}
                <div 
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    isDragOver 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-slate-300 bg-slate-50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="space-y-2">
                    <div className="text-3xl">📎</div>
                    <p className="font-medium text-slate-700">
                      Arrastra tu archivo DXF aquí
                    </p>
                    <p className="text-sm text-slate-500">
                      Para análisis automático y presupuesto instantáneo
                    </p>
                  </div>
                </div>

                {/* Footer con enlace a documentación */}
                <p className="text-center text-xs text-slate-500">
                  Powered by{" "}
                  <Link
                    className="text-blue-500 hover:text-blue-600 font-medium"
                    href="https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#multi-step-calls"
                    target="_blank"
                  >
                    Vercel AI SDK
                  </Link>{" "}
                  with multi-step tool calling
                </p>
              </div>
            </motion.div>
          )}

          {messages.map((message) => (
            <Message
              key={message.id}
              role={message.role}
              content={message.content}
              toolInvocations={message.toolInvocations}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Acciones sugeridas */}
        <div className="grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[600px] mb-4">
          {messages.length === 0 &&
            suggestedActions.map((suggestedAction, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
                key={index}
                className={index > 1 ? "hidden sm:block" : "block"}
              >
                <button
                  onClick={async () => {
                    append({
                      role: "user",
                      content: suggestedAction.action,
                    });
                  }}
                  className="w-full text-left border border-slate-200 bg-white/80 backdrop-blur-sm text-slate-800 rounded-xl p-3 text-sm hover:bg-white hover:shadow-md transition-all flex flex-col group"
                >
                  <span className="font-medium text-slate-900 group-hover:text-blue-700">
                    {suggestedAction.title}
                  </span>
                  <span className="text-slate-600">
                    {suggestedAction.label}
                  </span>
                </button>
              </motion.div>
            ))}
        </div>

        {/* Formulario de input */}
        <form
          className="flex flex-col gap-2 relative items-center"
          onSubmit={handleSubmit}
        >
          <div className="relative w-full md:max-w-[600px] max-w-[calc(100dvw-32px)]">
            <input
              ref={inputRef}
              className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 w-full outline-none border border-slate-200 text-slate-800 placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
              placeholder="Pregúntame sobre corte láser, materiales o sube tu archivo DXF..."
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
              }}
            />
            
            {/* Botón de envío */}
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
