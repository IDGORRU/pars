import React, { useState, useEffect } from 'react';
import { Play, Square, Globe, Settings, Download, ArrowLeft, Terminal, FileText, Link, Mail, Code2, Shield, Key, CreditCard } from 'lucide-react';
import { realParser } from '../utils/realParser.js';

const HTMLParser = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedMode, setSelectedMode] = useState('email');
  const [currentView, setCurrentView] = useState('main');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [proxyUrl, setProxyUrl] = useState('');
  const [activeProxy, setActiveProxy] = useState(null);
  
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
    html: { label: 'Парсинг HTML', icon: <Code2 size={16} />, color: 'orange' },
    credentials: { label: 'Поиск логинов/паролей', icon: <Shield size={16} />, color: 'red' },
    keys: { label: 'Поиск ключей/токенов', icon: <Key size={16} />, color: 'yellow' },
    giftcards: { label: 'Поиск подарочных карт', icon: <CreditCard size={16} />, color: 'pink' }
  };

  // Внутренний парсер как резервный вариант
  const internalParser = async (url, mode) => {
    try {
      addLog(`🔍 Запуск внутреннего парсинга ${url}...`);
      
      // Используем CORS proxy для обхода блокировок
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      addLog(`📡 Загрузка HTML контента через внутренний парсер...`);
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const htmlContent = data.contents;
      
      addLog(`✅ HTML загружен внутренним парсером (${htmlContent.length} символов)`);
      addLog(`🔄 Анализ контента в режиме "${modes[mode].label}"...`);
      
      // Создаем виртуальный DOM для парсинга
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Устанавливаем приблизительное количество элементов
      setEstimatedTotal(doc.querySelectorAll('a, p, h1, h2, h3, img, input, form, script').length);
      
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
        case 'credentials':
          results = extractCredentials(doc, htmlContent);
          break;
        case 'keys':
          results = extractKeys(doc, htmlContent);
          break;
        case 'giftcards':
          results = extractGiftCards(doc, htmlContent);
          break;
      }
      
      addLog(`🎯 Внутренний парсер нашел ${results.length} результатов`);
      return results;
      
    } catch (error) {
      addLog(`❌ Ошибка внутреннего парсинга: ${error.message}`);
      throw error;
    }
  };

  // Извлечение логинов и паролей
  const extractCredentials = (doc, htmlContent) => {
    addLog(`🔐 Начинаем поиск логинов и паролей...`);
    const credentials = [];
    const foundItems = new Set();
    
    // Поиск полей ввода логинов и паролей
    addLog(`🔍 Поиск полей ввода...`);
    const loginInputs = doc.querySelectorAll('input[type="text"], input[type="email"], input[name*="login"], input[name*="user"], input[name*="email"], input[id*="login"], input[id*="user"], input[id*="email"]');
    const passwordInputs = doc.querySelectorAll('input[type="password"], input[name*="pass"], input[id*="pass"]');
    
    addLog(`🔑 Найдено полей логина: ${loginInputs.length}`);
    addLog(`🔒 Найдено полей пароля: ${passwordInputs.length}`);
    
    // Анализ полей логина
    loginInputs.forEach((input, index) => {
      const name = input.getAttribute('name') || '';
      const id = input.getAttribute('id') || '';
      const placeholder = input.getAttribute('placeholder') || '';
      const value = input.getAttribute('value') || '';
      
      const key = `login_${name}_${id}_${index}`;
      if (!foundItems.has(key)) {
        foundItems.add(key);
        credentials.push({
          type: 'login_field',
          name: name,
          id: id,
          placeholder: placeholder,
          value: value,
          element: 'input',
          inputType: input.getAttribute('type') || 'text'
        });
        addLog(`👤 Поле логина #${credentials.length}: name="${name}" id="${id}" placeholder="${placeholder}"`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Анализ полей пароля
    passwordInputs.forEach((input, index) => {
      const name = input.getAttribute('name') || '';
      const id = input.getAttribute('id') || '';
      const placeholder = input.getAttribute('placeholder') || '';
      
      const key = `password_${name}_${id}_${index}`;
      if (!foundItems.has(key)) {
        foundItems.add(key);
        credentials.push({
          type: 'password_field',
          name: name,
          id: id,
          placeholder: placeholder,
          element: 'input',
          inputType: 'password'
        });
        addLog(`🔒 Поле пароля #${credentials.length}: name="${name}" id="${id}" placeholder="${placeholder}"`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Поиск форм аутентификации
    addLog(`🔍 Поиск форм аутентификации...`);
    const authForms = doc.querySelectorAll('form');
    let authFormsCount = 0;
    
    authForms.forEach((form, index) => {
      const action = form.getAttribute('action') || '';
      const method = form.getAttribute('method') || 'GET';
      const hasPasswordField = form.querySelector('input[type="password"]');
      const hasLoginField = form.querySelector('input[type="text"], input[type="email"]');
      
      if (hasPasswordField || hasLoginField) {
        authFormsCount++;
        credentials.push({
          type: 'auth_form',
          action: action,
          method: method.toUpperCase(),
          hasLogin: !!hasLoginField,
          hasPassword: !!hasPasswordField,
          element: 'form',
          formIndex: index + 1
        });
        addLog(`📝 Форма аутентификации #${authFormsCount}: action="${action}" method="${method}"`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Поиск паттернов логинов в тексте
    addLog(`🔍 Поиск паттернов логинов в тексте...`);
    const loginPatterns = [
      /(?:username|login|user|email)[\s:=]+([a-zA-Z0-9._-]+@?[a-zA-Z0-9.-]*)/gi,
      /(?:логин|пользователь)[\s:=]+([a-zA-Z0-9._-]+)/gi
    ];
    
    loginPatterns.forEach(pattern => {
      const matches = htmlContent.match(pattern) || [];
      matches.forEach(match => {
        if (!foundItems.has(match)) {
          foundItems.add(match);
          credentials.push({
            type: 'login_pattern',
            content: match.trim(),
            source: 'text_content',
            element: 'text'
          });
          addLog(`🔍 Паттерн логина: ${match.trim()}`);
          setCurrentCount((prev) => prev + 1);
        }
      });
    });
    
    addLog(`✅ Поиск учетных данных завершен. Найдено: ${credentials.length} элементов`);
    return credentials;
  };

  // Извлечение ключей и токенов
  const extractKeys = (doc, htmlContent) => {
    addLog(`🔑 Начинаем поиск ключей и токенов...`);
    const keys = [];
    const foundKeys = new Set();
    
    // Паттерны для поиска различных типов ключей
    const keyPatterns = [
      { name: 'API Key', pattern: /(?:api[_-]?key|apikey)[\s:=]+([a-zA-Z0-9_-]{20,})/gi },
      { name: 'Access Token', pattern: /(?:access[_-]?token|accesstoken)[\s:=]+([a-zA-Z0-9._-]{20,})/gi },
      { name: 'Secret Key', pattern: /(?:secret[_-]?key|secretkey)[\s:=]+([a-zA-Z0-9_-]{20,})/gi },
      { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },
      { name: 'Bearer Token', pattern: /Bearer\s+([a-zA-Z0-9._-]{20,})/gi },
      { name: 'Private Key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi },
      { name: 'Public Key', pattern: /-----BEGIN\s+PUBLIC\s+KEY-----[\s\S]*?-----END\s+PUBLIC\s+KEY-----/gi },
      { name: 'Certificate', pattern: /-----BEGIN\s+CERTIFICATE-----[\s\S]*?-----END\s+CERTIFICATE-----/gi },
      { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
      { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
      { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g }
    ];
    
    addLog(`🔍 Поиск ключей по ${keyPatterns.length} паттернам...`);
    
    keyPatterns.forEach(({ name, pattern }) => {
      const matches = htmlContent.match(pattern) || [];
      addLog(`🔑 ${name}: найдено ${matches.length} совпадений`);
      
      matches.forEach((match, index) => {
        if (!foundKeys.has(match)) {
          foundKeys.add(match);
          keys.push({
            type: 'key',
            keyType: name,
            content: match.length > 100 ? match.substring(0, 100) + '...' : match,
            fullContent: match,
            source: 'text_content',
            length: match.length
          });
          
          if (index < 3) { // Показываем только первые 3 для каждого типа
            addLog(`🔐 ${name} #${index + 1}: ${match.substring(0, 50)}${match.length > 50 ? '...' : ''}`);
          }
          setCurrentCount((prev) => prev + 1);
        }
      });
      
      if (matches.length > 3) {
        addLog(`🔐 ... и еще ${matches.length - 3} ключей типа ${name}`);
      }
    });
    
    // Поиск в meta тегах
    addLog(`🔍 Поиск ключей в meta тегах...`);
    const metaTags = doc.querySelectorAll('meta[name*="key"], meta[name*="token"], meta[property*="key"], meta[property*="token"]');
    
    metaTags.forEach((meta, index) => {
      const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
      const content = meta.getAttribute('content') || '';
      
      if (content && content.length > 10) {
        const key = `meta_${name}_${content}`;
        if (!foundKeys.has(key)) {
          foundKeys.add(key);
          keys.push({
            type: 'meta_key',
            keyType: 'Meta Tag Key',
            name: name,
            content: content.length > 100 ? content.substring(0, 100) + '...' : content,
            fullContent: content,
            source: 'meta_tag'
          });
          addLog(`🏷️ Meta ключ: ${name} = ${content.substring(0, 30)}...`);
          setCurrentCount((prev) => prev + 1);
        }
      }
    });
    
    // Поиск в скриптах
    addLog(`🔍 Поиск ключей в JavaScript...`);
    const scripts = doc.querySelectorAll('script');
    let scriptKeysFound = 0;
    
    scripts.forEach((script, index) => {
      const scriptContent = script.textContent || '';
      if (scriptContent) {
        keyPatterns.forEach(({ name, pattern }) => {
          const matches = scriptContent.match(pattern) || [];
          matches.forEach(match => {
            if (!foundKeys.has(match)) {
              foundKeys.add(match);
              scriptKeysFound++;
              keys.push({
                type: 'script_key',
                keyType: `${name} (Script)`,
                content: match.length > 100 ? match.substring(0, 100) + '...' : match,
                fullContent: match,
                source: 'javascript',
                scriptIndex: index + 1
              });
              setCurrentCount((prev) => prev + 1);
            }
          });
        });
      }
    });
    
    if (scriptKeysFound > 0) {
      addLog(`📜 Найдено ключей в JavaScript: ${scriptKeysFound}`);
    }
    
    addLog(`✅ Поиск ключей завершен. Найдено: ${keys.length} ключей и токенов`);
    return keys;
  };

  // Извлечение подарочных карт
  const extractGiftCards = (doc, htmlContent) => {
    addLog(`🎁 Начинаем поиск подарочных карт...`);
    const giftCards = [];
    const foundCards = new Set();
    
    // Паттерны для поиска подарочных карт
    const giftCardPatterns = [
      { name: 'Gift Card Code', pattern: /(?:gift[_-]?card|giftcard|подарочная[_-]?карта)[\s:=]*([A-Z0-9]{10,20})/gi },
      { name: 'Promo Code', pattern: /(?:promo[_-]?code|promocode|промо[_-]?код)[\s:=]*([A-Z0-9]{4,15})/gi },
      { name: 'Discount Code', pattern: /(?:discount[_-]?code|discountcode|код[_-]?скидки)[\s:=]*([A-Z0-9]{4,15})/gi },
      { name: 'Coupon Code', pattern: /(?:coupon[_-]?code|couponcode|купон)[\s:=]*([A-Z0-9]{4,15})/gi },
      { name: 'Voucher Code', pattern: /(?:voucher[_-]?code|vouchercode|ваучер)[\s:=]*([A-Z0-9]{4,15})/gi },
      { name: 'Redeem Code', pattern: /(?:redeem[_-]?code|redeemcode|код[_-]?активации)[\s:=]*([A-Z0-9]{8,20})/gi },
      { name: 'Steam Key', pattern: /[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}/g },
      { name: 'iTunes Code', pattern: /[A-Z0-9]{4}[A-Z0-9]{4}[A-Z0-9]{4}[A-Z0-9]{1}/g },
      { name: 'Google Play Code', pattern: /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/g },
      { name: 'Amazon Gift Card', pattern: /[A-Z0-9]{4}-[A-Z0-9]{6}-[A-Z0-9]{4}/g }
    ];
    
    addLog(`🔍 Поиск кодов по ${giftCardPatterns.length} паттернам...`);
    
    giftCardPatterns.forEach(({ name, pattern }) => {
      const matches = htmlContent.match(pattern) || [];
      addLog(`🎫 ${name}: найдено ${matches.length} совпадений`);
      
      matches.forEach((match, index) => {
        const cleanMatch = match.replace(/^[^A-Z0-9]*/, '').replace(/[^A-Z0-9-]*$/, '');
        if (!foundCards.has(cleanMatch) && cleanMatch.length >= 4) {
          foundCards.add(cleanMatch);
          giftCards.push({
            type: 'gift_card',
            cardType: name,
            code: cleanMatch,
            originalMatch: match,
            source: 'text_content',
            length: cleanMatch.length
          });
          
          if (index < 5) { // Показываем только первые 5 для каждого типа
            addLog(`🎁 ${name} #${index + 1}: ${cleanMatch}`);
          }
          setCurrentCount((prev) => prev + 1);
        }
      });
      
      if (matches.length > 5) {
        addLog(`🎁 ... и еще ${matches.length - 5} кодов типа ${name}`);
      }
    });
    
    // Поиск в полях ввода
    addLog(`🔍 Поиск полей ввода для кодов...`);
    const codeInputs = doc.querySelectorAll('input[name*="code"], input[name*="gift"], input[name*="promo"], input[name*="coupon"], input[id*="code"], input[id*="gift"], input[id*="promo"], input[id*="coupon"]');
    
    codeInputs.forEach((input, index) => {
      const name = input.getAttribute('name') || '';
      const id = input.getAttribute('id') || '';
      const placeholder = input.getAttribute('placeholder') || '';
      const value = input.getAttribute('value') || '';
      
      giftCards.push({
        type: 'code_input',
        cardType: 'Code Input Field',
        name: name,
        id: id,
        placeholder: placeholder,
        value: value,
        source: 'input_field'
      });
      addLog(`📝 Поле для кода #${index + 1}: name="${name}" placeholder="${placeholder}"`);
      setCurrentCount((prev) => prev + 1);
    });
    
    // Поиск в data атрибутах
    addLog(`🔍 Поиск кодов в data атрибутах...`);
    const elementsWithData = doc.querySelectorAll('[data-code], [data-gift], [data-promo], [data-coupon]');
    
    elementsWithData.forEach((element, index) => {
      const dataCode = element.getAttribute('data-code') || '';
      const dataGift = element.getAttribute('data-gift') || '';
      const dataPromo = element.getAttribute('data-promo') || '';
      const dataCoupon = element.getAttribute('data-coupon') || '';
      
      [dataCode, dataGift, dataPromo, dataCoupon].forEach(code => {
        if (code && code.length >= 4 && !foundCards.has(code)) {
          foundCards.add(code);
          giftCards.push({
            type: 'data_attribute',
            cardType: 'Data Attribute Code',
            code: code,
            source: 'data_attribute',
            element: element.tagName.toLowerCase()
          });
          addLog(`🏷️ Data атрибут код: ${code}`);
          setCurrentCount((prev) => prev + 1);
        }
      });
    });
    
    // Поиск QR кодов (по alt тексту изображений)
    addLog(`🔍 Поиск QR кодов...`);
    const qrImages = doc.querySelectorAll('img[alt*="qr"], img[alt*="QR"], img[src*="qr"], img[src*="QR"]');
    
    qrImages.forEach((img, index) => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      
      giftCards.push({
        type: 'qr_code',
        cardType: 'QR Code',
        src: src,
        alt: alt,
        source: 'image'
      });
      addLog(`📱 QR код #${index + 1}: ${alt || src.substring(0, 50)}`);
      setCurrentCount((prev) => prev + 1);
    });
    
    addLog(`✅ Поиск подарочных карт завершен. Найдено: ${giftCards.length} элементов`);
    return giftCards;
  };

  // Извлечение email адресов
  const extractEmails = (doc, htmlContent) => {
    addLog(`📧 Начинаем поиск email адресов...`);
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = [];
    const foundEmails = new Set();
    
    // Поиск в тексте
    addLog(`🔍 Поиск email в тексте страницы...`);
    const textMatches = htmlContent.match(emailRegex) || [];
    addLog(`📝 Найдено в тексте: ${textMatches.length} потенциальных email`);
    
    textMatches.forEach((email, index) => {
      if (!foundEmails.has(email.toLowerCase())) {
        foundEmails.add(email.toLowerCase());
        emails.push({
          email: email,
          source: 'text content',
          type: 'text'
        });
        addLog(`✉️ Email #${emails.length}: ${email} (из текста)`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Поиск в href атрибутах
    addLog(`🔗 Поиск email в mailto ссылках...`);
    const links = doc.querySelectorAll('a[href^="mailto:"]');
    addLog(`📎 Найдено mailto ссылок: ${links.length}`);
    
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
        addLog(`📧 Email #${emails.length}: ${email} (из mailto ссылки)`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    addLog(`✅ Поиск email завершен. Всего найдено: ${emails.length} уникальных адресов`);
    return emails;
  };

  // Извлечение ссылок
  const extractLinks = (doc, baseUrl) => {
    addLog(`🔗 Начинаем извлечение ссылок...`);
    const links = [];
    const foundLinks = new Set();
    const linkElements = doc.querySelectorAll('a[href]');
    
    addLog(`🔍 Найдено элементов <a> с href: ${linkElements.length}`);
    
    linkElements.forEach((link, index) => {
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
        
        addLog(`🌐 Ссылка #${links.length}: ${isExternal ? 'Внешняя' : 'Внутренняя'} - ${href.substring(0, 60)}${href.length > 60 ? '...' : ''}`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    const internalCount = links.filter(l => l.type === 'internal').length;
    const externalCount = links.filter(l => l.type === 'external').length;
    addLog(`✅ Извлечение ссылок завершено. Внутренних: ${internalCount}, Внешних: ${externalCount}`);
    
    return links;
  };

  // Извлечение данных
  const extractData = (doc) => {
    addLog(`📊 Начинаем извлечение структурированных данных...`);
    const data = [];
    
    // Заголовки
    addLog(`🔍 Поиск заголовков (h1-h6)...`);
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    addLog(`📋 Найдено заголовков: ${headings.length}`);
    
    headings.forEach((heading, index) => {
      if (heading.textContent.trim()) {
        data.push({
          type: 'heading',
          level: heading.tagName.toLowerCase(),
          content: heading.textContent.trim(),
          position: index + 1
        });
        addLog(`📝 ${heading.tagName}: ${heading.textContent.trim().substring(0, 50)}${heading.textContent.trim().length > 50 ? '...' : ''}`);
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    // Параграфы
    addLog(`🔍 Поиск параграфов...`);
    const paragraphs = doc.querySelectorAll('p');
    let validParagraphs = 0;
    
    paragraphs.forEach((p, index) => {
      if (p.textContent.trim() && p.textContent.trim().length > 20) {
        validParagraphs++;
        data.push({
          type: 'paragraph',
          content: p.textContent.trim().substring(0, 200) + '...',
          length: p.textContent.trim().length,
          position: index + 1
        });
        
        if (validParagraphs <= 5) { // Показываем только первые 5 для экономии места в логах
          addLog(`📄 Параграф #${validParagraphs}: ${p.textContent.trim().substring(0, 40)}... (${p.textContent.trim().length} символов)`);
        }
        setCurrentCount((prev) => prev + 1);
      }
    });
    
    if (validParagraphs > 5) {
      addLog(`📄 ... и еще ${validParagraphs - 5} параграфов`);
    }
    
    // Изображения
    addLog(`🔍 Поиск изображений...`);
    const images = doc.querySelectorAll('img[src]');
    addLog(`🖼️ Найдено изображений: ${images.length}`);
    
    images.forEach((img, index) => {
      const src = img.getAttribute('src');
      data.push({
        type: 'image',
        src: src,
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title') || '',
        position: index + 1
      });
      
      if (index < 3) { // Показываем только первые 3 изображения
        addLog(`🖼️ Изображение #${index + 1}: ${src.substring(0, 50)}${src.length > 50 ? '...' : ''}`);
      }
      setCurrentCount((prev) => prev + 1);
    });
    
    if (images.length > 3) {
      addLog(`🖼️ ... и еще ${images.length - 3} изображений`);
    }
    
    addLog(`✅ Извлечение данных завершено. Заголовков: ${headings.length}, Параграфов: ${validParagraphs}, Изображений: ${images.length}`);
    return data;
  };

  // Извлечение HTML элементов
  const extractHTML = (doc) => {
    addLog(`🏗️ Начинаем анализ HTML структуры...`);
    const elements = [];
    const importantTags = ['title', 'meta', 'h1', 'h2', 'h3', 'form', 'table', 'script'];
    
    importantTags.forEach(tag => {
      addLog(`🔍 Поиск элементов <${tag}>...`);
      const tagElements = doc.querySelectorAll(tag);
      
      if (tagElements.length > 0) {
        addLog(`📋 Найдено <${tag}>: ${tagElements.length} элементов`);
      }
      
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
          
          if (index < 2) { // Показываем только первые 2 элемента каждого типа
            addLog(`🏷️ ${tag.toUpperCase()} #${index + 1}: ${content.substring(0, 40)}${content.length > 40 ? '...' : ''}`);
          }
          setCurrentCount((prev) => prev + 1);
        }
      });
      
      if (tagElements.length > 2) {
        addLog(`🏷️ ... и еще ${tagElements.length - 2} элементов <${tag}>`);
      }
    });
    
    addLog(`✅ Анализ HTML завершен. Всего важных элементов: ${elements.length}`);
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
    setActiveProxy(null);

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
      let parseResults;
      
      // Пробуем сначала внешний парсер
      try {
        addLog('🔄 Попытка использования внешнего парсера...');
        const parseResult = await realParser(targetUrl, addLog, setActiveProxy);
        
        if (parseResult.success) {
          addLog(`🔄 Анализ контента в режиме "${modes[selectedMode].label}"...`);
          addLog(`📄 Заголовок страницы: ${parseResult.title}`);
          addLog(`📝 Размер контента: ${parseResult.content.length} символов`);
          
          // Создаем виртуальный DOM для парсинга
          const parser = new DOMParser();
          const doc = parser.parseFromString(parseResult.content, 'text/html');
          
          // Устанавливаем приблизительное количество элементов
          const totalElements = doc.querySelectorAll('a, p, h1, h2, h3, img, input, form, script').length;
          setEstimatedTotal(totalElements);
          addLog(`📊 Обнаружено элементов для анализа: ${totalElements}`);
          
          switch(selectedMode) {
            case 'email':
              parseResults = extractEmails(doc, parseResult.content);
              break;
            case 'links':
              parseResults = extractLinks(doc, targetUrl);
              break;
            case 'data':
              parseResults = extractData(doc);
              break;
            case 'html':
              parseResults = extractHTML(doc);
              break;
            case 'credentials':
              parseResults = extractCredentials(doc, parseResult.content);
              break;
            case 'keys':
              parseResults = extractKeys(doc, parseResult.content);
              break;
            case 'giftcards':
              parseResults = extractGiftCards(doc, parseResult.content);
              break;
          }
          
          addLog(`✅ Внешний парсер успешно завершен!`);
        } else {
          throw new Error(parseResult.error);
        }
      } catch (externalError) {
        addLog(`⚠️ Внешний парсер не сработал: ${externalError.message}`);
        addLog('🔄 Переключение на внутренний парсер...');
        
        // Используем внутренний парсер как fallback
        parseResults = await internalParser(targetUrl, selectedMode);
      }
      
      setResults(parseResults);
      addLog(`✅ Парсинг завершен! Найдено результатов: ${parseResults.length}`);
      
      // Показываем краткую сводку результатов
      if (parseResults.length > 0) {
        addLog(`📊 СВОДКА РЕЗУЛЬТАТОВ:`);
        if (selectedMode === 'email') {
          const textEmails = parseResults.filter(r => r.type === 'text').length;
          const linkEmails = parseResults.filter(r => r.type === 'link').length;
          addLog(`   📧 Email из текста: ${textEmails}`);
          addLog(`   🔗 Email из ссылок: ${linkEmails}`);
        } else if (selectedMode === 'links') {
          const internal = parseResults.filter(r => r.type === 'internal').length;
          const external = parseResults.filter(r => r.type === 'external').length;
          addLog(`   🏠 Внутренние ссылки: ${internal}`);
          addLog(`   🌐 Внешние ссылки: ${external}`);
        } else if (selectedMode === 'data') {
          const headings = parseResults.filter(r => r.type === 'heading').length;
          const paragraphs = parseResults.filter(r => r.type === 'paragraph').length;
          const images = parseResults.filter(r => r.type === 'image').length;
          addLog(`   📝 Заголовки: ${headings}`);
          addLog(`   📄 Параграфы: ${paragraphs}`);
          addLog(`   🖼️ Изображения: ${images}`);
        } else if (selectedMode === 'credentials') {
          const loginFields = parseResults.filter(r => r.type === 'login_field').length;
          const passwordFields = parseResults.filter(r => r.type === 'password_field').length;
          const authForms = parseResults.filter(r => r.type === 'auth_form').length;
          addLog(`   👤 Поля логина: ${loginFields}`);
          addLog(`   🔒 Поля пароля: ${passwordFields}`);
          addLog(`   📝 Формы аутентификации: ${authForms}`);
        } else if (selectedMode === 'keys') {
          const keyTypes = {};
          parseResults.forEach(r => {
            if (r.keyType) {
              keyTypes[r.keyType] = (keyTypes[r.keyType] || 0) + 1;
            }
          });
          Object.entries(keyTypes).forEach(([type, count]) => {
            addLog(`   🔑 ${type}: ${count}`);
          });
        } else if (selectedMode === 'giftcards') {
          const cardTypes = {};
          parseResults.forEach(r => {
            if (r.cardType) {
              cardTypes[r.cardType] = (cardTypes[r.cardType] || 0) + 1;
            }
          });
          Object.entries(cardTypes).forEach(([type, count]) => {
            addLog(`   🎁 ${type}: ${count}`);
          });
        }
      }
      
      setShowResults(true);
    } catch (error) {
      addLog(`❌ Ошибка парсинга: ${error.message}`);
    } finally {
      setIsRunning(false);
      if (timerInterval) clearInterval(timerInterval);
      setTimerInterval(null);
      setActiveProxy(null);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);
    setCurrentCount(0);
    setEstimatedTotal(null);
    setActiveProxy(null);
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
    setActiveProxy(null);
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
              {mode === 'credentials' && (
                <span className={`text-xs px-2 py-1 rounded ${
                  result.type === 'password_field' 
                    ? 'bg-red-100 text-red-800' 
                    : result.type === 'login_field'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {result.type.replace('_', ' ')}
                </span>
              )}
              {mode === 'keys' && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {result.keyType}
                </span>
              )}
              {mode === 'giftcards' && (
                <span className="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded">
                  {result.cardType}
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

            {mode === 'credentials' && (
              <div>
                {result.type === 'login_field' || result.type === 'password_field' ? (
                  <div>
                    <p className="font-mono text-sm text-blue-600 mb-1">
                      {result.name && `name="${result.name}"`}
                      {result.id && ` id="${result.id}"`}
                    </p>
                    {result.placeholder && <p className="text-xs text-gray-500">Placeholder: {result.placeholder}</p>}
                    {result.value && <p className="text-xs text-gray-500">Value: {result.value}</p>}
                    <p className="text-xs text-gray-400 mt-1">Type: {result.inputType}</p>
                  </div>
                ) : result.type === 'auth_form' ? (
                  <div>
                    <p className="font-medium text-sm mb-1">Form #{result.formIndex}</p>
                    <p className="text-xs text-gray-500">Action: {result.action || 'не указан'}</p>
                    <p className="text-xs text-gray-500">Method: {result.method}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Логин: {result.hasLogin ? '✅' : '❌'} | Пароль: {result.hasPassword ? '✅' : '❌'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-mono text-sm text-blue-600">{result.content}</p>
                    <p className="text-xs text-gray-500">Источник: {result.source}</p>
                  </div>
                )}
              </div>
            )}

            {mode === 'keys' && (
              <div>
                <p className="font-mono text-sm text-blue-600 mb-1 break-all">{result.content}</p>
                <p className="text-xs text-gray-500">Источник: {result.source}</p>
                {result.length && <p className="text-xs text-gray-400 mt-1">Длина: {result.length} символов</p>}
                {result.name && <p className="text-xs text-gray-400 mt-1">Имя: {result.name}</p>}
              </div>
            )}

            {mode === 'giftcards' && (
              <div>
                {result.type === 'gift_card' ? (
                  <div>
                    <p className="font-mono text-lg font-bold text-green-600 mb-1">{result.code}</p>
                    <p className="text-xs text-gray-500">Источник: {result.source}</p>
                    {result.originalMatch !== result.code && (
                      <p className="text-xs text-gray-400 mt-1">Оригинал: {result.originalMatch}</p>
                    )}
                  </div>
                ) : result.type === 'code_input' ? (
                  <div>
                    <p className="font-medium text-sm mb-1">Поле для ввода кода</p>
                    <p className="font-mono text-xs text-blue-600">
                      {result.name && `name="${result.name}"`}
                      {result.id && ` id="${result.id}"`}
                    </p>
                    {result.placeholder && <p className="text-xs text-gray-500">Placeholder: {result.placeholder}</p>}
                    {result.value && <p className="text-xs text-gray-500">Value: {result.value}</p>}
                  </div>
                ) : result.type === 'qr_code' ? (
                  <div>
                    <p className="font-medium text-sm mb-1">QR код</p>
                    <p className="font-mono text-xs text-blue-600 break-all">{result.src}</p>
                    {result.alt && <p className="text-xs text-gray-500">Alt: {result.alt}</p>}
                  </div>
                ) : (
                  <div>
                    <p className="font-mono text-sm text-blue-600">{result.code}</p>
                    <p className="text-xs text-gray-500">Источник: {result.source}</p>
                  </div>
                )}
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
                    HTML Парсер & Security Scanner
                  </h1>
                  <p className="text-gray-600 mt-1">Профессиональный инструмент для веб-скрапинга и анализа безопасности</p>
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
                        <span className="font-medium text-sm">{mode.label}</span>
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
                      Использовать прокси (автоматический выбор)
                    </label>
                  </div>
                  
                  {proxyEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL прокси сервера (опционально)
                      </label>
                      <input
                        type="url"
                        value={proxyUrl}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        placeholder="https://proxy.example.com:8080"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Оставьте пустым для автоматического выбора прокси
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Информация:</strong> Система автоматически выбирает лучший прокси из цепочки серверов:
                    </p>
                    <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                      <li>CORS Proxy IO</li>
                      <li>AllOrigins</li>
                      <li>ThingProxy</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Примечание:</strong> Для обхода CORS ограничений используется цепочка публичных прокси сервисов. 
                      Система автоматически переключается между ними при сбоях. Внутренний парсер используется как резервный вариант.
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
                    {proxyEnabled ? (activeProxy ? `Активен (${activeProxy})` : 'Автоматический выбор') : 'Выключен'}
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
