import React from 'react';
import { Shield, ShieldCheck, Settings } from 'lucide-react';

interface ProxySettingsProps {
  isEnabled: boolean;
  onToggle: () => void;
  proxyUrl: string;
  onProxyUrlChange: (url: string) => void;
}

export const ProxySettings: React.FC<ProxySettingsProps> = ({
  isEnabled,
  onToggle,
  proxyUrl,
  onProxyUrlChange
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-gray-600" />
          <h3 className="font-medium text-gray-800">Настройки прокси</h3>
        </div>
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isEnabled
              ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
        >
          {isEnabled ? (
            <>
              <ShieldCheck size={16} />
              <span>Включен</span>
            </>
          ) : (
            <>
              <Shield size={16} />
              <span>Выключен</span>
            </>
          )}
        </button>
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          URL прокси-сервера
        </label>
        <input
          type="text"
          value={proxyUrl}
          onChange={(e) => onProxyUrlChange(e.target.value)}
          placeholder="http://proxy.example.com:8080"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
            isEnabled
              ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-gray-50'
          }`}
          disabled={!isEnabled}
        />
      </div>
    </div>
  );
};