const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=20, stale-while-revalidate=60",
    "access-control-allow-origin": "*",
  },
  body: JSON.stringify(body),
});

const toNumber = value => {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 Netlify quote proxy",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/csv,text/plain,*/*",
      "user-agent": "Mozilla/5.0 Netlify quote proxy",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) throw new Error("Yahoo chart inválido");

  const price = toNumber(meta.regularMarketPrice);
  if (price === null) throw new Error("Yahoo sin precio");

  const closes = (result?.indicators?.quote?.[0]?.close || [])
    .map(toNumber)
    .filter(Number.isFinite);
  const prev = closes.length >= 2
    ? closes[closes.length - 2]
    : (toNumber(meta.previousClose) ?? toNumber(meta.chartPreviousClose));
  const changeAbs = Number.isFinite(prev) && prev !== 0 ? price - prev : null;
  const changePct = changeAbs !== null ? (changeAbs / prev) * 100 : null;

  return {
    price,
    closed: meta.marketState !== "REGULAR",
    changeAbs,
    changePct,
    previous: prev,
    dayHigh: toNumber(meta.regularMarketDayHigh),
    dayLow: toNumber(meta.regularMarketDayLow),
    series: closes.length > 1 ? closes : null,
    source: "Netlify/Yahoo",
  };
}

function parseStooqCsv(csv) {
  const [, row] = csv.trim().split(/\r?\n/);
  if (!row) throw new Error("Stooq vacío");
  const [symbol, date, time, open, high, low, close] = row.split(",");
  const price = toNumber(close);
  if (price === null) throw new Error("Stooq sin precio");

  return {
    price,
    closed: true,
    changeAbs: null,
    changePct: null,
    previous: null,
    dayHigh: toNumber(high),
    dayLow: toNumber(low),
    series: null,
    source: `Netlify/Stooq ${symbol} ${date} ${time}`,
  };
}

async function quote(symbol) {
  const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`;
  try {
    return parseYahooChart(await fetchJson(yahooUrl));
  } catch (error) {
    if (symbol !== "^IBEX") throw error;
  }

  const stooqUrl = "https://stooq.com/q/l/?s=%5Eibex&f=sd2t2ohlcv&h&e=csv";
  return parseStooqCsv(await fetchText(stooqUrl));
}

async function fx() {
  const data = await fetchJson("https://api.frankfurter.app/latest?from=EUR&to=USD");
  const rate = toNumber(data?.rates?.USD);
  if (rate === null) throw new Error("FX sin tasa");
  return { rate, source: "Netlify/Frankfurter.app" };
}

exports.handler = async event => {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, {});

    const mode = event.queryStringParameters?.mode || "quote";
    if (mode === "fx") return json(200, await fx());

    const symbol = event.queryStringParameters?.symbol;
    if (!symbol) return json(400, { error: "Falta symbol" });
    return json(200, await quote(symbol));
  } catch (error) {
    return json(502, { error: error.message || "No se pudo obtener el dato" });
  }
};
