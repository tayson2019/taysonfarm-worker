const SENSITIVE_KEYS = new Set([
  "login_session", "session_id", "session", "udid", "android_id",
  "devaid", "serialNumber", "snsid", "farm_uuid", "ffs_sign",
  "sign_str", "token", "access_token", "password"
]);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

function summarize(value, depth = 0) {
  if (depth > 3) return "[...]";
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      sample: value.slice(0, 4).map(v => summarize(v, depth + 1))
    };
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 40)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null) {
        out[k] = summarize(v, depth + 1);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return value;
}

async function parseBody(request) {
  const raw = await request.text();
  let body = null;

  try {
    body = JSON.parse(raw);
  } catch {
    try {
      const params = new URLSearchParams(raw);
      if ([...params.keys()].length > 0) {
        body = Object.fromEntries(params.entries());

        // Some clients put the whole JSON request in a single form key/value.
        for (const [k, v] of Object.entries(body)) {
          if (typeof v === "string") {
            try {
              const nested = JSON.parse(v);
              if (nested && typeof nested === "object") {
                body[k] = nested;
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  return { raw, body };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);

    if (request.method === "GET") {
      return Response.json({
        ok: true,
        service: "TAYSON test backend V2",
        status: "online",
        path: url.pathname,
        server_time: now
      });
    }

    const { raw, body } = await parseBody(request);

    let target = null;
    if (body && typeof body === "object") {
      target = body.Target ?? body.target ?? null;

      // Handle a wrapped object if the request came through form encoding.
      if (!target) {
        for (const v of Object.values(body)) {
          if (v && typeof v === "object") {
            target = v.Target ?? v.target ?? target;
          }
        }
      }
    }

    const safeBody = body ? summarize(redact(body)) : null;

    console.log(JSON.stringify({
      tag: "TAYSON_REQUEST",
      time: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      target,
      content_type: request.headers.get("content-type"),
      content_length: raw.length,
      body: safeBody
    }));

    // Connectivity/diagnostic response.
    // Exact game handlers will be added after we capture the real Targets.
    return Response.json({
      error: 0,
      data: {
        test_backend: true,
        backend_version: 2,
        received: true,
        target,
        server_time: now
      }
    });
  }
};
