import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

export interface ParseResult {
  emails?: Array<{ email: string; source: string }>;
  links?: Array<{ url: string; text: string }>;
  data?: Array<{ title: string; content: string }>;
  html?: Array<{ tag: string; content: string }>;
}

export class HTMLParser {
  private proxyUrl?: string;

  constructor(proxyUrl?: string) {
    this.proxyUrl = proxyUrl;
  }

  private async fetchPage(url: string): Promise<string> {
    try {
      const config: any = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      };

      if (this.proxyUrl) {
        const proxyParts = this.proxyUrl.replace('http://', '').split(':');
        config.proxy = {
          host: proxyParts[0],
          port: parseInt(proxyParts[1]) || 8080
        };
      }

      const response = await axios.get(url, config);
      return response.data;
    } catch (error) {
      throw new Error(`Ошибка загрузки страницы: ${error}`);
    }
  }

  async parseEmails(url: string, onProgress?: (message: string) => void): Promise<Array<{ email: string; source: string }>> {
    onProgress?.('🌐 Загрузка страницы...');
    const html = await this.fetchPage(url);
    
    onProgress?.('🔍 Поиск email адресов...');
    const $ = cheerio.load(html);
    const emails = new Set<string>();
    const results: Array<{ email: string; source: string }> = [];

    // Регулярное выражение для поиска email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    // Поиск в тексте
    const pageText = $.text();
    const textEmails = pageText.match(emailRegex) || [];
    
    textEmails.forEach(email => {
      if (!emails.has(email.toLowerCase())) {
        emails.add(email.toLowerCase());
        results.push({ email, source: 'Текст страницы' });
      }
    });

    // Поиск в атрибутах href
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0];
        if (!emails.has(email.toLowerCase())) {
          emails.add(email.toLowerCase());
          results.push({ email, source: 'Ссылка mailto' });
        }
      }
    });

    // Поиск в мета-тегах
    $('meta').each((_, element) => {
      const content = $(element).attr('content') || '';
      const metaEmails = content.match(emailRegex) || [];
      metaEmails.forEach(email => {
        if (!emails.has(email.toLowerCase())) {
          emails.add(email.toLowerCase());
          results.push({ email, source: 'Мета-теги' });
        }
      });
    });

    onProgress?.(`✅ Найдено ${results.length} email адресов`);
    return results;
  }

  async parseLinks(url: string, onProgress?: (message: string) => void): Promise<Array<{ url: string; text: string }>> {
    onProgress?.('🌐 Загрузка страницы...');
    const html = await this.fetchPage(url);
    
    onProgress?.('🔗 Извлечение ссылок...');
    const $ = cheerio.load(html);
    const results: Array<{ url: string; text: string }> = [];
    const baseUrl = new URL(url);

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      
      if (href && text) {
        try {
          let fullUrl = href;
          if (href.startsWith('/')) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
          } else if (!href.startsWith('http')) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}/${href}`;
          }
          
          results.push({ url: fullUrl, text });
        } catch (error) {
          // Игнорируем некорректные URL
        }
      }
    });

    onProgress?.(`✅ Найдено ${results.length} ссылок`);
    return results;
  }

  async parseData(url: string, onProgress?: (message: string) => void): Promise<Array<{ title: string; content: string }>> {
    onProgress?.('🌐 Загрузка страницы...');
    const html = await this.fetchPage(url);
    
    onProgress?.('📊 Извлечение данных...');
    const $ = cheerio.load(html);
    const results: Array<{ title: string; content: string }> = [];

    // Телефоны
    const phoneRegex = /(\+7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/g;
    const pageText = $.text();
    const phones = pageText.match(phoneRegex) || [];
    phones.forEach(phone => {
      results.push({ title: 'Телефон', content: phone.trim() });
    });

    // Email (дублируем для полноты)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = pageText.match(emailRegex) || [];
    emails.forEach(email => {
      results.push({ title: 'Email', content: email });
    });

    // Заголовки
    $('h1, h2, h3').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        results.push({ title: `Заголовок ${element.tagName.toUpperCase()}`, content: text });
      }
    });

    // Цены (рубли)
    const priceRegex = /(\d+[\s,]?\d*)\s?(руб|₽|рублей?)/gi;
    const prices = pageText.match(priceRegex) || [];
    prices.forEach(price => {
      results.push({ title: 'Цена', content: price.trim() });
    });

    onProgress?.(`✅ Извлечено ${results.length} элементов данных`);
    return results;
  }

  async parseHTML(url: string, onProgress?: (message: string) => void): Promise<Array<{ tag: string; content: string }>> {
    onProgress?.('🌐 Загрузка страницы...');
    const html = await this.fetchPage(url);
    
    onProgress?.('🏷️ Анализ HTML структуры...');
    const $ = cheerio.load(html);
    const results: Array<{ tag: string; content: string }> = [];

    // Title
    const title = $('title').text().trim();
    if (title) {
      results.push({ tag: '<title>', content: title });
    }

    // Meta description
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) {
      results.push({ tag: '<meta description>', content: metaDesc });
    }

    // Meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      results.push({ tag: '<meta keywords>', content: metaKeywords });
    }

    // Заголовки
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        results.push({ tag: `<${element.tagName.toLowerCase()}>`, content: text });
      }
    });

    // Важные параграфы (первые 10)
    $('p').slice(0, 10).each((_, element) => {
      const text = $(element).text().trim();
      if (text && text.length > 20) {
        results.push({ tag: '<p>', content: text.substring(0, 200) + (text.length > 200 ? '...' : '') });
      }
    });

    onProgress?.(`✅ Найдено ${results.length} HTML элементов`);
    return results;
  }
}