"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, X, Send, Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Qual o saldo do mês atual?",
  "Registrar despesa: Mercado R$ 350",
  "Quais as maiores despesas de junho?",
  "Oportunidades de otimização?",
];

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({ api: "/api/chat" });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Backdrop blur quando aberto */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer lateral */}
      <div className={cn(
        "fixed top-0 right-0 z-50 h-[calc(100%-64px)] md:h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">Assistente IA</p>
              <p className="text-xs text-zinc-400">Powered by Claude</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-zinc-400 text-center">Sugestões rápidas</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    handleInputChange({ target: { value: s } } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className="w-full text-left text-xs p-3 rounded-lg border border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-zinc-600"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-2 max-w-[90%]",
                m.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-1",
                m.role === "user" ? "bg-emerald-600" : "bg-zinc-100"
              )}>
                {m.role === "user"
                  ? <User className="h-3 w-3 text-white" />
                  : <Bot className="h-3 w-3 text-zinc-600" />}
              </div>
              <div className={cn(
                "rounded-xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-800"
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                <Bot className="h-3 w-3 text-zinc-600" />
              </div>
              <div className="bg-zinc-100 rounded-xl px-3 py-2">
                <span className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-zinc-100">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Pergunte ou registre um gasto..."
              className="flex-1 text-xs h-9"
              disabled={isLoading}
              autoFocus={open}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="shrink-0">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200",
          open ? "bg-zinc-700 rotate-90 scale-90" : "bg-emerald-600 hover:bg-emerald-700 hover:scale-105"
        )}
        style={{ height: 52, width: 52 }}
        title="Assistente IA"
      >
        {open
          ? <X className="h-5 w-5 text-white" />
          : <MessageSquare className="h-5 w-5 text-white" />}
      </button>
    </>
  );
}
