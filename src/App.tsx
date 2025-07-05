import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Square, Globe, Settings, Download, LogOut, User, History } from 'lucide-react';
import { Terminal } from './components/Terminal';
import { ProxySettings } from './components/ProxySettings';
import { FileUploader } from './components/FileUploader';
import { ModeSelector, ParseMode } from './components/ModeSelector';
import { ResultsDisplay } from './components/ResultsDisplay';
import { AuthModal } from './components/AuthModal';
import { SessionHistory } from './components/SessionHistory';
import { HTMLParser } from './utils/parser';
import { supabase } from './lib/supabase';

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedMode, setSelectedMode] = useState<ParseMode>('email');
  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'history'>('main');
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем текущего пользователя
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Слушаем изменения аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const createSession = async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('parsing_sessions')
        .insert({
          url: targetUrl,
          mode: selectedMode,
          proxy_enabled: proxyEnabled,
          proxy_url: proxyEnabled ? proxyUrl : null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Ошибка создания сессии:', error);
      return null;
    }
  };

  const updateSession = async (sessionId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('parsing_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Ошибка обновления сессии:', error);
    }
  };

  const saveResults = async (sessionId: string, parseResults: any[]) => {
    if (!parseResults.length) return;

    try {
      const resultsToInsert = parseResults.map(result => {
        let title = '';
        let content = '';
        let source = null;
        let type = selectedMode === 'links' ? 'link' : selectedMode === 'email' ? 'email' : selectedMode === 'data' ? 'data' : 'html';

        if (selectedMode === 'email') {
          title = 'Email';
          content = result.email;
          source = result.source;
        } else if (selectedMode === 'links') {
          title = result.text || 'Ссылка';
          content = result.url;
        } else if (selectedMode === 'data') {
          title = result.title;
          content = result.content;
        } else {
          title = result.tag;
          content = result.content;
        }

        return {
          session_id: sessionId,
          type,
          title,
          content,
          source,
        };
      });

      const { error } = await supabase
        .from('parsing_results')
        .insert(resultsToInsert);

      if (error) throw error;
    } catch (error) {
      console.error('Ошибка сохранения результатов:', error);
    }
  };

  const handleStart = async () => {
    if (!targetUrl) {
      addLog('❌ Ошибка: Не указан целевой URL');
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsRunning(true);
    setShowResults(false);
    setResults([]);
    
    addLog('🚀 Запуск HTML парсера...');
    addLog(`📋 Режим: ${getModeLabel(selectedMode)}`);
    addLog(`🌐 Целевой URL: ${targetUrl}`);
    addLog(`🔒 Прокси: ${proxyEnabled ? `Включен (${proxyUrl})` : 'Выключен'}`);
    
    // Создаем сессию в базе данных
    const sessionId = await createSession();
    setCurrentSessionId(sessionId);
    
    try {
      const parser = new HTMLParser(proxyEnabled ? proxyUrl : undefined);
      let parseResults: any[] = [];

      const onProgress = (message: string) => {
        addLog(message);
      };

      switch (selectedMode) {
        case 'email':
          parseResults = await parser.parseEmails(targetUrl, onProgress);
          break;
        case 'links':
          parseResults = await parser.parseLinks(targetUrl, onProgress);
          break;
        case 'data':
          parseResults = await parser.parseData(targetUrl, onProgress);
          break;
        case 'html':
          parseResults = await parser.parseHTML(targetUrl, onProgress);
          break;
      }

      setResults(parseResults);
      addLog(`✅ Парсинг завершен! Найдено результатов: ${parseResults.length}`);
      setShowResults(true);

      // Сохраняем результаты в базу данных
      if (sessionId) {
        await saveResults(sessionId, parseResults);
        await updateSession(sessionId, {
          status: 'completed',
          results_count: parseResults.length,
          completed_at: new Date().toISOString(),
        });
        addLog('💾 Результаты сохранены в базу данных');
      }
      
    } catch (error) {
      addLog(`❌ Ошибка парсинга: ${error}`);
      if (sessionId) {
        await updateSession(sessionId, {
          status: 'failed',
          completed_at: new Date().toISOString(),
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    addLog('🛑 Процесс остановлен пользователем');
    
    if (currentSessionId) {
      await updateSession(currentSessionId, {
        status: 'stopped',
        completed_at: new Date().toISOString(),
      });
    }
  };

  const handleBack = () => {
    setCurrentView('main');
  };

  const handleClearLogs = () => {
    setLogs([]);
    setResults([]);
    setShowResults(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleLoadSession = (sessionResults: any[], mode: string) => {
    setResults(sessionResults);
    setSelectedMode(mode as ParseMode);
    setShowResults(true);
    setCurrentView('main');
    addLog(`📂 Загружена сессия с ${sessionResults.length} результатами`);
  };

  const getModeLabel = (mode: ParseMode) => {
    const labels = {
      email: 'Извлечение Email',
      html: 'Парсинг HTML',
      data: 'Извлечение данных',
      links: 'Извлечение ссылок'
    };
    return labels[mode];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Заголовок */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(currentView === 'settings' || currentView === 'history') && (
                  <button
                    onClick={handleBack}
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
                {user ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                      <User size={16} />
                      <span className="text-sm">{user.email}</span>
                    </div>
                    <button
                      onClick={() => setCurrentView('history')}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-lg hover:from-purple-200 hover:to-purple-300 transition-all duration-200 shadow-sm"
                    >
                      <History size={18} />
                      <span>История</span>
                    </button>
                    <button
                      onClick={() => setCurrentView(currentView === 'main' ? 'settings' : 'main')}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow-sm"
                    >
                      <Settings size={18} />
                      <span>{currentView === 'main' ? 'Настройки' : 'Главная'}</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-100 to-red-200 text-red-700 rounded-lg hover:from-red-200 hover:to-red-300 transition-all duration-200 shadow-sm"
                    >
                      <LogOut size={18} />
                      <span>Выйти</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm"
                  >
                    <User size={18} />
                    <span>Войти</span>
                  </button>
                )}
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

                {/* Загрузка файлов */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Загрузка файлов</h3>
                  <FileUploader files={files} onFilesChange={setFiles} />
                </div>

                {/* Выбор режима */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <ModeSelector selectedMode={selectedMode} onModeChange={setSelectedMode} />
                </div>

                {/* Результаты */}
                <ResultsDisplay 
                  mode={selectedMode} 
                  results={results} 
                  isVisible={showResults} 
                />
              </>
            ) : currentView === 'settings' ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <ProxySettings
                  isEnabled={proxyEnabled}
                  onToggle={() => setProxyEnabled(!proxyEnabled)}
                  proxyUrl={proxyUrl}
                  onProxyUrlChange={setProxyUrl}
                />
              </div>
            ) : (
              <SessionHistory onLoadSession={handleLoadSession} />
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
                  <span className="text-gray-600">Пользователь:</span>
                  <span className={`font-medium ${user ? 'text-green-600' : 'text-red-600'}`}>
                    {user ? 'Авторизован' : 'Не авторизован'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Режим:</span>
                  <span className="font-medium text-blue-600">{getModeLabel(selectedMode)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Прокси:</span>
                  <span className={`font-medium ${proxyEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    {proxyEnabled ? 'Включен' : 'Выключен'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Файлы:</span>
                  <span className="font-medium text-gray-800">{files.length} выбрано</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Результаты:</span>
                  <span className="font-medium text-green-600">{results.length} найдено</span>
                </div>
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
        <div className="mt-6">
          <Terminal isRunning={isRunning} logs={logs} />
        </div>
      </div>

      {/* Модальное окно авторизации */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          addLog('✅ Успешная авторизация');
        }}
      />
    </div>
  );
}

export default App;