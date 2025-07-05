import React, { useState, useEffect } from 'react';
import { Play, Square, Globe, Settings, Download, ArrowLeft, Terminal, FileText, Link, Mail, Code2 } from 'lucide-react';

const HTMLParser = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedMode, setSelectedMode] = useState('email');
  const [currentView, setCurrentView] = useState('main');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  
  // Новые состояния для таймера и прогресса
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [estimatedTotal, setEstimatedTotal] = useState(null);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const modes = {
    email: { label: 'Извлечение Email', icon: <Mail size={16} />, color: 'blue' },
    links: { label: 'Извлечение ссылок', icon: <Link size={16} />, color: 'green' },
    data: { label: 'Извлечение данных', icon: <FileText size={16} />, color: 'purple' },
    html: { label: 'Парсинг HTML', icon: <Code2 size={16} />, color: 'orange' }
  };

  // Настоящий парсер
  const realParser = async (url, mode) => {
    try {
      addLog(`🔍 Запуск парсинга ${url}...`);
      
      // Используем CORS proxy для обхода блокировок
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      addLog(`📡 Загрузка HTML контента...`);
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const htmlContent = data.contents;
      
      addLog(`✅ HTML загружен (${htmlContent.length} символов)`);
      addLog(`🔄 Анализ контента в режиме "${modes[mode].label}"...`);
      
      // Создаем виртуальный DOM для парсинга
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Устанавливаем приблизительное количество элементов
      setEstimatedTotal(doc.querySelectorAll('a, p, h1, h2, h3, img').length);
      
      let results = [];
      
      switch(mode) {
        case 'email':
          results = extractEmails(doc, htmlContent);
          break;
        case 'links':
          results = extractLinks(doc, url);
          break;
        case 'data':
          results = extractData(doc);
          break;
        case 'html':
          results = extractHTML(doc);
          break;
      }
      
      addLog(`🎯 Найдено ${results.length} результатов`);
      return results;
      
    } catch (error) {
      addLog(`❌ Ошибка парсинга: ${error.message}`);
      throw error;
    }
  };

  // Извлечение email адресов
  const extractEmails = (doc, htmlContent) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = [];
    const foundEmails = new Set();
    
    // Поиск в тексте
    const textMatches = htmlContent.match(emailRegex) || [];
    textMatches.forEach(email => {
      if (!foundEmails.has(email.toLowerCase())) {
        foundEmails.add(email.toLowerCase());
        emails.push({
          email: email,
          source: 'text content',
          type: 'text'
        });
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Поиск в href атрибутах
    const links = doc.querySelectorAll('a[href^="mailto:"]');
    links.forEach(link => {
      const email = link.href.replace('mailto:', '').split('?')[0];
      if (email && !foundEmails.has(email.toLowerCase())) {
        foundEmails.add(email.toLowerCase());
        emails.push({
          email: email,
          source: 'mailto link',
          type: 'link',
          text: link.textContent.trim()
        });
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    return emails;
  };

  // Извлечение ссылок
  const extractLinks = (doc, baseUrl) => {
    const links = [];
    const foundLinks = new Set();
    const linkElements = doc.querySelectorAll('a[href]');
    
    linkElements.forEach(link => {
      let href = link.getAttribute('href');
      if (!href) return;
      
      // Обработка относительных ссылок
      if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        href = base.origin + href;
      } else if (href.startsWith('./') || href.startsWith('../')) {
        try {
          href = new URL(href, baseUrl).href;
        } catch (e) {
          return;
        }
      }
      
      if (href.startsWith('http') && !foundLinks.has(href)) {
        foundLinks.add(href);
        const isExternal = !href.includes(new URL(baseUrl).hostname);
        
        links.push({
          url: href,
          text: link.textContent.trim() || href,
          type: isExternal ? 'external' : 'internal',
          title: link.getAttribute('title') || ''
        });
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    return links;
  };

  // Извлечение данных
  const extractData = (doc) => {
    const data = [];
    
    // Заголовки
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      if (heading.textContent.trim()) {
        data.push({
          type: 'heading',
          level: heading.tagName.toLowerCase(),
          content: heading.textContent.trim(),
          position: index + 1
        });
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Параграфы
    const paragraphs = doc.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      if (p.textContent.trim() && p.textContent.trim().length > 20) {
        data.push({
          type: 'paragraph',
          content: p.textContent.trim().substring(0, 200) + '...',
          length: p.textContent.trim().length,
          position: index + 1
        });
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Изображения
    const images = doc.querySelectorAll('img[src]');
    images.forEach((img, index) => {
      data.push({
        type: 'image',
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title') || '',
        position: index + 1
      });
      setCurrentCount((prev) => prev + 1);
    });
    
    return data;
  };

  // Извлечение HTML элементов
  const extractHTML = (doc) => {
    const elements = [];
    const importantTags = ['title', 'meta', 'h1', 'h2', 'h3', 'form', 'table', 'script'];
    
    importantTags.forEach(tag => {
      const tagElements = doc.querySelectorAll(tag);
      tagElements.forEach((element, index) => {
        let content = '';
        
        if (tag === 'meta') {
          const name = element.getAttribute('name') || element.getAttribute('property');
          const content_attr = element.getAttribute('content');
          content = name ? `${name}: ${content_attr}` : content_attr;
        } else if (tag === 'script') {
          const src = element.getAttribute('src');
          content = src ? `External: ${src}` : 'Inline script';
        } else {
          content = element.textContent.trim().substring(0, 100);
        }
        
        if (content) {
          elements.push({
            tag: tag.toUpperCase(),
            content: content,
            attributes: element.attributes.length,
            position: index + 1
          });
          setCurrentCount((prev) => prev + 1);
        }
      });
    });
    
    return elements;
  };

  const handleStart = async () => {
    if (!targetUrl) {
      addLog('❌ Ошибка: Не указан целевой URL');
      return;
    }

    // Проверка URL
    try {
      new URL(targetUrl);
    } catch (e) {
      addLog('❌ Ошибка: Неверный формат URL');
      return;
    }

    // Инициализация таймера и счетчиков
    setElapsedTime(0);
    setCurrentCount(0);
    setEstimatedTotal(null);

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    setTimerInterval(interval);

    setIsRunning(true);
    setShowResults(false);
    setResults([]);
    
    addLog('🚀 Запуск HTML парсера...');
    addLog(`📋 Режим: ${modes[selectedMode].label}`);
    addLog(`🌐 Целевой URL: ${targetUrl}`);
    
    try {
      const parseResults = await realParser(targetUrl, selectedMode);
      setResults(parseResults);
      addLog(`✅ Парсинг завершен! Найдено результатов: ${parseResults.length}`);
      setShowResults(true);
    } catch (error) {
      addLog(`❌ Ошибка парсинга: ${error.message}`);
    } finally {
      setIsRunning(false);
      if (timerInterval) clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);
    setCurrentCount(0);
    setEstimatedTotal(null);
    addLog('🛑 Процесс остановлен пользователем');
  };

  const handleClearLogs = () => {
    setLogs([]);
    setResults([]);
    setShowResults(false);
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);
    setCurrentCount(0);
    setEstimatedTotal(null);
  };

  const downloadResults = () => {
    if (results.length === 0) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `parsing_results_${selectedMode}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const ResultCard = ({ result, index }) => {
    const mode = selectedMode;
    
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                #{index + 1}
              </span>
              {mode === 'email' && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {result.type}
                </span>
              )}
              {mode === 'links' && (
                <span className={`text-xs px-2 py-1 rounded ${
                  result.type === 'external' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {result.type}
                </span>
              )}
            </div>
            
            {mode === 'email' && (
              <div>
                <p className="font-mono text-sm text-blue-600 mb-1">{result.email}</p>
                <p className="text-xs text-gray-500">Источник: {result.source}</p>
                {result.text && <p className="text-xs text-gray-400 mt-1">Текст: {result.text}</p>}
              </div>
            )}
            
            {mode === 'links' && (
              <div>
                <p className="font-medium text-sm mb-1">{result.text}</p>
                <p className="font-mono text-xs text-blue-600 break-all">{result.url}</p>
                {result.title && <p className="text-xs text-gray-500 mt-1">Title: {result.title}</p>}
              </div>
            )}
            
            {mode === 'data' && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    {result.type}
                  </span>
                  {result.level && (
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                      {result.level}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800">{result.content}</p>
                {result.length && <p className="text-xs text-gray-500 mt-1">Длина: {result.length} символов</p>}
                {result.src && <p className="font-mono text-xs text-blue-600 mt-1">{result.src}</p>}
                {result.alt && <p className="text-xs text-gray-500 mt-1">Alt: {result.alt}</p>}
              </div>
            )}
            
            {mode === 'html' && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    {result.tag}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                    {result.attributes} атрибутов
                  </span>
                </div>
                <p className="text-sm text-gray-800">{result.content}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Заголовок */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {currentView === 'settings' && (
                  <button
                    onClick={() => setCurrentView('main')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-all duration-200"
                  >
                    <ArrowLeft size={20} />
                    <span>Назад</span>
                  </button>
                )}
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    HTML Парсер & Email Экстрактор
                  </h1>
                  <p className="text-gray-600 mt-1">Профессиональный инструмент для веб-скрапинга и извлечения данных</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView(currentView === 'main' ? 'settings' : 'main')}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow-sm"
                >
                  <Settings size={18} />
                  <span>{currentView === 'main' ? 'Настройки' : 'Главная'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Основной контент */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая панель */}
          <div className="lg:col-span-2 space-y-6">
            {currentView === 'main' ? (
              <>
                {/* Ввод целевого URL */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe size={20} className="text-blue-600" />
                    <h3 className="font-semibold text-gray-800">Целевой веб-сайт</h3>
                  </div>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Выбор режима */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Режим парсинга</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(modes).map(([key, mode]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedMode(key)}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 ${
                          selectedMode === key
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {mode.icon}
                        <span className="font-medium">{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Результаты */}
                {showResults && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">
                        Результаты парсинга ({results.length})
                      </h3>
                      <button
                        onClick={downloadResults}
                        className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        <Download size={16} />
                        <span>Скачать JSON</span>
                      </button>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {results.map((result, index) => (
                        <ResultCard key={index} result={result} index={index} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Настройки прокси
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Настройки прокси</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="proxy-enabled"
                      checked={proxyEnabled}
                      onChange={(e) => setProxyEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="proxy-enabled" className="text-gray-700">
                      Использовать прокси
                    </label>
                  </div>
                  
                  {proxyEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL прокси сервера
                      </label>
                      <input
                        type="url"
                        value={proxyUrl}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        placeholder="https://proxy.example.com:8080"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Примечание:</strong> Для обхода CORS ограничений используется публичный прокси сервис. 
                      Для более стабильной работы рекомендуется использовать собственный прокси сервер.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Правая панель */}
          <div className="space-y-6">
            {/* Панель управления */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Панель управления</h3>
              <div className="space-y-3">
                <button
                  onClick={handleStart}
                  disabled={isRunning || !targetUrl}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Play size={18} />
                  <span>{isRunning ? 'Выполняется...' : 'Запустить парсинг'}</span>
                </button>
                
                <button
                  onClick={handleStop}
                  disabled={!isRunning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Square size={18} />
                  <span>Остановить</span>
                </button>

                <button
                  onClick={handleClearLogs}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Download size={18} />
                  <span>Очистить логи</span>
                </button>
              </div>
            </div>

            {/* Статус */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Статус системы</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Режим:</span>
                  <span className="font-medium text-blue-600">{modes[selectedMode].label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Прокси:</span>
                  <span className={`font-medium ${proxyEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    {proxyEnabled ? 'Включен' : 'Выключен'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Результаты:</span>
                  <span className="font-medium text-green-600">{results.length} найдено</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Время выполнения:</span>
                  <span className="font-medium text-gray-800">
                    {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                  </span>
                </div>
                {isRunning && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Прогресс:</span>
                    <span className="font-medium text-blue-700">
                      {currentCount} {estimatedTotal ? `/ ${estimatedTotal}` : ''} найдено
                    </span>
                  </div>
                )}
                {isRunning && estimatedTotal && (
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min((currentCount / estimatedTotal) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Состояние:</span>
                  <span className={`font-medium ${isRunning ? 'text-yellow-600' : 'text-gray-600'}`}>
                    {isRunning ? 'Работает' : 'Ожидание'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Терминал */}
        <div className="mt-6 bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={20} className="text-green-600" />
              <h3 className="font-semibold text-gray-800">Лог выполнения</h3>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">Ожидание команд...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="text-green-400 mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HTMLParser;
