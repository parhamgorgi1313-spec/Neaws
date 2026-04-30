export const config = {
  runtime: "edge",
};

// آدرس مقصد نهایی به‌صورت مستقیم در کد قرار گرفت
const REMOTE_SERVER = "https://ver.switchnet.sbs:8096";

// لیست سیاه هدرهای غیرمجاز برای عبور از پروکسی
const FORBIDDEN_HEADERS = [
  "host", "connection", "upgrade", "forwarded", "te", 
  "keep-alive", "transfer-encoding", "proxy-authorization",
  "proxy-authenticate", "trailer", "x-vercel-id", "x-vercel-proxy-signature"
];

export default async function mainHandler(request) {
  try {
    const { pathname, search } = new URL(request.url);
    const destinationUrl = REMOTE_SERVER + pathname + search;

    const newHeaders = new Headers();
    const incomingHeaders = Object.fromEntries(request.headers);

    // فیلتر کردن هدرها با متد جدید
    Object.keys(incomingHeaders).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!FORBIDDEN_HEADERS.includes(lowerKey) && !lowerKey.startsWith("x-vercel-")) {
        newHeaders.set(key, incomingHeaders[key]);
      }
    });

    // مدیریت آدرس IP کلاینت
    const realIp = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for");
    if (realIp) {
      newHeaders.set("X-Forwarded-For", realIp);
    }

    const isPostOrPut = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

    const connectionConfig = {
      method: request.method,
      headers: newHeaders,
      redirect: "manual",
      body: isPostOrPut ? request.body : null,
      ...(isPostOrPut && { duplex: "half" })
    };

    const result = await fetch(destinationUrl, connectionConfig);

    // بازسازی هدرهای پاسخ
    const responseHeaders = new Headers(result.headers);
    responseHeaders.delete("transfer-encoding");

    return new Response(result.body, {
      status: result.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response("Service Unavailable: Relay Failed", { status: 502 });
  }
}
