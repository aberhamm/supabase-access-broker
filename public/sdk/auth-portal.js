(function (global) {
  function requireParam(name, value) {
    if (!value) throw new Error("Missing required param: " + name);
    return value;
  }

  function defaultPortalUrl() {
    return (global.__AUTH_PORTAL_URL__ || "").trim();
  }

  function login(params) {
    params = params || {};
    var portalUrl = (params.portalUrl || defaultPortalUrl() || "").trim();
    var appId = requireParam("appId", params.appId);
    var redirectUri = requireParam("redirectUri", params.redirectUri);
    var state = params.state;

    if (!portalUrl) throw new Error("Missing portalUrl. Pass { portalUrl } or set window.__AUTH_PORTAL_URL__");

    var url = new URL(portalUrl.replace(/\/+$/, "") + "/login");
    url.searchParams.set("app_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    if (state) url.searchParams.set("state", state);

    global.location.href = url.toString();
  }

  function getCodeFromUrl(locationLike) {
    var loc = locationLike || global.location;
    var u = new URL(loc.href);
    return u.searchParams.get("code");
  }

  async function exchangeCode(params) {
    params = params || {};
    var portalUrl = (params.portalUrl || defaultPortalUrl() || "").trim();
    var code = requireParam("code", params.code);
    var appId = requireParam("appId", params.appId);
    var appSecret = params.appSecret;

    if (!portalUrl) throw new Error("Missing portalUrl. Pass { portalUrl } or set window.__AUTH_PORTAL_URL__");

    var res = await fetch(portalUrl.replace(/\/+$/, "") + "/api/auth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        app_id: appId,
        app_secret: appSecret || undefined,
      }),
    });

    if (!res.ok) {
      var err = {};
      try {
        err = await res.json();
      } catch {}
      throw new Error(err.error || "Code exchange failed");
    }

    return await res.json();
  }

  global.AuthPortal = {
    login: login,
    getCodeFromUrl: getCodeFromUrl,
    exchangeCode: exchangeCode,
  };
})(typeof window !== "undefined" ? window : globalThis);
