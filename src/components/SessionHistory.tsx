import React, { useState, useEffect } from 'react';
import { Clock, Download, Trash2, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type ParseSession = Database['public']['Tables']['parsing_sessions']['Row'];
type ParseResult = Database['public']['Tables']['parsing_results']['Row'];

interface SessionHistoryProps {
  onLoadSession: (results: any[], mode: string) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onLoadSession }) => {
  const [sessions, setSessions] = useState<ParseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<ParseResult[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('parsing_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Ошибка загрузки сессий:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionResults = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('parsing_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSessionResults(data || []);
      setSelectedSession(sessionId);
    } catch (error) {
      console.error('Ошибка загрузки результатов:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Удалить эту сессию и все её результаты?')) return;

    try {
      const { error } = await supabase
        .from('parsing_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setSessionResults([]);
      }
    } catch (error) {
      console.error('Ошибка удаления сессии:', error);
    }
  };

  const downloadResults = (session: ParseSession, results: ParseResult[]) => {
    const content = results.map(result => {
      if (session.mode === 'email') return result.content;
      if (session.mode === 'links') return result.content;
      return `${result.title}: ${result.content}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parsing_${session.mode}_${new Date(session.created_at).toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadIntoApp = (session: ParseSession, results: ParseResult[]) => {
    const formattedResults = results.map(result => {
      if (session.mode === 'email') {
        return { email: result.content, source: result.source || 'Неизвестно' };
      } else if (session.mode === 'links') {
        return { url: result.content, text: result.title };
      } else if (session.mode === 'data') {
        return { title: result.title, content: result.content };
      } else {
        return { tag: result.title, content: result.content };
      }
    });

    onLoadSession(formattedResults, session.mode);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'running': return 'text-yellow-600 bg-yellow-100';
      case 'stopped': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Завершено';
      case 'failed': return 'Ошибка';
      case 'running': return 'Выполняется';
      case 'stopped': return 'Остановлено';
      default: return status;
    }
  };

  const getModeText = (mode: string) => {
    switch (mode) {
      case 'email': return 'Email';
      case 'links': return 'Ссылки';
      case 'data': return 'Данные';
      case 'html': return 'HTML';
      default: return mode;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-blue-600" size={24} />
          <span className="ml-2 text-gray-600">Загрузка истории...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">История парсинга</h3>
        </div>
        <button
          onClick={loadSessions}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          История парсинга пуста
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sessions.map((session) => (
            <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                    {getStatusText(session.status)}
                  </span>
                  <span className="text-sm font-medium text-blue-600">
                    {getModeText(session.mode)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => loadSessionResults(session.id)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Просмотреть результаты"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Удалить сессию"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-2 truncate">
                <strong>URL:</strong> {session.url}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(session.created_at).toLocaleString('ru-RU')}</span>
                <span>{session.results_count} результатов</span>
              </div>

              {selectedSession === session.id && sessionResults.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => loadIntoApp(session, sessionResults)}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      <Eye size={12} />
                      Загрузить в приложение
                    </button>
                    <button
                      onClick={() => downloadResults(session, sessionResults)}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                    >
                      <Download size={12} />
                      Скачать
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {sessionResults.slice(0, 5).map((result) => (
                      <div key={result.id} className="text-xs bg-gray-100 p-2 rounded">
                        <div className="font-medium">{result.title}</div>
                        <div className="text-gray-600 truncate">{result.content}</div>
                      </div>
                    ))}
                    {sessionResults.length > 5 && (
                      <div className="text-xs text-gray-500 text-center">
                        ... и ещё {sessionResults.length - 5} результатов
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};