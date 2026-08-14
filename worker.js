export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return Response.json({
        ok: true,
        service: "TAYSON test backend",
        status: "online",
        path: url.pathname,
        server_time: Math.floor(Date.now() / 1000)
      });
    }

    const raw = await request.text();
    let body = null;

    try {
      body = JSON.parse(raw);
    } catch {
      const params = new URLSearchParams(raw);
      if ([...params.keys()].length > 0) {
        body = Object.fromEntries(params.entries());
      }
    }

    const target = body?.Target ?? body?.target ?? null;

    console.log(JSON.stringify({
      time: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      target,
      body_length: raw.length
    }));

    return Response.json({
      error: 0,
      data: {
        test_backend: true,
        received: true,
        target,
        server_time: Math.floor(Date.now() / 1000)
      }
    });
  }
};
