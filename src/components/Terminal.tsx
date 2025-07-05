import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

interface TerminalProps {
  isRunning: boolean;
  logs: string[];
}

export const Terminal: React.FC<TerminalProps> = ({ isRunning, logs }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-green-400" />
          <span className="text-sm font-medium text-gray-300">Терминал</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-gray-400">{currentTime}</span>
        </div>
      </div>
      <div 
        ref={terminalRef}
        className="p-4 h-48 overflow-y-auto font-mono text-sm text-green-400 bg-gray-900"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500">Готов к запуску парсинга...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1">
              <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>{' '}
              <span>{log}</span>
            </div>
          ))
        )}
        {isRunning && (
          <div className="flex items-center gap-2 text-yellow-400">
            <span>Обработка...</span>
            <div className="animate-spin">⚡</div>
          </div>
        )}
      </div>
    </div>
  );
};