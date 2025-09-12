/**
 * Configuration for AI service URLs and their associated properties
 */

export interface AIService {
  name: string;
  urls: string[];
  priority: number; // Lower number = higher priority
  inputSelectors: string[];
}

export const AI_SERVICES: AIService[] = [
  {
    name: 'ChatGPT',
    urls: ['chat.openai.com', 'chatgpt.com','usergpt.top', 'share.github.cn.com', 'x.liaox.ai'],
    priority: 1,
    inputSelectors: [
      'div[contenteditable="true"][id="prompt-textarea"]',
      'div[contenteditable="true"][id="prompt-textarea"].ProseMirror',
      'textarea[placeholder*="Ask anything"]',
      'textarea[placeholder*="ask anything"]', 
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      'input[placeholder*="Ask anything"]',
      'input[placeholder*="ask anything"]',
      'input[placeholder*="Ask"]',
      'input[placeholder*="ask"]',
      'textarea[data-testid*="input"]',
      'textarea[data-testid*="textbox"]',
      'textarea[aria-label*="input"]',
      'textarea[aria-label*="textbox"]',
      'div[contenteditable="true"][data-testid*="input"]',
      'div[contenteditable="true"][data-testid*="textbox"]'
    ]
  },
  {
    name: 'Gemini',
    urls: ['gemini.google.com'],
    priority: 2,
    inputSelectors: [
      'textarea[placeholder*="Enter a prompt"]',
      'textarea[placeholder*="enter a prompt"]',
      'textarea[placeholder*="Type a message"]',
      'textarea[placeholder*="type a message"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="message"]',
      'div[contenteditable="true"][data-testid*="prompt"]',
      'div[contenteditable="true"][aria-label*="prompt"]',
      'div[contenteditable="true"][aria-label*="message"]',
      'textarea[aria-label*="prompt"]',
      'textarea[aria-label*="message"]'
    ]
  }
];

/**
 * Check if a URL matches any AI service
 */
export const isAIServiceURL = (url: string): boolean => {
  return AI_SERVICES.some(service => 
    service.urls.some(serviceUrl => url.includes(serviceUrl))
  );
};

/**
 * Get the AI service that matches a URL
 */
export const getAIServiceByURL = (url: string): AIService | null => {
  return AI_SERVICES.find(service => 
    service.urls.some(serviceUrl => url.includes(serviceUrl))
  ) || null;
};

/**
 * Get all AI service URLs (flattened array)
 */
export const getAllAIServiceURLs = (): string[] => {
  return AI_SERVICES.flatMap(service => service.urls);
};

/**
 * Get all AI service input selectors (flattened array)
 */
export const getAllAIServiceInputSelectors = (): string[] => {
  return AI_SERVICES.flatMap(service => service.inputSelectors);
};

/**
 * Get AI services sorted by priority (highest priority first)
 */
export const getAIServicesByPriority = (): AIService[] => {
  return [...AI_SERVICES].sort((a, b) => a.priority - b.priority);
};
