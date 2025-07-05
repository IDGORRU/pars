import React from 'react';
import { Mail, Link, Database, FileText, Copy, Download, Check } from 'lucide-react';
import { ParseMode } from './ModeSelector';

interface ResultsDisplayProps {
  mode: ParseMode;
  results: any[];
  isVisible: boolean;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ mode, results, isVisible }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = () => {
    const content = results.map(item => {
      if (mode === 'email') return item.email;
      if (mode === 'links') return item.url;
      if (mode === 'data') return `${item.title}: ${item.content}`;
      return item.content;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parsed_${mode}_results.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = () => {
    switch (mode) {
      case 'email': return Mail;
      case 'links': return Link;
      case 'data': return Database;
      default: return FileText;
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'email': return 'Найденные Email адреса';
      case 'links': return 'Извлеченные ссылки';
      case 'data': return 'Извлеченные данные';
      case 'html': return 'HTML элементы';
      default: return 'Результаты';
    }
  };

  if (!isVisible || results.length === 0) return null;

  const Icon = getIcon();

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">{getTitle()}</h3>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">
            {results.length}
          </span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Download size={16} />
          <span>Скачать</span>
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2">
        {results.map((item, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {mode === 'email' && (
                  <div>
                    <p className="font-medium text-gray-900 truncate">{item.email}</p>
                    {item.source && (
                      <p className="text-sm text-gray-500 truncate">Источник: {item.source}</p>
                    )}
                  </div>
                )}
                
                {mode === 'links' && (
                  <div>
                    <p className="font-medium text-blue-600 truncate">{item.url}</p>
                    {item.text && (
                      <p className="text-sm text-gray-600 truncate">Текст: {item.text}</p>
                    )}
                  </div>
                )}
                
                {mode === 'data' && (
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                  </div>
                )}
                
                {mode === 'html' && (
                  <div>
                    <p className="font-medium text-purple-600">{item.tag}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => handleCopy(
                  mode === 'email' ? item.email : 
                  mode === 'links' ? item.url : 
                  mode === 'data' ? `${item.title}: ${item.content}` : 
                  item.content, 
                  index
                )}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                {copiedIndex === index ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};