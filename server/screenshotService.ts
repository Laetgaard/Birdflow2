import puppeteer from 'puppeteer';

export interface ScreenshotResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  viewport: { width: number; height: number };
}

// SSRF protection - block internal/private IP ranges and localhost
function isBlockedHost(hostname: string): boolean {
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./, // Link-local
    /^::1$/,
    /^fc00:/i, // IPv6 private
    /^fe80:/i, // IPv6 link-local
    /\.local$/i,
    /\.internal$/i,
    /\.localhost$/i,
  ];
  
  return blockedPatterns.some(pattern => pattern.test(hostname));
}

export async function captureWebsiteScreenshot(url: string): Promise<ScreenshotResult> {
  let browser = null;
  
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, error: 'Invalid URL protocol', viewport: { width: 0, height: 0 } };
    }

    // SSRF protection - block internal/private networks
    if (isBlockedHost(parsedUrl.hostname)) {
      return { success: false, error: 'Cannot capture internal or private URLs', viewport: { width: 0, height: 0 } };
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-130.0.6723.116/bin/chromium',
    });

    const page = await browser.newPage();
    
    // Set viewport for full desktop view
    const viewport = { width: 1440, height: 900 };
    await page.setViewport(viewport);

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait a bit for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Capture full page screenshot
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: true,
      type: 'jpeg',
      quality: 85,
    });

    return {
      success: true,
      imageBase64: screenshot as string,
      viewport,
    };
  } catch (error: any) {
    console.error('Screenshot capture error:', error);
    return {
      success: false,
      error: error.message || 'Failed to capture screenshot',
      viewport: { width: 0, height: 0 },
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
